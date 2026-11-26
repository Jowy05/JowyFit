package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.PlantillaEntreno
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.MiniaturaEjercicio
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta

@Composable
fun PantallaRutina(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    alAbrirFicha: (String) -> Unit,
    alAbrirGimnasios: () -> Unit,
    alGenerarVariante: () -> Unit,
    alEmpezarDia: (DiaRutina) -> Unit,
    alEmpezarLibre: () -> Unit,
    alEmpezarPlantilla: (PlantillaEntreno) -> Unit,
    alBorrarPlantilla: (String) -> Unit,
    alAnadirBloque: (String, String) -> Unit,
    alQuitarBloque: (String, String) -> Unit,
    alCambiarSeries: (String, String, Int) -> Unit,
    alIniciarReto: (RetosDominio.DefinicionReto) -> Unit,
    alBorrarIntentoReto: (Long) -> Unit,
) {
    val p = LocalPaleta.current
    var subtab by remember { mutableStateOf("plan") }
    var busqueda by remember { mutableStateOf("") }
    var diaEditando by remember { mutableStateOf<String?>(null) }
    var anadirADia by remember { mutableStateOf<String?>(null) }
    var verPorque by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg),
    ) {
        CabeceraPantalla(
            crumb = t("Rutina"),
            titulo = when (subtab) {
                "plan" -> "Mi plan"
                "retos" -> "Retos 3D"
                else -> "Ejercicios"
            },
            sub = estado.rutinaActiva?.estructura?.ifBlank { null },
            extra = {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = subtab == "plan", onClick = { subtab = "plan" }, label = { Text("Mi plan") })
                    FilterChip(selected = subtab == "retos", onClick = { subtab = "retos" }, label = { Text("Retos") })
                    FilterChip(
                        selected = subtab == "ejercicios",
                        onClick = { subtab = "ejercicios" },
                        label = { Text("Ejercicios (${catalogo?.ejercicios?.size ?: 0})") },
                    )
                }
            },
        )

        if (subtab == "retos") {
            ContenidoRetosEnRutina(
                estado = estado,
                alIniciarReto = alIniciarReto,
                alBorrarIntento = alBorrarIntentoReto,
            )
        } else if (subtab == "plan") {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val rutina = estado.rutinaActiva
                if (rutina == null) {
                    Spacer(Modifier.height(4.dp))
                    NotaAviso(
                        texto = "Aún no tienes rutina activa. Puedes generarla automáticamente según tu perfil y material o importar tu .jowyfit en Ajustes.",
                        tono = TonoNota.INFO,
                        icono = Icons.Rounded.FitnessCenter,
                    )
                    BotonPrincipal(
                        texto = "Crear mi rutina",
                        icono = Icons.Rounded.AutoAwesome,
                        grande = true,
                        onClick = alGenerarVariante,
                    )
                } else {
                    if (rutina.porque.isNotEmpty()) {
                        Tarjeta(onClick = { verPorque = !verPorque }, padding = PaddingValues(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    text = "¿Por qué esta rutina?",
                                    color = p.ink,
                                    fontFamily = FuenteTitulo,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                )
                                Icon(
                                    imageVector = if (verPorque) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
                                    contentDescription = null,
                                    tint = p.muted,
                                )
                            }
                            if (verPorque) {
                                Spacer(Modifier.height(6.dp))
                                rutina.porque.forEach { linea ->
                                    Text("• $linea", color = p.muted, fontSize = 13.5.sp, modifier = Modifier.padding(vertical = 2.dp))
                                }
                            }
                        }
                    }

                    rutina.dias.forEach { dia ->
                        val editando = diaEditando == dia.letra
                        val durMin = CalculosDominio.duracionMinDia(dia.bloques)
                        Tarjeta {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(dia.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                                    Text("~$durMin min · ${dia.bloques.size} ejercicios", color = p.muted, fontSize = 13.sp)
                                }
                                EtiquetaTag(if (dia.opcional) "Opcional" else "Día ${dia.letra}", colorFondo = p.blueT, colorTexto = p.blue)
                            }
                            Spacer(Modifier.height(8.dp))
                            dia.bloques.forEachIndexed { i, b ->
                                val ej = catalogo?.porId?.get(b.ejercicio)
                                val marca = estado.marcas[b.ejercicio]
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { alAbrirFicha(b.ejercicio) }
                                        .padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    MiniaturaEjercicio(urlAsset = ej?.let { catalogo.miniaturaAsset(it) }, tamano = 38.dp)
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = ej?.nombre ?: b.ejercicio,
                                            color = p.ink,
                                            fontSize = 14.5.sp,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        if (b.superserie != null || marca?.favorito == true || marca?.duele == true || marca?.odiado == true) {
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                                if (b.superserie != null) {
                                                    Text("Dos seguidos", color = p.go, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                                                }
                                                if (marca?.favorito == true) {
                                                    Icon(Icons.Rounded.Star, contentDescription = "Favorito", tint = p.gold, modifier = Modifier.size(14.dp))
                                                }
                                                if (marca?.duele == true) {
                                                    Icon(Icons.Rounded.Warning, contentDescription = "Duele", tint = p.warn, modifier = Modifier.size(14.dp))
                                                }
                                                if (marca?.odiado == true) {
                                                    Icon(Icons.Rounded.Block, contentDescription = "Evitar", tint = p.bad, modifier = Modifier.size(14.dp))
                                                }
                                            }
                                        }
                                    }
                                    if (editando) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = { alCambiarSeries(dia.letra, b.uid, -1) },
                                                modifier = Modifier.size(32.dp),
                                            ) {
                                                Icon(Icons.Rounded.Remove, contentDescription = "Menos series", tint = p.blue, modifier = Modifier.size(18.dp))
                                            }
                                            Text("${b.series}s", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            IconButton(
                                                onClick = { alCambiarSeries(dia.letra, b.uid, 1) },
                                                modifier = Modifier.size(32.dp),
                                            ) {
                                                Icon(Icons.Rounded.Add, contentDescription = "Más series", tint = p.blue, modifier = Modifier.size(18.dp))
                                            }
                                            IconButton(
                                                onClick = { alQuitarBloque(dia.letra, b.uid) },
                                                modifier = Modifier.size(32.dp),
                                            ) {
                                                Icon(Icons.Rounded.Delete, contentDescription = "Quitar", tint = p.bad, modifier = Modifier.size(18.dp))
                                            }
                                        }
                                    } else {
                                        Text("${b.series}×${b.repsMin}-${b.repsMax}", color = p.muted, fontFamily = FuenteMono, fontSize = 12.5.sp)
                                    }
                                }
                                if (i < dia.bloques.lastIndex) SeparadorLista()
                            }
                            Spacer(Modifier.height(10.dp))
                            if (editando) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    BotonSecundario(
                                        texto = "+ Ejercicio",
                                        icono = Icons.Rounded.Add,
                                        onClick = { anadirADia = dia.letra },
                                        modifier = Modifier.weight(1f),
                                    )
                                    BotonPrincipal(
                                        texto = "Listo",
                                        onClick = { diaEditando = null },
                                        modifier = Modifier.weight(0.8f),
                                    )
                                }
                            } else {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    BotonPrincipal(
                                        texto = "Empezar",
                                        icono = Icons.Rounded.PlayArrow,
                                        onClick = { alEmpezarDia(dia) },
                                        modifier = Modifier.weight(1f),
                                    )
                                    BotonSecundario(
                                        texto = "Editar",
                                        icono = Icons.Rounded.Edit,
                                        onClick = { diaEditando = dia.letra },
                                        modifier = Modifier.weight(0.65f),
                                    )
                                }
                            }
                        }
                    }
                }

                BloqueGeneradorYLibres(
                    estado = estado,
                    alGenerarVariante = alGenerarVariante,
                    alAbrirGimnasios = alAbrirGimnasios,
                    alEmpezarLibre = alEmpezarLibre,
                    alEmpezarPlantilla = alEmpezarPlantilla,
                    alBorrarPlantilla = alBorrarPlantilla,
                )

                Spacer(Modifier.height(if (estado.sesionEnCurso != null) 156.dp else 112.dp))
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
                    contentPadding = PaddingValues(bottom = if (estado.sesionEnCurso != null) 156.dp else 112.dp),
                ) {
                    items(lista, key = { it.id }) { ej ->
                        val marca = estado.marcas[ej.id]
                        Tarjeta(onClick = { alAbrirFicha(ej.id) }, padding = PaddingValues(10.dp)) {
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
                                if (marca?.favorito == true) {
                                    Icon(Icons.Rounded.Star, contentDescription = "Favorito", tint = p.gold, modifier = Modifier.size(18.dp))
                                } else if (marca?.duele == true) {
                                    Icon(Icons.Rounded.Warning, contentDescription = "Me duele", tint = p.warn, modifier = Modifier.size(18.dp))
                                } else if (marca?.odiado == true) {
                                    Icon(Icons.Rounded.Block, contentDescription = "Evitar", tint = p.bad, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (anadirADia != null && catalogo != null) {
        val letra = anadirADia!!
        HojaBuscadorEjercicio(
            catalogo = catalogo,
            titulo = "Añadir al día $letra",
            alCerrar = { anadirADia = null },
            alElegir = { id ->
                alAnadirBloque(letra, id)
                anadirADia = null
            },
        )
    }
}
