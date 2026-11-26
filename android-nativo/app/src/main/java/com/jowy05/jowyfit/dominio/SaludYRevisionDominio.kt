package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.CambioRevision
import com.jowy05.jowyfit.datos.modelo.Dolor
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.RespuestaRevision
import com.jowy05.jowyfit.datos.modelo.Rutina
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Salud, molestias y Revisión semanal reversible (1:1 con src/dominio/salud.ts y revision.ts). */
object SaludYRevisionDominio {

    const val CARGA_SUAVE = 0.8
    const val CARGA_VUELTA = 0.9

    data class ZonaInfo(val clave: String, val nombre: String)
    data class CondicionInfo(val clave: String, val nombre: String, val resumen: String)

    data class Restricciones(
        val fuera: (EjercicioCatalogo) -> String?,
        val penaliza: (EjercicioCatalogo) -> Int,
        val rpeMax: Double?,
        val maxIsometrico: Int?,
    )

    private data class ReglaZona(
        val carga: (EjercicioCatalogo) -> Boolean,
        val segura: String? = null,
        val pesoEspalda: Boolean = false,
        val estricta: Boolean = false,
    )

    private val DE_ZONA_SENSIBLE = mapOf(
        "rodilla" to "rodillas",
        "lumbar" to "lumbar",
        "hombro" to "hombros",
        "muneca" to "munecas",
        "codo" to "codos",
    )

    val ZONAS_DOLOR: List<ZonaInfo> = listOf(
        ZonaInfo("cuello", "Cuello"),
        ZonaInfo("hombros", "Hombros"),
        ZonaInfo("codos", "Codos"),
        ZonaInfo("munecas", "Muñecas"),
        ZonaInfo("manos", "Manos y dedos"),
        ZonaInfo("lumbar", "Lumbar"),
        ZonaInfo("caderas", "Caderas"),
        ZonaInfo("rodillas", "Rodillas"),
        ZonaInfo("tobillos", "Tobillos"),
        ZonaInfo("pies", "Pies"),
        ZonaInfo("pecho", "Pecho"),
        ZonaInfo("espalda", "Espalda"),
        ZonaInfo("brazo", "Brazo"),
        ZonaInfo("abdomen", "Abdomen"),
        ZonaInfo("gluteo", "Glúteo"),
        ZonaInfo("muslo", "Muslo"),
        ZonaInfo("isquio", "Isquio"),
        ZonaInfo("gemelo", "Gemelo"),
        ZonaInfo("cabeza", "Dolor de cabeza"),
        ZonaInfo("estomago", "Estómago"),
        ZonaInfo("hormigueo", "Hormigueo que baja"),
        ZonaInfo("cansancio", "Cansancio que no se va"),
        ZonaInfo("fiebre", "Resfriado o fiebre"),
    )

    val CONDICIONES_SALUD: List<CondicionInfo> = listOf(
        CondicionInfo("tension", "Tensión alta", "Sin aguantar la respiración ni esfuerzos isométricos largos."),
        CondicionInfo("osteoporosis", "Osteoporosis", "Sin doblar la espalda con carga ni saltos."),
        CondicionInfo("diabetes", "Diabetes", "Recordatorio de llevar algo de azúcar al entrenar."),
        CondicionInfo("protesis", "Prótesis de cadera o rodilla", "Solo ejercicios seguros para esa articulación, sin impacto."),
        CondicionInfo("anticoagulantes", "Tomo anticoagulantes", "Nada con riesgo de golpe o caída; equilibrio con apoyo."),
        CondicionInfo("asma", "Asma", "Calentamiento más progresivo."),
        CondicionInfo("embarazo", "Embarazo o posparto", "Plan suave con permiso médico o de tu matrona."),
    )

    fun nombreZona(clave: String): String = ZONAS_DOLOR.firstOrNull { it.clave == clave }?.nombre ?: clave

