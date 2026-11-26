package com.jowy05.jowyfit.ui.pantallas

import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.TouchApp
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.dominio.PosturaDominio
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeccionTitulo
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.componentes.VisorCamaraBlazePose
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import kotlinx.coroutines.delay
import java.time.LocalDate
import kotlin.math.max
import kotlin.math.roundToInt

/** Subpestaña Retos dentro de Rutina: racha diaria, 5 retos 3D/manual e historial. */
@Composable
fun ContenidoRetosEnRutina(
    estado: EstadoPrincipal,
    alIniciarReto: (RetosDominio.DefinicionReto) -> Unit,
    alBorrarIntento: (Long) -> Unit,
) {
    val p = LocalPaleta.current
    val hoyIso = LocalDate.now().toString()
    val racha = remember(estado.retos, hoyIso) { RetosDominio.racha(estado.retos, hoyIso) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(2.dp))
        Tarjeta(padding = PaddingValues(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(p.goT),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.LocalFireDepartment, contentDescription = null, tint = p.go, modifier = Modifier.size(28.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (racha.actual > 0) "Racha de ${racha.actual} ${if (racha.actual == 1) "día" else "días"}" else "Empieza tu racha hoy",
                        color = p.ink,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                    Text(
                        text = "Mejor racha: ${racha.mejor} · Cámara 3D MediaPipe local o modo manual",
                        color = p.muted,
                        fontSize = 13.sp,
                    )
                }
            }
        }

        RetosDominio.RETOS.forEach { def ->
            val mejor = RetosDominio.mejorMarca(estado.retos, def.id)
            Tarjeta(onClick = { alIniciarReto(def) }, padding = PaddingValues(14.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(def.titulo, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                        Text(def.descripcion, color = p.muted, fontSize = 13.5.sp)
                    }
                    if (mejor != null) {
                        EtiquetaTag(RetosDominio.textoMarca(mejor.valor, def.modo), colorFondo = p.okT, colorTexto = p.ok)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(RetosDominio.textoObjetivoHoy(mejor, def), color = p.blue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    EtiquetaTag("Empezar", colorFondo = p.go, colorTexto = p.onGo)
                }
            }
        }

        val recientes = remember(estado.retos) { estado.retos.sortedByDescending { it.fecha }.take(12) }
        if (recientes.isNotEmpty()) {
            SeccionTitulo(titulo = "Últimos intentos")
            ListaAgrupada {
                recientes.forEachIndexed { idx, x ->
                    val def = RetosDominio.retoDe(x.reto)
                    FilaLista(
                        titulo = "${def.corto} · ${RetosDominio.textoMarca(x.valor, def.modo)}",
                        subtitulo = "${x.fecha.take(10)} · ${if (x.modo == "camara") "Cámara 3D" else "Manual"}" +
                            if (x.record == true) " · Récord" else "",
                        icono = Icons.Rounded.EmojiEvents,
                        final = {
                            x.id?.let { id ->
                                IconButton(onClick = { alBorrarIntento(id) }) {
                                    Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = p.muted, modifier = Modifier.size(18.dp))
                                }
                            }
                        },
                    )
                    if (idx < recientes.lastIndex) SeparadorLista()
                }
            }
        }

        Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
    }
}

