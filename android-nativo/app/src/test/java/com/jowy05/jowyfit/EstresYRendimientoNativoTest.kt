package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Bascula
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.EjercicioSesion
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.ModoMayor
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Perimetros
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.datos.modelo.Serie
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
import com.jowy05.jowyfit.dominio.TendenciasDominio
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.util.Random
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import kotlin.system.measureTimeMillis

/**
 * Batería de estrés, rendimiento, fuzzing y concurrencia para JowyFit Kotlin Nativo:
 * - Historial masivo equivalente a ~4-5 años de uso diario (650 entrenos, ~11.700 series, 1.500 mediciones, 4.500 comidas).
 * - Matriz exhaustiva del generador sobre el catálogo real de 650 ejercicios en condiciones extremas.
 * - Fuzzing de 10.000 fotogramas BlazePose 3D con NaN, infinitos, overflow 1e300 y pérdida de puntos.
 * - Fuzzing de PesosYDiscos, MotorSesion, CalculosDominio y ComidaDominio con valores límite/degenerados.
 * - Estrés multihilo concurrente (8 hilos en paralelo) en cifrado, copias, generador y postura.
 */
class EstresYRendimientoNativoTest {

    @Test
    fun estres5AniosDeDatosRendimientoYExportacionCompleta() {
        val inicio = LocalDate.of(2022, 1, 3)
        val ejercicios = listOf("bench-press", "squat", "romanian-deadlift", "lat-pulldown", "seated-cable-row", "bicep-curl")
        val sesiones = (1..650).map { i ->
            val fecha = inicio.plusDays((i * 2).toLong()).toString()
            val tsBase = 1_641_000_000_000L + i * 172_800_000L
            Sesion(
                id = i.toLong(),
                fecha = fecha,
                rutinaId = 1L,
                letra = listOf("A", "B", "C")[i % 3],
                nombre = "Cuerpo completo ${listOf("A", "B", "C")[i % 3]}",
                gimnasioId = 1L,
                inicio = tsBase,
                fin = tsBase + 3_300_000L,
                estado = "hecha",
                ejercicios = ejercicios.mapIndexed { idx, ejId ->
                    val peso = 40.0 + (i / 25) * 2.5 + idx * 5.0
                    EjercicioSesion(
                        uid = "b$idx",
                        ejercicio = ejId,
                        planificado = ejId,
                        estado = "hecho",
                        repsMin = 6,
                        repsMax = 10,
                        rpe = 8.0,
                        descanso = 120,
                        registro = "peso",
                        series = (1..3).map { s ->
                            Serie(
                                n = s,
                                peso = peso,
                                reps = 8 + ((i + s) % 3),
                                rpe = 8.0,
                                hecha = true,
                                ts = tsBase + s * 120_000L,
                                record = (i % 25 == 0 && s == 1),
                            )
                        },
                    )
                },
            )
        }
        val mediciones = (1..1500).map { i ->
            val fecha = inicio.plusDays(i.toLong()).toString() + "T07:30"
            Medicion(
                id = i.toLong(),
                fecha = fecha,
                origen = "casa",
                pesoKg = 84.0 - (i * 0.004) + ((i % 5) - 2) * 0.1,
                perimetros = if (i % 7 == 0) Perimetros(cintura = 92.0 - i * 0.005, cuello = 38.0) else null,
                bascula = if (i % 3 == 0) Bascula(grasaPct = 22.0 - i * 0.003) else null,
            )
        }
        val comidas = (1..4500).map { i ->
            val fecha = inicio.plusDays((i / 3).toLong()).toString()
            val franja = listOf("desayuno", "comida", "cena")[i % 3]
            Comida(
                id = i.toLong(),
                fecha = fecha,
                hora = listOf("08:00", "14:00", "21:00")[i % 3],
                franja = franja,
                nombre = "Plato $i",
                kcal = 550.0 + (i % 200),
                proteina = 35.0 + (i % 25),
                cafeina = if (i % 3 == 0) 80.0 else null,
            )
        }
        val pasos = (1..1200).map { i ->
            PasosDia(fecha = inicio.plusDays(i.toLong()).toString(), pasos = 6500 + (i * 73) % 6000, fuente = "hc")
        }
        val retos = (1..365).map { i ->
            IntentoReto(
                id = i.toLong(),
                fecha = inicio.plusDays((1000 + i).toLong()).toString(),
                reto = RetosDominio.RETOS[i % RetosDominio.RETOS.size].id,
                valor = 20 + (i % 30),
                duracionS = 60,
                modo = "camara",
                record = i % 30 == 0,
            )
        }
        val metas = (1..30).map { i ->
            Meta(id = i.toLong(), tipo = "ejercicio", titulo = "Meta $i", objetivo = 100.0 + i, unidad = "kg", ejercicio = "bench-press", inicio = 40.0)
        }
        val perfil = Perfil(altaCompleta = true, nombre = "Joel", alturaCm = 178.0, sexo = "hombre", nacimiento = "1996-05-10")
        val hoy = inicio.plusDays(1500).toString()

        val msAnalisis = measureTimeMillis {
            val logros = TendenciasDominio.logros(sesiones)
            val subidas = TendenciasDominio.subidas(sesiones)
            val evo = TendenciasDominio.evolucion(sesiones, "bench-press", "e1rm")
            val hechos = TendenciasDominio.ejerciciosHechos(sesiones)
            val estancados = TendenciasDominio.ejerciciosEstancados(sesiones)
            val recMes = TendenciasDominio.recordsPorMes(sesiones, hoy, 12)
            val tendPeso = TendenciasDominio.tendenciaPeso(mediciones, hoy)
            val grasaMed = TendenciasDominio.grasaPorMedidas(mediciones, perfil.sexo, perfil.alturaCm)
            val rachaRetos = RetosDominio.racha(retos, inicio.plusDays(1365).toString())
            val recientes = ComidaDominio.recientes(comidas, hoy, emptyList(), 10)
            val sug = Progresion.sugerir(
                Progresion.ultimaSesionDe(sesiones, "bench-press"),
                Progresion.ObjetivoBloque(6, 10, 8.0),
                "peso",
                (0..120).map { it * 2.5 },
            )
            val metaPrinc = MetasDominio.metaPrincipal(metas) { m ->
                MetasDominio.valorActual(m, mediciones, sesiones, perfil, hoy)
            }

            assertTrue(logros.isNotEmpty())
            assertTrue(subidas.isNotEmpty())
            assertEquals(650, evo.size)
            assertEquals(6, hechos.size)
            assertNotNull(estancados)
            assertEquals(12, recMes.size)
            assertNotNull(tendPeso.kgSemana)
            assertTrue(grasaMed.isNotEmpty())
            assertEquals(365, rachaRetos.actual)
            assertEquals(10, recientes.size)
            assertNotNull(sug.peso)
            assertNotNull(metaPrinc)
        }
        assertTrue("El análisis de ~5 años tardó demasiado: ${msAnalisis} ms", msAnalisis < 4_000L)

        // Exportación CSV + JSON ligero + Copia completa ZIP sobre los 5 años de datos
        val msExport = measureTimeMillis {
            val csvE = ExportarLigero.csvEntrenos(sesiones) { it }
            val csvC = ExportarLigero.csvComidas(comidas)
            val csvM = ExportarLigero.csvMedidas(mediciones)
            val jsonL = ExportarLigero.jsonLigero(
                ExportarLigero.PaqueteLigeroDatos(perfil, mediciones, sesiones, comidas, pasos, metas, retos, null, emptyList()),
            )
            assertTrue(csvE.length > 200_000)
            assertTrue(csvC.length > 100_000)
            assertTrue(csvM.length > 50_000)
            assertTrue(jsonL.length > 500_000)

            val registros = buildList {
                add(RegistroTablaEntity("perfil", "yo", hoy, JsonJowyFit.encodeToString(perfil)))
                sesiones.forEach { add(RegistroTablaEntity("sesiones", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it))) }
                mediciones.forEach { add(RegistroTablaEntity("mediciones", it.id.toString(), it.fecha.take(10), JsonJowyFit.encodeToString(it))) }
                comidas.forEach { add(RegistroTablaEntity("comidas", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it))) }
                pasos.forEach { add(RegistroTablaEntity("pasos", it.fecha, it.fecha, JsonJowyFit.encodeToString(it))) }
                retos.forEach { add(RegistroTablaEntity("retos", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it))) }
            }
            val zip = GestorCopias.crearCopia(registros)
            val leida = GestorCopias.leerCopia(zip)
            assertEquals(registros.size, leida.registros.size)
        }
        assertTrue("La exportación/importación de 5 años tardó demasiado: ${msExport} ms", msExport < 10_000L)
    }

    @Test
    fun estresMatrizGeneradorSobreCatalogoReal650Ejercicios() {
        val catFile = File("../../public/repdb/catalogo.json")
        assertTrue(catFile.exists())
        val ejercicios = JsonJowyFit.decodeFromString<CatalogoJson>(catFile.readText()).ejercicios
        assertTrue(ejercicios.size >= 600)

        val objetivos = listOf("salud", "perder", "recomposicion", "musculo", "fuerza")
        val niveles = listOf("empiezo", "vuelvo", "intermedio", "avanzado")
        val gimnasios = listOf(
            null,
            Gimnasio(id = 1L, nombre = "Solo mancuernas", material = listOf("dumbbell")),
            Gimnasio(id = 2L, nombre = "Peso corporal", material = listOf("pull_up_bar")),
            Gimnasio(id = 3L, nombre = "Completo", material = PesosYDiscos.MATERIAL_HABITUAL.toList()),
        )

        var generadas = 0
        val ms = measureTimeMillis {
            for (nDias in 1..7) {
                for (obj in objetivos) {
                    for (niv in niveles) {
                        val mayor = (generadas % 5 == 0)
                        val pocoSueno = (generadas % 3 == 0)
                        val sensibles = if (generadas % 4 == 0) listOf("rodilla", "lumbar", "hombro", "codo", "muneca") else emptyList()
                        val gym = gimnasios[generadas % gimnasios.size]
                        val perfil = Perfil(
                            altaCompleta = true,
                            objetivo = obj,
                            nivel = niv,
                            diasFijos = (0 until nDias).toList(),
                            diasOpcionales = if (nDias < 7) listOf(6) else emptyList(),
                            minutosNormal = if (generadas % 6 == 0) 20 else 55,
                            minutosCorta = 20,
                            sueno = if (pocoSueno) "poco" else "bien",
                            zonasSensibles = sensibles,
                            superseries = !mayor,
                            modoMayor = if (mayor) ModoMayor(activo = true) else null,
                        )
                        val prohibidoId = ejercicios[generadas % ejercicios.size].id
                        val marcas = mapOf(prohibidoId to MarcaEjercicio(id = prohibidoId, duele = true))
                        val rut = GeneradorRutina.generar(
                            id = (generadas + 1).toLong(),
                            perfil = perfil,
                            gimnasio = gym,
                            ejercicios = ejercicios,
                            marcas = marcas,
                            calibracion = (generadas % 7 == 0),
                        )
                        assertEquals(nDias, rut.dias.count { !it.opcional })
                        val todos = rut.dias.flatMap { it.bloques }
                        assertTrue("El ejercicio marcado con dolor nunca debe entrar", todos.none { it.ejercicio == prohibidoId })
                        if (pocoSueno) {
                            assertTrue("Con poco sueño, RPE debe ser <= 7.5", todos.all { it.rpe <= 7.5 })
                        }
                        if (mayor) {
                            assertTrue("En modo mayor no debe haber superseries", todos.none { it.superserie != null })
                            assertTrue("En modo mayor descansos >= 120s", todos.all { it.descanso >= 120 })
                        }
                        generadas++
                    }
                }
            }
        }
        assertEquals(7 * 5 * 4, generadas)
        assertTrue("Generar $generadas rutinas tardó demasiado: ${ms} ms", ms < 6_000L)
    }

    @Test
    fun fuzzing10MilFotogramasBlazePose3DSinNanNiCrashes() {
        val rng = Random(20261126L)
        val valoresExtremos = doubleArrayOf(
            Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY,
            0.0, -0.0, 1e-12, -1e-12, 0.5, 1.0, -1.0, 1e150, -1e150, 1e300, -1e300,
        )
        fun puntoAleatorio(): PosturaDominio.Punto3D? {
            if (rng.nextInt(10) == 0) return null
            val raro = rng.nextInt(5) == 0
            val x = if (raro) valoresExtremos[rng.nextInt(valoresExtremos.size)] else rng.nextDouble() * 2.0 - 1.0
            val y = if (raro) valoresExtremos[rng.nextInt(valoresExtremos.size)] else rng.nextDouble() * 2.0 - 1.0
            val z = if (rng.nextBoolean()) (if (raro) valoresExtremos[rng.nextInt(valoresExtremos.size)] else rng.nextDouble() - 0.5) else null
            val conf = if (raro) valoresExtremos[rng.nextInt(valoresExtremos.size)] else rng.nextDouble()
            return PosturaDominio.Punto3D(x, y, z, conf)
        }

        val ejercicios = RetosDominio.EjercicioPostura.entries
        var estado = PosturaDominio.EstadoPostura()
        var ts = 1_000L
        val ms = measureTimeMillis {
            repeat(10_000) { i ->
                val pts = PosturaDominio.PuntosPostura(
                    cara = puntoAleatorio(),
                    hombroIzq = puntoAleatorio(), hombroDer = puntoAleatorio(),
                    codoIzq = puntoAleatorio(), codoDer = puntoAleatorio(),
                    munecaIzq = puntoAleatorio(), munecaDer = puntoAleatorio(),
                    caderaIzq = puntoAleatorio(), caderaDer = puntoAleatorio(),
                    rodillaIzq = puntoAleatorio(), rodillaDer = puntoAleatorio(),
                    tobilloIzq = puntoAleatorio(), tobilloDer = puntoAleatorio(),
                )
                // Incluye saltos temporales hacia atrás y hacia delante
                ts += if (i % 50 == 0) -500L else rng.nextInt(120).toLong()
                estado = PosturaDominio.evaluar(estado, pts, ejercicios[i % ejercicios.size], ts)
                assertTrue(estado.profundidadPct in 0..100)
                assertTrue(estado.segundosValidos.isFinite() && estado.segundosValidos >= 0.0)
                assertTrue(estado.anguloMinBajada.isFinite())
                assertTrue(estado.validas >= 0 && estado.invalidas >= 0)
            }
        }
        assertTrue("10.000 frames de postura tardaron demasiado: ${ms} ms", ms < 3_000L)
    }

    @Test
    fun fuzzingPesosDiscosMotorSesionCalculosYComidaConValoresExtremos() {
        val ms = measureTimeMillis {
            // PesosYDiscos con gimnasios corruptos, NaN, infinitos, paso 0 y 200 discos diminutos
            val gymRoto = Gimnasio(
                nombre = "Roto",
                barraKg = Double.NaN,
                mancuernas = listOf(
                    Tramo(2.0, 20.0, 0.0),
                    Tramo(30.0, 10.0, 2.0),
                    Tramo(Double.NaN, Double.POSITIVE_INFINITY, 1.0),
                    Tramo(2.0, 10.0, -1.0),
                ),
                discos = (1..200).map { it * 0.05 } + listOf(Double.NaN, Double.POSITIVE_INFINITY, -5.0, 0.0),
            )
            assertTrue(PesosYDiscos.mancuernasDisponibles(gymRoto).isEmpty())
            assertTrue(PesosYDiscos.pesosBarra(Double.NaN, gymRoto.discos).isEmpty())
            assertTrue(PesosYDiscos.pesosBarra(20.0, gymRoto.discos, 200.0).size <= 4000)
            assertTrue(PesosYDiscos.discosPorLado(Double.NaN, 20.0, listOf(10.0)) == null)
            assertTrue(PesosYDiscos.discosPorLado(Double.POSITIVE_INFINITY, 20.0, listOf(10.0)) == null)
            assertTrue(PesosYDiscos.discosPorLado(120.0, 20.0, gymRoto.discos) != null)

            // CalculosDominio y ComidaDominio con fechas corruptas, porKm <= 0 y NaN
            assertEquals(7, CalculosDominio.semanaDe("fecha-invalida").size)
            assertTrue(CalculosDominio.kcalPasos(8000, 80.0, 180.0, porKm = 0) > 0)
            assertEquals(0, CalculosDominio.kcalPasos(-100, Double.NaN, 180.0, Double.POSITIVE_INFINITY, -50))
            assertTrue(CalculosDominio.grasaMarina("hombre", Double.NaN, 85.0, 38.0, null) == null)
            assertTrue(CalculosDominio.grasaMarina("mujer", 170.0, 10.0, 40.0, 10.0) == null)

            val vNan = ComidaDominio.conRacion(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, ComidaDominio.Macros(Double.NaN, Double.POSITIVE_INFINITY), "G")
            assertEquals(0.0, vNan.kcal, 0.01)
            assertEquals(0.0, vNan.proteina, 0.01)
            val prod = Producto(codigo = "8480000123458", nombre = "Test", kcal100 = 200.0, proteina100 = 20.0)
            val gNan = ComidaDominio.porGramos(prod, Double.NaN)
            assertEquals(0.0, gNan.kcal, 0.01)

            // MotorSesion: 200 mutaciones caóticas seguidas
            val dia = DiaRutina(
                letra = "A", nombre = "Caos", dia = 0,
                bloques = listOf(
                    Bloque("u1", "bench-press", series = 3, superserie = "u2"),
                    Bloque("u2", "seated-cable-row", series = 3, superserie = "u1"),
                    Bloque("u3", "plank", series = 2, registro = "tiempo"),
                ),
            )
            var ses = MotorSesion.crearSesion(1L, dia, 1L, 1L)
            repeat(200) { k ->
                val idx = k % maxOf(1, ses.ejercicios.size)
                ses = when (k % 7) {
                    0 -> MotorSesion.apuntarSerie(ses, idx, MotorSesion.DatosSerie(peso = 50.0 + k, reps = 8, rpe = 8.0), emptyList())?.sesion ?: ses
                    1 -> MotorSesion.anadirSerie(ses, idx)
                    2 -> MotorSesion.quitarSerie(ses, idx)
                    3 -> MotorSesion.conCalentamiento(ses, idx, listOf(PesosYDiscos.SerieCalentamiento(20.0, 8)))
                    4 -> MotorSesion.sustituir(ses, idx, "chest-press-machine", "ocupado", 45.0, 10)
                    5 -> MotorSesion.irA(ses, idx)
                    else -> MotorSesion.saltar(ses, idx)
                }
            }
            val resumen = MotorSesion.resumen(ses)
            assertTrue(resumen.volumenKg >= 0 && resumen.series >= 0)
        }
        assertTrue("El fuzzing de dominio tardó demasiado: ${ms} ms", ms < 2_000L)
    }

    @Test
    fun estresConcurrencia8HilosCifradoCopiasGeneradorYPostura() {
        val catFile = File("../../public/repdb/catalogo.json")
        val ejercicios = JsonJowyFit.decodeFromString<CatalogoJson>(catFile.readText()).ejercicios
        val perfil = Perfil(altaCompleta = true, nombre = "Joel", alturaCm = 178.0, diasFijos = listOf(0, 2, 4))
        val regBase = listOf(RegistroTablaEntity("perfil", "yo", "2026-11-26", JsonJowyFit.encodeToString(perfil)))

        val pool = Executors.newFixedThreadPool(8)
        try {
            val tareas = (1..8).map { hilo ->
                Callable {
                    val clave = "ClaveHilo-$hilo-!#2026"
                    val copia = GestorCopias.crearCopia(regBase, emptyMap(), contrasena = clave)
                    val leida = GestorCopias.leerCopia(copia, contrasena = clave)
                    assertEquals(1, leida.registros.size)

                    val rut = GeneradorRutina.generar(hilo.toLong(), perfil, null, ejercicios)
                    val uids = rut.dias.flatMap { d -> d.bloques.map { it.uid } }
                    assertTrue(uids.isNotEmpty())
                    assertEquals(uids.size, uids.distinct().size)

                    val pts = PosturaDominio.PuntosPostura(
                        hombroIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.9),
                        caderaIzq = PosturaDominio.Punto3D(0.5, 0.0, 0.0, 0.9),
                        tobilloIzq = PosturaDominio.Punto3D(1.0, 0.0, 0.0, 0.9),
                    )
                    var st = PosturaDominio.EstadoPostura()
                    repeat(500) { f ->
                        st = PosturaDominio.evaluar(st, pts, RetosDominio.EjercicioPostura.PLANCHA, f * 33L)
                    }
                    assertTrue(st.segundosValidos > 10.0)
                    Triple(copia.copyOfRange(21, 49).toList(), uids, st.segundosValidos)
                }
            }
            val resultados = pool.invokeAll(tareas).map { it.get() }
            // Cada hilo produjo (sal + IV) criptográficamente único
            val salesEIvs = resultados.map { it.first }.distinct()
            assertEquals(8, salesEIvs.size)
            // Ningún UID colisionó entre los 8 hilos concurrentes
            val todosUids = resultados.flatMap { it.second }
            assertEquals(todosUids.size, todosUids.distinct().size)
        } finally {
            pool.shutdownNow()
        }
    }
}
