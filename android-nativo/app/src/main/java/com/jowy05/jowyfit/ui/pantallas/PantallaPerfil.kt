package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Calculate
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.HealthAndSafety
import androidx.compose.material.icons.rounded.MonitorWeight
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.SeccionTitulo
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta

@Composable
fun PantallaPerfil(
    estado: EstadoPrincipal,
    alAbrirAjustes: () -> Unit,
    alAbrirPeso: () -> Unit,
) {
    val p = LocalPaleta.current
    val perfil = estado.perfil
    var verMas by remember { mutableStateOf(false) }

    val anios = CalculosDominio.edad(perfil.nacimiento)
    val peso = estado.ultimoPeso
    val cintura = estado.mediciones.firstOrNull { it.perimetros?.cintura != null }?.perimetros?.cintura
    val cuello = estado.mediciones.firstOrNull { it.perimetros?.cuello != null }?.perimetros?.cuello
    val cadera = estado.mediciones.firstOrNull { it.perimetros?.cadera != null }?.perimetros?.cadera

    val energia = CalculosDominio.calcularObjetivos(
        perfil = perfil,
        pesoActual = peso,
        kcalManual = estado.ajustes.kcalManual,
        proteinaManual = estado.ajustes.proteinaManual,
    )
    val imc = peso?.let { CalculosDominio.imc(it, perfil.alturaCm) }
    val ratio = cintura?.let { CalculosDominio.cinturaAltura(it, perfil.alturaCm) }
    val grasa = CalculosDominio.grasaMarina(perfil.sexo, perfil.alturaCm, cintura, cuello, cadera)

    val iniciales = perfil.nombre.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        .take(2).joinToString("") { it.first().uppercase() }
    val subDatos = listOfNotNull(
        "$anios años",
        "${perfil.alturaCm.toInt()} cm",
        peso?.let { "${String.format("%.1f", it).replace('.', ',')} kg" },
    ).joinToString(" · ")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = t("Tus datos"),
            derecha = {
                IconButton(onClick = alAbrirAjustes, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.Settings, contentDescription = t("Ajustes"), tint = p.ink)
                }
            },
            extra = {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(
                        modifier = Modifier
                            .size(58.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Color(0xFF7F26FB), Color(0xFF47129A)))),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (iniciales.isNotEmpty()) {
                            Text(iniciales, color = Color.White, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                        } else {
                            Icon(Icons.Rounded.Person, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                        }
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = perfil.nombre.trim().ifEmpty { "Tu perfil" },
                            color = p.ink,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 28.sp,
                        )
                        Text(subDatos, color = p.muted, fontFamily = FuenteCuerpo, fontSize = 14.5.sp)
                        Spacer(Modifier.height(6.dp))
                        EtiquetaTag(nombreObjetivo(perfil.objetivo), colorFondo = p.goT, colorTexto = p.go)
                    }
                }
            },
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            SeccionTitulo(titulo = t("Tus números"))

            Tarjeta(padding = PaddingValues(12.dp)) {
                Text(t("Tu objetivo al día").uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.sp)
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${energia.kcal}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                    Text("kcal", color = p.muted, fontSize = 13.5.sp, modifier = Modifier.padding(bottom = 2.dp))
                    Text("y", color = p.muted, fontSize = 14.sp, modifier = Modifier.padding(bottom = 2.dp))
                    Text("${energia.proteina}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                    Text("g de proteína", color = p.muted, fontSize = 13.5.sp, modifier = Modifier.padding(bottom = 2.dp))
                }
                Spacer(Modifier.height(4.dp))
                Text("Lo que te conviene comer cada día según tus datos.", color = p.muted, fontSize = 13.sp)
            }

            Spacer(Modifier.height(10.dp))

            // Desplegable «Ver más números» 1:1
            Tarjeta(padding = PaddingValues(0.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { verMas = !verMas }
                        .padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(Icons.Rounded.Calculate, contentDescription = null, tint = p.blue)
                    Text(t("Ver más números"), color = p.ink, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Icon(if (verMas) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore, contentDescription = null, tint = p.muted)
                }
                if (verMas) {
                    Column(
                        modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MiniKpi("IMC", imc?.let { String.format("%.1f", it).replace('.', ',') } ?: "—", Modifier.weight(1f))
                            MiniKpi("Cintura/altura", ratio?.let { String.format("%.2f", it).replace('.', ',') } ?: "—", Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MiniKpi("% de grasa", grasa?.let { "${String.format("%.1f", it).replace('.', ',')} %" } ?: "—", Modifier.weight(1f))
                            MiniKpi("Gasto reposo", "${energia.basal} kcal", Modifier.weight(1f))
                        }
                        MiniKpi("Gasto diario estimado", "~${energia.gasto} kcal", Modifier.fillMaxWidth())
                    }
                }
            }

            SeccionTitulo(titulo = "Tu ficha")
            ListaAgrupada {
                FilaLista(
                    titulo = "Datos personales",
                    subtitulo = "$subDatos · ${perfil.sexo}",
                    icono = Icons.Rounded.Person,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Peso y medidas",
                    subtitulo = listOfNotNull(
                        peso?.let { "${String.format("%.1f", it).replace('.', ',')} kg" },
                        cintura?.let { "cintura ${String.format("%.1f", it).replace('.', ',')} cm" },
                    ).joinToString(" · ").ifEmpty { "Sin medidas todavía" },
                    icono = Icons.Rounded.MonitorWeight,
                    alPulsar = alAbrirPeso,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Salud y molestias",
                    subtitulo = if (perfil.lesiones.isNotBlank()) perfil.lesiones else "Sin lesiones apuntadas",
                    icono = Icons.Rounded.HealthAndSafety,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Rutina y experiencia",
                    subtitulo = "${estado.rutinaActiva?.estructura?.ifBlank { "Sin rutina" } ?: "Sin rutina"} · ${estado.sesiones.count { it.estado == "hecha" }} entrenos",
                    icono = Icons.Rounded.FitnessCenter,
                )
            }

            Spacer(Modifier.height(14.dp))

            ListaAgrupada {
                FilaLista(
                    titulo = t("Ajustes"),
                    subtitulo = "Apariencia, idioma, copias .jowyfit, descanso nativo y actualizaciones",
                    icono = Icons.Rounded.Settings,
                    alPulsar = alAbrirAjustes,
                )
            }

            Spacer(Modifier.height(112.dp))
        }
    }
}

@Composable
private fun MiniKpi(titulo: String, valor: String, modifier: Modifier = Modifier) {
    val p = LocalPaleta.current
    Column(
        modifier = modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(8.dp))
            .background(p.raised)
            .padding(10.dp),
    ) {
        Text(titulo.uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp, letterSpacing = 0.8.sp)
        Spacer(Modifier.height(2.dp))
        Text(valor, color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    }
}

private fun nombreObjetivo(cod: String): String = when (cod) {
    "perder" -> "Perder grasa"
    "recomposicion" -> "Perder grasa y ganar músculo"
    "musculo" -> "Ganar músculo"
    "fuerza" -> "Ganar fuerza"
    "peso" -> "Subir de peso"
    "estetica" -> "Estética"
    else -> "Salud"
}