    fun rutinaBloqueada(perfil: Perfil): Boolean = !perfil.urgencias.isNullOrEmpty()

    fun doloresDe(perfil: Perfil): List<Dolor> {
        perfil.dolores?.let { return it }
        val inicio = perfil.creado.take(10).ifBlank { "2026-01-01" }
        return perfil.zonasSensibles.mapNotNull { DE_ZONA_SENSIBLE[it] }.distinct()
            .map { z -> Dolor(zona = z, cuanto = "regular", cuando = "fuerza", desde = "meses", inicio = inicio) }
    }

    fun nivelDolor(d: Dolor): String = when {
        d.cuanto == "mucho" || d.cuando == "siempre" -> "fuera"
        d.cuanto == "regular" -> "seguro"
        else -> "menos"
    }

    private val RE_CODO = Regex("skull|triceps-extension|overhead-triceps|french-press|close-grip-(?:[a-z-]*bench|[a-z-]*press|push)|(?:^|-)dips?(?:$|-)|dip-machine")
    private val RE_MUNECA = Regex("push-?ups?(?:$|-)|front-squat|wrist-curl|(?:^|-)clean(?:$|-)|snatch|handstand|(?:^|-)barbell-curl|straight-bar|(?:^|-)dips?(?:$|-)")
    private val RE_MANO = Regex("(grip|farmer|hang|pull-?up|chin-?up)")
    private val RE_IMPACTO = Regex("(^|-)(jumps?|jumping|hops?|hopping|bounds?|bounding|skips?|skipping|burpees?|sprints?|sprinting|runs?|running)(-|$)")

    private fun conImpacto(e: EjercicioCatalogo): Boolean =
        e.categoria == "plyometrics" || RE_IMPACTO.containsMatchIn(e.id)

    private fun sinCargaEspalda(e: EjercicioCatalogo): Boolean = "no_axial_load" in e.etiquetas

    private fun reglaDeZona(zona: String): ReglaZona? = when (zona) {
        "cuello" -> ReglaZona({ e -> "trapezius" in e.principales || !sinCargaEspalda(e) }, pesoEspalda = true)
        "hombros" -> ReglaZona(
            { e ->
                PesosYDiscos.patron(e) in setOf("empuje-v", "empuje-h", "hombro-lat", "pecho-aisl") ||
                    e.principales.any { it in setOf("anterior_deltoid", "lateral_deltoid") }
            },
            segura = "shoulder_safe",
        )
        "codos" -> ReglaZona({ e -> RE_CODO.containsMatchIn(e.id) }, estricta = true)
        "munecas" -> ReglaZona({ e -> RE_MUNECA.containsMatchIn(e.id) }, estricta = true)
        "manos" -> ReglaZona({ e -> RE_MUNECA.containsMatchIn(e.id) || RE_MANO.containsMatchIn(e.id) }, estricta = true)
        "lumbar" -> ReglaZona(
            { e -> PesosYDiscos.patron(e) in setOf("cadera", "lumbar") || !sinCargaEspalda(e) },
            segura = "lower_back_safe",
            pesoEspalda = true,
        )
        "caderas" -> ReglaZona({ e -> PesosYDiscos.patron(e) in setOf("cadera", "gluteo", "rodilla") || conImpacto(e) })
        "rodillas" -> ReglaZona(
            { e -> PesosYDiscos.patron(e) in setOf("rodilla", "cuadriceps") || conImpacto(e) },
            segura = "knee_safe",
            pesoEspalda = true,
        )
        "tobillos", "pies" -> ReglaZona({ e -> conImpacto(e) || PesosYDiscos.patron(e) == "gemelo" }, estricta = true)
        "pecho" -> ReglaZona({ e -> "pectoralis_major" in e.principales })
        "espalda" -> ReglaZona({ e -> e.principales.any { it in setOf("latissimus_dorsi", "rhomboids", "trapezius") } })
        "brazo" -> ReglaZona({ e -> e.principales.any { it in setOf("biceps_brachii", "triceps_brachii", "brachialis") } })
        "abdomen" -> ReglaZona({ e -> PesosYDiscos.patron(e) == "core" || e.principales.any { it in setOf("rectus_abdominis", "obliques", "transverse_abdominis") } })
        "gluteo" -> ReglaZona({ e -> e.principales.any { it in setOf("gluteus_maximus", "gluteus_medius") } })
        "muslo" -> ReglaZona({ e -> "quadriceps" in e.principales })
        "isquio" -> ReglaZona({ e -> "hamstrings" in e.principales })
        "gemelo" -> ReglaZona({ e -> e.principales.any { it in setOf("gastrocnemius", "soleus") } })
        "cabeza" -> ReglaZona({ e -> e.fuerza == "static" || e.categoria == "olympic" })
        "estomago" -> ReglaZona({ e -> PesosYDiscos.patron(e) == "core" || e.principales.any { it in setOf("rectus_abdominis", "obliques") } })
        "hormigueo" -> ReglaZona({ e -> !sinCargaEspalda(e) }, pesoEspalda = true)
        "cansancio", "fiebre" -> ReglaZona({ false })
        else -> null
    }

