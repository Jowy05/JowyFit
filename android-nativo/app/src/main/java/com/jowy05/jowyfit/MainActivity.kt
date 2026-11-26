package com.jowy05.jowyfit

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jowy05.jowyfit.datos.PreferenciaTema
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.nativo.ServicioDescanso
import com.jowy05.jowyfit.ui.EstadoAppViewModel
import com.jowy05.jowyfit.ui.componentes.BarraInferiorFlotante
import com.jowy05.jowyfit.ui.componentes.Pestana
import com.jowy05.jowyfit.ui.i18n.LocalIdioma
import com.jowy05.jowyfit.ui.pantallas.HojaActualizacionNativa
import com.jowy05.jowyfit.ui.pantallas.HojaComidaRapida
import com.jowy05.jowyfit.ui.pantallas.HojaContrasenaCopia
import com.jowy05.jowyfit.ui.pantallas.HojaDia
import com.jowy05.jowyfit.ui.pantallas.HojaPeso
import com.jowy05.jowyfit.ui.pantallas.PantallaAjustes
import com.jowy05.jowyfit.ui.pantallas.PantallaBienvenida
import com.jowy05.jowyfit.ui.pantallas.PantallaComida
import com.jowy05.jowyfit.ui.pantallas.PantallaInicio
import com.jowy05.jowyfit.ui.pantallas.PantallaPerfil
import com.jowy05.jowyfit.ui.pantallas.PantallaProgreso
import com.jowy05.jowyfit.ui.pantallas.PantallaRutina
import com.jowy05.jowyfit.ui.tema.JowyFitTheme
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )

        val accionInicial = intent?.action
        setContent {
            val vm: EstadoAppViewModel = viewModel()
            val prefs by vm.preferencias.collectAsStateWithLifecycle()

            LaunchedEffect(prefs.tema) {
                val oscuro = when (prefs.tema) {
                    PreferenciaTema.OSCURO -> true
                    PreferenciaTema.CLARO -> false
                    PreferenciaTema.SISTEMA -> null
                }
                if (oscuro == true) {
                    enableEdgeToEdge(
                        statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                        navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                    )
                } else if (oscuro == false) {
                    enableEdgeToEdge(
                        statusBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
                        navigationBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
                    )
                }
            }

            CompositionLocalProvider(LocalIdioma provides prefs.idioma) {
                JowyFitTheme(preferenciaTema = prefs.tema, escalaLetra = prefs.letra) {
                    AppRaiz(vm = vm, accionInicial = accionInicial)
                }
            }
        }
    }
}

