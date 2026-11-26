package com.jowy05.jowyfit.datos.copias

import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.TABLAS_JOWYFIT
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Importación y exportación 100 % compatible con copias .jowyfit (formatos V1 a V7, ZIP o cifradas).
 * Aplica los mismos límites de seguridad contra zip bombs y entradas duplicadas que src/datos/copias.ts.
 */
object GestorCopias {

    private const val MB = 1024L * 1024L
    const val MAX_ARCHIVO = 400L * MB
    const val MAX_JSON = 50L * MB
    const val MAX_FOTO = 30L * MB
    const val MAX_TOTAL = 300L * MB
    const val MAX_ENTRADAS = 20_000
    const val VERSION_MAX_SOPORTADA = 7

    class PideContrasena : Exception("Esta copia tiene contraseña")

    data class CopiaLeida(
        val version: Int,
        val registros: List<RegistroTablaEntity>,
        val archivosMedia: Map<String, ByteArray>,
    )

    fun leerCopia(bytesEntrada: ByteArray, contrasena: String? = null): CopiaLeida {
        if (bytesEntrada.isEmpty()) throw IllegalArgumentException("El archivo está vacío")
        if (bytesEntrada.size.toLong() > MAX_ARCHIVO + CifradoCopia.EXTRA_CIFRADO) {
            throw IllegalArgumentException("El archivo es demasiado grande para ser una copia de JowyFit")
        }

        val bytes = if (CifradoCopia.esCifrada(bytesEntrada)) {
            if (contrasena.isNullOrEmpty()) throw PideContrasena()
            CifradoCopia.descifrar(bytesEntrada, contrasena)
        } else {
            if (bytesEntrada.size.toLong() > MAX_ARCHIVO) {
                throw IllegalArgumentException("El archivo es demasiado grande para ser una copia de JowyFit")
            }
            bytesEntrada
        }

        val esZip = bytes.size >= 2 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte()
        val (jsonTexto, media) = if (esZip) {
            descomprimirZipSeguro(bytes)
        } else {
            if (bytes.size.toLong() > MAX_JSON) {
                throw IllegalArgumentException("La copia es demasiado grande para abrirla")
            }
            bytes.toString(Charsets.UTF_8).removePrefix("\uFEFF") to emptyMap()
        }

        val raiz = try {
            JsonJowyFit.parseToJsonElement(jsonTexto).jsonObject
        } catch (_: Exception) {
            throw IllegalArgumentException("El archivo está dañado o no es una copia de JowyFit")
        }

        val app = raiz["app"]?.jsonPrimitive?.contentOrNull
        if (app != "JowyFit") {
            throw IllegalArgumentException("El archivo no es una copia de JowyFit")
        }
        val version = raiz["version"]?.jsonPrimitive?.intOrNull
            ?: throw IllegalArgumentException("La copia es de una versión desconocida de JowyFit")
        if (version < 1) throw IllegalArgumentException("La copia es de una versión desconocida de JowyFit")
        if (version > VERSION_MAX_SOPORTADA) {
            throw IllegalArgumentException("La copia es de una versión más nueva de JowyFit: actualiza la app")
        }

        val datos = raiz["datos"]?.jsonObject
            ?: throw IllegalArgumentException("La copia está dañada: no tiene datos")

        val perfiles = datos["perfil"] as? JsonArray
        if (perfiles == null || perfiles.isEmpty()) {
            throw IllegalArgumentException("La copia está vacía o incompleta: no trae tu perfil.")
        }

        val registros = mutableListOf<RegistroTablaEntity>()
        for (tabla in TABLAS_JOWYFIT) {
            val filas = datos[tabla]?.jsonArray ?: continue
            filas.forEachIndexed { idx, elem ->
                val obj = elem.jsonObject
                val clave = extraerClave(tabla, obj, idx)
                val fecha = extraerFecha(obj)
                registros += RegistroTablaEntity(
                    tabla = tabla,
                    clave = clave,
                    fecha = fecha,
                    payloadJson = obj.toString(),
                )
            }
        }

        return CopiaLeida(version = version, registros = registros, archivosMedia = media)
    }

