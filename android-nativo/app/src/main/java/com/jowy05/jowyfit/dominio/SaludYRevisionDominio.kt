package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.CambioRevision
import com.jowy05.jowyfit.datos.modelo.Dolor
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.RespuestaRevision
import com.jowy05.jowyfit.datos.modelo.Rutina
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Salud, molestias y Revisión semanal reversible (1:1 con src/dominio/salud.ts y revision.ts). */
object SaludYRevisionDominio {

    const val CARGA_SUAVE = 0.8
    const val CARGA_VUELTA = 0.9

    data class ZonaInfo(val clave: String, val nombre: String)
    data class CondicionInfo(val clave: String, val nombre: String, val resumen: String)

    val ZONAS_DOLOR: List<ZonaInfo> = listOf(
        ZonaInfo("cuello", "Cuello"),
        ZonaInfo("hombros", "Hombros"),
        ZonaInfo("codos", "Codos"),
        ZonaInfo("munecas", "Muñecas"),
        ZonaInfo("lumbar", "Lumbar"),
        ZonaInfo("caderas", "Caderas"),
        ZonaInfo("rodillas", "Rodillas"),
        ZonaInfo("tobillos", "Tobillos"),
        ZonaInfo("pecho", "Pecho"),
        ZonaInfo("espalda", "Espalda"),
        ZonaInfo("brazo", "Brazo"),
        ZonaInfo("abdomen", "Abdomen"),
        ZonaInfo("gluteo", "Glúteo"),
        ZonaInfo("muslo", "Muslo"),
        ZonaInfo("isquio", "Isquio"),
        ZonaInfo("gemelo", "Gemelo"),
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

    fun nivelDolor(d: Dolor): String = when {
        d.cuanto == "mucho" || d.cuando == "siempre" -> "fuera"
        d.cuanto == "regular" -> "seguro"
        else -> "menos"
    }

    private val RE_CODO = Regex("skull|triceps-extension|overhead-triceps|french-press|close-grip-(?:[a-z-]*bench|[a-z-]*press|push)|(?:^|-)dips?(?:$|-)|dip-machine")
    private val RE_MUNECA = Regex("push-?ups?(?:$|-)|front-squat|wrist-curl|(?:^|-)clean(?:$|-)|snatch|handstand|(?:^|-)barbell-curl|straight-bar|(?:^|-)dips?(?:$|-)")
    private val RE_IMPACTO = Regex("(^|-)(jumps?|jumping|hops?|hopping|bounds?|bounding|skips?|skipping|burpees?|sprints?|sprinting|runs?|running)(-|$)")

    fun cargaZona(zona: String, e: EjercicioCatalogo): Boolean {
        val pat = PesosYDiscos.patron(e)
        val impacto = e.categoria == "plyometrics" || RE_IMPACTO.containsMatchIn(e.id)
        val sinAxial = "no_axial_load" in e.etiquetas
        return when (zona) {
            "cuello" -> "trapezius" in e.principales || !sinAxial
            "hombros" -> pat in setOf("empuje-v", "empuje-h", "hombro-lat", "pecho-aisl") ||
                e.principales.any { it in setOf("anterior_deltoid", "lateral_deltoid") }
            "codos" -> RE_CODO.containsMatchIn(e.id)
            "munecas" -> RE_MUNECA.containsMatchIn(e.id)
            "lumbar" -> pat in setOf("cadera", "lumbar") || !sinAxial
            "caderas" -> pat in setOf("cadera", "gluteo", "rodilla") || impacto
            "rodillas" -> pat in setOf("rodilla", "cuadriceps") || impacto
            "tobillos" -> impacto || pat == "gemelo"
            "pecho" -> "pectoralis_major" in e.principales
            "espalda" -> e.principales.any { it in setOf("latissimus_dorsi", "rhomboids", "trapezius") }
            "brazo" -> e.principales.any { it in setOf("biceps_brachii", "triceps_brachii", "brachialis") }
            "abdomen" -> pat == "core" || e.principales.any { it in setOf("rectus_abdominis", "obliques") }
            "gluteo" -> e.principales.any { it in setOf("gluteus_maximus", "gluteus_medius") }
            "muslo" -> "quadriceps" in e.principales
            "isquio" -> "hamstrings" in e.principales
            "gemelo" -> e.principales.any { it in setOf("gastrocnemius", "soleus") }
            else -> false
        }
    }

    fun resumenSalud(perfil: Perfil): String {
        val partes = mutableListOf<String>()
        perfil.dolores.orEmpty().forEach { partes += nombreZona(it.zona) }
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
        val mat = gimnasio?.material?.takeIf { it.isNotEmpty() }?.toSet() ?: PesosYDiscos.MATERIAL_HABITUAL
        val candidatos = ejerciciosPorId.values.filter { it.categoria == "strength" && (it.material == null || it.material in mat) }
        for (dia in rutina.dias) {
            val ocupados = dia.bloques.map { it.ejercicio }.toMutableSet()
            for (zona in zonasPeor) {
                val dolor = perfil.dolores.orEmpty().firstOrNull { it.zona == zona }
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
