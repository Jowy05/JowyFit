package com.jowy05.jowyfit.nativo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.ui.componentes.BotonPrincipal
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.tema.FuenteCuerpo
import com.jowy05.jowyfit.ui.tema.FuenteTitulo
import com.jowy05.jowyfit.ui.tema.JowyFitTheme
import com.jowy05.jowyfit.ui.tema.LocalPaleta

/**
 * Pantalla de política de privacidad exigida por Health Connect en Android 13 y 14+
 * (`ACTION_SHOW_PERMISSIONS_RATIONALE` y `VIEW_PERMISSION_USAGE`). Sin ella, Android 14+
 * cierra automáticamente el diálogo de permisos sin preguntar al usuario.
 */
class ActividadPoliticaSalud : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            JowyFitTheme {
                val p = LocalPaleta.current
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(p.bg)
                        .statusBarsPadding()
                        .navigationBarsPadding()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        text = "JowyFit y Health Connect",
                        color = p.ink,
                        fontFamily = FuenteTitulo,
                        fontWeight = FontWeight.Bold,
                        fontSize = 28.sp,
                    )
                    Tarjeta {
                        Text(
                            text = "Qué datos usa JowyFit",
                            color = p.ink,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "• Lectura: pasos diarios, peso corporal y porcentaje de grasa para mostrarlos en tu seguimiento.\n" +
                                "• Escritura (opcional): sesiones de fuerza completadas y calorías estimadas.",
                            color = p.muted,
                            fontFamily = FuenteCuerpo,
                            fontSize = 14.5.sp,
                            lineHeight = 20.sp,
                        )
                    }
                    Tarjeta {
                        Text(
                            text = "100 % privado en tu móvil",
                            color = p.ink,
                            fontFamily = FuenteTitulo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "JowyFit no tiene cuentas ni servidores. Todos los datos leídos de Health Connect se guardan únicamente en la base de datos local de tu teléfono y nunca se envían a terceros.",
                            color = p.muted,
                            fontFamily = FuenteCuerpo,
                            fontSize = 14.5.sp,
                            lineHeight = 20.sp,
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    BotonPrincipal(texto = "Entendido", onClick = { finish() })
                }
            }
        }
    }
}