    fun cargaZona(zona: String, e: EjercicioCatalogo): Boolean = reglaDeZona(zona)?.carga?.invoke(e) == true

    /** Reglas exactas de qué ejercicios quedan fuera, penalizan o bajan RPE/isométricos por molestias y condiciones. */
    fun restricciones(perfil: Perfil): Restricciones {
        val dolores = doloresDe(perfil)
        val cond = perfil.condicionesSalud.orEmpty().toSet()
        val reglas = mutableListOf<(EjercicioCatalogo) -> String?>()
        val leves = mutableListOf<String>()
        val ultimos = mutableListOf<String>()
        var rpeMax: Double? = null
        var maxIso: Int? = null
        fun bajar(r: Double) {
            rpeMax = if (rpeMax == null) r else min(rpeMax!!, r)
        }

        for (d in dolores) {
            val z = reglaDeZona(d.zona) ?: continue
            val nivel = nivelDolor(d)
            val nombre = d.zona
            if (nombre in setOf("cabeza", "cansancio", "fiebre")) bajar(if (nivel == "menos") 7.5 else 7.0)
            if (nombre == "cabeza") maxIso = min(maxIso ?: 30, 30)
            if (nombre == "hormigueo") {
                reglas += { e -> if (z.carga(e)) nombre else null }
                continue
            }
            when (nivel) {
                "fuera" -> reglas += { e -> if (z.carga(e)) nombre else null }
                "seguro" -> {
                    reglas += { e ->
                        if (!z.carga(e) || z.estricta) {
                            null
                        } else {
                            val malo = (z.segura != null && z.segura !in e.etiquetas) ||
                                (z.pesoEspalda && !sinCargaEspalda(e)) ||
                                (z.segura == null && !z.pesoEspalda && e.mecanica == "compound")
                            if (malo) nombre else null
                        }
                    }
                    if (z.estricta) ultimos += nombre
                }
                else -> leves += nombre
            }
        }

        if ("tension" in cond) {
            bajar(8.0)
            maxIso = min(maxIso ?: 30, 30)
            reglas += { e -> if (e.categoria == "olympic" || e.categoria == "plyometrics") "tension" else null }
        }
        if ("osteoporosis" in cond) {
            reglas += { e ->
                if (conImpacto(e) || (PesosYDiscos.patron(e) == "core" && e.fuerza != "static" && e.material != null)) "osteoporosis"
                else null
            }
        }
        if ("protesis" in cond) {
            reglas += { e ->
                if (conImpacto(e) || (PesosYDiscos.patron(e) in setOf("rodilla", "cadera") && "knee_safe" !in e.etiquetas)) "protesis"
                else null
            }
        }
        if ("anticoagulantes" in cond) {
            reglas += { e -> if (conImpacto(e) || e.categoria == "olympic") "anticoagulantes" else null }
        }
        if ("embarazo" in cond) {
            bajar(7.0)
            reglas += { e -> if (conImpacto(e) || e.categoria == "olympic" || PesosYDiscos.patron(e) == "core") "embarazo" else null }
        }

        return Restricciones(
            fuera = { e -> reglas.firstNotNullOfOrNull { it(e) } },
            penaliza = { e ->
                (if (ultimos.any { cargaZona(it, e) }) 1000 else 0) +
                    (if (leves.any { cargaZona(it, e) }) 40 else 0)
            },
            rpeMax = rpeMax,
            maxIsometrico = maxIso,
        )
    }

