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
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.widget.WidgetHoy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

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

    private val bloqueA = combine(repo.perfil, repo.ajustes, repo.rutinas, repo.sesiones, repo.mediciones) { p, a, r, s, m ->
        BloqueA(p, a, r, s, m)
    }
    private val bloqueB = combine(repo.comidas, repo.pasos, repo.metas, repo.retos, repo.gimnasios) { c, pa, me, re, g ->
        BloqueB(c, pa, me, re, g)
    }

    val estado: StateFlow<EstadoPrincipal> = combine(bloqueA, bloqueB) { a, b ->
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

    fun mostrarAviso(msg: String) {
        _aviso.value = msg
    }

    fun limpiarAviso() {
        _aviso.value = null
    }

    fun cambiarTema(tema: PreferenciaTema) = repo.guardarTema(tema)
    fun cambiarLetra(letra: EscalaLetra) = repo.guardarLetra(letra)
    fun cambiarIdioma(idioma: IdiomaApp) {
        repo.guardarIdioma(idioma)
        recargarCatalogo(idioma)
    }

    fun completarAltaRapida(nombre: String, sexo: String, alturaCm: Double, pesoKg: Double?, objetivo: String) {
        viewModelScope.launch {
            repo.guardarPerfil(
                Perfil(
                    altaCompleta = true,
                    nombre = nombre.trim(),
                    sexo = sexo,
                    alturaCm = alturaCm,
                    objetivo = objetivo,
                ),
            )
            repo.guardarAjustes(Ajustes())
            if (pesoKg != null && pesoKg > 20.0) {
                repo.apuntarPeso(pesoKg)
            }
            actualizarWidget()
            mostrarAviso("Perfil creado")
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
        viewModelScope.launch {
            repo.guardarAjustes(transformar(estado.value.ajustes))
        }
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
            repo.borrarTodosLosDatos()
            actualizarWidget()
            mostrarAviso("Todos los datos borrados")
        }
    }

    private fun actualizarWidget() {
        viewModelScope.launch {
            runCatching { WidgetHoy().updateAll(getApplication()) }
        }
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
