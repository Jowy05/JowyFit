package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AccessTime
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
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
import com.jowy05.jowyfit.ui.componentes.iconoBarbell
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import kotlinx.coroutines.delay

internal fun etiquetaPose(pose: String): String = when (pose) {
    "start" -> "Posición inicial"
    "peak" -> "Posición final"
    else -> "Posición"
}

/** Ficha completa del ejercicio: galería con todas las poses RepDB, músculos con ilustración, material, instrucciones, consejos y marcas. */
@OptIn(ExperimentalLayoutApi::class)
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
    val imagenes = remember(ej, catalogo) {
        if (ej != null && catalogo != null) catalogo.todasImagenesAsset(ej) else emptyList()
    }
    var poseIdx by remember(ejercicioId) { mutableIntStateOf(0) }
    var reinicioCiclo by remember(ejercicioId) { mutableIntStateOf(0) }

    LaunchedEffect(ejercicioId, imagenes.size, reinicioCiclo) {
        if (imagenes.size < 2) return@LaunchedEffect
        while (true) {
            delay(1800L)
            poseIdx = (poseIdx + 1) % imagenes.size
        }
    }

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
        if (ej != null && imagenes.isNotEmpty()) {
            val indiceSeguro = poseIdx.coerceIn(0, imagenes.lastIndex)
            val (poseActual, _) = imagenes[indiceSeguro]

            // Galería 1:1 con .gal de Ficha.tsx: muestra todas las poses RepDB con alternancia suave y toque manual.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFD9F0FC))
                    .statusBarsPadding()
                    .height(300.dp)
                    .clickable {
                        if (imagenes.size > 1) {
                            poseIdx = (indiceSeguro + 1) % imagenes.size
                            reinicioCiclo++
                        }
                    },
            ) {
                Crossfade(
                    targetState = indiceSeguro,
                    animationSpec = tween(350),
                    label = "ficha_pose",
                    modifier = Modifier.fillMaxSize(),
                ) { idx ->
                    val (pose, url) = imagenes[idx]
                    AsyncImage(
                        model = url,
                        contentDescription = "${ej.nombre} · ${etiquetaPose(pose)}",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 12.dp, bottom = 36.dp, start = 12.dp, end = 12.dp),
                    )
                }

                // Botón Atrás circular translúcido (1:1 con .gal-back)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 12.dp, top = 8.dp)
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.32f))
                        .clickable(onClick = alVolver),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Volver", tint = Color.White)
                }

                // Contador RepDB · 1 / 2 (1:1 con .gal-cnt)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(end = 14.dp, top = 14.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color.Black.copy(alpha = 0.36f))
                        .padding(horizontal = 9.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = "RepDB · ${indiceSeguro + 1} / ${imagenes.size}",
                        color = Color.White,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.5.sp,
                        letterSpacing = 0.8.sp,
                    )
                }

                // Puntos + etiqueta de pose abajo a la izquierda (1:1 con .gal-it figcaption)
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 16.dp, bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (imagenes.size > 1) {
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                            imagenes.indices.forEach { k ->
                                Box(
                                    modifier = Modifier
                                        .width(if (k == indiceSeguro) 18.dp else 6.dp)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(if (k == indiceSeguro) Color(0xFF16202B) else Color(0xFF16202B).copy(alpha = 0.28f)),
                                )
                            }
                        }
                    }
                    Text(
                        text = etiquetaPose(poseActual).uppercase(),
                        color = Color(0xFF16202B),
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.5.sp,
                        letterSpacing = 0.9.sp,
                    )
                }
            }
        } else {
            CabeceraPantalla(crumb = "Ejercicio", titulo = ejercicioId, alVolver = alVolver)
        }

        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Tira con todas las poses visibles a la vez cuando el ejercicio tiene 2 o más imágenes
            if (ej != null && imagenes.size > 1) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    imagenes.forEachIndexed { idx, (pose, url) ->
                        val activa = idx == poseIdx.coerceIn(0, imagenes.lastIndex)
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .clickable {
                                    poseIdx = idx
                                    reinicioCiclo++
                                },
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFD9F0FC),
                            border = BorderStroke(if (activa) 2.dp else 1.dp, if (activa) p.go else p.line),
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                AsyncImage(
                                    model = url,
                                    contentDescription = etiquetaPose(pose),
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(92.dp)
                                        .padding(6.dp),
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(if (activa) p.go else p.surface)
                                        .padding(vertical = 5.dp, horizontal = 8.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = "${idx + 1}. ${etiquetaPose(pose)}",
                                        color = if (activa) p.onGo else p.ink,
                                        fontFamily = FuenteTitulo,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.5.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (ej != null) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "${ej.zona.uppercase()} · ${catalogo.nombreMaterial(ej.material).uppercase()}",
                        color = p.muted,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        letterSpacing = 1.sp,
                    )
                    Text(
                        text = ej.nombre,
                        color = p.ink,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.Bold,
                        fontSize = 28.sp,
                        lineHeight = 31.sp,
                    )
                    if (ej.descripcion.isNotBlank()) {
                        Text(text = ej.descripcion, color = p.muted, fontFamily = FuenteCuerpo, fontSize = 14.5.sp)
                    }
                }
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

            // Músculos que trabaja + material con sus ilustraciones RepDB (1:1 con Ficha.tsx)
            if (ej != null && catalogo != null && (ej.principales.isNotEmpty() || ej.secundarios.isNotEmpty() || ej.material != null)) {
                val listaMusculos = ej.principales.map { it to true } + ej.secundarios.map { it to false }
                Tarjeta {
                    Text("Músculos que trabaja", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        listaMusculos.forEach { (clave, esPrincipal) ->
                            val imgMus = catalogo.imagenMusculoAsset(clave)
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(p.bg)
                                    .border(1.dp, p.line, RoundedCornerShape(10.dp))
                                    .padding(start = 4.dp, top = 4.dp, bottom = 4.dp, end = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                if (imgMus != null) {
                                    AsyncImage(
                                        model = imgMus,
                                        contentDescription = catalogo.nombreMusculo(clave),
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(Color.White)
                                            .padding(2.dp),
                                    )
                                }
                                Column {
                                    Text(
                                        text = catalogo.nombreMusculo(clave),
                                        color = p.ink,
                                        fontFamily = FuenteCuerpo,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.5.sp,
                                    )
                                    Text(
                                        text = if (esPrincipal) "principal" else "secundario",
                                        color = if (esPrincipal) p.blue else p.muted,
                                        fontSize = 11.5.sp,
                                    )
                                }
                            }
                        }
                    }

                    val imgMat = catalogo.imagenMaterialAsset(ej.material)
                    if (ej.material != null && imgMat != null) {
                        Spacer(Modifier.height(10.dp))
                        SeparadorLista()
                        Spacer(Modifier.height(10.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            AsyncImage(
                                model = imgMat,
                                contentDescription = catalogo.nombreMaterial(ej.material),
                                contentScale = ContentScale.Fit,
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.White)
                                    .padding(3.dp),
                            )
                            Column {
                                Text(catalogo.nombreMaterial(ej.material), color = p.ink, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp)
                                Text("Lo que necesitas", color = p.muted, fontSize = 12.5.sp)
                            }
                        }
                    }
                }
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

/** Contenido reutilizable de Gimnasios: se muestra inline en la 4.ª pestaña de Rutina o en pantalla independiente. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ContenidoGimnasios(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    alGuardarGimnasio: (Gimnasio, Boolean) -> Unit,
    alActivarGimnasio: (Long) -> Unit,
    alBorrarGimnasio: (Long) -> Unit,
    espacioInferior: androidx.compose.ui.unit.Dp = 112.dp,
) {
    val p = LocalPaleta.current
    var editando by remember { mutableStateOf<Gimnasio?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(2.dp))
        if (editando == null) {
            if (estado.gimnasios.isNotEmpty()) {
                ListaAgrupada {
                    estado.gimnasios.forEachIndexed { i, g ->
                        val activo = g.id == estado.gimnasioActivo?.id
                        FilaLista(
                            titulo = g.nombre,
                            subtitulo = "${g.material.size} máquinas/material · barra ${g.barraKg.toInt()} kg",
                            icono = iconoBarbell(bold = true),
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

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                IconButton(onClick = { editando = null }, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Volver", tint = p.ink)
                }
                Text("Editar gimnasio", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp)
            }

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
                        val imgMat = catalogo?.imagenMaterialAsset(clave)
                        FilterChip(
                            selected = on,
                            onClick = { seleccionados = if (on) seleccionados - clave else seleccionados + clave },
                            leadingIcon = if (imgMat != null) {
                                {
                                    AsyncImage(
                                        model = imgMat,
                                        contentDescription = null,
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(Color.White),
                                    )
                                }
                            } else null,
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
        Spacer(Modifier.height(espacioInferior))
    }
}

/** Pantalla independiente de Gimnasios (cuando se navega desde fuera de la pestaña Rutina). */
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
    Column(modifier = Modifier.fillMaxSize().background(p.bg)) {
        CabeceraPantalla(crumb = "Rutina", titulo = "Gimnasios", alVolver = alVolver)
        ContenidoGimnasios(
            estado = estado,
            catalogo = catalogo,
            alGuardarGimnasio = alGuardarGimnasio,
            alActivarGimnasio = alActivarGimnasio,
            alBorrarGimnasio = alBorrarGimnasio,
            espacioInferior = 48.dp,
        )
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
    val iconoBarra = iconoBarbell(bold = true)
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
                icono = iconoBarra,
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
                    icono = iconoBarra,
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
