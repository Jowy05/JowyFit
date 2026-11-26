package com.jowy05.jowyfit.datos.copias

import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.TABLAS_JOWYFIT
import com.jowy05.jowyfit.dominio.ComidaDominio
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Importación y exportación 100 % compatible con copias .jowyfit (formatos V1 a V7, ZIP o cifradas).
 * Defensa en profundidad: anti zip-bomb en streaming, anti Zip Slip, verificación de cabeceras binarias de imagen,
 * validación estricta de estructura/límites, limpieza de píxeles espía y apagado de entrenosASalud al restaurar.
 */
object GestorCopias {

    private const val MB = 1024L * 1024L
    const val MAX_ARCHIVO = 400L * MB
    const val MAX_JSON = 50L * MB
    const val MAX_FOTO = 30L * MB
    const val MAX_TOTAL = 300L * MB
    const val MAX_ENTRADAS = 20_000
    const val MAX_FILAS_TABLA = 20_000
    const val MAX_FILA_JSON = 512 * 1024
    const val VERSION_MAX_SOPORTADA = 7

    private val RE_RUTA_MEDIA = Regex("^archivos/[A-Za-z0-9._-]{1,120}\\.(jpg|jpeg|png|webp|heic)$", RegexOption.IGNORE_CASE)

    class PideContrasena : Exception("Esta copia tiene contraseña")

    data class CopiaLeida(
        val version: Int,
        val registros: List<RegistroTablaEntity>,
        val archivosMedia: Map<String, ByteArray>,
    )

    /** Comprueba que una ruta multimedia sea estrictamente `archivos/<nombre>.<ext>` sin saltos ni subcarpetas. */
    fun esRutaMediaSegura(ruta: String?): Boolean {
        if (ruta.isNullOrEmpty() || ruta.contains("..") || ruta.contains('\\') || ruta.indexOf('\u0000') >= 0) {
            return false
        }
        return RE_RUTA_MEDIA.matches(ruta)
    }

