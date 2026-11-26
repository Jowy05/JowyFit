package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.ComidaDominio
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Tests exhaustivos de Fase 3: Comida, raciones, Open Food Facts seguro, cafeína, recientes y suplementos. */
class ComidaFase3Test {

    @Test
    fun franjasPorHoraYValidacion() {
        assertEquals("cena", ComidaDominio.franjaPorHora("02:30"))
        assertEquals("desayuno", ComidaDominio.franjaPorHora("07:15"))
        assertEquals("comida", ComidaDominio.franjaPorHora("14:00"))
        assertEquals("merienda", ComidaDominio.franjaPorHora("17:30"))
        assertEquals("cena", ComidaDominio.franjaPorHora("21:00"))

        assertTrue(ComidaDominio.franjasValidas(ComidaDominio.FRANJAS_HORAS))
        assertFalse(
            ComidaDominio.franjasValidas(
                mapOf("desayuno" to "12:00", "comida" to "11:00", "merienda" to "16:30", "cena" to "19:30"),
            ),
        )
    }

    @Test
    fun racionesPlatoYPicoteoYNotaPorTamano() {
        val macros = ComidaDominio.Macros(hidratos = 60.0, grasas = 12.0, azucares = 6.0, sal = 1.2)
        val platoG = ComidaDominio.conRacion(600.0, 30.0, null, macros, "G", "comida")
        assertEquals(900.0, platoG.kcal, 0.01)
        assertEquals(45.0, platoG.proteina, 0.01)
        assertEquals(90.0, platoG.hidratos!!, 0.01)

        val picoteoN = ComidaDominio.conRacion(500.0, 10.0, null, macros, "N", "picoteo")
        assertEquals(250.0, picoteoN.kcal, 0.01)
        assertEquals(5.0, picoteoN.proteina, 0.01)
        val picoteoG = ComidaDominio.conRacion(500.0, 10.0, null, macros, "G", "picoteo")
        assertEquals(500.0, picoteoG.kcal, 0.01)

        assertEquals(350 to 15, ComidaDominio.notaPorTamano("normal", "desayuno"))
        assertEquals(900 to 38, ComidaDominio.notaPorTamano("abundante", "comida"))
        assertEquals(200 to 8, ComidaDominio.notaPorTamano("ligera", "cena"))
    }

