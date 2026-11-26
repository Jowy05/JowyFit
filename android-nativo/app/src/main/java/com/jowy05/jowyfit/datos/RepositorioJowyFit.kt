package com.jowy05.jowyfit.datos

import android.content.Context
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.BaseJowyFit
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

enum class PreferenciaTema { SISTEMA, CLARO, OSCURO }
enum class EscalaLetra { NORMAL, GRANDE }
enum class IdiomaApp(val codigo: String, val nombreNativo: String) {
    ES("es", "Español"),
    CA("ca", "Català"),
    EN("en", "English"),
}

data class PreferenciasVisuales(
    val tema: PreferenciaTema = PreferenciaTema.SISTEMA,
    val letra: EscalaLetra = EscalaLetra.NORMAL,
    val idioma: IdiomaApp = IdiomaApp.ES,
)

class RepositorioJowyFit(private val context: Context) {

    private val db = BaseJowyFit.obtener(context)
    private val dao = db.registros()
    private val prefs = context.getSharedPreferences("jowyfit_prefs", Context.MODE_PRIVATE)
    private val dirMedia = File(context.filesDir, "jowyfit_media")

    private val _preferencias = MutableStateFlow(cargarPreferencias())
    val preferencias: StateFlow<PreferenciasVisuales> = _preferencias.asStateFlow()

    val perfil: Flow<Perfil> = dao.observarUno("perfil", "yo").map { reg ->
        reg?.let { decodificar<Perfil>(it.payloadJson) } ?: Perfil()
    }

    val ajustes: Flow<Ajustes> = dao.observarUno("ajustes", "app").map { reg ->
        reg?.let { decodificar<Ajustes>(it.payloadJson) } ?: Ajustes()
    }

    val rutinas: Flow<List<Rutina>> = dao.observarTabla("rutinas").map { lista ->
        lista.mapNotNull { decodificar<Rutina>(it.payloadJson) }
    }

    val sesiones: Flow<List<Sesion>> = dao.observarTabla("sesiones").map { lista ->
        lista.mapNotNull { decodificar<Sesion>(it.payloadJson) }
    }

    val mediciones: Flow<List<Medicion>> = dao.observarTabla("mediciones").map { lista ->
        lista.mapNotNull { decodificar<Medicion>(it.payloadJson) }
    }

    val comidas: Flow<List<Comida>> = dao.observarTabla("comidas").map { lista ->
        lista.mapNotNull { decodificar<Comida>(it.payloadJson) }
    }

    val pasos: Flow<List<PasosDia>> = dao.observarTabla("pasos").map { lista ->
        lista.mapNotNull { decodificar<PasosDia>(it.payloadJson) }
    }

    val metas: Flow<List<Meta>> = dao.observarTabla("metas").map { lista ->
        lista.mapNotNull { decodificar<Meta>(it.payloadJson) }
    }

    val retos: Flow<List<IntentoReto>> = dao.observarTabla("retos").map { lista ->
        lista.mapNotNull { decodificar<IntentoReto>(it.payloadJson) }
    }

    val gimnasios: Flow<List<Gimnasio>> = dao.observarTabla("gimnasios").map { lista ->
        lista.mapNotNull { decodificar<Gimnasio>(it.payloadJson) }
    }

    private fun cargarPreferencias(): PreferenciasVisuales {
        val tema = runCatching {
            PreferenciaTema.valueOf(prefs.getString("tema", PreferenciaTema.SISTEMA.name)!!)
        }.getOrDefault(PreferenciaTema.SISTEMA)
        val letra = runCatching {
            EscalaLetra.valueOf(prefs.getString("letra", EscalaLetra.NORMAL.name)!!)
        }.getOrDefault(EscalaLetra.NORMAL)
        val codIdioma = prefs.getString("idioma", "es") ?: "es"
        val idioma = IdiomaApp.entries.firstOrNull { it.codigo == codIdioma } ?: IdiomaApp.ES
        return PreferenciasVisuales(tema = tema, letra = letra, idioma = idioma)
    }

