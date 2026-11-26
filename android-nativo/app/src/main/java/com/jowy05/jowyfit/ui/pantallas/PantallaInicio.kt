package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccessTime
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.MonitorWeight
import androidx.compose.material.icons.rounded.NightsStay
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.AnilloProgreso
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.MiniaturaEjercicio
import com.jowy05.jowyfit.ui.componentes.Pestana
import com.jowy05.jowyfit.ui.componentes.SeccionTitulo
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TiraSemanaCapsula
import com.jowy05.jowyfit.ui.i18n.LocalIdioma
import com.jowy05.jowyfit.ui.i18n.diasAbrev
import com.jowy05.jowyfit.ui.i18n.mesesCortos
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate
import java.time.LocalTime
import kotlin.math.max

@Composable
fun PantallaInicio(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    sugerenciaPara: (Bloque) -> Progresion.Sugerencia,
    alAbrirAjustes: () -> Unit,
    alCambiarPestana: (Pestana) -> Unit,
    alPulsarDia: (CalculosDominio.EstadoDia) -> Unit,
    alEmpezarDia: (DiaRutina) -> Unit,
    alContinuarEntreno: () -> Unit,
    alAbrirFicha: (String) -> Unit,
    alGenerarRutina: () -> Unit,
    alAbrirPeso: () -> Unit,
    alAbrirComidaRapida: () -> Unit,
    alAbrirEscaner: () -> Unit,
    alAviso: (String) -> Unit,
) {
    val p = LocalPaleta.current
    val idioma = LocalIdioma.current
    val hoyDate = LocalDate.now()
    val hoyIso = hoyDate.toString()

    val diaAbrev = diasAbrev(idioma)[CalculosDominio.diaSemana(hoyDate)].replaceFirstChar { it.uppercase() }
    val mesCorto = mesesCortos(idioma)[hoyDate.monthValue - 1]
    val numSemana = CalculosDominio.numeroSemana(estado.ajustes.inicio, hoyIso)
    val saludo = t(CalculosDominio.saludo()) + if (estado.perfil.nombre.isNotBlank()) ", ${estado.perfil.nombre.trim()}" else ""

    val semana = CalculosDominio.estadoSemana(estado.rutinaActiva, estado.sesiones, hoyIso, estado.ajustes.recolocadas)
    val tarjetaHoy = CalculosDominio.tarjetaHoy(estado.rutinaActiva, semana, hoyIso, estado.sesionEnCurso)

    val comidasHoy = estado.comidas.filter { it.fecha == hoyIso }
    val tot = CalculosDominio.totalesComida(comidasHoy)
    val pasosHoy = estado.pasos.firstOrNull { it.fecha == hoyIso }?.pasos ?: 0
    val energia = CalculosDominio.calcularObjetivos(
        perfil = estado.perfil,
        pesoActual = estado.ultimoPeso,
        kcalManual = estado.ajustes.kcalManual,
        proteinaManual = estado.ajustes.proteinaManual,
    )
    val minutosAhora = LocalTime.now().let { it.hour * 60 + it.minute }
    val basalAhora = CalculosDominio.basalHastaAhora(energia.basal, minutosAhora)
    val kcalPasos = CalculosDominio.kcalPasos(pasosHoy, estado.ultimoPeso ?: 75.0, estado.perfil.alturaCm)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = "$diaAbrev ${hoyDate.dayOfMonth} $mesCorto · semana $numSemana",
            titulo = saludo,
            derecha = {
                IconButton(onClick = alAbrirAjustes, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.Settings, contentDescription = t("Ajustes"), tint = p.ink)
                }
            },
            extra = {
                Spacer(Modifier.height(12.dp))
                TiraSemanaCapsula(semana = semana, alPulsarDia = alPulsarDia)
            },
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            SeccionTitulo(
                titulo = t("Hoy te toca"),
                accion = if (estado.rutinaActiva != null) t("Ver mi plan") else null,
                onAccion = { alCambiarPestana(Pestana.RUTINA) },
            )

            TarjetaHoyCompose(
                tarjeta = tarjetaHoy,
                calibracion = estado.rutinaActiva?.calibracion == true,
                gimnasioNombre = estado.gimnasioActivo?.nombre,
                catalogo = catalogo,
                sugerenciaPara = sugerenciaPara,
                alVerRutina = { alCambiarPestana(Pestana.RUTINA) },
                alEmpezarDia = alEmpezarDia,
                alContinuarEntreno = alContinuarEntreno,
                alAbrirFicha = alAbrirFicha,
                alGenerarRutina = alGenerarRutina,
            )

            Spacer(Modifier.height(16.dp))

            // 3 accesos rápidos 1:1 con .ux-qa3
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AccesoRapido("+ Comer o beber", Icons.Rounded.Restaurant, Modifier.weight(1f), alAbrirComidaRapida)
                AccesoRapido("Escanear", Icons.Rounded.QrCodeScanner, Modifier.weight(1f), alAbrirEscaner)
                AccesoRapido("+ Peso", Icons.Rounded.MonitorWeight, Modifier.weight(1f), alAbrirPeso)
            }

            SeccionTitulo(
                titulo = t("Hoy en números"),
                accion = t("Comida"),
                onAccion = { alCambiarPestana(Pestana.COMIDA) },
            )

            // Tarjeta de Proteína (span 2)
            Tarjeta(onClick = { alCambiarPestana(Pestana.COMIDA) }, padding = PaddingValues(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = t("Proteína").uppercase(),
                        color = p.muted,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        letterSpacing = 1.sp,
                    )
                    Text(
                        text = if (tot.proteina >= energia.proteina) {
                            t("Objetivo cumplido")
                        } else {
                            t("Faltan {n} g", "n" to max(0, energia.proteina - tot.proteina))
                        },
                        color = p.muted,
                        fontFamily = FuenteCuerpo,
                        fontSize = 13.sp,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "${tot.proteina}",
                        color = p.ink,
                        fontFamily = FuenteMono,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                    )
                    Text(
                        text = " / ${energia.proteina} g",
                        color = p.muted,
                        fontFamily = FuenteMono,
                        fontSize = 13.5.sp,
                        modifier = Modifier.padding(bottom = 2.dp),
                    )
                }
                Spacer(Modifier.height(8.dp))
                BarraProgreso(valor = tot.proteina.toDouble(), total = energia.proteina.toDouble(), color = p.ok, gruesa = true)
            }

            Spacer(Modifier.height(10.dp))

            // Fila Calorías + Pasos
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (estado.ajustes.mostrarKcal) {
                    Tarjeta(
                        modifier = Modifier.weight(1f),
                        onClick = { alCambiarPestana(Pestana.COMIDA) },
                        padding = PaddingValues(12.dp),
                    ) {
                        Text(
                            text = t("Calorías").uppercase(),
                            color = p.muted,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            letterSpacing = 1.sp,
                        )
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text("${tot.kcal}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                            Text(" / ~${energia.kcal}", color = p.muted, fontFamily = FuenteMono, fontSize = 12.sp, modifier = Modifier.padding(bottom = 2.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                        BarraProgreso(valor = tot.kcal.toDouble(), total = energia.kcal.toDouble(), color = p.blue)
                        Spacer(Modifier.height(4.dp))
                        Text(t("kcal · orientativo"), color = p.muted, fontSize = 12.5.sp)
                    }
                }

                Tarjeta(
                    modifier = Modifier.weight(1f),
                    onClick = { alCambiarPestana(Pestana.PROGRESO) },
                    padding = PaddingValues(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AnilloProgreso(valor = pasosHoy, total = estado.perfil.pasosObjetivo, tamano = 56.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = t("Pasos").uppercase(),
                                color = p.muted,
                                fontFamily = FuenteTitulo,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                letterSpacing = 1.sp,
                            )
                            Text("$pasosHoy", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                            Text(t("de {n}", "n" to estado.perfil.pasosObjetivo), color = p.muted, fontSize = 12.5.sp)
                        }
                    }
                }
            }

            if (estado.ajustes.mostrarKcal) {
                Spacer(Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                        Text(t("En reposo").uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("${energia.basal} kcal", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Spacer(Modifier.height(3.dp))
                        Text("llevas ~$basalAhora", color = p.muted, fontSize = 12.5.sp)
                    }
                    Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                        Text(t("Por ejercicio").uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.sp)
                        Spacer(Modifier.height(4.dp))
                        Text("$kcalPasos kcal", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Spacer(Modifier.height(3.dp))
                        Text("pasos ~$kcalPasos", color = p.muted, fontSize = 12.5.sp)
                    }
                }
            }

            if (tot.cafeina > 0) {
                Spacer(Modifier.height(10.dp))
                Tarjeta(onClick = { alCambiarPestana(Pestana.COMIDA) }, padding = PaddingValues(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Rounded.Coffee, contentDescription = null, tint = p.blue)
                        Column(modifier = Modifier.weight(1f)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("CAFEÍNA", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text("${tot.cafeina} / ${estado.ajustes.cafeinaLimite} mg", color = p.ink, fontFamily = FuenteMono, fontSize = 13.sp)
                            }
                            Spacer(Modifier.height(6.dp))
                            BarraProgreso(
                                valor = tot.cafeina.toDouble(),
                                total = estado.ajustes.cafeinaLimite.toDouble(),
                                color = if (tot.cafeina > estado.ajustes.cafeinaLimite) p.bad else p.warn,
                            )
                        }
                    }
                }
            }

            // Espacio inferior para que el contenido nunca quede tapado por la barra flotante ni la mini barra de entreno.
            Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
        }
    }
}

