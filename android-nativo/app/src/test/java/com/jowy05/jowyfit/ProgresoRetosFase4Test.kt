package com.jowy05.jowyfit

import com.jowy05.jowyfit.datos.modelo.Bascula
import com.jowy05.jowyfit.datos.modelo.EjercicioSesion
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Perimetros
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.dominio.MetasDominio
import com.jowy05.jowyfit.dominio.PosturaDominio
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.dominio.TendenciasDominio
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Tests exhaustivos de Fase 4: Tendencias, Descarga, Metas, Retos y biomecánica 3D BlazePose. */
class ProgresoRetosFase4Test {

    @Test
    fun tendenciasRecordsMesEstancamientoYGrasa120Dias() {
        val sesiones = listOf(
            Sesion(1, "2026-10-05", inicio = 1L, estado = "hecha", ejercicios = listOf(EjercicioSesion("u1", "bench-press", series = listOf(Serie(1, 60.0, 10, hecha = true, record = true))))),
            Sesion(2, "2026-10-12", inicio = 2L, estado = "hecha", ejercicios = listOf(EjercicioSesion("u2", "bench-press", series = listOf(Serie(1, 60.0, 10, hecha = true))))),
            Sesion(3, "2026-10-19", inicio = 3L, estado = "hecha", ejercicios = listOf(EjercicioSesion("u3", "bench-press", series = listOf(Serie(1, 60.0, 10, hecha = true))))),
            Sesion(4, "2026-11-24", inicio = 4L, estado = "hecha", ejercicios = listOf(EjercicioSesion("u4", "bench-press", series = listOf(Serie(1, 60.0, 10, hecha = true))))),
        )
        val est = TendenciasDominio.ejerciciosEstancados(sesiones)
        assertEquals(listOf("bench-press"), est.map { it.ejercicio })

        val porMes = TendenciasDominio.recordsPorMes(sesiones, "2026-11-26", 6)
        assertEquals(6, porMes.size)
        assertEquals(1, porMes.first { it.mes == "2026-10" }.total)
        assertTrue(porMes.last().enCurso)

        val perfil = Perfil(sexo = "hombre", alturaCm = 180.0)
        val meds = listOf(
            // Báscula de hace > 120 días debe ser ignorada en favor de la cinta Marina
            Medicion(1, "2026-01-01T08:00", pesoKg = 82.0, bascula = Bascula(grasaPct = 22.0)),
            Medicion(2, "2026-11-10T08:00", pesoKg = 80.5, perimetros = Perimetros(cintura = 85.0, cuello = 38.0)),
            Medicion(3, "2026-11-24T08:00", pesoKg = 79.5),
        )
        val grasa = TendenciasDominio.grasaActual(meds, perfil, "2026-11-26")!!
        assertEquals("medidas", grasa.fuente)
        assertTrue(grasa.valor in 12.0..20.0)

        val tend = TendenciasDominio.tendenciaPeso(meds, "2026-11-26")
        assertNotNull(tend.kgSemana)
        assertTrue(tend.kgSemana!! < 0.0) // Bajando peso ~-0.5 kg/sem
    }

    @Test
    fun metasHistoricoNotasYPrioridad() {
        var meta = Meta(id = 1L, tipo = "dominadas", titulo = "10 dominadas", objetivo = 10.0, unidad = "reps")
        meta = MetasDominio.registrarAvance(meta, 4.0, "2026-11-20", "Con goma fina")
        meta = MetasDominio.registrarAvance(meta, 5.0, "2026-11-20", null) // mismo día sin nota distinta actualiza en sitio
        assertEquals(1, meta.historial!!.size)
        assertEquals(5.0, meta.actual!!, 0.01)
        assertEquals("Con goma fina", meta.historial!!.first().nota)

        meta = MetasDominio.registrarAvance(meta, 6.0, "2026-11-20", "Estrictas sin goma") // nota distinta añade hito
        assertEquals(2, meta.historial!!.size)
        assertEquals(6.0, meta.actual!!, 0.01)

        val trasBorrar = MetasDominio.borrarHito(meta, 1)
        assertEquals(1, trasBorrar.historial!!.size)
        assertEquals(5.0, trasBorrar.actual!!, 0.01)

        val st = MetasDominio.estado(meta, 6.0)
        assertEquals(0.6, st.progreso, 0.01)
        assertEquals(4.0, st.falta!!, 0.01)
        assertFalse(st.conseguida)
    }

    @Test
    fun retosMarcasRecordsYRachas() {
        val intentos = listOf(
            IntentoReto(1, "2026-11-24", "flexiones-60", valor = 28, duracionS = 60),
            IntentoReto(2, "2026-11-25", "flexiones-60", valor = 34, duracionS = 60, record = true),
            IntentoReto(3, "2026-11-25", "flexiones-20", valor = 32, duracionS = 32),
        )
        assertEquals(34, RetosDominio.mejorMarca(intentos, "flexiones-60")?.valor)
        assertTrue(RetosDominio.esNuevoRecord(intentos, "flexiones-60", 35))
        assertFalse(RetosDominio.esNuevoRecord(intentos, "flexiones-60", 30))

        // En contrarreloj (MENOS_TIEMPO) gana un tiempo más bajo
        assertTrue(RetosDominio.esNuevoRecord(intentos, "flexiones-20", 29))
        assertFalse(RetosDominio.esNuevoRecord(intentos, "flexiones-20", 35))

        // Racha sigue viva si se entrenó ayer (2026-11-25) aunque hoy (2026-11-26) aún no
        val racha = RetosDominio.racha(intentos, "2026-11-26")
        assertEquals(2, racha.actual)
        assertEquals(2, racha.mejor)
        assertFalse(racha.hechoHoy)
        assertEquals("1:25", RetosDominio.formatoTiempo(85))
    }