    fun guardarTema(tema: PreferenciaTema) {
        prefs.edit().putString("tema", tema.name).apply()
        _preferencias.value = _preferencias.value.copy(tema = tema)
    }

    fun guardarLetra(letra: EscalaLetra) {
        prefs.edit().putString("letra", letra.name).apply()
        _preferencias.value = _preferencias.value.copy(letra = letra)
    }

    fun guardarIdioma(idioma: IdiomaApp) {
        prefs.edit().putString("idioma", idioma.codigo).apply()
        _preferencias.value = _preferencias.value.copy(idioma = idioma)
    }

    suspend fun guardarPerfil(perfil: Perfil) = withContext(Dispatchers.IO) {
        val actualizado = if (perfil.creado.isBlank()) {
            perfil.copy(creado = Instant.now().toString())
        } else {
            perfil
        }
        dao.guardar(
            RegistroTablaEntity(
                tabla = "perfil",
                clave = "yo",
                fecha = actualizado.creado.take(10),
                payloadJson = JsonJowyFit.encodeToString(actualizado),
            ),
        )
    }

    suspend fun guardarAjustes(ajustes: Ajustes) = withContext(Dispatchers.IO) {
        dao.guardar(
            RegistroTablaEntity(
                tabla = "ajustes",
                clave = "app",
                fecha = ajustes.inicio ?: LocalDate.now().toString(),
                payloadJson = JsonJowyFit.encodeToString(ajustes),
            ),
        )
    }

    suspend fun apuntarPeso(pesoKg: Double, origen: String = "manual") = withContext(Dispatchers.IO) {
        val existentes = dao.leerTabla("mediciones")
        val nextId = (existentes.mapNotNull { it.clave.toLongOrNull() }.maxOrNull() ?: 0L) + 1L
        val ahora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"))
        val med = Medicion(id = nextId, fecha = ahora, origen = origen, pesoKg = pesoKg)
        dao.guardar(
            RegistroTablaEntity(
                tabla = "mediciones",
                clave = nextId.toString(),
                fecha = ahora.take(10),
                payloadJson = JsonJowyFit.encodeToString(med),
            ),
        )
    }

    suspend fun apuntarComidaRapida(
        nombre: String,
        kcal: Double,
        proteina: Double,
        franja: String,
        fecha: String = LocalDate.now().toString(),
    ) = withContext(Dispatchers.IO) {
        val existentes = dao.leerTabla("comidas")
        val nextId = (existentes.mapNotNull { it.clave.toLongOrNull() }.maxOrNull() ?: 0L) + 1L
        val hora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
        val c = Comida(
            id = nextId,
            fecha = fecha,
            hora = hora,
            franja = franja,
            nombre = nombre.trim(),
            kcal = kcal,
            proteina = proteina,
            tipo = "nota",
        )
        dao.guardar(
            RegistroTablaEntity(
                tabla = "comidas",
                clave = nextId.toString(),
                fecha = fecha,
                payloadJson = JsonJowyFit.encodeToString(c),
            ),
        )
    }

    suspend fun apuntarPasos(pasos: Int, fecha: String = LocalDate.now().toString()) = withContext(Dispatchers.IO) {
        val p = PasosDia(fecha = fecha, pasos = pasos.coerceAtLeast(0), fuente = "manual")
        dao.guardar(
            RegistroTablaEntity(
                tabla = "pasos",
                clave = fecha,
                fecha = fecha,
                payloadJson = JsonJowyFit.encodeToString(p),
            ),
        )
    }

