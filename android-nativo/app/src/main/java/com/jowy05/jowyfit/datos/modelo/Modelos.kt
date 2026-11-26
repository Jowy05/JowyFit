package com.jowy05.jowyfit.datos.modelo

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** JSON tolerante con campos futuros para preservar fidelidad al importar/exportar copias .jowyfit. */
val JsonJowyFit = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
}

/** Las 17 tablas de Dexie / .jowyfit en el mismo orden exacto. */
val TABLAS_JOWYFIT = listOf(
    "perfil",
    "ajustes",
    "mediciones",
    "fotos",
    "gimnasios",
    "marcas",
    "rutinas",
    "sesiones",
    "comidas",
    "plantillas",
    "productos",
    "pasos",
    "suplementos",
    "metas",
    "propios",
    "revisiones",
    "retos",
)

@Serializable
data class RefArchivo(
    @SerialName("__archivo") val archivo: String,
    val tipo: String = "image/jpeg",
)

@Serializable
data class Dolor(
    val zona: String,
    val cuanto: String = "poco",
    val cuando: String = "aveces",
    val desde: String = "dias",
    val inicio: String = "",
)

@Serializable
data class ModoMayor(
    val activo: Boolean = false,
    val propuesto: String? = null,
    val rechazado: String? = null,
)

@Serializable
data class BatidoPerfil(
    val proteina: Double = 25.0,
    val kcal: Double = 130.0,
)

@Serializable
data class Perfil(
    val id: String = "yo",
    val creado: String = "",
    val altaCompleta: Boolean = false,
    val nombre: String = "",
    val nacimiento: String = "1995-01-01",
    val sexo: String = "hombre",
    val alturaCm: Double = 175.0,
    val objetivo: String = "recomposicion",
    val objetivosExtra: List<String>? = null,
    val prioridades: List<String> = emptyList(),
    val zonasPrioridad: List<String> = emptyList(),
    val zonasMucho: List<String>? = null,
    val nivel: String = "empiezo",
    val referencias: Map<String, String> = emptyMap(),
    val diasFijos: List<Int> = listOf(0, 2, 4),
    val diasOpcionales: List<Int> = listOf(5),
    val horaEntreno: String = "07:00",
    val transporte: String = "coche",
    val horaLimite: Map<String, String> = mapOf("coche" to "08:00", "andando" to "07:45"),
    val minutosNormal: Int = 50,
    val minutosCorta: Int = 35,
    val horaDormir: String = "23:00",
    val enAyunas: Boolean = false,
    val sesionPerdida: String = "sabado",
    val zonasSensibles: List<String> = emptyList(),
    val lesiones: String = "",
    val condiciones: String = "",
    val urgencias: List<String>? = null,
    val dolores: List<Dolor>? = null,
    val condicionesSalud: List<String>? = null,
    val noQuiero: List<String>? = null,
    val modoMayor: ModoMayor? = null,
    val modoRutina: String? = null,
    val preferencia: String = "mezcla",
    val reps: String = "moderadas",
    val superseries: Boolean = true,
    val alFallo: Boolean = false,
    val core: Boolean = true,
    val cardio: String = "pasos",
    val comidasDia: Int = 3,
    val franjasHambre: List<String> = emptyList(),
    val bebidas: List<String> = emptyList(),
    val suplementos: List<String> = emptyList(),
    val dosisSuplementos: Map<String, String>? = null,
    val batido: BatidoPerfil? = null,
    val trabajo: String = "sentado",
    val pasosObjetivo: Int = 8000,
    val cardioMin: Int? = null,
    val cardioTipos: List<String>? = null,
    val cardioCuando: String? = null,
    val progresoMovimiento: String? = null,
    val sueno: String? = null,
    val deportes: List<String>? = null,
    val diaDeporte: Int? = null,
    val experienciaPrevia: String? = null,
    val diasPesaje: List<Int> = listOf(0, 3),
    val fotosCadaSemanas: Int = 4,
)

@Serializable
data class Bascula(
    val grasaPct: Double? = null,
    val masaGrasaKg: Double? = null,
    val masaLibreKg: Double? = null,
    val musculoKg: Double? = null,
    val musculoEsqKg: Double? = null,
    val aguaPct: Double? = null,
    val proteinaPct: Double? = null,
    val oseaKg: Double? = null,
    val visceral: Double? = null,
    val subcutaneaPct: Double? = null,
    val basalKcal: Double? = null,
    val edadCorporal: Double? = null,
)

@Serializable
data class Perimetros(
    val cintura: Double? = null,
    val cuello: Double? = null,
    val cadera: Double? = null,
    val pecho: Double? = null,
    val brazo: Double? = null,
    val brazoContraido: Double? = null,
    val muslo: Double? = null,
)

@Serializable
data class Medicion(
    val id: Long? = null,
    val fecha: String,
    val origen: String = "manual",
    val pesoKg: Double? = null,
    val perimetros: Perimetros? = null,
    val bascula: Bascula? = null,
    val hc: List<String>? = null,
    val fuente: String? = null,
)

