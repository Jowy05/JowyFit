package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.IdiomaApp
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.catalogo.CatalogoJson
import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.Bascula
import com.jowy05.jowyfit.datos.modelo.BatidoPerfil
import com.jowy05.jowyfit.datos.modelo.BloquePlantilla
import com.jowy05.jowyfit.datos.modelo.CardioEntrada
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Dolor
import com.jowy05.jowyfit.datos.modelo.EjercicioSesion
import com.jowy05.jowyfit.datos.modelo.FotoProgreso
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
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.PlantillaEntreno
import com.jowy05.jowyfit.datos.modelo.Recolocada
import com.jowy05.jowyfit.datos.modelo.RefArchivo
import com.jowy05.jowyfit.datos.modelo.RespuestaRevision
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.datos.modelo.Tramo
import com.jowy05.jowyfit.dominio.ActualizacionDominio
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
import com.jowy05.jowyfit.ui.i18n.diasAbrev
import com.jowy05.jowyfit.ui.i18n.diasCortos
import com.jowy05.jowyfit.ui.i18n.mesesCortos
import com.jowy05.jowyfit.ui.i18n.traducir
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import java.io.File
import java.time.LocalDate
import kotlin.math.cos
import kotlin.math.sin

/**
 * Historias de usuario completas de 5 personas distintas usando JowyFit Kotlin Nativo
 * durante una semana entera (Lunes a Domingo) sobre el catálogo real de 701 ejercicios RepDB.
 */
class UserStoriesPersonasSemanaTest {

    companion object {
        private lateinit var catalogoJson: CatalogoJson
        private lateinit var catalogo: CatalogoCargado
        private lateinit var porId: Map<String, EjercicioCatalogo>

        @JvmStatic
        @BeforeClass
        fun cargarCatalogoReal() {
            val f = File("../../public/repdb/catalogo.json")
            assertTrue("Debe existir public/repdb/catalogo.json", f.exists())
            catalogoJson = JsonJowyFit.decodeFromString(f.readText())
            porId = catalogoJson.ejercicios.associateBy { it.id }
            catalogo = CatalogoCargado(
                idioma = "es",
                ejercicios = catalogoJson.ejercicios,
                porId = porId,
                musculos = catalogoJson.musculos,
                material = catalogoJson.material,
                etiquetas = catalogoJson.etiquetas,
            )
            assertTrue("El catálogo real debe tener >600 ejercicios", catalogo.ejercicios.size > 600)
        }

        private fun jpegValido(tag: String): ByteArray =
            byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte()) + tag.toByteArray()

        /** Completa todas las series de todos los ejercicios de una sesión con los datos indicados. */
        private fun completarSesionEntera(
            sesionInicial: Sesion,
            pesoBase: Double,
            rpe: Double,
            previasDe: (String) -> List<Serie> = { emptyList() },
            ahoraBase: Long = sesionInicial.inicio + 60_000L,
        ): Pair<Sesion, List<Progresion.RecordDetectado>> {
            var s = sesionInicial
            var reloj = ahoraBase
            val records = mutableListOf<Progresion.RecordDetectado>()
            var guard = 0
            while (!MotorSesion.terminada(s) && guard++ < 200) {
                val idx = MotorSesion.indiceActual(s)
                assertTrue("Debe existir ejercicio en curso o pendiente", idx >= 0)
                val ej = s.ejercicios[idx]
                val serieIdx = MotorSesion.serieActual(ej)
                assertTrue("Debe existir serie pendiente", serieIdx >= 0)
                val serieActual = ej.series[serieIdx]
                val datos = when (ej.registro) {
                    "tiempo" -> MotorSesion.DatosSerie(segundos = ej.repsMax, rpe = rpe)
                    "corporal" -> MotorSesion.DatosSerie(reps = ej.repsMax, rpe = rpe)
                    "asistido" -> MotorSesion.DatosSerie(peso = -20.0, reps = ej.repsMax, rpe = rpe)
                    "cardio" -> MotorSesion.DatosSerie(segundos = 600, km = 2.0, rpe = rpe)
                    else -> MotorSesion.DatosSerie(
                        peso = if (serieActual.calentamiento) (serieActual.peso ?: 20.0) else pesoBase,
                        reps = if (serieActual.calentamiento) (serieActual.reps ?: 8) else ej.repsMax,
                        rpe = if (serieActual.calentamiento) 5.0 else rpe,
                    )
                }
                val res = MotorSesion.apuntarSerie(s, idx, datos, previasDe(ej.ejercicio), reloj)
                assertNotNull("apuntarSerie debe devolver resultado", res)
                s = res!!.sesion
                res.record?.let { records += it }
                reloj += 90_000L
            }
            assertTrue("La sesión debe terminar limpiamente", MotorSesion.terminada(s))
            return s.copy(estado = "hecha", fin = reloj) to records
        }

        /** Genera una postura 3D válida para flexión según ángulo de codo en grados (165=arriba, 95=abajo). */
        private fun frameFlexion3D(anguloCodoDeg: Double, caderaCaida: Boolean = false): PosturaDominio.PuntosPostura {
            val rad = Math.toRadians(anguloCodoDeg)
            val hombro = PosturaDominio.Punto3D(0.0, 0.25, 0.0, 0.95)
            val codo = PosturaDominio.Punto3D(0.0, 0.55, 0.0, 0.95)
            // Vector codo->hombro = (0, -0.30). Rotamos rad desde (0, -1) para muñeca.
            val mx = sin(rad) * 0.30
            val my = 0.55 - cos(rad) * 0.30
            val muneca = PosturaDominio.Punto3D(mx, my, 0.0, 0.95)
            val caderaY = if (caderaCaida) 0.52 else 0.25
            val cadera = PosturaDominio.Punto3D(0.50, caderaY, 0.0, 0.95)
            val tobillo = PosturaDominio.Punto3D(1.00, 0.25, 0.0, 0.95)
            return PosturaDominio.PuntosPostura(
                cara = PosturaDominio.Punto3D(-0.15, 0.20, 0.0, 0.9),
                hombroIzq = hombro, codoIzq = codo, munecaIzq = muneca,
                hombroDer = hombro, codoDer = codo, munecaDer = muneca,
                caderaIzq = cadera, caderaDer = cadera,
                tobilloIzq = tobillo, tobilloDer = tobillo,
            )
        }

