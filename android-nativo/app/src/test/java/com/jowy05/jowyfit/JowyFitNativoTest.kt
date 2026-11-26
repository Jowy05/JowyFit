package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import com.jowy05.jowyfit.dominio.CalculosDominio
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate

class JowyFitNativoTest {

    @Test
    fun calculosCorporalesYEnergiaCoincidenConTs() {
        val imc = CalculosDominio.imc(80.0, 180.0)!!
        assertEquals(24.69, imc, 0.02)

        val basal = CalculosDominio.basalMifflin(80.0, 180.0, 30, "hombre")
        assertEquals(1780.0, basal, 0.01)

        val grasa = CalculosDominio.grasaMarina("hombre", 180.0, 86.0, 38.0, null)!!
        assertTrue(grasa in 14.0..20.0)

        val perfil = Perfil(nacimiento = "1996-01-01", sexo = "hombre", alturaCm = 180.0, objetivo = "recomposicion")
        val obj = CalculosDominio.calcularObjetivos(perfil, 80.0, hoy = LocalDate.of(2026, 6, 1))
        assertTrue(obj.kcal >= obj.basal)
        assertEquals(145, obj.proteina) // 80 * 1.8 = 144 -> redondeado a 5 = 145
    }

    @Test
    fun estadoSemanaYTarjetaHoy() {
        val rutina = Rutina(
            id = 1,
            creada = "2026-11-01T08:00:00Z",
            activa = true,
            dias = listOf(
                DiaRutina(letra = "A", nombre = "Cuerpo completo A", dia = 0, bloques = listOf(Bloque("u1", "barbell-bench-press"))),
                DiaRutina(letra = "B", nombre = "Cuerpo completo B", dia = 2, bloques = listOf(Bloque("u2", "barbell-squat"))),
                DiaRutina(letra = "S", nombre = "Sesión extra", dia = 5, opcional = true),
            ),
        )
        // 2026-11-23 es lunes (diaSemana = 0)
        val semana = CalculosDominio.estadoSemana(rutina, emptyList(), "2026-11-23")
        assertEquals(7, semana.size)
        assertEquals(CalculosDominio.EstadoDiaTipo.PLAN, semana[0].estado)
        assertTrue(semana[0].hoy)
        assertEquals(CalculosDominio.EstadoDiaTipo.OPCIONAL, semana[5].estado)

        val tar = CalculosDominio.tarjetaHoy(rutina, semana, "2026-11-23", null)
        assertTrue(tar is CalculosDominio.TarjetaHoyEstado.Hoy)
    }

    @Test
    fun cifradoYDescifradoCopiaCompatibleConWebCrypto() {
        val datos = "contenido-zip-prueba-jowyfit".toByteArray(Charsets.UTF_8)
        val cifrada = CifradoCopia.cifrar(datos, "cláve-segura-123", vueltas = 600_000)
        assertTrue(CifradoCopia.esCifrada(cifrada))

        // Normalización NFC equivalente (á compuesta vs descompuesta)
        val descompuesta = "cla\u0301ve-segura-123"
        val abierta = CifradoCopia.descifrar(cifrada, descompuesta)
        assertEquals(datos.toList(), abierta.toList())

        // Contraseña incorrecta falla con ContrasenaMala
        var falloClave = false
        try {
            CifradoCopia.descifrar(cifrada, "otra-clave-distinta")
        } catch (_: CifradoCopia.ContrasenaMala) {
            falloClave = true
        }
        assertTrue(falloClave)

        // Alterar un byte de la cabecera (AAD) invalida la copia
        val tocada = cifrada.copyOf()
        tocada[tocada.size - 1] = (tocada.last().toInt() xor 1).toByte()
        var falloIntegridad = false
        try {
            CifradoCopia.descifrar(tocada, "cláve-segura-123")
        } catch (_: CifradoCopia.ContrasenaMala) {
            falloIntegridad = true
        }
        assertTrue(falloIntegridad)
    }

    @Test
    fun idaYVueltaCopiaZipYCopiaRealDelRepo() {
        val perfil = Perfil(altaCompleta = true, nombre = "Joel", alturaCm = 178.0)
        val reg = RegistroTablaEntity("perfil", "yo", "2026-11-26", JsonJowyFit.encodeToString(perfil))
        val zip = GestorCopias.crearCopia(listOf(reg), mapOf("archivos/foto-0.jpg" to byteArrayOf(1, 2, 3, 4)))

        val leida = GestorCopias.leerCopia(zip)
        assertEquals(GestorCopias.VERSION_MAX_SOPORTADA, leida.version)
        assertEquals(1, leida.registros.size)
        assertEquals(4, leida.archivosMedia["archivos/foto-0.jpg"]?.size)

        // Prueba con la copia real del repositorio si está disponible en .cache/
        val copiaReal = File("../../.cache/JowyFit-mis-datos.jowyfit")
        if (copiaReal.exists()) {
            val real = GestorCopias.leerCopia(copiaReal.readBytes())
            assertTrue(real.registros.any { it.tabla == "perfil" })
            assertTrue(real.registros.size > 5)
        }
    }

    @Test
    fun actualizacionSemverYUrlSegura() {
        assertEquals(1, ActualizacionDominio.compararVersion("v0.13.0", "0.12.1"))
        assertEquals(0, ActualizacionDominio.compararVersion("0.12.1", "v0.12.1"))
        assertEquals(-1, ActualizacionDominio.compararVersion("0.11.0", "0.12.1"))

        assertTrue(ActualizacionDominio.urlApkSegura("https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk"))
        assertFalse(ActualizacionDominio.urlApkSegura("https://evil.example/JowyFit.apk"))
        assertFalse(ActualizacionDominio.urlApkSegura("http://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk"))

        val sha = "a".repeat(64)
        val raw = JsonJowyFit.parseToJsonElement(
            """
            {
              "tag_name": "v0.14.0",
              "body": "Mejoras\n\nSHA-256 del APK: $sha",
              "html_url": "https://github.com/Jowy05/JowyFit/releases/tag/v0.14.0",
              "published_at": "2026-11-26T10:00:00Z",
              "assets": [{
                "name": "JowyFit.apk",
                "size": 31457280,
                "browser_download_url": "https://github.com/Jowy05/JowyFit/releases/download/v0.14.0/JowyFit.apk"
              }]
            }
            """.trimIndent(),
        ).jsonObject
        val info = ActualizacionDominio.parsearRelease(raw, "0.12.1")
        assertNotNull(info)
        assertTrue(info!!.hayNueva)
        assertEquals(sha, info.sha256)
        assertEquals("Mejoras", info.notas)
        assertEquals("30,0 MB", ActualizacionDominio.tamanoMB(info.bytes!!))
        assertNull(ActualizacionDominio.extraerSha256("sin hash"))
    }

    @Test
    fun csvNeutralizaFormulas() {
        assertEquals("'=SUM(A1:A2)", GestorCopias.celdaCsvSegura("=SUM(A1:A2)"))
        assertEquals("\"' +10,5\"".replace(" ", ""), GestorCopias.celdaCsvSegura("+10,5"))
    }
}
