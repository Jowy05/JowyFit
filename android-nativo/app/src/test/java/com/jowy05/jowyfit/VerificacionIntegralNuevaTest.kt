package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.IdiomaApp
import com.jowy05.jowyfit.datos.catalogo.CargadorCatalogo
import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.catalogo.TextosCatalogoJson
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.SaludYRevisionDominio
import com.jowy05.jowyfit.nativo.ActualizadorApp
import com.jowy05.jowyfit.nativo.ClienteOpenFoodFacts
import com.jowy05.jowyfit.nativo.GeneradorPdfNativo
import com.jowy05.jowyfit.ui.i18n.traducir
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Verificación de zonas antes no cubiertas: deserialización real de catálogos CA/EN,
 * integridad 100 % de assets WebP + modelo BlazePose, ajuste de líneas PDF,
 * allowlists de red de ActualizadorApp y ClienteOpenFoodFacts, y regresiones de auditoría profunda.
 */
class VerificacionIntegralNuevaTest {

    @Test
    fun catalogosCatalanEInglesDeserializanCompletosYTraducenEjercicios() {
        val baseFile = File("../../public/repdb/catalogo.json")
        val caFile = File("../../public/repdb/catalogo.ca.json")
        val enFile = File("../../public/repdb/catalogo.en.json")
        assertTrue(baseFile.exists())
        assertTrue(caFile.exists())
        assertTrue(enFile.exists())

        val base = JsonJowyFit.decodeFromString<CatalogoJson>(baseFile.readText())
        val txtCa = JsonJowyFit.decodeFromString<TextosCatalogoJson>(caFile.readText())
        val txtEn = JsonJowyFit.decodeFromString<TextosCatalogoJson>(enFile.readText())

        val catEs = CargadorCatalogo.combinarTextos(base, null, "es")
        val catCa = CargadorCatalogo.combinarTextos(base, txtCa, "ca")
        val catEn = CargadorCatalogo.combinarTextos(base, txtEn, "en")

        assertEquals(catEs.ejercicios.size, catCa.ejercicios.size)
        assertEquals(catEs.ejercicios.size, catEn.ejercicios.size)
        assertTrue("El catálogo catalán debe cubrir >95 % de ejercicios", txtCa.ejercicios.size > base.ejercicios.size * 0.95)
        assertTrue("El catálogo inglés debe cubrir >95 % de ejercicios", txtEn.ejercicios.size > base.ejercicios.size * 0.95)

        val benchEs = catEs.porId.getValue("bench-press").nombre
        val benchCa = catCa.porId.getValue("bench-press").nombre
        val benchEn = catEn.porId.getValue("bench-press").nombre
        assertTrue(benchEs.isNotBlank() && benchCa.isNotBlank() && benchEn.isNotBlank())
        assertNotEquals("El inglés debe diferir del castellano en bench-press", benchEs, benchEn)
        assertTrue("Las traducciones de músculos en CA deben estar pobladas", catCa.musculos.isNotEmpty())
        assertTrue("Las traducciones de material en EN deben estar pobladas", catEn.material.isNotEmpty())
        assertEquals("Peso corporal", catEs.nombreMaterial(null))
        assertEquals("Pes corporal", catCa.nombreMaterial(null))
        assertEquals("Bodyweight", catEn.nombreMaterial(null))
        assertEquals("Cames", catCa.nombreZona("upper_legs"))
        assertEquals("Upper legs", catEn.nombreZona("upper_legs"))

        // También verificar normalización española ("con Cable" -> "en Polea", "Barra EZ" -> "Barra Z")
        val ezCurl = catEs.porId["ez-bar-curl"]
        if (ezCurl != null) {
            assertFalse("En ES 'Barra EZ' debe normalizarse a 'Barra Z'", ezCurl.nombre.contains("Barra EZ"))
        }
    }