    fun esfuerzoMaximo(perfil: Perfil): Int {
        val novato = perfil.nivel in setOf("empiezo", "vuelvo") || perfil.modoMayor?.activo == true
        val base = min(if (novato || perfil.sueno == "poco") 8.0 else 9.0, if (perfil.sueno == "poco") 7.5 else 10.0)
        return floor(min(base, restricciones(perfil).rpeMax ?: 10.0)).toInt()
    }

    fun resumenSalud(perfil: Perfil): String {
        val partes = mutableListOf<String>()
        doloresDe(perfil).forEach { partes += nombreZona(it.zona) }
        perfil.condicionesSalud.orEmpty().forEach { c ->
            CONDICIONES_SALUD.firstOrNull { it.clave == c }?.let { partes += it.nombre.lowercase() }
        }
        if (partes.isEmpty() && perfil.lesiones.isNotBlank()) return perfil.lesiones.trim()
        return partes.joinToString(" · ")
    }

    /** Actualiza las molestias del perfil según las respuestas de la revisión semanal. */
    fun doloresTrasRevision(dolores: List<Dolor>, respuestas: List<RespuestaRevision>): List<Dolor> =
        dolores.mapNotNull { d ->
            when (respuestas.firstOrNull { it.zona == d.zona }?.va) {
                "ya" -> null
                "peor" -> d.copy(cuanto = if (d.cuanto == "poco") "regular" else "mucho")
                "mejor" -> if (d.cuanto == "poco") d else d.copy(cuanto = if (d.cuanto == "mucho") "regular" else "poco")
                else -> d
            }
        }

