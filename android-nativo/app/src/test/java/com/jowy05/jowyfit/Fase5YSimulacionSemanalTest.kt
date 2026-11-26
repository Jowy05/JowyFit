package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Dolor
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Perimetros
import com.jowy05.jowyfit.datos.modelo.RespuestaRevision
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.datos.modelo.Tramo
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.dominio.ExportarLigero
import com.jowy05.jowyfit.dominio.GeneradorRutina
import com.jowy05.jowyfit.dominio.MetasDominio
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.PosturaDominio
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.dominio.SaludYRevisionDominio
import com.jowy05.jowyfit.dominio.TendenciasDominio
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Tests de Fase 5 (Revisión semanal, Exportación CSV/JSON) + Simulación semanal completa (Lunes a Domingo)
 * recorriendo de extremo a extremo todas las capas de dominio de JowyFit Kotlin Nativo.
 */
class Fase5YSimulacionSemanalTest {

    @Test
    fun exportarCsvNeutralizaFormulasYRespetaNumerosNegativos() {
        assertEquals("'=CMD()", ExportarLigero.escaparCsv("=CMD()"))
        assertEquals("'+10+2", ExportarLigero.escaparCsv("+10+2"))
        assertEquals("'@evil", ExportarLigero.escaparCsv("@evil"))
        assertEquals("-12.5", ExportarLigero.escaparCsv(-12.5))
        assertEquals("\"Pollo, arroz\"", ExportarLigero.escaparCsv("Pollo, arroz"))

        val csvC = ExportarLigero.csvComidas(
            listOf(Comida(1, "2026-11-26", "14:00", "comida", "=SUM(A1:A2)", 500.0, 40.0)),
        )
        assertTrue(csvC.startsWith("\uFEFF"))
        assertTrue(csvC.contains("'=SUM(A1:A2)"))
    }

    @Test
    fun revisionSemanalSuavizaDevuelveYDeshaceExactamente() {
        val catFile = File("../../public/repdb/catalogo.json")
        assertTrue(catFile.exists())
        val cat = JsonJowyFit.decodeFromString<CatalogoJson>(catFile.readText())
        val porId = cat.ejercicios.associateBy { it.id }

        val perfil = Perfil(
            altaCompleta = true,
            objetivo = "musculo",
            nivel = "intermedio",
            diasFijos = listOf(0, 2, 4),
            diasOpcionales = emptyList(),
            dolores = listOf(Dolor(zona = "rodillas", cuanto = "poco", cuando = "aveces", desde = "dias", inicio = "2026-11-20")),
        )
        val rutinaOriginal = GeneradorRutina.generar(1L, perfil, null, cat.ejercicios)

        // 1) Empeora rodillas -> escala a "regular" y suaviza/sustituye bloques que cargan rodillas
        val respPeor = listOf(RespuestaRevision("rodillas", "peor"))
        val doloresPeor = SaludYRevisionDominio.doloresTrasRevision(perfil.dolores.orEmpty(), respPeor)
        assertEquals("regular", doloresPeor.first().cuanto)

        val perfilPeor = perfil.copy(dolores = doloresPeor)
        val cambiosPeor = SaludYRevisionDominio.cambiosRevision(
            rutina = rutinaOriginal,
            perfil = perfilPeor,
            zonasPeor = listOf("rodillas"),
            zonasMejor = emptyList(),
            activos = emptyList(),
            ejerciciosPorId = porId,
        )
        assertTrue("Debe proponer al menos 1 ajuste en rutina al empeorar rodillas", cambiosPeor.isNotEmpty())
        val rutinaSuavizada = SaludYRevisionDominio.aplicarCambios(rutinaOriginal, cambiosPeor)
        assertFalse(rutinaSuavizada == rutinaOriginal)

        // 2) Deshacer restaura la rutina original exactamente bloque a bloque
        val rutinaDeshecha = SaludYRevisionDominio.aplicarCambios(rutinaSuavizada, cambiosPeor, deshacer = true)
        assertEquals(rutinaOriginal, rutinaDeshecha)

        // 3) Al marcar "ya no duele", quita la molestia y devuelve el bloque original sin carga reducida
        val respYa = listOf(RespuestaRevision("rodillas", "ya"))
        assertTrue(SaludYRevisionDominio.doloresTrasRevision(doloresPeor, respYa).isEmpty())
        val cambiosVuelta = SaludYRevisionDominio.cambiosRevision(
            rutina = rutinaSuavizada,
            perfil = perfil.copy(dolores = emptyList()),
            zonasPeor = emptyList(),
            zonasMejor = listOf("rodillas" to true),
            activos = cambiosPeor,
            ejerciciosPorId = porId,
        )
        assertTrue(cambiosVuelta.isNotEmpty())
        val rutinaRecuperada = SaludYRevisionDominio.aplicarCambios(rutinaSuavizada, cambiosVuelta)
        assertEquals(rutinaOriginal, rutinaRecuperada)
    }

