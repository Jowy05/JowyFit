package com.jowy05.jowyfit.ui

import android.app.Application
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.jowy05.jowyfit.datos.EscalaLetra
import com.jowy05.jowyfit.datos.IdiomaApp
import com.jowy05.jowyfit.datos.PreferenciaTema
import com.jowy05.jowyfit.datos.PreferenciasVisuales
import com.jowy05.jowyfit.datos.RepositorioJowyFit
import com.jowy05.jowyfit.datos.catalogo.CargadorCatalogo
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.copias.CifradoCopia
import com.jowy05.jowyfit.datos.copias.GestorCopias
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.BloquePlantilla
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.PlantillaEntreno
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.dominio.GeneradorRutina
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.nativo.ServicioDescanso
import com.jowy05.jowyfit.widget.WidgetHoy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate

data class EstadoPrincipal(
    val cargando: Boolean = true,
    val perfil: Perfil = Perfil(),
    val ajustes: Ajustes = Ajustes(),
    val rutinas: List<Rutina> = emptyList(),
    val sesiones: List<Sesion> = emptyList(),
    val mediciones: List<Medicion> = emptyList(),
    val comidas: List<Comida> = emptyList(),
    val pasos: List<PasosDia> = emptyList(),
    val metas: List<Meta> = emptyList(),
    val retos: List<IntentoReto> = emptyList(),
    val gimnasios: List<Gimnasio> = emptyList(),
    val marcas: Map<String, MarcaEjercicio> = emptyMap(),
) {
    val rutinaActiva: Rutina? get() = rutinas.firstOrNull { it.activa } ?: rutinas.firstOrNull()
    val sesionEnCurso: Sesion? get() = sesiones.firstOrNull { it.estado == "curso" }
    val ultimoPeso: Double? get() = mediciones.firstOrNull { it.pesoKg != null }?.pesoKg
    val gimnasioActivo: Gimnasio?
        get() = gimnasios.firstOrNull { it.id == ajustes.gimnasioActivo } ?: gimnasios.firstOrNull()
}

class EstadoAppViewModel(app: Application) : AndroidViewModel(app) {

    val repo = RepositorioJowyFit(app)
    val preferencias: StateFlow<PreferenciasVisuales> = repo.preferencias

    private val _catalogo = MutableStateFlow<CatalogoCargado?>(null)
    val catalogo: StateFlow<CatalogoCargado?> = _catalogo.asStateFlow()

    private val _aviso = MutableStateFlow<String?>(null)
    val aviso: StateFlow<String?> = _aviso.asStateFlow()

    private val _bytesPendientesClave = MutableStateFlow<ByteArray?>(null)
    val bytesPendientesClave: StateFlow<ByteArray?> = _bytesPendientesClave.asStateFlow()

    private val _errorClave = MutableStateFlow<String?>(null)
    val errorClave: StateFlow<String?> = _errorClave.asStateFlow()

    private val _sesionRecienTerminada = MutableStateFlow<Sesion?>(null)
    val sesionRecienTerminada: StateFlow<Sesion?> = _sesionRecienTerminada.asStateFlow()

    private val bloqueA = combine(repo.perfil, repo.ajustes, repo.rutinas, repo.sesiones, repo.mediciones) { p, a, r, s, m ->
        BloqueA(p, a, r, s, m)
    }
    private val bloqueB = combine(repo.comidas, repo.pasos, repo.metas, repo.retos, repo.gimnasios) { c, pa, me, re, g ->
        BloqueB(c, pa, me, re, g)
    }

    val estado: StateFlow<EstadoPrincipal> = combine(bloqueA, bloqueB, repo.marcas) { a, b, mar ->
        EstadoPrincipal(
            cargando = false,
            perfil = a.perfil,
            ajustes = a.ajustes,
            rutinas = a.rutinas,
            sesiones = a.sesiones,
            mediciones = a.mediciones,
            comidas = b.comidas,
            pasos = b.pasos,
            metas = b.metas,
            retos = b.retos,
            gimnasios = b.gimnasios,
            marcas = mar.associateBy { it.id },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), EstadoPrincipal())