    @Test
    fun openFoodFactsSeguridadYLimitesDeCredibilidad() {
        assertTrue(ComidaDominio.codigoValido("8410076472106"))
        assertTrue(ComidaDominio.codigoValido("12345678"))
        assertFalse(ComidaDominio.codigoValido("12345"))
        assertFalse(ComidaDominio.codigoValido("841007647210X"))

        // Allowlist estricta de imágenes OFF (anti píxel espía)
        assertNotNull(ComidaDominio.imagenOFF("https://images.openfoodfacts.org/images/products/123.jpg"))
        assertNotNull(ComidaDominio.imagenOFF("https://static.openfoodfacts.net/foto.webp"))
        assertNull(ComidaDominio.imagenOFF("http://images.openfoodfacts.org/insegura.jpg"))
        assertNull(ComidaDominio.imagenOFF("https://evil.example/tracker.png"))
        assertNull(ComidaDominio.imagenOFF("https://user:pass@images.openfoodfacts.org/x.jpg"))
        assertNull(ComidaDominio.imagenOFF("https://images.openfoodfacts.org:8443/x.jpg"))

        val json = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name_es": "Yogur proteico natural",
                "brands": "Hacendado, Mercadona",
                "serving_quantity": "150",
                "image_front_small_url": "https://images.openfoodfacts.org/img/yogur.jpg",
                "nutriments": {
                  "energy-kj_100g": 251.04,
                  "proteins_100g": 10.0,
                  "carbohydrates_100g": 4.2,
                  "sugars_100g": 4.0,
                  "fat_100g": 0.2,
                  "salt_100g": 0.1,
                  "caffeine_100g": 0.032
                }
              }
            }
            """.trimIndent(),
        ).jsonObject
        val prod = ComidaDominio.leerOFF("8480000123456", json)!!
        assertEquals("Yogur proteico natural", prod.nombre)
        assertEquals("Hacendado", prod.marca)
        assertEquals(60.0, prod.kcal100!!, 0.5)
        assertEquals(90.0, prod.kcalRacion!!, 1.0)
        assertEquals(15.0, prod.proteinaRacion!!, 0.1)
        assertEquals(32.0, prod.cafeina100!!, 0.1)

        val porRac = ComidaDominio.porRacion(prod)
        assertEquals("racion", porRac.base)
        assertEquals(90.0, porRac.kcal, 1.0)
        assertEquals(15.0, porRac.proteina, 0.1)
        assertEquals(48.0, porRac.cafeina!!, 1.0)

        val por200g = ComidaDominio.porGramos(prod, 200.0)
        assertEquals(120.0, por200g.kcal, 1.0)
        assertEquals(20.0, por200g.proteina, 0.1)

        // Valores absurdos / negativos / envenenados deben descartarse como null
        val envenenado = JsonJowyFit.parseToJsonElement(
            """
            {
              "status": 1,
              "product": {
                "product_name": "Malicioso",
                "image_front_small_url": "https://evil.example/pixel.gif",
                "nutriments": {
                  "energy-kcal_100g": 9999999,
                  "proteins_100g": -50,
                  "caffeine_100g": 500
                }
              }
            }
            """.trimIndent(),
        ).jsonObject
        val seguro = ComidaDominio.leerOFF("8400000000001", envenenado)!!
        assertNull(seguro.imagen)
        assertNull(seguro.kcal100)
        assertNull(seguro.proteina100)
        assertNull(seguro.cafeina100)
    }

    @Test
    fun cafeinaPicoteoRecientesAyerYSuplementos() {
        val ok = ComidaDominio.avisoCafeina(120, 400, "16:00", "11:00")
        assertEquals(ComidaDominio.TonoCafeina.OK, ok.tono)
        val tarde = ComidaDominio.avisoCafeina(120, 400, "16:00", "17:30")
        assertEquals(ComidaDominio.TonoCafeina.WARN, tarde.tono)
        val pasado = ComidaDominio.avisoCafeina(450, 400, "16:00", "11:00")
        assertEquals(ComidaDominio.TonoCafeina.BAD, pasado.tono)

        val comidas = listOf(
            Comida(1, "2026-11-25", "08:00", "desayuno", "Café con leche", 80.0, 4.0, cafeina = 80.0, tipo = "bebida"),
            Comida(2, "2026-11-25", "14:00", "comida", "Pollo con arroz", 650.0, 48.0, tipo = "nota"),
            Comida(3, "2026-11-25", "18:00", "merienda", "Patatas fritas", 300.0, 4.0, tipo = "picoteo"),
            Comida(4, "2026-11-26", "10:00", "desayuno", "Monster", 210.0, 0.0, cafeina = 160.0, tipo = "bebida"),
        )
        assertEquals(1, ComidaDominio.deAyer(comidas, "2026-11-25", "desayuno").size)
        assertEquals(3, ComidaDominio.deAyer(comidas, "2026-11-25").size)

        val pic = ComidaDominio.picoteoDeSemana(comidas, setOf("2026-11-25", "2026-11-26"))
        assertEquals(1, pic.dias)
        assertEquals(2, pic.energeticas)

        val plantillas = listOf(
            Plantilla(1, "Café con leche", 80.0, 4.0, usos = 10, codigo = "11111111"),
            Plantilla(2, "Avena", 350.0, 14.0, usos = 2),
        )
        val recs = ComidaDominio.recientes(comidas, "2026-11-26", plantillas)
        assertTrue(recs.none { it.nombre == "Café con leche" })
        assertTrue(recs.any { it.nombre == "Pollo con arroz" })

        val productos = listOf(
            Producto("11111111", "Café"),
            Producto("22222222", "Pan integral"),
        )
        assertEquals(listOf("22222222"), ComidaDominio.escaneadosSueltos(productos, plantillas).map { it.codigo })

        assertTrue(ComidaDominio.esBatido("Batido de proteína"))
        assertTrue(ComidaDominio.esBatido("Protein shake"))
        assertFalse(ComidaDominio.esBatido("Creatina"))
        assertEquals("3-5 g", ComidaDominio.dosisDe(null, "Creatina"))
        assertEquals("5 g", ComidaDominio.dosisDe(mapOf("Creatina" to "5 g"), "Creatina"))
        assertEquals(125.0, ComidaDominio.kcalBatido(25.0), 0.01)
    }
}
