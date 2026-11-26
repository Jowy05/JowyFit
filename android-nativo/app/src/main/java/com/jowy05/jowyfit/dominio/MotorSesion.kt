package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.EjercicioSesion
import com.jowy05.jowyfit.datos.modelo.PlantillaEntreno
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import java.time.LocalDate
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Operaciones puras sobre la sesión de entreno en vivo (1:1 con src/dominio/sesion.ts). */
object MotorSesion {

    const val DESCANSO_CALENTAMIENTO = 45

    data class DatosSerie(
        val peso: Double? = null,
        val reps: Int? = null,
        val segundos: Int? = null,
        val rpe: Double? = null,
        val nota: String? = null,
        val km: Double? = null,
    )

    data class ResultadoSerie(
        val sesion: Sesion,
        val descansoSeg: Int,
        val record: Progresion.RecordDetectado?,
    )

    data class ResumenSesion(
        val ejercicios: Int,
        val hechos: Int,
        val saltados: Int,
        val series: Int,
        val volumenKg: Int,
        val segundos: Int,
    )

    private fun pesoInicial(peso: Double?, registro: String): Double? = when (registro) {
        "tiempo", "cardio" -> null
        "corporal" -> peso?.takeIf { it > 0.0 }
        else -> peso
    }

    fun seriesNuevas(n: Int, peso: Double?, reps: Int?, registro: String): List<Serie> =
        (1..max(1, n)).map { i ->
            Serie(
                n = i,
                peso = pesoInicial(peso, registro),
                reps = if (registro == "tiempo") null else reps,
                segundos = if (registro == "tiempo") reps else null,
                rpe = null,
                calentamiento = false,
                hecha = false,
            )
        }

    fun desdeBloque(b: Bloque, pesoSug: Double? = null, repsSug: Int? = null): EjercicioSesion =
        EjercicioSesion(
            uid = b.uid,
            ejercicio = b.ejercicio,
            planificado = b.ejercicio,
            estado = "pendiente",
            series = seriesNuevas(b.series, pesoSug, repsSug ?: b.repsMin, b.registro),
            repsMin = b.repsMin,
            repsMax = b.repsMax,
            rpe = b.rpe,
            descanso = b.descanso,
            superserie = b.superserie,
            registro = b.registro,
            cargaPct = b.cargaPct?.takeIf { it < 1.0 },
            fueraEnCorta = b.fueraEnCorta,
        )

    fun crearSesion(
        id: Long,
        dia: DiaRutina,
        rutinaId: Long?,
        gimnasioId: Long?,
        version: String = "normal",
        calibracion: Boolean = false,
        sugerencias: Map<String, Pair<Double?, Int?>> = emptyMap(),
        ahora: Long = System.currentTimeMillis(),
    ): Sesion {
        val filtrados = when (version) {
            "corta" -> dia.bloques.filterNot { it.fueraEnCorta == true }
            "minima" -> dia.bloques.take(3).map { it.copy(series = min(it.series, 2)) }
            else -> dia.bloques
        }
        val ejs = filtrados.mapIndexed { idx, b ->
            val sug = sugerencias[b.ejercicio]
            desdeBloque(b, sug?.first, sug?.second).copy(estado = if (idx == 0) "curso" else "pendiente")
        }
        return Sesion(
            id = id,
            fecha = LocalDate.now().toString(),
            rutinaId = rutinaId,
            letra = dia.letra,
            nombre = dia.nombre,
            gimnasioId = gimnasioId,
            inicio = ahora,
            version = version,
            estado = "curso",
            ejercicios = ejs,
            calibracion = calibracion,
        )
    }

    fun crearSesionDesdePlantilla(
        id: Long,
        plantilla: PlantillaEntreno,
        gimnasioId: Long?,
        sugerencias: Map<String, Pair<Double?, Int?>> = emptyMap(),
        ahora: Long = System.currentTimeMillis(),
    ): Sesion {
        val ejs = plantilla.ejercicios.mapIndexed { idx, b ->
            val sug = sugerencias[b.ejercicio]
            EjercicioSesion(
                uid = "pl-$idx-${b.ejercicio}",
                ejercicio = b.ejercicio,
                planificado = b.ejercicio,
                estado = if (idx == 0) "curso" else "pendiente",
                series = seriesNuevas(b.series, sug?.first, sug?.second ?: b.repsMin, b.registro),
                repsMin = b.repsMin,
                repsMax = b.repsMax,
                rpe = 8.0,
                descanso = b.descanso,
                registro = b.registro,
            )
        }
        return Sesion(
            id = id,
            fecha = LocalDate.now().toString(),
            rutinaId = null,
            letra = "L",
            nombre = plantilla.nombre,
            gimnasioId = gimnasioId,
            inicio = ahora,
            version = "normal",
            estado = "curso",
            ejercicios = ejs,
            calibracion = false,
        )
    }

