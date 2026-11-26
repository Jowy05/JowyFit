package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Dolor
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
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.PosturaDominio
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.dominio.SaludYRevisionDominio
import com.jowy05.jowyfit.dominio.TendenciasDominio
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.LocalDate
import java.util.Random
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.cos
import kotlin.math.sin

/**
 * Suite de estrés extremo, matriz combinatoria de todas las opciones de la app, fuzzing de motores
 * de entreno/nutrición/postura 3D, concurrencia multi-hilo y endurecimiento de seguridad.
 */
class EstresExtremoOpcionesTest {

    companion object {
        private lateinit var ejercicios: List<EjercicioCatalogo>
        private lateinit var porId: Map<String, EjercicioCatalogo>

        @JvmStatic
        @BeforeClass
        fun cargar() {
            val f = File("../../public/repdb/catalogo.json")
            assertTrue(f.exists())
            val cat = JsonJowyFit.decodeFromString<CatalogoJson>(f.readText())
            ejercicios = cat.ejercicios
            porId = ejercicios.associateBy { it.id }
        }
    }

    // =========================================================================
    // 1. MATRIZ COMBINATORIA TOTAL DE OPCIONES DEL GENERADOR DE RUTINAS
    // =========================================================================
    @Test
    fun matrizCombinatoriaCompletaDeTodasLasOpcionesDeGeneradorRutina() {
        val objetivos = listOf("salud", "perder", "recomposicion", "musculo", "fuerza")
        val niveles = listOf("empiezo", "vuelvo", "intermedio", "avanzado")
        val preferencias = listOf("maquinas", "libre", "mezcla")
        val repsModos = listOf("pesadas", "moderadas", "normales")
        val suenos = listOf("poco", "normal", "bien")
        val gimnasios = listOf(
            null,
            Gimnasio(1L, "Solo casa", material = emptyList()),
            Gimnasio(2L, "Mancuernas", material = listOf("dumbbell", "flat_bench")),
            Gimnasio(3L, "Solo máquinas", material = PesosYDiscos.GRUPOS_MATERIAL.filter { it.id in setOf("pierna", "torso", "poleas") }.flatMap { it.claves }),
            Gimnasio(4L, "Completo", material = PesosYDiscos.GRUPOS_MATERIAL.flatMap { it.claves }),
        )

        var rutinasGeneradas = 0

        // A) Todos los días (1..7) × todos los objetivos × todos los niveles × opciones variadas
        for (nDias in 1..7) {
            for (obj in objetivos) {
                for (nivel in niveles) {
                    val idx = rutinasGeneradas
                    val mayor = (idx % 7 == 0)
                    val sueno = suenos[idx % suenos.size]
                    val gym = gimnasios[idx % gimnasios.size]
                    val perfil = Perfil(
                        altaCompleta = true,
                        objetivo = obj,
                        nivel = nivel,
                        diasFijos = (0 until nDias).toList(),
                        diasOpcionales = if (nDias < 7) listOf(6) else emptyList(),
                        preferencia = preferencias[idx % preferencias.size],
                        reps = repsModos[idx % repsModos.size],
                        sueno = sueno,
                        modoMayor = if (mayor) ModoMayor(activo = true) else null,
                        core = (idx % 2 == 0),
                        superseries = (idx % 3 != 0),
                        minutosNormal = listOf(25, 45, 60, 90)[idx % 4],
                        minutosCorta = listOf(15, 25, 35)[idx % 3],
                        zonasPrioridad = listOf(emptyList(), listOf("pecho", "gluteo"), listOf("espalda", "piernas", "abdomen"))[idx % 3],
                    )
                    val r = GeneradorRutina.generar(idx.toLong() + 1, perfil, gym, ejercicios, calibracion = (idx % 5 == 0))
                    verificarInvariantesRutina(r, perfil, gym)
                    rutinasGeneradas++
                }
            }
        }

        // B) Todas las 7 condiciones de salud individualmente y combinadas
        val condiciones = SaludYRevisionDominio.CONDICIONES_SALUD.map { it.clave }
        val combosCond = condiciones.map { listOf(it) } + listOf(
            listOf("tension", "osteoporosis", "protesis"),
            listOf("embarazo", "asma", "diabetes"),
            listOf("anticoagulantes", "tension", "protesis"),
            condiciones,
        )
        for (combo in combosCond) {
            val perfil = Perfil(
                altaCompleta = true,
                objetivo = "salud",
                nivel = "intermedio",
                diasFijos = listOf(0, 2, 4),
                condicionesSalud = combo,
                core = true,
            )
            val r = GeneradorRutina.generar(1000L + rutinasGeneradas, perfil, gimnasios.last(), ejercicios)
            verificarInvariantesRutina(r, perfil, gimnasios.last())
            rutinasGeneradas++
        }

        // C) Todas las 23 zonas de dolor en los 3 niveles (poco, regular, mucho)
        for (z in SaludYRevisionDominio.ZONAS_DOLOR) {
            for (cuanto in listOf("poco", "regular", "mucho")) {
                val perfil = Perfil(
                    altaCompleta = true,
                    objetivo = "musculo",
                    nivel = "intermedio",
                    diasFijos = listOf(0, 2, 4),
                    dolores = listOf(Dolor(z.clave, cuanto = cuanto, cuando = if (cuanto == "mucho") "siempre" else "fuerza")),
                )
                val r = GeneradorRutina.generar(2000L + rutinasGeneradas, perfil, gimnasios.last(), ejercicios)
                verificarInvariantesRutina(r, perfil, gimnasios.last())
                rutinasGeneradas++
            }
        }

        assertTrue("Se deben haber verificado >200 rutinas reales (fueron $rutinasGeneradas)", rutinasGeneradas > 200)
    }

