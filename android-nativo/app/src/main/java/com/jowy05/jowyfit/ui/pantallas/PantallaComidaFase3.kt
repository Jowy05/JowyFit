package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.BookmarkAdd
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.datos.modelo.BatidoPerfil
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.nativo.ClienteOpenFoodFacts
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaSeccionGrupo
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeccionTitulo
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.roundToInt

/** Pestaña Comida completa (Fase 3): Día por franjas, repetir ayer, suplementos, cafeína, Mis comidas, escáner y Energía. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaComidaCompleta(
    estado: EstadoPrincipal,
    alAbrirEscaner: (String, String) -> Unit,
    alGuardarComida: (Comida) -> Unit,
    alBorrarComida: (Long) -> Unit,
    alCopiarAyer: (String, String?) -> Unit,
    alApuntarPlantilla: (Plantilla, String, String, String) -> Unit,
    alGuardarPlantilla: (Plantilla) -> Unit,
    alBorrarPlantilla: (Long) -> Unit,
    alAbrirProducto: (Producto, String, String) -> Unit,
    alBorrarProducto: (String) -> Unit,
    alAlternarSuplemento: (String, String) -> Unit,
    alGuardarSuplementos: (List<String>, BatidoPerfil?) -> Unit,
    alActualizarAjustesEnergia: (Int?, Int?, Boolean) -> Unit,
) {
    val p = LocalPaleta.current
    val hoy = remember { LocalDate.now() }
    var subtab by remember { mutableStateOf("dia") }
    var fechaSel by remember { mutableStateOf(hoy) }
    val fechaIso = fechaSel.toString()
    val ayerIso = fechaSel.minusDays(1).toString()
    val horaAhora = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
    val franjaActual = ComidaDominio.franjaPorHora(horaAhora)

    var hojaAnadirFranja by remember { mutableStateOf<String?>(null) }
    var comidaEditando by remember { mutableStateOf<Comida?>(null) }
    var hojaNuevaPlantilla by remember { mutableStateOf(false) }
    var filtroPlantillas by remember { mutableStateOf("") }

    val comidasDia = remember(estado.comidas, fechaIso) {
        estado.comidas.filter { it.fecha == fechaIso }.sortedBy { it.hora }
    }
    val comidasAyer = remember(estado.comidas, ayerIso) {
        ComidaDominio.deAyer(estado.comidas, ayerIso)
    }
    val tot = CalculosDominio.totalesComida(comidasDia)
    val energia = CalculosDominio.calcularObjetivos(
        perfil = estado.perfil,
        pesoActual = estado.ultimoPeso,
        kcalManual = estado.ajustes.kcalManual,
        proteinaManual = estado.ajustes.proteinaManual,
    )
    val tomadosHoy = remember(estado.suplementos, fechaIso) {
        estado.suplementos.firstOrNull { it.fecha == fechaIso }?.tomados?.toSet().orEmpty()
    }

    val etiquetaFecha = when (fechaSel) {
        hoy -> "Hoy"
        hoy.minusDays(1) -> "Ayer"
        hoy.plusDays(1) -> "Mañana"
        else -> fechaSel.format(DateTimeFormatter.ofPattern("dd/MM"))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg),
    ) {
        CabeceraPantalla(
            crumb = t("Comida"),
            titulo = when (subtab) {
                "dia" -> etiquetaFecha
                "mis" -> "Mis comidas"
                else -> "Energía"
            },
            sub = "${tot.proteina} / ${energia.proteina} g proteína" +
                if (estado.ajustes.mostrarKcal) " · ${tot.kcal} / ~${energia.kcal} kcal" else "",
            derecha = if (subtab == "dia") {
                {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { fechaSel = fechaSel.minusDays(1) }) {
                            Icon(Icons.AutoMirrored.Rounded.KeyboardArrowLeft, contentDescription = "Día anterior", tint = p.ink)
                        }
                        if (fechaSel != hoy) {
                            TextButton(onClick = { fechaSel = hoy }, contentPadding = PaddingValues(horizontal = 6.dp)) {
                                Text("Hoy", color = p.go, fontWeight = FontWeight.Bold)
                            }
                        }
                        IconButton(onClick = { fechaSel = fechaSel.plusDays(1) }, enabled = fechaSel < hoy.plusDays(1)) {
                            Icon(
                                Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                                contentDescription = "Día siguiente",
                                tint = if (fechaSel < hoy.plusDays(1)) p.ink else p.muted,
                            )
                        }
                    }
                }
            } else null,
            extra = {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = subtab == "dia", onClick = { subtab = "dia" }, label = { Text("Día") })
                    FilterChip(
                        selected = subtab == "mis",
                        onClick = { subtab = "mis" },
                        label = { Text("Mis comidas (${estado.plantillas.size})") },
                    )
                    FilterChip(selected = subtab == "energia", onClick = { subtab = "energia" }, label = { Text("Energía") })
                }
            },
        )

        when (subtab) {
            "dia" -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Resumen proteína + calorías
                    Tarjeta {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("PROTEÍNA", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            Text(
                                text = if (tot.proteina >= energia.proteina) "Objetivo cumplido"
                                else "Faltan ${max(0, energia.proteina - tot.proteina)} g",
                                color = if (tot.proteina >= energia.proteina) p.ok else p.muted,
                                fontSize = 13.sp,
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text("${tot.proteina} / ${energia.proteina} g", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        Spacer(Modifier.height(8.dp))
                        BarraProgreso(valor = tot.proteina.toDouble(), total = energia.proteina.toDouble(), color = p.ok, gruesa = true)

                        if (estado.ajustes.mostrarKcal) {
                            Spacer(Modifier.height(12.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("CALORÍAS (ORIENTATIVO)", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text("${tot.kcal} / ~${energia.kcal} kcal", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
                            }
                            Spacer(Modifier.height(6.dp))
                            BarraProgreso(valor = tot.kcal.toDouble(), total = energia.kcal.toDouble(), color = p.blue)
                        }
                    }

                    // Cafeína (solo si hay cafeína registrada ese día)
                    if (tot.cafeina > 0) {
                        val av = ComidaDominio.avisoCafeina(tot.cafeina, estado.ajustes.cafeinaLimite, estado.ajustes.cafeinaHoraTope, horaAhora)
                        val colorCaf = when (av.tono) {
                            ComidaDominio.TonoCafeina.BAD -> p.bad
                            ComidaDominio.TonoCafeina.WARN -> p.warn
                            ComidaDominio.TonoCafeina.OK -> p.blue
                        }
                        Tarjeta(padding = PaddingValues(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Icon(Icons.Rounded.Coffee, contentDescription = null, tint = colorCaf)
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("CAFEÍNA", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                        Text("${tot.cafeina} / ${estado.ajustes.cafeinaLimite} mg", color = colorCaf, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    BarraProgreso(valor = tot.cafeina.toDouble(), total = estado.ajustes.cafeinaLimite.toDouble(), color = colorCaf)
                                    Spacer(Modifier.height(4.dp))
                                    Text(av.texto, color = p.muted, fontSize = 12.5.sp)
                                }
                            }
                        }
                    }

                    // Acciones principales: Añadir + Escanear
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BotonPrincipal(
                            texto = "+ Añadir",
                            icono = Icons.Rounded.Add,
                            onClick = { hojaAnadirFranja = franjaActual },
                            modifier = Modifier.weight(1.2f),
                        )
                        BotonSecundario(
                            texto = "Escanear",
                            icono = Icons.Rounded.QrCodeScanner,
                            onClick = { alAbrirEscaner(fechaIso, franjaActual) },
                            modifier = Modifier.weight(1f),
                        )
                    }

                    // Suplementos diarios (Creatina, Batido de proteína…)
                    val sups = estado.perfil.suplementos
                    if (sups.isNotEmpty()) {
                        Tarjeta(padding = PaddingValues(12.dp)) {
                            Text("SUPLEMENTOS DE $etiquetaFecha".uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
                            Spacer(Modifier.height(6.dp))
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                sups.forEach { s ->
                                    val on = s in tomadosHoy
                                    val dosis = ComidaDominio.dosisDe(estado.perfil.dosisSuplementos, s)
                                    val etiqueta = if (dosis.isNotBlank()) "$s ($dosis)" else s
                                    FilterChip(
                                        selected = on,
                                        onClick = { alAlternarSuplemento(fechaIso, s) },
                                        label = { Text(etiqueta, fontSize = 13.sp) },
                                        leadingIcon = if (on) ({ Icon(Icons.Rounded.Check, null, Modifier.size(16.dp)) }) else null,
                                    )
                                }
                            }
                        }
                    } else {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = false,
                                onClick = { alGuardarSuplementos(listOf("Creatina", "Batido de proteína"), BatidoPerfil(24.0, 120.0)) },
                                label = { Text("+ Activar creatina y batido") },
                            )
                        }
                    }

                    // Repetir día de ayer si el día está vacío y ayer hubo comidas
                    if (comidasDia.isEmpty() && comidasAyer.isNotEmpty()) {
                        BotonSecundario(
                            texto = "Repetir día de ayer (${comidasAyer.size} comidas)",
                            icono = Icons.Rounded.History,
                            onClick = { alCopiarAyer(fechaIso, null) },
                        )
                    }

                    // Las 4 franjas del día
                    ComidaDominio.FRANJAS.forEach { franja ->
                        val lista = comidasDia.filter { it.franja == franja }
                        val ayerFranja = comidasAyer.filter { it.franja == franja }
                        val protFranja = lista.sumOf { it.proteina }.roundToInt()
                        val kcalFranja = lista.sumOf { it.kcal }.roundToInt()

                        Tarjeta(padding = PaddingValues(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = ComidaDominio.nombreFranja(franja),
                                        color = p.ink,
                                        fontFamily = FuenteTitulo,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 19.sp,
                                    )
                                    if (lista.isNotEmpty()) {
                                        Text(
                                            text = "$protFranja g prot." + if (estado.ajustes.mostrarKcal) " · $kcalFranja kcal" else "",
                                            color = p.muted,
                                            fontFamily = FuenteMono,
                                            fontSize = 12.5.sp,
                                        )
                                    }
                                }
                                IconButton(onClick = { hojaAnadirFranja = franja }, modifier = Modifier.size(36.dp)) {
                                    Icon(Icons.Rounded.Add, contentDescription = "Añadir a $franja", tint = p.go)
                                }
                            }

                            if (lista.isEmpty()) {
                                if (ayerFranja.isNotEmpty()) {
                                    Spacer(Modifier.height(4.dp))
                                    TextButton(
                                        onClick = { alCopiarAyer(fechaIso, franja) },
                                        contentPadding = PaddingValues(horizontal = 4.dp),
                                    ) {
                                        Icon(Icons.Rounded.History, contentDescription = null, tint = p.blue, modifier = Modifier.size(16.dp))
                                        Text(
                                            text = " Repetir ${ComidaDominio.nombreFranja(franja).lowercase()} de ayer (${ayerFranja.size})",
                                            color = p.blue,
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                } else {
                                    Text("Sin apuntar", color = p.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
                                }
                            } else {
                                Spacer(Modifier.height(6.dp))
                                lista.forEachIndexed { idx, c ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { comidaEditando = c }
                                            .padding(vertical = 7.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(c.nombre, color = p.ink, fontWeight = FontWeight.Medium, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                            val detalles = buildList {
                                                add(c.hora)
                                                if (c.racion != "N") add(ComidaDominio.nombreRacion(c.racion))
                                                if (c.cafeina != null && c.cafeina > 0) add("${c.cafeina.roundToInt()} mg cafeína")
                                            }.joinToString(" · ")
                                            Text(detalles, color = p.muted, fontSize = 12.5.sp)
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text("${c.proteina.roundToInt()} g", color = p.ok, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            if (estado.ajustes.mostrarKcal) {
                                                Text("${c.kcal.roundToInt()} kcal", color = p.muted, fontFamily = FuenteMono, fontSize = 12.sp)
                                            }
                                        }
                                    }
                                    if (idx < lista.lastIndex) SeparadorLista()
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
                }
            }

            "mis" -> {
                val ordenadas = remember(estado.plantillas, filtroPlantillas) {
                    val q = filtroPlantillas.trim().lowercase()
                    ComidaDominio.ordenarPlantillas(estado.plantillas).filter {
                        q.isEmpty() || it.nombre.lowercase().contains(q)
                    }
                }
                val sueltos = remember(estado.productos, estado.plantillas, filtroPlantillas) {
                    val q = filtroPlantillas.trim().lowercase()
                    ComidaDominio.escaneadosSueltos(estado.productos, estado.plantillas).filter {
                        q.isEmpty() || it.nombre.lowercase().contains(q) || it.marca.lowercase().contains(q)
                    }
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedTextField(
                        value = filtroPlantillas,
                        onValueChange = { filtroPlantillas = it },
                        placeholder = { Text("Buscar en Mis comidas o escaneados…") },
                        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BotonPrincipal(
                            texto = "+ Nueva comida",
                            icono = Icons.Rounded.Add,
                            onClick = { hojaNuevaPlantilla = true },
                            modifier = Modifier.weight(1f),
                        )
                        BotonSecundario(
                            texto = "Escanear",
                            icono = Icons.Rounded.QrCodeScanner,
                            onClick = { alAbrirEscaner(fechaIso, franjaActual) },
                            modifier = Modifier.weight(0.9f),
                        )
                    }

                    if (ordenadas.isEmpty()) {
                        NotaAviso(
                            texto = "Guarda aquí tus platos habituales para apuntarlos en un toque como Poco, Normal o Mucho.",
                            tono = TonoNota.INFO,
                            icono = Icons.Rounded.Restaurant,
                        )
                    } else {
                        ordenadas.forEach { pl ->
                            Tarjeta(padding = PaddingValues(12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(pl.nombre, color = p.ink, fontWeight = FontWeight.SemiBold, fontSize = 15.5.sp)
                                        Text(
                                            text = "${pl.proteina.roundToInt()} g prot." +
                                                (if (estado.ajustes.mostrarKcal) " · ${pl.kcal.roundToInt()} kcal" else "") +
                                                if (pl.usos > 0) " · ${pl.usos} usos" else "",
                                            color = p.muted,
                                            fontFamily = FuenteMono,
                                            fontSize = 12.5.sp,
                                        )
                                    }
                                    pl.id?.let { id ->
                                        IconButton(onClick = { alBorrarPlantilla(id) }, modifier = Modifier.size(34.dp)) {
                                            Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = p.muted, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("P", "N", "G").forEach { rac ->
                                        FilterChip(
                                            selected = rac == "N",
                                            onClick = { alApuntarPlantilla(pl, rac, fechaIso, pl.franja ?: franjaActual) },
                                            label = { Text(ComidaDominio.nombreRacion(rac), fontSize = 13.sp) },
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (sueltos.isNotEmpty()) {
                        SeccionTitulo(titulo = "Escaneados recientes")
                        ListaAgrupada {
                            sueltos.forEachIndexed { idx, prod ->
                                val r = ComidaDominio.porRacion(prod)
                                FilaLista(
                                    titulo = prod.nombre,
                                    subtitulo = "${prod.marca.ifBlank { prod.codigo }} · ${r.proteina.roundToInt()} g prot. · ${r.kcal.roundToInt()} kcal",
                                    icono = Icons.Rounded.QrCodeScanner,
                                    alPulsar = { alAbrirProducto(prod, fechaIso, franjaActual) },
                                    final = {
                                        IconButton(onClick = { alBorrarProducto(prod.codigo) }) {
                                            Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = p.muted, modifier = Modifier.size(18.dp))
                                        }
                                    },
                                )
                                if (idx < sueltos.lastIndex) SeparadorLista()
                            }
                        }
                    }

                    Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
                }
            }

            else -> {
                val pasosHoy = estado.pasos.firstOrNull { it.fecha == fechaIso }?.pasos ?: 0
                val kcalPasos = CalculosDominio.kcalPasos(pasosHoy, estado.ultimoPeso ?: 75.0, estado.perfil.alturaCm)
                var kcalManTxt by remember(estado.ajustes.kcalManual) { mutableStateOf(estado.ajustes.kcalManual?.toString().orEmpty()) }
                var protManTxt by remember(estado.ajustes.proteinaManual) { mutableStateOf(estado.ajustes.proteinaManual?.toString().orEmpty()) }
                var mostrarKcal by remember(estado.ajustes.mostrarKcal) { mutableStateOf(estado.ajustes.mostrarKcal) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Tarjeta {
                        Text("TU GASTO ESTIMADO", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        FilaDato("Metabolismo basal (Mifflin)", "${energia.basal} kcal")
                        SeparadorLista()
                        FilaDato("Pasos hoy ($pasosHoy)", "~$kcalPasos kcal")
                        SeparadorLista()
                        FilaDato("Objetivo calorías", "~${energia.kcal} kcal")
                        SeparadorLista()
                        FilaDato("Objetivo proteína", "${energia.proteina} g")
                    }

                    Tarjeta {
                        Text("AJUSTE MANUAL", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text("Mostrar calorías en la app", color = p.ink, fontSize = 15.sp)
                            Switch(
                                checked = mostrarKcal,
                                onCheckedChange = { v ->
                                    mostrarKcal = v
                                    alActualizarAjustesEnergia(kcalManTxt.toIntOrNull(), protManTxt.toIntOrNull(), v)
                                },
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = protManTxt,
                                onValueChange = { protManTxt = it.filter(Char::isDigit).take(3) },
                                label = { Text("Proteína (g)") },
                                placeholder = { Text("${energia.proteina}") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                value = kcalManTxt,
                                onValueChange = { kcalManTxt = it.filter(Char::isDigit).take(4) },
                                label = { Text("Calorías (kcal)") },
                                placeholder = { Text("${energia.kcal}") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        BotonPrincipal(
                            texto = "Guardar objetivos",
                            onClick = {
                                alActualizarAjustesEnergia(
                                    kcalManTxt.toIntOrNull()?.takeIf { it in 800..8000 },
                                    protManTxt.toIntOrNull()?.takeIf { it in 30..400 },
                                    mostrarKcal,
                                )
                            },
                        )
                    }

                    Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
                }
            }
        }
    }

    hojaAnadirFranja?.let { franjaIni ->
        HojaAnadirComidaCompleta(
            estado = estado,
            fechaIso = fechaIso,
            franjaInicial = franjaIni,
            alCerrar = { hojaAnadirFranja = null },
            alAbrirEscaner = { fr ->
                hojaAnadirFranja = null
                alAbrirEscaner(fechaIso, fr)
            },
            alGuardarComida = { c, guardarPl ->
                alGuardarComida(c)
                if (guardarPl) {
                    alGuardarPlantilla(
                        Plantilla(
                            nombre = c.nombre,
                            kcal = c.kcal,
                            proteina = c.proteina,
                            cafeina = c.cafeina,
                            franja = c.franja,
                            tipo = if (c.tipo in setOf("bebida", "picoteo")) c.tipo else "comida",
                            usos = 1,
                        ),
                    )
                }
                hojaAnadirFranja = null
            },
            alApuntarPlantilla = { pl, rac, fr ->
                alApuntarPlantilla(pl, rac, fechaIso, fr)
                hojaAnadirFranja = null
            },
        )
    }

    comidaEditando?.let { original ->
        HojaEditarComida(
            comida = original,
            alCerrar = { comidaEditando = null },
            alGuardar = { editada ->
                alGuardarComida(editada)
                comidaEditando = null
            },
            alBorrar = {
                original.id?.let(alBorrarComida)
                comidaEditando = null
            },
        )
    }

    if (hojaNuevaPlantilla) {
        HojaNuevaPlantillaComida(
            alCerrar = { hojaNuevaPlantilla = false },
            alGuardar = { pl ->
                alGuardarPlantilla(pl)
                hojaNuevaPlantilla = false
            },
        )
    }
}

@Composable
private fun FilaDato(etiqueta: String, valor: String) {
    val p = LocalPaleta.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(etiqueta, color = p.muted, fontSize = 14.5.sp)
        Text(valor, color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}
