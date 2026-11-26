package com.jowy05.jowyfit.ui.componentes

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.components.containers.Landmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.jowy05.jowyfit.dominio.PosturaDominio
import com.jowy05.jowyfit.nativo.PermisosNativos
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.util.concurrent.Executors

private val CONEXIONES_ESQUELETO = listOf(
    11 to 12, 11 to 13, 13 to 15, 12 to 14, 14 to 16,
    11 to 23, 12 to 24, 23 to 24, 23 to 25, 25 to 27, 24 to 26, 26 to 28,
)

/**
 * Cámara nativa CameraX + MediaPipe BlazePose 3D (GPU con respaldo CPU) leyendo
 * `assets/postura/pose_landmarker_lite.task` en local, sin red y sin guardar fotogramas.
 */
@Composable
fun VisorCamaraBlazePose(
    camaraFrontal: Boolean,
    activo: Boolean,
    posturaBien: Boolean,
    alPuntos: (PosturaDominio.PuntosPostura, Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var permiso by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    var esperandoPermiso by remember { mutableStateOf(!permiso) }
    var bloqueadoEnAjustes by remember { mutableStateOf(false) }
    val pedir = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        permiso = ok
        esperandoPermiso = false
        bloqueadoEnAjustes = !ok && !PermisosNativos.puedeVolverAPedir(context, Manifest.permission.CAMERA)
    }
    LaunchedEffect(Unit) { if (!permiso) pedir.launch(Manifest.permission.CAMERA) }
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, ev ->
            if (ev == Lifecycle.Event.ON_RESUME) {
                val concedido = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                if (concedido) {
                    permiso = true
                    esperandoPermiso = false
                    bloqueadoEnAjustes = false
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    var esqueleto2D by remember { mutableStateOf<List<Pair<Float, Float>>>(emptyList()) }
    var errorMotor by remember { mutableStateOf<String?>(null) }
    val activoActual by rememberUpdatedState(activo)
    val frontalActual by rememberUpdatedState(camaraFrontal)
    val alPuntosActual by rememberUpdatedState(alPuntos)

    Box(modifier = modifier.background(Color.Black)) {
        if (!permiso && esperandoPermiso) {
            CircularProgressIndicator(color = p.go, modifier = Modifier.align(Alignment.Center))
        } else if (!permiso) {
            Column(
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Rounded.Videocam, contentDescription = null, tint = p.go, modifier = Modifier.size(48.dp))
                Text(
                    text = if (bloqueadoEnAjustes) {
                        "Has bloqueado el permiso de cámara. Actívalo en los ajustes de la app para contar repeticiones en 3D, o usa el modo manual."
                    } else {
                        "No has concedido permiso de cámara. Puedes darlo ahora para contar repeticiones en 3D, o usar el modo manual."
                    },
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    fontSize = 14.5.sp,
                )
                BotonPrincipal(
                    texto = if (bloqueadoEnAjustes) "Abrir ajustes de permisos" else "Dar permiso de cámara",
                    onClick = {
                        if (bloqueadoEnAjustes) {
                            PermisosNativos.abrirAjustesApp(context)
                        } else {
                            esperandoPermiso = true
                            pedir.launch(Manifest.permission.CAMERA)
                        }
                    },
                )
            }
        } else {
            val ejecutor = remember { Executors.newSingleThreadExecutor() }
            val detector = remember(context) {
                fun crear(delegado: Delegate): PoseLandmarker {
                    val base = BaseOptions.builder()
                        .setModelAssetPath("postura/pose_landmarker_lite.task")
                        .setDelegate(delegado)
                        .build()
                    val opts = PoseLandmarker.PoseLandmarkerOptions.builder()
                        .setBaseOptions(base)
                        .setRunningMode(RunningMode.LIVE_STREAM)
                        .setNumPoses(1)
                        .setMinPoseDetectionConfidence(0.45f)
                        .setMinPosePresenceConfidence(0.45f)
                        .setMinTrackingConfidence(0.45f)
                        .setResultListener { res, _ ->
                            val norm = res.landmarks().firstOrNull()
                            val world = res.worldLandmarks().firstOrNull()
                            val pts2D = norm?.map { it.x() to it.y() }.orEmpty()
                            val puntos3D = if (world != null && world.size >= 29) {
                                extraerPuntos3D(world)
                            } else if (norm != null && norm.size >= 29) {
                                extraerPuntos2D(norm)
                            } else {
                                PosturaDominio.PuntosPostura()
                            }
                            ContextCompat.getMainExecutor(context).execute {
                                esqueleto2D = pts2D
                                alPuntosActual(puntos3D, System.currentTimeMillis())
                            }
                        }
                        .setErrorListener { e ->
                            ContextCompat.getMainExecutor(context).execute {
                                errorMotor = e.message
                            }
                        }
                        .build()
                    return PoseLandmarker.createFromOptions(context, opts)
                }
                runCatching { crear(Delegate.GPU) }.getOrElse {
                    runCatching { crear(Delegate.CPU) }.getOrElse { e ->
                        errorMotor = e.message ?: "No se pudo iniciar BlazePose"
                        null
                    }
                }
            }

            var proveedor by remember { mutableStateOf<ProcessCameraProvider?>(null) }
            var vistaPreview by remember { mutableStateOf<PreviewView?>(null) }

            DisposableEffect(Unit) {
                onDispose {
                    runCatching { proveedor?.unbindAll() }
                    runCatching { detector?.close() }
                    runCatching { ejecutor.shutdown() }
                }
            }

            LaunchedEffect(vistaPreview, camaraFrontal) {
                val vista = vistaPreview ?: return@LaunchedEffect
                val futuro = ProcessCameraProvider.getInstance(context)
                futuro.addListener(
                    {
                        runCatching {
                            val prov = futuro.get()
                            proveedor = prov
                            val deseado = if (camaraFrontal) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                            val selector = when {
                                prov.hasCamera(deseado) -> deseado
                                prov.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
                                else -> CameraSelector.DEFAULT_BACK_CAMERA
                            }
                            val preview = Preview.Builder().build().also { it.surfaceProvider = vista.surfaceProvider }
                            val analisis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                                .build()
                                .also { ia ->
                                    ia.setAnalyzer(ejecutor) { proxy ->
                                        try {
                                            val det = detector
                                            if (!activoActual || det == null) return@setAnalyzer
                                            val bmpRaw = proxy.toBitmap()
                                            val rot = proxy.imageInfo.rotationDegrees
                                            val bmp = rotarYEspejar(bmpRaw, rot, frontalActual)
                                            if (bmp !== bmpRaw) bmpRaw.recycle()
                                            val mpImg = BitmapImageBuilder(bmp).build()
                                            det.detectAsync(mpImg, SystemClock.uptimeMillis())
                                        } catch (_: Exception) {
                                            // Ignora fotogramas sueltos durante cambio de cámara
                                        } finally {
                                            proxy.close()
                                        }
                                    }
                                }
                            prov.unbindAll()
                            prov.bindToLifecycle(lifecycleOwner, selector, preview, analisis)
                        }
                    },
                    ContextCompat.getMainExecutor(context),
                )
            }

            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }.also { vistaPreview = it }
                },
            )

            // Lienzo con el esqueleto 3D en vivo
            if (esqueleto2D.size >= 29) {
                val colorLinea = if (posturaBien) Color(0xFF4ADE80) else Color(0xFFF59E0B)
                Canvas(modifier = Modifier.fillMaxSize()) {
                    for ((a, b) in CONEXIONES_ESQUELETO) {
                        val pa = esqueleto2D[a]
                        val pb = esqueleto2D[b]
                        drawLine(
                            color = colorLinea.copy(alpha = 0.85f),
                            start = Offset(pa.first * size.width, pa.second * size.height),
                            end = Offset(pb.first * size.width, pb.second * size.height),
                            strokeWidth = 6f,
                            cap = StrokeCap.Round,
                        )
                    }
                    for (idx in listOf(0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)) {
                        val pt = esqueleto2D[idx]
                        drawCircle(
                            color = Color.White,
                            radius = 8f,
                            center = Offset(pt.first * size.width, pt.second * size.height),
                        )
                        drawCircle(
                            color = colorLinea,
                            radius = 5f,
                            center = Offset(pt.first * size.width, pt.second * size.height),
                        )
                    }
                }
            }

            errorMotor?.let { msg ->
                Text(
                    text = msg,
                    color = Color(0xFFFCA5A5),
                    fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(12.dp),
                )
            }
        }
    }
}