    init {
        recargarCatalogo(preferencias.value.idioma)
    }

    private fun recargarCatalogo(idioma: IdiomaApp) {
        viewModelScope.launch {
            runCatching { CargadorCatalogo.cargar(getApplication(), idioma.codigo) }
                .onSuccess { _catalogo.value = it }
        }
    }

    fun mostrarAviso(msg: String) { _aviso.value = msg }
    fun limpiarAviso() { _aviso.value = null }
    fun cerrarFinEntreno() { _sesionRecienTerminada.value = null }

    fun cambiarTema(tema: PreferenciaTema) = repo.guardarTema(tema)
    fun cambiarLetra(letra: EscalaLetra) = repo.guardarLetra(letra)
    fun cambiarIdioma(idioma: IdiomaApp) {
        repo.guardarIdioma(idioma)
        recargarCatalogo(idioma)
    }

    fun completarAltaRapida(nombre: String, sexo: String, alturaCm: Double, pesoKg: Double?, objetivo: String) {
        viewModelScope.launch {
            val perfil = Perfil(
                altaCompleta = true,
                nombre = nombre.trim(),
                sexo = sexo,
                alturaCm = alturaCm,
                objetivo = objetivo,
            )
            repo.guardarPerfil(perfil)
            repo.guardarAjustes(Ajustes(inicio = LocalDate.now().toString()))
            if (pesoKg != null && pesoKg > 20.0) repo.apuntarPeso(pesoKg)
            // Crea una primera rutina lista con el catálogo local.
            val cat = _catalogo.value ?: runCatching { CargadorCatalogo.cargar(getApplication(), preferencias.value.idioma.codigo) }.getOrNull()
            if (cat != null) {
                val rId = repo.siguienteIdTabla("rutinas")
                val rutina = GeneradorRutina.generar(id = rId, perfil = perfil, gimnasio = null, ejercicios = cat.ejercicios, calibracion = true)
                repo.guardarRutina(rutina, desactivarOtras = true)
            }
            actualizarWidget()
            mostrarAviso("Perfil y rutina inicial creados")
        }
    }

    fun sugerenciaPara(ejercicioId: String, repsMin: Int, repsMax: Int, rpe: Double, registro: String): Progresion.Sugerencia {
        val st = estado.value
        val ej = _catalogo.value?.porId?.get(ejercicioId)
        val lista = PesosYDiscos.pesosPara(ej?.material, registro, st.gimnasioActivo)
        val ult = Progresion.ultimaSesionDe(st.sesiones, ejercicioId, excluirSesionId = st.sesionEnCurso?.id)
        val base = Progresion.sugerir(ult, Progresion.ObjetivoBloque(repsMin, repsMax, rpe), registro, lista)
        return Progresion.conPartida(base, ej?.material, registro, lista)
    }

    fun generarNuevaRutina(calibracion: Boolean = false, evitarActual: Boolean = false) {
        val cat = _catalogo.value ?: return
        viewModelScope.launch {
            val st = estado.value
            val evitar = if (evitarActual) {
                st.rutinaActiva?.dias?.flatMap { d -> d.bloques.map { it.ejercicio } }?.toSet().orEmpty()
            } else {
                emptySet()
            }
            val id = repo.siguienteIdTabla("rutinas")
            val nueva = GeneradorRutina.generar(
                id = id,
                perfil = st.perfil,
                gimnasio = st.gimnasioActivo,
                ejercicios = cat.ejercicios,
                marcas = st.marcas,
                descansoCompuesto = st.ajustes.descansoCompuesto,
                descansoAislamiento = st.ajustes.descansoAislamiento,
                calibracion = calibracion,
                evitar = evitar,
            )
            repo.guardarRutina(nueva, desactivarOtras = true)
            actualizarWidget()
            mostrarAviso("Nueva rutina creada (${nueva.estructura})")
        }
    }