    /** Calcula los cambios reversibles en la rutina para zonas que empeoran o mejoran. */
    fun cambiosRevision(
        rutina: Rutina,
        perfil: Perfil,
        zonasPeor: List<String>,
        zonasMejor: List<Pair<String, Boolean>>, // (zona, delTodo)
        activos: List<CambioRevision>,
        ejerciciosPorId: Map<String, EjercicioCatalogo>,
        gimnasio: Gimnasio? = null,
        marcas: Map<String, MarcaEjercicio> = emptyMap(),
    ): List<CambioRevision> {
        val out = mutableListOf<CambioRevision>()
        val tocados = HashSet<String>()

        // 1) Vuelta progresiva para zonas que mejoran o ya no duelen
        val primeros = LinkedHashMap<String, CambioRevision>()
        for (c in activos) {
            if (c.deshecho != true && c.vuelta != true) {
                primeros.putIfAbsent("${c.letra}|${c.uid}", c)
            }
        }
        for ((zona, delTodo) in zonasMejor) {
            for (c in primeros.values.filter { it.zona == zona }) {
                val actual = rutina.dias.firstOrNull { it.letra == c.letra }?.bloques?.firstOrNull { it.uid == c.uid } ?: continue
                if (actual.uid in tocados) continue
                tocados += actual.uid
                val normal = c.antes.copy(uid = actual.uid, cargaPct = null)
                if (actual == normal) continue
                val despues = if (delTodo || actual.cargaPct == CARGA_VUELTA) normal else normal.copy(cargaPct = CARGA_VUELTA)
                if (actual == despues) continue
                out += CambioRevision(c.uid, c.letra, zona, actual, despues, vuelta = true)
            }
        }

        // 2) Suavizado o sustitución segura para zonas que empeoran o son nuevas
        val rest = restricciones(perfil)
        val mat = gimnasio?.material?.takeIf { it.isNotEmpty() }?.toSet() ?: PesosYDiscos.MATERIAL_HABITUAL
        val candidatos = ejerciciosPorId.values.filter { c ->
            val m = marcas[c.id]
            c.categoria == "strength" &&
                (c.material == null || c.material in mat) &&
                m?.odiado != true && m?.duele != true &&
                rest.fuera(c) == null
        }
        for (dia in rutina.dias) {
            val ocupados = dia.bloques.map { it.ejercicio }.toMutableSet()
            for (zona in zonasPeor) {
                val dolor = doloresDe(perfil).firstOrNull { it.zona == zona }
                val fuera = dolor == null || nivelDolor(dolor) != "menos"
                for (b in dia.bloques) {
                    if (b.uid in tocados) continue
                    val ej = ejerciciosPorId[b.ejercicio] ?: continue
                    if (!cargaZona(zona, ej)) continue
                    val despues = if (fuera) {
                        val pat = PesosYDiscos.patron(ej)
                        val sust = candidatos.firstOrNull { c ->
                            c.id !in ocupados && PesosYDiscos.patron(c) == pat && !cargaZona(zona, c)
                        } ?: candidatos.firstOrNull { c ->
                            c.id !in ocupados && c.zona == ej.zona && !cargaZona(zona, c)
                        }
                        if (sust != null) {
                            ocupados += sust.id
                            b.copy(
                                ejercicio = sust.id,
                                alternativas = b.alternativas.filterNot { it == sust.id },
                                registro = PesosYDiscos.tipoRegistro(sust),
                            )
                        } else {
                            b.copy(series = max(1, b.series - 1), cargaPct = min(b.cargaPct ?: 1.0, CARGA_SUAVE))
                        }
                    } else if (ej.mecanica == "compound") {
                        b.copy(cargaPct = min(b.cargaPct ?: 1.0, CARGA_SUAVE))
                    } else {
                        b.copy(series = max(1, b.series - 1))
                    }
                    if (despues == b) continue
                    out += CambioRevision(b.uid, dia.letra, zona, b, despues)
                    tocados += b.uid
                }
            }
        }
        return out
    }

    fun aplicarCambios(rutina: Rutina, cambios: List<CambioRevision>, deshacer: Boolean = false): Rutina =
        rutina.copy(
            dias = rutina.dias.map { dia ->
                dia.copy(
                    bloques = dia.bloques.map { b ->
                        val c = cambios.firstOrNull { it.uid == b.uid && it.letra == dia.letra } ?: return@map b
                        val de = if (deshacer) c.despues else c.antes
                        val a = if (deshacer) c.antes else c.despues
                        if (b == de) a else b
                    },
                )
            },
        )

    fun textoCambio(c: CambioRevision, nombreDe: (String) -> String): String {
        if (c.antes.ejercicio != c.despues.ejercicio) {
            return "${nombreDe(c.antes.ejercicio)} → ${nombreDe(c.despues.ejercicio)}"
        }
        val partes = mutableListOf<String>()
        if (c.antes.series != c.despues.series) partes += "${c.antes.series} → ${c.despues.series} series"
        if ((c.antes.cargaPct ?: 1.0) != (c.despues.cargaPct ?: 1.0)) {
            val pct = c.despues.cargaPct
            partes += if (pct != null) "peso al ${(pct * 100).roundToInt()} %" else "peso normal"
        }
        return "${nombreDe(c.despues.ejercicio)}: ${partes.joinToString(" · ")}"
    }
}
