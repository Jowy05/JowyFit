package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.dominio.ExportarLigero
import com.jowy05.jowyfit.nativo.ActualizadorApp
import com.jowy05.jowyfit.nativo.ClienteOpenFoodFacts
import com.jowy05.jowyfit.nativo.GeneradorPdfNativo
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.util.zip.CRC32
import java.util.zip.Deflater
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Batería defensiva de seguridad para JowyFit Kotlin Nativo:
 * - Endurecimiento de AndroidManifest, Network Security Config, Data Extraction Rules y FileProvider.
 * - Defensa contra zip bombs, Zip Slip, entradas duplicadas, malware disfrazado de foto y envenenamiento JSON.
 * - Integridad criptográfica AES-256-GCM / PBKDF2-HMAC-SHA256 (bit-flip en cada zona, downgrade y DoS).
 * - Bloqueo de SSRF, redirecciones abiertas, píxeles espía, inyección en códigos de barras y fórmulas CSV.
 */
class SeguridadAndroidNativoTest {

    private val perfilValidoJson = """{"id":"yo","altaCompleta":true,"nombre":"Joel","alturaCm":178.0}"""
    private val jpegValido = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte(), 0x00, 0x10)
    private val pngValido = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00)
    private val webpValido = "RIFF\u0000\u0000\u0000\u0000WEBP".toByteArray(Charsets.US_ASCII)
    private val heicValido = "\u0000\u0000\u0000\u0018ftypheic".toByteArray(Charsets.US_ASCII)

    private fun copiaJsonBytes(datosJson: String, version: String = "7"): ByteArray =
        """{"app":"JowyFit","version":$version,"creada":"2026-11-26T10:00:00Z","datos":$datosJson}"""
            .toByteArray(Charsets.UTF_8)

    private fun crearZip(entradas: List<Pair<String, ByteArray>>, nivel: Int = Deflater.DEFAULT_COMPRESSION): ByteArray {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->
            zos.setLevel(nivel)
            for ((nombre, datos) in entradas) {
                zos.putNextEntry(ZipEntry(nombre))
                zos.write(datos)
                zos.closeEntry()
            }
        }
        return baos.toByteArray()
    }

    /** Construye un ZIP manual permitiendo nombres duplicados (ZipOutputStream los impide por defecto). */
    private fun crearZipConDuplicadas(entradas: List<Pair<String, ByteArray>>): ByteArray {
        val locales = ByteArrayOutputStream()
        val central = ByteArrayOutputStream()
        var offset = 0
        for ((nombre, datos) in entradas) {
            val nBytes = nombre.toByteArray(Charsets.UTF_8)
            val crc = CRC32().apply { update(datos) }.value.toInt()
            val loc = ByteBuffer.allocate(30).order(java.nio.ByteOrder.LITTLE_ENDIAN).apply {
                putInt(0x04034b50); putShort(20); putShort(0); putShort(0) // STORE
                putShort(0); putShort(0); putInt(crc); putInt(datos.size); putInt(datos.size)
                putShort(nBytes.size.toShort()); putShort(0)
            }.array()
            val cen = ByteBuffer.allocate(46).order(java.nio.ByteOrder.LITTLE_ENDIAN).apply {
                putInt(0x02014b50); putShort(20); putShort(20); putShort(0); putShort(0)
                putShort(0); putShort(0); putInt(crc); putInt(datos.size); putInt(datos.size)
                putShort(nBytes.size.toShort()); putShort(0); putShort(0); putShort(0); putShort(0)
                putInt(0); putInt(offset)
            }.array()
            locales.write(loc); locales.write(nBytes); locales.write(datos)
            central.write(cen); central.write(nBytes)
            offset += 30 + nBytes.size + datos.size
        }
        val cd = central.toByteArray()
        val eocd = ByteBuffer.allocate(22).order(java.nio.ByteOrder.LITTLE_ENDIAN).apply {
            putInt(0x06054b50); putShort(0); putShort(0)
            putShort(entradas.size.toShort()); putShort(entradas.size.toShort())
            putInt(cd.size); putInt(offset); putShort(0)
        }.array()
        return ByteArrayOutputStream().apply { write(locales.toByteArray()); write(cd); write(eocd) }.toByteArray()
    }

    private inline fun esperarRechazo(bloque: () -> Unit) {
        try {
            bloque()
            fail("Debía rechazarse como entrada maliciosa o inválida")
        } catch (_: Exception) {
            // Rechazado correctamente
        }
    }

    // -------------------------------------------------------------------------
    // 1. Auditoría estática de AndroidManifest y configuración de seguridad XML
    // -------------------------------------------------------------------------

    @Test
    fun manifiestoYConfigXmlBlindadosSinSuperficieInnecesaria() {
        val mainDir = File("src/main")
        val manifest = File(mainDir, "AndroidManifest.xml").readText()
        val netCfg = File(mainDir, "res/xml/network_security_config.xml").readText()
        val extractCfg = File(mainDir, "res/xml/data_extraction_rules.xml").readText()
        val backupCfg = File(mainDir, "res/xml/backup_rules.xml").readText()
        val filePaths = File(mainDir, "res/xml/file_paths.xml").readText()

        // Prohibido tráfico HTTP sin cifrar y copias/extracción en la nube o por cable
        assertTrue(manifest.contains("""android:allowBackup="false""""))
        assertTrue(manifest.contains("""android:usesCleartextTraffic="false""""))
        assertTrue(manifest.contains("""android:networkSecurityConfig="@xml/network_security_config""""))
        assertTrue(manifest.contains("""android:dataExtractionRules="@xml/data_extraction_rules""""))
        assertTrue(manifest.contains("""android:fullBackupContent="@xml/backup_rules""""))

        // Red: cleartext false y únicamente CAs del sistema (bloquea proxies MITM de usuario)
        assertTrue(netCfg.contains("""cleartextTrafficPermitted="false""""))
        assertTrue(netCfg.contains("""<certificates src="system" />"""))
        assertFalse(netCfg.contains("""src="user""""))

        // Extracción: todos los dominios excluidos
        for (dom in listOf("root", "file", "database", "sharedpref", "external")) {
            assertTrue("Falta excluir $dom en data_extraction_rules.xml", extractCfg.contains("""domain="$dom""""))
            assertTrue("Falta excluir $dom en backup_rules.xml", backupCfg.contains("""domain="$dom""""))
        }

        // FileProvider: nunca expone almacenamiento externo ni raíz ni filesDir privado
        assertFalse(filePaths.contains("external-path"))
        assertFalse(filePaths.contains("root-path"))
        assertFalse(filePaths.contains("files-path"))
        assertTrue(filePaths.contains("""path="compartir/""""))
        assertTrue(filePaths.contains("""path="informes/""""))

        // Componentes exportados: estrictamente MainActivity, WidgetHoyReceiver y la pantalla/alias de política Health Connect
        val exportedTrue = Regex("""android:exported="true"""").findAll(manifest).count()
        assertEquals(
            "Solo MainActivity, WidgetHoyReceiver y política Health Connect deben ir exportados",
            4,
            exportedTrue,
        )
        assertTrue(manifest.contains("""android:name=".nativo.ActividadPoliticaSalud""""))
        assertTrue(manifest.contains("""android:permission="android.permission.START_VIEW_PERMISSION_USAGE""""))
        assertTrue(manifest.contains("""android.intent.action.VIEW_PERMISSION_USAGE"""))
        assertTrue(manifest.contains("""androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"""))
        assertTrue(manifest.contains("""com.google.android.apps.healthdata"""))
        assertTrue(manifest.contains("""android:name=".nativo.ServicioDescanso""""))
        assertTrue(manifest.contains("""android:name=".nativo.ReceptorDescanso""""))
        assertTrue(manifest.contains("""android:authorities="${'$'}{applicationId}.fileprovider""""))

        // Sin permisos peligrosos o innecesarios
        val prohibidos = listOf(
            "READ_EXTERNAL_STORAGE",
            "WRITE_EXTERNAL_STORAGE",
            "MANAGE_EXTERNAL_STORAGE",
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "READ_CONTACTS",
            "READ_SMS",
            "RECORD_AUDIO",
            "QUERY_ALL_PACKAGES",
            "SYSTEM_ALERT_WINDOW",
        )
        for (perm in prohibidos) {
            assertFalse("Permiso prohibido encontrado en AndroidManifest: $perm", manifest.contains(perm))
        }
    }

    // -------------------------------------------------------------------------
    // 2. Copias .jowyfit: Zip Bomb, Zip Slip, duplicadas, malware y envenenamiento
    // -------------------------------------------------------------------------

    @Test
    fun zipBombDatosJsonMasDe50MbSeRechazaEnStreaming() {
        val espacios51Mb = ByteArray(51 * 1024 * 1024) { ' '.code.toByte() }
        val bomba = crearZip(listOf("datos.json" to espacios51Mb), nivel = Deflater.BEST_COMPRESSION)
        // Comprimida pesa menos de 1 MB pero intenta expandirse a 51 MB
        assertTrue(bomba.size < 1024 * 1024)
        esperarRechazo { GestorCopias.leerCopia(bomba) }
    }

    @Test
    fun zipConEntradasDuplicadasYDemasiadasEntradasSeRechazan() {
        val bueno = copiaJsonBytes("""{"perfil":[$perfilValidoJson]}""")
        val dupJson = crearZipConDuplicadas(listOf("datos.json" to bueno, "datos.json" to bueno))
        esperarRechazo { GestorCopias.leerCopia(dupJson) }

        val dupFoto = crearZipConDuplicadas(
            listOf(
                "datos.json" to bueno,
                "archivos/a.jpg" to jpegValido,
                "archivos/a.jpg" to jpegValido,
            ),
        )
        esperarRechazo { GestorCopias.leerCopia(dupFoto) }

        // Más de MAX_ENTRADAS (20.001) entradas vacías -> rechazado sin colgar la app
        val muchas = (1..(GestorCopias.MAX_ENTRADAS + 1)).map { "basura/$it.txt" to ByteArray(0) }
        val zipMuchas = crearZip(muchas, nivel = Deflater.NO_COMPRESSION)
        esperarRechazo { GestorCopias.leerCopia(zipMuchas) }
    }

    @Test
    fun zipSlipPathTraversalYMalwareDisfrazadoDeImagenSonBloqueados() {
        val rutasMalas = listOf(
            "../databases/jowyfit_nativo.db",
            "archivos/../../shared_prefs/jowyfit_prefs.xml",
            "archivos/sub/anidada.jpg",
            "archivos\\..\\evil.jpg",
            "archivos/evil.jpg\u0000.png",
            "archivos/shell.sh",
            "archivos/payload.svg",
            "archivos/pagina.html",
            "archivos/app.apk",
            "/etc/passwd",
        )
        for (r in rutasMalas) {
            assertFalse("Ruta peligrosa aceptada: $r", GestorCopias.esRutaMediaSegura(r))
        }
        assertTrue(GestorCopias.esRutaMediaSegura("archivos/foto-123.jpg"))
        assertTrue(GestorCopias.esRutaMediaSegura("archivos/plato_1.png"))
        assertTrue(GestorCopias.esRutaMediaSegura("archivos/captura.webp"))

        // Verificación de cabeceras binarias reales
        assertTrue(GestorCopias.esImagenBinariaValida(jpegValido))
        assertTrue(GestorCopias.esImagenBinariaValida(pngValido))
        assertTrue(GestorCopias.esImagenBinariaValida(webpValido))
        assertTrue(GestorCopias.esImagenBinariaValida(heicValido))

        val svgXss = "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>".toByteArray()
        val htmlXss = "<!doctype html><script>alert(1)</script>".toByteArray()
        val elfBin = byteArrayOf(0x7F, 'E'.code.toByte(), 'L'.code.toByte(), 'F'.code.toByte(), 2, 1)
        val dexBin = "dex\n035\u0000".toByteArray()
        for (malo in listOf(svgXss, htmlXss, elfBin, dexBin, ByteArray(0), byteArrayOf(1, 2))) {
            assertFalse(GestorCopias.esImagenBinariaValida(malo))
        }

        // Copia con entradas Zip Slip + SVG/ELF renombrados a .jpg + referencias traversal en JSON
        val jsonConTraversal = copiaJsonBytes(
            """
            {
              "perfil": [$perfilValidoJson],
              "fotos": [
                {"id": 1, "fecha": "2026-11-26", "pose": "frente", "imagen": {"__archivo": "../../databases/jowyfit_nativo.db", "tipo": "image/jpeg"}},
                {"id": 2, "fecha": "2026-11-26", "pose": "perfil", "imagen": {"__archivo": "archivos/buena.jpg", "tipo": "image/jpeg"}}
              ]
            }
            """.trimIndent(),
        )
        val zip = crearZip(
            listOf(
                "datos.json" to jsonConTraversal,
                "../../databases/jowyfit_nativo.db" to jpegValido,
                "archivos/../../escape.jpg" to jpegValido,
                "archivos/svg_falso.jpg" to svgXss,
                "archivos/elf_falso.png" to elfBin,
                "archivos/buena.jpg" to jpegValido,
            ),
        )
        val leida = GestorCopias.leerCopia(zip)
        assertEquals(setOf("archivos/buena.jpg"), leida.archivosMedia.keys)
        val foto1 = leida.registros.first { it.tabla == "fotos" && it.clave == "1" }.payloadJson
        assertFalse("Referencia traversal no saneada en JSON", foto1.contains("jowyfit_nativo.db"))
        val foto2 = leida.registros.first { it.tabla == "fotos" && it.clave == "2" }.payloadJson
        assertTrue(foto2.contains("archivos/buena.jpg"))
    }

    @Test
    fun copiaEnvenenadaSeRechazaYSaneaAjustesYProductos() {
        // Rechazo de copias malformadas, sin perfil, sin altaCompleta, múltiples perfiles o versiones malas
        val invalidos = listOf(
            ByteArray(0),
            "esto no es json".toByteArray(),
            """{"app":"OtraApp","version":1,"datos":{"perfil":[$perfilValidoJson]}}""".toByteArray(),
            copiaJsonBytes("""{"perfil":[]}"""),
            copiaJsonBytes("""{"perfil":[{"id":"yo","altaCompleta":false}]}"""),
            copiaJsonBytes("""{"perfil":[{"id":"otro","altaCompleta":true}]}"""),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson,$perfilValidoJson]}"""),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson]}""", version = "0"),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson]}""", version = "-3"),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson]}""", version = "\"7\""),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson]}""", version = "99"),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson],"sesiones":"no-es-lista"}"""),
            copiaJsonBytes("""{"perfil":[$perfilValidoJson],"sesiones":[123]}"""),
            // Fila gigante (> 512 KB) en un solo registro -> DoS bloqueado
            copiaJsonBytes("""{"perfil":[{"id":"yo","altaCompleta":true,"nombre":"${"A".repeat(600_000)}"}]}"""),
        )
        for (caso in invalidos) {
            esperarRechazo { GestorCopias.leerCopia(caso) }
        }

        // Saneado de entrenosASalud -> siempre false y píxeles espía en productos -> eliminados
        val datos = """
            {
              "perfil": [$perfilValidoJson],
              "ajustes": [{"id": "app", "entrenosASalud": true, "copiaAuto": true}],
              "productos": [
                {"codigo": "8410000000001", "nombre": "Bueno", "imagen": "https://images.openfoodfacts.org/images/products/1.jpg", "guardado": "2026-11-26"},
                {"codigo": "8410000000002", "nombre": "Espía", "imagen": "https://tracker.evil.example/pixel.gif?u=jowy", "guardado": "2026-11-26"},
                {"codigo": "8410000000003", "nombre": "HTTP", "imagen": "http://images.openfoodfacts.org/x.jpg", "guardado": "2026-11-26"}
              ]
            }
        """.trimIndent()
        val leida = GestorCopias.leerCopia(copiaJsonBytes(datos))
        val ajJson = leida.registros.first { it.tabla == "ajustes" }.payloadJson
        assertTrue(ajJson.contains("\"entrenosASalud\":false"))
        val p1 = leida.registros.first { it.clave == "8410000000001" }.payloadJson
        val p2 = leida.registros.first { it.clave == "8410000000002" }.payloadJson
        val p3 = leida.registros.first { it.clave == "8410000000003" }.payloadJson
        assertTrue(p1.contains("https://images.openfoodfacts.org/images/products/1.jpg"))
        assertFalse(p2.contains("tracker.evil.example"))
        assertFalse(p3.contains("http://"))
    }

    // -------------------------------------------------------------------------
    // 3. Criptografía adversaria: bit-flips, downgrade, DoS e IV único
    // -------------------------------------------------------------------------

    @Test
    fun cifradoBloqueaDowngradeDosYDetectaCualquierBitAlterado() {
        val plano = "datos secretos de JowyFit".toByteArray()
        esperarRechazo { CifradoCopia.cifrar(plano, "", vueltas = CifradoCopia.VUELTAS) }
        esperarRechazo { CifradoCopia.cifrar(plano, "x".repeat(2000), vueltas = CifradoCopia.VUELTAS) }
        esperarRechazo { CifradoCopia.cifrar(plano, "clave-segura", vueltas = 10_000) }
        esperarRechazo { CifradoCopia.cifrar(plano, "clave-segura", vueltas = 5_000_000) }

        val c1 = CifradoCopia.cifrar(plano, "ClaveFuerte!2026")
        val c2 = CifradoCopia.cifrar(plano, "ClaveFuerte!2026")
        // Sal e IV aleatorios: nunca produce dos textos cifrados iguales
        assertNotEquals(c1.toList(), c2.toList())

        // Modificar 1 bit en cada región (magia, vueltas, sal, IV, cuerpo, tag GCM) debe fallar SIEMPRE
        val posiciones = listOf(0, 10, 17, 20, 21, 30, 37, 45, 49, c1.size / 2, c1.size - 16, c1.size - 1)
        for (pos in posiciones) {
            val mutado = c1.copyOf()
            mutado[pos] = (mutado[pos].toInt() xor 0x01).toByte()
            esperarRechazo { CifradoCopia.descifrar(mutado, "ClaveFuerte!2026") }
        }

        // Truncado o con bytes extra al final debe fallar
        esperarRechazo { CifradoCopia.descifrar(c1.copyOf(c1.size - 1), "ClaveFuerte!2026") }
        esperarRechazo { CifradoCopia.descifrar(c1 + byteArrayOf(0), "ClaveFuerte!2026") }

        // Manipulación de cabecera para ataque DoS (50.000.000 vueltas) o downgrade (1000 vueltas)
        for (vueltasMalas in listOf(0, -1, 1000, 599_999, 2_000_001, 50_000_000)) {
            val cabMala = c1.copyOf()
            ByteBuffer.wrap(cabMala, 17, 4).putInt(vueltasMalas)
            esperarRechazo { CifradoCopia.descifrar(cabMala, "ClaveFuerte!2026") }
        }
    }

    // -------------------------------------------------------------------------
    // 4. Red, SSRF, Open Redirect, Supply Chain y Open Food Facts
    // -------------------------------------------------------------------------

    @Test
    fun actualizadorYOpenFoodFactsBloqueanSsrfRedireccionesYPixelesEspia() {
        // Actualizador: solo GitHub oficial HTTPS, sin userinfo ni puertos no estándar
        assertTrue(ActualizadorApp.esUrlDescargaPermitida("https://github.com/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk"))
        assertTrue(ActualizadorApp.esUrlDescargaPermitida("https://objects.githubusercontent.com/github-production-release-asset/123"))

        val urlsDescargaMalas = listOf(
            "http://github.com/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk",
            "https://github.com.evil.example/JowyFit.apk",
            "https://evil-githubusercontent.com/JowyFit.apk",
            "https://attacker@github.com/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk",
            "https://github.com:8443/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk",
            "https://127.0.0.1/JowyFit.apk",
            "https://169.254.169.254/latest/meta-data/",
            "file:///data/local/tmp/evil.apk",
            "javascript:alert(1)",
        )
        for (u in urlsDescargaMalas) {
            assertFalse("URL de descarga peligrosa aceptada: $u", ActualizadorApp.esUrlDescargaPermitida(u))
            assertFalse("urlApkSegura aceptó URL peligrosa: $u", ActualizacionDominio.urlApkSegura(u))
        }
        assertFalse(ActualizacionDominio.urlApkSegura("https://github.com/OtroUsuario/JowyFit/releases/download/v1.0.0/JowyFit.apk"))
        assertFalse(ActualizacionDominio.urlApkSegura("https://github.com/Jowy05/JowyFit/releases/download/v1.0.0/../../evil.apk"))

        // Open Food Facts: códigos con traversal/query/XSS rechazados y URLs estrictas
        val codigosMalos = listOf("", "123", "../admin", "8480000123458?evil=1", "8480000123458#x", "<script>", "848000012345899999")
        for (c in codigosMalos) {
            assertFalse("Código peligroso aceptado: $c", ComidaDominio.codigoValido(c))
            esperarRechazo { ClienteOpenFoodFacts.urlProducto(c) }
        }
        assertTrue(ClienteOpenFoodFacts.esUrlOffSegura("https://world.openfoodfacts.org/api/v2/product/8480000123458.json"))
        assertFalse(ClienteOpenFoodFacts.esUrlOffSegura("http://world.openfoodfacts.org/api/v2/product/8480000123458.json"))
        assertFalse(ClienteOpenFoodFacts.esUrlOffSegura("https://world.openfoodfacts.org.evil.com/x.json"))
        assertFalse(ClienteOpenFoodFacts.esUrlOffSegura("https://evil@world.openfoodfacts.org/x.json"))
        assertFalse(ClienteOpenFoodFacts.esUrlOffSegura("https://world.openfoodfacts.org:8443/x.json"))

        // Imágenes OFF: bloquea píxeles espía, CRLF, puertos y esquemas peligrosos
        val imgsMalas = listOf(
            "http://images.openfoodfacts.org/x.jpg",
            "https://tracker.invalid/pixel.gif",
            "https://openfoodfacts.org.evil.com/x.jpg",
            "https://u:p@images.openfoodfacts.org/x.jpg",
            "https://images.openfoodfacts.org:8080/x.jpg",
            "https://images.openfoodfacts.org/x.jpg\r\nX-Header: 1",
            "data:image/svg+xml,<svg onload=alert(1)>",
            "javascript:alert(1)",
        )
        for (img in imgsMalas) {
            assertNull("Imagen peligrosa aceptada: $img", ComidaDominio.imagenOFF(img))
        }
        assertNotNull(ComidaDominio.imagenOFF("https://images.openfoodfacts.org/images/products/848/front.jpg"))

        // Límites de credibilidad OFF ante valores imposibles/enormes
        val jsonAbsurdo = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name": "${"X".repeat(5000)}",
                "brands": "${"B".repeat(5000)}",
                "image_front_url": "https://evil.invalid/spy.png",
                "serving_quantity": 999999,
                "nutriments": {
                  "energy-kcal_100g": 99999,
                  "proteins_100g": 500,
                  "caffeine_100g": 99,
                  "salt_100g": -10
                }
              }
            }
            """.trimIndent(),
        ).jsonObject
        val prod = ComidaDominio.leerOFF("8480000123458", jsonAbsurdo)!!
        assertTrue(prod.nombre.length <= 150)
        assertTrue(prod.marca.length <= 80)
        assertNull(prod.imagen)
        assertNull(prod.kcal100)
        assertNull(prod.proteina100)
        assertNull(prod.cafeina100)
        assertNull(prod.sal100)
        assertNull(prod.racionG)
    }

    // -------------------------------------------------------------------------
    // 5. CSV Formula Injection (incluyendo espacios previos) y saneado PDF
    // -------------------------------------------------------------------------

    @Test
    fun csvNeutralizaInyeccionConEspaciosYSaltosYPdfSaneaControles() {
        val cargasPeligrosas = listOf(
            "=CMD|' /C calc'!A0",
            "  =HYPERLINK(\"http://evil\")",
            "+1+1",
            " +SUM(A1:A5)",
            "-2+3",
            "@SUM(1,2)",
            "\t=1+1",
            "\n=1+1",
        )
        for (carga in cargasPeligrosas) {
            val esc = ExportarLigero.escaparCsv(carga)
            val sinComillas = esc.removePrefix("\"")
            assertTrue("Fórmula CSV sin neutralizar para '$carga' -> '$esc'", sinComillas.startsWith("'"))
        }
        // Números negativos legítimos siguen siendo números limpios
        assertEquals("-12.5", ExportarLigero.escaparCsv(-12.5))
        assertEquals("-40", ExportarLigero.escaparCsv("-40"))

        val sucio = "Hola\u0000\u001B[31m\r\nMundo\u007F" + "A".repeat(200)
        val limpioPdf = GeneradorPdfNativo.sanearTextoPdf(sucio, 60)
        assertTrue(limpioPdf.length <= 60)
        assertFalse(limpioPdf.any { it.code < 0x20 || it.code == 0x7F })
    }
}