    @Test
    fun integridadTotalDeAssetsRepdbYModeloBlazePose() {
        val base = JsonJowyFit.decodeFromString<CatalogoJson>(File("../../public/repdb/catalogo.json").readText())
        val raizRepdb = File("../../public/repdb")
        var fotosVerificadas = 0
        var minisVerificadas = 0
        var musculosVerificados = 0
        var materialVerificado = 0

        for (e in base.ejercicios) {
            val poses = e.poses.ifEmpty { listOf("main") }
            for (pose in poses) {
                val img = File(raizRepdb, "img/${e.id}-$pose.webp")
                assertTrue("Falta imagen ${img.path}", img.exists() && img.length() > 100)
                fotosVerificadas++
            }
            val poseMini = if ("peak" in e.poses) "peak" else e.poses.firstOrNull() ?: "main"
            val mini = File(raizRepdb, "mini/${e.id}-$poseMini.webp")
            assertTrue("Falta miniatura ${mini.path}", mini.exists() && mini.length() > 50)
            minisVerificadas++
        }
        for ((_, m) in base.musculos) {
            val rel = m.imagen?.takeIf { it.isNotBlank() } ?: continue
            val f = File(raizRepdb, "mus/$rel")
            assertTrue("Falta ilustración de músculo ${f.path}", f.exists() && f.length() > 50)
            musculosVerificados++
        }
        for ((_, mat) in base.material) {
            val rel = mat.imagen?.takeIf { it.isNotBlank() } ?: continue
            val f = File(raizRepdb, "maq/$rel")
            assertTrue("Falta ilustración de material ${f.path}", f.exists() && f.length() > 50)
            materialVerificado++
        }
        assertTrue("Deben verificarse >1000 poses", fotosVerificadas > 1000)
        assertEquals(base.ejercicios.size, minisVerificadas)
        assertTrue(musculosVerificados > 10)
        assertTrue(materialVerificado > 10)

        // Modelo binario local BlazePose
        val modelo = File("../../public/postura/pose_landmarker_lite.task")
        assertTrue("Debe existir pose_landmarker_lite.task", modelo.exists())
        assertTrue("El modelo BlazePose debe pesar >3 MB", modelo.length() > 3_000_000L)
    }

    @Test
    fun pdfEnvolverLineasYSaneoManejanTextosLargosYCaracteresDeControl() {
        val largo = "• Día A (Cuerpo completo): Sentadilla con barra, Press de banca plano, Remo sentado en polea, Peso muerto rumano, Curl con mancuernas, Extensión de tríceps en polea, Plancha frontal"
        val lineas = GeneradorPdfNativo.envolverLineas(largo, maxChars = 60)
        assertTrue("Un texto de ${largo.length} chars debe partirse en >=3 líneas", lineas.size >= 3)
        assertTrue("Ninguna línea puede exceder el máximo", lineas.all { it.length <= 60 })
        assertTrue("No se pierde el último ejercicio", lineas.joinToString(" ").contains("Plancha frontal"))

        val sucio = "Hola\u0000\r\n\tMundo\u007F!"
        val saneado = GeneradorPdfNativo.sanearTextoPdf(sucio)
        assertFalse(saneado.any { it.code < 0x20 || it.code == 0x7F })

        val palabraGigante = "A".repeat(400)
        val env = GeneradorPdfNativo.envolverLineas(palabraGigante, maxChars = 40, maxLineas = 4)
        assertEquals(4, env.size)
        assertTrue(env.last().endsWith("…"))
    }

    @Test
    fun allowlistsDeRedDeActualizadorYOpenFoodFactsBloqueanBypass() {
        // ActualizadorApp
        assertTrue(ActualizadorApp.esUrlDescargaPermitida("https://github.com/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk"))
        assertTrue(ActualizadorApp.esUrlDescargaPermitida("https://objects.githubusercontent.com/github-production-release-asset/foo.apk"))
        val malasAct = listOf(
            "http://github.com/Jowy05/JowyFit/releases/latest",
            "https://github.com.evil.com/JowyFit.apk",
            "https://evilgithubusercontent.com/JowyFit.apk",
            "https://user:pass@github.com/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk",
            "https://github.com:8443/Jowy05/JowyFit/releases/download/v1.0.0/JowyFit.apk",
            "file:///data/local/tmp/evil.apk",
            "javascript:alert(1)",
        )
        for (u in malasAct) assertFalse("Actualizador aceptó URL insegura: $u", ActualizadorApp.esUrlDescargaPermitida(u))

        // ClienteOpenFoodFacts
        assertTrue(ClienteOpenFoodFacts.esUrlOffSegura("https://world.openfoodfacts.org/api/v2/product/8480000201234.json"))
        assertTrue(ClienteOpenFoodFacts.esUrlOffSegura("https://es.openfoodfacts.org/api/v2/product/8480000201234.json"))
        val malasOff = listOf(
            "http://world.openfoodfacts.org/api/v2/product/12345678.json",
            "https://world.openfoodfacts.org.evil.com/x.json",
            "https://evilopenfoodfacts.org/x.json",
            "https://user@world.openfoodfacts.org/x.json",
            "https://world.openfoodfacts.org:8080/x.json",
        )
        for (u in malasOff) assertFalse("OFF aceptó URL insegura: $u", ClienteOpenFoodFacts.esUrlOffSegura(u))
        assertTrue(ClienteOpenFoodFacts.urlProducto("8480000201234").startsWith("https://world.openfoodfacts.org/api/v2/product/8480000201234.json"))
        assertTrue(runCatching { ClienteOpenFoodFacts.urlProducto("../etc/passwd") }.isFailure)
    }

