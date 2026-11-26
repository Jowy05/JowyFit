package com.jowy05.jowyfit.nativo

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale

/** Comprobación, descarga verificada (SHA-256 + allowlist HTTPS) e instalación del APK oficial. */
object ActualizadorApp {

    private const val MAX_BYTES = 150L * 1024L * 1024L
    private const val MAX_REDIRECCIONES = 5

    sealed interface ResultadoInstalacion {
        data object PermisoRequerido : ResultadoInstalacion
        data object Instalando : ResultadoInstalacion
    }

    suspend fun buscar(versionActual: String): Result<ActualizacionDominio.InfoActualizacion> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL(ActualizacionDominio.API_ULTIMA_RELEASE).openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("User-Agent", "JowyFit-Android-Kotlin")
            }
            try {
                if (conn.responseCode !in 200..299) {
                    throw IOException("HTTP ${conn.responseCode}")
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JsonJowyFit.parseToJsonElement(body).jsonObject
                ActualizacionDominio.parsearRelease(json, versionActual)
                    ?: throw IOException("Respuesta de GitHub no válida")
            } finally {
                conn.disconnect()
            }
        }
    }

    suspend fun descargarEInstalar(
        context: Context,
        info: ActualizacionDominio.InfoActualizacion,
        alProgreso: (Int) -> Unit,
    ): ResultadoInstalacion = withContext(Dispatchers.IO) {
        val url = info.urlApk
        require(ActualizacionDominio.urlApkSegura(url)) { "Enlace de actualización no válido" }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val i = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(i) }
            return@withContext ResultadoInstalacion.PermisoRequerido
        }

        val carpeta = File(context.cacheDir, "compartir").apply { mkdirs() }
        val tmp = File(carpeta, "JowyFit-actualizacion.apk.tmp")
        val destino = File(carpeta, "JowyFit-actualizacion.apk")
        var conn: HttpURLConnection? = null

        try {
            conn = abrirConexionSegura(url!!)
            val total = conn.contentLengthLong
            if (total > MAX_BYTES) throw IOException("El archivo es demasiado grande")

            val sha = MessageDigest.getInstance("SHA-256")
            var descargado = 0L
            var ultimoPct = -1
            val buf = ByteArray(32 * 1024)

            conn.inputStream.use { input ->
                FileOutputStream(tmp).use { out ->
                    while (true) {
                        val n = input.read(buf)
                        if (n == -1) break
                        descargado += n
                        if (descargado > MAX_BYTES) throw IOException("Tamaño máximo superado")
                        out.write(buf, 0, n)
                        sha.update(buf, 0, n)
                        if (total > 0) {
                            val pct = ((descargado * 100L) / total).toInt().coerceIn(0, 100)
                            if (pct != ultimoPct) {
                                ultimoPct = pct
                                alProgreso(pct)
                            }
                        }
                    }
                    out.flush()
                }
            }

            if (descargado == 0L) throw IOException("Archivo vacío")
            if (!info.sha256.isNullOrBlank()) {
                val calculado = sha.digest().joinToString("") { "%02x".format(it) }
                if (calculado != info.sha256.lowercase(Locale.ROOT)) {
                    throw SecurityException("La huella SHA-256 no coincide con la versión publicada")
                }
            }

            if (destino.exists()) destino.delete()
            if (!tmp.renameTo(destino)) throw IOException("No se pudo guardar el instalador")

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", destino)
            val instalar = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(instalar)
            ResultadoInstalacion.Instalando
        } catch (e: Exception) {
            tmp.delete()
            throw e
        } finally {
            conn?.disconnect()
        }
    }

    private fun abrirConexionSegura(inicial: String): HttpURLConnection {
        var actual = inicial
        repeat(MAX_REDIRECCIONES + 1) {
            val u = URL(actual)
            val host = u.host.lowercase(Locale.ROOT)
            val permitido = u.protocol.equals("https", true) &&
                (host == "github.com" || host.endsWith(".githubusercontent.com"))
            if (!permitido) throw SecurityException("Destino de descarga no permitido")

            val conn = (u.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Accept", "application/octet-stream")
                setRequestProperty("User-Agent", "JowyFit-Android-Kotlin")
            }
            val code = conn.responseCode
            if (code in listOf(301, 302, 303, 307, 308)) {
                val loc = conn.getHeaderField("Location")
                conn.disconnect()
                if (loc.isNullOrBlank()) throw IOException("Redirección vacía")
                actual = URL(u, loc).toString()
            } else if (code in 200..299) {
                return conn
            } else {
                conn.disconnect()
                throw IOException("HTTP $code")
            }
        }
        throw IOException("Demasiadas redirecciones")
    }
}
