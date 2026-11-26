package com.jowy05.jowyfit.nativo

import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.ComidaDominio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

/** Cliente ligero de Open Food Facts (API v2): solo envía el código de barras, HTTPS estricto y tope de respuesta. */
object ClienteOpenFoodFacts {

    private const val MAX_RESPUESTA_BYTES = 256 * 1024
    private const val MAX_REDIRECCIONES = 2

    sealed interface Resultado {
        data class Encontrado(val producto: Producto) : Resultado
        data object NoEncontrado : Resultado
        data object SinConexion : Resultado
    }

    fun esUrlOffSegura(url: String): Boolean = runCatching {
        val u = URL(url.trim())
        val host = u.host.lowercase(Locale.ROOT)
        u.protocol.equals("https", true) &&
            u.userInfo == null &&
            (u.port == -1 || u.port == 443) &&
            (host == "world.openfoodfacts.org" || host.endsWith(".openfoodfacts.org"))
    }.getOrDefault(false)

    fun urlProducto(codigo: String): String {
        val limpio = codigo.trim()
        require(ComidaDominio.codigoValido(limpio)) { "Código de barras no válido" }
        val enc = URLEncoder.encode(limpio, "UTF-8")
        return "https://world.openfoodfacts.org/api/v2/product/$enc.json" +
            "?fields=product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_front_url&lc=es&app_name=JowyFit"
    }

    suspend fun buscar(codigo: String): Resultado = withContext(Dispatchers.IO) {
        val limpio = codigo.trim()
        if (!ComidaDominio.codigoValido(limpio)) return@withContext Resultado.NoEncontrado
        runCatching {
            var actual = urlProducto(limpio)
            repeat(MAX_REDIRECCIONES + 1) {
                if (!esUrlOffSegura(actual)) return@withContext Resultado.SinConexion
                val u = URL(actual)
                val conn = (u.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    instanceFollowRedirects = false
                    connectTimeout = 9_000
                    readTimeout = 9_000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("User-Agent", "JowyFit/Android (+https://github.com/Jowy05/JowyFit)")
                }
                try {
                    when (conn.responseCode) {
                        301, 302, 303, 307, 308 -> {
                            val loc = conn.getHeaderField("Location") ?: return@withContext Resultado.SinConexion
                            actual = URL(u, loc).toString()
                        }
                        404 -> return@withContext Resultado.NoEncontrado
                        in 200..299 -> {
                            val cuerpo = leerConTope(conn, MAX_RESPUESTA_BYTES)
                            val json = JsonJowyFit.parseToJsonElement(cuerpo).jsonObject
                            val prod = ComidaDominio.leerOFF(limpio, json)
                            return@withContext if (prod != null) Resultado.Encontrado(prod) else Resultado.NoEncontrado
                        }
                        else -> return@withContext Resultado.SinConexion
                    }
                } finally {
                    conn.disconnect()
                }
            }
            Resultado.SinConexion
        }.getOrElse { Resultado.SinConexion }
    }

    private fun leerConTope(conn: HttpURLConnection, maxBytes: Int): String {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(8 * 1024)
        var total = 0
        conn.inputStream.use { input ->
            while (true) {
                val n = input.read(buf)
                if (n == -1) break
                total += n
                if (total > maxBytes) throw IOException("Respuesta demasiado grande")
                out.write(buf, 0, n)
            }
        }
        return out.toString(Charsets.UTF_8.name())
    }
}
