package cl.allan.senal

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

/**
 * SEÑAL — App by Allan
 *
 * Arquitectura híbrida a propósito:
 *
 *  - La interfaz completa (carrusel, ficha, arranque) es el mismo HTML/CSS/JS
 *    que corre en el LG. Un solo código para las dos plataformas.
 *  - El video NO va por el <video> del WebView: el WebView de Android no
 *    reproduce HLS. Lo pone ExoPlayer nativo, con decodificación por hardware.
 *
 * El truco de composición: el PlayerView va ABAJO y el WebView ARRIBA con
 * fondo transparente. Así la ficha del canal y los estados flotan sobre el
 * video real sin tener que duplicar nada de la UI en Kotlin.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var playerView: PlayerView
    private var player: ExoPlayer? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.BLACK)
        }

        // --- Capa 1: video ---
        playerView = PlayerView(this).apply {
            layoutParams = ViewGroup.LayoutParams(MATCH, MATCH)
            useController = false                       // los controles son la UI web
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            isFocusable = false                         // el foco vive siempre en el WebView
            isFocusableInTouchMode = false
            visibility = View.GONE
        }
        root.addView(playerView)

        // --- Capa 2: interfaz ---
        web = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.TRANSPARENT)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/web/index.html")
        }
        root.addView(web)

        setContentView(root)
        web.requestFocus()
    }

    /** Superficie que consume app.js cuando detecta window.Android. */
    private inner class Bridge {

        @JavascriptInterface
        fun play(url: String, name: String) = runOnUiThread {
            val p = player ?: ExoPlayer.Builder(this@MainActivity).build().also {
                it.addListener(PlayerEvents())
                playerView.player = it
                player = it
            }
            playerView.visibility = View.VISIBLE
            p.setMediaItem(MediaItem.fromUri(url))
            p.prepare()
            p.playWhenReady = true
        }

        @JavascriptInterface
        fun stop() = runOnUiThread {
            player?.stop()
            player?.clearMediaItems()
            playerView.visibility = View.GONE
        }
    }

    /** Traduce los eventos de ExoPlayer al mismo vocabulario que usa la UI web. */
    private inner class PlayerEvents : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_READY -> toWeb("playing")
                Player.STATE_BUFFERING -> toWeb("buffering")
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            // El nombre del error es mucho mas util que un "algo fallo" generico
            // cuando un CDN se cae y hay que saber si fue red, codec o 403.
            toWeb("error", error.errorCodeName)
        }
    }

    private fun toWeb(event: String, detail: String = "") {
        val js = "window.SENAL && window.SENAL.native('$event','${detail.replace("'", "")}')"
        web.evaluateJavascript(js, null)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        // El WebView no recibe KEYCODE_BACK, hay que puentearlo a mano.
        // Las flechas del D-pad sí llegan a JS como keyCode 37-40, por eso
        // toda la navegación del carrusel funciona sin tocar nada.
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            web.evaluateJavascript("window.SENAL ? window.SENAL.back() : false") { result ->
                if (result != "true") finish()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onStop() {
        super.onStop()
        player?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        player?.release()
        player = null
    }

    private companion object {
        const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    }
}