    @Test
    fun posturaBiomecanica3DFlexionesSentadillasYPlancha() {
        // 1) Flexión válida completa (codo 165° -> 90° -> 165°, cuerpo recto 180°)
        fun ptsFlexion(codoY: Double, caderaY: Double = 0.0) = PosturaDominio.PuntosPostura(
            cara = PosturaDominio.Punto3D(-0.2, 0.0, 0.0, 0.95),
            hombroIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.95),
            codoIzq = PosturaDominio.Punto3D(0.0, codoY, 0.0, 0.95),
            munecaIzq = PosturaDominio.Punto3D(0.25, codoY, 0.0, 0.95), // ángulo en codo: 90° cuando codoY>0
            caderaIzq = PosturaDominio.Punto3D(0.5, caderaY, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(1.0, 0.0, 0.0, 0.95),
        )
        fun ptsFlexionArriba() = PosturaDominio.PuntosPostura(
            cara = PosturaDominio.Punto3D(-0.2, 0.0, 0.0, 0.95),
            hombroIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.95),
            codoIzq = PosturaDominio.Punto3D(0.0, 0.25, 0.0, 0.95),
            munecaIzq = PosturaDominio.Punto3D(0.0, 0.50, 0.0, 0.95), // 180° recto
            caderaIzq = PosturaDominio.Punto3D(0.5, 0.0, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(1.0, 0.0, 0.0, 0.95),
        )

        var st = PosturaDominio.EstadoPostura()
        st = PosturaDominio.evaluar(st, ptsFlexionArriba(), RetosDominio.EjercicioPostura.FLEXIONES, 1000L)
        assertEquals(PosturaDominio.Fase.ARRIBA, st.fase)
        st = PosturaDominio.evaluar(st, ptsFlexion(0.25), RetosDominio.EjercicioPostura.FLEXIONES, 1500L)
        assertEquals(PosturaDominio.Fase.ABAJO, st.fase)
        assertEquals(100, st.profundidadPct)
        st = PosturaDominio.evaluar(st, ptsFlexionArriba(), RetosDominio.EjercicioPostura.FLEXIONES, 2000L)
        assertEquals(1, st.validas)
        assertEquals(0, st.invalidas)

        // Flexión con cadera muy caída cuenta como inválida
        st = PosturaDominio.evaluar(st, ptsFlexion(0.25, caderaY = 0.40), RetosDominio.EjercicioPostura.FLEXIONES, 2600L)
        st = PosturaDominio.evaluar(st, ptsFlexionArriba(), RetosDominio.EjercicioPostura.FLEXIONES, 3200L)
        assertEquals(1, st.validas)
        assertEquals(1, st.invalidas)

        // 2) Sentadilla válida completa (rodilla 180° -> 90° -> 180°, torso erguido)
        val sqArriba = PosturaDominio.PuntosPostura(
            hombroIzq = PosturaDominio.Punto3D(0.0, -0.5, 0.0, 0.95),
            caderaIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.95),
            rodillaIzq = PosturaDominio.Punto3D(0.0, 0.45, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(0.0, 0.90, 0.0, 0.95),
        )
        val sqAbajo = PosturaDominio.PuntosPostura(
            hombroIzq = PosturaDominio.Punto3D(0.05, -0.1, 0.0, 0.95),
            caderaIzq = PosturaDominio.Punto3D(0.0, 0.40, 0.0, 0.95),
            rodillaIzq = PosturaDominio.Punto3D(0.45, 0.40, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(0.45, 0.85, 0.0, 0.95), // 90° en rodilla
        )
        var sq = PosturaDominio.EstadoPostura()
        sq = PosturaDominio.evaluar(sq, sqArriba, RetosDominio.EjercicioPostura.SENTADILLAS, 1000L)
        sq = PosturaDominio.evaluar(sq, sqAbajo, RetosDominio.EjercicioPostura.SENTADILLAS, 1600L)
        sq = PosturaDominio.evaluar(sq, sqArriba, RetosDominio.EjercicioPostura.SENTADILLAS, 2200L)
        assertEquals(1, sq.validas)
        assertEquals(0, sq.invalidas)

        // 3) Plancha horizontal recta acumula segundos válidos; de pie no acumula
        val planchaOk = PosturaDominio.PuntosPostura(
            hombroIzq = PosturaDominio.Punto3D(0.0, 0.0, 0.0, 0.95),
            caderaIzq = PosturaDominio.Punto3D(0.5, 0.0, 0.0, 0.95),
            tobilloIzq = PosturaDominio.Punto3D(1.0, 0.0, 0.0, 0.95),
        )
        var pl = PosturaDominio.EstadoPostura()
        pl = PosturaDominio.evaluar(pl, planchaOk, RetosDominio.EjercicioPostura.PLANCHA, 1000L)
        pl = PosturaDominio.evaluar(pl, planchaOk, RetosDominio.EjercicioPostura.PLANCHA, 2000L)
        assertTrue(pl.posturaBien)
        assertEquals(1.0, pl.segundosValidos, 0.05)

        // De pie (vertical) rechaza postura de plancha
        pl = PosturaDominio.evaluar(pl, sqArriba, RetosDominio.EjercicioPostura.PLANCHA, 3000L)
        assertFalse(pl.posturaBien)
        assertEquals(1.0, pl.segundosValidos, 0.05)
    }
}