    private fun verificarInvariantesRutina(r: com.jowy05.jowyfit.datos.modelo.Rutina, perfil: Perfil, gym: Gimnasio?) {
        val rest = SaludYRevisionDominio.restricciones(perfil)
        val uids = HashSet<String>()
        val novato = perfil.nivel in setOf("empiezo", "vuelvo") || perfil.modoMayor?.activo == true
        val topeRpe = minOf(
            if (novato || perfil.sueno == "poco") 8.0 else 9.0,
            if (perfil.sueno == "poco") 7.5 else 10.0,
            rest.rpeMax ?: 10.0,
        )
        val matPermitido = gym?.material?.takeIf { it.isNotEmpty() }?.toSet() ?: PesosYDiscos.MATERIAL_HABITUAL
        assertTrue("La rutina debe tener días", r.dias.isNotEmpty())
        for (d in r.dias) {
            val vistosDia = HashSet<String>()
            for (b in d.bloques) {
                assertTrue("UID duplicado ${b.uid}", uids.add(b.uid))
                assertTrue("Ejercicio repetido en el mismo día: ${b.ejercicio}", vistosDia.add(b.ejercicio))
                val ej = porId.getValue(b.ejercicio)
                assertEquals("Solo categoría strength", "strength", ej.categoria)
                assertTrue("Material ${ej.material} fuera de gimnasio", ej.material == null || ej.material in matPermitido)
                assertNull("Ejercicio ${ej.id} prohibido por salud (${rest.fuera(ej)})", rest.fuera(ej))
                assertTrue("RPE ${b.rpe} supera tope $topeRpe", b.rpe <= topeRpe + 1e-9)
                assertTrue("Series >= 1", b.series >= 1)
                assertTrue("repsMin <= repsMax", b.repsMin <= b.repsMax)
                assertTrue("descanso >= 15s", b.descanso >= 15)
                if (perfil.modoMayor?.activo == true) {
                    assertNull("Modo mayor sin superseries", b.superserie)
                    assertNotEquals("advanced", ej.dificultad)
                    assertTrue(b.descanso >= 120)
                }
                if (b.registro == "tiempo" && rest.maxIsometrico != null) {
                    assertTrue("Isométrico ${b.repsMax}s supera tope ${rest.maxIsometrico}s", b.repsMax <= rest.maxIsometrico!!)
                }
            }
        }
    }

