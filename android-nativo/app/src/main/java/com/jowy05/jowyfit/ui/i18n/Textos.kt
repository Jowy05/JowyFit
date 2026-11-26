package com.jowy05.jowyfit.ui.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import com.jowy05.jowyfit.datos.IdiomaApp

val LocalIdioma = staticCompositionLocalOf { IdiomaApp.ES }

@Composable
fun t(es: String, vararg args: Pair<String, Any>): String {
    val idioma = LocalIdioma.current
    return traducir(idioma, es, *args)
}

fun traducir(idioma: IdiomaApp, es: String, vararg args: Pair<String, Any>): String {
    val base = when (idioma) {
        IdiomaApp.ES -> es
        IdiomaApp.CA -> DICCIONARIO_CA[es] ?: es
        IdiomaApp.EN -> DICCIONARIO_EN[es] ?: es
    }
    var out = base
    for ((k, v) in args) {
        out = out.replace("{$k}", v.toString())
    }
    return out
}

fun diasCortos(idioma: IdiomaApp): List<String> = when (idioma) {
    IdiomaApp.ES -> listOf("L", "M", "X", "J", "V", "S", "D")
    IdiomaApp.CA -> listOf("Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg")
    IdiomaApp.EN -> listOf("M", "T", "W", "T", "F", "S", "S")
}

fun diasAbrev(idioma: IdiomaApp): List<String> = when (idioma) {
    IdiomaApp.ES -> listOf("lun", "mar", "mié", "jue", "vie", "sáb", "dom")
    IdiomaApp.CA -> listOf("dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg.")
    IdiomaApp.EN -> listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
}

fun mesesCortos(idioma: IdiomaApp): List<String> = when (idioma) {
    IdiomaApp.ES -> listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
    IdiomaApp.CA -> listOf("gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des")
    IdiomaApp.EN -> listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
}

private val DICCIONARIO_CA = mapOf(
    "Inicio" to "Inici",
    "Rutina" to "Rutina",
    "Comida" to "Menjar",
    "Progreso" to "Progrés",
    "Perfil" to "Perfil",
    "Ajustes" to "Configuració",
    "Buenos días" to "Bon dia",
    "Buenas tardes" to "Bona tarda",
    "Buenas noches" to "Bona nit",
    "Hoy te toca" to "Avui et toca",
    "Hoy en números" to "Avui en números",
    "Proteína" to "Proteïna",
    "Calorías" to "Calories",
    "Pasos" to "Passos",
    "En reposo" to "En repòs",
    "Por ejercicio" to "Per exercici",
    "+ Comer o beber" to "+ Menjar o beure",
    "Escanear" to "Escanejar",
    "+ Peso" to "+ Pes",
    "Empezar rutina" to "Començar la rutina",
    "Ver mi plan" to "Veure el meu pla",
    "Hoy descansas." to "Avui descanses.",
    "Entreno de hoy hecho." to "Entrenament d'avui fet.",
    "Aún no tienes rutina" to "Encara no tens rutina",
    "Objetivo cumplido" to "Objectiu complert",
    "Faltan {n} g" to "Falten {n} g",
    "de {n}" to "de {n}",
    "kcal · orientativo" to "kcal · orientatiu",
    "Tus datos" to "Les teves dades",
    "Tus números" to "Els teus números",
    "Tu objetivo al día" to "El teu objectiu diari",
    "Ver más números" to "Veure més números",
    "Apariencia e idioma" to "Aparença i idioma",
    "Datos y copias" to "Dades i còpies",
    "Buscar actualizaciones" to "Buscar actualitzacions",
    "Nueva versión disponible" to "Nova versió disponible",
    "Actualizar" to "Actualitzar",
    "Créditos y aviso legal" to "Crèdits i avís legal",
    "Tamaño de letra" to "Mida de la lletra",
    "Normal" to "Normal",
    "Grande" to "Gran",
    "Tema" to "Tema",
    "Sistema" to "Sistema",
    "Claro" to "Clar",
    "Oscuro" to "Fosc",
    "Idioma" to "Idioma",
    "Tengo una copia" to "Tinc una còpia",
    "Empezar de cero" to "Començar de zero",
    "Guardar" to "Desar",
    "Cancelar" to "Cancel·lar",
    "Cerrar" to "Tancar",
    "Descanso interactivo (prueba)" to "Descans interactiu (prova)",
)

private val DICCIONARIO_EN = mapOf(
    "Inicio" to "Home",
    "Rutina" to "Routine",
    "Comida" to "Food",
    "Progreso" to "Progress",
    "Perfil" to "Profile",
    "Ajustes" to "Settings",
    "Buenos días" to "Good morning",
    "Buenas tardes" to "Good afternoon",
    "Buenas noches" to "Good evening",
    "Hoy te toca" to "Today's workout",
    "Hoy en números" to "Today in numbers",
    "Proteína" to "Protein",
    "Calorías" to "Calories",
    "Pasos" to "Steps",
    "En reposo" to "At rest",
    "Por ejercicio" to "From exercise",
    "+ Comer o beber" to "+ Eat or drink",
    "Escanear" to "Scan",
    "+ Peso" to "+ Weight",
    "Empezar rutina" to "Start workout",
    "Ver mi plan" to "See my plan",
    "Hoy descansas." to "Rest day today.",
    "Entreno de hoy hecho." to "Today's workout done.",
    "Aún no tienes rutina" to "No routine yet",
    "Objetivo cumplido" to "Goal reached",
    "Faltan {n} g" to "{n} g to go",
    "de {n}" to "of {n}",
    "kcal · orientativo" to "kcal · estimate",
    "Tus datos" to "Your info",
    "Tus números" to "Your numbers",
    "Tu objetivo al día" to "Your daily goal",
    "Ver más números" to "See more numbers",
    "Apariencia e idioma" to "Appearance & language",
    "Datos y copias" to "Data & backups",
    "Buscar actualizaciones" to "Check for updates",
    "Nueva versión disponible" to "New version available",
    "Actualizar" to "Update",
    "Créditos y aviso legal" to "Credits and legal notice",
    "Tamaño de letra" to "Text size",
    "Normal" to "Normal",
    "Grande" to "Large",
    "Tema" to "Theme",
    "Sistema" to "System",
    "Claro" to "Light",
    "Oscuro" to "Dark",
    "Idioma" to "Language",
    "Tengo una copia" to "I have a backup",
    "Empezar de cero" to "Start fresh",
    "Guardar" to "Save",
    "Cancelar" to "Cancel",
    "Cerrar" to "Close",
    "Descanso interactivo (prueba)" to "Interactive rest (test)",
)
