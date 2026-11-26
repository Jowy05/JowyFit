package com.jowy05.jowyfit.ui.componentes

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.ui.i18n.LocalIdioma
import com.jowy05.jowyfit.ui.i18n.diasCortos
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate

enum class Pestana(val icono: ImageVector, val etiquetaEs: String) {
    INICIO(Icons.Rounded.Home, "Inicio"),
    RUTINA(Icons.Rounded.FitnessCenter, "Rutina"),
    COMIDA(Icons.Rounded.Restaurant, "Comida"),
    PROGRESO(Icons.AutoMirrored.Rounded.TrendingUp, "Progreso"),
    PERFIL(Icons.Rounded.Person, "Perfil"),
}

/** Cabecera 1:1 con .hd de componentes.css (degradado --hd hasta --bg). */
@Composable
fun CabeceraPantalla(
    crumb: String? = null,
    titulo: String? = null,
    sub: String? = null,
    alVolver: (() -> Unit)? = null,
    derecha: (@Composable () -> Unit)? = null,
    extra: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val p = LocalPaleta.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    0f to p.hdTop,
                    0.5f to p.hdMid,
                    1f to p.bg,
                ),
            )
            .statusBarsPadding()
            .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 44.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (alVolver != null) {
                IconButton(onClick = alVolver, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Volver", tint = p.ink)
                }
                Spacer(Modifier.width(4.dp))
            }
            if (!crumb.isNullOrBlank()) {
                Text(
                    text = crumb.uppercase(),
                    color = p.blue,
                    fontFamily = FuenteTitulo,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.5.sp,
                    letterSpacing = 1.1.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            } else {
                Spacer(Modifier.weight(1f))
            }
            if (derecha != null) derecha()
        }
        if (!titulo.isNullOrBlank()) {
            Text(
                text = titulo,
                color = p.ink,
                fontFamily = FuenteTitulo,
                fontWeight = FontWeight.Bold,
                fontSize = 30.sp,
                lineHeight = 33.sp,
            )
        }
        if (!sub.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(text = sub, color = p.muted, fontFamily = FuenteCuerpo, fontSize = 14.5.sp)
        }
        if (extra != null) {
            extra()
        }
    }
}

/** Tira semanal en cápsula 1:1 con .week / .wd de inicio.css. */
@Composable
fun TiraSemanaCapsula(
    semana: List<CalculosDominio.EstadoDia>,
    alPulsarDia: (CalculosDominio.EstadoDia) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    val letras = diasCortos(LocalIdioma.current)

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = p.surface,
        border = BorderStroke(1.dp, p.line),
        shadowElevation = if (p.oscuro) 0.dp else 1.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(5.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            semana.forEachIndexed { i, dia ->
                val bg by animateColorAsState(
                    targetValue = if (dia.hoy) p.go else Color.Transparent,
                    animationSpec = tween(180),
                    label = "dia_bg",
                )
                val colorPunto = when {
                    dia.hoy && dia.estado != CalculosDominio.EstadoDiaTipo.DESCANSO -> p.onGo
                    dia.estado == CalculosDominio.EstadoDiaTipo.HECHO -> p.ok
                    dia.estado == CalculosDominio.EstadoDiaTipo.PLAN -> p.blue
                    dia.estado == CalculosDominio.EstadoDiaTipo.PERDIDO -> p.bad
                    dia.estado == CalculosDominio.EstadoDiaTipo.MOVIDO -> p.warn
                    else -> Color.Transparent
                }
                val esOpcional = !dia.hoy && dia.estado == CalculosDominio.EstadoDiaTipo.OPCIONAL
                val numDia = runCatching { LocalDate.parse(dia.fecha).dayOfMonth.toString() }.getOrDefault("—")

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 60.dp)
                        .clip(RoundedCornerShape(13.dp))
                        .background(bg)
                        .clickable { alPulsarDia(dia) }
                        .padding(vertical = 7.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterVertically),
                ) {
                    Text(
                        text = letras.getOrElse(i) { "" },
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        color = if (dia.hoy) Color.White.copy(alpha = 0.88f) else p.muted,
                    )
                    Text(
                        text = numDia,
                        fontFamily = FuenteMono,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.5.sp,
                        color = if (dia.hoy) p.onGo else p.ink,
                    )
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .then(
                                if (esOpcional) {
                                    Modifier.border(1.5.dp, p.blue, CircleShape)
                                } else {
                                    Modifier.background(colorPunto)
                                },
                            ),
                    )
                }
            }
        }
    }
}