    // =========================================================================
    // 2. FUZZING EXTREMO DE MOTORES DE SESIÓN, PROGRESIÓN Y DISCOS
    // =========================================================================
    @Test
    fun fuzzingMilMutacionesEnMotorSesionYProgresionYDiscos() {
        val rng = Random(20261126L)
        val perfil = Perfil(altaCompleta = true, diasFijos = listOf(0, 2, 4), superseries = true, core = true)
        val gym = Gimnasio(1L, "Full", material = PesosYDiscos.GRUPOS_MATERIAL.flatMap { it.claves }, mancuernas = listOf(Tramo(2.0, 40.0, 2.0)))
        val rutina = GeneradorRutina.generar(1L, perfil, gym, ejercicios)

        // Probar 1.000 operaciones aleatorias sobre una sesión viva comprobando invariantes tras CADA mutación
        var s = MotorSesion.crearSesion(1L, rutina.dias[0], rutina.id, gym.id, "normal", ahora = 1_764_000_000_000L, fechaIso = "2026-11-26")
        var reloj = s.inicio + 10_000L
        repeat(1000) { paso ->
            val nEj = s.ejercicios.size
            val idx = if (nEj > 0) rng.nextInt(nEj) else 0
            when (rng.nextInt(9)) {
                0, 1, 2 -> { // Apuntar serie en ejercicio actual
                    val cur = MotorSesion.indiceActual(s)
                    if (cur >= 0) {
                        val ej = s.ejercicios[cur]
                        val res = MotorSesion.apuntarSerie(
                            s, cur,
                            MotorSesion.DatosSerie(
                                peso = if (ej.registro in setOf("peso", "mancuerna")) (10 + rng.nextInt(100)).toDouble() else null,
                                reps = if (ej.registro != "tiempo") 1 + rng.nextInt(15) else null,
                                segundos = if (ej.registro == "tiempo") 15 + rng.nextInt(45) else null,
                                rpe = 6.0 + rng.nextInt(5),
                            ),
                            emptyList(), reloj,
                        )
                        if (res != null) s = res.sesion
                    }
                }
                3 -> s = MotorSesion.anadirSerie(s, idx)
                4 -> s = MotorSesion.quitarSerie(s, idx)
                5 -> s = MotorSesion.irA(s, idx)
                6 -> s = MotorSesion.saltar(s, idx)
                7 -> { // Editar serie hecha si existe
                    val ej = s.ejercicios.getOrNull(idx)
                    val hechas = ej?.series?.mapIndexedNotNull { i, x -> if (x.hecha) i else null }.orEmpty()
                    if (hechas.isNotEmpty()) {
                        s = MotorSesion.editarSerieHecha(s, idx, hechas[rng.nextInt(hechas.size)], 55.0, 10, null)
                    }
                }
                8 -> { // Añadir ejercicio libre aleatorio si la sesión tiene < 15 ejercicios
                    if (s.ejercicios.size < 15) {
                        val ejRand = ejercicios[rng.nextInt(ejercicios.size)]
                        s = MotorSesion.anadirEjercicioASesion(s, GeneradorRutina.bloqueParaEjercicio(ejRand))
                    }
                }
            }
            reloj += 30_000L

            // Invariantes estrictas tras cada paso del fuzzer
            val enCurso = s.ejercicios.count { it.estado == "curso" }
            assertTrue("Paso $paso: como máximo 1 ejercicio en curso (hubo $enCurso)", enCurso <= 1)
            for (ej in s.ejercicios) {
                assertTrue("Paso $paso: siempre >= 1 serie de trabajo", ej.series.count { !it.calentamiento } >= 1)
                val nums = ej.series.map { it.n }
                assertEquals("Paso $paso: numeración correlativa 1..size", (1..ej.series.size).toList(), nums)
            }
            val res = MotorSesion.resumen(s, reloj)
            assertTrue(res.volumenKg >= 0 && res.segundos >= 0)
        }

        // Fuzzing de PesosYDiscos con valores extremos / NaN / Infinity / negativos / fraccionales
        assertNull(PesosYDiscos.discosPorLado(Double.NaN, 20.0, listOf(5.0)))
        assertNull(PesosYDiscos.discosPorLado(Double.POSITIVE_INFINITY, 20.0, listOf(5.0)))
        assertNull(PesosYDiscos.discosPorLado(15.0, 20.0, listOf(5.0))) // menor que la barra
        assertEquals(emptyList<Double>(), PesosYDiscos.discosPorLado(20.0, 20.0, listOf(5.0)))
        assertNull(PesosYDiscos.discosPorLado(21.0, 20.0, listOf(5.0, 10.0))) // imposible de montar
        assertTrue(PesosYDiscos.pesosBarra(Double.NaN, listOf(5.0)).isEmpty())
        assertTrue(PesosYDiscos.pesosBarra(-10.0, listOf(5.0)).isEmpty())
        assertTrue(PesosYDiscos.mancuernasDisponibles(Gimnasio(mancuernas = listOf(Tramo(10.0, 5.0, -1.0), Tramo(Double.NaN, 10.0, 2.0)))).isEmpty())
        repeat(200) { i ->
            val barra = listOf(10.0, 15.0, 20.0, 25.0)[i % 4]
            val discos = listOf(0.5, 1.25, 2.5, 5.0, 10.0, 15.0, 20.0, 25.0)
            val total = barra + (i % 60) * 2.5
            val res = PesosYDiscos.discosPorLado(total, barra, discos)
            assertNotNull("Debe poder montar $total kg con barra $barra", res)
            assertEquals(total, barra + 2.0 * res!!.sum(), 1e-6)
        }
    }

