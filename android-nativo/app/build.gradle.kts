import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// Lee la versión del package.json raíz para mantener sincronizado el número de versión.
val packageJsonText = rootProject.file("../package.json").readText()
val versionMatch = Regex("\"version\"\\s*:\\s*\"(\\d+)\\.(\\d+)\\.(\\d+)\"").find(packageJsonText)
val vMayor = versionMatch?.groupValues?.get(1)?.toInt() ?: 0
val vMenor = versionMatch?.groupValues?.get(2)?.toInt() ?: 13
val vParche = versionMatch?.groupValues?.get(3)?.toInt() ?: 0
val versionApp = "$vMayor.$vMenor.$vParche"

val firmaProps = Properties()
val ficheroFirma = rootProject.file("../android/keystore.properties")
if (ficheroFirma.exists()) {
    FileInputStream(ficheroFirma).use { firmaProps.load(it) }
}

// Copia únicamente el catálogo RepDB (JSON + miniaturas/imágenes) a assets generados sin duplicarlo en git.
val carpetaAssetsRepdb = layout.buildDirectory.dir("generated/assets/repdb")
val prepararAssetsRepdb = tasks.register<Sync>("prepararAssetsRepdb") {
    from(rootProject.file("../public/repdb"))
    into(carpetaAssetsRepdb.map { it.dir("repdb") })
}

android {
    namespace = "com.jowy05.jowyfit"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jowy05.jowyfit"
        minSdk = 26
        targetSdk = 36
        versionCode = vMayor * 10000 + vMenor * 100 + vParche
        versionName = versionApp
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["appLabel"] = "JowyFit"
        buildConfigField("String", "VERSION_APP", "\"$versionApp\"")
    }

    signingConfigs {
        create("release") {
            if (ficheroFirma.exists()) {
                val ruta = firmaProps.getProperty("storeFile")
                if (ruta != null) {
                    storeFile = rootProject.file("../android/app/$ruta")
                        .takeIf { it.exists() }
                        ?: rootProject.file("../android/$ruta").takeIf { it.exists() }
                        ?: file(ruta)
                }
                storePassword = firmaProps.getProperty("storePassword")
                keyAlias = firmaProps.getProperty("keyAlias")
                keyPassword = firmaProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            manifestPlaceholders["appLabel"] = "JowyFit Dev"
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        // Variante firmada paralela para probar JowyFit Kotlin al lado de la app actual sin pisar datos.
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".nativo"
            versionNameSuffix = "-kotlin-f2"
            manifestPlaceholders["appLabel"] = "JowyFit Kotlin"
            matchingFallbacks += listOf("release")
        }
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(carpetaAssetsRepdb)
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

tasks.named("preBuild") {
    dependsOn(prepararAssetsRepdb)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.core:core-splashscreen:1.2.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    // Room: base local SQLite equivalente a las 14 tablas de Dexie.
    val roomVersion = "2.7.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // Imágenes (miniaturas RepDB WebP y fotos de progreso/comidas).
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Widget nativo de pantalla de inicio (Glance).
    implementation("androidx.glance:glance-appwidget:1.1.1")
    implementation("androidx.glance:glance-material3:1.1.1")

    // Trabajo en segundo plano (copias semanales y recordatorios inteligentes).
    implementation("androidx.work:work-runtime-ktx:2.10.1")

    // Health Connect SDK nativo.
    implementation("androidx.health.connect:connect-client:1.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