    fun crearSesionLibre(id: Long, nombre: String, gimnasioId: Long?, ahora: Long = System.currentTimeMillis()): Sesion =
        Sesion(
            id = id,
            fecha = LocalDate.now().toString(),
            rutinaId = null,
            letra = "L",
            nombre = nombre.ifBlank { "Entreno libre" },
            gimnasioId = gimnasioId,
            inicio = ahora,
            version = "normal",
            estado = "curso",
            ejercicios = emptyList(),
            calibracion = false,
        )

    fun indiceActual(s: Sesion): Int {
        val c = s.ejercicios.indexOfFirst { it.estado == "curso" }
        if (c >= 0) return c
        return s.ejercicios.indexOfFirst { it.estado == "pendiente" }
    }

    fun serieActual(e: EjercicioSesion): Int = e.series.indexOfFirst { !it.hecha }

    fun terminada(s: Sesion): Boolean =
        s.ejercicios.isNotEmpty() && s.ejercicios.all { it.estado == "hecho" || it.estado == "saltado" }

    fun apuntarSerie(
        sesion: Sesion,
        idx: Int,
        datos: DatosSerie,
        previas: List<Serie>,
        ahora: Long = System.currentTimeMillis(),
    ): ResultadoSerie? {
        val e = sesion.ejercicios.getOrNull(idx) ?: return null
        val n = serieActual(e)
        if (n < 0) return null
        val actual = e.series[n]
        val serieHecha = actual.copy(
            peso = datos.peso,
            reps = datos.reps,
            segundos = datos.segundos,
            rpe = datos.rpe,
            nota = datos.nota ?: actual.nota,
            km = datos.km,
            hecha = true,
            ts = ahora,
        )
        val record = if (actual.calentamiento) null else Progresion.esRecord(serieHecha, previas)
        val finalSerie = if (record != null) serieHecha.copy(record = true) else serieHecha

        val nuevasSeries = e.series.mapIndexed { i, x ->
            when {
                i == n -> finalSerie
                i > n && !actual.calentamiento && !x.hecha && !x.calentamiento -> x.copy(
                    peso = datos.peso,
                    reps = if (e.registro != "tiempo") x.reps ?: datos.reps else null,
                )
                else -> x
            }
        }
        val ejActualizado = e.copy(inicio = e.inicio ?: ahora, series = nuevasSeries)
        val terminado = serieActual(ejActualizado) < 0
        val lista = sesion.ejercicios.toMutableList()
        lista[idx] = if (terminado) ejActualizado.copy(estado = "hecho", fin = ahora) else ejActualizado

        val compIdx = e.superserie?.let { suid -> lista.indexOfFirst { it.uid == suid } } ?: -1
        var descanso = e.descanso

        if (compIdx >= 0 && lista[compIdx].estado !in setOf("hecho", "saltado")) {
            val esPrimero = compIdx > idx
            if (!terminado) lista[idx] = lista[idx].copy(estado = "pendiente")
            lista[compIdx] = lista[compIdx].copy(estado = "curso")
            descanso = if (esPrimero) 0 else e.descanso
        } else if (terminado) {
            val sig = lista.indexOfFirst { it.estado == "pendiente" }
            if (sig >= 0) {
                lista[sig] = lista[sig].copy(estado = "curso")
                descanso = min(e.descanso, 90)
            } else {
                descanso = 0
            }
        } else {
            lista[idx] = lista[idx].copy(estado = "curso")
        }

        val descansoFinal = if (actual.calentamiento) DESCANSO_CALENTAMIENTO else descanso
        val sesionTmp = sesion.copy(ejercicios = lista)
        val sesionOut = if (descansoFinal > 0 && !terminada(sesionTmp)) {
            sesionTmp.copy(descansoHasta = ahora + descansoFinal * 1000L, descansoTotal = descansoFinal)
        } else {
            sesionTmp.copy(descansoHasta = null)
        }
        return ResultadoSerie(sesion = sesionOut, descansoSeg = if (terminada(sesionTmp)) 0 else descansoFinal, record = record)
    }

    fun anadirSerie(s: Sesion, idx: Int): Sesion {
        val e = s.ejercicios.getOrNull(idx) ?: return s
        val ult = e.series.lastOrNull()
        val tiempo = e.registro == "tiempo"
        val nueva = Serie(
            n = e.series.size + 1,
            peso = ult?.peso,
            reps = if (tiempo) null else (ult?.reps ?: e.repsMin),
            segundos = if (tiempo) (ult?.segundos ?: e.repsMin) else null,
            rpe = null,
            calentamiento = false,
            hecha = false,
        )
        val ejs = s.ejercicios.toMutableList()
        ejs[idx] = e.copy(
            series = e.series + nueva,
            estado = if (e.estado == "hecho") "curso" else e.estado,
        )
        return s.copy(ejercicios = ejs)
    }

