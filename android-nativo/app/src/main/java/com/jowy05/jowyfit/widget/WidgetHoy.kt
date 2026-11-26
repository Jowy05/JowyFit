package com.jowy05.jowyfit.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.jowy05.jowyfit.MainActivity
import com.jowy05.jowyfit.datos.RepositorioJowyFit

/** Widget nativo Glance de pantalla de inicio: entreno de hoy, proteína y pasos. */
class WidgetHoy : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val repo = RepositorioJowyFit(context)
        val (entreno, proteina, pasos) = runCatching { repo.resumenParaWidget() }
            .getOrDefault(Triple("JowyFit", "— g", "—"))

        provideContent {
            val bg = ColorProvider(Color(0xFF1A1428))
            val accent = ColorProvider(Color(0xFF9B5BFF))
            val ink = ColorProvider(Color(0xFFEEE9F8))
            val muted = ColorProvider(Color(0xFFA598BF))
            val card = ColorProvider(Color(0xFF251C38))

            Column(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .cornerRadius(18.dp)
                    .background(bg)
                    .clickable(actionStartActivity<MainActivity>())
                    .padding(14.dp),
            ) {
                Text(
                    text = "JOWYFIT · HOY",
                    style = TextStyle(color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold),
                )
                Spacer(GlanceModifier.height(4.dp))
                Text(
                    text = entreno,
                    style = TextStyle(color = ink, fontSize = 17.sp, fontWeight = FontWeight.Bold),
                    maxLines = 1,
                )
                Spacer(GlanceModifier.height(10.dp))
                Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(
                        modifier = GlanceModifier
                            .defaultWeight()
                            .cornerRadius(10.dp)
                            .background(card)
                            .padding(8.dp),
                    ) {
                        Text("PROTEÍNA", style = TextStyle(color = muted, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                        Text(proteina, style = TextStyle(color = ink, fontSize = 14.sp, fontWeight = FontWeight.Bold))
                    }
                    Spacer(GlanceModifier.width(8.dp))
                    Column(
                        modifier = GlanceModifier
                            .defaultWeight()
                            .cornerRadius(10.dp)
                            .background(card)
                            .padding(8.dp),
                    ) {
                        Text("PASOS", style = TextStyle(color = muted, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                        Text(pasos, style = TextStyle(color = ink, fontSize = 14.sp, fontWeight = FontWeight.Bold))
                    }
                }
            }
        }
    }
}

class WidgetHoyReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = WidgetHoy()
}
