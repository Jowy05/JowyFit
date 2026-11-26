package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class RegresionesQaTest {

    @Test
    fun barraSinGimnasioArrancaEnPesoRealDeBarra() {
        val pesosBarra = PesosYDiscos.pesosPara("barbell", "peso", null)
        assertTrue("La lista de barra sin gimnasio debe empezar en 20 kg", pesosBarra.first() >= 20.0)
        assertEquals(20.0, Progresion.pesoPartida("barbell", "peso", pesosBarra)!!, 0.001)

        val pesosEz = PesosYDiscos.pesosPara("ez_bar", "peso", null)
        assertEquals(10.0, Progresion.pesoPartida("ez_bar", "peso", pesosEz)!!, 0.001)

        val pesosTrap = PesosYDiscos.pesosPara("trap_bar", "peso", null)
        assertEquals(25.0, Progresion.pesoPartida("trap_bar", "peso", pesosTrap)!!, 0.001)

        val pesosSmith = PesosYDiscos.pesosPara("smith_machine", "peso", null)
        assertEquals(15.0, Progresion.pesoPartida("smith_machine", "peso", pesosSmith)!!, 0.001)
    }

    @Test
    fun editarSerieHechaActualizaSoloEsaSerie() {
        val dia = DiaRutina(
            letra = "A",
            nombre = "Pierna",
            bloques = listOf(
                Bloque(uid = "b1", ejercicio = "squat", series = 3, repsMin = 8, repsMax = 12, rpe = 8.0, descanso = 120, registro = "peso"),
            ),
        )
        val sesion = MotorSesion.crearSesion(1L, dia, 1L, null, sugerencias = mapOf("squat" to (40.0 to 8)))
        val trasS1 = MotorSesion.apuntarSerie(sesion, 0, MotorSesion.DatosSerie(peso = 40.0, reps = 8), emptyList())!!.sesion
        val corregida = MotorSesion.editarSerieHecha(trasS1, 0, 0, peso = 50.0, reps = 10, segundos = null)

        val s0 = corregida.ejercicios[0].series[0]
        val s1 = corregida.ejercicios[0].series[1]
        assertEquals(50.0, s0.peso!!, 0.001)
        assertEquals(10, s0.reps)
        assertTrue(s0.hecha)
        assertEquals(40.0, s1.peso!!, 0.001)
        assertTrue(!s1.hecha)
    }

    @Test
    fun catalogoTraduceZonaEnLugarDeClaveInterna() {
        val cat = CatalogoCargado(
            idioma = "es",
            ejercicios = emptyList(),
            porId = emptyMap(),
            musculos = emptyMap(),
            material = emptyMap(),
            etiquetas = mapOf("body_part" to mapOf("upper_legs" to "Piernas", "chest" to "Pecho")),
        )
        assertEquals("Piernas", cat.nombreZona("upper_legs"))
        assertEquals("Pecho", cat.nombreZona("chest"))
        assertEquals("full body", cat.nombreZona("full_body"))
    }

    @Test
    fun proguardConservaMediaPipeYFloggerParaR8() {
        val archivo = File("proguard-rules.pro").takeIf { it.exists() }
            ?: File("app/proguard-rules.pro")
        val texto = archivo.readText()
        assertTrue("proguard-rules.pro debe conservar com.google.mediapipe.**", texto.contains("-keep class com.google.mediapipe.**"))
        assertTrue("proguard-rules.pro debe conservar com.google.common.flogger.**", texto.contains("-keep class com.google.common.flogger.**"))
        assertTrue("proguard-rules.pro debe conservar com.google.protobuf.**", texto.contains("-keep class com.google.protobuf.**"))
    }
}