private fun rotarYEspejar(src: Bitmap, rotacion: Int, espejar: Boolean): Bitmap {
    if (rotacion == 0 && !espejar) return src
    val m = Matrix().apply {
        if (rotacion != 0) postRotate(rotacion.toFloat())
        if (espejar) postScale(-1f, 1f)
    }
    return Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, false)
}

private fun extraerPuntos3D(lm: List<Landmark>): PosturaDominio.PuntosPostura {
    fun p(i: Int): PosturaDominio.Punto3D {
        val x = lm[i]
        return PosturaDominio.Punto3D(x.x().toDouble(), x.y().toDouble(), x.z().toDouble(), x.visibility().orElse(1f).toDouble())
    }
    return PosturaDominio.PuntosPostura(
        cara = p(0),
        hombroIzq = p(11), hombroDer = p(12),
        codoIzq = p(13), codoDer = p(14),
        munecaIzq = p(15), munecaDer = p(16),
        caderaIzq = p(23), caderaDer = p(24),
        rodillaIzq = p(25), rodillaDer = p(26),
        tobilloIzq = p(27), tobilloDer = p(28),
    )
}

private fun extraerPuntos2D(lm: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>): PosturaDominio.PuntosPostura {
    fun p(i: Int): PosturaDominio.Punto3D {
        val x = lm[i]
        return PosturaDominio.Punto3D(x.x().toDouble(), x.y().toDouble(), null, x.visibility().orElse(1f).toDouble())
    }
    return PosturaDominio.PuntosPostura(
        cara = p(0),
        hombroIzq = p(11), hombroDer = p(12),
        codoIzq = p(13), codoDer = p(14),
        munecaIzq = p(15), munecaDer = p(16),
        caderaIzq = p(23), caderaDer = p(24),
        rodillaIzq = p(25), rodillaDer = p(26),
        tobilloIzq = p(27), tobilloDer = p(28),
    )
}