/** Pantalla completa de Reto activo con cámara 3D BlazePose GPU + respaldo manual. */
@Composable
fun PantallaRetoActivo(
    reto: RetosDominio.DefinicionReto,
    intentosPrevios: List<IntentoReto>,
    alCerrar: () -> Unit,
    alGuardarIntento: (IntentoReto) -> Unit,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val mejorAnterior = remember(intentosPrevios, reto.id) { RetosDominio.mejorMarca(intentosPrevios, reto.id) }

    var usarCamara by remember { mutableStateOf(true) }
    var camaraFrontal by remember { mutableStateOf(true) }
    var enMarcha by remember { mutableStateOf(false) }
    var terminado by remember { mutableStateOf(false) }

    var segTranscurridos by remember { mutableIntStateOf(0) }
    var repsManuales by remember { mutableIntStateOf(0) }
    var postura by remember { mutableStateOf(PosturaDominio.EstadoPostura()) }

    val repsActuales = if (usarCamara) postura.validas else repsManuales
    val valorFinal = when (reto.modo) {
        RetosDominio.ModoReto.MAS_REPS -> repsActuales
        RetosDominio.ModoReto.MAS_TIEMPO -> if (usarCamara) postura.segundosValidos.roundToInt() else segTranscurridos
        RetosDominio.ModoReto.MENOS_TIEMPO -> segTranscurridos
    }

    fun vibrar(ms: Long = 80L) {
        runCatching {
            context.getSystemService(Vibrator::class.java)
                ?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    LaunchedEffect(enMarcha, terminado) {
        if (!enMarcha || terminado) return@LaunchedEffect
        while (enMarcha && !terminado) {
            delay(1000L)
            segTranscurridos += 1
            if (reto.modo == RetosDominio.ModoReto.MAS_REPS && reto.duracionS != null && segTranscurridos >= reto.duracionS) {
                enMarcha = false
                terminado = true
                vibrar(260L)
            }
        }
    }

    // En contrarreloj, al alcanzar el objetivo se para el crono automáticamente.
    LaunchedEffect(repsActuales, enMarcha) {
        if (enMarcha && reto.modo == RetosDominio.ModoReto.MENOS_TIEMPO && reto.objetivoReps != null && repsActuales >= reto.objetivoReps) {
            enMarcha = false
            terminado = true
            vibrar(260L)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(p.bg)) {
        // Cabecera
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            IconButton(onClick = alCerrar) { Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = p.ink) }
            Column(modifier = Modifier.weight(1f)) {
                Text(reto.titulo, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text(RetosDominio.textoObjetivoHoy(mejorAnterior, reto), color = p.muted, fontSize = 13.sp)
            }
            if (usarCamara && !terminado) {
                IconButton(onClick = { camaraFrontal = !camaraFrontal }) {
                    Icon(Icons.Rounded.Cameraswitch, contentDescription = "Cambiar cámara", tint = p.ink)
                }
            }
        }

        // Selector Cámara 3D vs Manual (antes de empezar)
        if (!enMarcha && !terminado) {
            Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = usarCamara,
                    onClick = { usarCamara = true },
                    label = { Text("Cámara 3D") },
                    leadingIcon = { Icon(Icons.Rounded.Videocam, null, Modifier.size(16.dp)) },
                )
                FilterChip(
                    selected = !usarCamara,
                    onClick = { usarCamara = false },
                    label = { Text("Modo manual") },
                    leadingIcon = { Icon(Icons.Rounded.TouchApp, null, Modifier.size(16.dp)) },
                )
            }
        }

        // Zona central (cámara 3D en vivo, contador manual o pantalla final)
        Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            when {
                terminado -> {
                    val esRec = RetosDominio.esNuevoRecord(intentosPrevios, reto.id, valorFinal)
                    val bloqueadoContrarreloj = reto.modo == RetosDominio.ModoReto.MENOS_TIEMPO &&
                        reto.objetivoReps != null && repsActuales < reto.objetivoReps
                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Tarjeta {
                            Icon(Icons.Rounded.EmojiEvents, contentDescription = null, tint = if (esRec) p.gold else p.blue, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = RetosDominio.textoMarca(valorFinal, reto.modo),
                                color = p.ink,
                                fontFamily = FuenteMono,
                                fontWeight = FontWeight.Bold,
                                fontSize = 36.sp,
                            )
                            Text(RetosDominio.textoComparativa(valorFinal, mejorAnterior, reto), color = p.muted, fontSize = 15.sp)
                            if (usarCamara && postura.invalidas > 0) {
                                Spacer(Modifier.height(4.dp))
                                Text("Repeticiones no válidas (técnica/profundidad): ${postura.invalidas}", color = p.warn, fontSize = 13.sp)
                            }
                        }
                        if (bloqueadoContrarreloj) {
                            NotaAviso(
                                texto = "En contrarreloj necesitas completar las ${reto.objetivoReps} repeticiones para guardar el tiempo.",
                                tono = TonoNota.WARN,
                            )
                        } else if (valorFinal > 0) {
                            BotonPrincipal(
                                texto = if (esRec) "Guardar nuevo récord" else "Guardar intento",
                                icono = Icons.Rounded.Check,
                                grande = true,
                                onClick = {
                                    alGuardarIntento(
                                        IntentoReto(
                                            fecha = LocalDate.now().toString(),
                                            reto = reto.id,
                                            valor = valorFinal,
                                            invalidas = if (usarCamara) postura.invalidas else null,
                                            duracionS = max(1, segTranscurridos),
                                            modo = if (usarCamara) "camara" else "manual",
                                            record = esRec.takeIf { it },
                                        ),
                                    )
                                    alCerrar()
                                },
                            )
                        }
                        BotonSecundario(texto = "Repetir", onClick = {
                            segTranscurridos = 0
                            repsManuales = 0
                            postura = PosturaDominio.EstadoPostura()
                            terminado = false
                        })
                    }
                }

                usarCamara -> {
                    Box(modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp))) {
                        VisorCamaraBlazePose(
                            camaraFrontal = camaraFrontal,
                            activo = enMarcha,
                            posturaBien = postura.posturaBien,
                            alPuntos = { pts, ms ->
                                val prevValidas = postura.validas
                                val nuevo = PosturaDominio.evaluar(postura, pts, reto.ejercicio, ms)
                                postura = nuevo
                                if (nuevo.validas > prevValidas) vibrar(70L)
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                        // HUD superior en vivo sobre la cámara
                        Column(
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Surface(shape = RoundedCornerShape(12.dp), color = Color.Black.copy(alpha = 0.65f)) {
                                    Text(
                                        text = when (reto.modo) {
                                            RetosDominio.ModoReto.MAS_REPS -> "${postura.validas} reps · ${max(0, (reto.duracionS ?: 60) - segTranscurridos)} s"
                                            RetosDominio.ModoReto.MAS_TIEMPO -> RetosDominio.formatoTiempo(postura.segundosValidos.roundToInt())
                                            RetosDominio.ModoReto.MENOS_TIEMPO -> "${postura.validas}/${reto.objetivoReps} · ${RetosDominio.formatoTiempo(segTranscurridos)}"
                                        },
                                        color = Color.White,
                                        fontFamily = FuenteMono,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    )
                                }
                                Surface(shape = RoundedCornerShape(12.dp), color = Color.Black.copy(alpha = 0.65f)) {
                                    Text(
                                        text = "${postura.anguloActual}°",
                                        color = if (postura.posturaBien) Color(0xFF4ADE80) else Color(0xFFF59E0B),
                                        fontFamily = FuenteMono,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    )
                                }
                            }
                            BarraProgreso(
                                valor = postura.profundidadPct.toDouble(),
                                total = 100.0,
                                color = if (postura.profundidadPct >= 100) Color(0xFF4ADE80) else p.go,
                                gruesa = true,
                            )
                            if (postura.aviso.isNotBlank()) {
                                Surface(shape = RoundedCornerShape(10.dp), color = Color.Black.copy(alpha = 0.65f)) {
                                    Text(
                                        text = postura.aviso,
                                        color = if (postura.posturaBien) Color(0xFF4ADE80) else Color(0xFFFBBF24),
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    )
                                }
                            }
                        }
                    }
                }

                else -> {
                    Tarjeta(modifier = Modifier.align(Alignment.Center)) {
                        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(
                                text = when (reto.modo) {
                                    RetosDominio.ModoReto.MAS_REPS -> "${max(0, (reto.duracionS ?: 60) - segTranscurridos)} s"
                                    else -> RetosDominio.formatoTiempo(segTranscurridos)
                                },
                                color = p.blue,
                                fontFamily = FuenteMono,
                                fontWeight = FontWeight.Bold,
                                fontSize = 28.sp,
                            )
                            if (reto.modo != RetosDominio.ModoReto.MAS_TIEMPO) {
                                Text("$repsManuales", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 56.sp)
                                if (enMarcha) {
                                    BotonPrincipal(
                                        texto = "+1 repetición",
                                        icono = Icons.Rounded.Add,
                                        grande = true,
                                        onClick = { repsManuales += 1; vibrar(40L) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Botón inferior Empezar / Parar
        if (!terminado) {
            Box(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
                if (!enMarcha) {
                    BotonPrincipal(
                        texto = "Empezar reto",
                        icono = Icons.Rounded.PlayArrow,
                        grande = true,
                        onClick = {
                            segTranscurridos = 0
                            repsManuales = 0
                            postura = PosturaDominio.EstadoPostura()
                            enMarcha = true
                        },
                    )
                } else {
                    BotonSecundario(
                        texto = "Terminar intento",
                        icono = Icons.Rounded.Stop,
                        peligro = true,
                        onClick = {
                            enMarcha = false
                            terminado = true
                        },
                    )
                }
            }
        }
    }
}