    fun anadirEjercicioADiaRutina(letra: String, ejercicioId: String) {
        val st = estado.value
        val rutina = st.rutinaActiva ?: return
        val ej = _catalogo.value?.porId?.get(ejercicioId) ?: return
        viewModelScope.launch {
            val bloque = GeneradorRutina.bloqueParaEjercicio(ej, st.ajustes.descansoCompuesto, st.ajustes.descansoAislamiento)
            val dias = rutina.dias.map { d -> if (d.letra == letra) d.copy(bloques = d.bloques + bloque) else d }
            repo.guardarRutina(rutina.copy(dias = dias))
            mostrarAviso("${ej.nombre} añadido al día $letra")
        }
    }

    fun quitarBloqueDeDiaRutina(letra: String, uid: String) {
        val rutina = estado.value.rutinaActiva ?: return
        viewModelScope.launch {
            val dias = rutina.dias.map { d ->
                if (d.letra == letra) {
                    d.copy(
                        bloques = d.bloques.filterNot { it.uid == uid }
                            .map { if (it.superserie == uid) it.copy(superserie = null) else it },
                    )
                } else d
            }
            repo.guardarRutina(rutina.copy(dias = dias))
            mostrarAviso("Ejercicio quitado del día $letra")
        }
    }

    fun cambiarSeriesBloqueRutina(letra: String, uid: String, delta: Int) {
        val rutina = estado.value.rutinaActiva ?: return
        viewModelScope.launch {
            val dias = rutina.dias.map { d ->
                if (d.letra == letra) {
                    d.copy(
                        bloques = d.bloques.map { b ->
                            if (b.uid == uid) b.copy(series = (b.series + delta).coerceIn(1, 8)) else b
                        },
                    )
                } else d
            }
            repo.guardarRutina(rutina.copy(dias = dias))
        }
    }

    fun empezarDiaRutina(dia: DiaRutina, version: String = "normal", alAbrirEntreno: () -> Unit) {
        viewModelScope.launch {
            val st = estado.value
            val sugs = dia.bloques.associate { b ->
                val s = sugerenciaPara(b.ejercicio, b.repsMin, b.repsMax, b.rpe, b.registro)
                b.ejercicio to (s.peso to s.reps)
            }
            val id = repo.siguienteIdTabla("sesiones")
            val sesion = MotorSesion.crearSesion(
                id = id,
                dia = dia,
                rutinaId = st.rutinaActiva?.id,
                gimnasioId = st.gimnasioActivo?.id,
                version = version,
                calibracion = st.rutinaActiva?.calibracion == true,
                sugerencias = sugs,
            )
            repo.guardarSesion(sesion)
            if (st.ajustes.inicio == null) repo.guardarAjustes(st.ajustes.copy(inicio = LocalDate.now().toString()))
            actualizarWidget()
            alAbrirEntreno()
        }
    }

    fun empezarEntrenoLibre(nombre: String, alAbrirEntreno: () -> Unit) {
        viewModelScope.launch {
            val id = repo.siguienteIdTabla("sesiones")
            val sesion = MotorSesion.crearSesionLibre(id, nombre, estado.value.gimnasioActivo?.id)
            repo.guardarSesion(sesion)
            actualizarWidget()
            alAbrirEntreno()
        }
    }

    fun empezarPlantillaLibre(plantilla: PlantillaEntreno, alAbrirEntreno: () -> Unit) {
        viewModelScope.launch {
            val st = estado.value
            val sugs = plantilla.ejercicios.associate { b ->
                val s = sugerenciaPara(b.ejercicio, b.repsMin, b.repsMax, 8.0, b.registro)
                b.ejercicio to (s.peso to s.reps)
            }
            val id = repo.siguienteIdTabla("sesiones")
            val sesion = MotorSesion.crearSesionDesdePlantilla(id, plantilla, st.gimnasioActivo?.id, sugs)
            repo.guardarSesion(sesion)
            actualizarWidget()
            alAbrirEntreno()
        }
    }

