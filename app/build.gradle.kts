plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "cl.allan.senal"
    compileSdk = 34

    defaultConfig {
        applicationId = "cl.allan.senal"
        minSdk = 21          // Android TV 5.0 en adelante
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity:1.9.2")
    implementation("androidx.annotation:annotation:1.8.2")

    // Media3 reemplaza al ExoPlayer independiente. media3-exoplayer-hls es
    // la pieza clave: es lo que el WebView de Android no sabe hacer solo.
    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")
}