    /** Exporta todas las tablas y los archivos multimedia a un ZIP .jowyfit V7 válido (opcionalmente cifrado). */
    fun crearCopia(
        registros: List<RegistroTablaEntity>,
        archivosMedia: Map<String, ByteArray> = emptyMap(),
        contrasena: String? = null,
    ): ByteArray {
        val porTabla = registros.groupBy { it.tabla }
        val datosObj = buildJsonObject {
            for (tabla in TABLAS_JOWYFIT) {
                val lista = porTabla[tabla].orEmpty().map { JsonJowyFit.parseToJsonElement(it.payloadJson) }
                put(tabla, JsonArray(lista))
            }
        }
        val raiz = buildJsonObject {
            put("app", JsonPrimitive("JowyFit"))
            put("version", JsonPrimitive(VERSION_MAX_SOPORTADA))
            put("creada", JsonPrimitive(Instant.now().toString()))
            put("datos", datosObj)
        }

        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->
            zos.setLevel(6)
            zos.putNextEntry(ZipEntry("datos.json"))
            zos.write(raiz.toString().toByteArray(Charsets.UTF_8))
            zos.closeEntry()

            for ((ruta, contenido) in archivosMedia) {
                if (!ruta.startsWith("archivos/") || ruta.contains("..")) continue
                zos.putNextEntry(ZipEntry(ruta))
                zos.write(contenido)
                zos.closeEntry()
            }
        }
        val zipBytes = baos.toByteArray()
        return if (!contrasena.isNullOrEmpty()) CifradoCopia.cifrar(zipBytes, contrasena) else zipBytes
    }

    private fun descomprimirZipSeguro(bytes: ByteArray): Pair<String, Map<String, ByteArray>> {
        val vistos = HashSet<String>()
        var entradas = 0
        var totalLeido = 0L
        var jsonTexto: String? = null
        val media = LinkedHashMap<String, ByteArray>()

        ZipInputStream(ByteArrayInputStream(bytes)).use { zis ->
            while (true) {
                val entry = zis.nextEntry ?: break
                entradas++
                if (entradas > MAX_ENTRADAS) {
                    throw IllegalArgumentException("El archivo no es una copia de JowyFit (tiene demasiados archivos dentro)")
                }
                val nombre = entry.name
                if (!vistos.add(nombre)) {
                    throw IllegalArgumentException("El archivo está dañado (no se puede descomprimir)")
                }
                if (entry.isDirectory) {
                    zis.closeEntry()
                    continue
                }

                when {
                    nombre == "datos.json" -> {
                        val data = leerConTope(zis, MAX_JSON, "La copia es demasiado grande para abrirla")
                        totalLeido += data.size
                        jsonTexto = data.toString(Charsets.UTF_8).removePrefix("\uFEFF")
                    }
                    nombre.startsWith("archivos/") && !nombre.contains("..") &&
                        (nombre.endsWith(".jpg", true) || nombre.endsWith(".jpeg", true) ||
                            nombre.endsWith(".png", true) || nombre.endsWith(".webp", true)) -> {
                        val data = leerConTope(zis, MAX_FOTO, "La copia tiene una foto demasiado grande")
                        totalLeido += data.size
                        if (totalLeido > MAX_TOTAL) {
                            throw IllegalArgumentException("La copia es demasiado grande para abrirla")
                        }
                        media[nombre] = data
                    }
                    else -> {
                        // Se ignoran entradas ajenas sin descomprimirlas en memoria.
                    }
                }
                zis.closeEntry()
            }
        }

        val json = jsonTexto ?: throw IllegalArgumentException("El archivo no es una copia de JowyFit")
        return json to media
    }

    private fun leerConTope(zis: ZipInputStream, maxBytes: Long, mensajeError: String): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16 * 1024)
        var acumulado = 0L
        while (true) {
            val n = zis.read(buf)
            if (n == -1) break
            acumulado += n
            if (acumulado > maxBytes) throw IllegalArgumentException(mensajeError)
            out.write(buf, 0, n)
        }
        return out.toByteArray()
    }

    private fun extraerClave(tabla: String, obj: JsonObject, idx: Int): String = when (tabla) {
        "perfil" -> obj["id"]?.jsonPrimitive?.contentOrNull ?: "yo"
        "ajustes" -> obj["id"]?.jsonPrimitive?.contentOrNull ?: "app"
        "productos" -> obj["codigo"]?.jsonPrimitive?.contentOrNull ?: "prod-$idx"
        "pasos", "suplementos" -> obj["fecha"]?.jsonPrimitive?.contentOrNull ?: "fecha-$idx"
        else -> obj["id"]?.jsonPrimitive?.contentOrNull ?: (idx + 1).toString()
    }

    private fun extraerFecha(obj: JsonObject): String {
        val f = obj["fecha"]?.jsonPrimitive?.contentOrNull
            ?: obj["creada"]?.jsonPrimitive?.contentOrNull
            ?: obj["creado"]?.jsonPrimitive?.contentOrNull
            ?: obj["guardado"]?.jsonPrimitive?.contentOrNull
            ?: ""
        return if (f.length >= 10) f.substring(0, 10) else f
    }

    /** Neutraliza celdas CSV peligrosas (=, +, -, @, tab) para Excel/Sheets. */
    fun celdaCsvSegura(valor: String): String {
        val limpio = valor.replace("\r\n", " ").replace('\n', ' ').trim()
        val neutral = if (limpio.isNotEmpty() && limpio[0] in charArrayOf('=', '+', '-', '@', '\t')) {
            "'$limpio"
        } else {
            limpio
        }
        return if (neutral.any { it == ',' || it == '"' || it == ';' }) {
            "\"${neutral.replace("\"", "\"\"")}\""
        } else {
            neutral
        }
    }
}