/** Barra inferior flotante 1:1 con .tabbar de base.css y componentes.css. */
@Composable
fun BarraInferiorFlotante(
    activa: Pestana,
    alCambiar: (Pestana) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .shadow(
                    elevation = if (p.oscuro) 18.dp else 12.dp,
                    shape = RoundedCornerShape(26.dp),
                    ambientColor = Color.Black.copy(alpha = if (p.oscuro) 0.55f else 0.14f),
                    spotColor = Color.Black.copy(alpha = if (p.oscuro) 0.55f else 0.14f),
                ),
            shape = RoundedCornerShape(26.dp),
            color = p.dockBg,
            border = BorderStroke(1.dp, p.line),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(5.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Pestana.entries.forEach { tab ->
                    val on = tab == activa
                    val bg by animateColorAsState(
                        targetValue = if (on) p.goT else Color.Transparent,
                        animationSpec = tween(180),
                        label = "tab_bg",
                    )
                    val fg by animateColorAsState(
                        targetValue = if (on) p.go else p.muted,
                        animationSpec = tween(180),
                        label = "tab_fg",
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(20.dp))
                            .background(bg)
                            .clickable { alCambiar(tab) }
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                    ) {
                        Icon(tab.icono, contentDescription = t(tab.etiquetaEs), tint = fg, modifier = Modifier.size(21.dp))
                        Text(
                            text = t(tab.etiquetaEs),
                            color = fg,
                            fontFamily = FuenteCuerpo,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun Tarjeta(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: PaddingValues = PaddingValues(14.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalPaleta.current
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick) else Modifier),
        shape = RoundedCornerShape(10.dp),
        color = p.surface,
        border = BorderStroke(1.dp, p.line),
        shadowElevation = if (p.oscuro) 0.dp else 1.dp,
    ) {
        Column(modifier = Modifier.padding(padding), content = content)
    }
}

@Composable
fun SeccionTitulo(
    titulo: String,
    accion: String? = null,
    onAccion: (() -> Unit)? = null,
) {
    val p = LocalPaleta.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 20.dp, bottom = 10.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = titulo,
            color = p.ink,
            fontFamily = FuenteTitulo,
            fontWeight = FontWeight.Bold,
            fontSize = 21.sp,
        )
        if (accion != null && onAccion != null) {
            Text(
                text = accion,
                color = p.blue,
                fontFamily = FuenteCuerpo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.5.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onAccion)
                    .padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}

@Composable
fun EtiquetaSeccionGrupo(texto: String) {
    val p = LocalPaleta.current
    Text(
        text = texto.uppercase(),
        color = p.muted,
        fontFamily = FuenteTitulo,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.5.sp,
        letterSpacing = 1.1.sp,
        modifier = Modifier.padding(start = 2.dp, top = 20.dp, bottom = 8.dp),
    )
}

@Composable
fun EtiquetaTag(texto: String, colorFondo: Color? = null, colorTexto: Color? = null) {
    val p = LocalPaleta.current
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(colorFondo ?: p.raised)
            .padding(horizontal = 7.dp, vertical = 4.dp),
    ) {
        Text(
            text = texto.uppercase(),
            color = colorTexto ?: p.muted,
            fontFamily = FuenteTitulo,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.5.sp,
            letterSpacing = 0.8.sp,
        )
    }
}

@Composable
fun BarraProgreso(
    valor: Double,
    total: Double,
    color: Color = LocalPaleta.current.blue,
    gruesa: Boolean = false,
) {
    val p = LocalPaleta.current
    val pct = if (total <= 0) 0f else (valor / total).toFloat().coerceIn(0f, 1f)
    val alto = if (gruesa) 12.dp else 8.dp
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(alto)
            .clip(RoundedCornerShape(alto / 2))
            .background(p.raised),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(pct)
                .height(alto)
                .clip(RoundedCornerShape(alto / 2))
                .background(color),
        )
    }
}

@Composable
fun AnilloProgreso(
    valor: Int,
    total: Int,
    tamano: Dp = 60.dp,
) {
    val p = LocalPaleta.current
    val pct = if (total <= 0) 0f else (valor.toFloat() / total.toFloat()).coerceIn(0f, 1f)
    Box(modifier = Modifier.size(tamano), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(tamano)) {
            val stroke = Stroke(width = 7.dp.toPx(), cap = StrokeCap.Round)
            drawArc(color = p.raised, startAngle = 0f, sweepAngle = 360f, useCenter = false, style = stroke)
            drawArc(color = p.blue, startAngle = -90f, sweepAngle = 360f * pct, useCenter = false, style = stroke)
        }
        Text(
            text = "${(pct * 100).toInt()}%",
            fontFamily = FuenteMono,
            fontWeight = FontWeight.Bold,
            fontSize = 12.5.sp,
            color = p.ink,
        )
    }
}