    fun quitarSerie(s: Sesion, idx: Int): Sesion {
        val e = s.ejercicios.getOrNull(idx) ?: return s
        val j = e.series.indexOfLast { !it.hecha && !it.calentamiento }
        if (j < 0 || e.series.count { !it.calentamiento } <= 1) return s
        val nuevas = e.series.filterIndexed { i, _ -> i != j }.mapIndexed { k, x -> x.copy(n = k + 1) }
        val ejs = s.ejercicios.toMutableList()
        var actualizado = e.copy(series = nuevas)
        if (serieActual(actualizado) < 0 && actualizado.estado == "curso") {
            actualizado = actualizado.copy(estado = "hecho")
            ejs[idx] = actualizado
            val sig = ejs.indexOfFirst { it.estado == "pendiente" }
            if (sig >= 0) ejs[sig] = ejs[sig].copy(estado = "curso")
        } else {
            ejs[idx] = actualizado
        }
        return s.copy(ejercicios = ejs)
    }

    fun conCalentamiento(s: Sesion, idx: Int, seriesCal: List<PesosYDiscos.SerieCalentamiento>): Sesion {
        val e = s.ejercicios.getOrNull(idx) ?: return s
        if (e.series.any { it.calentamiento } || seriesCal.isEmpty()) return s
        val cal = seriesCal.map { Serie(n = 0, peso = it.peso, reps = it.reps, calentamiento = true, hecha = false) }
        val todas = (cal + e.series).mapIndexed { k, x -> x.copy(n = k + 1) }
        val ejs = s.ejercicios.toMutableList()
        ejs[idx] = e.copy(series = todas)
        return s.copy(ejercicios = ejs)
    }

    fun sustituir(
        s: Sesion,
        idx: Int,
        nuevoId: String,
        motivo: String,
        pesoSug: Double?,
        repsSug: Int?,
        registro: String? = null,
    ): Sesion {
        val e = s.ejercicios.getOrNull(idx) ?: return s
        val reg = registro ?: e.registro
        val nuevas = e.series.map { x ->
            if (x.hecha) x
            else x.copy(
                peso = pesoInicial(pesoSug, reg),
                reps = if (reg == "tiempo") null else (repsSug ?: x.reps ?: e.repsMin),
                segundos = if (reg == "tiempo") (repsSug ?: x.segundos ?: 30) else null,
            )
        }
        val ejs = s.ejercicios.toMutableList()
        ejs[idx] = e.copy(ejercicio = nuevoId, motivo = motivo, registro = reg, series = nuevas)
        return s.copy(ejercicios = ejs)
    }

    fun irA(s: Sesion, idx: Int): Sesion {
        if (idx !in s.ejercicios.indices) return s
        val ejs = s.ejercicios.mapIndexed { i, e ->
            when {
                i == idx -> if (e.estado != "hecho") e.copy(estado = "curso") else e
                e.estado == "curso" -> e.copy(estado = if (serieActual(e) < 0) "hecho" else "pendiente")
                else -> e
            }
        }
        return s.copy(ejercicios = ejs)
    }

    fun saltar(s: Sesion, idx: Int): Sesion {
        if (idx !in s.ejercicios.indices) return s
        val ejs = s.ejercicios.toMutableList()
        ejs[idx] = ejs[idx].copy(estado = "saltado")
        if (ejs.none { it.estado == "curso" }) {
            val sig = ejs.indexOfFirst { it.estado == "pendiente" }
            if (sig >= 0) ejs[sig] = ejs[sig].copy(estado = "curso")
        }
        return s.copy(ejercicios = ejs)
    }

    fun editarSerieHecha(
        s: Sesion,
        idx: Int,
        serieIdx: Int,
        peso: Double?,
        reps: Int?,
        segundos: Int?,
    ): Sesion {
        val e = s.ejercicios.getOrNull(idx) ?: return s
        if (serieIdx !in e.series.indices) return s
        val series = e.series.mapIndexed { i, x ->
            if (i == serieIdx && x.hecha) {
                x.copy(peso = peso, reps = reps, segundos = segundos)
            } else {
                x
            }
        }
        val ejs = s.ejercicios.toMutableList()
        ejs[idx] = e.copy(series = series)
        return s.copy(ejercicios = ejs)
    }

    fun anadirEjercicioASesion(s: Sesion, bloque: Bloque, pesoSug: Double? = null, repsSug: Int? = null): Sesion {
        val nuevo = desdeBloque(bloque, pesoSug, repsSug)
        val sinCurso = s.ejercicios.none { it.estado == "curso" }
        val ejs = s.ejercicios + nuevo.copy(estado = if (sinCurso) "curso" else "pendiente")
        return s.copy(ejercicios = ejs)
    }

    fun resumen(s: Sesion, ahora: Long = System.currentTimeMillis()): ResumenSesion {
        val hechos = s.ejercicios.count { it.estado == "hecho" || it.series.any { x -> x.hecha && !x.calentamiento } }
        val series = s.ejercicios.sumOf { e -> e.series.count { it.hecha && !it.calentamiento } }
        val vol = s.ejercicios.sumOf { e -> Progresion.volumen(e.series) }
        val seg = (((s.fin ?: ahora) - s.inicio) / 1000L).toInt().coerceAtLeast(0)
        return ResumenSesion(
            ejercicios = s.ejercicios.size,
            hechos = hechos,
            saltados = s.ejercicios.count { it.estado == "saltado" },
            series = series,
            volumenKg = vol.roundToInt(),
            segundos = seg,
        )
    }
}
