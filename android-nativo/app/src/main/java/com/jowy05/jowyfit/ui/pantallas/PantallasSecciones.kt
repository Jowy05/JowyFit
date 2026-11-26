package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.MonitorWeight
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.MiniaturaEjercicio
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeccionTitulo
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate

@Composable
fun PantallaRutina(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
) {
    val p = LocalPaleta.current
    var subtab by remember { mutableStateOf("plan") }
    var busqueda by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg),
    ) {
        CabeceraPantalla(
            crumb = t("Rutina"),
            titulo = if (subtab == "plan") "Mi plan" else "Ejercicios",
            sub = estado.rutinaActiva?.estructura?.ifBlank { null },
            extra = {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = subtab == "plan", onClick = { subtab = "plan" }, label = { Text("Mi plan") })
                    FilterChip(
                        selected = subtab == "ejercicios",
                        onClick = { subtab = "ejercicios" },
                        label = { Text("Ejercicios (${catalogo?.ejercicios?.size ?: 0})") },
                    )
                }
            },
        )

        if (subtab == "plan") {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val rutina = estado.rutinaActiva
                if (rutina == null) {
                    Spacer(Modifier.height(8.dp))
                    NotaAviso(
                        texto = "Aún no tienes rutina cargada. Importa tu .jowyfit en Ajustes para ver tu plan real; el generador de rutinas y el entreno en vivo entran en la Fase 2.",
                        tono = TonoNota.INFO,
                        icono = Icons.Rounded.FitnessCenter,
                    )
                } else {
                    rutina.dias.forEach { dia ->
                        Tarjeta {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(dia.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                                EtiquetaTag(if (dia.opcional) "Opcional" else "Día ${dia.letra}", colorFondo = p.blueT, colorTexto = p.blue)
                            }
                            Spacer(Modifier.height(8.dp))
                            dia.bloques.forEachIndexed { i, b ->
                                val ej = catalogo?.porId?.get(b.ejercicio)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    MiniaturaEjercicio(urlAsset = ej?.let { catalogo.miniaturaAsset(it) }, tamano = 38.dp)
                                    Text(
                                        text = ej?.nombre ?: b.ejercicio,
                                        color = p.ink,
                                        fontSize = 14.5.sp,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text("${b.series}×${b.repsMin}-${b.repsMax}", color = p.muted, fontFamily = FuenteMono, fontSize = 12.5.sp)
                                }
                                if (i < dia.bloques.lastIndex) SeparadorLista()
                            }
                        }
                    }
                }
                Spacer(Modifier.height(112.dp))
            }
        } else {
            val lista = remember(catalogo, busqueda) { catalogo?.buscar(busqueda).orEmpty() }
            Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                OutlinedTextField(
                    value = busqueda,
                    onValueChange = { busqueda = it },
                    placeholder = { Text("Buscar ejercicio, músculo o material…") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 112.dp),
                ) {
                    items(lista, key = { it.id }) { ej ->
                        Tarjeta(padding = PaddingValues(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                MiniaturaEjercicio(urlAsset = catalogo?.miniaturaAsset(ej), tamano = 52.dp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(ej.nombre, color = p.ink, fontFamily = FuenteCuerpo, fontWeight = FontWeight.SemiBold, fontSize = 15.5.sp)
                                    Text(
                                        text = "${ej.principales.joinToString(", ") { catalogo?.nombreMusculo(it) ?: it }} · ${catalogo?.nombreMaterial(ej.material) ?: ""}",
                                        color = p.muted,
                                        fontSize = 13.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PantallaComida(
    estado: EstadoPrincipal,
    alAbrirAnadir: () -> Unit,
) {
    val p = LocalPaleta.current
    val hoyIso = LocalDate.now().toString()
    val comidasHoy = estado.comidas.filter { it.fecha == hoyIso }
    val tot = CalculosDominio.totalesComida(comidasHoy)
    val energia = CalculosDominio.calcularObjetivos(
        perfil = estado.perfil,
        pesoActual = estado.ultimoPeso,
        kcalManual = estado.ajustes.kcalManual,
        proteinaManual = estado.ajustes.proteinaManual,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = t("Comida"),
            titulo = "Hoy",
            sub = "${tot.proteina} / ${energia.proteina} g proteína" +
                if (estado.ajustes.mostrarKcal) " · ${tot.kcal} / ~${energia.kcal} kcal" else "",
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Tarjeta {
                Text("PROTEÍNA DE HOY", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                Spacer(Modifier.height(4.dp))
                Text("${tot.proteina} / ${energia.proteina} g", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                Spacer(Modifier.height(8.dp))
                BarraProgreso(valor = tot.proteina.toDouble(), total = energia.proteina.toDouble(), color = p.ok, gruesa = true)
            }

            BotonPrincipal(texto = "+ Apuntar comida o bebida", icono = Icons.Rounded.Add, onClick = alAbrirAnadir)

            if (comidasHoy.isEmpty()) {
                NotaAviso(
                    texto = "Hoy todavía no has apuntado ninguna comida.",
                    tono = TonoNota.INFO,
                    icono = Icons.Rounded.Restaurant,
                )
            } else {
                ListaAgrupada {
                    comidasHoy.forEachIndexed { idx, c ->
                        FilaLista(
                            titulo = c.nombre,
                            subtitulo = "${c.franja.replaceFirstChar { it.uppercase() }} · ${c.hora}",
                            icono = Icons.Rounded.Restaurant,
                            final = {
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("${c.proteina.toInt()} g", color = p.ok, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    if (estado.ajustes.mostrarKcal) {
                                        Text("${c.kcal.toInt()} kcal", color = p.muted, fontFamily = FuenteMono, fontSize = 12.sp)
                                    }
                                }
                            },
                        )
                        if (idx < comidasHoy.lastIndex) SeparadorLista()
                    }
                }
            }
            Spacer(Modifier.height(112.dp))
        }
    }
}

@Composable
fun PantallaProgreso(
    estado: EstadoPrincipal,
    alAbrirPeso: () -> Unit,
    alSumarPasos: (Int) -> Unit,
) {
    val p = LocalPaleta.current
    val hoyIso = LocalDate.now().toString()
    val hechas = estado.sesiones.filter { it.estado == "hecha" }
    val pasosHoy = estado.pasos.firstOrNull { it.fecha == hoyIso }?.pasos ?: 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = t("Progreso"),
            titulo = "Resumen",
            sub = "${hechas.size} entrenos registrados · ${estado.metas.size} metas · ${estado.retos.size} retos",
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Tarjeta(modifier = Modifier.weight(1f), onClick = alAbrirPeso, padding = PaddingValues(12.dp)) {
                    Icon(Icons.Rounded.MonitorWeight, contentDescription = null, tint = p.blue)
                    Spacer(Modifier.height(6.dp))
                    Text("ÚLTIMO PESO", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
                    Text(
                        text = estado.ultimoPeso?.let { "${String.format("%.1f", it).replace('.', ',')} kg" } ?: "—",
                        color = p.ink,
                        fontFamily = FuenteMono,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                    )
                }
                Tarjeta(modifier = Modifier.weight(1f), onClick = { alSumarPasos(pasosHoy + 1000) }, padding = PaddingValues(12.dp)) {
                    Icon(Icons.AutoMirrored.Rounded.DirectionsWalk, contentDescription = null, tint = p.go)
                    Spacer(Modifier.height(6.dp))
                    Text("PASOS (+1.000)", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
                    Text("$pasosHoy", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                }
            }

            if (estado.metas.isNotEmpty()) {
                SeccionTitulo(titulo = "Metas")
                ListaAgrupada {
                    estado.metas.take(6).forEachIndexed { idx, m ->
                        FilaLista(
                            titulo = m.titulo,
                            subtitulo = "Objetivo: ${m.objetivo} ${m.unidad}".trim(),
                            icono = Icons.Rounded.Flag,
                            final = {
                                val actual = m.actual ?: m.inicio
                                Text(actual?.toString() ?: "—", color = p.blue, fontFamily = FuenteMono, fontWeight = FontWeight.Bold)
                            },
                        )
                        if (idx < minOf(estado.metas.size, 6) - 1) SeparadorLista()
                    }
                }
            }

            if (hechas.isNotEmpty()) {
                SeccionTitulo(titulo = "Últimos entrenos")
                ListaAgrupada {
                    hechas.take(8).forEachIndexed { idx, s ->
                        FilaLista(
                            titulo = s.nombre.ifBlank { "Entreno ${s.letra}" },
                            subtitulo = "${s.fecha} · ${s.ejercicios.count { it.estado == "hecho" }} ejercicios",
                            icono = Icons.Rounded.EmojiEvents,
                        )
                        if (idx < minOf(hechas.size, 8) - 1) SeparadorLista()
                    }
                }
            }

            Spacer(Modifier.height(112.dp))
        }
    }
}
