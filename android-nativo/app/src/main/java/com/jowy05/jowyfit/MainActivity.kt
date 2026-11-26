package com.jowy05.jowyfit

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jowy05.jowyfit.datos.PreferenciaTema
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.nativo.ClienteHealthConnect
import com.jowy05.jowyfit.nativo.PermisosNativos
import com.jowy05.jowyfit.nativo.ServicioDescanso
import kotlinx.coroutines.launch
import com.jowy05.jowyfit.ui.EstadoAppViewModel
import com.jowy05.jowyfit.ui.componentes.BarraInferiorFlotante
import com.jowy05.jowyfit.ui.componentes.PantallaCamaraFotoProgreso
import com.jowy05.jowyfit.ui.componentes.PantallaEscanerBarras
import com.jowy05.jowyfit.ui.componentes.Pestana
import com.jowy05.jowyfit.ui.i18n.LocalIdioma
import com.jowy05.jowyfit.ui.pantallas.HojaActualizacionNativa
import com.jowy05.jowyfit.ui.pantallas.HojaComidaRapida
import com.jowy05.jowyfit.ui.pantallas.HojaContrasenaCopia
import com.jowy05.jowyfit.ui.pantallas.HojaDia
import com.jowy05.jowyfit.ui.pantallas.HojaEditarPerfilYSalud
import com.jowy05.jowyfit.ui.pantallas.HojaEmpezarDia
import com.jowy05.jowyfit.ui.pantallas.HojaPeso
import com.jowy05.jowyfit.ui.pantallas.HojaProductoEscaneado
import com.jowy05.jowyfit.ui.pantallas.MiniBarraEntreno
import com.jowy05.jowyfit.ui.pantallas.PantallaAjustes
import com.jowy05.jowyfit.ui.pantallas.PantallaBienvenida
import com.jowy05.jowyfit.ui.pantallas.PantallaComidaCompleta
import com.jowy05.jowyfit.ui.pantallas.PantallaEntrenoEnVivo
import com.jowy05.jowyfit.ui.pantallas.PantallaFichaEjercicio
import com.jowy05.jowyfit.ui.pantallas.PantallaFinEntreno
import com.jowy05.jowyfit.ui.pantallas.PantallaGimnasios
import com.jowy05.jowyfit.ui.pantallas.PantallaInicio
import com.jowy05.jowyfit.ui.pantallas.PantallaPerfil
import com.jowy05.jowyfit.ui.pantallas.PantallaProgresoCompleta
import com.jowy05.jowyfit.ui.pantallas.PantallaRetoActivo
import com.jowy05.jowyfit.ui.pantallas.PantallaRevisionSemanal
import com.jowy05.jowyfit.ui.pantallas.PantallaRutina
import com.jowy05.jowyfit.ui.tema.JowyFitTheme
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

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
    val sesionTerminada by vm.sesionRecienTerminada.collectAsStateWithLifecycle()

    var pestana by remember {
        mutableStateOf(if (accionInicial == "com.jowy05.jowyfit.ACCION_RUTINA") Pestana.RUTINA else Pestana.INICIO)
    }
    var enAjustes by remember { mutableStateOf(false) }
    var enGimnasios by remember { mutableStateOf(false) }
    var enRevision by remember { mutableStateOf(false) }
    var enEntreno by remember { mutableStateOf(false) }
    var hojaEditarPerfil by remember { mutableStateOf(false) }
    var enEscaner by remember { mutableStateOf<Pair<String, String>?>(null) }
    var retoActivo by remember { mutableStateOf<RetosDominio.DefinicionReto?>(null) }
    var poseCamaraFoto by remember { mutableStateOf<String?>(null) }
    var productoHoja by remember { mutableStateOf<Triple<String, Producto?, Pair<String, String>>?>(null) }
    var fichaEjercicioId by remember { mutableStateOf<String?>(null) }
    var diaParaEmpezar by remember { mutableStateOf<DiaRutina?>(null) }
    var avisoSesionActiva by remember { mutableStateOf<DiaRutina?>(null) }
    var hojaPeso by remember { mutableStateOf(accionInicial == "com.jowy05.jowyfit.ACCION_PESO") }
    var hojaComida by remember { mutableStateOf(false) }
    var hojaDia by remember { mutableStateOf<CalculosDominio.EstadoDia?>(null) }
    var hojaActualizacion by remember { mutableStateOf(false) }
    var bytesExportar by remember { mutableStateOf<ByteArray?>(null) }

    BackHandler(enabled = poseCamaraFoto != null) { poseCamaraFoto = null }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo != null) { retoActivo = null }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner != null) { enEscaner = null }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId != null) { fichaEjercicioId = null }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId == null && sesionTerminada != null) { vm.cerrarFinEntreno() }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId == null && sesionTerminada == null && enEntreno && estado.sesionEnCurso != null) { enEntreno = false }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId == null && sesionTerminada == null && !enEntreno && enRevision) { enRevision = false }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId == null && sesionTerminada == null && !enEntreno && !enRevision && enGimnasios) { enGimnasios = false }
    BackHandler(enabled = poseCamaraFoto == null && retoActivo == null && enEscaner == null && fichaEjercicioId == null && sesionTerminada == null && !enEntreno && !enRevision && !enGimnasios && enAjustes) { enAjustes = false }

    val scope = rememberCoroutineScope()
    val snackbarHost = remember { SnackbarHostState() }
    var accionNotifPendiente by remember { mutableStateOf<String?>(null) }
    var accionHcPendiente by remember { mutableStateOf<String?>(null) }

    fun mostrarAvisoConAjustes(mensaje: String, alAbrirAjustes: () -> Unit) {
        scope.launch {
            snackbarHost.currentSnackbarData?.dismiss()
            val res = snackbarHost.showSnackbar(
                message = mensaje,
                actionLabel = "Ajustes",
                duration = SnackbarDuration.Long,
            )
            if (res == SnackbarResult.ActionPerformed) {
                alAbrirAjustes()
            }
        }
    }

    LaunchedEffect(aviso) {
        if (!aviso.isNullOrBlank()) {
            snackbarHost.showSnackbar(aviso!!)
            vm.limpiarAviso()
        }
    }

    val selectorImportar = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            vm.importarCopiaDesdeUri(uri)
        }
    }

    val selectorExportar = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val data = bytesExportar
        bytesExportar = null
        if (uri != null && data != null) {
            vm.guardarBytesEnUri(uri, data)
        }
    }

    val pedirNotificaciones = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val pendiente = accionNotifPendiente
        accionNotifPendiente = null
        if (ok) {
            when (pendiente) {
                "prueba_descanso" -> {
                    ServicioDescanso.iniciar(context, 45, "Descansando", "Siguiente serie · prueba interactiva")
                    vm.mostrarAviso("Descanso de 45 s activo en la barra de notificaciones")
                }
                "pasos" -> {
                    vm.actualizarAjustes { it.copy(noti = it.noti.copy(pasos = true)) }
                    vm.mostrarAviso("Recordatorio inteligente de pasos activado")
                }
            }
        } else {
            val texto = if (pendiente == "pasos") {
                "Has denegado las notificaciones; el recordatorio de pasos queda desactivado"
            } else {
                "No has concedido el permiso de notificaciones"
            }
            mostrarAvisoConAjustes(texto) { PermisosNativos.abrirAjustesNotificaciones(context) }
        }
    }

    val pedirNotifEntreno = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    val pedirPermisosHC = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { resultadoHoja ->
        val pendiente = accionHcPendiente
        accionHcPendiente = null
        scope.launch {
            val concedidos = ClienteHealthConnect.permisosConcedidos(context).ifEmpty { resultadoHoja }
            when (pendiente) {
                "activar_escritura" -> {
                    if (ClienteHealthConnect.PERMISOS_ESCRITURA.any { it in concedidos }) {
                        vm.actualizarAjustes { it.copy(entrenosASalud = true) }
                        vm.mostrarAviso("Escritura de entrenos en Health Connect activada")
                    } else {
                        vm.actualizarAjustes { it.copy(entrenosASalud = false) }
                        mostrarAvisoConAjustes("No has concedido permiso de escritura en Health Connect") {
                            PermisosNativos.abrirAjustesHealthConnect(context)
                        }
                    }
                }
                else -> {
                    if (ClienteHealthConnect.PERMISOS_LECTURA.any { it in concedidos }) {
                        vm.sincronizarHealthConnect()
                    } else {
                        mostrarAvisoConAjustes("No has concedido permisos de Health Connect") {
                            PermisosNativos.abrirAjustesHealthConnect(context)
                        }
                    }
                }
            }
        }
    }

    fun pedirHealthConnect(accion: String, requeridos: Set<String>) {
        when (ClienteHealthConnect.estadoSdk(context)) {
            HealthConnectClient.SDK_UNAVAILABLE -> {
                vm.mostrarAviso("Health Connect no está disponible en este teléfono")
                return
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                mostrarAvisoConAjustes("Actualiza o activa Health Connect para sincronizar") {
                    PermisosNativos.abrirAjustesHealthConnect(context)
                }
                return
            }
        }
        scope.launch {
            val ya = ClienteHealthConnect.permisosConcedidos(context)
            if (requeridos.all { it in ya }) {
                if (accion == "activar_escritura") {
                    vm.actualizarAjustes { it.copy(entrenosASalud = true) }
                    vm.mostrarAviso("Escritura de entrenos en Health Connect activada")
                } else {
                    vm.sincronizarHealthConnect()
                }
            } else {
                accionHcPendiente = accion
                runCatching { pedirPermisosHC.launch(ClienteHealthConnect.PERMISOS) }.onFailure {
                    accionHcPendiente = null
                    mostrarAvisoConAjustes("No se pudo abrir la solicitud de Health Connect") {
                        PermisosNativos.abrirAjustesHealthConnect(context)
                    }
                }
            }
        }
    }

    fun sincronizarHealthConnectConPermisos() {
        pedirHealthConnect("sync", ClienteHealthConnect.PERMISOS_LECTURA)
    }

    fun cambiarToggleEntrenosHC(activar: Boolean) {
        if (!activar) {
            vm.actualizarAjustes { it.copy(entrenosASalud = false) }
        } else {
            pedirHealthConnect("activar_escritura", ClienteHealthConnect.PERMISOS_ESCRITURA)
        }
    }

    fun cambiarToggleRecordatorioPasos(activar: Boolean) {
        if (!activar) {
            vm.actualizarAjustes { it.copy(noti = it.noti.copy(pasos = false)) }
            return
        }
        val necesitaPermiso = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (necesitaPermiso) {
            accionNotifPendiente = "pasos"
            pedirNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            vm.actualizarAjustes { it.copy(noti = it.noti.copy(pasos = true)) }
        }
    }

    fun asegurarPermisoNotifEntreno() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pedirNotifEntreno.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun pedirEmpezarDia(dia: DiaRutina) {
        if (estado.sesionEnCurso != null) {
            avisoSesionActiva = dia
        } else {
            diaParaEmpezar = dia
        }
    }

    fun lanzarPruebaDescanso() {
        val necesitaPermiso = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (necesitaPermiso) {
            accionNotifPendiente = "prueba_descanso"
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
            enEscaner != null -> {
                val (fechaEsc, franjaEsc) = enEscaner!!
                PantallaEscanerBarras(
                    alCerrar = { enEscaner = null },
                    alCodigoDetectado = { codigo ->
                        enEscaner = null
                        productoHoja = Triple(codigo, null, fechaEsc to franjaEsc)
                    },
                )
            }
            poseCamaraFoto != null -> {
                val pose = poseCamaraFoto!!
                val ref = estado.fotos
                    .filter { it.pose == pose }
                    .maxByOrNull { it.fecha }
                    ?.imagen?.archivo
                    ?.let { vm.repo.archivoMedia(it) }
                PantallaCamaraFotoProgreso(
                    poseInicial = pose,
                    fotoReferencia = ref,
                    alCerrar = { poseCamaraFoto = null },
                    alCapturar = { pElegida, bytes ->
                        poseCamaraFoto = null
                        vm.guardarFotoProgreso(pElegida, bytes)
                    },
                )
            }
            retoActivo != null -> {
                val def = retoActivo!!
                PantallaRetoActivo(
                    reto = def,
                    intentosPrevios = estado.retos,
                    alCerrar = { retoActivo = null },
                    alGuardarIntento = vm::guardarIntentoReto,
                )
            }
            fichaEjercicioId != null -> {
                val ejId = fichaEjercicioId!!
                PantallaFichaEjercicio(
                    ejercicioId = ejId,
                    catalogo = catalogo,
                    marcaInicial = estado.marcas[ejId],
                    alVolver = { fichaEjercicioId = null },
                    alGuardarMarca = vm::guardarMarcaEjercicio,
                )
            }
            sesionTerminada != null -> {
                val fin = sesionTerminada!!
                PantallaFinEntreno(
                    sesion = fin,
                    alGuardarPlantilla = { nombre -> vm.guardarPlantillaLibreDesdeSesion(fin, nombre) },
                    alVolverInicio = {
                        vm.cerrarFinEntreno()
                        enEntreno = false
                        pestana = Pestana.INICIO
                    },
                )
            }
            enEntreno && estado.sesionEnCurso != null -> {
                val activa = estado.sesionEnCurso!!
                PantallaEntrenoEnVivo(
                    sesion = activa,
                    gimnasio = estado.gimnasioActivo,
                    catalogo = catalogo,
                    ajustesMaquina = { ejId -> estado.marcas[ejId]?.ajustes },
                    sugerenciaPara = { e -> vm.sugerenciaPara(e.ejercicio, e.repsMin, e.repsMax, e.rpe, e.registro) },
                    alMinimizar = { enEntreno = false },
                    alApuntarSerie = vm::apuntarSerieEnCurso,
                    alAjustarDescanso = vm::ajustarDescansoEnCurso,
                    alAnadirSerie = { idx -> vm.modificarSesionEnCurso { MotorSesion.anadirSerie(it, idx) } },
                    alQuitarSerie = { idx -> vm.modificarSesionEnCurso { MotorSesion.quitarSerie(it, idx) } },
                    alCalentar = vm::anadirCalentamientoEnCurso,
                    alSustituir = { idx, nuevoId -> vm.sustituirEjercicioEnCurso(idx, nuevoId) },
                    alSaltarEjercicio = { idx -> vm.modificarSesionEnCurso { MotorSesion.saltar(it, idx) } },
                    alIrAEjercicio = { idx -> vm.modificarSesionEnCurso { MotorSesion.irA(it, idx) } },
                    alAnadirEjercicio = vm::anadirEjercicioASesionEnCurso,
                    alAbrirFicha = { ejId -> fichaEjercicioId = ejId },
                    alFinalizar = {
                        enEntreno = false
                        vm.finalizarEntrenoEnCurso()
                    },
                    alDescartar = {
                        enEntreno = false
                        vm.descartarEntrenoEnCurso()
                    },
                )
            }
            enRevision -> {
                PantallaRevisionSemanal(
                    estado = estado,
                    catalogo = catalogo,
                    alVolver = { enRevision = false },
                    alAplicarRevision = vm::aplicarRevisionSemanal,
                    alDeshacerUltima = vm::deshacerUltimaRevision,
                )
            }
            enGimnasios -> {
                PantallaGimnasios(
                    estado = estado,
                    catalogo = catalogo,
                    alVolver = { enGimnasios = false },
                    alGuardarGimnasio = vm::guardarGimnasio,
                    alActivarGimnasio = vm::activarGimnasio,
                    alBorrarGimnasio = vm::borrarGimnasio,
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
                    alToggleRecordatorioPasos = ::cambiarToggleRecordatorioPasos,
                    alToggleCopiaAuto = { v -> vm.actualizarAjustes { it.copy(copiaAuto = v) } },
                    alToggleEntrenosHC = ::cambiarToggleEntrenosHC,
                    alPedirSegundoPlano = { PermisosNativos.pedirIgnorarAhorroBateria(context) },
                    alImportarCopia = { selectorImportar.launch(arrayOf("*/*")) },
                    alExportarCopia = {
                        vm.exportarCopiaBytes { bytes ->
                            bytesExportar = bytes
                            selectorExportar.launch("jowyfit-${LocalDate.now()}.jowyfit")
                        }
                    },
                    alExportarCsvEntrenos = {
                        bytesExportar = vm.exportarCsvEntrenosBytes()
                        selectorExportar.launch("jowyfit-entrenos-${LocalDate.now()}.csv")
                    },
                    alExportarCsvComidas = {
                        bytesExportar = vm.exportarCsvComidasBytes()
                        selectorExportar.launch("jowyfit-comidas-${LocalDate.now()}.csv")
                    },
                    alExportarCsvMedidas = {
                        bytesExportar = vm.exportarCsvMedidasBytes()
                        selectorExportar.launch("jowyfit-medidas-${LocalDate.now()}.csv")
                    },
                    alExportarJsonLigero = {
                        bytesExportar = vm.exportarJsonLigeroBytes()
                        selectorExportar.launch("jowyfit-ligero-${LocalDate.now()}.json")
                    },
                    alGenerarPdf = vm::generarYCompartirPdf,
                    alAbrirActualizaciones = { hojaActualizacion = true },
                    alProbarDescanso = ::lanzarPruebaDescanso,
                    alBorrarTodo = {
                        enAjustes = false
                        enEntreno = false
                        enGimnasios = false
                        enRevision = false
                        fichaEjercicioId = null
                        vm.borrarTodosLosDatos()
                    },
                )
            }
            else -> {
                when (pestana) {
                    Pestana.INICIO -> PantallaInicio(
                        estado = estado,
                        catalogo = catalogo,
                        sugerenciaPara = { b -> vm.sugerenciaPara(b.ejercicio, b.repsMin, b.repsMax, b.rpe, b.registro) },
                        alAbrirAjustes = { enAjustes = true },
                        alCambiarPestana = { pestana = it },
                        alPulsarDia = { hojaDia = it },
                        alEmpezarDia = ::pedirEmpezarDia,
                        alContinuarEntreno = { enEntreno = true },
                        alAbrirFicha = { ejId -> fichaEjercicioId = ejId },
                        alGenerarRutina = { vm.generarNuevaRutina(calibracion = false, evitarActual = false) },
                        alAbrirPeso = { hojaPeso = true },
                        alAbrirComidaRapida = { hojaComida = true },
                        alAbrirEscaner = {
                            val hoy = LocalDate.now().toString()
                            val fr = ComidaDominio.franjaPorHora(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")))
                            enEscaner = hoy to fr
                        },
                        alAviso = vm::mostrarAviso,
                    )
                    Pestana.RUTINA -> PantallaRutina(
                        estado = estado,
                        catalogo = catalogo,
                        alAbrirFicha = { ejId -> fichaEjercicioId = ejId },
                        alGuardarGimnasio = vm::guardarGimnasio,
                        alActivarGimnasio = vm::activarGimnasio,
                        alBorrarGimnasio = vm::borrarGimnasio,
                        alGenerarVariante = { vm.generarNuevaRutina(calibracion = false, evitarActual = estado.rutinaActiva != null) },
                        alEmpezarDia = ::pedirEmpezarDia,
                        alEmpezarLibre = {
                            if (estado.sesionEnCurso != null) {
                                enEntreno = true
                                vm.mostrarAviso("Ya tienes un entreno en curso")
                            } else {
                                asegurarPermisoNotifEntreno()
                                vm.empezarEntrenoLibre("Entreno libre") { enEntreno = true }
                            }
                        },
                        alEmpezarPlantilla = { pl ->
                            if (estado.sesionEnCurso != null) {
                                enEntreno = true
                                vm.mostrarAviso("Ya tienes un entreno en curso")
                            } else {
                                asegurarPermisoNotifEntreno()
                                vm.empezarPlantillaLibre(pl) { enEntreno = true }
                            }
                        },
                        alBorrarPlantilla = vm::borrarPlantillaLibre,
                        alAnadirBloque = vm::anadirEjercicioADiaRutina,
                        alQuitarBloque = vm::quitarBloqueDeDiaRutina,
                        alCambiarSeries = vm::cambiarSeriesBloqueRutina,
                        alIniciarReto = { def -> retoActivo = def },
                        alBorrarIntentoReto = vm::borrarIntentoReto,
                    )
                    Pestana.COMIDA -> PantallaComidaCompleta(
                        estado = estado,
                        alAbrirEscaner = { fecha, franja -> enEscaner = fecha to franja },
                        alGuardarComida = vm::guardarComida,
                        alBorrarComida = vm::borrarComida,
                        alCopiarAyer = vm::copiarComidasDeAyer,
                        alApuntarPlantilla = vm::apuntarPlantilla,
                        alGuardarPlantilla = vm::guardarPlantilla,
                        alBorrarPlantilla = vm::borrarPlantilla,
                        alAbrirProducto = { prod, fecha, franja -> productoHoja = Triple(prod.codigo, prod, fecha to franja) },
                        alBorrarProducto = vm::borrarProducto,
                        alAlternarSuplemento = vm::alternarSuplemento,
                        alGuardarSuplementos = vm::guardarSuplementosPerfil,
                        alActualizarAjustesEnergia = { k, pr, mk ->
                            vm.actualizarAjustes { it.copy(kcalManual = k, proteinaManual = pr, mostrarKcal = mk) }
                            vm.mostrarAviso("Objetivos de energía guardados")
                        },
                    )
                    Pestana.PROGRESO -> PantallaProgresoCompleta(
                        estado = estado,
                        catalogo = catalogo,
                        archivoMedia = vm.repo::archivoMedia,
                        alAbrirFicha = { ejId -> fichaEjercicioId = ejId },
                        alGuardarMedicion = vm::guardarMedicionCompleta,
                        alGuardarMeta = vm::guardarMeta,
                        alBorrarMeta = vm::borrarMeta,
                        alAvanceMeta = vm::registrarAvanceMeta,
                        alBorrarHitoMeta = vm::borrarHitoMeta,
                        alAbrirCamaraFoto = { pose -> poseCamaraFoto = pose },
                        alBorrarFoto = vm::borrarFotoProgreso,
                        alSumarPasos = vm::apuntarPasos,
                        alApuntarCardio = vm::apuntarCardioHoy,
                        alSincronizarHC = ::sincronizarHealthConnectConPermisos,
                    )
                    Pestana.PERFIL -> PantallaPerfil(
                        estado = estado,
                        alAbrirAjustes = { enAjustes = true },
                        alAbrirPeso = { hojaPeso = true },
                        alEditarPerfil = { hojaEditarPerfil = true },
                        alAbrirRevision = { enRevision = true },
                        alGenerarPdf = vm::generarYCompartirPdf,
                    )
                }

                Column(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    estado.sesionEnCurso?.let { enCurso ->
                        MiniBarraEntreno(
                            sesion = enCurso,
                            onClick = { enEntreno = true },
                        )
                    }
                    BarraInferiorFlotante(
                        activa = pestana,
                        alCambiar = { pestana = it },
                    )
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHost,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = if (enEntreno) 16.dp else 86.dp, start = 14.dp, end = 14.dp),
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

    diaParaEmpezar?.let { dia ->
        HojaEmpezarDia(
            dia = dia,
            alCerrar = { diaParaEmpezar = null },
            alElegirVersion = { version ->
                diaParaEmpezar = null
                asegurarPermisoNotifEntreno()
                vm.empezarDiaRutina(dia, version) { enEntreno = true }
            },
        )
    }
    avisoSesionActiva?.let { nuevoDia ->
        AlertDialog(
            onDismissRequest = { avisoSesionActiva = null },
            title = { Text("Ya tienes un entreno en curso") },
            text = { Text("¿Quieres retomar «${estado.sesionEnCurso?.nombre ?: "Entreno"}» o descartarlo para empezar «${nuevoDia.nombre}»?") },
            confirmButton = {
                TextButton(onClick = { avisoSesionActiva = null; enEntreno = true }) {
                    Text("Retomar actual", color = p.go, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        avisoSesionActiva = null
                        vm.descartarEntrenoEnCurso()
                        diaParaEmpezar = nuevoDia
                    },
                ) {
                    Text("Empezar nuevo", color = p.bad)
                }
            },
        )
    }
    if (hojaEditarPerfil) {
        HojaEditarPerfilYSalud(
            perfil = estado.perfil,
            alCerrar = { hojaEditarPerfil = false },
            alGuardar = vm::guardarPerfil,
        )
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
    productoHoja?.let { (cod, prodIni, ctx) ->
        HojaProductoEscaneado(
            codigo = cod,
            productoInicial = prodIni,
            fechaIso = ctx.first,
            franjaInicial = ctx.second,
            alBuscarCodigo = vm::buscarCodigoOFF,
            alGuardarProducto = vm::guardarProducto,
            alGuardarComida = vm::guardarComida,
            alGuardarComoPlantilla = vm::guardarPlantillaDesdeProducto,
            alCerrar = { productoHoja = null },
        )
    }
}
