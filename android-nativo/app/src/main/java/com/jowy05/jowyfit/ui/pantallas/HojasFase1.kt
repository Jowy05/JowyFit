package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.BuildConfig
import com.jowy05.jowyfit.dominio.ActualizacionDominio
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.ComidaDominio
import com.jowy05.jowyfit.nativo.ActualizadorApp
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.tema.FuenteMono
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaPeso(
    pesoInicial: Double?,
    alCerrar: () -> Unit,
    alGuardar: (Double) -> Unit,
) {
    val p = LocalPaleta.current
    var texto by remember { mutableStateOf(pesoInicial?.let { String.format("%.1f", it) } ?: "75.0") }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Apuntar peso", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            val pesoVal = texto.replace(',', '.').toDoubleOrNull()
            val valido = pesoVal != null && pesoVal in 20.0..350.0
            OutlinedTextField(
                value = texto,
                onValueChange = { texto = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                label = { Text("Peso (kg)") },
                supportingText = if (!valido && texto.isNotBlank()) ({ Text("Introduce un peso entre 20 y 350 kg", color = p.bad) }) else null,
                isError = !valido && texto.isNotBlank(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            BotonPrincipal(
                texto = "Guardar peso",
                enabled = valido,
                onClick = {
                    if (valido) {
                        alGuardar(pesoVal!!)
                        alCerrar()
                    }
                },
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HojaComidaRapida(
    alCerrar: () -> Unit,
    alGuardar: (nombre: String, kcal: Double, proteina: Double, franja: String) -> Unit,
) {
    val p = LocalPaleta.current
    val franjaInicial = remember {
        ComidaDominio.franjaPorHora(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")))
    }
    var nombre by remember { mutableStateOf("") }
    var proteina by remember { mutableStateOf("25") }
    var kcal by remember { mutableStateOf("350") }
    var franja by remember { mutableStateOf(franjaInicial) }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Apuntar comida o bebida", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                listOf("desayuno" to "Desayuno", "comida" to "Comida", "merienda" to "Merienda", "cena" to "Cena").forEach { (k, lbl) ->
                    FilterChip(selected = franja == k, onClick = { franja = k }, label = { Text(lbl) })
                }
            }
            OutlinedTextField(
                value = nombre,
                onValueChange = { nombre = it },
                label = { Text("Qué has comido") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = proteina,
                    onValueChange = { proteina = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text("Proteína (g)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = kcal,
                    onValueChange = { kcal = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                    label = { Text("Calorías (kcal)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }
            BotonPrincipal(
                texto = "Guardar comida",
                enabled = nombre.isNotBlank(),
                onClick = {
                    alGuardar(
                        nombre,
                        kcal.replace(',', '.').toDoubleOrNull() ?: 0.0,
                        proteina.replace(',', '.').toDoubleOrNull() ?: 0.0,
                        franja,
                    )
                    alCerrar()
                },
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaDia(
    dia: CalculosDominio.EstadoDia,
    alCerrar: () -> Unit,
) {
    val p = LocalPaleta.current
    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(dia.fecha, color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            val resumen = when (dia.estado) {
                CalculosDominio.EstadoDiaTipo.HECHO -> "Entreno hecho: ${dia.sesion?.nombre ?: dia.dia?.nombre ?: ""}"
                CalculosDominio.EstadoDiaTipo.PLAN -> "Previsto: ${dia.dia?.nombre ?: "Entreno"}"
                CalculosDominio.EstadoDiaTipo.OPCIONAL -> "Sesión opcional: ${dia.dia?.nombre ?: ""}"
                CalculosDominio.EstadoDiaTipo.PERDIDO -> "Entreno no realizado: ${dia.dia?.nombre ?: ""}"
                CalculosDominio.EstadoDiaTipo.MOVIDO -> "Movido a otro día"
                CalculosDominio.EstadoDiaTipo.DESCANSO -> "Día de descanso"
            }
            Text(resumen, color = p.muted, fontSize = 15.sp)
            BotonSecundario(texto = "Cerrar", onClick = alCerrar)
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaContrasenaCopia(
    error: String?,
    alCancelar: () -> Unit,
    alConfirmar: (String) -> Unit,
) {
    val p = LocalPaleta.current
    var clave by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = alCancelar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Esta copia tiene contraseña", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            OutlinedTextField(
                value = clave,
                onValueChange = { clave = it },
                label = { Text("Contraseña") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (!error.isNullOrBlank()) {
                Text(error, color = p.bad, fontSize = 13.5.sp)
            }
            BotonPrincipal(texto = "Abrir copia", enabled = clave.isNotEmpty(), onClick = { alConfirmar(clave) })
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaExportarCopia(
    alCancelar: () -> Unit,
    alExportar: (String?) -> Unit,
) {
    val p = LocalPaleta.current
    var conClave by remember { mutableStateOf(false) }
    var clave by remember { mutableStateOf("") }
    var repetir by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = alCancelar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Exportar copia (.jowyfit)", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            Text("Incluye entrenos, comidas, medidas, fotos y retos en formato V7.", color = p.muted, fontSize = 13.5.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !conClave, onClick = { conClave = false }, label = { Text("Sin contraseña") })
                FilterChip(selected = conClave, onClick = { conClave = true }, label = { Text("Cifrada (AES-256)") })
            }
            if (conClave) {
                OutlinedTextField(
                    value = clave,
                    onValueChange = { clave = it },
                    label = { Text("Contraseña (mín. 6 caracteres)") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = repetir,
                    onValueChange = { repetir = it },
                    label = { Text("Repite la contraseña") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    isError = repetir.isNotEmpty() && repetir != clave,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (repetir.isNotEmpty() && repetir != clave) {
                    Text("Las contraseñas no coinciden", color = p.bad, fontSize = 13.sp)
                }
            }
            val valido = !conClave || (clave.length >= 6 && clave == repetir)
            BotonPrincipal(
                texto = if (conClave) "Crear copia cifrada" else "Crear copia",
                enabled = valido,
                onClick = { alExportar(if (conClave) clave else null) },
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HojaActualizacionNativa(
    alCerrar: () -> Unit,
) {
    val p = LocalPaleta.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var buscando by remember { mutableStateOf(true) }
    var info by remember { mutableStateOf<ActualizacionDominio.InfoActualizacion?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var descargando by remember { mutableStateOf(false) }
    var progreso by remember { mutableIntStateOf(0) }
    var estadoApk by remember { mutableStateOf<String?>(null) }

    fun comprobar() {
        scope.launch {
            buscando = true
            error = null
            estadoApk = null
            ActualizadorApp.buscar(BuildConfig.VERSION_APP)
                .onSuccess { info = it }
                .onFailure { error = "No se ha podido comprobar ahora mismo. Revisa tu conexión." }
            buscando = false
        }
    }

    LaunchedEffect(Unit) { comprobar() }

    ModalBottomSheet(onDismissRequest = alCerrar, containerColor = p.surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Actualizaciones", color = p.ink, fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 23.sp)
            Text("Versión actual: ${BuildConfig.VERSION_NAME}", color = p.muted, fontSize = 14.sp)

            when {
                buscando -> {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = p.go)
                    Text("Buscando actualizaciones…", color = p.muted, fontSize = 14.sp)
                }
                error != null -> {
                    NotaAviso(texto = error!!, tono = TonoNota.WARN, icono = Icons.Rounded.Warning)
                    BotonPrincipal(texto = "Volver a comprobar", icono = Icons.Rounded.Refresh, onClick = ::comprobar)
                }
                info != null && !info!!.hayNueva -> {
                    NotaAviso(
                        texto = "Tienes la última versión publicada (${info!!.ultima}).",
                        tono = TonoNota.OK,
                        icono = Icons.Rounded.CheckCircle,
                    )
                    BotonSecundario(texto = "Volver a comprobar", icono = Icons.Rounded.Refresh, onClick = ::comprobar)
                }
                info != null -> {
                    val i = info!!
                    Tarjeta {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Nueva versión", color = p.muted)
                            Text(i.ultima, color = p.ink, fontFamily = FuenteMono, fontWeight = FontWeight.Bold)
                        }
                        if (i.bytes != null) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Tamaño del APK", color = p.muted)
                                Text(ActualizacionDominio.tamanoMB(i.bytes), color = p.ink, fontFamily = FuenteMono)
                            }
                        }
                    }
                    if (i.notas.isNotBlank()) {
                        Text(i.notas, color = p.muted, fontSize = 13.5.sp)
                    }
                    if (descargando) {
                        LinearProgressIndicator(progress = { progreso / 100f }, modifier = Modifier.fillMaxWidth(), color = p.go)
                        Text("Descargando… $progreso %", color = p.muted, fontSize = 13.5.sp)
                    }
                    if (estadoApk != null) {
                        NotaAviso(texto = estadoApk!!, tono = TonoNota.OK, icono = Icons.Rounded.CheckCircle)
                    }
                    if (i.urlApk != null) {
                        BotonPrincipal(
                            texto = if (descargando) "Descargando…" else "Descargar e instalar",
                            icono = Icons.Rounded.Download,
                            enabled = !descargando,
                            onClick = {
                                scope.launch {
                                    descargando = true
                                    progreso = 0
                                    estadoApk = null
                                    runCatching {
                                        ActualizadorApp.descargarEInstalar(context, i) { pct -> progreso = pct }
                                    }.onSuccess { res ->
                                        estadoApk = when (res) {
                                            ActualizadorApp.ResultadoInstalacion.PermisoRequerido ->
                                                "Activa «Permitir desde esta fuente» y vuelve a tocar Descargar e instalar."
                                            ActualizadorApp.ResultadoInstalacion.Instalando ->
                                                "Descarga verificada con SHA-256. Sigue los pasos del instalador."
                                        }
                                    }.onFailure { e ->
                                        error = e.message ?: "Error al descargar la actualización"
                                    }
                                    descargando = false
                                }
                            },
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}
