package com.jowy05.jowyfit.ui.componentes

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.min

/** Cámara nativa CameraX para fotos de progreso con referencia semitransparente de la foto anterior. */
@Composable
fun PantallaCamaraFotoProgreso(
    poseInicial: String,
    fotoReferencia: File?,
    alCerrar: () -> Unit,
    alCapturar: (String, ByteArray) -> Unit,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var pose by remember { mutableStateOf(poseInicial) }
    var frontal by remember { mutableStateOf(true) }
    var mostrarGuia by remember { mutableStateOf(fotoReferencia?.exists() == true) }
    var capturando by remember { mutableStateOf(false) }

    var permiso by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val pedir = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> permiso = ok }
    LaunchedEffect(Unit) { if (!permiso) pedir.launch(Manifest.permission.CAMERA) }

    val ejecutor = remember { Executors.newSingleThreadExecutor() }
    val captura = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build() }
    var proveedor by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { proveedor?.unbindAll() }
            runCatching { ejecutor.shutdown() }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (permiso) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx -> PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } },
                update = { vista ->
                    val futuro = ProcessCameraProvider.getInstance(context)
                    futuro.addListener(
                        {
                            runCatching {
                                val prov = futuro.get()
                                proveedor = prov
                                val prev = Preview.Builder().build().also { it.surfaceProvider = vista.surfaceProvider }
                                val sel = if (frontal) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                                prov.unbindAll()
                                prov.bindToLifecycle(lifecycleOwner, sel, prev, captura)
                            }
                        },
                        ContextCompat.getMainExecutor(context),
                    )
                },
            )

            if (mostrarGuia && fotoReferencia != null && fotoReferencia.exists()) {
                AsyncImage(
                    model = fotoReferencia,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().alpha(0.28f),
                )
            }
        } else {
            Column(
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Activa el permiso de cámara para hacer tus fotos de progreso (solo se guardan en tu móvil).", color = Color.White, textAlign = TextAlign.Center)
                BotonPrincipal(texto = "Activar cámara", onClick = { pedir.launch(Manifest.permission.CAMERA) })
            }
        }

        // Cabecera superior
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(shape = CircleShape, color = Color.Black.copy(alpha = 0.55f)) {
                IconButton(onClick = alCerrar) { Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = Color.White) }
            }
            Text("Foto de progreso", color = Color.White, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 19.sp)
            Surface(shape = CircleShape, color = Color.Black.copy(alpha = 0.55f)) {
                IconButton(onClick = { frontal = !frontal }) {
                    Icon(Icons.Rounded.Cameraswitch, contentDescription = "Cambiar cámara", tint = Color.White)
                }
            }
        }

        // Controles inferiores
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.55f))
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("frente" to "Frente", "perfil" to "Perfil", "espalda" to "Espalda").forEach { (k, lbl) ->
                    FilterChip(selected = pose == k, onClick = { pose = k }, label = { Text(lbl) })
                }
                if (fotoReferencia?.exists() == true) {
                    FilterChip(selected = mostrarGuia, onClick = { mostrarGuia = !mostrarGuia }, label = { Text("Guía") })
                }
            }
            Surface(
                onClick = {
                    if (!permiso || capturando) return@Surface
                    capturando = true
                    captura.takePicture(
                        ejecutor,
                        object : ImageCapture.OnImageCapturedCallback() {
                            override fun onCaptureSuccess(image: ImageProxy) {
                                val bytes = runCatching { comprimirJpeg(image, frontal) }.getOrNull()
                                image.close()
                                ContextCompat.getMainExecutor(context).execute {
                                    capturando = false
                                    if (bytes != null) alCapturar(pose, bytes)
                                }
                            }
                            override fun onError(exception: ImageCaptureException) {
                                ContextCompat.getMainExecutor(context).execute { capturando = false }
                            }
                        },
                    )
                },
                shape = CircleShape,
                color = p.go,
                modifier = Modifier.size(68.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.CameraAlt, contentDescription = "Hacer foto", tint = p.onGo, modifier = Modifier.size(30.dp))
                }
            }
        }
    }
}

private fun comprimirJpeg(image: ImageProxy, espejar: Boolean): ByteArray {
    val buf = image.planes[0].buffer
    val raw = ByteArray(buf.remaining())
    buf.get(raw)
    val orig = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return raw
    val m = Matrix().apply {
        val rot = image.imageInfo.rotationDegrees
        if (rot != 0) postRotate(rot.toFloat())
        if (espejar) postScale(-1f, 1f)
    }
    val rotado = Bitmap.createBitmap(orig, 0, 0, orig.width, orig.height, m, true)
    if (rotado !== orig) orig.recycle()
    val maxLado = 1600
    val escala = min(1f, maxLado.toFloat() / maxOf(rotado.width, rotado.height))
    val finalBmp = if (escala < 1f) {
        Bitmap.createScaledBitmap(rotado, (rotado.width * escala).toInt(), (rotado.height * escala).toInt(), true).also {
            if (it !== rotado) rotado.recycle()
        }
    } else rotado
    val out = ByteArrayOutputStream()
    finalBmp.compress(Bitmap.CompressFormat.JPEG, 84, out)
    finalBmp.recycle()
    return out.toByteArray()
}