    fun apuntarSerieEnCurso(idx: Int, datos: MotorSesion.DatosSerie) {
        val st = estado.value
        val sesion = st.sesionEnCurso ?: return
        val ej = sesion.ejercicios.getOrNull(idx) ?: return
        viewModelScope.launch {
            val previas = Progresion.seriesHistoricasDe(st.sesiones, ej.ejercicio, excluirSesionId = sesion.id) +
                ej.series.filter { it.hecha && !it.calentamiento }
            val res = MotorSesion.apuntarSerie(sesion, idx, datos, previas) ?: return@launch
            repo.guardarSesion(res.sesion)
            if (res.record != null) {
                mostrarAviso("🏆 ${res.record.texto}: ${res.record.peso} kg × ${res.record.reps}")
            }
            if (res.descansoSeg > 0) {
                val sigIdx = MotorSesion.indiceActual(res.sesion)
                val nombreSig = _catalogo.value?.nombreEjercicio(res.sesion.ejercicios.getOrNull(sigIdx)?.ejercicio) ?: "Siguiente serie"
                runCatching {
                    ServicioDescanso.iniciar(getApplication(), res.descansoSeg, "Descansando", "Siguiente: $nombreSig")
                }
            } else {
                runCatching { ServicioDescanso.cancelarTodo(getApplication()) }
            }
        }
    }

    fun ajustarDescansoEnCurso(deltaSeg: Int?) {
        val sesion = estado.value.sesionEnCurso ?: return
        viewModelScope.launch {
            if (deltaSeg == null) {
                repo.guardarSesion(sesion.copy(descansoHasta = null))
                runCatching { ServicioDescanso.cancelarTodo(getApplication()) }
            } else {
                val base = (sesion.descansoHasta ?: System.currentTimeMillis()).coerceAtLeast(System.currentTimeMillis())
                val nuevoHasta = base + deltaSeg * 1000L
                val segRest = ((nuevoHasta - System.currentTimeMillis()) / 1000L).toInt().coerceAtLeast(5)
                repo.guardarSesion(sesion.copy(descansoHasta = nuevoHasta, descansoTotal = (sesion.descansoTotal ?: 60) + deltaSeg))
                runCatching { ServicioDescanso.iniciar(getApplication(), segRest, "Descansando", sesion.nombre) }
            }
        }
    }

    fun modificarSesionEnCurso(transformar: (Sesion) -> Sesion) {
        val sesion = estado.value.sesionEnCurso ?: return
        viewModelScope.launch { repo.guardarSesion(transformar(sesion)) }
    }

    fun anadirCalentamientoEnCurso(idx: Int) {
        val st = estado.value
        val sesion = st.sesionEnCurso ?: return
        val ejSes = sesion.ejercicios.getOrNull(idx) ?: return
        val ejCat = _catalogo.value?.porId?.get(ejSes.ejercicio)
        val lista = PesosYDiscos.pesosPara(ejCat?.material, ejSes.registro, st.gimnasioActivo)
        val pesoTrabajo = ejSes.series.firstOrNull { !it.calentamiento }?.peso ?: return
        val seriesCal = PesosYDiscos.calentamiento(pesoTrabajo, lista)
        if (seriesCal.isEmpty()) {
            mostrarAviso("Con este peso no hace falta aproximación")
            return
        }
        modificarSesionEnCurso { MotorSesion.conCalentamiento(it, idx, seriesCal) }
        mostrarAviso("${seriesCal.size} series de calentamiento añadidas")
    }

