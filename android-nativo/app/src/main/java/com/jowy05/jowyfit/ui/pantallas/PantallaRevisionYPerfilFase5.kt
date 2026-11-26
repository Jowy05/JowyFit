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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.HealthAndSafety
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.datos.modelo.Dolor
import com.jowy05.jowyfit.datos.modelo.ModoMayor
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.RespuestaRevision
import com.jowy05.jowyfit.dominio.SaludYRevisionDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaSeccionGrupo
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import java.time.LocalDate

/** Pantalla de Revisión semanal (Fase 5): actualiza molestias, suaviza o devuelve ejercicios y permite deshacer. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaRevisionSemanal(
    estado: EstadoPrincipal,
    catalogo: CatalogoCargado?,
    alVolver: () -> Unit,
    alAplicarRevision: (List<RespuestaRevision>, List<Dolor>) -> Unit,
    alDeshacerUltima: () -> Unit,
) {
    val p = LocalPaleta.current
    val dolores = estado.perfil.dolores.orEmpty()
    val respuestas = remember(dolores) {
        mutableStateMapOf<String, String>().apply { dolores.forEach { put(it.zona, "igual") } }
    }
    var nuevasZonas by remember { mutableStateOf<Set<String>>(emptySet()) }
    val hayDeshacer = estado.revisiones.any { r -> r.cambios.any { it.deshecho != true } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = "Perfil",
            titulo = "Revisión semanal",
            sub = "Ajusta la rutina al momento según cómo notas tus articulaciones",
            alVolver = alVolver,
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (hayDeshacer) {
                BotonSecundario(
                    texto = "Deshacer última revisión aplicada",
                    icono = Icons.AutoMirrored.Rounded.Undo,
                    onClick = alDeshacerUltima,
                )
            }

            if (dolores.isEmpty()) {
                NotaAviso(
                    texto = "No tienes molestias activas ahora mismo. Si notas alguna nueva esta semana, márcala abajo y suavizaremos tu rutina.",
                    tono = TonoNota.OK,
                    icono = Icons.Rounded.HealthAndSafety,
                )
            } else {
                EtiquetaSeccionGrupo("¿Cómo van tus molestias esta semana?")
                dolores.forEach { d ->
                    val sel = respuestas[d.zona] ?: "igual"
                    Tarjeta(padding = PaddingValues(12.dp)) {
                        Text(
                            text = "${SaludYRevisionDominio.nombreZona(d.zona)} (${d.cuanto})",
                            color = p.ink,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                        )
                        Spacer(Modifier.height(8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("ya" to "Ya no duele", "mejor" to "Mejor", "igual" to "Igual", "peor" to "Peor").forEach { (k, lbl) ->
                                FilterChip(selected = sel == k, onClick = { respuestas[d.zona] = k }, label = { Text(lbl) })
                            }
                        }
                    }
                }
            }

            EtiquetaSeccionGrupo("¿Alguna molestia nueva esta semana?")
            val yaActivas = dolores.map { it.zona }.toSet()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SaludYRevisionDominio.ZONAS_DOLOR.filter { it.clave !in yaActivas }.forEach { z ->
                    val on = z.clave in nuevasZonas
                    FilterChip(
                        selected = on,
                        onClick = { nuevasZonas = if (on) nuevasZonas - z.clave else nuevasZonas + z.clave },
                        label = { Text(z.nombre, fontSize = 13.sp) },
                        leadingIcon = if (on) ({ Icon(Icons.Rounded.Add, null) }) else null,
                    )
                }
            }

            // Vista previa de cambios que se aplicarán a la rutina activa
            val rutina = estado.rutinaActiva
            val previewCambios = remember(rutina, catalogo, respuestas.toMap(), nuevasZonas) {
                if (rutina == null || catalogo == null) emptyList()
                else {
                    val resList = respuestas.entries.map { RespuestaRevision(it.key, it.value) }
                    val nuevosD = nuevasZonas.map { Dolor(zona = it, cuanto = "regular", cuando = "fuerza", desde = "dias", inicio = LocalDate.now().toString()) }
                    val perfilTmp = estado.perfil.copy(dolores = SaludYRevisionDominio.doloresTrasRevision(dolores, resList) + nuevosD)
                    val peor = resList.filter { it.va == "peor" }.map { it.zona } + nuevasZonas
                    val mejor = resList.filter { it.va == "mejor" || it.va == "ya" }.map { it.zona to (it.va == "ya") }
                    SaludYRevisionDominio.cambiosRevision(
                        rutina = rutina,
                        perfil = perfilTmp,
                        zonasPeor = peor.distinct(),
                        zonasMejor = mejor,
                        activos = estado.revisiones.flatMap { it.cambios },
                        ejerciciosPorId = catalogo.porId,
                        gimnasio = estado.gimnasioActivo,
                        marcas = estado.marcas,
                    )
                }
            }

            if (previewCambios.isNotEmpty()) {
                Tarjeta {
                    Text("AJUSTES EN TU RUTINA (${previewCambios.size})", color = p.blue, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(Modifier.height(6.dp))
                    previewCambios.forEach { c ->
                        Text(
                            text = "• Día ${c.letra}: ${SaludYRevisionDominio.textoCambio(c) { catalogo?.nombreEjercicio(it) ?: it }}",
                            color = p.ink,
                            fontSize = 13.5.sp,
                            modifier = Modifier.padding(vertical = 2.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            BotonPrincipal(
                texto = "Aplicar revisión semanal",
                icono = Icons.Rounded.Check,
                grande = true,
                onClick = {
                    val resList = respuestas.entries.map { RespuestaRevision(it.key, it.value) }
                    val nuevosD = nuevasZonas.map {
                        Dolor(zona = it, cuanto = "regular", cuando = "fuerza", desde = "dias", inicio = LocalDate.now().toString())
                    }
                    alAplicarRevision(resList, nuevosD)
                    alVolver()
                },
            )
            Spacer(Modifier.height(48.dp))
        }
    }
}

/** Hoja para editar los datos personales, objetivo, sueño, modo mayor, condiciones de salud y lesiones. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HojaEditarPerfilYSalud(
    perfil: Perfil,
    alCerrar: () -> Unit,
    alGuardar: (Perfil) -> Unit,
) {
    val p = LocalPaleta.current
    var nombre by remember(perfil) { mutableStateOf(perfil.nombre) }
    var altura by remember(perfil) { mutableStateOf(perfil.alturaCm.toInt().toString()) }
    var objetivo by remember(perfil) { mutableStateOf(perfil.objetivo) }
    var sueno by remember(perfil) { mutableStateOf(perfil.sueno ?: "bien") }
    var pasosObj by remember(perfil) { mutableStateOf(perfil.pasosObjetivo.toString()) }
    var modoMayor by remember(perfil) { mutableStateOf(perfil.modoMayor?.activo == true) }
    var condiciones by remember(perfil) { mutableStateOf(perfil.condicionesSalud.orEmpty().toSet()) }
    var lesiones by remember(perfil) { mutableStateOf(perfil.lesiones) }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Tu perfil y salud", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            OutlinedTextField(value = nombre, onValueChange = { nombre = it }, label = { Text("Nombre") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = altura,
                    onValueChange = { altura = it.filter(Char::isDigit).take(3) },
                    label = { Text("Altura (cm)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = pasosObj,
                    onValueChange = { pasosObj = it.filter(Char::isDigit).take(5) },
                    label = { Text("Objetivo pasos") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }

            Text("Objetivo principal", color = p.muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("recomposicion" to "Recomposición", "musculo" to "Músculo", "fuerza" to "Fuerza", "perder" to "Perder grasa", "salud" to "Salud").forEach { (k, lbl) ->
                    FilterChip(selected = objetivo == k, onClick = { objetivo = k }, label = { Text(lbl) })
                }
            }

            Text("¿Cómo duermes normalmente?", color = p.muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("bien" to "Bien (7-8 h)", "regular" to "Regular", "poco" to "Poco (<6 h)").forEach { (k, lbl) ->
                    FilterChip(selected = sueno == k, onClick = { sueno = k }, label = { Text(lbl) })
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Modo mayor (+60 / seguridad extra)", color = p.ink, fontSize = 15.sp)
                    Text("Prioriza máquinas/apoyo y descansos largos.", color = p.muted, fontSize = 12.5.sp)
                }
                Switch(checked = modoMayor, onCheckedChange = { modoMayor = it })
            }

            Text("Condiciones de salud", color = p.muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SaludYRevisionDominio.CONDICIONES_SALUD.forEach { c ->
                    val on = c.clave in condiciones
                    FilterChip(
                        selected = on,
                        onClick = { condiciones = if (on) condiciones - c.clave else condiciones + c.clave },
                        label = { Text(c.nombre, fontSize = 12.5.sp) },
                    )
                }
            }

            OutlinedTextField(
                value = lesiones,
                onValueChange = { lesiones = it },
                label = { Text("Lesiones o notas médicas (texto libre)") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            BotonPrincipal(
                texto = "Guardar cambios",
                grande = true,
                onClick = {
                    alGuardar(
                        perfil.copy(
                            nombre = nombre.trim(),
                            alturaCm = altura.toDoubleOrNull()?.coerceIn(110.0, 230.0) ?: perfil.alturaCm,
                            objetivo = objetivo,
                            sueno = sueno,
                            pasosObjetivo = pasosObj.toIntOrNull()?.coerceIn(1000, 40000) ?: perfil.pasosObjetivo,
                            modoMayor = ModoMayor(activo = modoMayor),
                            condicionesSalud = condiciones.toList().takeIf { it.isNotEmpty() },
                            lesiones = lesiones.trim(),
                        ),
                    )
                    alCerrar()
                },
            )
            Spacer(Modifier.height(10.dp))
        }
    }
}