@Composable
private fun AppRaiz(vm: EstadoAppViewModel, accionInicial: String?) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val estado by vm.estado.collectAsStateWithLifecycle()
    val prefs by vm.preferencias.collectAsStateWithLifecycle()
    val catalogo by vm.catalogo.collectAsStateWithLifecycle()
    val aviso by vm.aviso.collectAsStateWithLifecycle()
    val bytesPendientesClave by vm.bytesPendientesClave.collectAsStateWithLifecycle()
    val errorClave by vm.errorClave.collectAsStateWithLifecycle()

    var pestana by remember {
        mutableStateOf(if (accionInicial == "com.jowy05.jowyfit.ACCION_RUTINA") Pestana.RUTINA else Pestana.INICIO)
    }
    var enAjustes by remember { mutableStateOf(false) }
    var hojaPeso by remember { mutableStateOf(accionInicial == "com.jowy05.jowyfit.ACCION_PESO") }
    var hojaComida by remember { mutableStateOf(false) }
    var hojaDia by remember { mutableStateOf<CalculosDominio.EstadoDia?>(null) }
    var hojaActualizacion by remember { mutableStateOf(false) }
    var bytesExportar by remember { mutableStateOf<ByteArray?>(null) }

    val snackbarHost = remember { SnackbarHostState() }
    LaunchedEffect(aviso) {
        if (!aviso.isNullOrBlank()) {
            snackbarHost.showSnackbar(aviso!!)
            vm.limpiarAviso()
        }
    }

    val selectorImportar = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                .onSuccess { bytes -> if (bytes != null) vm.importarCopiaBytes(bytes) }
                .onFailure { vm.mostrarAviso("No se pudo abrir el archivo seleccionado") }
        }
    }

    val selectorExportar = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val data = bytesExportar
        bytesExportar = null
        if (uri != null && data != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use { it.write(data) }
            }.onSuccess {
                vm.mostrarAviso("Copia guardada correctamente")
            }.onFailure {
                vm.mostrarAviso("No se pudo guardar el archivo")
            }
        }
    }

    val pedirNotificaciones = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) {
            ServicioDescanso.iniciar(context, 45, "Descansando", "Siguiente serie · prueba interactiva")
            vm.mostrarAviso("Descanso de 45 s activo en la barra de notificaciones")
        } else {
            vm.mostrarAviso("Activa el permiso de notificaciones para ver la cuenta atrás")
        }
    }

    fun lanzarPruebaDescanso() {
        val necesitaPermiso = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (necesitaPermiso) {
            pedirNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            ServicioDescanso.iniciar(context, 45, "Descansando", "Siguiente serie · prueba interactiva")
            vm.mostrarAviso("Descanso de 45 s activo (+30 s / Saltar en notificaciones)")
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(p.bg)) {
        when {
            estado.cargando -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = p.go)
                }
            }
            !estado.perfil.altaCompleta -> {
                PantallaBienvenida(
                    alImportarCopia = { selectorImportar.launch(arrayOf("*/*")) },
                    alCompletarAlta = vm::completarAltaRapida,
                )
            }
            enAjustes -> {
                PantallaAjustes(
                    estado = estado,
                    prefs = prefs,
                    totalEjercicios = catalogo?.ejercicios?.size ?: 0,
                    alVolver = { enAjustes = false },
                    alCambiarTema = vm::cambiarTema,
                    alCambiarLetra = vm::cambiarLetra,
                    alCambiarIdioma = vm::cambiarIdioma,
                    alToggleMostrarKcal = { v -> vm.actualizarAjustes { it.copy(mostrarKcal = v) } },
                    alImportarCopia = { selectorImportar.launch(arrayOf("*/*")) },
                    alExportarCopia = {
                        vm.exportarCopiaBytes { bytes ->
                            bytesExportar = bytes
                            selectorExportar.launch("jowyfit-${LocalDate.now()}.jowyfit")
                        }
                    },
                    alAbrirActualizaciones = { hojaActualizacion = true },
                    alProbarDescanso = ::lanzarPruebaDescanso,
                    alBorrarTodo = {
                        enAjustes = false
                        vm.borrarTodosLosDatos()
                    },
                )
            }
            else -> {
                when (pestana) {
                    Pestana.INICIO -> PantallaInicio(
                        estado = estado,
                        catalogo = catalogo,
                        alAbrirAjustes = { enAjustes = true },
                        alCambiarPestana = { pestana = it },
                        alPulsarDia = { hojaDia = it },
                        alAbrirPeso = { hojaPeso = true },
                        alAbrirComidaRapida = { hojaComida = true },
                        alProbarDescanso = ::lanzarPruebaDescanso,
                        alAviso = vm::mostrarAviso,
                    )
                    Pestana.RUTINA -> PantallaRutina(estado = estado, catalogo = catalogo)
                    Pestana.COMIDA -> PantallaComida(estado = estado, alAbrirAnadir = { hojaComida = true })
                    Pestana.PROGRESO -> PantallaProgreso(
                        estado = estado,
                        alAbrirPeso = { hojaPeso = true },
                        alSumarPasos = vm::apuntarPasos,
                    )
                    Pestana.PERFIL -> PantallaPerfil(
                        estado = estado,
                        alAbrirAjustes = { enAjustes = true },
                        alAbrirPeso = { hojaPeso = true },
                    )
                }

                BarraInferiorFlotante(
                    activa = pestana,
                    alCambiar = { pestana = it },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }
        }

        SnackbarHost(
            hostState = snackbarHost,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 86.dp, start = 14.dp, end = 14.dp),
        ) { data ->
            Snackbar(
                snackbarData = data,
                shape = RoundedCornerShape(14.dp),
                containerColor = p.toastBg,
                contentColor = p.toastFg,
                actionColor = p.toastAct,
            )
        }
    }

    if (hojaPeso) {
        HojaPeso(
            pesoInicial = estado.ultimoPeso,
            alCerrar = { hojaPeso = false },
            alGuardar = vm::apuntarPeso,
        )
    }
    if (hojaComida) {
        HojaComidaRapida(
            alCerrar = { hojaComida = false },
            alGuardar = vm::apuntarComidaRapida,
        )
    }
    hojaDia?.let { dia ->
        HojaDia(dia = dia, alCerrar = { hojaDia = null })
    }
    if (hojaActualizacion) {
        HojaActualizacionNativa(alCerrar = { hojaActualizacion = false })
    }
    bytesPendientesClave?.let { bytes ->
        HojaContrasenaCopia(
            error = errorClave,
            alCancelar = vm::cancelarClaveCopia,
            alConfirmar = { clave -> vm.importarCopiaBytes(bytes, clave) },
        )
    }
}