    suspend fun importarCopia(bytes: ByteArray, contrasena: String? = null): Int = withContext(Dispatchers.IO) {
        val leida = GestorCopias.leerCopia(bytes, contrasena)
        if (dirMedia.exists()) dirMedia.deleteRecursively()
        if (leida.archivosMedia.isNotEmpty()) {
            for ((ruta, contenido) in leida.archivosMedia) {
                val destino = File(dirMedia, ruta)
                destino.parentFile?.mkdirs()
                destino.writeBytes(contenido)
            }
        }
        dao.reemplazarTodo(leida.registros)
        leida.registros.size
    }

    suspend fun exportarCopia(contrasena: String? = null): ByteArray = withContext(Dispatchers.IO) {
        val todos = dao.leerTodo()
        val media = LinkedHashMap<String, ByteArray>()
        if (dirMedia.exists()) {
            dirMedia.walkTopDown().filter { it.isFile }.forEach { f ->
                val rel = f.relativeTo(dirMedia).invariantSeparatorsPath
                if (rel.startsWith("archivos/")) {
                    media[rel] = f.readBytes()
                }
            }
        }
        val bytes = GestorCopias.crearCopia(todos, media, contrasena)
        val actuales = dao.leerUno("ajustes", "app")?.let { decodificar<Ajustes>(it.payloadJson) } ?: Ajustes()
        guardarAjustes(actuales.copy(ultimaCopia = Instant.now().toString()))
        bytes
    }

    suspend fun borrarTodosLosDatos() = withContext(Dispatchers.IO) {
        dao.borrarTodo()
        if (dirMedia.exists()) dirMedia.deleteRecursively()
    }

    /** Lectura rápida para el Widget Glance sin necesitar collectors activos. */
    suspend fun resumenParaWidget(): Triple<String, String, String> = withContext(Dispatchers.IO) {
        val p = dao.leerUno("perfil", "yo")?.let { decodificar<Perfil>(it.payloadJson) } ?: Perfil()
        val hoy = LocalDate.now().toString()
        val rutinasLista = dao.leerTabla("rutinas").mapNotNull { decodificar<Rutina>(it.payloadJson) }
        val rutinaActiva = rutinasLista.firstOrNull { it.activa } ?: rutinasLista.firstOrNull()
        val sesionesLista = dao.leerTabla("sesiones").mapNotNull { decodificar<Sesion>(it.payloadJson) }
        val comidasHoy = dao.leerTabla("comidas")
            .filter { it.fecha == hoy }
            .mapNotNull { decodificar<Comida>(it.payloadJson) }
        val pasosHoy = dao.leerUno("pasos", hoy)?.let { decodificar<PasosDia>(it.payloadJson) }?.pasos ?: 0

        val semana = com.jowy05.jowyfit.dominio.CalculosDominio.estadoSemana(rutinaActiva, sesionesLista, hoy)
        val tar = com.jowy05.jowyfit.dominio.CalculosDominio.tarjetaHoy(rutinaActiva, semana, hoy, null)
        val tituloEntreno = when (tar) {
            is com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.Hoy -> tar.dia.nombre
            is com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.Hecho -> "Entreno hecho"
            is com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.Opcional -> "Sesión extra"
            is com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.EnCurso -> tar.sesion.nombre
            is com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.Descanso -> "Hoy descansas"
            com.jowy05.jowyfit.dominio.CalculosDominio.TarjetaHoyEstado.SinRutina -> "Sin rutina aún"
        }
        val protHoy = comidasHoy.sumOf { it.proteina }.toInt()
        val medPeso = dao.leerTabla("mediciones")
            .mapNotNull { decodificar<Medicion>(it.payloadJson) }
            .firstOrNull { it.pesoKg != null }?.pesoKg
        val obj = com.jowy05.jowyfit.dominio.CalculosDominio.calcularObjetivos(p, medPeso)
        Triple(tituloEntreno, "$protHoy / ${obj.proteina} g", "$pasosHoy / ${p.pasosObjetivo}")
    }

    private inline fun <reified T> decodificar(json: String): T? =
        runCatching { JsonJowyFit.decodeFromString<T>(json) }.getOrNull()
}