    /** Verifica la firma binaria real de JPEG, PNG, WebP o HEIC (bloquea SVG, HTML, scripts o ejecutables disfrazados). */
    fun esImagenBinariaValida(bytes: ByteArray): Boolean {
        if (bytes.size < 4) return false
        val b0 = bytes[0].toInt() and 0xFF
        val b1 = bytes[1].toInt() and 0xFF
        val b2 = bytes[2].toInt() and 0xFF
        val b3 = bytes[3].toInt() and 0xFF
        // JPEG: FF D8 FF
        if (b0 == 0xFF && b1 == 0xD8 && b2 == 0xFF) return true
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (bytes.size >= 8 && b0 == 0x89 && b1 == 0x50 && b2 == 0x4E && b3 == 0x47 &&
            (bytes[4].toInt() and 0xFF) == 0x0D && (bytes[5].toInt() and 0xFF) == 0x0A &&
            (bytes[6].toInt() and 0xFF) == 0x1A && (bytes[7].toInt() and 0xFF) == 0x0A
        ) return true
        // WebP: RIFF....WEBP
        if (bytes.size >= 12 && b0 == 0x52 && b1 == 0x49 && b2 == 0x46 && b3 == 0x46 &&
            bytes[8] == 'W'.code.toByte() && bytes[9] == 'E'.code.toByte() &&
            bytes[10] == 'B'.code.toByte() && bytes[11] == 'P'.code.toByte()
        ) return true
        // HEIC/HEIF (ISOBMFF): ....ftyp
        if (bytes.size >= 12 && bytes[4] == 'f'.code.toByte() && bytes[5] == 't'.code.toByte() &&
            bytes[6] == 'y'.code.toByte() && bytes[7] == 'p'.code.toByte()
        ) return true
        return false
    }

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
            JsonJowyFit.parseToJsonElement(jsonTexto) as? JsonObject
        } catch (_: Exception) {
            null
        } ?: throw IllegalArgumentException("El archivo está dañado o no es una copia de JowyFit")

        val app = (raiz["app"] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
        if (app != "JowyFit") {
            throw IllegalArgumentException("El archivo no es una copia de JowyFit")
        }
        val versionPrim = raiz["version"] as? JsonPrimitive
        val version = if (versionPrim != null && !versionPrim.isString) versionPrim.intOrNull else null
        if (version == null || version < 1) {
            throw IllegalArgumentException("La copia es de una versión desconocida de JowyFit")
        }
        if (version > VERSION_MAX_SOPORTADA) {
            throw IllegalArgumentException("La copia es de una versión más nueva de JowyFit: actualiza la app")
        }

        val datos = raiz["datos"] as? JsonObject
            ?: throw IllegalArgumentException("La copia está dañada: no tiene datos")

        val perfiles = datos["perfil"] as? JsonArray
        if (perfiles == null || perfiles.size != 1) {
            throw IllegalArgumentException("La copia está vacía o incompleta: no trae tu perfil.")
        }
        val perfilObj = perfiles[0] as? JsonObject
            ?: throw IllegalArgumentException("La copia está dañada (perfil)")
        val perfilId = (perfilObj["id"] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
        val altaCompleta = (perfilObj["altaCompleta"] as? JsonPrimitive)?.booleanOrNull
        if (perfilId != "yo" || altaCompleta != true) {
            throw IllegalArgumentException("La copia está vacía o incompleta: no trae tu perfil.")
        }

        val registros = mutableListOf<RegistroTablaEntity>()
        for (tabla in TABLAS_JOWYFIT) {
            val elemTabla = datos[tabla] ?: continue
            val filas = elemTabla as? JsonArray
                ?: throw IllegalArgumentException("La copia está dañada ($tabla)")
            if (filas.size > MAX_FILAS_TABLA) {
                throw IllegalArgumentException("La copia tiene demasiados datos ($tabla)")
            }
            filas.forEachIndexed { idx, elem ->
                val obj = elem as? JsonObject
                    ?: throw IllegalArgumentException("La copia está dañada ($tabla)")
                val saneado = sanearFila(tabla, obj)
                val clave = extraerClave(tabla, saneado, idx)
                val fecha = extraerFecha(saneado)
                val payload = saneado.toString()
                if (payload.length > MAX_FILA_JSON) {
                    throw IllegalArgumentException("La copia tiene un registro demasiado grande ($tabla)")
                }
                registros += RegistroTablaEntity(
                    tabla = tabla,
                    clave = clave,
                    fecha = fecha,
                    payloadJson = payload,
                )
            }
        }

        return CopiaLeida(version = version, registros = registros, archivosMedia = media)
    }

    private fun sanearFila(tabla: String, obj: JsonObject): JsonObject = when (tabla) {
        "ajustes" -> buildJsonObject {
            for ((k, v) in obj) {
                // Los permisos de Health Connect pertenecen al dispositivo: siempre apagado al restaurar.
                if (k == "entrenosASalud") put(k, JsonPrimitive(false))
                else put(k, v)
            }
            if ("entrenosASalud" !in obj) put("entrenosASalud", JsonPrimitive(false))
        }
        "productos" -> buildJsonObject {
            for ((k, v) in obj) {
                if (k == "imagen") {
                    val segura = (v as? JsonPrimitive)?.contentOrNull?.let { ComidaDominio.imagenOFF(it) }
                    if (segura != null) put(k, JsonPrimitive(segura))
                } else {
                    put(k, v)
                }
            }
        }
        else -> sanearReferenciasMedia(obj)
    }

    /** Descarta referencias `__archivo` manipuladas con `../` o extensiones peligrosas. */
    private fun sanearReferenciasMedia(obj: JsonObject): JsonObject = buildJsonObject {
        for ((k, v) in obj) {
            val limpio = sanearElemento(v)
            if (limpio != null) put(k, limpio)
        }
    }

    private fun sanearElemento(elem: JsonElement): JsonElement? = when (elem) {
        is JsonObject -> {
            if ("__archivo" in elem) {
                val ruta = (elem["__archivo"] as? JsonPrimitive)?.contentOrNull
                if (esRutaMediaSegura(ruta)) elem else null
            } else {
                sanearReferenciasMedia(elem)
            }
        }
        is JsonArray -> JsonArray(elem.mapNotNull(::sanearElemento))
        is JsonNull -> elem
        else -> elem
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

            // Las fotos ya están comprimidas (JPEG/PNG/WebP): level 0 evita trabajo y RAM extra en el móvil.
            zos.setLevel(0)
            for ((ruta, contenido) in archivosMedia) {
                if (!esRutaMediaSegura(ruta)) continue
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

        try {
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
                            if (totalLeido > MAX_TOTAL) {
                                throw IllegalArgumentException("La copia es demasiado grande para abrirla")
                            }
                            jsonTexto = data.toString(Charsets.UTF_8).removePrefix("\uFEFF")
                        }
                        esRutaMediaSegura(nombre) -> {
                            val data = leerConTope(zis, MAX_FOTO, "La copia tiene una foto demasiado grande")
                            totalLeido += data.size
                            if (totalLeido > MAX_TOTAL) {
                                throw IllegalArgumentException("La copia es demasiado grande para abrirla")
                            }
                            // Solo se conservan imágenes con cabecera binaria válida (nunca SVG/HTML/ejecutables).
                            if (esImagenBinariaValida(data)) {
                                media[nombre] = data
                            }
                        }
                        else -> {
                            // Se ignoran entradas ajenas o sospechosas sin descomprimirlas en memoria.
                        }
                    }
                    zis.closeEntry()
                }
            }
        } catch (e: IllegalArgumentException) {
            throw e
        } catch (_: Exception) {
            throw IllegalArgumentException("El archivo está dañado (no se puede descomprimir)")
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
        "perfil" -> (obj["id"] as? JsonPrimitive)?.contentOrNull ?: "yo"
        "ajustes" -> (obj["id"] as? JsonPrimitive)?.contentOrNull ?: "app"
        "productos" -> (obj["codigo"] as? JsonPrimitive)?.contentOrNull ?: "prod-$idx"
        "pasos", "suplementos" -> (obj["fecha"] as? JsonPrimitive)?.contentOrNull ?: "fecha-$idx"
        else -> (obj["id"] as? JsonPrimitive)?.contentOrNull ?: (idx + 1).toString()
    }

    private fun extraerFecha(obj: JsonObject): String {
        val f = (obj["fecha"] as? JsonPrimitive)?.contentOrNull
            ?: (obj["creada"] as? JsonPrimitive)?.contentOrNull
            ?: (obj["creado"] as? JsonPrimitive)?.contentOrNull
            ?: (obj["guardado"] as? JsonPrimitive)?.contentOrNull
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
