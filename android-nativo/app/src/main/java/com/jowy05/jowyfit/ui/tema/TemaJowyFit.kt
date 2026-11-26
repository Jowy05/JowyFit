package com.jowy05.jowyfit.ui.tema

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.R
import com.jowy05.jowyfit.datos.EscalaLetra
import com.jowy05.jowyfit.datos.PreferenciaTema

/** Paleta 1:1 con src/ui/estilos/tokens.css (claro y oscuro violeta del icono). */
@Immutable
data class PaletaJowyFit(
    val oscuro: Boolean,
    val bg: Color,
    val surface: Color,
    val raised: Color,
    val line: Color,
    val ink: Color,
    val muted: Color,
    val blue: Color,
    val go: Color,
    val onGo: Color,
    val ok: Color,
    val warn: Color,
    val bad: Color,
    val gold: Color,
    val blueT: Color,
    val goT: Color,
    val okT: Color,
    val warnT: Color,
    val badT: Color,
    val goldT: Color,
    val th: Color,
    val hdTop: Color,
    val hdMid: Color,
    val dockBg: Color,
    val toastBg: Color,
    val toastFg: Color,
    val toastAct: Color,
)

val PaletaClara = PaletaJowyFit(
    oscuro = false,
    bg = Color(0xFFF2F4F7),
    surface = Color(0xFFFFFFFF),
    raised = Color(0xFFE8ECF1),
    line = Color(0xFFD9E0E8),
    ink = Color(0xFF16202B),
    muted = Color(0xFF566779),
    blue = Color(0xFF0A74B9),
    go = Color(0xFF7F26FB),
    onGo = Color(0xFFFFFFFF),
    ok = Color(0xFF3F8F1E),
    warn = Color(0xFFB7790B),
    bad = Color(0xFFC93A32),
    gold = Color(0xFFA97D12),
    blueT = Color(0x1A0A74B9),
    goT = Color(0x1C7F26FB),
    okT = Color(0x1C3F8F1E),
    warnT = Color(0x21B7790B),
    badT = Color(0x1AC93A32),
    goldT = Color(0x21A97D12),
    th = Color(0xFF2F6EA8),
    hdTop = Color(0xFFD3E5F3),
    hdMid = Color(0xFFE6EEF5),
    dockBg = Color(0xE8FFFFFF),
    toastBg = Color(0xFF16202B),
    toastFg = Color(0xFFF2F4F7),
    toastAct = Color(0xFFB78CFF),
)

val PaletaOscura = PaletaJowyFit(
    oscuro = true,
    bg = Color(0xFF110C1B),
    surface = Color(0xFF1A1428),
    raised = Color(0xFF251C38),
    line = Color(0xFF3A2D52),
    ink = Color(0xFFEEE9F8),
    muted = Color(0xFFA598BF),
    blue = Color(0xFFBDA0FF),
    go = Color(0xFF9B5BFF),
    onGo = Color(0xFFFFFFFF),
    ok = Color(0xFF7CC242),
    warn = Color(0xFFF2B233),
    bad = Color(0xFFE5534B),
    gold = Color(0xFFE8C266),
    blueT = Color(0x24BDA0FF),
    goT = Color(0x299B5BFF),
    okT = Color(0x247CC242),
    warnT = Color(0x24F2B233),
    badT = Color(0x26E5534B),
    goldT = Color(0x21E8C266),
    th = Color(0xFF5B2DB0),
    hdTop = Color(0xFF3A1477),
    hdMid = Color(0xFF22163A),
    dockBg = Color(0xE01A1428),
    toastBg = Color(0xFF2C2241),
    toastFg = Color(0xFFEEE9F8),
    toastAct = Color(0xFFBDA0FF),
)

val LocalPaleta = staticCompositionLocalOf { PaletaClara }

val FuenteCuerpo = FontFamily(
    Font(R.font.barlow_regular, FontWeight.Normal),
    Font(R.font.barlow_medium, FontWeight.Medium),
    Font(R.font.barlow_semibold, FontWeight.SemiBold),
    Font(R.font.barlow_bold, FontWeight.Bold),
)

val FuenteTitulo = FontFamily(
    Font(R.font.barlow_semi_condensed_semibold, FontWeight.SemiBold),
    Font(R.font.barlow_semi_condensed_bold, FontWeight.Bold),
)

val FuenteMono = FontFamily(
    Font(R.font.jetbrains_mono_medium, FontWeight.Medium),
    Font(R.font.jetbrains_mono_semibold, FontWeight.SemiBold),
    Font(R.font.jetbrains_mono_bold, FontWeight.Bold),
)

private val TipografiaJowyFit = Typography(
    displaySmall = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 36.sp),
    headlineLarge = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 33.sp),
    headlineMedium = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 27.sp),
    titleLarge = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = FuenteCuerpo, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = FuenteCuerpo, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 21.sp),
    bodyMedium = TextStyle(fontFamily = FuenteCuerpo, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 19.sp),
    bodySmall = TextStyle(fontFamily = FuenteCuerpo, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = FuenteTitulo, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 15.sp, letterSpacing = 0.9.sp),
    labelSmall = TextStyle(fontFamily = FuenteCuerpo, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, lineHeight = 13.sp),
)

@Composable
fun JowyFitTheme(
    preferenciaTema: PreferenciaTema = PreferenciaTema.SISTEMA,
    escalaLetra: EscalaLetra = EscalaLetra.NORMAL,
    content: @Composable () -> Unit,
) {
    val oscuro = when (preferenciaTema) {
        PreferenciaTema.SISTEMA -> isSystemInDarkTheme()
        PreferenciaTema.CLARO -> false
        PreferenciaTema.OSCURO -> true
    }
    val paleta = if (oscuro) PaletaOscura else PaletaClara
    val colorScheme = if (oscuro) {
        darkColorScheme(
            primary = paleta.go,
            onPrimary = paleta.onGo,
            secondary = paleta.blue,
            background = paleta.bg,
            onBackground = paleta.ink,
            surface = paleta.surface,
            onSurface = paleta.ink,
            surfaceVariant = paleta.raised,
            onSurfaceVariant = paleta.muted,
            outline = paleta.line,
            error = paleta.bad,
        )
    } else {
        lightColorScheme(
            primary = paleta.go,
            onPrimary = paleta.onGo,
            secondary = paleta.blue,
            background = paleta.bg,
            onBackground = paleta.ink,
            surface = paleta.surface,
            onSurface = paleta.ink,
            surfaceVariant = paleta.raised,
            onSurfaceVariant = paleta.muted,
            outline = paleta.line,
            error = paleta.bad,
        )
    }

    val densityActual = LocalDensity.current
    val factor = if (escalaLetra == EscalaLetra.GRANDE) 1.12f else 1.0f
    val densityAjustada = Density(density = densityActual.density, fontScale = densityActual.fontScale * factor)

    CompositionLocalProvider(
        LocalPaleta provides paleta,
        LocalDensity provides densityAjustada,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = TipografiaJowyFit,
            content = content,
        )
    }
}