@Serializable
data class FotoProgreso(
    val id: Long? = null,
    val fecha: String,
    val pose: String = "frente",
    val imagen: RefArchivo? = null,
)

@Serializable
data class Tramo(
    val desde: Double,
    val hasta: Double,
    val paso: Double,
)

@Serializable
data class MaquinaPropia(
    val id: String,
    val nombre: String,
    val parecida: String? = null,
    val foto: RefArchivo? = null,
    val notas: String? = null,
)

@Serializable
data class Gimnasio(
    val id: Long? = null,
    val nombre: String = "Mi gimnasio",
    val notas: String = "",
    val material: List<String> = emptyList(),
    val propias: List<MaquinaPropia> = emptyList(),
    val mancuernas: List<Tramo> = emptyList(),
    val discos: List<Double> = listOf(1.25, 2.5, 5.0, 10.0, 15.0, 20.0),
    val barraKg: Double = 20.0,
    val creado: String = "",
)

@Serializable
data class MarcaEjercicio(
    val id: String,
    val favorito: Boolean? = null,
    val odiado: Boolean? = null,
    val duele: Boolean? = null,
    val notas: String? = null,
    val ajustes: String? = null,
)

@Serializable
data class EjercicioPropio(
    val id: String,
    val nombre: String,
    val grupo: String = "completo",
    val material: String = "otro",
    val registro: String = "peso",
    val unilateral: Boolean? = null,
    val foto: RefArchivo? = null,
    val notas: String? = null,
    val rutinaAuto: Boolean = false,
    val creado: String = "",
    val borrado: String? = null,
)

@Serializable
data class Bloque(
    val uid: String,
    val ejercicio: String,
    val alternativas: List<String> = emptyList(),
    val series: Int = 3,
    val repsMin: Int = 8,
    val repsMax: Int = 12,
    val rpe: Double = 8.0,
    val descanso: Int = 90,
    val superserie: String? = null,
    val fueraEnCorta: Boolean? = null,
    val registro: String = "peso",
    val cargaPct: Double? = null,
)

@Serializable
data class DiaRutina(
    val letra: String,
    val nombre: String,
    val dia: Int? = null,
    val opcional: Boolean = false,
    val bloques: List<Bloque> = emptyList(),
)

@Serializable
data class Rutina(
    val id: Long? = null,
    val creada: String = "",
    val activa: Boolean = true,
    val estructura: String = "",
    val porque: List<String> = emptyList(),
    val calibracion: Boolean = false,
    val gimnasioId: Long? = null,
    val dias: List<DiaRutina> = emptyList(),
    val equilibrio: Int? = null,
    val sinCubrir: List<String>? = null,
)

@Serializable
data class Serie(
    val n: Int,
    val peso: Double? = null,
    val reps: Int? = null,
    val segundos: Int? = null,
    val rpe: Double? = null,
    val calentamiento: Boolean = false,
    val hecha: Boolean = false,
    val ts: Long? = null,
    val nota: String? = null,
    val record: Boolean? = null,
    val izq: Int? = null,
    val der: Int? = null,
    val km: Double? = null,
)

@Serializable
data class EjercicioSesion(
    val uid: String,
    val ejercicio: String,
    val planificado: String = ejercicio,
    val motivo: String? = null,
    val estado: String = "pendiente",
    val series: List<Serie> = emptyList(),
    val inicio: Long? = null,
    val fin: Long? = null,
    val repsMin: Int = 8,
    val repsMax: Int = 12,
    val rpe: Double = 8.0,
    val descanso: Int = 90,
    val superserie: String? = null,
    val registro: String = "peso",
    val cargaPct: Double? = null,
    val molestia: Boolean? = null,
    val fueraEnCorta: Boolean? = null,
)

@Serializable
data class RespuestasSesion(
    val minutosReales: Int? = null,
    val descansos: String? = null,
    val molestia: String? = null,
    val ocupado: String? = null,
    val nota: String? = null,
)

@Serializable
data class Sesion(
    val id: Long? = null,
    val fecha: String,
    val rutinaId: Long? = null,
    val letra: String = "A",
    val nombre: String = "",
    val gimnasioId: Long? = null,
    val inicio: Long = 0L,
    val fin: Long? = null,
    val horaLimite: String? = null,
    val version: String = "normal",
    val estado: String = "hecha",
    val ejercicios: List<EjercicioSesion> = emptyList(),
    val descansoHasta: Long? = null,
    val descansoTotal: Int? = null,
    val respuestas: RespuestasSesion? = null,
    val calibracion: Boolean = false,
    val suave: Boolean? = null,
)

