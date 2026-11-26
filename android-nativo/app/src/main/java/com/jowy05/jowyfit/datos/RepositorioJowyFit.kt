package com.jowy05.jowyfit.datos

import android.content.Context
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.db.BaseJowyFit
import com.jowy05.jowyfit.datos.db.RegistroTablaEntity
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.DiaSuplementos
import com.jowy05.jowyfit.datos.modelo.FotoProgreso
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.datos.modelo.Revision
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.dominio.ComidaDominio
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

    val marcas: Flow<List<MarcaEjercicio>> = dao.observarTabla("marcas").map { lista ->
        lista.mapNotNull { decodificar<MarcaEjercicio>(it.payloadJson) }
    }

    val plantillas: Flow<List<Plantilla>> = dao.observarTabla("plantillas").map { lista ->
        lista.mapNotNull { decodificar<Plantilla>(it.payloadJson) }
    }

    val productos: Flow<List<Producto>> = dao.observarTabla("productos").map { lista ->
        lista.mapNotNull { decodificar<Producto>(it.payloadJson) }
    }

    val suplementos: Flow<List<DiaSuplementos>> = dao.observarTabla("suplementos").map { lista ->
        lista.mapNotNull { decodificar<DiaSuplementos>(it.payloadJson) }
    }

    val fotos: Flow<List<FotoProgreso>> = dao.observarTabla("fotos").map { lista ->
        lista.mapNotNull { decodificar<FotoProgreso>(it.payloadJson) }
    }

    val revisiones: Flow<List<Revision>> = dao.observarTabla("revisiones").map { lista ->
        lista.mapNotNull { decodificar<Revision>(it.payloadJson) }
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

    suspend fun siguienteIdTabla(tabla: String): Long = withContext(Dispatchers.IO) {
        (dao.leerTabla(tabla).mapNotNull { it.clave.toLongOrNull() }.maxOrNull() ?: 0L) + 1L
    }

    suspend fun guardarRutina(rutina: Rutina, desactivarOtras: Boolean = false): Rutina = withContext(Dispatchers.IO) {
        val id = rutina.id ?: siguienteIdTabla("rutinas")
        val final = rutina.copy(id = id)
        if (desactivarOtras) {
            val previas = dao.leerTabla("rutinas").mapNotNull { decodificar<Rutina>(it.payloadJson) }
            for (r in previas) {
                if (r.id != null && r.id != id && r.activa) {
                    val inactiva = r.copy(activa = false)
                    dao.guardar(RegistroTablaEntity("rutinas", r.id.toString(), r.creada.take(10), JsonJowyFit.encodeToString(inactiva)))
                }
            }
        }
        dao.guardar(RegistroTablaEntity("rutinas", id.toString(), final.creada.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun guardarSesion(sesion: Sesion): Sesion = withContext(Dispatchers.IO) {
        val id = sesion.id ?: siguienteIdTabla("sesiones")
        val final = sesion.copy(id = id)
        dao.guardar(RegistroTablaEntity("sesiones", id.toString(), final.fecha.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarSesion(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("sesiones", id.toString())
    }

    suspend fun guardarMarca(marca: MarcaEjercicio) = withContext(Dispatchers.IO) {
        dao.guardar(RegistroTablaEntity("marcas", marca.id, "", JsonJowyFit.encodeToString(marca)))
    }

    suspend fun guardarGimnasio(gimnasio: Gimnasio): Gimnasio = withContext(Dispatchers.IO) {
        val id = gimnasio.id ?: siguienteIdTabla("gimnasios")
        val final = gimnasio.copy(id = id, creado = gimnasio.creado.ifBlank { Instant.now().toString() })
        dao.guardar(RegistroTablaEntity("gimnasios", id.toString(), final.creado.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarGimnasio(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("gimnasios", id.toString())
    }

    suspend fun guardarComida(comida: Comida): Comida = withContext(Dispatchers.IO) {
        val id = comida.id ?: siguienteIdTabla("comidas")
        val final = comida.copy(id = id, nombre = comida.nombre.trim())
        dao.guardar(RegistroTablaEntity("comidas", id.toString(), final.fecha.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarComida(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("comidas", id.toString())
    }

    suspend fun copiarComidasDia(desde: String, hacia: String, franja: String? = null): Int = withContext(Dispatchers.IO) {
        val origen = dao.leerTabla("comidas")
            .mapNotNull { decodificar<Comida>(it.payloadJson) }
            .filter { it.fecha == desde && (franja == null || it.franja == franja) }
            .sortedBy { it.hora }
        if (origen.isEmpty()) return@withContext 0
        var nextId = siguienteIdTabla("comidas")
        val entidades = origen.map { c ->
            val copia = c.copy(id = nextId++, fecha = hacia, suplemento = null)
            RegistroTablaEntity("comidas", copia.id.toString(), hacia.take(10), JsonJowyFit.encodeToString(copia))
        }
        dao.guardarVarios(entidades)
        entidades.size
    }

    suspend fun guardarPlantilla(plantilla: Plantilla): Plantilla = withContext(Dispatchers.IO) {
        val id = plantilla.id ?: siguienteIdTabla("plantillas")
        val final = plantilla.copy(id = id, nombre = plantilla.nombre.trim())
        dao.guardar(RegistroTablaEntity("plantillas", id.toString(), "", JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarPlantilla(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("plantillas", id.toString())
    }

    suspend fun apuntarPlantilla(plantilla: Plantilla, racion: String, fecha: String, franja: String): Comida = withContext(Dispatchers.IO) {
        val macros = ComidaDominio.Macros(plantilla.hidratos, plantilla.grasas, plantilla.azucares, plantilla.sal)
        val v = ComidaDominio.conRacion(plantilla.kcal, plantilla.proteina, plantilla.cafeina, macros, racion, plantilla.tipo)
        val hora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
        val tipoComida = if (plantilla.tipo == "comida") "plantilla" else plantilla.tipo
        val nueva = guardarComida(
            Comida(
                fecha = fecha,
                hora = hora,
                franja = franja,
                nombre = plantilla.nombre,
                kcal = v.kcal,
                proteina = v.proteina,
                cafeina = v.cafeina,
                racion = racion,
                tipo = tipoComida,
                plantillaId = plantilla.id,
                codigo = plantilla.codigo,
                foto = plantilla.foto,
                hidratos = v.hidratos,
                azucares = v.azucares,
                grasas = v.grasas,
                sal = v.sal,
            ),
        )
        if (plantilla.id != null) {
            guardarPlantilla(plantilla.copy(usos = plantilla.usos + 1))
        }
        nueva
    }

    suspend fun guardarProducto(producto: Producto) = withContext(Dispatchers.IO) {
        dao.guardar(RegistroTablaEntity("productos", producto.codigo, producto.guardado.take(10), JsonJowyFit.encodeToString(producto)))
    }

    suspend fun borrarProducto(codigo: String) = withContext(Dispatchers.IO) {
        dao.borrarUno("productos", codigo)
    }

    suspend fun guardarPlantillaDesdeProducto(producto: Producto): Boolean = withContext(Dispatchers.IO) {
        val existentes = dao.leerTabla("plantillas").mapNotNull { decodificar<Plantilla>(it.payloadJson) }
        if (existentes.any { it.codigo == producto.codigo }) return@withContext false
        val p = ComidaDominio.porRacion(producto)
        guardarPlantilla(
            Plantilla(
                nombre = producto.nombre,
                kcal = p.kcal,
                proteina = p.proteina,
                cafeina = p.cafeina,
                tipo = "comida",
                usos = 0,
                codigo = producto.codigo,
                hidratos = p.macros.hidratos,
                azucares = p.macros.azucares,
                grasas = p.macros.grasas,
                sal = p.macros.sal,
            ),
        )
        true
    }

    suspend fun alternarSuplemento(perfil: Perfil, fecha: String, suplemento: String): Boolean = withContext(Dispatchers.IO) {
        val actual = dao.leerUno("suplementos", fecha)?.let { decodificar<DiaSuplementos>(it.payloadJson) }
        val tomados = actual?.tomados?.toMutableSet() ?: LinkedHashSet()
        val marcado = if (suplemento in tomados) {
            tomados.remove(suplemento)
            false
        } else {
            tomados.add(suplemento)
            true
        }
        dao.guardar(RegistroTablaEntity("suplementos", fecha, fecha, JsonJowyFit.encodeToString(DiaSuplementos(fecha, tomados.toList()))))

        if (ComidaDominio.esBatido(suplemento)) {
            if (marcado) {
                val b = perfil.batido
                val kcal = b?.kcal ?: 120.0
                val prot = b?.proteina ?: 24.0
                val hora = if (fecha == LocalDate.now().toString()) LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")) else "17:30"
                val franja = ComidaDominio.franjaPorHora(hora)
                guardarComida(
                    Comida(
                        fecha = fecha,
                        hora = hora,
                        franja = franja,
                        nombre = suplemento,
                        kcal = kcal,
                        proteina = prot,
                        racion = "N",
                        tipo = "plantilla",
                        suplemento = suplemento,
                    ),
                )
            } else {
                val vinculadas = dao.leerTabla("comidas")
                    .mapNotNull { decodificar<Comida>(it.payloadJson) }
                    .filter { it.fecha == fecha && it.suplemento == suplemento }
                for (c in vinculadas) {
                    c.id?.let { dao.borrarUno("comidas", it.toString()) }
                }
            }
        }
        marcado
    }

    /** Resuelve una ruta multimedia bloqueando cualquier intento de salir de `dirMedia` (path traversal). */
    fun archivoMedia(rutaRelativa: String): File {
        require(GestorCopias.esRutaMediaSegura(rutaRelativa)) { "Ruta multimedia no válida" }
        val base = dirMedia.canonicalFile
        val candidato = File(base, rutaRelativa).canonicalFile
        require(candidato.path.startsWith(base.path + File.separator)) { "Ruta multimedia fuera de la carpeta permitida" }
        return candidato
    }

    suspend fun guardarMediaBytes(rutaRelativa: String, bytes: ByteArray): File = withContext(Dispatchers.IO) {
        val f = archivoMedia(rutaRelativa)
        f.parentFile?.mkdirs()
        f.writeBytes(bytes)
        f
    }

    suspend fun guardarMedicion(medicion: Medicion): Medicion = withContext(Dispatchers.IO) {
        val id = medicion.id ?: siguienteIdTabla("mediciones")
        val final = medicion.copy(id = id)
        dao.guardar(RegistroTablaEntity("mediciones", id.toString(), final.fecha.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarMedicion(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("mediciones", id.toString())
    }

    suspend fun guardarMeta(meta: Meta): Meta = withContext(Dispatchers.IO) {
        val id = meta.id ?: siguienteIdTabla("metas")
        val final = meta.copy(id = id, titulo = meta.titulo.trim())
        dao.guardar(RegistroTablaEntity("metas", id.toString(), final.fecha?.take(10).orEmpty(), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarMeta(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("metas", id.toString())
    }

    suspend fun guardarIntentoReto(intento: IntentoReto): IntentoReto = withContext(Dispatchers.IO) {
        val id = intento.id ?: siguienteIdTabla("retos")
        val final = intento.copy(id = id)
        dao.guardar(RegistroTablaEntity("retos", id.toString(), final.fecha.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun borrarIntentoReto(id: Long) = withContext(Dispatchers.IO) {
        dao.borrarUno("retos", id.toString())
    }

    suspend fun guardarFotoProgreso(pose: String, bytes: ByteArray, fecha: String = LocalDate.now().toString()): FotoProgreso = withContext(Dispatchers.IO) {
        val id = siguienteIdTabla("fotos")
        val ruta = "archivos/foto-${System.currentTimeMillis()}.jpg"
        guardarMediaBytes(ruta, bytes)
        val foto = FotoProgreso(
            id = id,
            fecha = fecha,
            pose = pose,
            imagen = com.jowy05.jowyfit.datos.modelo.RefArchivo(archivo = ruta, tipo = "image/jpeg"),
        )
        dao.guardar(RegistroTablaEntity("fotos", id.toString(), fecha, JsonJowyFit.encodeToString(foto)))
        foto
    }

    suspend fun borrarFotoProgreso(foto: FotoProgreso) = withContext(Dispatchers.IO) {
        foto.id?.let { dao.borrarUno("fotos", it.toString()) }
        foto.imagen?.archivo?.let { rel -> runCatching { archivoMedia(rel).delete() } }
    }

    suspend fun guardarPasosDia(pasosDia: PasosDia) = withContext(Dispatchers.IO) {
        dao.guardar(RegistroTablaEntity("pasos", pasosDia.fecha, pasosDia.fecha, JsonJowyFit.encodeToString(pasosDia)))
    }

    suspend fun guardarRevision(revision: Revision): Revision = withContext(Dispatchers.IO) {
        val id = revision.id ?: siguienteIdTabla("revisiones")
        val final = revision.copy(id = id)
        dao.guardar(RegistroTablaEntity("revisiones", id.toString(), final.fecha.take(10), JsonJowyFit.encodeToString(final)))
        final
    }

    suspend fun importarCopia(bytes: ByteArray, contrasena: String? = null): Int = withContext(Dispatchers.IO) {
        val leida = GestorCopias.leerCopia(bytes, contrasena)
        val dirTmp = File(context.filesDir, "jowyfit_media_tmp_${System.nanoTime()}")
        try {
            if (leida.archivosMedia.isNotEmpty()) {
                val baseTmp = dirTmp.canonicalFile
                for ((ruta, contenido) in leida.archivosMedia) {
                    if (!GestorCopias.esRutaMediaSegura(ruta)) continue
                    val destino = File(baseTmp, ruta).canonicalFile
                    if (!destino.path.startsWith(baseTmp.path + File.separator)) continue
                    destino.parentFile?.mkdirs()
                    destino.writeBytes(contenido)
                }
            }
            // Primero la transacción atómica en SQLite; solo si tiene éxito se sustituyen las fotos.
            dao.reemplazarTodo(leida.registros)
            if (dirMedia.exists()) dirMedia.deleteRecursively()
            if (dirTmp.exists() && !dirTmp.renameTo(dirMedia)) {
                dirTmp.copyRecursively(dirMedia, overwrite = true)
                dirTmp.deleteRecursively()
            }
            leida.registros.size
        } catch (e: Exception) {
            if (dirTmp.exists()) dirTmp.deleteRecursively()
            throw e
        }
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
