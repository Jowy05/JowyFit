package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FileUpload
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.R
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.BotonSecundario
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.LocalPaleta

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantallaBienvenida(
    alImportarCopia: () -> Unit,
    alCompletarAlta: (nombre: String, sexo: String, alturaCm: Double, pesoKg: Double?, objetivo: String) -> Unit,
) {
    val p = LocalPaleta.current
    var pasoAlta by remember { mutableStateOf(false) }
    var nombre by remember { mutableStateOf("") }
    var sexo by remember { mutableStateOf("hombre") }
    var altura by remember { mutableStateOf("175") }
    var peso by remember { mutableStateOf("75") }
    var objetivo by remember { mutableStateOf("recomposicion") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(0f to p.hdTop, 0.55f to p.hdMid, 1f to p.bg))
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 28.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Image(
                    painter = painterResource(R.mipmap.ic_launcher_foreground),
                    contentDescription = "JowyFit",
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(p.go),
                )
                Text(
                    text = "JOWYFIT",
                    color = p.ink,
                    fontFamily = FuenteTitulo,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    letterSpacing = 3.sp,
                )
            }
            Spacer(Modifier.height(26.dp))
            Text(
                text = if (pasoAlta) "Tu punto de partida" else "Entrena fuerza.\nTodo en tu móvil.",
                color = p.ink,
                fontFamily = FuenteTitulo,
                fontWeight = FontWeight.Bold,
                fontSize = 38.sp,
                lineHeight = 40.sp,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = if (pasoAlta) {
                    "Con estos datos calculamos tus objetivos de energía y proteína."
                } else {
                    "App nativa en Kotlin. Sin cuentas, sin nube y compatible al 100 % con tus copias .jowyfit."
                },
                color = p.muted,
                fontFamily = FuenteCuerpo,
                fontSize = 16.5.sp,
                lineHeight = 23.sp,
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (!pasoAlta) {
                NotaAviso(
                    texto = "Si ya usas JowyFit, toca «Tengo una copia» y elige tu archivo .jowyfit: se recuperan tus entrenos, comidas, medidas, metas, fotos y retos.",
                    tono = TonoNota.INFO,
                    icono = Icons.Rounded.Shield,
                )
                Spacer(Modifier.height(8.dp))
                BotonPrincipal(
                    texto = t("Tengo una copia") + " (.jowyfit)",
                    icono = Icons.Rounded.FileUpload,
                    grande = true,
                    onClick = alImportarCopia,
                )
                BotonSecundario(
                    texto = t("Empezar de cero"),
                    icono = Icons.Rounded.PlayArrow,
                    onClick = { pasoAlta = true },
                )
            } else {
                OutlinedTextField(
                    value = nombre,
                    onValueChange = { nombre = it },
                    label = { Text("¿Cómo te llamamos?") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = sexo == "hombre", onClick = { sexo = "hombre" }, label = { Text("Hombre") })
                    FilterChip(selected = sexo == "mujer", onClick = { sexo = "mujer" }, label = { Text("Mujer") })
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = altura,
                        onValueChange = { altura = it.filter { c -> c.isDigit() } },
                        label = { Text("Altura (cm)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = peso,
                        onValueChange = { peso = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Peso (kg)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf("recomposicion" to "Recomp.", "perder" to "Perder grasa", "musculo" to "Músculo", "fuerza" to "Fuerza", "salud" to "Salud").forEach { (k, lbl) ->
                        FilterChip(selected = objetivo == k, onClick = { objetivo = k }, label = { Text(lbl) })
                    }
                }
                Spacer(Modifier.height(6.dp))
                BotonPrincipal(
                    texto = "Entrar en JowyFit",
                    onClick = {
                        val alt = altura.toDoubleOrNull()?.coerceIn(120.0, 230.0) ?: 175.0
                        val kg = peso.replace(',', '.').toDoubleOrNull()?.takeIf { it in 20.0..350.0 }
                        alCompletarAlta(nombre, sexo, alt, kg, objetivo)
                    },
                )
                BotonSecundario(texto = "Volver", onClick = { pasoAlta = false })
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
