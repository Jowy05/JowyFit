package com.jowy05.jowyfit.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.Backup
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.FileUpload
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material.icons.rounded.TableChart
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.Widgets
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jowy05.jowyfit.BuildConfig
import com.jowy05.jowyfit.datos.EscalaLetra
import com.jowy05.jowyfit.datos.IdiomaApp
import com.jowy05.jowyfit.datos.PreferenciaTema
import com.jowy05.jowyfit.datos.PreferenciasVisuales
import com.jowy05.jowyfit.ui.EstadoPrincipal
import com.jowy05.jowyfit.ui.componentes.CabeceraPantalla
import com.jowy05.jowyfit.ui.componentes.EtiquetaSeccionGrupo
import com.jowy05.jowyfit.ui.componentes.FilaInterruptor
import com.jowy05.jowyfit.ui.componentes.FilaLista
import com.jowy05.jowyfit.ui.componentes.ListaAgrupada
import com.jowy05.jowyfit.ui.componentes.NotaAviso
import com.jowy05.jowyfit.ui.componentes.SeparadorLista
import com.jowy05.jowyfit.ui.componentes.Tarjeta
import com.jowy05.jowyfit.ui.componentes.TonoNota
import com.jowy05.jowyfit.ui.i18n.t
import com.jowy05.jowyfit.ui.tema.LocalPaleta