    fun sustituirEjercicioEnCurso(idx: Int, nuevoId: String, motivo: String = "ocupado") {
        val ejCat = _catalogo.value?.porId?.get(nuevoId) ?: return
        val sesion = estado.value.sesionEnCurso ?: return
        val e = sesion.ejercicios.getOrNull(idx) ?: return
        val reg = PesosYDiscos.tipoRegistro(ejCat)
        val sug = sugerenciaPara(nuevoId, e.repsMin, e.repsMax, e.rpe, reg)
        modificarSesionEnCurso { MotorSesion.sustituir(it, idx, nuevoId, motivo, sug.peso, sug.reps, reg) }
        mostrarAviso("Cambiado a ${ejCat.nombre}")
    }

    fun anadirEjercicioASesionEnCurso(ejercicioId: String) {
        val st = estado.value
        val ejCat = _catalogo.value?.porId?.get(ejercicioId) ?: return
        val bloque = GeneradorRutina.bloqueParaEjercicio(ejCat, st.ajustes.descansoCompuesto, st.ajustes.descansoAislamiento)
        val sug = sugerenciaPara(ejercicioId, bloque.repsMin, bloque.repsMax, bloque.rpe, bloque.registro)
        modificarSesionEnCurso { MotorSesion.anadirEjercicioASesion(it, bloque, sug.peso, sug.reps) }
        mostrarAviso("${ejCat.nombre} añadido al entreno")
    }

    fun finalizarEntrenoEnCurso() {
        val sesion = estado.value.sesionEnCurso ?: return
        viewModelScope.launch {
            runCatching { ServicioDescanso.cancelarTodo(getApplication()) }
            val terminada = sesion.copy(estado = "hecha", fin = System.currentTimeMillis(), descansoHasta = null)
            repo.guardarSesion(terminada)
            _sesionRecienTerminada.value = terminada
            actualizarWidget()
        }
    }

    fun descartarEntrenoEnCurso() {
        val id = estado.value.sesionEnCurso?.id ?: return
        viewModelScope.launch {
            runCatching { ServicioDescanso.cancelarTodo(getApplication()) }
            repo.borrarSesion(id)
            actualizarWidget()
            mostrarAviso("Entreno descartado")
        }
    }

    fun guardarPlantillaLibreDesdeSesion(sesion: Sesion, nombre: String) {
        val bloques = sesion.ejercicios.map { e ->
            BloquePlantilla(
                ejercicio = e.ejercicio,
                series = e.series.count { !it.calentamiento }.coerceAtLeast(1),
                repsMin = e.repsMin,
                repsMax = e.repsMax,
                descanso = e.descanso,
                registro = e.registro,
            )
        }
        if (bloques.isEmpty()) return
        val nueva = PlantillaEntreno(
            id = "pl-${System.currentTimeMillis().toString(36)}",
            nombre = nombre.trim().ifBlank { sesion.nombre },
            ejercicios = bloques,
            creado = Instant.now().toString(),
        )
        actualizarAjustes { it.copy(entrenosLibres = it.entrenosLibres.orEmpty() + nueva) }
        mostrarAviso("Plantilla «${nueva.nombre}» guardada")
    }

    fun borrarPlantillaLibre(id: String) {
        actualizarAjustes { a -> a.copy(entrenosLibres = a.entrenosLibres.orEmpty().filterNot { it.id == id }) }
        mostrarAviso("Plantilla borrada")
    }

    fun guardarMarcaEjercicio(marca: MarcaEjercicio) {
        viewModelScope.launch { repo.guardarMarca(marca) }
    }

    fun guardarGimnasio(gimnasio: Gimnasio, activar: Boolean = false) {
        viewModelScope.launch {
            val guardado = repo.guardarGimnasio(gimnasio)
            if (activar || estado.value.ajustes.gimnasioActivo == null) {
                repo.guardarAjustes(estado.value.ajustes.copy(gimnasioActivo = guardado.id))
            }
            mostrarAviso("Gimnasio «${guardado.nombre}» guardado")
        }
    }

