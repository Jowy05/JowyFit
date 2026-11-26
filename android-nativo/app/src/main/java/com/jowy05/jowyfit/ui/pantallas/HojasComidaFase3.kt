package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.rounded.BookmarkAdd
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.Producto
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.nativo.ClienteOpenFoodFacts
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaAnadirComidaCompleta(
    estado: EstadoPrincipal,
    fechaIso: String,
    franjaInicial: String,
    alCerrar: () -> Unit,
    alAbrirEscaner: (String) -> Unit,
    alGuardarComida: (Comida, Boolean) -> Unit,
    alApuntarPlantilla: (Plantilla, String, String) -> Unit,
) {
    val p = LocalPaleta.current
    var modo by remember { mutableStateOf("nota") }
    var franja by remember { mutableStateOf(franjaInicial) }
    var nombre by remember { mutableStateOf("") }
    var tamano by remember { mutableStateOf("normal") }
    var tipo by remember { mutableStateOf("nota") }
    val estInicial = ComidaDominio.notaPorTamano("normal", franjaInicial)
    var kcalTxt by remember { mutableStateOf(estInicial.first.toString()) }
    var protTxt by remember { mutableStateOf(estInicial.second.toString()) }
    var cafTxt by remember { mutableStateOf("") }
    var guardarComoPlantilla by remember { mutableStateOf(false) }

    val plantillas = remember(estado.plantillas) { ComidaDominio.ordenarPlantillas(estado.plantillas) }
    val recientes = remember(estado.comidas, estado.plantillas, fechaIso) {
        ComidaDominio.recientes(estado.comidas, fechaIso, estado.plantillas)
    }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Añadir comida", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
                TextButton(onClick = { alAbrirEscaner(franja) }) {
                    Icon(Icons.Rounded.QrCodeScanner, contentDescription = null, tint = p.go, modifier = Modifier.size(18.dp))
                    Text(" Escanear", color = p.go, fontWeight = FontWeight.Bold)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ComidaDominio.FRANJAS.forEach { f ->
                    FilterChip(
                        selected = franja == f,
                        onClick = {
                            franja = f
                            val est = ComidaDominio.notaPorTamano(tamano, f)
                            kcalTxt = est.first.toString()
                            protTxt = est.second.toString()
                        },
                        label = { Text(ComidaDominio.nombreFranja(f), fontSize = 12.5.sp) },
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = modo == "nota", onClick = { modo = "nota" }, label = { Text("Nota") })
                FilterChip(selected = modo == "plantillas", onClick = { modo = "plantillas" }, label = { Text("Mis comidas (${plantillas.size})") })
                FilterChip(selected = modo == "recientes", onClick = { modo = "recientes" }, label = { Text("Recientes") })
            }

            when (modo) {
                "nota" -> {
                    OutlinedTextField(
                        value = nombre,
                        onValueChange = { nombre = it },
                        label = { Text("Qué has comido o bebido") },
                        placeholder = { Text("Ej. Pollo con arroz, café solo…") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("ligera" to "Poco", "normal" to "Normal", "abundante" to "Mucho").forEach { (k, lbl) ->
                            FilterChip(
                                selected = tamano == k,
                                onClick = {
                                    tamano = k
                                    val est = ComidaDominio.notaPorTamano(k, franja)
                                    kcalTxt = est.first.toString()
                                    protTxt = est.second.toString()
                                },
                                label = { Text(lbl) },
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("nota" to "Plato", "bebida" to "Bebida", "picoteo" to "Picoteo").forEach { (k, lbl) ->
                            FilterChip(selected = tipo == k, onClick = { tipo = k }, label = { Text(lbl) })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = protTxt,
                            onValueChange = { protTxt = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                            label = { Text("Proteína (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = kcalTxt,
                            onValueChange = { kcalTxt = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                            label = { Text("kcal") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = cafTxt,
                            onValueChange = { cafTxt = it.filter(Char::isDigit).take(4) },
                            label = { Text("Cafeína mg") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = guardarComoPlantilla, onCheckedChange = { guardarComoPlantilla = it })
                        Text("Guardar también en Mis comidas", color = p.ink, fontSize = 14.sp)
                    }
                    BotonPrincipal(
                        texto = "Apuntar",
                        enabled = nombre.isNotBlank(),
                        grande = true,
                        onClick = {
                            val hora = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
                            alGuardarComida(
                                Comida(
                                    fecha = fechaIso,
                                    hora = hora,
                                    franja = franja,
                                    nombre = nombre.trim(),
                                    kcal = kcalTxt.replace(',', '.').toDoubleOrNull() ?: 0.0,
                                    proteina = protTxt.replace(',', '.').toDoubleOrNull() ?: 0.0,
                                    cafeina = cafTxt.toDoubleOrNull()?.takeIf { it > 0 },
                                    racion = when (tamano) {
                                        "ligera" -> "P"
                                        "abundante" -> "G"
                                        else -> "N"
                                    },
                                    tipo = tipo,
                                ),
                                guardarComoPlantilla,
                            )
                        },
                    )
                }

                "plantillas" -> {
                    if (plantillas.isEmpty()) {
                        NotaAviso("Todavía no tienes comidas guardadas en Mis comidas.", tono = TonoNota.INFO)
                    } else {
                        plantillas.take(15).forEach { pl ->
                            Tarjeta(padding = PaddingValues(10.dp)) {
                                Text(pl.nombre, color = p.ink, fontWeight = FontWeight.SemiBold)
                                Text("${pl.proteina.roundToInt()} g prot. · ${pl.kcal.roundToInt()} kcal", color = p.muted, fontFamily = FuenteMono, fontSize = 12.5.sp)
                                Spacer(Modifier.height(6.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("P", "N", "G").forEach { rac ->
                                        FilterChip(
                                            selected = rac == "N",
                                            onClick = { alApuntarPlantilla(pl, rac, franja) },
                                            label = { Text(ComidaDominio.nombreRacion(rac), fontSize = 12.5.sp) },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                else -> {
                    if (recientes.isEmpty()) {
                        NotaAviso("Aún no hay comidas recientes fuera de Mis comidas.", tono = TonoNota.INFO)
                    } else {
                        ListaAgrupada {
                            recientes.forEachIndexed { idx, rec ->
                                FilaLista(
                                    titulo = rec.nombre,
                                    subtitulo = "${rec.proteina.roundToInt()} g prot. · ${rec.kcal.roundToInt()} kcal",
                                    icono = Icons.Rounded.History,
                                    alPulsar = {
                                        val hora = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
                                        alGuardarComida(rec.copy(id = null, fecha = fechaIso, hora = hora, franja = franja, suplemento = null), false)
                                    },
                                )
                                if (idx < recientes.lastIndex) SeparadorLista()
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HojaEditarComida(
    comida: Comida,
    alCerrar: () -> Unit,
    alGuardar: (Comida) -> Unit,
    alBorrar: () -> Unit,
) {
    val p = LocalPaleta.current
    var nombre by remember(comida) { mutableStateOf(comida.nombre) }
    var franja by remember(comida) { mutableStateOf(comida.franja) }
    var kcalTxt by remember(comida) { mutableStateOf(comida.kcal.roundToInt().toString()) }
    var protTxt by remember(comida) { mutableStateOf(comida.proteina.roundToInt().toString()) }
    var cafTxt by remember(comida) { mutableStateOf(comida.cafeina?.roundToInt()?.toString().orEmpty()) }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Editar comida", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ComidaDominio.FRANJAS.forEach { f ->
                    FilterChip(selected = franja == f, onClick = { franja = f }, label = { Text(ComidaDominio.nombreFranja(f), fontSize = 12.5.sp) })
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = protTxt, onValueChange = { protTxt = it.filter(Char::isDigit) }, label = { Text("Proteína (g)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = kcalTxt, onValueChange = { kcalTxt = it.filter(Char::isDigit) }, label = { Text("kcal") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = cafTxt, onValueChange = { cafTxt = it.filter(Char::isDigit) }, label = { Text("Cafeína mg") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
            }
            BotonPrincipal(
                texto = "Guardar cambios",
                enabled = nombre.isNotBlank(),
                onClick = {
                    alGuardar(
                        comida.copy(
                            nombre = nombre.trim(),
                            franja = franja,
                            kcal = kcalTxt.toDoubleOrNull() ?: comida.kcal,
                            proteina = protTxt.toDoubleOrNull() ?: comida.proteina,
                            cafeina = cafTxt.toDoubleOrNull()?.takeIf { it > 0 },
                        ),
                    )
                },
            )
            BotonSecundario(texto = "Borrar comida", icono = Icons.Rounded.Delete, peligro = true, onClick = alBorrar)
            Spacer(Modifier.height(10.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HojaNuevaPlantillaComida(
    alCerrar: () -> Unit,
    alGuardar: (Plantilla) -> Unit,
) {
    val p = LocalPaleta.current
    var nombre by remember { mutableStateOf("") }
    var kcalTxt by remember { mutableStateOf("450") }
    var protTxt by remember { mutableStateOf("30") }
    var cafTxt by remember { mutableStateOf("") }
    var tipo by remember { mutableStateOf("comida") }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Nueva comida habitual", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre del plato o bebida") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("comida" to "Plato", "bebida" to "Bebida", "picoteo" to "Picoteo").forEach { (k, lbl) ->
                    FilterChip(selected = tipo == k, onClick = { tipo = k }, label = { Text(lbl) })
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = protTxt, onValueChange = { protTxt = it.filter(Char::isDigit) }, label = { Text("Proteína (g)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = kcalTxt, onValueChange = { kcalTxt = it.filter(Char::isDigit) }, label = { Text("kcal") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = cafTxt, onValueChange = { cafTxt = it.filter(Char::isDigit) }, label = { Text("Cafeína mg") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
            }
            BotonPrincipal(
                texto = "Guardar en Mis comidas",
                enabled = nombre.isNotBlank(),
                onClick = {
                    alGuardar(
                        Plantilla(
                            nombre = nombre.trim(),
                            kcal = kcalTxt.toDoubleOrNull() ?: 0.0,
                            proteina = protTxt.toDoubleOrNull() ?: 0.0,
                            cafeina = cafTxt.toDoubleOrNull()?.takeIf { it > 0 },
                            tipo = tipo,
                        ),
                    )
                },
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}

/** Hoja de producto escaneado (Open Food Facts o creación manual) con selector de ración / gramos. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaProductoEscaneado(
    codigo: String,
    productoInicial: Producto?,
    fechaIso: String,
    franjaInicial: String,
    alBuscarCodigo: (String, (ClienteOpenFoodFacts.Resultado) -> Unit) -> Unit,
    alGuardarProducto: (Producto) -> Unit,
    alGuardarComida: (Comida) -> Unit,
    alGuardarComoPlantilla: (Producto) -> Unit,
    alCerrar: () -> Unit,
) {
    val p = LocalPaleta.current
    var cargando by remember(codigo) { mutableStateOf(productoInicial == null) }
    var producto by remember(codigo) { mutableStateOf(productoInicial) }
    var estadoBusqueda by remember(codigo) { mutableStateOf<String?>(null) }

    LaunchedEffect(codigo, productoInicial) {
        if (productoInicial == null) {
            cargando = true
            alBuscarCodigo(codigo) { res ->
                cargando = false
                when (res) {
                    is ClienteOpenFoodFacts.Resultado.Encontrado -> {
                        producto = res.producto
                        estadoBusqueda = null
                    }
                    ClienteOpenFoodFacts.Resultado.NoEncontrado -> estadoBusqueda = "No aparece en Open Food Facts. Puedes guardarlo a mano."
                    ClienteOpenFoodFacts.Resultado.SinConexion -> estadoBusqueda = "Sin conexión a Open Food Facts. Puedes rellenarlo a mano."
                }
            }
        }
    }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            when {
                cargando -> {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            CircularProgressIndicator(color = p.go)
                            Text("Buscando código $codigo…", color = p.muted, fontFamily = FuenteMono, fontSize = 13.sp)
                        }
                    }
                }
                producto != null -> {
                    val prod = producto!!
                    val base = remember(prod) { ComidaDominio.porRacion(prod) }
                    var modoGramos by remember(prod) { mutableStateOf(false) }
                    var racion by remember(prod) { mutableStateOf("N") }
                    var gramosTxt by remember(prod) { mutableStateOf((prod.racionG?.roundToInt() ?: 100).toString()) }
                    var franja by remember { mutableStateOf(franjaInicial) }

                    val valores = if (modoGramos && prod.kcal100 != null) {
                        ComidaDominio.porGramos(prod, gramosTxt.toDoubleOrNull() ?: 100.0)
                    } else {
                        ComidaDominio.conRacion(base.kcal, base.proteina, base.cafeina, base.macros, racion, "comida")
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        val imgSegura = ComidaDominio.imagenOFF(prod.imagen)
                        if (imgSegura != null) {
                            AsyncImage(
                                model = imgSegura,
                                contentDescription = prod.nombre,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(64.dp).clip(RoundedCornerShape(10.dp)),
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(prod.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                            Text(
                                text = listOf(prod.marca, prod.codigo).filter { it.isNotBlank() }.joinToString(" · "),
                                color = p.muted,
                                fontSize = 13.sp,
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = !modoGramos, onClick = { modoGramos = false }, label = { Text(if (base.base == "racion") "Por ración" else "Por 100 g") })
                        if (prod.kcal100 != null) {
                            FilterChip(selected = modoGramos, onClick = { modoGramos = true }, label = { Text("En gramos") })
                        }
                    }

                    if (!modoGramos) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("P", "N", "G").forEach { rac ->
                                FilterChip(
                                    selected = racion == rac,
                                    onClick = { racion = rac },
                                    label = { Text(ComidaDominio.nombreRacion(rac)) },
                                )
                            }
                        }
                    } else {
                        OutlinedTextField(
                            value = gramosTxt,
                            onValueChange = { gramosTxt = it.filter(Char::isDigit).take(4) },
                            label = { Text("Gramos consumidos") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Tarjeta(padding = PaddingValues(12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            EtiquetaTag("${valores.proteina.roundToInt()} g proteína", colorFondo = p.okT, colorTexto = p.ok)
                            EtiquetaTag("${valores.kcal.roundToInt()} kcal", colorFondo = p.blueT, colorTexto = p.blue)
                            valores.cafeina?.let { c -> EtiquetaTag("${c.roundToInt()} mg caf.", colorFondo = p.goT, colorTexto = p.go) }
                        }
                        val macrosTxt = buildList {
                            valores.hidratos?.let { add("HC ${it} g") }
                            valores.azucares?.let { add("Azúc. ${it} g") }
                            valores.grasas?.let { add("Grasas ${it} g") }
                            valores.sal?.let { add("Sal ${it} g") }
                        }.joinToString(" · ")
                        if (macrosTxt.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(macrosTxt, color = p.muted, fontFamily = FuenteMono, fontSize = 12.sp)
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ComidaDominio.FRANJAS.forEach { f ->
                            FilterChip(selected = franja == f, onClick = { franja = f }, label = { Text(ComidaDominio.nombreFranja(f), fontSize = 12.5.sp) })
                        }
                    }

                    BotonPrincipal(
                        texto = "Apuntar ahora",
                        grande = true,
                        onClick = {
                            val hora = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
                            alGuardarComida(
                                Comida(
                                    fecha = fechaIso,
                                    hora = hora,
                                    franja = franja,
                                    nombre = prod.nombre,
                                    kcal = valores.kcal,
                                    proteina = valores.proteina,
                                    cafeina = valores.cafeina,
                                    racion = if (modoGramos) "N" else racion,
                                    tipo = "producto",
                                    codigo = prod.codigo,
                                    hidratos = valores.hidratos,
                                    azucares = valores.azucares,
                                    grasas = valores.grasas,
                                    sal = valores.sal,
                                ),
                            )
                            alCerrar()
                        },
                    )
                    BotonSecundario(
                        texto = "Guardar en Mis comidas",
                        icono = Icons.Rounded.BookmarkAdd,
                        onClick = { alGuardarComoPlantilla(prod) },
                    )
                }
                else -> {
                    var nombre by remember { mutableStateOf("") }
                    var kcal100 by remember { mutableStateOf("") }
                    var prot100 by remember { mutableStateOf("") }
                    var racionG by remember { mutableStateOf("100") }

                    Text("Producto $codigo", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                    estadoBusqueda?.let { NotaAviso(it, tono = TonoNota.WARN) }
                    OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre del producto") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = prot100, onValueChange = { prot100 = it.filter { c -> c.isDigit() || c == '.' || c == ',' } }, label = { Text("Prot. / 100 g") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = kcal100, onValueChange = { kcal100 = it.filter(Char::isDigit) }, label = { Text("kcal / 100 g") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(value = racionG, onValueChange = { racionG = it.filter(Char::isDigit) }, label = { Text("Gramos por ración") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                    BotonPrincipal(
                        texto = "Guardar producto y continuar",
                        enabled = nombre.isNotBlank(),
                        onClick = {
                            val k100 = kcal100.toDoubleOrNull() ?: 0.0
                            val p100 = prot100.replace(',', '.').toDoubleOrNull() ?: 0.0
                            val rg = racionG.toDoubleOrNull()?.takeIf { it > 0 } ?: 100.0
                            val manual = Producto(
                                codigo = codigo,
                                nombre = nombre.trim(),
                                kcal100 = k100,
                                proteina100 = p100,
                                racionG = rg,
                                kcalRacion = ((k100 * rg) / 100.0).roundToInt().toDouble(),
                                proteinaRacion = ((p100 * rg) / 100.0 * 10.0).roundToInt() / 10.0,
                                guardado = java.time.Instant.now().toString(),
                                manual = true,
                            )
                            alGuardarProducto(manual)
                            producto = manual
                        },
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}