@Composable
fun PantallaAjustes(
    estado: EstadoPrincipal,
    prefs: PreferenciasVisuales,
    totalEjercicios: Int,
    alVolver: () -> Unit,
    alCambiarTema: (PreferenciaTema) -> Unit,
    alCambiarLetra: (EscalaLetra) -> Unit,
    alCambiarIdioma: (IdiomaApp) -> Unit,
    alToggleMostrarKcal: (Boolean) -> Unit,
    alToggleRecordatorioPasos: (Boolean) -> Unit,
    alToggleCopiaAuto: (Boolean) -> Unit,
    alToggleEntrenosHC: (Boolean) -> Unit,
    alImportarCopia: () -> Unit,
    alExportarCopia: () -> Unit,
    alExportarCsvEntrenos: () -> Unit,
    alExportarCsvComidas: () -> Unit,
    alExportarCsvMedidas: () -> Unit,
    alExportarJsonLigero: () -> Unit,
    alGenerarPdf: () -> Unit,
    alAbrirActualizaciones: () -> Unit,
    alProbarDescanso: () -> Unit,
    alBorrarTodo: () -> Unit,
) {
    val p = LocalPaleta.current
    var confirmarBorrado by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState()),
    ) {
        CabeceraPantalla(
            crumb = t("Perfil"),
            titulo = t("Ajustes"),
            alVolver = alVolver,
        )

        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            EtiquetaSeccionGrupo(t("Apariencia e idioma"))
            Tarjeta {
                Text(t("Tema"), color = p.ink, fontSize = 15.5.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        PreferenciaTema.SISTEMA to t("Sistema"),
                        PreferenciaTema.CLARO to t("Claro"),
                        PreferenciaTema.OSCURO to t("Oscuro"),
                    ).forEach { (v, lbl) ->
                        FilterChip(selected = prefs.tema == v, onClick = { alCambiarTema(v) }, label = { Text(lbl) })
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text(t("Tamaño de letra"), color = p.ink, fontSize = 15.5.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = prefs.letra == EscalaLetra.NORMAL, onClick = { alCambiarLetra(EscalaLetra.NORMAL) }, label = { Text(t("Normal")) })
                    FilterChip(selected = prefs.letra == EscalaLetra.GRANDE, onClick = { alCambiarLetra(EscalaLetra.GRANDE) }, label = { Text("Aa ${t("Grande")}") })
                }

                Spacer(Modifier.height(12.dp))
                Text(t("Idioma"), color = p.ink, fontSize = 15.5.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IdiomaApp.entries.forEach { lang ->
                        FilterChip(
                            selected = prefs.idioma == lang,
                            onClick = { alCambiarIdioma(lang) },
                            label = { Text(lang.nombreNativo) },
                        )
                    }
                }
            }

            EtiquetaSeccionGrupo("Funciones nativas Android")
            ListaAgrupada {
                FilaInterruptor(
                    titulo = "Mostrar calorías",
                    subtitulo = "La proteína se muestra siempre",
                    icono = Icons.Rounded.Palette,
                    activo = estado.ajustes.mostrarKcal,
                    onCambio = alToggleMostrarKcal,
                )
                SeparadorLista()
                FilaInterruptor(
                    titulo = "Recordatorio inteligente de pasos",
                    subtitulo = "Solo avisa a las 18:00 si llevas < 50 % del objetivo (WorkManager)",
                    icono = Icons.AutoMirrored.Rounded.DirectionsWalk,
                    activo = estado.ajustes.noti.pasos == true,
                    onCambio = alToggleRecordatorioPasos,
                )
                SeparadorLista()
                FilaInterruptor(
                    titulo = "Copia automática semanal",
                    subtitulo = "Guarda copias locales en segundo plano con WorkManager",
                    icono = Icons.Rounded.Backup,
                    activo = estado.ajustes.copiaAuto,
                    onCambio = alToggleCopiaAuto,
                )
                SeparadorLista()
                FilaInterruptor(
                    titulo = "Escribir entrenos en Health Connect",
                    subtitulo = "Publica cada sesión completada en Salud de Android",
                    icono = Icons.Rounded.Sync,
                    activo = estado.ajustes.entrenosASalud == true,
                    onCambio = alToggleEntrenosHC,
                )
                SeparadorLista()
                FilaLista(
                    titulo = t("Descanso interactivo (prueba)"),
                    subtitulo = "Lanza 45 s en pantalla bloqueada con botones +30 s y Saltar",
                    icono = Icons.Rounded.Timer,
                    alPulsar = alProbarDescanso,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Widget «JowyFit · Hoy»",
                    subtitulo = "Mantén pulsado el escritorio del móvil → Widgets → JowyFit",
                    icono = Icons.Rounded.Widgets,
                )
            }

            EtiquetaSeccionGrupo(t("Datos y copias"))
            ListaAgrupada {
                FilaLista(
                    titulo = "Informe completo en PDF",
                    subtitulo = "Resumen A4 multipágina para compartir o imprimir",
                    icono = Icons.Rounded.PictureAsPdf,
                    alPulsar = alGenerarPdf,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Importar copia (.jowyfit)",
                    subtitulo = "Compatible con copias V1–V7 (sin contraseña o cifradas)",
                    icono = Icons.Rounded.FileUpload,
                    alPulsar = alImportarCopia,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Exportar copia (.jowyfit)",
                    subtitulo = "Guarda una copia completa V7 en tu teléfono",
                    icono = Icons.Rounded.Save,
                    alPulsar = alExportarCopia,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Exportar CSV · Entrenos",
                    subtitulo = "Excel / Sheets (UTF-8 BOM, protección anti-fórmulas)",
                    icono = Icons.Rounded.TableChart,
                    alPulsar = alExportarCsvEntrenos,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Exportar CSV · Comidas",
                    subtitulo = "Historial diario de comidas, proteína, kcal y macros",
                    icono = Icons.Rounded.TableChart,
                    alPulsar = alExportarCsvComidas,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Exportar CSV · Medidas",
                    subtitulo = "Peso, perímetros y datos de báscula",
                    icono = Icons.Rounded.TableChart,
                    alPulsar = alExportarCsvMedidas,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Exportar JSON ligero",
                    subtitulo = "Todos tus datos legibles sin fotos ni binarios",
                    icono = Icons.Rounded.Code,
                    alPulsar = alExportarJsonLigero,
                )
            }

            EtiquetaSeccionGrupo("Ayuda y actualizaciones")
            ListaAgrupada {
                FilaLista(
                    titulo = t("Buscar actualizaciones"),
                    subtitulo = "Versión ${BuildConfig.VERSION_NAME} · descarga verificada con SHA-256",
                    icono = Icons.Rounded.SystemUpdate,
                    alPulsar = alAbrirActualizaciones,
                )
                SeparadorLista()
                FilaLista(
                    titulo = "Privacidad y local",
                    subtitulo = "Todo se guarda en SQLite (Room) en este teléfono. Sin cuentas ni nube.",
                    icono = Icons.Rounded.Info,
                )
            }

            Spacer(Modifier.height(14.dp))
            ListaAgrupada {
                FilaLista(
                    titulo = "Borrar todos los datos",
                    subtitulo = "Deja la app como recién instalada",
                    icono = Icons.Rounded.DeleteForever,
                    peligro = true,
                    alPulsar = { confirmarBorrado = true },
                )
            }

            Spacer(Modifier.height(14.dp))
            NotaAviso(
                texto = "JowyFit Kotlin Nativo (Fases 1–5 completas). Coexiste en paralelo con tu JowyFit actual sin tocar sus datos.",
                tono = TonoNota.INFO,
                icono = Icons.Rounded.Download,
            )

            Spacer(Modifier.height(14.dp))
            Text(
                text = "JowyFit ${BuildConfig.VERSION_NAME} · $totalEjercicios ejercicios",
                color = p.muted,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(112.dp))
        }
    }

    if (confirmarBorrado) {
        AlertDialog(
            onDismissRequest = { confirmarBorrado = false },
            title = { Text("¿Borrar todos los datos?") },
            text = { Text("Se borrarán el perfil, entrenos, comidas, medidas y retos de JowyFit Kotlin. No se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = { confirmarBorrado = false; alBorrarTodo() }) {
                    Text("Borrar todo", color = p.bad)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmarBorrado = false }) { Text("Cancelar") }
            },
        )
    }
}