    @Test
    fun simulacionSemanaCompletaEndToEndDeLunesADomingo() {
        val catFile = File("../../public/repdb/catalogo.json")
        assertTrue(catFile.exists())
        val catalogo = JsonJowyFit.decodeFromString<CatalogoJson>(catFile.readText())
        val porId = catalogo.ejercicios.associateBy { it.id }

        // Perfil inicial + gimnasio real
        val gym = Gimnasio(
            id = 1L,
            nombre = "Gym Barrio",
            material = PesosYDiscos.MATERIAL_HABITUAL.toList(),
            mancuernas = listOf(Tramo(2.0, 10.0, 2.0), Tramo(12.5, 40.0, 2.5)),
            barraKg = 20.0,
        )
        var perfil = Perfil(
            altaCompleta = true,
            nombre = "Joel",
            nacimiento = "1996-05-10",
            sexo = "hombre",
            alturaCm = 178.0,
            objetivo = "recomposicion",
            nivel = "intermedio",
            diasFijos = listOf(0, 2, 4), // Lunes, Miércoles, Viernes
            diasOpcionales = listOf(5),  // Sábado
            pasosObjetivo = 8000,
            suplementos = listOf("Creatina", "Batido de proteína"),
        )
        var rutina = GeneradorRutina.generar(1L, perfil, gym, catalogo.ejercicios, calibracion = false)
        assertEquals(3, rutina.dias.count { !it.opcional })
        assertEquals(1, rutina.dias.count { it.opcional })

        val sesiones = mutableListOf<Sesion>()
        val comidas = mutableListOf<Comida>()
        val mediciones = mutableListOf<Medicion>()
        val pasos = mutableListOf<PasosDia>()
        val retos = mutableListOf<IntentoReto>()
        var metaDominadas = Meta(id = 1L, tipo = "dominadas", titulo = "10 dominadas", objetivo = 10.0, unidad = "reps")

        // === LUNES (2026-11-23): Entreno A normal, comidas, OFF, pesaje, meta y Reto 3D ===
        mediciones += Medicion(1L, "2026-11-23T08:00", pesoKg = 80.2, perimetros = Perimetros(cintura = 85.0, cuello = 38.0))
        val diaA = rutina.dias[0]
        var sesLun = MotorSesion.crearSesion(1L, diaA, rutina.id, gym.id, "normal", ahora = 1_763_884_800_000L).copy(fecha = "2026-11-23")
        // Apuntar 1ª serie de todos los ejercicios del día A
        for (i in sesLun.ejercicios.indices) {
            val e = sesLun.ejercicios[i]
            val r = MotorSesion.apuntarSerie(sesLun, i, MotorSesion.DatosSerie(peso = 40.0, reps = e.repsMax, rpe = 8.0), emptyList(), 1_763_885_000_000L + i * 60_000L)
            if (r != null) sesLun = r.sesion
        }
        sesLun = sesLun.copy(estado = "hecha", fin = 1_763_888_400_000L)
        sesiones += sesLun
        assertTrue(MotorSesion.resumen(sesLun).series >= diaA.bloques.size)

        comidas += Comida(1L, "2026-11-23", "08:30", "desayuno", "Tostada con huevo", 420.0, 24.0, cafeina = 90.0)
        comidas += Comida(2L, "2026-11-23", "14:00", "comida", "Pollo con arroz", 680.0, 52.0)
        comidas += Comida(3L, "2026-11-23", "18:00", "merienda", "Batido de proteína", 120.0, 24.0, suplemento = "Batido de proteína")
        comidas += Comida(4L, "2026-11-23", "21:00", "cena", "Salmón con patatas", 640.0, 44.0)
        val totLun = CalculosDominio.totalesComida(comidas.filter { it.fecha == "2026-11-23" })
        val objEner = CalculosDominio.calcularObjetivos(perfil, 80.2)
        assertTrue(totLun.proteina >= objEner.proteina - 5)

        metaDominadas = MetasDominio.registrarAvance(metaDominadas, 5.0, "2026-11-23", "Primera marca de la semana")
        retos += IntentoReto(1L, "2026-11-23", "flexiones-60", valor = 30, duracionS = 60, modo = "camara", record = true)
        pasos += PasosDia("2026-11-23", 9200, "hc")

        // === MARTES (2026-11-24): Descanso, repetir desayuno de ayer, plancha 3D ===
        val deAyerDes = ComidaDominio.deAyer(comidas, "2026-11-23", "desayuno")
        assertEquals(1, deAyerDes.size)
        comidas += deAyerDes.first().copy(id = 5L, fecha = "2026-11-24")
        pasos += PasosDia("2026-11-24", 10400, "hc")
        // Simulación 3D de plancha (2 s válidos)
        var pl = PosturaDominio.EstadoPostura()
        val ptsPlancha = PosturaDominio.PuntosPostura(
            hombroIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.95),
            caderaIzq = PosturaDominio.Punto3D(0.5, 0.0, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(1.0, 0.0, 0.0, 0.95),
        )
        pl = PosturaDominio.evaluar(pl, ptsPlancha, RetosDominio.EjercicioPostura.PLANCHA, 1000L)
        pl = PosturaDominio.evaluar(pl, ptsPlancha, RetosDominio.EjercicioPostura.PLANCHA, 2000L)
        pl = PosturaDominio.evaluar(pl, ptsPlancha, RetosDominio.EjercicioPostura.PLANCHA, 3000L)
        assertTrue(pl.segundosValidos >= 1.9)
        retos += IntentoReto(2L, "2026-11-24", "plancha-max", valor = 75, duracionS = 75, modo = "camara", record = true)

        // === MIÉRCOLES (2026-11-25): Entreno B versión corta + nuevo pesaje + récord ===
        mediciones += Medicion(2L, "2026-11-25T08:00", pesoKg = 79.9)
        val diaB = rutina.dias[1]
        var sesMie = MotorSesion.crearSesion(2L, diaB, rutina.id, gym.id, "corta", ahora = 1_764_057_600_000L).copy(fecha = "2026-11-25")
        val primerEjB = sesMie.ejercicios.first()
        val resMie = MotorSesion.apuntarSerie(sesMie, 0, MotorSesion.DatosSerie(peso = 50.0, reps = primerEjB.repsMax, rpe = 8.0), emptyList(), 1_764_058_000_000L)!!
        sesMie = resMie.sesion.copy(estado = "hecha", fin = 1_764_060_000_000L)
        sesiones += sesMie
        retos += IntentoReto(3L, "2026-11-25", "flexiones-60", valor = 34, duracionS = 60, modo = "camara", record = true)

        // === JUEVES–SÁBADO (2026-11-26..28): Entreno C + avance meta + pesaje ===
        mediciones += Medicion(3L, "2026-11-28T08:00", pesoKg = 79.6)
        val diaC = rutina.dias[2]
        var sesVie = MotorSesion.crearSesion(3L, diaC, rutina.id, gym.id, "minima", ahora = 1_764_230_400_000L).copy(fecha = "2026-11-27")
        val resVie = MotorSesion.apuntarSerie(sesVie, 0, MotorSesion.DatosSerie(peso = 55.0, reps = 10, rpe = 8.0), emptyList(), 1_764_230_800_000L)!!
        sesVie = resVie.sesion.copy(estado = "hecha", fin = 1_764_232_200_000L)
        sesiones += sesVie
        metaDominadas = MetasDominio.registrarAvance(metaDominadas, 6.0, "2026-11-27", "Subiendo limpias")

        // === DOMINGO (2026-11-29): Revisión semanal + verificación estado semanal + Exportación + Copia cifrada V7 ===
        val semana = CalculosDominio.estadoSemana(rutina, sesiones, "2026-11-29")
        assertEquals(3, semana.count { it.estado == CalculosDominio.EstadoDiaTipo.HECHO })

        val racha = RetosDominio.racha(retos, "2026-11-25")
        assertEquals(3, racha.actual)
        assertEquals(34, RetosDominio.mejorMarca(retos, "flexiones-60")?.valor)

        val tendPeso = TendenciasDominio.tendenciaPeso(mediciones, "2026-11-29")
        assertNotNull(tendPeso.kgSemana)
        assertTrue(tendPeso.kgSemana!! < 0.0)
        assertEquals(0.6, MetasDominio.estado(metaDominadas, metaDominadas.actual).progreso, 0.01)

        // Revisión semanal: nota molestia nueva en hombros -> suaviza y se puede deshacer
        perfil = perfil.copy(dolores = listOf(Dolor("hombros", "regular", "fuerza", "dias", "2026-11-29")))
        val ajustesRev = SaludYRevisionDominio.cambiosRevision(rutina, perfil, listOf("hombros"), emptyList(), emptyList(), porId, gym)
        assertTrue(ajustesRev.isNotEmpty())
        val rutAjustada = SaludYRevisionDominio.aplicarCambios(rutina, ajustesRev)
        assertEquals(rutina, SaludYRevisionDominio.aplicarCambios(rutAjustada, ajustesRev, deshacer = true))
        rutina = rutAjustada

        // Exportación CSV + JSON ligero
        val csvE = ExportarLigero.csvEntrenos(sesiones) { porId[it]?.nombre ?: it }
        val csvC = ExportarLigero.csvComidas(comidas)
        val csvM = ExportarLigero.csvMedidas(mediciones)
        val jsonL = ExportarLigero.jsonLigero(
            ExportarLigero.PaqueteLigeroDatos(perfil, mediciones, sesiones, comidas, pasos, listOf(metaDominadas), retos, rutina, listOf(gym)),
        )
        assertTrue(csvE.lines().size >= 5)
        assertTrue(csvC.lines().size >= 6)
        assertTrue(csvM.lines().size >= 4)
        assertTrue(jsonL.contains("\"formato\": \"ligero\""))

        // Copia completa cifrada V7 con contraseña (ida y vuelta AES-256-GCM + PBKDF2-600k)
        val registros = listOf(
            RegistroTablaEntity("perfil", "yo", "2026-11-23", JsonJowyFit.encodeToString(perfil)),
            RegistroTablaEntity("rutinas", "1", "2026-11-23", JsonJowyFit.encodeToString(rutina)),
            RegistroTablaEntity("metas", "1", "", JsonJowyFit.encodeToString(metaDominadas)),
        ) + sesiones.map { RegistroTablaEntity("sesiones", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) } +
            comidas.map { RegistroTablaEntity("comidas", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) } +
            retos.map { RegistroTablaEntity("retos", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) }

        val copiaCifrada = GestorCopias.crearCopia(registros, emptyMap(), contrasena = "MiClaveFuerte!2026")
        assertTrue(CifradoCopia.esCifrada(copiaCifrada))
        val recuperada = GestorCopias.leerCopia(copiaCifrada, contrasena = "MiClaveFuerte!2026")
        assertEquals(GestorCopias.VERSION_MAX_SOPORTADA, recuperada.version)
        assertEquals(registros.size, recuperada.registros.size)
    }
}