@Composable
private fun TarjetaHoyCompose(
    tarjeta: CalculosDominio.TarjetaHoyEstado,
    calibracion: Boolean,
    gimnasioNombre: String?,
    catalogo: CatalogoCargado?,
    sugerenciaPara: (Bloque) -> Progresion.Sugerencia,
    alVerRutina: () -> Unit,
    alEmpezarDia: (DiaRutina) -> Unit,
    alContinuarEntreno: () -> Unit,
    alAbrirFicha: (String) -> Unit,
    alGenerarRutina: () -> Unit,
) {
    val p = LocalPaleta.current
    when (tarjeta) {
        is CalculosDominio.TarjetaHoyEstado.Hoy -> {
            TarjetaDiaHero(
                dia = tarjeta.dia,
                etiqueta = if (calibracion) "Semana de prueba" else "Hoy",
                gimnasioNombre = gimnasioNombre,
                catalogo = catalogo,
                sugerenciaPara = sugerenciaPara,
                botonTexto = t("Empezar rutina"),
                alPulsarBoton = { alEmpezarDia(tarjeta.dia) },
                alAbrirFicha = alAbrirFicha,
            )
        }
        is CalculosDominio.TarjetaHoyEstado.Opcional -> {
            TarjetaDiaHero(
                dia = tarjeta.dia,
                etiqueta = "Opcional",
                gimnasioNombre = gimnasioNombre,
                catalogo = catalogo,
                sugerenciaPara = sugerenciaPara,
                botonTexto = "Empezar",
                alPulsarBoton = { alEmpezarDia(tarjeta.dia) },
                alAbrirFicha = alAbrirFicha,
            )
        }
        is CalculosDominio.TarjetaHoyEstado.Hecho -> {
            Tarjeta {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(p.okT),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = p.ok, modifier = Modifier.size(26.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(t("Entreno de hoy hecho."), color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                        Text("${tarjeta.sesion.nombre} · ${tarjeta.sesion.ejercicios.size} ejercicios", color = p.muted, fontSize = 14.sp)
                    }
                }
                Spacer(Modifier.height(12.dp))
                BotonSecundario(texto = t("Ver mi plan"), onClick = alVerRutina)
            }
        }
        is CalculosDominio.TarjetaHoyEstado.EnCurso -> {
            Tarjeta {
                EtiquetaTag("En curso", colorFondo = p.goT, colorTexto = p.go)
                Spacer(Modifier.height(8.dp))
                Text(tarjeta.sesion.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 25.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${tarjeta.sesion.ejercicios.count { it.estado == "hecho" }}/${tarjeta.sesion.ejercicios.size} ejercicios completados",
                    color = p.muted,
                    fontSize = 14.sp,
                )
                Spacer(Modifier.height(12.dp))
                BotonPrincipal(texto = "Continuar", icono = Icons.Rounded.PlayArrow, grande = true, onClick = alContinuarEntreno)
            }
        }
        is CalculosDominio.TarjetaHoyEstado.Descanso -> {
            Tarjeta {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(p.raised),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.NightsStay, contentDescription = null, tint = p.blue, modifier = Modifier.size(24.dp))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(t("Hoy descansas."), color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                        val prox = tarjeta.proximo?.dia?.nombre
                        Text(
                            text = if (prox != null) "Próximo: $prox" else "Día libre para recuperar.",
                            color = p.muted,
                            fontSize = 14.sp,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                BotonSecundario(texto = t("Ver mi plan"), onClick = alVerRutina)
            }
        }
        CalculosDominio.TarjetaHoyEstado.SinRutina -> {
            Tarjeta {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(p.blueT),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.FitnessCenter, contentDescription = null, tint = p.blue, modifier = Modifier.size(28.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(t("Aún no tienes rutina"), color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Genera tu rutina adaptada al instante o importa tu copia .jowyfit desde Ajustes.",
                        color = p.muted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    BotonPrincipal(texto = "Crear mi rutina", icono = Icons.Rounded.AutoAwesome, grande = true, onClick = alGenerarRutina)
                    Spacer(Modifier.height(8.dp))
                    BotonSecundario(texto = "Explorar ejercicios", onClick = alVerRutina)
                }
            }
        }
    }
}

@Composable
private fun TarjetaDiaHero(
    dia: DiaRutina,
    etiqueta: String,
    gimnasioNombre: String?,
    catalogo: CatalogoCargado?,
    sugerenciaPara: (Bloque) -> Progresion.Sugerencia,
    botonTexto: String,
    alPulsarBoton: () -> Unit,
    alAbrirFicha: (String) -> Unit,
) {
    val p = LocalPaleta.current
    val duracionMin = CalculosDominio.duracionMinDia(dia.bloques)

    Tarjeta(padding = PaddingValues(0.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(0f to p.blueT, 0.8f to Color.Transparent))
                .padding(14.dp),
        ) {
            EtiquetaTag(etiqueta, colorFondo = p.blueT, colorTexto = p.blue)
            Spacer(Modifier.height(6.dp))
            Text(
                text = dia.nombre,
                color = p.ink,
                fontFamily = FuenteTitulo,
                fontWeight = FontWeight.Bold,
                fontSize = 27.sp,
                lineHeight = 29.sp,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Rounded.AccessTime, contentDescription = null, tint = p.muted, modifier = Modifier.size(16.dp))
                    Text("~$duracionMin min", color = p.muted, fontSize = 14.sp)
                }
                if (!gimnasioNombre.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Rounded.Place, contentDescription = null, tint = p.muted, modifier = Modifier.size(16.dp))
                        Text(gimnasioNombre, color = p.muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        HorizontalDivider(color = p.line, thickness = 1.dp)

        Column(modifier = Modifier.padding(horizontal = 14.dp)) {
            val visibles = dia.bloques.take(4)
            visibles.forEachIndexed { idx, b ->
                val ej = catalogo?.porId?.get(b.ejercicio)
                val sug = sugerenciaPara(b)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { alAbrirFicha(b.ejercicio) }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    MiniaturaEjercicio(urlAsset = ej?.let { catalogo.miniaturaAsset(it) }, tamano = 34.dp)
                    Text(
                        text = ej?.nombre ?: b.ejercicio,
                        color = p.ink,
                        fontFamily = FuenteCuerpo,
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${b.series}×${b.repsMin}-${b.repsMax}",
                            color = p.muted,
                            fontFamily = FuenteMono,
                            fontSize = 12.5.sp,
                        )
                        sug.peso?.let { kg ->
                            val flecha = when (sug.accion) {
                                Progresion.AccionSugerencia.SUBIR -> " ↑"
                                Progresion.AccionSugerencia.BAJAR -> " ↓"
                                else -> ""
                            }
                            val kgTxt = if (kg == kg.toInt().toDouble()) "${kg.toInt()}" else String.format("%.1f", kg).replace('.', ',')
                            Text(
                                text = "$kgTxt kg$flecha",
                                color = if (sug.accion == Progresion.AccionSugerencia.SUBIR) p.ok else p.blue,
                                fontFamily = FuenteMono,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
                if (idx < visibles.lastIndex) HorizontalDivider(color = p.line, thickness = 1.dp)
            }
            if (dia.bloques.size > 4) {
                Text(
                    text = "+ ${dia.bloques.size - 4} ejercicios más",
                    color = p.muted,
                    fontSize = 13.5.sp,
                    modifier = Modifier.padding(vertical = 6.dp),
                )
            }
        }

        Column(modifier = Modifier.padding(14.dp)) {
            BotonPrincipal(texto = botonTexto, icono = Icons.Rounded.PlayArrow, grande = true, onClick = alPulsarBoton)
        }
    }
}

@Composable
private fun AccesoRapido(
    etiqueta: String,
    icono: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val p = LocalPaleta.current
    Surface(
        modifier = modifier
            .height(78.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(10.dp),
        color = p.surface,
        border = BorderStroke(1.dp, p.line),
        shadowElevation = if (p.oscuro) 0.dp else 1.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically),
        ) {
            Icon(icono, contentDescription = null, tint = p.go, modifier = Modifier.size(24.dp))
            Text(
                text = etiqueta,
                color = p.ink,
                fontFamily = FuenteCuerpo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.5.sp,
                textAlign = TextAlign.Center,
                maxLines = 2,
                lineHeight = 14.sp,
            )
        }
    }
}
