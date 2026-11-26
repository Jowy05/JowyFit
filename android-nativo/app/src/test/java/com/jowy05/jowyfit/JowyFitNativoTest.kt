package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.ModoMayor
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Tramo
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.GeneradorRutina
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
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
        val jpegMinimo = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte(), 0x00, 0x10)
        val zip = GestorCopias.crearCopia(listOf(reg), mapOf("archivos/foto-0.jpg" to jpegMinimo))

        val leida = GestorCopias.leerCopia(zip)
        assertEquals(GestorCopias.VERSION_MAX_SOPORTADA, leida.version)
        assertEquals(1, leida.registros.size)
        assertEquals(jpegMinimo.size, leida.archivosMedia["archivos/foto-0.jpg"]?.size)

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

    @Test
    fun pesosYDiscosCalculoExactoYCalentamiento() {
        assertEquals(listOf(20.0), PesosYDiscos.discosPorLado(60.0, 20.0, listOf(20.0, 15.0, 10.0, 5.0)))
        // Caso donde voraz fallaría (15 + sin resto exacto) pero DP encuentra 10 + 10 por lado
        assertEquals(listOf(10.0, 10.0), PesosYDiscos.discosPorLado(60.0, 20.0, listOf(15.0, 10.0)))
        assertEquals(emptyList<Double>(), PesosYDiscos.discosPorLado(20.0, 20.0, listOf(10.0)))
        assertNull(PesosYDiscos.discosPorLado(15.0, 20.0, listOf(10.0)))
        assertNull(PesosYDiscos.discosPorLado(23.0, 20.0, listOf(10.0, 5.0)))

        val gym = Gimnasio(
            nombre = "Casa",
            barraKg = 20.0,
            mancuernas = listOf(Tramo(2.0, 10.0, 2.0), Tramo(12.5, 40.0, 2.5)),
        )
        val pesosBarra = PesosYDiscos.pesosPara("barbell", "peso", gym)
        assertTrue(pesosBarra.contains(20.0))
        assertTrue(pesosBarra.contains(60.0))
        val cal = PesosYDiscos.calentamiento(100.0, pesosBarra)
        assertEquals(3, cal.size)
        assertTrue(cal.all { it.peso < 100.0 && it.peso >= 20.0 })
        assertTrue(cal[0].peso < cal[1].peso && cal[1].peso < cal[2].peso)

        val mancuernas = PesosYDiscos.mancuernasDisponibles(gym)
        assertTrue(mancuernas.contains(10.0))
        assertEquals(12.5, PesosYDiscos.siguiente(mancuernas, 10.0, 1), 0.01)
    }

    @Test
    fun progresionDobleYRecords() {
        val lista = (0..60).map { it * 2.5 }
        val obj = Progresion.ObjetivoBloque(repsMin = 8, repsMax = 12, rpe = 8.0)

        val sube = Progresion.sugerir(
            ultimas = listOf(
                Serie(1, peso = 60.0, reps = 12, rpe = 8.0, hecha = true),
                Serie(2, peso = 60.0, reps = 12, rpe = 8.5, hecha = true),
            ),
            objetivo = obj,
            registro = "peso",
            lista = lista,
        )
        assertEquals(Progresion.AccionSugerencia.SUBIR, sube.accion)
        assertEquals(62.5, sube.peso!!, 0.01)
        assertEquals(8, sube.reps)

        val mantiene = Progresion.sugerir(
            ultimas = listOf(
                Serie(1, peso = 60.0, reps = 10, rpe = 8.0, hecha = true),
                Serie(2, peso = 60.0, reps = 9, rpe = 8.5, hecha = true),
            ),
            objetivo = obj,
            registro = "peso",
            lista = lista,
        )
        assertEquals(Progresion.AccionSugerencia.MANTENER, mantiene.accion)
        assertEquals(60.0, mantiene.peso!!, 0.01)
        assertEquals(11, mantiene.reps)

        val baja = Progresion.sugerir(
            ultimas = listOf(
                Serie(1, peso = 60.0, reps = 5, rpe = 9.5, hecha = true),
                Serie(2, peso = 60.0, reps = 5, rpe = 10.0, hecha = true),
            ),
            objetivo = obj,
            registro = "peso",
            lista = lista,
        )
        assertEquals(Progresion.AccionSugerencia.BAJAR, baja.accion)
        assertEquals(57.5, baja.peso!!, 0.01)

        val historial = listOf(Serie(1, peso = 60.0, reps = 10, hecha = true))
        val recPeso = Progresion.esRecord(Serie(1, peso = 62.5, reps = 8, hecha = true), historial)
        assertEquals("peso", recPeso?.tipo)
        val recReps = Progresion.esRecord(Serie(1, peso = 60.0, reps = 11, hecha = true), historial)
        assertEquals("reps", recReps?.tipo)
        assertNull(Progresion.esRecord(Serie(1, peso = 80.0, reps = 10, calentamiento = true, hecha = true), historial))
    }

    @Test
    fun motorSesionPrSuperserieYResumen() {
        val dia = DiaRutina(
            letra = "A",
            nombre = "Torso A",
            dia = 0,
            bloques = listOf(
                Bloque(uid = "b1", ejercicio = "bicep-curl", series = 2, repsMin = 10, repsMax = 15, descanso = 75, superserie = "b2", registro = "mancuerna"),
                Bloque(uid = "b2", ejercicio = "tricep-pushdown", series = 2, repsMin = 10, repsMax = 15, descanso = 75, superserie = "b1", registro = "peso"),
            ),
        )
        val sesion0 = MotorSesion.crearSesion(
            id = 1L,
            dia = dia,
            rutinaId = 1L,
            gimnasioId = null,
            sugerencias = mapOf("bicep-curl" to (12.0 to 10), "tricep-pushdown" to (25.0 to 12)),
            ahora = 1_000_000L,
        )
        assertEquals(0, MotorSesion.indiceActual(sesion0))

        // Primera serie del par A1 -> 0 s de descanso y salta al compañero A2 + detecta PR
        val r1 = MotorSesion.apuntarSerie(
            sesion = sesion0,
            idx = 0,
            datos = MotorSesion.DatosSerie(peso = 14.0, reps = 12, rpe = 8.0),
            previas = listOf(Serie(1, peso = 12.0, reps = 12, hecha = true)),
            ahora = 1_060_000L,
        )!!
        assertEquals(0, r1.descansoSeg)
        assertEquals("peso", r1.record?.tipo)
        assertEquals(1, MotorSesion.indiceActual(r1.sesion))
        // Hereda 14 kg a la segunda serie pendiente de b1
        assertEquals(14.0, r1.sesion.ejercicios[0].series[1].peso!!, 0.01)

        // Primera serie del compañero A2 -> descanso completo (75 s) y vuelve a A1
        val r2 = MotorSesion.apuntarSerie(
            sesion = r1.sesion,
            idx = 1,
            datos = MotorSesion.DatosSerie(peso = 25.0, reps = 12, rpe = 8.0),
            previas = emptyList(),
            ahora = 1_120_000L,
        )!!
        assertEquals(75, r2.descansoSeg)
        assertEquals(0, MotorSesion.indiceActual(r2.sesion))

        val conCal = MotorSesion.conCalentamiento(r2.sesion, 0, listOf(PesosYDiscos.SerieCalentamiento(6.0, 10)))
        assertEquals(3, conCal.ejercicios[0].series.size)
        val conExtra = MotorSesion.anadirSerie(conCal, 0)
        assertEquals(4, conExtra.ejercicios[0].series.size)
        val quitada = MotorSesion.quitarSerie(conExtra, 0)
        assertEquals(3, quitada.ejercicios[0].series.size)

        val res = MotorSesion.resumen(r2.sesion, ahora = 1_600_000L)
        assertEquals(2, res.series)
        assertEquals((14.0 * 12 + 25.0 * 12).toInt(), res.volumenKg)
        assertEquals(600, res.segundos)
    }

    @Test
    fun generadorRutinaConCatalogoReal() {
        val ficheroCatalogo = File("../../public/repdb/catalogo.json")
        assertTrue("Falta public/repdb/catalogo.json para probar el generador", ficheroCatalogo.exists())
        val catalogo = JsonJowyFit.decodeFromString<CatalogoJson>(ficheroCatalogo.readText())
        assertTrue(catalogo.ejercicios.size >= 600)

        // 1) Rutina 3 días + poco sueño (tope RPE 7.5) + marca «duele» excluida
        val perfil3 = Perfil(
            altaCompleta = true,
            objetivo = "musculo",
            nivel = "intermedio",
            diasFijos = listOf(0, 2, 4),
            minutosNormal = 55,
            minutosCorta = 35,
            sueno = "poco",
            superseries = true,
        )
        val marcas = mapOf("bench-press" to MarcaEjercicio(id = "bench-press", duele = true))
        val r3 = GeneradorRutina.generar(id = 1L, perfil = perfil3, gimnasio = null, ejercicios = catalogo.ejercicios, marcas = marcas)
        // 3 días fijos + 1 sesión opcional de sábado por defecto
        assertEquals(3, r3.dias.count { !it.opcional })
        assertEquals(1, r3.dias.count { it.opcional })
        assertTrue(r3.estructura.contains("3 días"))
        assertTrue(r3.dias.all { it.bloques.isNotEmpty() })
        assertTrue(r3.dias.flatMap { it.bloques }.all { it.rpe <= 7.5 })
        assertTrue(r3.dias.flatMap { it.bloques }.none { it.ejercicio == "bench-press" })

        // Versiones corta y mínima tienen menos o igual trabajo que normal
        val diaA = r3.dias.first()
        val sNormal = MotorSesion.crearSesion(1L, diaA, r3.id, null, "normal")
        val sCorta = MotorSesion.crearSesion(2L, diaA, r3.id, null, "corta")
        val sMin = MotorSesion.crearSesion(3L, diaA, r3.id, null, "minima")
        assertTrue(sCorta.ejercicios.size <= sNormal.ejercicios.size)
        assertTrue(sMin.ejercicios.size <= 3 && sMin.ejercicios.all { it.series.size <= 2 })

        // 2) Rutina 4 días en modo mayor: sin superseries, descansos >= 120s, equilibrio = 6
        val perfilMayor = Perfil(
            altaCompleta = true,
            objetivo = "salud",
            nivel = "empiezo",
            diasFijos = listOf(0, 1, 3, 4),
            diasOpcionales = emptyList(),
            superseries = true,
            modoMayor = ModoMayor(activo = true),
        )
        val r4 = GeneradorRutina.generar(id = 2L, perfil = perfilMayor, gimnasio = null, ejercicios = catalogo.ejercicios)
        assertEquals(4, r4.dias.size)
        assertEquals(6, r4.equilibrio)
        val todosBloques = r4.dias.flatMap { it.bloques }
        assertTrue(todosBloques.none { it.superserie != null })
        assertTrue(todosBloques.all { it.descanso >= 120 })
    }

    @Test
    fun catalogoTodasLasImagenesPosesMusculosYMaterialExisten() {
        val dirRepdb = File("../../public/repdb")
        val ficheroCatalogo = File(dirRepdb, "catalogo.json")
        assertTrue("Falta public/repdb/catalogo.json", ficheroCatalogo.exists())
        val base = JsonJowyFit.decodeFromString<CatalogoJson>(ficheroCatalogo.readText())
        val cat = CatalogoCargado(
            idioma = "es",
            ejercicios = base.ejercicios,
            porId = base.ejercicios.associateBy { it.id },
            musculos = base.musculos,
            material = base.material,
        )

        var conVariasPoses = 0
        var totalImagenesPose = 0
        for (ej in cat.ejercicios) {
            val imgs = cat.todasImagenesAsset(ej)
            assertTrue("Ejercicio ${ej.id} sin imágenes", imgs.isNotEmpty())
            if (imgs.size >= 2) conVariasPoses++
            for ((_, uri) in imgs) {
                val rel = uri.removePrefix("file:///android_asset/repdb/")
                assertTrue("Falta imagen de pose $rel", File(dirRepdb, rel).exists())
                totalImagenesPose++
            }
        }
        assertTrue("Debe haber >500 ejercicios con 2+ poses (hay $conVariasPoses)", conVariasPoses > 500)
        assertTrue("Debe haber >1200 imágenes de pose (hay $totalImagenesPose)", totalImagenesPose > 1200)

        var musConImg = 0
        for (clave in cat.musculos.keys) {
            val uri = cat.imagenMusculoAsset(clave)
            if (uri != null) {
                val rel = uri.removePrefix("file:///android_asset/repdb/")
                assertTrue("Falta imagen de músculo $rel", File(dirRepdb, rel).exists())
                musConImg++
            }
        }
        assertTrue("Debe haber imágenes de músculos", musConImg > 10)

        var matConImg = 0
        for (clave in cat.material.keys) {
            val uri = cat.imagenMaterialAsset(clave)
            if (uri != null) {
                val rel = uri.removePrefix("file:///android_asset/repdb/")
                assertTrue("Falta imagen de material $rel", File(dirRepdb, rel).exists())
                matConImg++
            }
        }
        assertTrue("Debe haber imágenes de material", matConImg > 10)
    }
}
