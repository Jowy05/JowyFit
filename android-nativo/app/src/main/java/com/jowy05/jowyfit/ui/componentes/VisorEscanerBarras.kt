package com.jowy05.jowyfit.ui.componentes

import android.Manifest
import android.content.pm.PackageManager
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FlashOff
import androidx.compose.material.icons.rounded.FlashOn
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Escáner nativo de códigos de barras con CameraX + ML Kit (100 % local en el teléfono)
 * más entrada manual de respaldo si no hay permiso o el código está borroso.
 */
@OptIn(ExperimentalGetImage::class)
@Composable
fun PantallaEscanerBarras(
    alCerrar: () -> Unit,
    alCodigoDetectado: (String) -> Unit,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var permisoCamara by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val pedirPermiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        permisoCamara = ok
    }
    LaunchedEffect(Unit) {
        if (!permisoCamara) pedirPermiso.launch(Manifest.permission.CAMERA)
    }

    var linterna by remember { mutableStateOf(false) }
    var camaraActiva by remember { mutableStateOf<Camera?>(null) }
    var codigoManual by remember { mutableStateOf("") }
    val yaDetectado = remember { AtomicBoolean(false) }

    fun notificarCodigo(raw: String) {
        val limpio = raw.trim()
        if (!ComidaDominio.codigoValido(limpio)) return
        if (!yaDetectado.compareAndSet(false, true)) return
        runCatching {
            val vib = context.getSystemService(Vibrator::class.java)
            vib?.vibrate(VibrationEffect.createOneShot(90, VibrationEffect.DEFAULT_AMPLITUDE))
        }
        alCodigoDetectado(limpio)
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (permisoCamara) {
            val ejecutor = remember { Executors.newSingleThreadExecutor() }
            val opciones = remember {
                BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(
                        Barcode.FORMAT_EAN_13,
                        Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_UPC_A,
                        Barcode.FORMAT_UPC_E,
                        Barcode.FORMAT_ITF,
                    )
                    .build()
            }
            val escaner = remember { BarcodeScanning.getClient(opciones) }
            var proveedor by remember { mutableStateOf<ProcessCameraProvider?>(null) }

            DisposableEffect(Unit) {
                onDispose {
                    runCatching { proveedor?.unbindAll() }
                    runCatching { escaner.close() }
                    runCatching { ejecutor.shutdown() }
                }
            }

            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val vista = PreviewView(ctx).apply {
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }
                    val futuro = ProcessCameraProvider.getInstance(ctx)
                    futuro.addListener(
                        {
                            runCatching {
                                val prov = futuro.get()
                                proveedor = prov
                                val preview = Preview.Builder().build().also {
                                    it.surfaceProvider = vista.surfaceProvider
                                }
                                val analisis = ImageAnalysis.Builder()
                                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                    .build()
                                    .also { ia ->
                                        ia.setAnalyzer(ejecutor) { proxy ->
                                            val img = proxy.image
                                            if (img == null || yaDetectado.get()) {
                                                proxy.close()
                                                return@setAnalyzer
                                            }
                                            val input = InputImage.fromMediaImage(img, proxy.imageInfo.rotationDegrees)
                                            escaner.process(input)
                                                .addOnSuccessListener { lista ->
                                                    val valido = lista.firstNotNullOfOrNull { bc ->
                                                        bc.rawValue?.takeIf { ComidaDominio.codigoValido(it) }
                                                    }
                                                    if (valido != null) {
                                                        ContextCompat.getMainExecutor(ctx).execute {
                                                            notificarCodigo(valido)
                                                        }
                                                    }
                                                }
                                                .addOnCompleteListener { proxy.close() }
                                        }
                                    }
                                prov.unbindAll()
                                camaraActiva = prov.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    analisis,
                                )
                            }
                        },
                        ContextCompat.getMainExecutor(ctx),
                    )
                    vista
                },
            )

            // Retícula de encuadre
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(bottom = 110.dp)
                    .size(width = 270.dp, height = 150.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .border(BorderStroke(2.5.dp, p.go), RoundedCornerShape(16.dp)),
            )
        } else {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Rounded.QrCodeScanner, contentDescription = null, tint = p.go, modifier = Modifier.size(56.dp))
                Text(
                    text = "Activa la cámara para escanear códigos de barras o escríbelo abajo.",
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    fontSize = 15.sp,
                )
                BotonPrincipal(texto = "Dar permiso de cámara", onClick = { pedirPermiso.launch(Manifest.permission.CAMERA) })
            }
        }

        // Barra superior: cerrar + linterna
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(shape = RoundedCornerShape(20.dp), color = Color.Black.copy(alpha = 0.55f)) {
                IconButton(onClick = alCerrar) {
                    Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = Color.White)
                }
            }
            Text(
                text = "Escáner de producto",
                color = Color.White,
                fontFamily = FuenteTitulo,
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
            )
            Surface(shape = RoundedCornerShape(20.dp), color = Color.Black.copy(alpha = 0.55f)) {
                IconButton(
                    onClick = {
                        linterna = !linterna
                        runCatching { camaraActiva?.cameraControl?.enableTorch(linterna) }
                    },
                    enabled = permisoCamara && camaraActiva != null,
                ) {
                    Icon(
                        imageVector = if (linterna) Icons.Rounded.FlashOn else Icons.Rounded.FlashOff,
                        contentDescription = "Linterna",
                        tint = if (linterna) p.gold else Color.White,
                    )
                }
            }
        }

        // Panel inferior: entrada manual rápida de código EAN
        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
            color = p.surface,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Apunta al código de barras o escríbelo:",
                    color = p.muted,
                    fontSize = 13.5.sp,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = codigoManual,
                        onValueChange = { txt -> codigoManual = txt.filter { it.isDigit() }.take(14) },
                        placeholder = { Text("8410076472106", fontFamily = FuenteMono) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    Surface(
                        onClick = { notificarCodigo(codigoManual) },
                        enabled = ComidaDominio.codigoValido(codigoManual),
                        shape = RoundedCornerShape(10.dp),
                        color = if (ComidaDominio.codigoValido(codigoManual)) p.go else p.raised,
                        modifier = Modifier.height(54.dp),
                    ) {
                        Box(modifier = Modifier.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Rounded.Search,
                                contentDescription = "Buscar código",
                                tint = if (ComidaDominio.codigoValido(codigoManual)) p.onGo else p.muted,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(2.dp))
            }
        }
    }
}