    fun activarGimnasio(id: Long) {
        actualizarAjustes { it.copy(gimnasioActivo = id) }
        mostrarAviso("Gimnasio activo actualizado")
    }

    fun borrarGimnasio(id: Long) {
        viewModelScope.launch {
            repo.borrarGimnasio(id)
            if (estado.value.ajustes.gimnasioActivo == id) {
                val otro = estado.value.gimnasios.firstOrNull { it.id != id }?.id
                repo.guardarAjustes(estado.value.ajustes.copy(gimnasioActivo = otro))
            }
            mostrarAviso("Gimnasio borrado")
        }
    }

    fun apuntarPeso(pesoKg: Double) {
        viewModelScope.launch {
            repo.apuntarPeso(pesoKg)
            actualizarWidget()
            mostrarAviso("Peso apuntado: ${String.format("%.1f", pesoKg).replace('.', ',')} kg")
        }
    }

    fun apuntarComidaRapida(nombre: String, kcal: Double, proteina: Double, franja: String) {
        viewModelScope.launch {
            repo.apuntarComidaRapida(nombre, kcal, proteina, franja)
            actualizarWidget()
            mostrarAviso("Comida apuntada")
        }
    }

    fun apuntarPasos(pasos: Int) {
        viewModelScope.launch {
            repo.apuntarPasos(pasos)
            actualizarWidget()
            mostrarAviso("Pasos actualizados")
        }
    }

    fun actualizarAjustes(transformar: (Ajustes) -> Ajustes) {
        viewModelScope.launch { repo.guardarAjustes(transformar(estado.value.ajustes)) }
    }

    fun importarCopiaBytes(bytes: ByteArray, contrasena: String? = null) {
        viewModelScope.launch {
            try {
                val n = repo.importarCopia(bytes, contrasena)
                _bytesPendientesClave.value = null
                _errorClave.value = null
                actualizarWidget()
                mostrarAviso("Copia recuperada ($n registros)")
            } catch (_: GestorCopias.PideContrasena) {
                _bytesPendientesClave.value = bytes
                _errorClave.value = null
            } catch (_: CifradoCopia.ContrasenaMala) {
                _errorClave.value = "No es esta contraseña. Prueba otra vez."
            } catch (e: Exception) {
                _bytesPendientesClave.value = null
                _errorClave.value = null
                mostrarAviso(e.message ?: "No se pudo leer la copia")
            }
        }
    }

    fun cancelarClaveCopia() {
        _bytesPendientesClave.value = null
        _errorClave.value = null
    }

    fun exportarCopiaBytes(contrasena: String? = null, alListo: (ByteArray) -> Unit) {
        viewModelScope.launch {
            runCatching { repo.exportarCopia(contrasena) }
                .onSuccess { bytes ->
                    alListo(bytes)
                    mostrarAviso("Copia lista para guardar")
                }
                .onFailure { mostrarAviso(it.message ?: "No se pudo crear la copia") }
        }
    }

    fun borrarTodosLosDatos() {
        viewModelScope.launch {
            runCatching { ServicioDescanso.cancelarTodo(getApplication()) }
            repo.borrarTodosLosDatos()
            actualizarWidget()
            mostrarAviso("Todos los datos borrados")
        }
    }

    private fun actualizarWidget() {
        viewModelScope.launch { runCatching { WidgetHoy().updateAll(getApplication()) } }
    }

    private data class BloqueA(
        val perfil: Perfil,
        val ajustes: Ajustes,
        val rutinas: List<Rutina>,
        val sesiones: List<Sesion>,
        val mediciones: List<Medicion>,
    )

    private data class BloqueB(
        val comidas: List<Comida>,
        val pasos: List<PasosDia>,
        val metas: List<Meta>,
        val retos: List<IntentoReto>,
        val gimnasios: List<Gimnasio>,
    )
}
