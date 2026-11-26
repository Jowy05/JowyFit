package com.jowy05.jowyfit.ui.pantallas

import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.FormatListNumbered
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.EjercicioSesion
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import com.jowy05.jowyfit.dominio.MotorSesion
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.ui.componentes.BarraProgreso
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.EtiquetaTag
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.MiniaturaEjercicio
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.componentes.iconoBarbell
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import kotlinx.coroutines.delay
import kotlin.math.max

/** Pantalla completa de Entreno en vivo 1:1 con Entreno.tsx + Panel.tsx (panel fijo abajo). */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PantallaEntrenoEnVivo(
    sesion: Sesion,
    gimnasio: Gimnasio?,
    catalogo: CatalogoCargado?,
    ajustesMaquina: (String) -> String?,
    sugerenciaPara: (EjercicioSesion) -> Progresion.Sugerencia,
    alMinimizar: () -> Unit,
    alApuntarSerie: (Int, MotorSesion.DatosSerie) -> Unit,
    alEditarSerieHecha: (Int, Int, Double?, Int?, Int?) -> Unit,
    alAjustarDescanso: (Int?) -> Unit,
    alAnadirSerie: (Int) -> Unit,
    alQuitarSerie: (Int) -> Unit,
    alCalentar: (Int) -> Unit,
    alSustituir: (Int, String) -> Unit,
    alSaltarEjercicio: (Int) -> Unit,
    alIrAEjercicio: (Int) -> Unit,
    alAnadirEjercicio: (String) -> Unit,
    alAbrirFicha: (String) -> Unit,
    alFinalizar: () -> Unit,
    alDescartar: () -> Unit,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val idx = MotorSesion.indiceActual(sesion)
    val ejActual = sesion.ejercicios.getOrNull(idx)
    val ejCat = ejActual?.let { catalogo?.porId?.get(it.ejercicio) }

    var ahoraMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            ahoraMs = System.currentTimeMillis()
            delay(500L)
        }
    }

    val segTranscurridos = ((ahoraMs - sesion.inicio) / 1000L).toInt().coerceAtLeast(0)
    val descRestanteSeg = sesion.descansoHasta?.let { ((it - ahoraMs) / 1000L).toInt() }?.takeIf { it > 0 } ?: 0

    var hojaLista by remember { mutableStateOf(false) }
    var hojaOcupado by remember { mutableStateOf(false) }
    var hojaDiscos by remember { mutableStateOf(false) }
    var hojaInstrucciones by remember { mutableStateOf(false) }
    var hojaAnadirEj by remember { mutableStateOf(false) }
    var dialogoSalir by remember { mutableStateOf(false) }
    var serieEditando by remember { mutableStateOf<Pair<Int, Serie>?>(null) }

    val serieIdx = ejActual?.let { MotorSesion.serieActual(it) } ?: -1
    val serieActual = if (ejActual != null && serieIdx >= 0) ejActual.series.getOrNull(serieIdx) else null
    val listaPesos = remember(ejCat, ejActual?.registro, gimnasio) {
        if (ejActual == null) emptyList() else PesosYDiscos.pesosPara(ejCat?.material, ejActual.registro, gimnasio)
    }

    val claveSerie = listOf(
        ejActual?.uid,
        ejActual?.ejercicio,
        serieIdx,
        serieActual?.calentamiento,
        serieActual?.peso,
        serieActual?.reps,
        serieActual?.segundos,
    )
    var pesoCampo by remember(claveSerie) {
        mutableDoubleStateOf(serieActual?.peso ?: listaPesos.firstOrNull { it > 0 } ?: 20.0)
    }
    var repsCampo by remember(claveSerie) {
        mutableIntStateOf(
            if (ejActual?.registro == "tiempo") serieActual?.segundos ?: ejActual.repsMin
            else serieActual?.reps ?: ejActual?.repsMin ?: 10,
        )
    }
    var rpeCampo by remember(claveSerie) { mutableStateOf<Double?>(null) }

    // Temporizador integrado para ejercicios por tiempo o cardio (Cronómetro / Cuenta atrás).
    var modoCuentaAtras by remember(ejActual?.uid, ejActual?.ejercicio) { mutableStateOf(true) }
    var cronoActivo by remember(claveSerie) { mutableStateOf(false) }
    var cronoSeg by remember(claveSerie) {
        mutableIntStateOf(if (ejActual?.registro == "tiempo") repsCampo else 0)
    }
    LaunchedEffect(cronoActivo, modoCuentaAtras) {
        if (!cronoActivo) return@LaunchedEffect
        while (cronoActivo) {
            delay(1000L)
            if (modoCuentaAtras) {
                cronoSeg = (cronoSeg - 1).coerceAtLeast(0)
                if (cronoSeg == 0) {
                    cronoActivo = false
                    runCatching {
                        val vib = context.getSystemService(Vibrator::class.java)
                        vib?.vibrate(VibrationEffect.createOneShot(250, VibrationEffect.DEFAULT_AMPLITUDE))
                    }
                }
            } else {
                cronoSeg += 1
                repsCampo = cronoSeg
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg),
    ) {
        // Cabecera superior fija
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(0f to p.hdTop, 0.7f to p.hdMid, 1f to p.bg))
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = alMinimizar) {
                    Icon(Icons.Rounded.ExpandMore, contentDescription = "Minimizar", tint = p.ink)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(sesion.nombre, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 20.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        text = "${formatoMmSs(segTranscurridos)} · ${sesion.ejercicios.count { it.estado == "hecho" }}/${sesion.ejercicios.size} ejercicios",
                        color = p.muted,
                        fontFamily = FuenteMono,
                        fontSize = 12.5.sp,
                    )
                }
                IconButton(onClick = { hojaLista = true }) {
                    Icon(Icons.Rounded.FormatListNumbered, contentDescription = "Lista", tint = p.ink)
                }
                TextButton(onClick = { dialogoSalir = true }) {
                    Text("Acabar", color = p.go, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }

        // Zona scrollable del ejercicio actual
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (ejActual == null) {
                Spacer(Modifier.height(16.dp))
                Tarjeta {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = p.ok, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = if (sesion.ejercicios.isEmpty()) "Entreno libre vacío" else "¡Todos los ejercicios terminados!",
                            color = p.ink,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                        )
                        Spacer(Modifier.height(12.dp))
                        BotonPrincipal(texto = "Añadir ejercicio", icono = Icons.Rounded.Add, onClick = { hojaAnadirEj = true })
                        if (sesion.ejercicios.isNotEmpty()) {
                            Spacer(Modifier.height(8.dp))
                            BotonPrincipal(texto = "Terminar entreno", icono = Icons.Rounded.Check, grande = true, onClick = alFinalizar)
                        }
                    }
                }
            } else {
                val sug = remember(ejActual.uid, ejActual.ejercicio) { sugerenciaPara(ejActual) }
                Tarjeta(onClick = { alAbrirFicha(ejActual.ejercicio) }) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.clickable { hojaInstrucciones = true }) {
                            MiniaturaEjercicio(urlAsset = ejCat?.let { catalogo?.miniaturaAsset(it) }, tamano = 64.dp)
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                EtiquetaTag("Ejercicio ${idx + 1} de ${sesion.ejercicios.size}", colorFondo = p.blueT, colorTexto = p.blue)
                                if (ejActual.superserie != null) EtiquetaTag("Dos seguidos", colorFondo = p.goT, colorTexto = p.go)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = ejCat?.nombre ?: ejActual.ejercicio,
                                color = p.ink,
                                fontFamily = FuenteTitulo,
                                fontWeight = FontWeight.Bold,
                                fontSize = 23.sp,
                                lineHeight = 25.sp,
                            )
                            val unidadObj = when (ejActual.registro) {
                                "tiempo" -> "s"
                                "cardio" -> "min"
                                else -> "reps"
                            }
                            Text(
                                text = "Objetivo: ${ejActual.repsMin}-${ejActual.repsMax} $unidadObj · RPE ${ejActual.rpe.toInt()}",
                                color = p.muted,
                                fontSize = 13.5.sp,
                            )
                            ajustesMaquina(ejActual.ejercicio)?.takeIf { it.isNotBlank() }?.let { aj ->
                                Text("Ajuste: $aj", color = p.blue, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }

                NotaAviso(
                    texto = sug.texto,
                    tono = when (sug.accion) {
                        Progresion.AccionSugerencia.SUBIR -> TonoNota.OK
                        Progresion.AccionSugerencia.BAJAR -> TonoNota.WARN
                        else -> TonoNota.INFO
                    },
                    icono = iconoBarbell(bold = true),
                )

                // Lista de series del ejercicio actual (las hechas se pueden tocar para corregir)
                ListaAgrupada {
                    ejActual.series.forEachIndexed { sIdx, s ->
                        val actual = sIdx == serieIdx
                        val pesoTxt = s.peso?.let { "${formatoKg(it)} kg" } ?: ""
                        val repsTxt = when (ejActual.registro) {
                            "tiempo" -> "${s.segundos ?: 0} s"
                            "cardio" -> "${s.reps ?: 0} min"
                            else -> "${s.reps ?: 0} reps"
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(if (actual) p.goT else Color.Transparent)
                                .then(if (s.hecha) Modifier.clickable { serieEditando = sIdx to s } else Modifier)
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            EtiquetaTag(
                                texto = if (s.calentamiento) "CAL" else "S${s.n}",
                                colorFondo = if (s.hecha) p.okT else if (s.calentamiento) p.blueT else p.raised,
                                colorTexto = if (s.hecha) p.ok else if (s.calentamiento) p.blue else p.muted,
                            )
                            Text(
                                text = listOf(pesoTxt, repsTxt).filter { it.isNotBlank() }.joinToString(" × "),
                                color = p.ink,
                                fontFamily = FuenteMono,
                                fontWeight = if (actual) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 15.sp,
                                modifier = Modifier.weight(1f),
                            )
                            if (s.record == true) {
                                Icon(Icons.Rounded.EmojiEvents, contentDescription = "Récord", tint = p.gold, modifier = Modifier.size(18.dp))
                            }
                            if (s.hecha) {
                                Icon(Icons.Rounded.CheckCircle, contentDescription = "Hecha", tint = p.ok, modifier = Modifier.size(20.dp))
                            } else if (actual) {
                                EtiquetaTag("Ahora", colorFondo = p.go, colorTexto = p.onGo)
                            }
                        }
                        if (sIdx < ejActual.series.lastIndex) SeparadorLista()
                    }
                }

                // Herramientas rápidas del ejercicio (FlowRow para que nunca se recorten chips)
                val puedeQuitarSerie = ejActual.series.count { !it.calentamiento } > 1 &&
                    ejActual.series.any { !it.hecha && !it.calentamiento }
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    FilterChip(selected = false, onClick = { hojaOcupado = true }, label = { Text("Ocupado") }, leadingIcon = { Icon(Icons.Rounded.SwapHoriz, null, Modifier.size(16.dp)) })
                    FilterChip(selected = false, onClick = { alAnadirSerie(idx) }, label = { Text("+ Serie") })
                    if (ejActual.series.none { it.calentamiento } && ejActual.registro in setOf("peso", "mancuerna")) {
                        FilterChip(selected = false, onClick = { alCalentar(idx) }, label = { Text("Calentar") }, leadingIcon = { Icon(Icons.Rounded.LocalFireDepartment, null, Modifier.size(16.dp)) })
                    }
                    if (ejCat?.material in PesosYDiscos.BARRAS) {
                        FilterChip(selected = false, onClick = { hojaDiscos = true }, label = { Text("Discos") })
                    }
                    FilterChip(selected = false, enabled = puedeQuitarSerie, onClick = { alQuitarSerie(idx) }, label = { Text("− Serie") })
                    FilterChip(selected = false, onClick = { alSaltarEjercicio(idx) }, label = { Text("Saltar") }, leadingIcon = { Icon(Icons.Rounded.SkipNext, null, Modifier.size(16.dp)) })
                    FilterChip(selected = false, onClick = { hojaAnadirEj = true }, label = { Text("+ Ejercicio") })
                }
            }
            Spacer(Modifier.height(12.dp))
        }

        // Panel inferior pegado abajo 1:1 con Panel.tsx
        if (ejActual != null && serieActual != null) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = p.surface,
                border = BorderStroke(1.dp, p.line),
                shadowElevation = 10.dp,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // Banner de descanso en vivo (sincronizado con ServicioDescanso en pantalla bloqueada)
                    if (descRestanteSeg > 0) {
                        val totalDesc = max(descRestanteSeg, sesion.descansoTotal ?: 90)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(p.goT)
                                .padding(10.dp),
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.Timer, contentDescription = null, tint = p.go, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = "Descanso · ${formatoMmSs(descRestanteSeg)}",
                                    color = p.ink,
                                    fontFamily = FuenteMono,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                TextButton(onClick = { alAjustarDescanso(30) }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                                    Text("+30 s", color = p.go, fontFamily = FuenteMono, fontWeight = FontWeight.Bold)
                                }
                                TextButton(onClick = { alAjustarDescanso(null) }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                                    Text("Saltar", color = p.muted, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            BarraProgreso(valor = descRestanteSeg.toDouble(), total = totalDesc.toDouble(), color = p.go)
                        }
                    }

                    // Temporizador en vivo para ejercicios por tiempo
                    if (ejActual.registro == "tiempo") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(p.raised)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = formatoMmSs(cronoSeg),
                                color = p.ink,
                                fontFamily = FuenteMono,
                                fontWeight = FontWeight.Bold,
                                fontSize = 22.sp,
                                modifier = Modifier.weight(1f),
                            )
                            FilterChip(
                                selected = modoCuentaAtras,
                                onClick = {
                                    modoCuentaAtras = !modoCuentaAtras
                                    cronoActivo = false
                                    cronoSeg = if (modoCuentaAtras) repsCampo else 0
                                },
                                label = { Text(if (modoCuentaAtras) "Cuenta atrás" else "Cronómetro") },
                            )
                            IconButton(onClick = { cronoActivo = !cronoActivo }) {
                                Icon(if (cronoActivo) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, contentDescription = "Iniciar/Pausar", tint = p.go)
                            }
                        }
                    }

                    // Steppers Peso + Reps/Segundos
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (ejActual.registro in setOf("peso", "mancuerna", "asistido")) {
                            StepperValor(
                                etiqueta = if (ejActual.registro == "asistido") "Ayuda (kg)" else if (ejActual.registro == "mancuerna") "Cada manc." else "Peso (kg)",
                                valorTexto = formatoKg(pesoCampo),
                                alMenos = { pesoCampo = PesosYDiscos.siguiente(listaPesos, pesoCampo, -1) },
                                alMas = { pesoCampo = PesosYDiscos.siguiente(listaPesos, pesoCampo, 1) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        StepperValor(
                            etiqueta = if (ejActual.registro == "tiempo") "Segundos" else if (ejActual.registro == "cardio") "Minutos" else "Repeticiones",
                            valorTexto = "$repsCampo",
                            alMenos = { repsCampo = (repsCampo - if (ejActual.registro == "tiempo") 5 else 1).coerceAtLeast(1) },
                            alMas = { repsCampo = (repsCampo + if (ejActual.registro == "tiempo") 5 else 1).coerceAtMost(999) },
                            modifier = Modifier.weight(1f),
                        )
                    }

                    // Selector compacto de esfuerzo RPE (opcional)
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        itemVerticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("RPE", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        listOf(6.0, 7.0, 8.0, 9.0, 10.0).forEach { v ->
                            FilterChip(
                                selected = rpeCampo == v,
                                onClick = { rpeCampo = if (rpeCampo == v) null else v },
                                label = { Text("${v.toInt()}", fontFamily = FuenteMono) },
                            )
                        }
                    }

                    BotonPrincipal(
                        texto = if (serieActual.calentamiento) "Calentamiento hecho" else "Hecho",
                        icono = Icons.Rounded.Check,
                        grande = true,
                        onClick = {
                            cronoActivo = false
                            val esTiempo = ejActual.registro == "tiempo"
                            val conPeso = ejActual.registro in setOf("peso", "mancuerna", "asistido")
                            alApuntarSerie(
                                idx,
                                MotorSesion.DatosSerie(
                                    peso = if (conPeso) pesoCampo else null,
                                    reps = if (esTiempo) null else repsCampo,
                                    segundos = if (esTiempo) repsCampo else null,
                                    rpe = rpeCampo,
                                ),
                            )
                        },
                    )
                }
            }
        }
    }

    // Hoja lista de ejercicios de la sesión
    if (hojaLista) {
        ModalBottomSheet(onDismissRequest = { hojaLista = false }, containerColor = p.surface) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
            ) {
                Text("Ejercicios de hoy", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Spacer(Modifier.height(10.dp))
                ListaAgrupada {
                    sesion.ejercicios.forEachIndexed { i, e ->
                        FilaLista(
                            titulo = catalogo?.nombreEjercicio(e.ejercicio) ?: e.ejercicio,
                            subtitulo = "${e.series.count { it.hecha }}/${e.series.size} series · ${e.estado}",
                            alPulsar = {
                                alIrAEjercicio(i)
                                hojaLista = false
                            },
                        )
                        if (i < sesion.ejercicios.lastIndex) SeparadorLista()
                    }
                }
                Spacer(Modifier.height(12.dp))
                BotonSecundario(texto = "Añadir ejercicio", icono = Icons.Rounded.Add, onClick = { hojaLista = false; hojaAnadirEj = true })
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    // Hoja «Ocupado»: sustituir ejercicio por alternativa del mismo patrón
    if (hojaOcupado && ejActual != null && catalogo != null) {
        val pat = ejCat?.let { PesosYDiscos.patron(it) }
        val enSesion = sesion.ejercicios.map { it.ejercicio }.toSet()
        val alts = catalogo.ejercicios
            .filter { it.id !in enSesion && (pat == null || PesosYDiscos.patron(it) == pat) }
            .take(15)
        ModalBottomSheet(onDismissRequest = { hojaOcupado = false }, containerColor = p.surface) {
            Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp)) {
                Text("¿Máquina ocupada?", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text("Elige una alternativa del mismo patrón:", color = p.muted, fontSize = 14.sp)
                Spacer(Modifier.height(10.dp))
                LazyColumn(modifier = Modifier.height(340.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(alts, key = { it.id }) { alt ->
                        Tarjeta(onClick = { alSustituir(idx, alt.id); hojaOcupado = false }, padding = PaddingValues(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MiniaturaEjercicio(urlAsset = catalogo.miniaturaAsset(alt), tamano = 42.dp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(alt.nombre, color = p.ink, fontWeight = FontWeight.SemiBold)
                                    Text(catalogo.nombreMaterial(alt.material), color = p.muted, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    // Hoja calculadora de discos por lado
    if (hojaDiscos && ejCat != null) {
        val barra = if (ejCat.material == "barbell") (gimnasio?.barraKg ?: 20.0) else (PesosYDiscos.BARRAS[ejCat.material] ?: 20.0)
        val discosGym = gimnasio?.discos?.takeIf { it.isNotEmpty() } ?: listOf(1.25, 2.5, 5.0, 10.0, 15.0, 20.0)
        val porLado = PesosYDiscos.discosPorLado(pesoCampo, barra, discosGym)
        ModalBottomSheet(onDismissRequest = { hojaDiscos = false }, containerColor = p.surface) {
            Column(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Discos por lado", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
                Text("Total ${formatoKg(pesoCampo)} kg · barra ${formatoKg(barra)} kg", color = p.muted, fontFamily = FuenteMono)
                when {
                    porLado == null -> NotaAviso("No se puede montar exacto con los discos de tu gimnasio.", tono = TonoNota.WARN)
                    porLado.isEmpty() -> NotaAviso("Solo la barra vacía (${formatoKg(barra)} kg).", tono = TonoNota.OK)
                    else -> {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            porLado.forEach { d ->
                                EtiquetaTag("${formatoKg(d)} kg", colorFondo = p.goT, colorTexto = p.go)
                            }
                        }
                    }
                }
                BotonSecundario(texto = "Cerrar", onClick = { hojaDiscos = false })
                Spacer(Modifier.height(12.dp))
            }
        }
    }

    // Hoja «Cómo se hace»: muestra todas las poses RepDB lado a lado + instrucciones sin salir del entreno
    if (hojaInstrucciones && ejCat != null && catalogo != null) {
        val imgs = remember(ejCat, catalogo) { catalogo.todasImagenesAsset(ejCat) }
        ModalBottomSheet(onDismissRequest = { hojaInstrucciones = false }, containerColor = p.surface) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Cómo se hace", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
                Text(ejCat.nombre, color = p.muted, fontSize = 14.5.sp)
                if (imgs.isNotEmpty()) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        imgs.forEach { (pose, url) ->
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0xFFD9F0FC)),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                AsyncImage(
                                    model = url,
                                    contentDescription = etiquetaPose(pose),
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(148.dp)
                                        .padding(6.dp),
                                )
                                Text(
                                    text = etiquetaPose(pose),
                                    color = Color(0xFF16202B),
                                    fontFamily = FuenteTitulo,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(bottom = 6.dp),
                                )
                            }
                        }
                    }
                }
                ejCat.instrucciones.forEachIndexed { i, paso ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        EtiquetaTag("${i + 1}", colorFondo = p.raised, colorTexto = p.blue)
                        Text(paso, color = p.ink, fontFamily = FuenteCuerpo, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    }
                }
                if (ejCat.consejos.isNotEmpty()) {
                    Text("CONSEJOS", color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    ejCat.consejos.forEach { c -> Text("• $c", color = p.muted, fontSize = 13.5.sp) }
                }
                BotonSecundario(texto = "Cerrar", onClick = { hojaInstrucciones = false })
                Spacer(Modifier.height(10.dp))
            }
        }
    }

    // Hoja buscador para añadir un ejercicio a la sesión
    if (hojaAnadirEj && catalogo != null) {
        HojaBuscadorEjercicio(
            catalogo = catalogo,
            titulo = "Añadir ejercicio al entreno",
            alCerrar = { hojaAnadirEj = false },
            alElegir = { id ->
                alAnadirEjercicio(id)
                hojaAnadirEj = false
            },
        )
    }

    serieEditando?.let { (sIdxEdit, serieOrig) ->
        if (ejActual != null) {
            val esTiempo = ejActual.registro == "tiempo"
            val conPeso = ejActual.registro in setOf("peso", "mancuerna", "asistido")
            var pesoEd by remember(sIdxEdit, serieOrig) { mutableDoubleStateOf(serieOrig.peso ?: listaPesos.firstOrNull { it > 0 } ?: 20.0) }
            var repsEd by remember(sIdxEdit, serieOrig) {
                mutableIntStateOf(if (esTiempo) serieOrig.segundos ?: ejActual.repsMin else serieOrig.reps ?: ejActual.repsMin)
            }
            ModalBottomSheet(onDismissRequest = { serieEditando = null }, containerColor = p.surface) {
                Column(
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "Corregir ${if (serieOrig.calentamiento) "calentamiento" else "serie S${serieOrig.n}"}",
                        color = p.ink,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (conPeso) {
                            StepperValor(
                                etiqueta = if (ejActual.registro == "asistido") "Ayuda (kg)" else if (ejActual.registro == "mancuerna") "Cada manc." else "Peso (kg)",
                                valorTexto = formatoKg(pesoEd),
                                alMenos = { pesoEd = PesosYDiscos.siguiente(listaPesos, pesoEd, -1) },
                                alMas = { pesoEd = PesosYDiscos.siguiente(listaPesos, pesoEd, 1) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        StepperValor(
                            etiqueta = if (esTiempo) "Segundos" else if (ejActual.registro == "cardio") "Minutos" else "Repeticiones",
                            valorTexto = "$repsEd",
                            alMenos = { repsEd = (repsEd - if (esTiempo) 5 else 1).coerceAtLeast(1) },
                            alMas = { repsEd = (repsEd + if (esTiempo) 5 else 1).coerceAtMost(999) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    BotonPrincipal(
                        texto = "Guardar corrección",
                        icono = Icons.Rounded.Check,
                        onClick = {
                            alEditarSerieHecha(
                                idx,
                                sIdxEdit,
                                if (conPeso) pesoEd else null,
                                if (esTiempo) null else repsEd,
                                if (esTiempo) repsEd else null,
                            )
                            serieEditando = null
                        },
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
    }

    if (dialogoSalir) {
        AlertDialog(
            onDismissRequest = { dialogoSalir = false },
            title = { Text("¿Terminar el entreno?") },
            text = { Text("Se guardarán las series que ya has marcado como hechas.") },
            confirmButton = {
                TextButton(onClick = { dialogoSalir = false; alFinalizar() }) {
                    Text("Terminar y guardar", color = p.go, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = { dialogoSalir = false; alDescartar() }) {
                        Text("Descartar", color = p.bad)
                    }
                    TextButton(onClick = { dialogoSalir = false }) { Text("Seguir") }
                }
            },
        )
    }
}

/** Resumen tras terminar un entreno + guardar como plantilla libre reutilizable. */
@Composable
fun PantallaFinEntreno(
    sesion: Sesion,
    alGuardarPlantilla: (String) -> Unit,
    alVolverInicio: () -> Unit,
) {
    val p = LocalPaleta.current
    val res = remember(sesion) { MotorSesion.resumen(sesion) }
    val records = sesion.ejercicios.sumOf { e -> e.series.count { it.record == true } }
    var nombrePlantilla by remember { mutableStateOf(sesion.nombre) }
    var guardada by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(Icons.Rounded.EmojiEvents, contentDescription = null, tint = p.gold, modifier = Modifier.size(56.dp))
        Text("¡Entreno terminado!", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 32.sp)
        Text(sesion.nombre, color = p.muted, fontSize = 16.sp)

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                Text("DURACIÓN", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                Text("${max(1, res.segundos / 60)} min", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            }
            Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                Text("SERIES", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                Text("${res.series}", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            }
            Tarjeta(modifier = Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                Text("VOLUMEN", color = p.muted, fontFamily = FuenteTitulo, fontSize = 11.5.sp)
                Text("${res.volumenKg} kg", color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
        }

        if (records > 0) {
            NotaAviso(
                texto = "¡Has batido $records ${if (records == 1) "récord personal" else "récords personales"} hoy!",
                tono = TonoNota.OK,
                icono = Icons.Rounded.EmojiEvents,
            )
        }

        if (sesion.ejercicios.isNotEmpty() && !guardada) {
            Tarjeta {
                Text("Guardar como plantilla libre", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = nombrePlantilla,
                    onValueChange = { nombrePlantilla = it },
                    label = { Text("Nombre de la plantilla") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                BotonSecundario(
                    texto = "Guardar plantilla",
                    icono = Icons.Rounded.Save,
                    onClick = {
                        alGuardarPlantilla(nombrePlantilla)
                        guardada = true
                    },
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        BotonPrincipal(texto = "Volver a Inicio", grande = true, onClick = alVolverInicio)
    }
}

/** Mini barra flotante que aparece encima del dock cuando minimizas el entreno en curso. */
@Composable
fun MiniBarraEntreno(
    sesion: Sesion,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = p.raised,
        border = BorderStroke(1.dp, p.go),
        shadowElevation = 8.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(iconoBarbell(bold = true), contentDescription = null, tint = p.go, modifier = Modifier.size(22.dp))
            Text(sesion.nombre, color = p.ink, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Volver", color = p.go, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StepperValor(
    etiqueta: String,
    valorTexto: String,
    alMenos: () -> Unit,
    alMas: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalPaleta.current
    Column(modifier = modifier) {
        Text(etiqueta.uppercase(), color = p.muted, fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 11.5.sp)
        Spacer(Modifier.height(4.dp))
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = p.bg,
            border = BorderStroke(1.dp, p.line),
        ) {
            Row(modifier = Modifier.fillMaxWidth().height(50.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = alMenos, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.Remove, contentDescription = "Menos", tint = p.blue)
                }
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(valorTexto, color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                }
                IconButton(onClick = alMas, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Rounded.Add, contentDescription = "Más", tint = p.blue)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaBuscadorEjercicio(
    catalogo: CatalogoCargado,
    titulo: String,
    alCerrar: () -> Unit,
    alElegir: (String) -> Unit,
) {
    val p = LocalPaleta.current
    var q by remember { mutableStateOf("") }
    val lista = remember(q, catalogo) { catalogo.buscar(q).take(40) }
    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(titulo, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 22.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = alCerrar) { Icon(Icons.Rounded.Close, contentDescription = "Cerrar", tint = p.muted) }
            }
            OutlinedTextField(
                value = q,
                onValueChange = { q = it },
                placeholder = { Text("Buscar ejercicio o músculo…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            LazyColumn(modifier = Modifier.height(360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(lista, key = { it.id }) { ej ->
                    Tarjeta(onClick = { alElegir(ej.id) }, padding = PaddingValues(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            MiniaturaEjercicio(urlAsset = catalogo.miniaturaAsset(ej), tamano = 44.dp)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ej.nombre, color = p.ink, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(catalogo.nombreMaterial(ej.material), color = p.muted, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

private fun formatoMmSs(seg: Int): String = String.format("%02d:%02d", seg / 60, seg % 60)
private fun formatoKg(v: Double): String = if (v == v.toInt().toDouble()) "${v.toInt()}" else String.format("%.1f", v).replace('.', ',')
