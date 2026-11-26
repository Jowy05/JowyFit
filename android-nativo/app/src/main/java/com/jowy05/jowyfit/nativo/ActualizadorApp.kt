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
    private const val MAX_API_JSON_BYTES = 256 * 1024
    private const val MAX_REDIRECCIONES = 5
    private val RE_SHA_HEX = Regex("^[0-9a-f]{64}$")

    sealed interface ResultadoInstalacion {
        data object PermisoRequerido : ResultadoInstalacion
        data object Instalando : ResultadoInstalacion
    }

    /** Solo HTTPS sin credenciales embebidas ni puertos raros hacia github.com o *.githubusercontent.com. */
    fun esUrlDescargaPermitida(url: String): Boolean = runCatching {
        val u = URL(url.trim())
        val host = u.host.lowercase(Locale.ROOT)
        val puertoOk = u.port == -1 || u.port == 443
        val sinCredenciales = u.userInfo == null
        u.protocol.equals("https", true) &&
            puertoOk &&
            sinCredenciales &&
            (host == "github.com" || host.endsWith(".githubusercontent.com"))
    }.getOrDefault(false)

    private fun leerTextoConTope(conn: HttpURLConnection, maxBytes: Int): String {
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(8 * 1024)
        var total = 0
        conn.inputStream.use { input ->
            while (true) {
                val n = input.read(buf)
                if (n == -1) break
                total += n
                if (total > maxBytes) throw IOException("Respuesta del servidor demasiado grande")
                out.write(buf, 0, n)
            }
        }
        return out.toString(Charsets.UTF_8.name())
    }

    suspend fun buscar(
        versionActual: String,
        canal: String = ActualizacionDominio.CANAL_OFICIAL,
        buildActual: Int = 0,
    ): Result<ActualizacionDominio.InfoActualizacion> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL(ActualizacionDominio.urlApiParaCanal(canal)).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("User-Agent", "JowyFit-Android-Kotlin")
            }
            try {
                if (conn.responseCode !in 200..299) {
                    throw IOException("HTTP ${conn.responseCode}")
                }
                val body = leerTextoConTope(conn, MAX_API_JSON_BYTES)
                val json = JsonJowyFit.parseToJsonElement(body).jsonObject
                ActualizacionDominio.parsearRelease(json, versionActual, canal = canal, buildActual = buildActual)
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
        require(ActualizacionDominio.urlApkSegura(url, info.canal)) { "Enlace de actualización no válido" }
        val shaEsperado = info.sha256?.trim()?.lowercase(Locale.ROOT)
        if (shaEsperado == null || !RE_SHA_HEX.matches(shaEsperado)) {
            throw SecurityException("La publicación no incluye huella SHA-256 verificable")
        }

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
            val calculado = sha.digest().joinToString("") { "%02x".format(it) }
            if (calculado != shaEsperado) {
                throw SecurityException("La huella SHA-256 no coincide con la versión publicada")
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
            if (!esUrlDescargaPermitida(actual)) throw SecurityException("Destino de descarga no permitido")
            val u = URL(actual)

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