    // =========================================================================
    // 3. FUZZING DE COMIDA, FRANJAS 24H Y OPEN FOOD FACTS HOSTIL
    // =========================================================================
    @Test
    fun estresComida1440MinutosYOpenFoodFactsHostil() {
        // Todos los 1.440 minutos del día en franjas por defecto y personalizadas
        val custom = mapOf("desayuno" to "06:00", "comida" to "12:30", "merienda" to "17:00", "cena" to "20:30")
        assertTrue(ComidaDominio.franjasValidas(custom))
        assertFalse(ComidaDominio.franjasValidas(mapOf("desayuno" to "12:00", "comida" to "11:00", "merienda" to "16:00", "cena" to "20:00")))
        for (min in 0 until 1440) {
            val hhmm = "%02d:%02d".format(min / 60, min % 60)
            assertTrue(ComidaDominio.franjaPorHora(hhmm) in ComidaDominio.FRANJAS)
            assertTrue(ComidaDominio.franjaPorHora(hhmm, custom) in ComidaDominio.FRANJAS)
        }

        // URLs maliciosas / píxeles espía bloqueados
        val urlsMalas = listOf(
            null, "", "   ",
            "http://images.openfoodfacts.org/foto.jpg",
            "https://evil.com/openfoodfacts.org/x.jpg",
            "https://images.openfoodfacts.org.evil.com/x.jpg",
            "https://user:pass@images.openfoodfacts.org/x.jpg",
            "https://images.openfoodfacts.org:8443/x.jpg",
            "javascript:alert(1)",
            "https://images.openfoodfacts.org/a\nb.jpg",
            "https://images.openfoodfacts.org/" + "a".repeat(2100),
        )
        for (u in urlsMalas) {
            assertNull("URL maliciosa no bloqueada: $u", ComidaDominio.imagenOFF(u))
        }
        assertNotNull(ComidaDominio.imagenOFF("https://images.openfoodfacts.net/images/products/1/front.jpg"))

        // Payloads extremos de Open Food Facts: kJ sin kcal, comas decimales, valores imposibles >900 kcal / >100g prot / negativos
        val offKj = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name": "Avena",
                "nutriments": {
                  "energy-kj_100g": "1550,5",
                  "proteins_100g": "13,2",
                  "carbohydrates_100g": 58.0,
                  "fat_100g": 7.0
                }
              }
            }
            """.trimIndent(),
        ) as JsonObject
        val pKj = ComidaDominio.leerOFF("8410000000001", offKj)!!
        assertEquals(371.0, pKj.kcal100!!, 1.0)
        assertEquals(13.2, pKj.proteina100!!, 0.1)

        val offAbsurdo = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name": "",
                "nutriments": {
                  "energy-kcal_100g": 99999,
                  "proteins_100g": 500,
                  "fat_100g": -12,
                  "caffeine_100g": 50
                }
              }
            }
            """.trimIndent(),
        ) as JsonObject
        val pAbs = ComidaDominio.leerOFF("12345678", offAbsurdo)!!
        assertNull("kcal > 900 debe descartarse", pAbs.kcal100)
        assertNull("proteína > 100g debe descartarse", pAbs.proteina100)
        assertNull("grasas negativas deben descartarse", pAbs.grasas100)
        assertNull("cafeína > 5g/100g debe descartarse", pAbs.cafeina100)
        assertEquals("Producto 12345678", pAbs.nombre)

        // REGRESIÓN BUG #7: Producto con kcal100/proteina100 negativos o NaN no puede devolver valores negativos en porGramos
        val pNeg = Producto("99999999", "Roto", kcal100 = -200.0, proteina100 = Double.NaN)
        val resNeg = ComidaDominio.porGramos(pNeg, 250.0)
        assertEquals(0.0, resNeg.kcal, 1e-6)
        assertEquals(0.0, resNeg.proteina, 1e-6)
        assertEquals(0.0, ComidaDominio.porGramos(pKj, -50.0).kcal, 1e-6)
        assertEquals(0.0, ComidaDominio.porGramos(pKj, Double.POSITIVE_INFINITY).kcal, 1e-6)
    }

    // =========================================================================
    // 4. ESTRÉS BIOMECÁNICO 3D (60s @ 30 FPS + 20.000 FRAMES ADVERSARIALES)
    // =========================================================================
    @Test
    fun estresPostura3DSesentaSegundos30FpsY20000FramesAdversariales() {
        // 60 segundos a 30 fps (1.800 frames) de plancha perfecta -> ~60.0 s acumulados
        val ptsPlancha = PosturaDominio.PuntosPostura(
            hombroIzq = PosturaDominio.Punto3D(0.0, 0.2, 0.0, 0.95),
            caderaIzq = PosturaDominio.Punto3D(0.5, 0.2, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(1.0, 0.2, 0.0, 0.95),
        )
        var stPlancha = PosturaDominio.EstadoPostura()
        var t = 0L
        repeat(1801) {
            stPlancha = PosturaDominio.evaluar(stPlancha, ptsPlancha, RetosDominio.EjercicioPostura.PLANCHA, t)
            t += 33L
        }
        assertTrue("Plancha de 60s debe acumular ~59.4s (fue ${stPlancha.segundosValidos})", stPlancha.segundosValidos in 58.0..60.5)
        assertTrue(stPlancha.posturaBien)

        // 60 segundos a 30 fps (1.800 frames) de flexiones continuas: 1 rep cada 2 segundos = 30 reps exactas
        var stFlex = PosturaDominio.EstadoPostura()
        t = 1000L
        for (frame in 0 until 1800) {
            val fase = (frame % 60) / 60.0 // 2 segundos por ciclo (60 frames)
            val ang = 130.0 + 35.0 * cos(fase * 2.0 * Math.PI) // 165° -> 95° -> 165°
            val rad = Math.toRadians(ang)
            val pts = PosturaDominio.PuntosPostura(
                hombroIzq = PosturaDominio.Punto3D(0.0, 0.25, 0.0, 0.95),
                codoIzq = PosturaDominio.Punto3D(0.0, 0.55, 0.0, 0.95),
                munecaIzq = PosturaDominio.Punto3D(sin(rad) * 0.30, 0.55 - cos(rad) * 0.30, 0.0, 0.95),
                caderaIzq = PosturaDominio.Punto3D(0.5, 0.25, 0.0, 0.95),
                tobilloIzq = PosturaDominio.Punto3D(1.0, 0.25, 0.0, 0.95),
            )
            stFlex = PosturaDominio.evaluar(stFlex, pts, RetosDominio.EjercicioPostura.FLEXIONES, t)
            t += 33L
        }
        assertTrue("30 ciclos completos deben contar >=29 flexiones válidas (fueron ${stFlex.validas})", stFlex.validas in 29..30)
        assertEquals(0, stFlex.invalidas)

        // 20.000 frames adversariales: NaN, Infinity, saltos de tiempo negativos/masivos, confianza 0, puntos idénticos
        val rng = Random(42L)
        val vals = doubleArrayOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, -1e9, 0.0, 0.5, 1e9)
        fun pCaos() = if (rng.nextInt(5) == 0) null else PosturaDominio.Punto3D(
            vals[rng.nextInt(vals.size)],
            vals[rng.nextInt(vals.size)],
            if (rng.nextBoolean()) vals[rng.nextInt(vals.size)] else null,
            rng.nextDouble() * 1.5 - 0.2,
        )
        val modos = RetosDominio.EjercicioPostura.entries
        var stCaos = PosturaDominio.EstadoPostura()
        repeat(20_000) { i ->
            val pts = PosturaDominio.PuntosPostura(
                cara = pCaos(), hombroIzq = pCaos(), hombroDer = pCaos(),
                codoIzq = pCaos(), codoDer = pCaos(), munecaIzq = pCaos(), munecaDer = pCaos(),
                caderaIzq = pCaos(), caderaDer = pCaos(), rodillaIzq = pCaos(), rodillaDer = pCaos(),
                tobilloIzq = pCaos(), tobilloDer = pCaos(),
            )
            val ts = if (i % 50 == 0) -100_000L else i * 33L + (if (i % 77 == 0) 999_999_999L else 0L)
            stCaos = PosturaDominio.evaluar(stCaos, pts, modos[i % modos.size], ts)
            assertTrue("segundosValidos jamás puede ser NaN/Infinito", stCaos.segundosValidos.isFinite() && stCaos.segundosValidos >= 0.0)
            assertTrue("profundidadPct en [0, 100]", stCaos.profundidadPct in 0..100)
        }
    }

    // =========================================================================
    // 5. ESTRÉS MASIVO DE VOLUMEN, CONCURRENCIA Y SEGURIDAD DE COPIAS / CSV
    // =========================================================================
    @Test
    fun estresMasivoMultiAnioConcurrenciaYSeguridadCopiasYExport() {
        val perfil = Perfil(altaCompleta = true, nombre = "Usuario Extremo", alturaCm = 180.0)
        val base = LocalDate.parse("2025-01-01")
        val sesiones = (1..200).map { i ->
            val fecha = base.plusDays(i.toLong() * 3).toString()
            Sesion(
                id = i.toLong(),
                fecha = fecha,
                letra = "A",
                nombre = "Sesión $i",
                inicio = 1_735_689_600_000L + i * 259_200_000L,
                fin = 1_735_689_600_000L + i * 259_200_000L + 3_000_000L,
                estado = "hecha",
                ejercicios = (1..6).map { eIdx ->
                    EjercicioSesion(
                        uid = "u-$i-$eIdx",
                        ejercicio = ejercicios[eIdx * 5].id,
                        estado = "hecho",
                        registro = "peso",
                        series = (1..4).map { n ->
                            Serie(n, peso = 50.0 + (i % 30) * 2.5, reps = 8 + (n % 3), rpe = 8.0, hecha = true, record = (n == 1 && i % 10 == 0))
                        },
                    )
                },
            )
        }
        val comidas = (1..2000).map { i ->
            Comida(
                id = i.toLong(),
                fecha = base.plusDays((i / 4).toLong()).toString(),
                hora = "%02d:00".format(8 + (i % 4) * 4),
                franja = ComidaDominio.FRANJAS[i % 4],
                nombre = if (i % 100 == 0) "=HYPERLINK(\"http://evil\",\"click\")" else "Comida #$i",
                kcal = 450.0 + (i % 300),
                proteina = 30.0 + (i % 25),
            )
        }
        val mediciones = (1..500).map { i ->
            Medicion(
                id = i.toLong(),
                fecha = base.plusDays(i.toLong()).toString(),
                pesoKg = 82.0 - i * 0.01,
                perimetros = Perimetros(cintura = 86.0 - i * 0.005, cuello = 38.0),
            )
        }

        // Benchmark de tendencias + exportación CSV/JSON sobre 4.800 series + 2.000 comidas + 500 mediciones
        val t0 = System.nanoTime()
        assertEquals(6, TendenciasDominio.ejerciciosHechos(sesiones).size)
        assertTrue(TendenciasDominio.logros(sesiones).isNotEmpty())
        assertNotNull(TendenciasDominio.tendenciaPeso(mediciones, base.plusDays(500).toString()).kgSemana)

        val csvE = ExportarLigero.csvEntrenos(sesiones) { porId[it]?.nombre ?: it }
        val csvC = ExportarLigero.csvComidas(comidas)
        val csvM = ExportarLigero.csvMedidas(mediciones)
        val jsonL = ExportarLigero.jsonLigero(
            ExportarLigero.PaqueteLigeroDatos(perfil, mediciones, sesiones, comidas, emptyList<PasosDia>(), emptyList<Meta>(), emptyList<IntentoReto>(), null, emptyList()),
        )
        val elapsedMs = (System.nanoTime() - t0) / 1_000_000L
        assertTrue("Exportación y analítica multi-año debe ir rápido (<5000 ms, fue ${elapsedMs} ms)", elapsedMs < 5000L)
        assertTrue(csvE.lines().size >= 4800)
        assertTrue(csvC.lines().size >= 2000)
        assertTrue(csvM.lines().size >= 500)
        assertFalse("Ninguna fórmula CSV sin neutralizar", csvC.contains(",=HYPERLINK"))
        assertTrue("La fórmula CSV debe neutralizarse con apóstrofe", csvC.contains("\"'=HYPERLINK"))
        assertTrue(jsonL.length > 500_000)

        // Corpus completo de inyección CSV
        val corpusMalicioso = listOf(
            "=1+1", "+cmd|' /C calc'!A0", "-2+3+cmd|' /C calc'!A0", "@SUM(1+1)",
            "\t=1+1", "\r=1+1", "   =1+1", "=HYPERLINK(\"http://a\",\"b\")",
        )
        for (payload in corpusMalicioso) {
            val esc = ExportarLigero.escaparCsv(payload)
            val sinComillas = esc.removePrefix("\"")
            assertTrue("Payload CSV malicioso no neutralizado: $payload -> $esc", sinComillas.startsWith("'"))
        }

        // Backup V7 masivo con 20 fotos reales (JPEG + PNG + WebP) + rechazo de SVG disfrazado y Zip Slip
        val registros = listOf(
            RegistroTablaEntity("perfil", "yo", "2025-01-01", JsonJowyFit.encodeToString(perfil)),
        ) + sesiones.map { RegistroTablaEntity("sesiones", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) } +
            comidas.take(500).map { RegistroTablaEntity("comidas", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) }

        val fotos = LinkedHashMap<String, ByteArray>()
        repeat(10) { i -> fotos["archivos/foto-$i.jpg"] = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte(), i.toByte()) }
        repeat(5) { i -> fotos["archivos/img-$i.png"] = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, i.toByte()) }
        repeat(5) { i -> fotos["archivos/pic-$i.webp"] = "RIFF\u0000\u0000\u0000\u0000WEBP$i".toByteArray(Charsets.ISO_8859_1) }

        val copiaMasiva = GestorCopias.crearCopia(registros, fotos)
        val leidaMasiva = GestorCopias.leerCopia(copiaMasiva)
        assertEquals(registros.size, leidaMasiva.registros.size)
        assertEquals(20, leidaMasiva.archivosMedia.size)

        // Manipulación de ZIP: SVG disfrazado de .jpg y ruta Zip Slip ../evil.txt deben descartarse en silencio
        val zipHostil = ByteArrayOutputStream().apply {
            ZipOutputStream(this).use { zos ->
                zos.putNextEntry(ZipEntry("datos.json"))
                zos.write("""{"app":"JowyFit","version":7,"datos":{"perfil":[{"id":"yo","altaCompleta":true}]}}""".toByteArray())
                zos.closeEntry()
                zos.putNextEntry(ZipEntry("archivos/trampa.jpg"))
                zos.write("<svg onload=alert(1)></svg>".toByteArray())
                zos.closeEntry()
                zos.putNextEntry(ZipEntry("../../etc/passwd.jpg"))
                zos.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte()))
                zos.closeEntry()
            }
        }.toByteArray()
        val resHostil = GestorCopias.leerCopia(zipHostil)
        assertTrue("SVG disfrazado y Zip Slip deben ser 100% descartados", resHostil.archivosMedia.isEmpty())

        // Seguridad de cifrado: contraseña incorrecta, bit alterado en tag AES-GCM y truncado
        val copiaCif = GestorCopias.crearCopia(registros.take(20), emptyMap(), contrasena = "ClaveUltraFuerte#2026")
        assertTrue(runCatching { GestorCopias.leerCopia(copiaCif, null) }.exceptionOrNull() is GestorCopias.PideContrasena)
        assertTrue(runCatching { GestorCopias.leerCopia(copiaCif, "OtraClave") }.exceptionOrNull() is CifradoCopia.ContrasenaMala)
        val alterada = copiaCif.copyOf().also { it[it.lastIndex] = (it[it.lastIndex].toInt() xor 0xFF).toByte() }
        assertTrue("Un bit alterado en el tag GCM debe fallar", runCatching { GestorCopias.leerCopia(alterada, "ClaveUltraFuerte#2026") }.isFailure)
        val truncada = copiaCif.copyOf(copiaCif.size / 2)
        assertTrue("Una copia truncada debe fallar", runCatching { GestorCopias.leerCopia(truncada, "ClaveUltraFuerte#2026") }.isFailure)

        // Concurrencia: 16 hilos simultáneos leyendo/creando copias y ejecutando generador de rutinas
        val pool = Executors.newFixedThreadPool(16)
        try {
            val tareas = (1..16).map { hilo ->
                Callable {
                    val c = GestorCopias.leerCopia(copiaMasiva)
                    assertEquals(registros.size, c.registros.size)
                    val p = Perfil(altaCompleta = true, diasFijos = listOf(0, 2, 4), objetivo = if (hilo % 2 == 0) "fuerza" else "salud")
                    val r = GeneradorRutina.generar(hilo.toLong(), p, null, ejercicios)
                    assertEquals(3, r.dias.count { !it.opcional })
                    assertEquals(4, r.dias.size)
                    true
                }
            }
            val resultados = pool.invokeAll(tareas).map { it.get() }
            assertEquals(16, resultados.count { it })
        } finally {
            pool.shutdownNow()
        }
    }
}
