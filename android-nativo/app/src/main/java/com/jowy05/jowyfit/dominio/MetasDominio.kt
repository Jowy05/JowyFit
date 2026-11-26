package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.HitoMeta
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlin.math.max
import kotlin.math.roundToInt

/** Lógica pura de metas: histórico con notas, progreso automático/manual y meta principal (1:1 con src/dominio/metas.ts). */
object MetasDominio {

    private const val MAX_HISTORIAL = 200

    data class EstadoMeta(
        val actual: Double?,
        val falta: Double?,
        val progreso: Double,
        val conseguida: Boolean,
    )

    fun registrarAvance(meta: Meta, valor: Double, fechaIso: String, nota: String? = null): Meta {
        val limpio = max(0.0, (valor * 100.0).roundToInt() / 100.0)
        val notaLimpia = nota?.trim()?.takeIf { it.isNotEmpty() }
        val hito = HitoMeta(fecha = fechaIso, valor = limpio, nota = notaLimpia)
        val prev = meta.historial.orEmpty().toMutableList()
        val ultIdx = prev.lastIndex
        if (ultIdx >= 0 && prev[ultIdx].fecha == fechaIso && (notaLimpia == null || prev[ultIdx].nota == notaLimpia)) {
            prev[ultIdx] = prev[ultIdx].copy(valor = limpio, nota = notaLimpia ?: prev[ultIdx].nota)
        } else {
            prev += hito
        }
        prev.sortBy { it.fecha }
        return meta.copy(
            inicio = meta.inicio ?: 0.0,
            actual = limpio,
            historial = prev.takeLast(MAX_HISTORIAL),
        )
    }

    fun borrarHito(meta: Meta, indice: Int): Meta {
        val prev = meta.historial.orEmpty().toMutableList()
        if (indice !in prev.indices) return meta
        prev.removeAt(indice)
        val ultimo = prev.lastOrNull()
        return meta.copy(
            actual = ultimo?.valor,
            historial = prev.takeIf { it.isNotEmpty() },
        )
    }

    fun valorAuto(
        meta: Meta,
        mediciones: List<Medicion>,
        sesiones: List<Sesion>,
        perfil: Perfil,
        hoyIso: String,
        nombreDe: (String) -> String = { it },
    ): Double? = when (meta.tipo) {
        "cintura" -> TendenciasDominio.ultimoValor(mediciones, { it.perimetros?.cintura })?.valor
        "peso" -> TendenciasDominio.ultimoValor(mediciones, { it.pesoKg })?.valor
        "grasa" -> TendenciasDominio.grasaActual(mediciones, perfil, hoyIso)?.valor
        "dominadas" -> TendenciasDominio.estrictasDominadas(sesiones, nombreDe).toDouble()
        "reps", "ejercicio" -> meta.ejercicio?.let {
            TendenciasDominio.actualEjercicio(sesiones, it, if (meta.tipo == "reps") "reps" else "kg")
        }
        else -> null
    }

    fun valorActual(
        meta: Meta,
        mediciones: List<Medicion>,
        sesiones: List<Sesion>,
        perfil: Perfil,
        hoyIso: String,
        nombreDe: (String) -> String = { it },
    ): Double? {
        if (meta.tipo == "libre") return meta.actual
        val auto = valorAuto(meta, mediciones, sesiones, perfil, hoyIso, nombreDe)
        if (meta.tipo in setOf("dominadas", "reps", "ejercicio")) {
            val man = meta.actual ?: return auto
            return if (auto != null) max(auto, man) else man
        }
        return auto
    }

    fun estado(meta: Meta, actual: Double?): EstadoMeta {
        if (meta.tipo == "libre" && (actual == null || meta.objetivo <= 0.0)) {
            return EstadoMeta(null, null, if (meta.hecha == true) 1.0 else 0.0, meta.hecha == true)
        }
        val inicio = meta.inicio ?: if (meta.tipo in setOf("dominadas", "reps", "ejercicio", "libre")) 0.0 else null
        val falta = TendenciasDominio.faltaMeta(inicio, actual, meta.objetivo)
        val conseguida = meta.hecha == true || (falta != null && falta <= 1e-9)
        val prog = if (conseguida) 1.0 else TendenciasDominio.progresoMeta(inicio, actual, meta.objetivo)
        return EstadoMeta(actual, falta, prog, conseguida)
    }

    fun metaPrincipal(metas: List<Meta>, actualDe: (Meta) -> Double?): Pair<Meta, EstadoMeta>? =
        metas
            .map { m -> m to estado(m, actualDe(m)) }
            .filter { (m, st) -> (m.tipo != "libre" || st.actual != null) && !st.conseguida }
            .sortedWith(compareBy<Pair<Meta, EstadoMeta>> { it.first.fecha ?: "9" }.thenBy { it.first.id ?: 0L })
            .firstOrNull()
}
