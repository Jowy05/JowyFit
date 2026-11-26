package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.MonitorWeight
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.Bascula
import com.jowy05.jowyfit.datos.modelo.FotoProgreso
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.Perimetros
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.MetasDominio
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.dominio.TendenciasDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
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
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.roundToInt

/** Pestaña Progreso completa (Fase 4): Semana, Fuerza, Cuerpo, Metas y Fotos/Pasos + Health Connect. */
@Composable
fun PantallaProgresoCompleta(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    archivoMedia: (String) -> File,
    alAbrirFicha: (String) -> Unit,
    alGuardarMedicion: (Medicion) -> Unit,
    alGuardarMeta: (Meta) -> Unit,
    alBorrarMeta: (Long) -> Unit,
    alAvanceMeta: (Meta, Double, String?) -> Unit,
    alBorrarHitoMeta: (Meta, Int) -> Unit,
    alAbrirCamaraFoto: (String) -> Unit,
    alBorrarFoto: (FotoProgreso) -> Unit,
    alSumarPasos: (Int) -> Unit,
    alApuntarCardio: (String, Int) -> Unit,
    alSincronizarHC: () -> Unit,
) {
    val p = LocalPaleta.current
    val hoy = remember { LocalDate.now() }
    val hoyIso = hoy.toString()
    var subtab by remember { mutableStateOf("semana") }
    var hojaMedicion by remember { mutableStateOf(false) }
    var hojaNuevaMeta by remember { mutableStateOf(false) }
    var metaAvance by remember { mutableStateOf<Meta?>(null) }
    var sesionDetalle by remember { mutableStateOf<Sesion?>(null) }
    var hojaCardio by remember { mutableStateOf(false) }

    val hechas = remember(estado.sesiones) { estado.sesiones.filter { it.estado == "hecha" }.sortedByDescending { it.inicio } }

    Column(modifier = Modifier.fillMaxSize().background(p.bg)) {
        CabeceraPantalla(
            crumb = t("Progreso"),
            titulo = when (subtab) {
                "semana" -> "Semana"
                "fuerza" -> "Fuerza"
                "cuerpo" -> "Cuerpo"
                "metas" -> "Metas"
                else -> "Fotos y pasos"
            },
            sub = "${hechas.size} entrenos · ${estado.metas.size} metas · ${estado.retos.size} retos",
            extra = {
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(
                        "semana" to "Semana",
                        "fuerza" to "Fuerza",
                        "cuerpo" to "Cuerpo",
                        "metas" to "Metas",
                        "fotos" to "Fotos y pasos",
                    ).forEach { (k, lbl) ->
                        FilterChip(selected = subtab == k, onClick = { subtab = k }, label = { Text(lbl) })
                    }
                }
            },
        )

        val espacioInferior = if (estado.sesionEnCurso != null) 156.dp else 112.dp

        when (subtab) {
            "semana" -> {
                val lunes = CalculosDominio.lunesDe(hoy)
                val diasSem = (0L..6L).map { lunes.plusDays(it).toString() }.toSet()
                val sesSem = hechas.filter { it.fecha in diasSem }
                val volSem = sesSem.sumOf { s -> s.ejercicios.sumOf { e -> Progresion.volumen(e.series) } }.roundToInt()
                val recsSem = TendenciasDominio.recordsEn(estado.sesiones, diasSem)
                val grupos = remember(estado.sesiones, diasSem, catalogo) {
                    TendenciasDominio.seriesPorGrupo(estado.sesiones, diasSem) { id ->
                        catalogo?.porId?.get(id)?.let { PesosYDiscos.patron(it) }
                    }
                }
                val pasosSem = estado.pasos.filter { it.fecha in diasSem }.sumOf { it.pasos }

                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("ENTRENOS", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text("${sesSem.size}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                            Text("esta semana", color = p.muted, fontSize = 12.sp)
                        }
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("RÉCORDS", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text("$recsSem", color = p.gold, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                            Text("${volSem} kg vol.", color = p.muted, fontFamily = FuenteMono, fontSize = 12.sp)
                        }
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("PASOS", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text("${pasosSem / 1000}k", color = p.go, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                            Text("7 días", color = p.muted, fontSize = 12.sp)
                        }
                    }

                    Tarjeta {
                        Text("SERIES POR GRUPO MUSCULAR", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Spacer(Modifier.height(10.dp))
                        grupos.forEach { g ->
                            val col = when (g.nivel) {
                                "bien" -> p.ok
                                "mucho" -> p.warn
                                else -> p.blue
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(g.nombre, color = p.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                Text("${g.series} / ${g.min}-${g.max}", color = col, fontFamily = FuenteMono, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Spacer(Modifier.height(4.dp))
                            BarraProgreso(valor = g.series.toDouble(), total = g.max.toDouble(), color = col)
                            Spacer(Modifier.height(10.dp))
                        }
                    }

                    if (hechas.isNotEmpty()) {
                        SeccionTitulo(titulo = "Últimos entrenos")
                        ListaAgrupada {
                            hechas.take(8).forEachIndexed { idx, s ->
                                FilaLista(
                                    titulo = s.nombre.ifBlank { "Entreno ${s.letra}" },
                                    subtitulo = "${s.fecha} · ${s.ejercicios.count { it.estado == "hecho" }} ej.",
                                    icono = Icons.Rounded.FitnessCenter,
                                    alPulsar = { sesionDetalle = s },
                                )
                                if (idx < minOf(hechas.size, 8) - 1) SeparadorLista()
                            }
                        }
                    }

                    Spacer(Modifier.height(espacioInferior))
                }
            }

            "fuerza" -> {
                val recsMes = remember(estado.sesiones, hoyIso) { TendenciasDominio.recordsPorMes(estado.sesiones, hoyIso, 6) }
                val estancados = remember(estado.sesiones) { TendenciasDominio.ejerciciosEstancados(estado.sesiones) }
                val propuesta = remember(estado.sesiones, estado.rutinaActiva, hoyIso, catalogo) {
                    val ejsRut = estado.rutinaActiva?.dias?.flatMap { d -> d.bloques.map { it.ejercicio } }.orEmpty()
                    TendenciasDominio.propuestaDescarga(hoyIso, estado.sesiones, ejsRut, { catalogo?.nombreEjercicio(it) ?: it })
                }
                val hechosIds = remember(estado.sesiones) { TendenciasDominio.ejerciciosHechos(estado.sesiones) }
                var ejSel by remember(hechosIds) { mutableStateOf(hechosIds.firstOrNull()) }
                var metrica by remember { mutableStateOf("e1rm") }
                val puntos = remember(estado.sesiones, ejSel, metrica) {
                    if (ejSel == null) emptyList() else TendenciasDominio.evolucion(estado.sesiones, ejSel!!, metrica)
                }
                val logros = remember(estado.sesiones) { TendenciasDominio.logros(estado.sesiones).take(8) }

                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    propuesta?.let { pr ->
                        NotaAviso(texto = pr.motivo, tono = TonoNota.WARN, icono = Icons.Rounded.Warning)
                    }

                    // Gráfica de barras: récords por mes (6 meses)
                    Tarjeta {
                        Text("RÉCORDS POR MES (ÚLTIMOS 6 MESES)", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Spacer(Modifier.height(10.dp))
                        GraficaBarrasMes(datos = recsMes)
                    }

                    // Alertas de estancamiento
                    if (estancados.isNotEmpty()) {
                        Tarjeta {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Rounded.Warning, contentDescription = null, tint = p.warn)
                                Text("Ejercicios estancados (3+ sesiones)", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            }
                            Spacer(Modifier.height(8.dp))
                            estancados.forEachIndexed { i, est ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().clickable { alAbrirFicha(est.ejercicio) }.padding(vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(catalogo?.nombreEjercicio(est.ejercicio) ?: est.ejercicio, color = p.ink, modifier = Modifier.weight(1f))
                                    Text("${est.peso} kg", color = p.warn, fontFamily = FuenteMono, fontWeight = FontWeight.Bold)
                                }
                                if (i < estancados.lastIndex) SeparadorLista()
                            }
                        }
                    }

                    // Evolución por ejercicio
                    if (hechosIds.isNotEmpty()) {
                        Tarjeta {
                            Text("EVOLUCIÓN POR EJERCICIO", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            Spacer(Modifier.height(8.dp))
                            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                hechosIds.take(10).forEach { id ->
                                    FilterChip(
                                        selected = ejSel == id,
                                        onClick = { ejSel = id },
                                        label = { Text(catalogo?.nombreEjercicio(id) ?: id, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                    )
                                }
                            }
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                listOf("e1rm" to "1RM est.", "peso" to "Peso máx.", "volumen" to "Volumen").forEach { (k, lbl) ->
                                    FilterChip(selected = metrica == k, onClick = { metrica = k }, label = { Text(lbl, fontSize = 12.5.sp) })
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            if (puntos.size >= 2) {
                                GraficaLineaSimple(valores = puntos.map { it.valor }, color = p.go, altura = 110.dp)
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(puntos.first().fecha, color = p.muted, fontFamily = FuenteMono, fontSize = 11.5.sp)
                                    Text("Último: ${puntos.last().valor}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                                    Text(puntos.last().fecha, color = p.muted, fontFamily = FuenteMono, fontSize = 11.5.sp)
                                }
                            } else {
                                Text("Haz al menos 2 sesiones de este ejercicio para ver la gráfica.", color = p.muted, fontSize = 13.5.sp)
                            }
                        }
                    }

                    if (logros.isNotEmpty()) {
                        SeccionTitulo(titulo = "Últimos récords")
                        ListaAgrupada {
                            logros.forEachIndexed { idx, l ->
                                FilaLista(
                                    titulo = catalogo?.nombreEjercicio(l.ejercicio) ?: l.ejercicio,
                                    subtitulo = "${l.fecha} · ${l.peso} kg × ${l.reps}",
                                    icono = Icons.Rounded.EmojiEvents,
                                    alPulsar = { alAbrirFicha(l.ejercicio) },
                                )
                                if (idx < logros.lastIndex) SeparadorLista()
                            }
                        }
                    }

                    Spacer(Modifier.height(espacioInferior))
                }
            }

            "cuerpo" -> {
                val tend = remember(estado.mediciones, hoyIso) { TendenciasDominio.tendenciaPeso(estado.mediciones, hoyIso) }
                val grasa = remember(estado.mediciones, estado.perfil, hoyIso) { TendenciasDominio.grasaActual(estado.mediciones, estado.perfil, hoyIso) }
                val cintura = remember(estado.mediciones) { TendenciasDominio.ultimoValor(estado.mediciones, { it.perimetros?.cintura }) }
                val imc = estado.ultimoPeso?.let { CalculosDominio.imc(it, estado.perfil.alturaCm) }

                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BotonPrincipal(texto = "+ Medida", icono = Icons.Rounded.Add, onClick = { hojaMedicion = true }, modifier = Modifier.weight(1f))
                        BotonSecundario(texto = "Health Connect", icono = Icons.Rounded.Sync, onClick = alSincronizarHC, modifier = Modifier.weight(1f))
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("PESO ACTUAL", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text(
                                text = estado.ultimoPeso?.let { "${String.format("%.1f", it).replace('.', ',')} kg" } ?: "—",
                                color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 23.sp,
                            )
                            Text(
                                text = tend.kgSemana?.let { "${if (it > 0) "+" else ""}${String.format("%.1f", it).replace('.', ',')} kg/sem" } ?: "Sin tendencia aún",
                                color = p.muted, fontSize = 12.5.sp,
                            )
                        }
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("% GRASA", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text(
                                text = grasa?.let { "${String.format("%.1f", it.valor).replace('.', ',')} %" } ?: "—",
                                color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 23.sp,
                            )
                            Text(
                                text = when (grasa?.fuente) {
                                    "bascula" -> "Báscula"
                                    "medidas" -> "Cinta (Marina)"
                                    else -> "Falta cintura/cuello"
                                },
                                color = p.muted, fontSize = 12.5.sp,
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("CINTURA", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text(cintura?.let { "${String.format("%.1f", it.valor).replace('.', ',')} cm" } ?: "—", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                        }
                        Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                            Text("IMC", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                            Text(imc?.let { String.format("%.1f", it).replace('.', ',') } ?: "—", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                        }
                    }

                    if (tend.puntos.size >= 2) {
                        Tarjeta {
                            Text("PESO · ÚLTIMOS 30 DÍAS", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            Spacer(Modifier.height(8.dp))
                            GraficaLineaSimple(valores = tend.puntos, color = p.blue, altura = 96.dp)
                        }
                    }

                    Spacer(Modifier.height(espacioInferior))
                }
            }

            "metas" -> {
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    BotonPrincipal(texto = "+ Nueva meta", icono = Icons.Rounded.Add, onClick = { hojaNuevaMeta = true })

                    if (estado.metas.isEmpty()) {
                        NotaAviso("Crea una meta de peso, cintura, dominadas, ejercicio o libre y sigue tu avance con histórico y notas.", tono = TonoNota.INFO, icono = Icons.Rounded.Flag)
                    } else {
                        estado.metas.forEach { m ->
                            val actual = MetasDominio.valorActual(m, estado.mediciones, estado.sesiones, estado.perfil, hoyIso) { catalogo?.nombreEjercicio(it) ?: it }
                            val st = MetasDominio.estado(m, actual)
                            Tarjeta {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(m.titulo, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                                        Text(
                                            text = "Actual: ${actual?.toString() ?: "—"} · Objetivo: ${m.objetivo} ${m.unidad}".trim(),
                                            color = p.muted, fontFamily = FuenteMono, fontSize = 12.5.sp,
                                        )
                                    }
                                    if (st.conseguida) {
                                        Icon(Icons.Rounded.CheckCircle, contentDescription = "Conseguida", tint = p.ok)
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                BarraProgreso(valor = st.progreso * 100.0, total = 100.0, color = if (st.conseguida) p.ok else p.go, gruesa = true)
                                val hist = m.historial.orEmpty()
                                if (hist.size >= 2) {
                                    Spacer(Modifier.height(8.dp))
                                    GraficaLineaSimple(valores = hist.map { it.valor }, color = p.blue, altura = 56.dp)
                                }
                                hist.lastOrNull { !it.nota.isNullOrBlank() }?.let { h ->
                                    Spacer(Modifier.height(4.dp))
                                    Text("Última nota: ${h.nota}", color = p.muted, fontSize = 12.5.sp)
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (m.tipo in setOf("dominadas", "reps", "ejercicio", "libre")) {
                                        FilterChip(
                                            selected = false,
                                            onClick = { alAvanceMeta(m, (actual ?: 0.0) + 1.0, null) },
                                            label = { Text("+1") },
                                        )
                                        FilterChip(
                                            selected = false,
                                            onClick = { metaAvance = m },
                                            label = { Text("Apuntar avance") },
                                        )
                                    }
                                    m.id?.let { id ->
                                        IconButton(onClick = { alBorrarMeta(id) }, modifier = Modifier.size(34.dp)) {
                                            Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = p.muted, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(espacioInferior))
                }
            }

            else -> {
                val pasosHoy = estado.pasos.firstOrNull { it.fecha == hoyIso }
                var poseFiltro by remember { mutableStateOf("frente") }
                val fotosPose = remember(estado.fotos, poseFiltro) {
                    estado.fotos.filter { it.pose == poseFiltro }.sortedByDescending { it.fecha }
                }

                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Pasos + Cardio + Health Connect
                    Tarjeta {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("PASOS DE HOY", color = p.muted, fontFamily = FuenteTitulo, fontSize = 12.sp)
                                Text("${pasosHoy?.pasos ?: 0} / ${estado.perfil.pasosObjetivo}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 23.sp)
                            }
                            Icon(Icons.AutoMirrored.Rounded.DirectionsWalk, contentDescription = null, tint = p.go, modifier = Modifier.size(30.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                        BarraProgreso(valor = (pasosHoy?.pasos ?: 0).toDouble(), total = estado.perfil.pasosObjetivo.toDouble(), color = p.go, gruesa = true)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = false, onClick = { alSumarPasos((pasosHoy?.pasos ?: 0) + 1000) }, label = { Text("+1.000") })
                            FilterChip(selected = false, onClick = { hojaCardio = true }, label = { Text("+ Cardio") })
                            FilterChip(selected = false, onClick = alSincronizarHC, label = { Text("Sync HC") }, leadingIcon = { Icon(Icons.Rounded.Sync, null, Modifier.size(16.dp)) })
                        }
                        val cardios = pasosHoy?.cardio.orEmpty()
                        if (cardios.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            Text("Cardio hoy: ${cardios.joinToString(", ") { "${it.tipo} ${it.min} min" }}", color = p.muted, fontSize = 13.sp)
                        }
                    }

                    // Fotos de progreso locales con CameraX
                    SeccionTitulo(titulo = "Fotos de progreso (100 % privadas)")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("frente" to "Frente", "perfil" to "Perfil", "espalda" to "Espalda").forEach { (k, lbl) ->
                            FilterChip(selected = poseFiltro == k, onClick = { poseFiltro = k }, label = { Text(lbl) })
                        }
                    }
                    BotonPrincipal(texto = "Hacer foto de $poseFiltro", icono = Icons.Rounded.CameraAlt, onClick = { alAbrirCamaraFoto(poseFiltro) })

                    if (fotosPose.isEmpty()) {
                        NotaAviso("Todavía no tienes fotos en pose «$poseFiltro». Se guardan solo en tu móvil y entran en tu copia .jowyfit.", tono = TonoNota.INFO)
                    } else {
                        fotosPose.forEach { f ->
                            val archivo = f.imagen?.archivo?.let(archivoMedia)
                            Tarjeta(padding = PaddingValues(10.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text("${f.fecha} · ${f.pose}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.SemiBold)
                                    IconButton(onClick = { alBorrarFoto(f) }) { Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = p.muted) }
                                }
                                if (archivo != null && archivo.exists()) {
                                    AsyncImage(
                                        model = archivo,
                                        contentDescription = "Foto ${f.fecha}",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxWidth().height(260.dp).clip(RoundedCornerShape(10.dp)),
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(espacioInferior))
                }
            }
        }
    }

    if (hojaMedicion) {
        HojaMedicionCompleta(
            alCerrar = { hojaMedicion = false },
            alGuardar = { m ->
                alGuardarMedicion(m)
                hojaMedicion = false
            },
        )
    }
    if (hojaNuevaMeta) {
        HojaNuevaMeta(
            alCerrar = { hojaNuevaMeta = false },
            alGuardar = { m ->
                alGuardarMeta(m)
                hojaNuevaMeta = false
            },
        )
    }
    metaAvance?.let { m ->
        HojaAvanceMeta(
            meta = m,
            alCerrar = { metaAvance = null },
            alGuardar = { v, nota ->
                alAvanceMeta(m, v, nota)
                metaAvance = null
            },
            alBorrarHito = { idx ->
                alBorrarHitoMeta(m, idx)
                metaAvance = null
            },
        )
    }
    sesionDetalle?.let { s ->
        HojaDetalleSesion(sesion = s, catalogo = catalogo, alCerrar = { sesionDetalle = null })
    }
    if (hojaCardio) {
        HojaCardio(
            alCerrar = { hojaCardio = false },
            alGuardar = { tipo, min ->
                alApuntarCardio(tipo, min)
                hojaCardio = false
            },
        )
    }
}

@Composable
private fun GraficaBarrasMes(datos: List<TendenciasDominio.RecordsMes>) {
    val p = LocalPaleta.current
    val maxV = max(1, datos.maxOfOrNull { it.total } ?: 1)
    Row(
        modifier = Modifier.fillMaxWidth().height(110.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        datos.forEach { d ->
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${d.total}", color = if (d.enCurso) p.go else p.muted, fontFamily = FuenteMono, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                val frac = (d.total.toFloat() / maxV.toFloat()).coerceIn(0.08f, 1f)
                Canvas(modifier = Modifier.width(22.dp).height(64.dp)) {
                    val h = size.height * frac
                    drawRoundRect(
                        color = if (d.enCurso) p.go else p.blue.copy(alpha = 0.7f),
                        topLeft = Offset(0f, size.height - h),
                        size = Size(size.width, h),
                        cornerRadius = CornerRadius(6.dp.toPx(), 6.dp.toPx()),
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(d.etiqueta, color = p.muted, fontSize = 11.5.sp)
            }
        }
    }
}

@Composable
private fun GraficaLineaSimple(valores: List<Double>, color: Color, altura: androidx.compose.ui.unit.Dp) {
    val p = LocalPaleta.current
    val minV = valores.minOrNull() ?: 0.0
    val maxV = valores.maxOrNull() ?: 1.0
    val rango = max(0.01, maxV - minV)

    Canvas(modifier = Modifier.fillMaxWidth().height(altura)) {
        val pad = 8.dp.toPx()
        val w = size.width - pad * 2
        val h = size.height - pad * 2
        val path = Path()
        valores.forEachIndexed { idx, v ->
            val x = pad + (if (valores.size == 1) w / 2f else w * idx / (valores.size - 1).toFloat())
            val y = pad + h * (1f - ((v - minV) / rango).toFloat())
            if (idx == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path = path, color = color, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
        valores.forEachIndexed { idx, v ->
            val x = pad + (if (valores.size == 1) w / 2f else w * idx / (valores.size - 1).toFloat())
            val y = pad + h * (1f - ((v - minV) / rango).toFloat())
            drawCircle(color = p.surface, radius = 5.dp.toPx(), center = Offset(x, y))
            drawCircle(color = color, radius = 3.5.dp.toPx(), center = Offset(x, y))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaMedicionCompleta(alCerrar: () -> Unit, alGuardar: (Medicion) -> Unit) {
    val p = LocalPaleta.current
    var peso by remember { mutableStateOf("") }
    var cintura by remember { mutableStateOf("") }
    var cuello by remember { mutableStateOf("") }
    var cadera by remember { mutableStateOf("") }
    var grasa by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Registrar medidas", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = peso, onValueChange = { peso = it }, label = { Text("Peso (kg)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = grasa, onValueChange = { grasa = it }, label = { Text("% Grasa") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = cintura, onValueChange = { cintura = it }, label = { Text("Cintura (cm)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = cuello, onValueChange = { cuello = it }, label = { Text("Cuello (cm)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = cadera, onValueChange = { cadera = it }, label = { Text("Cadera (cm)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
            }
            val pNum = peso.replace(',', '.').toDoubleOrNull()
            val cNum = cintura.replace(',', '.').toDoubleOrNull()
            val cuNum = cuello.replace(',', '.').toDoubleOrNull()
            val caNum = cadera.replace(',', '.').toDoubleOrNull()
            val gNum = grasa.replace(',', '.').toDoubleOrNull()
            BotonPrincipal(
                texto = "Guardar medidas",
                enabled = pNum != null || cNum != null || cuNum != null || caNum != null || gNum != null,
                onClick = {
                    val ahora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"))
                    alGuardar(
                        Medicion(
                            fecha = ahora,
                            origen = "manual",
                            pesoKg = pNum,
                            perimetros = if (cNum != null || cuNum != null || caNum != null) Perimetros(cintura = cNum, cuello = cuNum, cadera = caNum) else null,
                            bascula = gNum?.let { Bascula(grasaPct = it) },
                        ),
                    )
                },
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaNuevaMeta(alCerrar: () -> Unit, alGuardar: (Meta) -> Unit) {
    val p = LocalPaleta.current
    var tipo by remember { mutableStateOf("libre") }
    var titulo by remember { mutableStateOf("") }
    var objetivo by remember { mutableStateOf("") }
    var unidad by remember { mutableStateOf("reps") }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Nueva meta", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("dominadas" to "Dominadas", "peso" to "Peso", "cintura" to "Cintura", "grasa" to "% Grasa", "libre" to "Libre").forEach { (k, lbl) ->
                    FilterChip(
                        selected = tipo == k,
                        onClick = {
                            tipo = k
                            unidad = when (k) {
                                "peso" -> "kg"
                                "cintura" -> "cm"
                                "grasa" -> "%"
                                "dominadas" -> "reps"
                                else -> ""
                            }
                            if (titulo.isBlank() && k == "dominadas") titulo = "Hacer dominadas estrictas"
                        },
                        label = { Text(lbl) },
                    )
                }
            }
            OutlinedTextField(value = titulo, onValueChange = { titulo = it }, label = { Text("Título de la meta") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = objetivo, onValueChange = { objetivo = it }, label = { Text("Objetivo") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = unidad, onValueChange = { unidad = it }, label = { Text("Unidad") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            val obj = objetivo.replace(',', '.').toDoubleOrNull()
            BotonPrincipal(
                texto = "Crear meta",
                enabled = titulo.isNotBlank() && obj != null && obj > 0.0,
                onClick = { alGuardar(Meta(tipo = tipo, titulo = titulo.trim(), objetivo = obj!!, unidad = unidad.trim())) },
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaAvanceMeta(
    meta: Meta,
    alCerrar: () -> Unit,
    alGuardar: (Double, String?) -> Unit,
    alBorrarHito: (Int) -> Unit,
) {
    val p = LocalPaleta.current
    var valor by remember(meta) { mutableStateOf((meta.actual ?: 0.0).toString()) }
    var nota by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Avance · ${meta.titulo}", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            OutlinedTextField(value = valor, onValueChange = { valor = it }, label = { Text("Valor actual (${meta.unidad})") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = nota, onValueChange = { nota = it }, label = { Text("Nota opcional") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            val num = valor.replace(',', '.').toDoubleOrNull()
            BotonPrincipal(texto = "Guardar avance", enabled = num != null && num >= 0.0, onClick = { alGuardar(num!!, nota) })

            val hist = meta.historial.orEmpty()
            if (hist.isNotEmpty()) {
                SeccionTitulo(titulo = "Histórico")
                ListaAgrupada {
                    hist.reversed().forEachIndexed { revIdx, h ->
                        val origIdx = hist.lastIndex - revIdx
                        FilaLista(
                            titulo = "${h.valor} ${meta.unidad}".trim(),
                            subtitulo = listOfNotNull(h.fecha, h.nota).joinToString(" · "),
                            final = {
                                IconButton(onClick = { alBorrarHito(origIdx) }) {
                                    Icon(Icons.Rounded.Delete, contentDescription = "Borrar hito", tint = p.muted, modifier = Modifier.size(18.dp))
                                }
                            },
                        )
                        if (revIdx < hist.lastIndex) SeparadorLista()
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaDetalleSesion(sesion: Sesion, catalogo: CatalogoCargado?, alCerrar: () -> Unit) {
    val p = LocalPaleta.current
    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(sesion.nombre.ifBlank { "Entreno ${sesion.letra}" }, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            Text("${sesion.fecha} · ${sesion.ejercicios.size} ejercicios", color = p.muted, fontSize = 13.5.sp)
            sesion.ejercicios.forEach { e ->
                Tarjeta(padding = PaddingValues(12.dp)) {
                    Text(catalogo?.nombreEjercicio(e.ejercicio) ?: e.ejercicio, color = p.ink, fontWeight = FontWeight.SemiBold, fontSize = 15.5.sp)
                    Spacer(Modifier.height(4.dp))
                    e.series.filter { it.hecha }.forEach { s ->
                        val kgTxt = s.peso?.let { "$it kg × " } ?: ""
                        val repTxt = if (e.registro == "tiempo") "${s.segundos ?: 0} s" else "${s.reps ?: 0} reps"
                        Text(
                            text = "${if (s.calentamiento) "CAL" else "S${s.n}"}: $kgTxt$repTxt" + (if (s.record == true) " 🏆" else ""),
                            color = p.muted, fontFamily = FuenteMono, fontSize = 13.sp,
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaCardio(alCerrar: () -> Unit, alGuardar: (String, Int) -> Unit) {
    val p = LocalPaleta.current
    var tipo by remember { mutableStateOf("Caminar rápido") }
    var minutos by remember { mutableStateOf("30") }
    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Añadir cardio", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Caminar rápido", "Correr", "Bici", "Elíptica", "Nadar").forEach { t ->
                    FilterChip(selected = tipo == t, onClick = { tipo = t }, label = { Text(t) })
                }
            }
            OutlinedTextField(value = minutos, onValueChange = { minutos = it.filter(Char::isDigit).take(3) }, label = { Text("Minutos") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
            val m = minutos.toIntOrNull()
            BotonPrincipal(texto = "Guardar cardio", enabled = m != null && m > 0, onClick = { alGuardar(tipo, m!!) })
            Spacer(Modifier.height(10.dp))
        }
    }
}
