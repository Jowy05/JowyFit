package com.jowy05.jowyfit.nativo

import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.ComidaDominio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Cliente ligero de Open Food Facts (API v2): solo envía el código de barras. */
object ClienteOpenFoodFacts {

    sealed interface Resultado {
        data class Encontrado(val producto: Producto) : Resultado
        data object NoEncontrado : Resultado
        data object SinConexion : Resultado
    }

    fun urlProducto(codigo: String): String {
        val enc = URLEncoder.encode(codigo.trim(), "UTF-8")
        return "https://world.openfoodfacts.org/api/v2/product/$enc.json" +
            "?fields=product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_front_url&lc=es&app_name=JowyFit"
    }

    suspend fun buscar(codigo: String): Resultado = withContext(Dispatchers.IO) {
        val limpio = codigo.trim()
        if (!ComidaDominio.codigoValido(limpio)) return@withContext Resultado.NoEncontrado
        runCatching {
            val conn = (URL(urlProducto(limpio)).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 9_000
                readTimeout = 9_000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "JowyFit/Android (+https://github.com/Jowy05/JowyFit)")
            }
            try {
                when (conn.responseCode) {
                    404 -> Resultado.NoEncontrado
                    in 200..299 -> {
                        val cuerpo = conn.inputStream.bufferedReader().use { it.readText() }
                        val json = JsonJowyFit.parseToJsonElement(cuerpo).jsonObject
                        val prod = ComidaDominio.leerOFF(limpio, json)
                        if (prod != null) Resultado.Encontrado(prod) else Resultado.NoEncontrado
                    }
                    else -> Resultado.SinConexion
                }
            } finally {
                conn.disconnect()
            }
        }.getOrElse { Resultado.SinConexion }
    }
}