    @Test
    fun regresionesAsistidoBarraCalentamientoUrgenciasYI18n() {
        // Asistido: lista toda <= 0.0 y pasos negativos funcionan en ambas direcciones
        val asist = PesosYDiscos.pesosPara("assisted_pullup_machine", "asistido", null)
        assertTrue(asist.isNotEmpty() && asist.all { it <= 0.0 })
        assertEquals(-15.0, PesosYDiscos.siguiente(asist, -20.0, 1), 1e-6)
        assertEquals(-25.0, PesosYDiscos.siguiente(asist, -20.0, -1), 1e-6)

        // Calentamiento con barra respeta el mínimo de la barra del gimnasio
        val gym = Gimnasio(barraKg = 20.0, discos = listOf(1.25, 2.5, 5.0, 10.0, 15.0, 20.0))
        val pesosB = PesosYDiscos.pesosPara("barbell", "peso", gym)
        val cal = PesosYDiscos.calentamiento(50.0, pesosB, minimo = 20.0)
        assertTrue(cal.isNotEmpty() && cal.all { it.peso >= 20.0 && it.peso < 50.0 })

        // Urgencias PAR-Q+ bloquean la rutina
        assertTrue(SaludYRevisionDominio.rutinaBloqueada(Perfil(urgencias = listOf("pecho"))))
        assertFalse(SaludYRevisionDominio.rutinaBloqueada(Perfil(urgencias = emptyList())))

        // Cobertura básica de placeholders {n} en ES/CA/EN
        for (lang in IdiomaApp.entries) {
            assertTrue(traducir(lang, "Faltan {n} g", "n" to 42).contains("42"))
            assertTrue(traducir(lang, "de {n}", "n" to 8000).contains("8000"))
            assertFalse(traducir(lang, "Faltan {n} g", "n" to 42).contains("{n}"))
        }
    }

    @Test
    fun coberturaTotalI18nYAtajosPorVarianteDeCompilacion() {
        // 1. Todas las llamadas t("...") en el código fuente Kotlin deben existir en CA y EN
        val raizJava = File("src/main/java")
        assertTrue(raizJava.exists())
        val regexT = Regex("""\bt\(\s*"([^"]+)"""")
        val clavesUsadas = sortedSetOf<String>()
        raizJava.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name != "Textos.kt" }
            .forEach { f ->
                val txt = f.readText()
                regexT.findAll(txt).forEach { m -> clavesUsadas += m.groupValues[1] }
            }
        assertTrue("Deben detectarse >30 claves t(...) usadas", clavesUsadas.size > 30)
        // Verificamos que ninguna clave usada quede sin traducción distinta en EN (salvo idénticas reales como 'Normal', 'Sistema' no es igual en EN)
        val identicasEn = setOf("Normal")
        for (clave in clavesUsadas) {
            val en = traducir(IdiomaApp.EN, clave)
            val ca = traducir(IdiomaApp.CA, clave)
            assertTrue("Traducción CA vacía para '$clave'", ca.isNotBlank())
            assertTrue("Traducción EN vacía para '$clave'", en.isNotBlank())
            if (clave !in identicasEn) {
                assertNotEquals("Falta traducción EN en Textos.kt para '$clave'", clave, en)
            }
        }

        // 2. Atajos del lanzador (shortcuts.xml) deben apuntar al paquete exacto de cada variante
        val variantes = listOf(
            "src/main/res/xml/shortcuts.xml" to "com.jowy05.jowyfit",
            "src/preview/res/xml/shortcuts.xml" to "com.jowy05.jowyfit.nativo",
            "src/debug/res/xml/shortcuts.xml" to "com.jowy05.jowyfit.debug",
        )
        for ((ruta, pkg) in variantes) {
            val f = File(ruta)
            assertTrue("Falta $ruta", f.exists())
            val xml = f.readText()
            assertTrue("$ruta debe apuntar a targetPackage=\"$pkg\"", xml.contains("android:targetPackage=\"$pkg\""))
            assertTrue("$ruta debe lanzar MainActivity", xml.contains("android:targetClass=\"com.jowy05.jowyfit.MainActivity\""))
            assertTrue("$ruta debe incluir ACCION_PESO y ACCION_RUTINA", xml.contains("ACCION_PESO") && xml.contains("ACCION_RUTINA"))
        }
    }