@Serializable
data class Comida(
    val id: Long? = null,
    val fecha: String,
    val hora: String = "13:00",
    val franja: String = "comida",
    val nombre: String,
    val kcal: Double = 0.0,
    val proteina: Double = 0.0,
    val cafeina: Double? = null,
    val racion: String = "N",
    val tipo: String = "nota",
    val plantillaId: Long? = null,
    val codigo: String? = null,
    val foto: RefArchivo? = null,
    val suplemento: String? = null,
    val hidratos: Double? = null,
    val azucares: Double? = null,
    val grasas: Double? = null,
    val sal: Double? = null,
)

@Serializable
data class Plantilla(
    val id: Long? = null,
    val nombre: String,
    val kcal: Double = 0.0,
    val proteina: Double = 0.0,
    val cafeina: Double? = null,
    val franja: String? = null,
    val tipo: String = "comida",
    val usos: Int = 0,
    val foto: RefArchivo? = null,
    val codigo: String? = null,
    val hidratos: Double? = null,
    val azucares: Double? = null,
    val grasas: Double? = null,
    val sal: Double? = null,
)

@Serializable
data class Producto(
    val codigo: String,
    val nombre: String,
    val marca: String = "",
    val imagen: String? = null,
    val kcal100: Double? = null,
    val proteina100: Double? = null,
    val hidratos100: Double? = null,
    val grasas100: Double? = null,
    val azucares100: Double? = null,
    val sal100: Double? = null,
    val cafeina100: Double? = null,
    val racionG: Double? = null,
    val kcalRacion: Double? = null,
    val proteinaRacion: Double? = null,
    val guardado: String = "",
    val pendiente: Boolean? = null,
    val manual: Boolean? = null,
)

@Serializable
data class CardioEntrada(
    val tipo: String,
    val min: Int,
)

@Serializable
data class PasosDia(
    val fecha: String,
    val pasos: Int = 0,
    val fuente: String = "manual",
    val troteKm: Double? = null,
    val cardio: List<CardioEntrada>? = null,
)

@Serializable
data class DiaSuplementos(
    val fecha: String,
    val tomados: List<String> = emptyList(),
)

@Serializable
data class HitoMeta(
    val fecha: String,
    val valor: Double,
    val nota: String? = null,
)

@Serializable
data class Meta(
    val id: Long? = null,
    val tipo: String = "libre",
    val titulo: String,
    val objetivo: Double,
    val unidad: String = "",
    val fecha: String? = null,
    val ejercicio: String? = null,
    val inicio: Double? = null,
    val actual: Double? = null,
    val historial: List<HitoMeta>? = null,
    val hecha: Boolean? = null,
)

@Serializable
data class Recolocada(
    val fecha: String,
    val letra: String,
    val desde: String,
)

@Serializable
data class BloquePlantilla(
    val ejercicio: String,
    val series: Int,
    val repsMin: Int,
    val repsMax: Int,
    val descanso: Int,
    val registro: String,
)

@Serializable
data class PlantillaEntreno(
    val id: String,
    val nombre: String,
    val ejercicios: List<BloquePlantilla>,
    val creado: String,
)

@Serializable
data class NotificacionesAjustes(
    val dormir: Boolean = false,
    val pesarse: Boolean = false,
    val pesarseHora: String = "08:00",
    val batido: Boolean = false,
    val batidoHora: String = "17:00",
    val creatina: Boolean = false,
    val creatinaHora: String = "09:00",
    val copia: Boolean = true,
    val fotos: Boolean = false,
    val domingo: Boolean = true,
    val revision: Boolean? = true,
    val revisionHora: String? = "19:00",
    val pasos: Boolean? = false,
    val pasosHora: String? = "18:00",
)

@Serializable
data class Ajustes(
    val id: String = "app",
    val gimnasioActivo: Long? = null,
    val descansoCompuesto: Int = 120,
    val descansoAislamiento: Int = 75,
    val vibrar: Boolean = true,
    val sonido: Boolean = true,
    val pantallaEncendida: Boolean = true,
    val calentamiento: Boolean = true,
    val avisosSeguridad: Boolean = true,
    val mostrarKcal: Boolean = true,
    val kcalManual: Int? = null,
    val proteinaManual: Int? = null,
    val cafeinaLimite: Int = 400,
    val cafeinaHoraTope: String = "16:00",
    val fuentePasos: String = "manual",
    val fuenteBascula: String? = "manual",
    val entrenosASalud: Boolean? = false,
    val noti: NotificacionesAjustes = NotificacionesAjustes(),
    val copiaAuto: Boolean = false,
    val copiasAuto: Int = 5,
    val ultimaCopia: String? = null,
    val ultimoAjusteEnergia: String? = null,
    val pasosPorKm: Int? = 1300,
    val recolocadas: List<Recolocada> = emptyList(),
    val inicio: String? = null,
    val entrenosLibres: List<PlantillaEntreno>? = null,
)

@Serializable
data class IntentoReto(
    val id: Long? = null,
    val fecha: String,
    val reto: String,
    val valor: Int,
    val invalidas: Int? = null,
    val duracionS: Int,
    val modo: String = "manual",
    val record: Boolean? = null,
)