@Composable
fun BotonPrincipal(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icono: ImageVector? = null,
    enabled: Boolean = true,
    grande: Boolean = false,
) {
    val p = LocalPaleta.current
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(if (grande) 60.dp else 52.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = p.go,
            contentColor = p.onGo,
            disabledContainerColor = p.go.copy(alpha = 0.45f),
            disabledContentColor = p.onGo,
        ),
    ) {
        if (icono != null) {
            Icon(icono, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = texto,
            fontFamily = FuenteTitulo,
            fontWeight = FontWeight.Bold,
            fontSize = if (grande) 21.sp else 18.sp,
        )
    }
}

@Composable
fun BotonSecundario(
    texto: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icono: ImageVector? = null,
    peligro: Boolean = false,
) {
    val p = LocalPaleta.current
    val fg = if (peligro) p.bad else p.blue
    val borde = if (peligro) p.bad else p.line
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, borde),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = fg),
    ) {
        if (icono != null) {
            Icon(icono, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = texto,
            fontFamily = FuenteTitulo,
            fontWeight = FontWeight.Bold,
            fontSize = 16.5.sp,
        )
    }
}

@Composable
fun ListaAgrupada(content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPaleta.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = p.surface,
        border = BorderStroke(1.dp, p.line),
        shadowElevation = if (p.oscuro) 0.dp else 1.dp,
    ) {
        Column(content = content)
    }
}

@Composable
fun FilaLista(
    titulo: String,
    subtitulo: String? = null,
    icono: ImageVector? = null,
    alPulsar: (() -> Unit)? = null,
    peligro: Boolean = false,
    final: (@Composable RowScope.() -> Unit)? = null,
    mostrarFlecha: Boolean = alPulsar != null && final == null,
) {
    val p = LocalPaleta.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .then(if (alPulsar != null) Modifier.clickable(onClick = alPulsar) else Modifier)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icono != null) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (peligro) p.badT else p.raised),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icono, contentDescription = null, tint = if (peligro) p.bad else p.blue, modifier = Modifier.size(19.dp))
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = titulo,
                color = if (peligro) p.bad else p.ink,
                fontFamily = FuenteCuerpo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.5.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitulo.isNullOrBlank()) {
                Text(
                    text = subtitulo,
                    color = p.muted,
                    fontFamily = FuenteCuerpo,
                    fontSize = 13.5.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (final != null) final()
        if (mostrarFlecha) {
            Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, contentDescription = null, tint = p.muted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
fun SeparadorLista() {
    HorizontalDivider(color = LocalPaleta.current.line, thickness = 1.dp)
}

@Composable
fun FilaInterruptor(
    titulo: String,
    subtitulo: String? = null,
    icono: ImageVector? = null,
    activo: Boolean,
    onCambio: (Boolean) -> Unit,
) {
    val p = LocalPaleta.current
    FilaLista(
        titulo = titulo,
        subtitulo = subtitulo,
        icono = icono,
        alPulsar = { onCambio(!activo) },
        mostrarFlecha = false,
        final = {
            Switch(
                checked = activo,
                onCheckedChange = onCambio,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = p.blue,
                    uncheckedThumbColor = p.muted,
                    uncheckedTrackColor = p.raised,
                    uncheckedBorderColor = p.line,
                ),
            )
        },
    )
}

enum class TonoNota { INFO, OK, WARN, BAD }

@Composable
fun NotaAviso(
    texto: String,
    tono: TonoNota = TonoNota.INFO,
    icono: ImageVector = Icons.Rounded.CalendarMonth,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    val (bg, ic) = when (tono) {
        TonoNota.INFO -> p.blueT to p.blue
        TonoNota.OK -> p.okT to p.ok
        TonoNota.WARN -> p.warnT to p.warn
        TonoNota.BAD -> p.badT to p.bad
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(icono, contentDescription = null, tint = ic, modifier = Modifier.size(19.dp))
        Text(text = texto, color = p.ink, fontFamily = FuenteCuerpo, fontSize = 14.sp, lineHeight = 19.sp)
    }
}

@Composable
fun MiniaturaEjercicio(
    urlAsset: String?,
    tamano: Dp = 44.dp,
) {
    val p = LocalPaleta.current
    Box(
        modifier = Modifier
            .size(tamano)
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFFD9F0FC)),
        contentAlignment = Alignment.Center,
    ) {
        if (!urlAsset.isNullOrBlank()) {
            AsyncImage(
                model = urlAsset,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(tamano),
            )
        } else {
            Icon(Icons.Rounded.FitnessCenter, contentDescription = null, tint = p.th, modifier = Modifier.size(tamano * 0.5f))
        }
    }
}