    @Test
    fun actualizacionAutomaticaSoportaCanalOficialYCanalKotlinConAllowlistYSha() {
        val sha = "a".repeat(64)
        // 1. Canal paralelo Kotlin: detecta nueva revisión (Build Kotlin: 2 > 1) con mismo semver
        val jsonKotlin = JsonJowyFit.parseToJsonElement(
            """
            {
              "tag_name": "kotlin-preview",
              "html_url": "https://github.com/Jowy05/JowyFit/releases/tag/kotlin-preview",
              "published_at": "2026-11-26T19:00:00Z",
              "body": "Mejoras de actualización automática.\n\nVersión Kotlin: 0.12.1\nBuild Kotlin: 2\nSHA-256 del APK: $sha",
              "assets": [
                {
                  "name": "JowyFit-Kotlin.apk",
                  "size": 65000000,
                  "browser_download_url": "https://github.com/Jowy05/JowyFit/releases/download/kotlin-preview/JowyFit-Kotlin.apk"
                }
              ]
            }
            """.trimIndent(),
        ).jsonObject

        val infoNueva = ActualizacionDominio.parsearRelease(
            jsonKotlin,
            actual = "0.12.1",
            canal = ActualizacionDominio.CANAL_KOTLIN,
            buildActual = 1,
        )
        assertNotNull(infoNueva)
        assertTrue(infoNueva!!.hayNueva)
        assertEquals("0.12.1-r2", infoNueva.claveVersion)
        assertEquals("0.12.1 (r2)", infoNueva.etiquetaVersion)
        assertEquals(sha, infoNueva.sha256)
        assertEquals("Mejoras de actualización automática.", infoNueva.notas)
        assertNotNull(infoNueva.urlApk)

        // Misma revisión (build 2 == 2) -> NO hay nueva
        val infoIgual = ActualizacionDominio.parsearRelease(
            jsonKotlin,
            actual = "0.12.1",
            canal = ActualizacionDominio.CANAL_KOTLIN,
            buildActual = 2,
        )
        assertNotNull(infoIgual)
        assertFalse(infoIgual!!.hayNueva)

        // Separación de canales: un APK del canal Kotlin NO es aceptado por el canal oficial y viceversa
        assertFalse(
            ActualizacionDominio.urlApkSegura(
                "https://github.com/Jowy05/JowyFit/releases/download/kotlin-preview/JowyFit-Kotlin.apk",
                ActualizacionDominio.CANAL_OFICIAL,
            ),
        )
        assertFalse(
            ActualizacionDominio.urlApkSegura(
                "https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk",
                ActualizacionDominio.CANAL_KOTLIN,
            ),
        )
        assertNull(
            ActualizacionDominio.parsearRelease(
                jsonKotlin,
                actual = "0.12.1",
                canal = ActualizacionDominio.CANAL_OFICIAL,
            ),
        )

        // 2. Canal oficial: v0.13.0 > 0.12.1
        val jsonOficial = JsonJowyFit.parseToJsonElement(
            """
            {
              "tag_name": "v0.13.0",
              "html_url": "https://github.com/Jowy05/JowyFit/releases/tag/v0.13.0",
              "published_at": "2026-11-27T10:00:00Z",
              "body": "App nativa en Kotlin.\n\nSHA-256 del APK: $sha",
              "assets": [
                {
                  "name": "JowyFit.apk",
                  "size": 65000000,
                  "browser_download_url": "https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk"
                }
              ]
            }
            """.trimIndent(),
        ).jsonObject
        val infoOf = ActualizacionDominio.parsearRelease(jsonOficial, actual = "0.12.1", canal = ActualizacionDominio.CANAL_OFICIAL)
        assertNotNull(infoOf)
        assertTrue(infoOf!!.hayNueva)
        assertEquals("0.13.0", infoOf.claveVersion)

        // 3. Control de frecuencia de comprobación automática (6 h)
        val t0 = 1_700_000_000_000L
        assertTrue(ActualizacionDominio.debeComprobarAuto(t0, 0L, true))
        assertFalse(ActualizacionDominio.debeComprobarAuto(t0, 0L, false))
        assertFalse(ActualizacionDominio.debeComprobarAuto(t0 + 3_600_000L, t0, true))
        assertTrue(ActualizacionDominio.debeComprobarAuto(t0 + ActualizacionDominio.INTERVALO_AUTO_MS, t0, true))
    }
}
