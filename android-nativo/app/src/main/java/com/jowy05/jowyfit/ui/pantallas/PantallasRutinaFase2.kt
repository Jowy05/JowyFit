package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccessTime
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Tramo
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaSeccionGrupo
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta

/** Ficha completa del ejercicio: imagen grande RepDB, instrucciones, consejos, marcas y ajustes de máquina. */
@Composable
fun PantallaFichaEjercicio(
    ejercicioId: String,
    catalogo: CatalogoCargado?,
    marcaInicial: MarcaEjercicio?,
    alVolver: () -> Unit,
    alGuardarMarca: (MarcaEjercicio) -> Unit,
) {
    val p = LocalPaleta.current
    val ej = catalogo?.porId?.get(ejercicioId)
    var favorito by remember(marcaInicial) { mutableStateOf(marcaInicial?.favorito == true) }
    var duele by remember(marcaInicial) { mutableStateOf(marcaInicial?.duele == true) }
    var odiado by remember(marcaInicial) { mutableStateOf(marcaInicial?.odiado == true) }
    var ajustes by remember(marcaInicial) { mutableStateOf(marcaInicial?.ajustes.orEmpty()) }
    var notas by remember(marcaInicial) { mutableStateOf(marcaInicial?.notas.orEmpty()) }

    fun persistir() {
        alGuardarMarca(
            MarcaEjercicio(
                id = ejercicioId,
                favorito = favorito.takeIf { it },
                duele = duele.takeIf { it },
                odiado = odiado.takeIf { it },
                ajustes = ajustes.trim().takeIf { it.isNotEmpty() },
                notas = notas.trim().takeIf { it.isNotEmpty() },
            ),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = "Ejercicio",
            titulo = ej?.nombre ?: ejercicioId,
            sub = ej?.let { "${catalogo.nombreMaterial(it.material)} · ${it.principales.joinToString(", ") { m -> catalogo.nombreMusculo(m) }}" },
            alVolver = alVolver,
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (ej != null) {
                AsyncImage(
                    model = catalogo.imagenAsset(ej),
                    contentDescription = ej.nombre,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(210.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFD9F0FC)),
                )
            }

            // Marcas rápidas: favorito / duele / no me gusta
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = favorito,
                    onClick = { favorito = !favorito; if (favorito) { duele = false; odiado = false }; persistir() },
                    label = { Text("Favorito") },
                    leadingIcon = { Icon(Icons.Rounded.Star, null, Modifier.size(16.dp)) },
                )
                FilterChip(
                    selected = duele,
                    onClick = { duele = !duele; if (duele) favorito = false; persistir() },
                    label = { Text("Me duele") },
                    leadingIcon = { Icon(Icons.Rounded.Warning, null, Modifier.size(16.dp)) },
                )
                FilterChip(
                    selected = odiado,
                    onClick = { odiado = !odiado; if (odiado) favorito = false; persistir() },
                    label = { Text("Evitar") },
                    leadingIcon = { Icon(Icons.Rounded.Block, null, Modifier.size(16.dp)) },
                )
            }

            Tarjeta {
                Text("Ajustes y notas personales", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = ajustes,
                    onValueChange = { ajustes = it; persistir() },
                    label = { Text("Ajuste de máquina (p. ej. Asiento 4 · respaldo 2)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = notas,
                    onValueChange = { notas = it; persistir() },
                    label = { Text("Notas personales") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            if (ej != null && ej.instrucciones.isNotEmpty()) {
                Tarjeta {
                    Text("Cómo se hace", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(8.dp))
                    ej.instrucciones.forEachIndexed { idx, paso ->
                        Row(modifier = Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            EtiquetaTag("${idx + 1}", colorFondo = p.raised, colorTexto = p.blue)
                            Text(paso, color = p.ink, fontFamily = FuenteCuerpo, fontSize = 14.5.sp, modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            if (ej != null && ej.consejos.isNotEmpty()) {
                Tarjeta {
                    Text("Consejos", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(6.dp))
                    ej.consejos.forEach { c ->
                        Text("• $c", color = p.muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 2.dp))
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

/** Pantalla de Gimnasios y material disponible (usado por el generador y el stepper de pesos). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaGimnasios(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    alVolver: () -> Unit,
    alGuardarGimnasio: (Gimnasio, Boolean) -> Unit,
    alActivarGimnasio: (Long) -> Unit,
    alBorrarGimnasio: (Long) -> Unit,
) {
    val p = LocalPaleta.current
    var editando by remember { mutableStateOf<Gimnasio?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = "Rutina",
            titulo = if (editando == null) "Gimnasios" else "Editar gimnasio",
            alVolver = { if (editando != null) editando = null else alVolver() },
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (editando == null) {
                if (estado.gimnasios.isNotEmpty()) {
                    ListaAgrupada {
                        estado.gimnasios.forEachIndexed { i, g ->
                            val activo = g.id == estado.gimnasioActivo?.id
                            FilaLista(
                                titulo = g.nombre,
                                subtitulo = "${g.material.size} máquinas/material · barra ${g.barraKg.toInt()} kg",
                                icono = Icons.Rounded.FitnessCenter,
                                alPulsar = { editando = g },
                                final = {
                                    if (activo) {
                                        Icon(Icons.Rounded.CheckCircle, contentDescription = "Activo", tint = p.ok)
                                    } else {
                                        FilterChip(selected = false, onClick = { g.id?.let(alActivarGimnasio) }, label = { Text("Usar") })
                                    }
                                },
                            )
                            if (i < estado.gimnasios.lastIndex) SeparadorLista()
                        }
                    }
                }
                BotonPrincipal(
                    texto = "+ Nuevo gimnasio",
                    icono = Icons.Rounded.Add,
                    onClick = {
                        editando = Gimnasio(
                            nombre = "Mi gimnasio",
                            material = PesosYDiscos.MATERIAL_HABITUAL.toList(),
                            mancuernas = listOf(Tramo(2.0, 10.0, 2.0), Tramo(12.5, 40.0, 2.5)),
                        )
                    },
                )
            } else {
                val gym = editando!!
                var nombre by remember(gym) { mutableStateOf(gym.nombre) }
                var seleccionados by remember(gym) { mutableStateOf(gym.material.toSet()) }
                var barraKg by remember(gym) { mutableStateOf(gym.barraKg) }

                OutlinedTextField(
                    value = nombre,
                    onValueChange = { nombre = it },
                    label = { Text("Nombre del gimnasio") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Tarjeta {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Peso de la barra principal", color = p.ink, fontWeight = FontWeight.SemiBold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { barraKg = (barraKg - 2.5).coerceAtLeast(10.0) }) { Icon(Icons.Rounded.Remove, null, tint = p.blue) }
                            Text("${barraKg.toInt()} kg", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold)
                            IconButton(onClick = { barraKg = (barraKg + 2.5).coerceAtMost(30.0) }) { Icon(Icons.Rounded.Add, null, tint = p.blue) }
                        }
                    }
                }

                PesosYDiscos.GRUPOS_MATERIAL.forEach { grupo ->
                    EtiquetaSeccionGrupo(grupo.nombre)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        grupo.claves.forEach { clave ->
                            val on = clave in seleccionados
                            val lbl = catalogo?.nombreMaterial(clave) ?: clave.replace('_', ' ')
                            FilterChip(
                                selected = on,
                                onClick = { seleccionados = if (on) seleccionados - clave else seleccionados + clave },
                                label = { Text(lbl, fontSize = 13.sp) },
                            )
                        }
                    }
                }

                Spacer(Modifier.height(6.dp))
                BotonPrincipal(
                    texto = "Guardar gimnasio",
                    enabled = nombre.isNotBlank(),
                    onClick = {
                        alGuardarGimnasio(gym.copy(nombre = nombre.trim(), material = seleccionados.toList(), barraKg = barraKg), true)
                        editando = null
                    },
                )
                if (gym.id != null) {
                    BotonSecundario(
                        texto = "Borrar gimnasio",
                        icono = Icons.Rounded.Delete,
                        peligro = true,
                        onClick = {
                            alBorrarGimnasio(gym.id)
                            editando = null
                        },
                    )
                }
            }
            Spacer(Modifier.height(48.dp))
        }
    }
}

/** Cabecera y acciones de Generador rápido dentro de Mi plan. */
@Composable
fun BloqueGeneradorYLibres(
    estado: EstadoPrincipal,
    alGenerarVariante: () -> Unit,
    alAbrirGimnasios: () -> Unit,
    alEmpezarLibre: () -> Unit,
    alEmpezarPlantilla: (com.jowy05.jowyfit.datos.modelo.PlantillaEntreno) -> Unit,
    alBorrarPlantilla: (String) -> Unit,
) {
    val p = LocalPaleta.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BotonSecundario(
                texto = "Otra variante",
                icono = Icons.Rounded.AutoAwesome,
                onClick = alGenerarVariante,
                modifier = Modifier.weight(1f),
            )
            BotonSecundario(
                texto = estado.gimnasioActivo?.nombre ?: "Gimnasios",
                icono = Icons.Rounded.FitnessCenter,
                onClick = alAbrirGimnasios,
                modifier = Modifier.weight(1f),
            )
        }

        EtiquetaSeccionGrupo("Otras formas de entrenar")
        ListaAgrupada {
            FilaLista(
                titulo = "Entreno libre",
                subtitulo = "Añade los ejercicios sobre la marcha sin tocar tu rutina",
                icono = Icons.Rounded.PlayArrow,
                alPulsar = alEmpezarLibre,
            )
            estado.ajustes.entrenosLibres.orEmpty().forEach { pl ->
                SeparadorLista()
                FilaLista(
                    titulo = pl.nombre,
                    subtitulo = "${pl.ejercicios.size} ejercicios · plantilla guardada",
                    icono = Icons.Rounded.FitnessCenter,
                    alPulsar = { alEmpezarPlantilla(pl) },
                    final = {
                        IconButton(onClick = { alBorrarPlantilla(pl.id) }) {
                            Icon(Icons.Rounded.Delete, contentDescription = "Borrar plantilla", tint = p.muted, modifier = Modifier.size(18.dp))
                        }
                    },
                )
            }
        }
    }
}

/** Hoja para elegir la versión de un día antes de empezar: Normal, Corta o Mínima. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaEmpezarDia(
    dia: DiaRutina,
    alCerrar: () -> Unit,
    alElegirVersion: (String) -> Unit,
) {
    val p = LocalPaleta.current
    val durNormal = CalculosDominio.duracionMinDia(dia.bloques)
    val bloquesCorta = remember(dia) { dia.bloques.filterNot { it.fueraEnCorta == true } }
    val durCorta = CalculosDominio.duracionMinDia(bloquesCorta)
    val bloquesMin = remember(dia) { dia.bloques.take(3).map { it.copy(series = minOf(it.series, 2)) } }
    val durMin = CalculosDominio.duracionMinDia(bloquesMin)

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(dia.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 24.sp)
            Text("Elige la duración para hoy:", color = p.muted, fontSize = 14.sp)

            BotonPrincipal(
                texto = "Normal · ~$durNormal min (${dia.bloques.size} ej.)",
                icono = Icons.Rounded.PlayArrow,
                grande = true,
                onClick = { alElegirVersion("normal") },
            )

            if (bloquesCorta.size < dia.bloques.size && bloquesCorta.isNotEmpty()) {
                Tarjeta(onClick = { alElegirVersion("corta") }, padding = PaddingValues(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Rounded.AccessTime, contentDescription = null, tint = p.blue)
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Versión corta · ~$durCorta min", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text("${bloquesCorta.size} ejercicios principales, sin accesorios secundarios.", color = p.muted, fontSize = 13.5.sp)
                        }
                    }
                }
            }

            if (bloquesMin.isNotEmpty()) {
                Tarjeta(onClick = { alElegirVersion("minima") }, padding = PaddingValues(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Rounded.Bolt, contentDescription = null, tint = p.go)
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Mínima · ~$durMin min", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text("${bloquesMin.size} ejercicios × 2 series para cumplir sin tiempo.", color = p.muted, fontSize = 13.5.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
        }
    }
}