        /** Genera una postura 3D válida para sentadilla según ángulo de rodilla (170=arriba, 100=abajo). */
        private fun frameSentadilla3D(anguloRodillaDeg: Double, espaldaDoblada: Boolean = false): PosturaDominio.PuntosPostura {
            val rad = Math.toRadians(anguloRodillaDeg)
            val cadera = PosturaDominio.Punto3D(0.0, 0.95, 0.0, 0.95)
            val rodilla = PosturaDominio.Punto3D(0.0, 1.35, 0.0, 0.95)
            val tx = sin(rad) * 0.40
            val ty = 1.35 - cos(rad) * 0.40
            val tobillo = PosturaDominio.Punto3D(tx, ty, 0.0, 0.95)
            val hombro = if (espaldaDoblada) PosturaDominio.Punto3D(0.45, 0.88, 0.0, 0.95)
            else PosturaDominio.Punto3D(0.05, 0.50, 0.0, 0.95)
            return PosturaDominio.PuntosPostura(
                cara = PosturaDominio.Punto3D(hombro.x, hombro.y - 0.15, 0.0, 0.9),
                hombroIzq = hombro.copy(x = hombro.x - 0.15),
                hombroDer = hombro.copy(x = hombro.x + 0.15),
                caderaIzq = cadera.copy(x = -0.14),
                caderaDer = cadera.copy(x = 0.14),
                rodillaIzq = rodilla.copy(x = -0.15),
                rodillaDer = rodilla.copy(x = 0.15),
                tobilloIzq = tobillo.copy(x = tx - 0.15),
                tobilloDer = tobillo.copy(x = tx + 0.15),
            )
        }
    }

    // =========================================================================
    // PERSONA 1 · MARCOS (28 años, hombre, Recomposición, intermedio, 3+1 días,
    // duerme poco, diabetes + asma, gimnasio completo, todas las opciones clave)
    // =========================================================================
    @Test
    fun persona1_marcosSemanaCompletaRecomposicionSuenoYCopiaCifrada() {
        val gym = Gimnasio(
            id = 1L,
            nombre = "Gym Comercial",
            material = PesosYDiscos.GRUPOS_MATERIAL.flatMap { it.claves },
            mancuernas = listOf(Tramo(2.0, 10.0, 2.0), Tramo(12.5, 45.0, 2.5)),
            discos = listOf(1.25, 2.5, 5.0, 10.0, 15.0, 20.0),
            barraKg = 20.0,
        )
        val perfil = Perfil(
            altaCompleta = true,
            creado = "2026-11-23T07:00:00Z",
            nombre = "Marcos",
            nacimiento = "1998-06-15",
            sexo = "hombre",
            alturaCm = 178.0,
            objetivo = "recomposicion",
            nivel = "intermedio",
            diasFijos = listOf(0, 2, 4), // L, X, V
            diasOpcionales = listOf(5),  // S
            sueno = "poco",
            condicionesSalud = listOf("diabetes", "asma"),
            superseries = true,
            core = true,
            minutosNormal = 55,
            minutosCorta = 35,
            pasosObjetivo = 9000,
            suplementos = listOf("Creatina", "Batido de proteína"),
            batido = BatidoPerfil(proteina = 25.0, kcal = 125.0),
        )

        // 1) Calibración + definitiva: sueno="poco" impone tope RPE <= 7.5 y lo explica en porque
        val rutCal = GeneradorRutina.generar(1L, perfil, gym, catalogo.ejercicios, calibracion = true)
        assertTrue(rutCal.calibracion)
        assertTrue(rutCal.dias.flatMap { it.bloques }.all { it.rpe <= 7.0 })

        val rutina = GeneradorRutina.generar(2L, perfil, gym, catalogo.ejercicios, calibracion = false).copy(creada = "2026-11-23T07:05:00Z")
        assertEquals(3, rutina.dias.count { !it.opcional })
        assertEquals(1, rutina.dias.count { it.opcional })
        assertTrue("Con sueño='poco', todos los bloques deben tener RPE <= 7.5", rutina.dias.flatMap { it.bloques }.all { it.rpe <= 7.5 })
        assertTrue(rutina.porque.any { "7,5" in it })
        assertTrue(rutina.porque.any { "diabetes" in it.lowercase() })

        val sesiones = mutableListOf<Sesion>()
        val comidas = mutableListOf<Comida>()
        val mediciones = mutableListOf<Medicion>()
        val pasos = mutableListOf<PasosDia>()
        val retos = mutableListOf<IntentoReto>()
        val plantillasComida = mutableListOf(
            Plantilla(1L, "Pollo con arroz", 650.0, 52.0, franja = "comida", tipo = "comida", usos = 5),
            Plantilla(2L, "Café solo", 5.0, 0.0, cafeina = 90.0, franja = "desayuno", tipo = "bebida", usos = 12),
        )
        assertEquals("Café solo", ComidaDominio.ordenarPlantillas(plantillasComida).first().nombre)

        // === LUNES 2026-11-23: Entreno A con calentamiento, discos exactos, Ocupado, editarSerieHecha ===
        mediciones += Medicion(1L, "2026-11-23T07:30", pesoKg = 80.4, perimetros = Perimetros(cintura = 86.0, cuello = 38.5))
        val objEner = CalculosDominio.calcularObjetivos(perfil, 80.4, hoy = LocalDate.parse("2026-11-23"))
        assertEquals(-200, objEner.ajuste)
        assertTrue(objEner.kcal >= objEner.basal)
        assertTrue(CalculosDominio.basalHastaAhora(objEner.basal, 720) in (objEner.basal / 2 - 2)..(objEner.basal / 2 + 2))

        val diaA = rutina.dias[0]
        var sesLun = MotorSesion.crearSesion(1L, diaA, rutina.id, gym.id, "normal", ahora = 1_763_884_800_000L, fechaIso = "2026-11-23")
        // Calculadora de discos exacta para 82.5 kg con barra 20 kg
        val discos = PesosYDiscos.discosPorLado(82.5, gym.barraKg, gym.discos)
        assertEquals(listOf(20.0, 10.0, 1.25), discos)
        // Añadir calentamiento al 1er ejercicio y comprobar que 1ª serie de calentamiento da 45 s descanso y NO cambia de superserie
        val listaP = PesosYDiscos.pesosPara(porId[sesLun.ejercicios[0].ejercicio]?.material, sesLun.ejercicios[0].registro, gym)
        val cals = PesosYDiscos.calentamiento(80.0, listaP, minimo = 20.0)
        assertTrue(cals.size >= 2)
        sesLun = MotorSesion.conCalentamiento(sesLun, 0, cals)
        val rCal = MotorSesion.apuntarSerie(sesLun, 0, MotorSesion.DatosSerie(peso = cals[0].peso, reps = cals[0].reps, rpe = 5.0), emptyList(), 1_763_884_860_000L)!!
        assertEquals(MotorSesion.DESCANSO_CALENTAMIENTO, rCal.descansoSeg)
        assertNull("Un calentamiento jamás cuenta como récord", rCal.record)
        sesLun = rCal.sesion
        assertEquals("El calentamiento mantiene el foco en el ejercicio 0", 0, MotorSesion.indiceActual(sesLun))

        // Ocupado: sustituir el 2º ejercicio por su alternativa o por otro del catálogo
        if (sesLun.ejercicios.size >= 2) {
            val altId = diaA.bloques[1].alternativas.firstOrNull() ?: "dumbbell-bench-press"
            sesLun = MotorSesion.sustituir(sesLun, 1, altId, "ocupado", 25.0, 10, PesosYDiscos.tipoRegistro(porId[altId]!!))
            assertEquals("ocupado", sesLun.ejercicios[1].motivo)
            assertEquals(altId, sesLun.ejercicios[1].ejercicio)
        }
        val (sesLunFin, _) = completarSesionEntera(sesLun, pesoBase = 60.0, rpe = 7.5)
        // Editar una serie ya hecha (corregir peso anotado mal)
        val idxSerieTrabajo = sesLunFin.ejercicios[0].series.indexOfFirst { !it.calentamiento && it.hecha }
        val sesLunEditada = MotorSesion.editarSerieHecha(sesLunFin, 0, idxSerieTrabajo, peso = 62.5, reps = 10, segundos = null)
        assertEquals(62.5, sesLunEditada.ejercicios[0].series[idxSerieTrabajo].peso!!, 1e-6)
        sesiones += sesLunEditada

        // Comidas Lunes: franja automática + OFF + bloqueo píxel espía + batido suplemento + cafeína
        assertEquals("desayuno", ComidaDominio.franjaPorHora("08:15"))
        assertEquals("comida", ComidaDominio.franjaPorHora("14:00"))
        assertEquals("merienda", ComidaDominio.franjaPorHora("17:30"))
        assertEquals("cena", ComidaDominio.franjaPorHora("21:15"))

        val offJson = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name_es": "Yogur griego natural",
                "brands": "Hacendado, Mercadona",
                "image_front_small_url": "https://evil-tracker.com/pixel.png",
                "image_front_url": "https://images.openfoodfacts.org/images/products/848/000/020/1234/front_es.jpg",
                "serving_quantity": 125,
                "nutriments": {
                  "energy-kcal_100g": 62,
                  "proteins_100g": 10.0,
                  "carbohydrates_100g": 4.0,
                  "fat_100g": 0.4,
                  "sugars_100g": 4.0,
                  "salt_100g": 0.1
                }
              }
            }
            """.trimIndent(),
        ).jsonObject
        val prodYogur = ComidaDominio.leerOFF("8480000201234", offJson, "2026-11-23T08:20:00Z")
        assertNotNull(prodYogur)
        assertEquals("https://images.openfoodfacts.org/images/products/848/000/020/1234/front_es.jpg", prodYogur!!.imagen)
        val porcionYogur = ComidaDominio.porRacion(prodYogur)
        assertEquals("racion", porcionYogur.base)
        assertEquals(78.0, porcionYogur.kcal, 1.0)
        val yogur200g = ComidaDominio.porGramos(prodYogur, 200.0)
        assertEquals(124.0, yogur200g.kcal, 1.0)
        assertEquals(20.0, yogur200g.proteina, 0.5)

        val (notaKcal, notaProt) = ComidaDominio.notaPorTamano("abundante", "comida")
        assertEquals(900, notaKcal)
        assertEquals(38, notaProt)
        val picoteoMed = ComidaDominio.conRacion(400.0, 8.0, racion = "N", tipo = "picoteo")
        assertEquals(200.0, picoteoMed.kcal, 1e-6) // picoteo Normal = mitad (0.5)

        assertTrue(ComidaDominio.esBatido("Batido de proteína"))
        assertEquals("3-5 g", ComidaDominio.dosisDe(null, "Creatina"))
        assertEquals(125.0, ComidaDominio.kcalBatido(25.0), 1e-6)

        comidas += Comida(1L, "2026-11-23", "08:15", "desayuno", "Café solo", 5.0, 0.0, cafeina = 90.0, tipo = "bebida", plantillaId = 2L)
        comidas += Comida(2L, "2026-11-23", "08:20", "desayuno", prodYogur.nombre, yogur200g.kcal, yogur200g.proteina, codigo = prodYogur.codigo)
        comidas += Comida(3L, "2026-11-23", "14:00", "comida", "Pollo con arroz", 650.0, 52.0, plantillaId = 1L)
        comidas += Comida(4L, "2026-11-23", "17:30", "merienda", "Batido de proteína", 125.0, 25.0, suplemento = "Batido de proteína")
        comidas += Comida(5L, "2026-11-23", "21:00", "cena", "Merluza con boniato", 540.0, 46.0)
        assertFalse("El batido automático no debe confundirse con batido a mano", ComidaDominio.batidoAMano(comidas))

        // Avisos de cafeína (OK, WARN por >75 %, WARN por hora, BAD por superar límite)
        assertEquals(ComidaDominio.TonoCafeina.OK, ComidaDominio.avisoCafeina(90, 400, "16:00", "09:00").tono)
        assertEquals(ComidaDominio.TonoCafeina.WARN, ComidaDominio.avisoCafeina(320, 400, "16:00", "13:00").tono)
        assertEquals(ComidaDominio.TonoCafeina.WARN, ComidaDominio.avisoCafeina(90, 400, "16:00", "17:00").tono)
        assertEquals(ComidaDominio.TonoCafeina.BAD, ComidaDominio.avisoCafeina(450, 400, "16:00", "11:00").tono)

        pasos += PasosDia("2026-11-23", 9600, "hc", troteKm = 2.0, cardio = listOf(CardioEntrada("bici", 20)))
        assertTrue(CalculosDominio.kcalPasos(9600, 80.4, 178.0, troteKm = 2.0) > 300)

        // Meta de dominadas con 2 hitos y borrado del erróneo
        var metaDom = Meta(id = 1L, tipo = "dominadas", titulo = "12 dominadas estrictas", objetivo = 12.0, unidad = "reps")
        metaDom = MetasDominio.registrarAvance(metaDom, 6.0, "2026-11-23", "Sin kipping")
        metaDom = MetasDominio.registrarAvance(metaDom, 99.0, "2026-11-23", "Error de dedo")
        assertEquals(2, metaDom.historial!!.size)
        metaDom = MetasDominio.borrarHito(metaDom, 1)
        assertEquals(6.0, metaDom.actual!!, 1e-6)

        // === MARTES 2026-11-24: Descanso, repetir ayer, recientes/escaneadosSueltos y reto flexiones 3D ===
        val deAyerDes = ComidaDominio.deAyer(comidas, "2026-11-23", "desayuno")
        assertEquals(2, deAyerDes.size)
        deAyerDes.forEachIndexed { idx, c -> comidas += c.copy(id = 6L + idx, fecha = "2026-11-24") }
        comidas += Comida(8L, "2026-11-24", "17:00", "merienda", "Patatas bolsa", 220.0, 3.0, tipo = "picoteo", racion = "N")
        comidas += Comida(9L, "2026-11-24", "17:10", "merienda", "Bebida energética", 110.0, 0.0, cafeina = 160.0, tipo = "bebida")
        val rec = ComidaDominio.recientes(comidas, "2026-11-24", plantillasComida)
        assertTrue("Merluza con boniato debe aparecer en recientes", rec.any { it.nombre == "Merluza con boniato" })
        assertEquals(1, ComidaDominio.escaneadosSueltos(listOf(prodYogur), plantillasComida).size)

        // Reto 3D flexiones (5 reps válidas)
        var estFlex = PosturaDominio.EstadoPostura()
        var tMs = 1000L
        repeat(5) {
            estFlex = PosturaDominio.evaluar(estFlex, frameFlexion3D(165.0), RetosDominio.EjercicioPostura.FLEXIONES, tMs); tMs += 200
            estFlex = PosturaDominio.evaluar(estFlex, frameFlexion3D(125.0), RetosDominio.EjercicioPostura.FLEXIONES, tMs); tMs += 200
            estFlex = PosturaDominio.evaluar(estFlex, frameFlexion3D(95.0), RetosDominio.EjercicioPostura.FLEXIONES, tMs); tMs += 200
            estFlex = PosturaDominio.evaluar(estFlex, frameFlexion3D(165.0), RetosDominio.EjercicioPostura.FLEXIONES, tMs); tMs += 400
        }
        assertEquals(5, estFlex.validas)
        assertEquals(0, estFlex.invalidas)
        retos += IntentoReto(1L, "2026-11-24", "flexiones-60", valor = 32, duracionS = 60, modo = "camara", record = true)
        pasos += PasosDia("2026-11-24", 10200, "hc")

        // === MIÉRCOLES 2026-11-25: Entreno B normal + nuevo pesaje ===
        mediciones += Medicion(2L, "2026-11-25T07:30", pesoKg = 80.1)
        val (sesMie, _) = completarSesionEntera(
            MotorSesion.crearSesion(2L, rutina.dias[1], rutina.id, gym.id, "normal", ahora = 1_764_057_600_000L, fechaIso = "2026-11-25"),
            pesoBase = 65.0, rpe = 7.5,
        )
        sesiones += sesMie
        retos += IntentoReto(2L, "2026-11-25", "plancha-max", valor = 90, duracionS = 90, modo = "camara", record = true)

        // === JUEVES 2026-11-26: Crear PlantillaEntreno libre + lanzarla ===
        val plantillaLibre = PlantillaEntreno(
            id = "pl-brazo-express",
            nombre = "Brazos express",
            ejercicios = listOf(
                BloquePlantilla("bicep-curl", 3, 10, 14, 60, "mancuerna"),
                BloquePlantilla("tricep-pushdown", 3, 10, 14, 60, "peso"),
            ),
            creado = "2026-11-26",
        )
        var sesJue = MotorSesion.crearSesionDesdePlantilla(3L, plantillaLibre, gym.id, ahora = 1_764_144_000_000L, fechaIso = "2026-11-26")
        val ejExtra = porId["pull-up"] ?: porId.values.first { it.id.contains("pull-up") && !it.id.contains("assisted") }
        sesJue = MotorSesion.anadirEjercicioASesion(sesJue, GeneradorRutina.bloqueParaEjercicio(ejExtra).copy(repsMin = 8, repsMax = 8))
        val (sesJueFin, _) = completarSesionEntera(sesJue, pesoBase = 14.0, rpe = 7.5)
        sesiones += sesJueFin
        // Al hacer 8 dominadas estrictas en la sesión libre, la meta de dominadas sube automáticamente a 8!
        val autoDom = MetasDominio.valorActual(metaDom, mediciones, sesiones, perfil, "2026-11-26") { catalogo.nombreEjercicio(it) }
        assertEquals(8.0, autoDom!!, 1e-6)

        // === VIERNES 2026-11-27 & SÁBADO 2026-11-28: Entreno C + Sesión opcional S ===
        mediciones += Medicion(3L, "2026-11-28T07:30", pesoKg = 79.8, perimetros = Perimetros(cintura = 85.2, cuello = 38.5))
        val (sesVie, _) = completarSesionEntera(
            MotorSesion.crearSesion(4L, rutina.dias[2], rutina.id, gym.id, "normal", ahora = 1_764_230_400_000L, fechaIso = "2026-11-27"),
            pesoBase = 62.5, rpe = 7.5,
        )
        sesiones += sesVie
        val (sesSab, _) = completarSesionEntera(
            MotorSesion.crearSesion(5L, rutina.dias[3], rutina.id, gym.id, "corta", ahora = 1_764_316_800_000L, fechaIso = "2026-11-28"),
            pesoBase = 20.0, rpe = 7.0,
        )
        sesiones += sesSab

        // === DOMINGO 2026-11-29: Resumen semanal + picoteo + exportación + copia cifrada V7 con foto binaria ===
        val semana = CalculosDominio.estadoSemana(rutina, sesiones, "2026-11-29")
        assertEquals(5, semana.count { it.estado == CalculosDominio.EstadoDiaTipo.HECHO })
        assertTrue(CalculosDominio.tarjetaHoy(rutina, semana, "2026-11-29", null) is CalculosDominio.TarjetaHoyEstado.Descanso)

        val diasSem = CalculosDominio.semanaDe("2026-11-29").toSet()
        val picSem = ComidaDominio.picoteoDeSemana(comidas, diasSem)
        assertEquals(1, picSem.dias)
        assertEquals(1, picSem.energeticas)

        val foto = FotoProgreso(1L, "2026-11-29", "frente", RefArchivo("archivos/marcos-frente.jpg"))
        val registros = listOf(
            RegistroTablaEntity("perfil", "yo", "2026-11-23", JsonJowyFit.encodeToString(perfil)),
            RegistroTablaEntity("ajustes", "app", "", JsonJowyFit.encodeToString(Ajustes(entrenosASalud = true, entrenosLibres = listOf(plantillaLibre)))),
            RegistroTablaEntity("gimnasios", "1", "", JsonJowyFit.encodeToString(gym)),
            RegistroTablaEntity("rutinas", "2", "2026-11-23", JsonJowyFit.encodeToString(rutina)),
            RegistroTablaEntity("metas", "1", "", JsonJowyFit.encodeToString(metaDom)),
            RegistroTablaEntity("fotos", "1", "2026-11-29", JsonJowyFit.encodeToString(foto)),
        ) + sesiones.map { RegistroTablaEntity("sesiones", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) } +
            comidas.map { RegistroTablaEntity("comidas", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) } +
            mediciones.map { RegistroTablaEntity("mediciones", it.id.toString(), it.fecha.take(10), JsonJowyFit.encodeToString(it)) } +
            pasos.map { RegistroTablaEntity("pasos", it.fecha, it.fecha, JsonJowyFit.encodeToString(it)) } +
            retos.map { RegistroTablaEntity("retos", it.id.toString(), it.fecha, JsonJowyFit.encodeToString(it)) }

        val bytesFoto = jpegValido("MARCOS-SEMANA-1")
        val cifrada = GestorCopias.crearCopia(registros, mapOf("archivos/marcos-frente.jpg" to bytesFoto), contrasena = "Marcos!2026#Seguro")
        assertTrue(CifradoCopia.esCifrada(cifrada))
        val leida = GestorCopias.leerCopia(cifrada, contrasena = "Marcos!2026#Seguro")
        assertEquals(registros.size, leida.registros.size)
        assertTrue(bytesFoto.contentEquals(leida.archivosMedia["archivos/marcos-frente.jpg"]))
        // entrenosASalud debe restaurarse SIEMPRE apagado por seguridad del dispositivo
        val ajRestaurado = JsonJowyFit.decodeFromString<Ajustes>(leida.registros.first { it.tabla == "ajustes" }.payloadJson)
        assertEquals(false, ajRestaurado.entrenosASalud)

        val csvE = ExportarLigero.csvEntrenos(sesiones) { catalogo.nombreEjercicio(it) }
        val jsonL = ExportarLigero.jsonLigero(ExportarLigero.PaqueteLigeroDatos(perfil, mediciones, sesiones, comidas, pasos, listOf(metaDom), retos, rutina, listOf(gym)))
        assertTrue(csvE.startsWith("\uFEFF"))
        assertTrue(jsonL.contains("\"Marcos\""))
    }

    // =========================================================================
    // PERSONA 2 · CARMEN (66 años, mujer, Salud, Modo Mayor + osteoporosis +
    // prótesis + tensión alta + dolor hombros regular, 2 días, mancuernas casa)
    // =========================================================================
    @Test
    fun persona2_carmenModoMayorCondicionesSaludMetaBajadaYRevision() {
        val gymCasa = Gimnasio(
            id = 1L,
            nombre = "Salón de casa",
            material = listOf("dumbbell", "flat_bench", "resistance_band"),
            mancuernas = listOf(Tramo(1.0, 10.0, 1.0)),
        )
        var perfil = Perfil(
            altaCompleta = true,
            creado = "2026-11-23T09:00:00Z",
            nombre = "Carmen",
            nacimiento = "1960-03-20",
            sexo = "mujer",
            alturaCm = 162.0,
            objetivo = "salud",
            nivel = "empiezo",
            diasFijos = listOf(1, 4), // Martes y Viernes
            diasOpcionales = emptyList(),
            modoMayor = ModoMayor(activo = true),
            condicionesSalud = listOf("osteoporosis", "protesis", "tension"),
            dolores = listOf(Dolor("hombros", cuanto = "regular", cuando = "fuerza", desde = "semanas", inicio = "2026-11-01")),
            superseries = true, // modoMayor debe ignorar superseries
            core = true,
            minutosNormal = 45,
            minutosCorta = 30,
            pasosObjetivo = 6500,
        )

        var rutina = GeneradorRutina.generar(10L, perfil, gymCasa, catalogo.ejercicios).copy(creada = "2026-11-23T09:05:00Z")
        val restInicial = SaludYRevisionDominio.restricciones(perfil)
        assertEquals(6, rutina.equilibrio)
        assertEquals(2, rutina.dias.size)
        assertEquals(8.0, restInicial.rpeMax!!, 1e-6)
        assertEquals(30, restInicial.maxIsometrico)

        // Verificación estricta de seguridad clínica en cada bloque generado
        for (dia in rutina.dias) {
            assertTrue("Día ${dia.letra} debe tener bloques", dia.bloques.isNotEmpty())
            for (b in dia.bloques) {
                val ej = porId.getValue(b.ejercicio)
                assertNull("Modo mayor prohíbe superseries", b.superserie)
                assertTrue("Modo mayor impone descanso >= 120s (fue ${b.descanso})", b.descanso >= 120)
                assertNotEquals("Modo mayor excluye dificultad advanced", "advanced", ej.dificultad)
                assertNull("Ejercicio ${ej.id} viola restricciones de salud: ${restInicial.fuera(ej)}", restInicial.fuera(ej))
                assertTrue("Tensión alta limita RPE <= 8.0", b.rpe <= 8.0)
                if (b.registro == "tiempo") {
                    assertTrue("Tensión alta limita isométricos a <= 30s (fue ${b.repsMax})", b.repsMax <= 30)
                } else {
                    assertTrue("Modo mayor mantiene repsMin >= 8", b.repsMin >= 8)
                    assertTrue("Modo mayor mantiene repsMax >= 12", b.repsMax >= 12)
                }
            }
        }

        // Fórmula femenina US Navy (requiere cadera!) + grasaActual por medidas
        val mediciones = mutableListOf(
            Medicion(1L, "2026-11-23T09:00", pesoKg = 68.5, perimetros = Perimetros(cintura = 86.0, cuello = 33.0, cadera = 102.0)),
        )
        val grasaF = TendenciasDominio.grasaActual(mediciones, perfil, "2026-11-23")
        assertNotNull("Fórmula femenina US Navy debe calcular grasa con cadera", grasaF)
        assertEquals("medidas", grasaF!!.fuente)
        assertTrue(grasaF.valor in 20.0..48.0)

        // REGRESIÓN BUG #2: Meta de bajada de peso creada sin `inicio` NO puede marcarse conseguida al bajar un poco
        var metaPeso = Meta(id = 1L, tipo = "peso", titulo = "Llegar a 64 kg", objetivo = 64.0, unidad = "kg")
        metaPeso = MetasDominio.registrarAvance(metaPeso, 68.2, "2026-11-23", "Inicio semana")
        assertEquals("inicio debe sembrarse al primer valor (68.2), nunca a 0.0", 68.2, metaPeso.inicio!!, 1e-6)
        val stInicial = MetasDominio.estado(metaPeso, 68.2)
        assertFalse("68.2 kg NO ha alcanzado la meta de 64.0 kg", stInicial.conseguida)
        assertEquals(4.2, stInicial.falta!!, 0.01)
        assertEquals(0.0, stInicial.progreso, 0.01)

        // Martes y Viernes: Carmen completa sus 2 entrenos suaves y baja a 67.6 kg el domingo
        val sesiones = mutableListOf<Sesion>()
        val (sesMar, _) = completarSesionEntera(
            MotorSesion.crearSesion(1L, rutina.dias[0], rutina.id, gymCasa.id, "normal", ahora = 1_763_971_200_000L, fechaIso = "2026-11-24"),
            pesoBase = 4.0, rpe = 7.0,
        )
        sesiones += sesMar
        mediciones += Medicion(2L, "2026-11-26T09:00", pesoKg = 68.0)
        val (sesVie, _) = completarSesionEntera(
            MotorSesion.crearSesion(2L, rutina.dias[1], rutina.id, gymCasa.id, "normal", ahora = 1_764_230_400_000L, fechaIso = "2026-11-27"),
            pesoBase = 4.0, rpe = 7.0,
        )
        sesiones += sesVie
        mediciones += Medicion(3L, "2026-11-29T09:00", pesoKg = 67.6)

        val actualPesoDom = MetasDominio.valorActual(metaPeso, mediciones, sesiones, perfil, "2026-11-29")
        assertEquals(67.6, actualPesoDom!!, 1e-6)
        val stDom = MetasDominio.estado(metaPeso, actualPesoDom)
        assertFalse(stDom.conseguida)
        assertTrue("El progreso debe avanzar al bajar de 68.2 a 67.6", stDom.progreso > 0.1)
        assertTrue("Al llegar a 64.0 sí se consigue", MetasDominio.estado(metaPeso, 64.0).conseguida)

        // Revisión semanal: nueva molestia lumbar que empeora -> sustitución respetando osteoporosis/prótesis/tensión y marcas
        val marcasCarmen = mapOf(
            "glute-bridge" to MarcaEjercicio("glute-bridge", odiado = true),
            "hip-thrust" to MarcaEjercicio("hip-thrust", duele = true),
        )
        val rutAntesRev = rutina
        perfil = perfil.copy(dolores = perfil.dolores.orEmpty() + Dolor("lumbar", "mucho", "fuerza", "dias", "2026-11-29"))
        val restPost = SaludYRevisionDominio.restricciones(perfil)
        val cambios = SaludYRevisionDominio.cambiosRevision(rutina, perfil, listOf("lumbar"), emptyList(), emptyList(), porId, gymCasa, marcasCarmen)
        val rutPost = SaludYRevisionDominio.aplicarCambios(rutina, cambios)
        for (c in cambios) {
            if (c.antes.ejercicio != c.despues.ejercicio) {
                val sust = porId.getValue(c.despues.ejercicio)
                assertNull("La sustitución no puede violar salud de Carmen", restPost.fuera(sust))
                assertTrue(marcasCarmen[sust.id]?.odiado != true && marcasCarmen[sust.id]?.duele != true)
            }
            assertTrue(SaludYRevisionDominio.textoCambio(c) { catalogo.nombreEjercicio(it) }.isNotBlank())
        }
        // Deshacer vuelve bit a bit a la rutina original
        assertEquals(rutAntesRev, SaludYRevisionDominio.aplicarCambios(rutPost, cambios, deshacer = true))
        // Vuelta progresiva ("mejor" -> cargaPct 0.9 -> "ya" -> normal exacto)
        if (cambios.isNotEmpty()) {
            val vueltaParcial = SaludYRevisionDominio.cambiosRevision(rutPost, perfil, emptyList(), listOf("lumbar" to false), cambios, porId, gymCasa, marcasCarmen)
            val rutVuelta90 = SaludYRevisionDominio.aplicarCambios(rutPost, vueltaParcial)
            assertTrue(vueltaParcial.all { it.vuelta == true && it.despues.cargaPct == SaludYRevisionDominio.CARGA_VUELTA })
            val vueltaTotal = SaludYRevisionDominio.cambiosRevision(rutVuelta90, perfil.copy(dolores = emptyList()), emptyList(), listOf("lumbar" to true), cambios, porId, gymCasa, marcasCarmen)
            assertEquals(rutAntesRev, SaludYRevisionDominio.aplicarCambios(rutVuelta90, vueltaTotal))
        }
    }

    // =========================================================================
    // PERSONA 3 · SOFÍA (31 años, mujer, Perder grasa, avanzado, 5 días Torso/Pierna,
    // embarazo/posparto, barra 15 kg + fraccionales, 3 duraciones + 5 Retos + 3D)
    // =========================================================================
    @Test
    fun persona3_sofiaEmbarazoCincoDiasDuracionesYLosCincoRetos3D() {
        val gymMujer = Gimnasio(
            id = 2L,
            nombre = "Box Funcional",
            material = PesosYDiscos.MATERIAL_HABITUAL.toList() + listOf("leg_curl", "leg_extension", "seated_row_machine"),
            mancuernas = listOf(Tramo(2.0, 30.0, 2.0)),
            discos = listOf(0.5, 1.25, 2.5, 5.0, 10.0, 15.0, 20.0),
            barraKg = 15.0,
        )
        val perfil = Perfil(
            altaCompleta = true,
            creado = "2026-11-23T06:30:00Z",
            nombre = "Sofía",
            nacimiento = "1995-08-12",
            sexo = "mujer",
            alturaCm = 168.0,
            objetivo = "perder",
            nivel = "avanzado",
            diasFijos = listOf(0, 1, 2, 3, 4), // L-V (5 días Torso/Pierna)
            diasOpcionales = emptyList(),
            condicionesSalud = listOf("embarazo"),
            core = true, // embarazo debe excluir core igualmente!
            minutosNormal = 50,
            minutosCorta = 30,
        )
        val rutina = GeneradorRutina.generar(20L, perfil, gymMujer, catalogo.ejercicios).copy(creada = "2026-11-23T06:35:00Z")
        assertEquals(5, rutina.dias.size)
        assertTrue(rutina.estructura.contains("Torso / Pierna"))

        // Verificación estricta de embarazo en todos los 5 días
        for (dia in rutina.dias) {
            for (b in dia.bloques) {
                val ej = porId.getValue(b.ejercicio)
                assertTrue("Embarazo limita RPE <= 7.0 (fue ${b.rpe})", b.rpe <= 7.0)
                assertNotEquals("Embarazo excluye patrón core", "core", PesosYDiscos.patron(ej))
                assertNotEquals("Embarazo excluye olympic", "olympic", ej.categoria)
                assertNotEquals("Embarazo excluye plyometrics", "plyometrics", ej.categoria)
            }
        }

        // Discos exactos con barra de 15 kg y fraccionales de 0.5 kg (ej. 41 kg -> 13 kg/lado = 10 + 2.5 + 0.5)
        assertEquals(listOf(10.0, 2.5, 0.5), PesosYDiscos.discosPorLado(41.0, gymMujer.barraKg, gymMujer.discos))

        // Objetivos con proteína manual y déficit de perder grasa
        val objAuto = CalculosDominio.calcularObjetivos(perfil, 64.0, hoy = LocalDate.parse("2026-11-23"))
        assertEquals(-300, objAuto.ajuste)
        assertEquals(130, objAuto.proteina) // 64 * 2.0 = 128 -> múltiplo de 5 = 130
        val objManual = CalculosDominio.calcularObjetivos(perfil, 64.0, proteinaManual = 135, hoy = LocalDate.parse("2026-11-23"))
        assertEquals(135, objManual.proteina)

        // Lunes: normal, Martes: corta (omite fueraEnCorta), Miércoles: mínima (<=3 ej, <=2 series)
        val sesNormal = MotorSesion.crearSesion(1L, rutina.dias[0], rutina.id, gymMujer.id, "normal", ahora = 1_763_884_800_000L, fechaIso = "2026-11-23")
        val sesCorta = MotorSesion.crearSesion(2L, rutina.dias[1], rutina.id, gymMujer.id, "corta", ahora = 1_763_971_200_000L, fechaIso = "2026-11-24")
        val sesMinima = MotorSesion.crearSesion(3L, rutina.dias[2], rutina.id, gymMujer.id, "minima", ahora = 1_764_057_600_000L, fechaIso = "2026-11-25")

        assertTrue(sesCorta.ejercicios.none { it.fueraEnCorta == true })
        assertTrue(sesMinima.ejercicios.size <= 3)
        assertTrue(sesMinima.ejercicios.all { it.series.size <= 2 })

        // Probar saltar, irA, quitarSerie (hasta suelo de 1) y anadirSerie sobre ejercicio YA HECHO (REGRESIÓN BUG #8!)
        var sesManip = sesNormal
        // Terminar ejercicio 0
        while (sesManip.ejercicios[0].estado != "hecho") {
            val r = MotorSesion.apuntarSerie(sesManip, 0, MotorSesion.DatosSerie(peso = 30.0, reps = 10, rpe = 7.0), emptyList(), 1_763_885_000_000L)!!
            sesManip = r.sesion
        }
        assertEquals("hecho", sesManip.ejercicios[0].estado)
        // Reabrir ejercicio 0 añadiendo una serie -> SOLO 1 ejercicio debe quedar en "curso"!
        sesManip = MotorSesion.anadirSerie(sesManip, 0)
        assertEquals("Solo debe haber un ejercicio en curso tras reabrir uno hecho", 1, sesManip.ejercicios.count { it.estado == "curso" })
        assertEquals("curso", sesManip.ejercicios[0].estado)
        // Ir al último ejercicio, saltarlo, y reducir series de un ejercicio pendiente hasta 1
        sesManip = MotorSesion.irA(sesManip, sesManip.ejercicios.lastIndex)
        sesManip = MotorSesion.saltar(sesManip, sesManip.ejercicios.lastIndex)
        assertEquals("saltado", sesManip.ejercicios.last().estado)
        var sQuitar = sesCorta
        repeat(10) { sQuitar = MotorSesion.quitarSerie(sQuitar, 0) }
        assertEquals("Nunca se puede bajar de 1 serie de trabajo", 1, sQuitar.ejercicios[0].series.size)

        // Probar los 5 Retos + biomecánica 3D de sentadilla (2 válidas + 1 parcial inválida + 1 espalda doblada inválida)
        assertEquals(5, RetosDominio.RETOS.size)
        var estSent = PosturaDominio.EstadoPostura()
        var tMs = 1000L
        // 2 sentadillas válidas
        repeat(2) {
            estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(170.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 200
            estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(128.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 200
            estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(98.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 200
            estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(170.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 400
        }
        // 1 sentadilla poco profunda (baja solo a 126°, umbral abajo es 120° y parcial 131°) -> inválida
        estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(126.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 250
        estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(170.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 400
        // 1 sentadilla profunda pero con espalda doblada (>58°) -> inválida
        estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(100.0, espaldaDoblada = true), RetosDominio.EjercicioPostura.SENTADILLAS, tMs); tMs += 250
        estSent = PosturaDominio.evaluar(estSent, frameSentadilla3D(170.0), RetosDominio.EjercicioPostura.SENTADILLAS, tMs)
        assertEquals(2, estSent.validas)
        assertEquals(2, estSent.invalidas)

        // Registrar los 5 retos durante la semana con récords (incluyendo MENOS_TIEMPO)
        val retos = mutableListOf(
            IntentoReto(1L, "2026-11-23", "flexiones-60", 24, 2, 60, "camara", true),
            IntentoReto(2L, "2026-11-24", "sentadillas-60", 42, 1, 60, "camara", true),
            IntentoReto(3L, "2026-11-25", "plancha-max", 75, 0, 75, "camara", true),
            IntentoReto(4L, "2026-11-26", "flexiones-20", 38, 0, 38, "camara", true),
            IntentoReto(5L, "2026-11-27", "sentadillas-30", 44, 0, 44, "camara", true),
        )
        // Contrarreloj: un tiempo MENOR (32s < 38s) ES nuevo récord; uno mayor (41s) NO
        assertTrue(RetosDominio.esNuevoRecord(retos, "flexiones-20", 32))
        assertFalse(RetosDominio.esNuevoRecord(retos, "flexiones-20", 41))
        val prevF20 = RetosDominio.mejorMarca(retos, "flexiones-20")!!
        assertTrue(RetosDominio.textoComparativa(32, prevF20, RetosDominio.retoDe("flexiones-20")).contains("más rápido"))
        retos += IntentoReto(6L, "2026-11-28", "flexiones-20", 32, 0, 32, "camara", true)
        assertEquals(32, RetosDominio.mejorMarca(retos, "flexiones-20")?.valor)
        val rachaSof = RetosDominio.racha(retos, "2026-11-28")
        assertEquals(6, rachaSof.actual)
        assertEquals(6, rachaSof.mejor)
        assertTrue(rachaSof.hechoHoy)
    }

    // =========================================================================
    // PERSONA 4 · ÁLEX (22 años, hombre, Fuerza, avanzado, 6 días PPL, 2 gimnasios,
    // marcas favorito/duele/odiado, progresión, estancamiento, descarga 6 semanas y 7 metas)
    // =========================================================================
    @Test
    fun persona4_alexSeisDiasPplDosGimnasiosEstancamientoDescargaYMetas() {
        val gymComercial = Gimnasio(
            id = 1L, nombre = "Iron Club",
            material = PesosYDiscos.GRUPOS_MATERIAL.flatMap { it.claves },
            mancuernas = listOf(Tramo(4.0, 50.0, 2.0)),
            barraKg = 20.0,
        )
        val gymCasa = Gimnasio(
            id = 2L, nombre = "Garaje",
            material = listOf("barbell", "ez_bar", "dumbbell", "flat_bench", "pull_up_bar"),
            mancuernas = listOf(Tramo(2.5, 20.0, 2.5)),
            barraKg = 10.0,
        )
        val marcas = mapOf(
            "bench-press" to MarcaEjercicio("bench-press", favorito = true),
            "leg-press" to MarcaEjercicio("leg-press", odiado = true),
            "barbell-row" to MarcaEjercicio("barbell-row", duele = true),
        )
        val perfil = Perfil(
            altaCompleta = true,
            creado = "2026-10-01T08:00:00Z",
            nombre = "Álex",
            nacimiento = "2004-02-14",
            sexo = "hombre",
            alturaCm = 185.0,
            objetivo = "fuerza",
            nivel = "avanzado",
            preferencia = "libre",
            diasFijos = listOf(0, 1, 2, 3, 4, 5), // 6 días PPL
            diasOpcionales = emptyList(),
            zonasPrioridad = listOf("pecho", "espalda"),
            zonasMucho = listOf("pecho"),
        )
        val rut1 = GeneradorRutina.generar(30L, perfil, gymComercial, catalogo.ejercicios, marcas)
        val rut2 = GeneradorRutina.generar(31L, perfil, gymCasa, catalogo.ejercicios, marcas)
        assertEquals(6, rut1.dias.size)
        assertTrue(rut1.estructura.contains("Empuje / Tirón / Pierna"))
        val idsRut1 = rut1.dias.flatMap { it.bloques }.map { it.ejercicio }.toSet()
        assertTrue("El ejercicio favorito bench-press debe incluirse", "bench-press" in idsRut1)
        assertFalse("El ejercicio odiado leg-press nunca debe salir", "leg-press" in idsRut1)
        assertFalse("El ejercicio con duele barbell-row nunca debe salir", "barbell-row" in idsRut1)
        // Todos los ejercicios del garaje deben usar solo el material del garaje o peso corporal
        for (b in rut2.dias.flatMap { it.bloques }) {
            val mat = porId.getValue(b.ejercicio).material
            assertTrue("Ejercicio ${b.ejercicio} usa material $mat no presente en Garaje", mat == null || mat in gymCasa.material)
        }

        // Doble progresión completa (PRIMERA+conPartida -> SUBIR -> MANTENER -> BAJAR) + volumen unilateral
        val pesosBarra = PesosYDiscos.pesosPara("barbell", "peso", gymComercial)
        val obj = Progresion.ObjetivoBloque(3, 6, 8.0)
        val sPrimera = Progresion.conPartida(Progresion.sugerir(null, obj, "peso", pesosBarra), "barbell", "peso", pesosBarra)
        assertEquals(Progresion.AccionSugerencia.PRIMERA, sPrimera.accion)
        assertEquals(20.0, sPrimera.peso!!, 1e-6)
        assertTrue(sPrimera.partida)

        val sSubir = Progresion.sugerir(
            listOf(Serie(1, 100.0, 6, rpe = 8.0, hecha = true), Serie(2, 100.0, 6, rpe = 8.5, hecha = true)),
            obj, "peso", pesosBarra,
        )
        assertEquals(Progresion.AccionSugerencia.SUBIR, sSubir.accion)
        assertEquals(102.5, sSubir.peso!!, 1e-6)

        val sBajar = Progresion.sugerir(
            listOf(Serie(1, 110.0, 1, rpe = 10.0, hecha = true)),
            obj, "peso", pesosBarra,
        )
        assertEquals(Progresion.AccionSugerencia.BAJAR, sBajar.accion)
        assertEquals(107.5, sBajar.peso!!, 1e-6)

        // Volumen, 1RM y récord unilateral (izq + der sin campo reps — formato V4+)
        val serieUni = Serie(1, 20.0, izq = 8, der = 8, rpe = 8.0, hecha = true)
        assertEquals(320.0, Progresion.volumen(listOf(serieUni)), 1e-6)
        assertTrue(TendenciasDominio.mejor1RM(listOf(serieUni))!! > 24.0)
        assertNotNull(Progresion.esRecord(Serie(2, 22.0, izq = 8, der = 8, hecha = true), listOf(serieUni)))

        // Simular 6 semanas completas para comprobar estancamiento (3 ejercicios), propuestaDescarga (estancados + 6 semanas),
        // recordsPorMes, subidas, logros, seriesPorGrupo y pesoReinicio
        val historial6Sem = mutableListOf<Sesion>()
        val inicio = LocalDate.parse("2026-10-12") // Lunes 6 semanas antes del 2026-11-23
        val estancadosIds = listOf("bench-press", "squat", "deadlift")
        for (sem in 0..5) {
            val fecha = inicio.plusWeeks(sem.toLong()).toString()
            val ts = 1_760_000_000_000L + sem * 7L * 86_400_000L
            // Semana 0..1 progresa, semanas 2..5 se queda plano -> 4 sesiones planas (ref + 3 sin subir)
            val kg = if (sem == 0) 95.0 else 100.0
            val esRec = sem <= 1
            historial6Sem += Sesion(
                id = (sem + 1).toLong(),
                fecha = fecha,
                rutinaId = rut1.id,
                letra = "A",
                nombre = "Empuje",
                inicio = ts,
                fin = ts + 3_600_000L,
                estado = "hecha",
                ejercicios = estancadosIds.mapIndexed { idx, ejId ->
                    EjercicioSesion(
                        uid = "u-$sem-$idx",
                        ejercicio = ejId,
                        estado = "hecho",
                        registro = "peso",
                        series = listOf(
                            Serie(1, kg, 5, rpe = 8.5, hecha = true, record = esRec),
                            Serie(2, kg, 5, rpe = 9.0, hecha = true),
                            Serie(3, kg, 5, rpe = 9.0, hecha = true),
                        ),
                    )
                },
            )
        }
        // Añadimos una sesión con cargaPct = 0.8 (lesión) que NO debe alterar el cálculo de propuestaDescarga (REGRESIÓN BUG #4!)
        historial6Sem += Sesion(
            id = 99L, fecha = "2026-11-18", rutinaId = rut1.id, letra = "A", inicio = 1_763_450_000_000L, estado = "hecha",
            ejercicios = listOf(EjercicioSesion("u-lesion", "bench-press", estado = "hecho", registro = "peso", cargaPct = 0.8, series = listOf(Serie(1, 80.0, 5, hecha = true)))),
        )

        val est = TendenciasDominio.ejerciciosEstancados(historial6Sem)
        assertEquals(3, est.size)
        val descPorEstancados = TendenciasDominio.propuestaDescarga("2026-11-23", historial6Sem, estancadosIds, { catalogo.nombreEjercicio(it) })
        assertNotNull(descPorEstancados)
        assertEquals(3, descPorEstancados!!.estancados.size)
        // Si ya está activa semanaSuave este lunes, se suprime la propuesta
        assertNull(TendenciasDominio.propuestaDescarga("2026-11-23", historial6Sem, estancadosIds, { it }, semanaSuave = "2026-11-23"))
        // Sin ejercicios estancados en la rutina, salta por 6 semanas seguidas sin descarga
        val descPorSemanas = TendenciasDominio.propuestaDescarga("2026-11-23", historial6Sem, emptyList(), { it })
        assertNotNull(descPorSemanas)
        assertTrue(descPorSemanas!!.motivo.contains("6 semanas"))

        assertEquals(90.0, TendenciasDominio.pesoReinicio(100.0, pesosBarra), 1e-6)
        assertTrue(TendenciasDominio.subidas(historial6Sem).size >= 3)
        assertTrue(TendenciasDominio.logros(historial6Sem).isNotEmpty())
        assertEquals(6, TendenciasDominio.recordsPorMes(historial6Sem, "2026-11-23", 6).size)
        assertTrue(TendenciasDominio.evolucion(historial6Sem, "bench-press", "e1rm").size >= 6)
        val gruposSem = TendenciasDominio.seriesPorGrupo(historial6Sem, CalculosDominio.semanaDe("2026-11-16").toSet()) { id ->
            porId[id]?.let { PesosYDiscos.patron(it) }
        }
        assertTrue(gruposSem.first { it.nombre == "Pecho" }.series >= 3)

        // Los 7 tipos de Meta + prioridad en metaPrincipal
        val meds = listOf(Medicion(1L, "2026-11-23", pesoKg = 92.0, perimetros = Perimetros(cintura = 84.0, cuello = 40.0), bascula = Bascula(grasaPct = 14.5)))
        val metas = listOf(
            Meta(1L, "peso", "Subir a 95 kg", 95.0, "kg", fecha = "2027-02-01", inicio = 90.0),
            Meta(2L, "cintura", "Mantener cintura <82", 82.0, "cm", fecha = "2027-03-01", inicio = 86.0),
            Meta(3L, "grasa", "Bajar al 12 %", 12.0, "%", fecha = "2027-04-01", inicio = 16.0),
            Meta(4L, "dominadas", "15 dominadas", 15.0, "reps", fecha = "2027-01-15"),
            Meta(5L, "reps", "10 reps con 100 kg", 10.0, "reps", fecha = "2027-01-20", ejercicio = "bench-press"),
            Meta(6L, "ejercicio", "120 kg banca", 120.0, "kg", fecha = "2026-12-31", ejercicio = "bench-press"),
            Meta(7L, "libre", "Correr 10K", 10.0, "km", fecha = "2027-05-01", actual = 6.0),
        )
        val principal = MetasDominio.metaPrincipal(metas) { m -> MetasDominio.valorActual(m, meds, historial6Sem, perfil, "2026-11-23") }
        assertNotNull(principal)
        assertEquals("La meta no conseguida con fecha más temprana (2026-12-31) debe ser principal", 6L, principal!!.first.id)
        assertEquals(100.0, principal.second.actual!!, 1e-6)
    }

    // =========================================================================
    // PERSONA 5 · LEO (40 años, 1 día + Entreno libre + Recolocaciones +
    // Desempate mismo día + Multi-idioma ES/CA/EN + Actualizador + Backup real)
    // =========================================================================
    @Test
    fun persona5_leoUnDiaEntrenoLibreRecolocacionesMultiIdiomaYBackupReal() {
        val perfil = Perfil(
            altaCompleta = true,
            creado = "2026-11-23T08:00:00Z",
            nombre = "Leo",
            nacimiento = "1986-09-03",
            sexo = "hombre",
            alturaCm = 175.0,
            objetivo = "musculo",
            nivel = "vuelvo",
            diasFijos = listOf(0), // Solo Lunes
            diasOpcionales = listOf(5), // Sábado opcional
        )

        // 1) Empieza sin rutina -> SinRutina
        val semSin = CalculosDominio.estadoSemana(null, emptyList(), "2026-11-23")
        assertTrue(CalculosDominio.tarjetaHoy(null, semSin, "2026-11-23", null) is CalculosDominio.TarjetaHoyEstado.SinRutina)

        // 2) Genera 1 día + "Otra variante" evitando ejercicios previos
        val rutA = GeneradorRutina.generar(40L, perfil, null, catalogo.ejercicios).copy(creada = "2026-11-23T08:05:00Z")
        val idsA = rutA.dias[0].bloques.map { it.ejercicio }.toSet()
        val rutVariante = GeneradorRutina.generar(41L, perfil, null, catalogo.ejercicios, evitar = idsA).copy(creada = "2026-11-23T08:06:00Z")
        val idsB = rutVariante.dias[0].bloques.map { it.ejercicio }.toSet()
        assertNotEquals("Otra variante debe cambiar la selección de ejercicios", idsA, idsB)

        // 3) Estados de semana y los 6 estados de TarjetaHoy: Hoy, EnCurso, Hecho, Opcional, Descanso, Recolocada (MOVIDO/PERDIDO)
        val semLun = CalculosDominio.estadoSemana(rutA, emptyList(), "2026-11-23")
        assertTrue(CalculosDominio.tarjetaHoy(rutA, semLun, "2026-11-23", null) is CalculosDominio.TarjetaHoyEstado.Hoy)

        var sesLibre = MotorSesion.crearSesionLibre(1L, "Sesión rápida parque", null, ahora = 1_763_971_200_000L, fechaIso = "2026-11-24")
        sesLibre = MotorSesion.anadirEjercicioASesion(sesLibre, GeneradorRutina.bloqueParaEjercicio(porId["push-up"] ?: catalogo.ejercicios.first()))
        assertTrue(CalculosDominio.tarjetaHoy(rutA, semLun, "2026-11-24", sesLibre) is CalculosDominio.TarjetaHoyEstado.EnCurso)
        val (sesLibreHecha, _) = completarSesionEntera(sesLibre, pesoBase = 0.0, rpe = 7.5)

        // Lunes no entrenó: el miércoles sale PERDIDO; si lo recoloca al jueves sale MOVIDO el lunes y PLAN el jueves!
        val semPerdido = CalculosDominio.estadoSemana(rutA, listOf(sesLibreHecha), "2026-11-25")
        assertEquals(CalculosDominio.EstadoDiaTipo.PERDIDO, semPerdido[0].estado)
        assertEquals(CalculosDominio.EstadoDiaTipo.HECHO, semPerdido[1].estado)

        val recol = listOf(Recolocada(fecha = "2026-11-26", letra = "A", desde = "2026-11-23"))
        val semRecol = CalculosDominio.estadoSemana(rutA, listOf(sesLibreHecha), "2026-11-25", recol)
        assertEquals(CalculosDominio.EstadoDiaTipo.MOVIDO, semRecol[0].estado)
        assertEquals(CalculosDominio.EstadoDiaTipo.PLAN, semRecol[3].estado) // Jueves
        assertEquals(CalculosDominio.EstadoDiaTipo.OPCIONAL, semRecol[5].estado) // Sábado
        assertTrue(CalculosDominio.tarjetaHoy(rutA, semRecol, "2026-11-28", null) is CalculosDominio.TarjetaHoyEstado.Opcional)
        assertTrue(CalculosDominio.tarjetaHoy(rutA, semRecol, "2026-11-24", null) is CalculosDominio.TarjetaHoyEstado.Hecho)

        // 4) REGRESIÓN BUG #3: Múltiples mediciones con la MISMA fecha exacta desempatan por id ascendente
        val medsMismoDia = listOf(
            Medicion(id = 10L, fecha = "2026-11-23", pesoKg = 76.2),
            Medicion(id = 11L, fecha = "2026-11-23", pesoKg = 75.4),
            Medicion(id = 12L, fecha = "2026-11-29", pesoKg = 74.9),
        )
        assertEquals(75.4, TendenciasDominio.ultimoValor(medsMismoDia, { it.pesoKg }, hasta = "2026-11-23")!!.valor, 1e-6)
        assertEquals(75.4, TendenciasDominio.serieMedida(medsMismoDia) { it.pesoKg }.first().valor, 1e-6)
        assertTrue(TendenciasDominio.tendenciaPeso(medsMismoDia, "2026-11-29").kgSemana!! < 0.0)

        // 5) Catálogo multi-pose + buscador sin tildes + i18n ES/CA/EN
        val bench = porId.getValue("bench-press")
        val imgsBench = catalogo.todasImagenesAsset(bench)
        assertTrue("Un ejercicio estándar debe tener varias poses", imgsBench.size >= 2)
        assertTrue(imgsBench.all { it.second.startsWith("file:///android_asset/repdb/img/bench-press-") })
        assertTrue(catalogo.buscar("banca").isNotEmpty())
        assertEquals("Falten 12 g", traducir(IdiomaApp.CA, "Faltan {n} g", "n" to 12))
        assertEquals("12 g to go", traducir(IdiomaApp.EN, "Faltan {n} g", "n" to 12))
        for (lang in IdiomaApp.entries) {
            assertEquals(7, diasCortos(lang).size)
            assertEquals(7, diasAbrev(lang).size)
            assertEquals(12, mesesCortos(lang).size)
        }
        assertTrue(File("../../public/repdb/catalogo.ca.json").exists())
        assertTrue(File("../../public/repdb/catalogo.en.json").exists())

        // 6) Actualizador: valida release oficial + SHA-256 y rechaza URLs maliciosas
        val shaValido = "a".repeat(64)
        val relOk = JsonJowyFit.parseToJsonElement(
            """
            {
              "tag_name": "v0.13.0",
              "html_url": "https://github.com/Jowy05/JowyFit/releases/tag/v0.13.0",
              "published_at": "2026-11-26T12:00:00Z",
              "body": "Novedades varias.\nSHA-256 del APK: $shaValido",
              "assets": [
                {"name": "JowyFit.apk", "size": 65000000, "browser_download_url": "https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk"}
              ]
            }
            """.trimIndent(),
        ) as JsonObject
        val infoOk = ActualizacionDominio.parsearRelease(relOk, "0.12.1")!!
        assertTrue(infoOk.hayNueva)
        assertEquals(shaValido, infoOk.sha256)
        assertNotNull(infoOk.urlApk)
        assertFalse(infoOk.notas.contains("SHA-256"))

        val relMala = JsonJowyFit.parseToJsonElement(
            """
            {
              "tag_name": "v9.9.9",
              "html_url": "https://evil.example/phish",
              "body": "Trampa",
              "assets": [
                {"name": "JowyFit.apk", "size": 1000, "browser_download_url": "https://evil.example/JowyFit.apk"}
              ]
            }
            """.trimIndent(),
        ) as JsonObject
        val infoMala = ActualizacionDominio.parsearRelease(relMala, "0.12.1")!!
        assertNull("Una URL externa jamás debe aceptarse como APK", infoMala.urlApk)
        assertEquals(ActualizacionDominio.URL_RELEASES, infoMala.urlRelease)

        // 7) Si existe la copia real del usuario en .cache/, validar importación + re-exportación V7 cifrada
        val copiaReal = File("../../.cache/JowyFit-mis-datos.jowyfit")
        if (copiaReal.exists()) {
            val leida = GestorCopias.leerCopia(copiaReal.readBytes())
            assertTrue("La copia real debe traer registros", leida.registros.isNotEmpty())
            val reexport = GestorCopias.crearCopia(leida.registros, leida.archivosMedia, contrasena = "TestReal!2026")
            val releida = GestorCopias.leerCopia(reexport, contrasena = "TestReal!2026")
            assertEquals(leida.registros.size, releida.registros.size)
            assertEquals(leida.archivosMedia.size, releida.archivosMedia.size)
        }
    }
}
