package com.jowy05.jowyfit.nativo

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.jowy05.jowyfit.datos.catalogo.CatalogoCargado
import com.jowy05.jowyfit.dominio.CalculosDominio
import com.jowy05.jowyfit.dominio.MetasDominio
import com.jowy05.jowyfit.dominio.PesosYDiscos
import com.jowy05.jowyfit.dominio.Progresion
import com.jowy05.jowyfit.dominio.RetosDominio
import com.jowy05.jowyfit.dominio.SaludYRevisionDominio
import com.jowy05.jowyfit.dominio.TendenciasDominio
import com.jowy05.jowyfit.ui.EstadoPrincipal
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import kotlin.math.roundToInt

/**
 * Generador nativo de Informe en PDF A4 multipágina usando `android.graphics.pdf.PdfDocument`.
 * Incluye resumen, entrenos/récords/estancados, retos 3D, nutrición, cuerpo/metas y rutina/salud.
 */
object GeneradorPdfNativo {

    private const val ANCHO = 595
    private const val ALTO = 842
    private const val MARGEN = 36f
    private const val LIMITE_Y = 790f

    fun generarArchivo(context: Context, estado: EstadoPrincipal, catalogo: CatalogoCargado?): File {
        val doc = PdfDocument()
        val hoy = LocalDate.now()
        val hoyIso = hoy.toString()
        val hace28 = hoy.minusDays(27).toString()

        val pTitulo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; textSize = 20f; typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        val pSubBlanco = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E9D5FF"); textSize = 11f
        }
        val pSeccion = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#5815BA"); textSize = 14f; typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        val pCuerpo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#18181B"); textSize = 10.5f
        }
        val pNegrita = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#18181B"); textSize = 10.5f; typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }
        val pMuted = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#6B7280"); textSize = 9.5f
        }
        val pBanda = Paint().apply { color = Color.parseColor("#5815BA") }
        val pLinea = Paint().apply { color = Color.parseColor("#E4E4E7"); strokeWidth = 1f }

        var numPagina = 0
        var page: PdfDocument.Page? = null
        var canvas: Canvas? = null
        var y = 0f

        fun abrirPagina(portada: Boolean = false) {
            page?.let { doc.finishPage(it) }
            numPagina++
            page = doc.startPage(PdfDocument.PageInfo.Builder(ANCHO, ALTO, numPagina).create())
            canvas = page!!.canvas
            if (portada) {
                canvas!!.drawRect(0f, 0f, ANCHO.toFloat(), 86f, pBanda)
                canvas!!.drawText("JowyFit · Informe de progreso", MARGEN, 40f, pTitulo)
                val usuario = estado.perfil.nombre.ifBlank { "Usuario" }
                canvas!!.drawText("$usuario · Generado el $hoyIso (últimos 28 días)", MARGEN, 64f, pSubBlanco)
                y = 110f
            } else {
                canvas!!.drawText("JowyFit · Informe ($hoyIso) · pág. $numPagina", MARGEN, 28f, pMuted)
                canvas!!.drawLine(MARGEN, 36f, ANCHO - MARGEN, 36f, pLinea)
                y = 56f
            }
        }

        fun asegurarEspacio(altura: Float) {
            if (y + altura > LIMITE_Y) abrirPagina(portada = false)
        }

        fun seccion(titulo: String) {
            asegurarEspacio(32f)
            y += 8f
            canvas!!.drawText(titulo, MARGEN, y, pSeccion)
            y += 6f
            canvas!!.drawLine(MARGEN, y, ANCHO - MARGEN, y, pLinea)
            y += 16f
        }

        fun linea(texto: String, negrita: Boolean = false, sangria: Float = 0f) {
            asegurarEspacio(16f)
            canvas!!.drawText(texto.take(96), MARGEN + sangria, y, if (negrita) pNegrita else pCuerpo)
            y += 15f
        }

        abrirPagina(portada = true)

        // 1. Resumen general
        val energia = CalculosDominio.calcularObjetivos(estado.perfil, estado.ultimoPeso, estado.ajustes.kcalManual, estado.ajustes.proteinaManual)
        val ses28 = estado.sesiones.filter { it.estado == "hecha" && it.fecha >= hace28 }
        val vol28 = ses28.sumOf { s -> s.ejercicios.sumOf { e -> Progresion.volumen(e.series) } }.roundToInt()
        val comidas28 = estado.comidas.filter { it.fecha >= hace28 }
        val diasCom = comidas28.map { it.fecha }.distinct().size
        val protMedia = if (diasCom > 0) (comidas28.sumOf { it.proteina } / diasCom).roundToInt() else 0
        val pasos28 = estado.pasos.filter { it.fecha >= hace28 && it.pasos > 0 }
        val pasosMedia = if (pasos28.isNotEmpty()) pasos28.map { it.pasos }.average().roundToInt() else 0

        seccion("1. Resumen del periodo (28 días)")
        linea("Entrenos completados: ${ses28.size} · Volumen acumulado: $vol28 kg", negrita = true)
        linea("Proteína media: $protMedia g/día (objetivo ${energia.proteina} g)" +
            if (estado.ajustes.mostrarKcal) " · Objetivo kcal: ~${energia.kcal} kcal" else " · Calorías ocultas")
        linea("Pasos medios: $pasosMedia / ${estado.perfil.pasosObjetivo} pasos al día")
        val saludTxt = SaludYRevisionDominio.resumenSalud(estado.perfil)
        if (saludTxt.isNotBlank()) linea("Salud y molestias: $saludTxt")
        if (estado.perfil.sueno == "poco") linea("Sueño: poco → esfuerzo limitado a RPE 7,5")

        // 2. Fuerza, récords y estancamiento
        seccion("2. Fuerza, récords y estancamiento")
        val recs = TendenciasDominio.logros(estado.sesiones).take(8)
        if (recs.isEmpty()) {
            linea("Sin récords registrados todavía.")
        } else {
            linea("Últimos récords personales:", negrita = true)
            recs.forEach { r ->
                linea("• ${r.fecha} · ${catalogo?.nombreEjercicio(r.ejercicio) ?: r.ejercicio}: ${r.peso} kg × ${r.reps}", sangria = 8f)
            }
        }
        val estancados = TendenciasDominio.ejerciciosEstancados(estado.sesiones)
        if (estancados.isNotEmpty()) {
            linea("Ejercicios estancados (3+ sesiones sin subir 1RM):", negrita = true)
            estancados.forEach { e ->
                linea("• ${catalogo?.nombreEjercicio(e.ejercicio) ?: e.ejercicio} (${e.peso} kg)", sangria = 8f)
            }
        }
        val lunes = CalculosDominio.lunesDe(hoy)
        val diasSem = (0L..6L).map { lunes.plusDays(it).toString() }.toSet()
        val grupos = TendenciasDominio.seriesPorGrupo(estado.sesiones, diasSem) { id ->
            catalogo?.porId?.get(id)?.let { PesosYDiscos.patron(it) }
        }
        linea("Series esta semana: " + grupos.joinToString(" · ") { "${it.nombre} ${it.series}" })

        // 3. Retos diarios 3D
        seccion("3. Retos diarios")
        val racha = RetosDominio.racha(estado.retos, hoyIso)
        linea("Intentos totales: ${estado.retos.size} · Racha actual: ${racha.actual} días (mejor: ${racha.mejor})")
        RetosDominio.RETOS.forEach { def ->
            val mejor = RetosDominio.mejorMarca(estado.retos, def.id)
            if (mejor != null) {
                linea("• ${def.titulo}: ${RetosDominio.textoMarca(mejor.valor, def.modo)} (${mejor.fecha.take(10)})", sangria = 8f)
            }
        }

        // 4. Cuerpo y Metas
        seccion("4. Cuerpo y Metas")
        val tend = TendenciasDominio.tendenciaPeso(estado.mediciones, hoyIso)
        val grasa = TendenciasDominio.grasaActual(estado.mediciones, estado.perfil, hoyIso)
        val cintura = TendenciasDominio.ultimoValor(estado.mediciones, { it.perimetros?.cintura })
        linea(
            "Último peso: ${estado.ultimoPeso?.let { "$it kg" } ?: "—"}" +
                (tend.kgSemana?.let { " (${if (it > 0) "+" else ""}$it kg/sem)" } ?: "") +
                " · % Grasa: ${grasa?.let { "${it.valor}% (${it.fuente})" } ?: "—"}" +
                " · Cintura: ${cintura?.let { "${it.valor} cm" } ?: "—"}",
        )
        if (estado.metas.isNotEmpty()) {
            linea("Metas activas:", negrita = true)
            estado.metas.forEach { m ->
                val act = MetasDominio.valorActual(m, estado.mediciones, estado.sesiones, estado.perfil, hoyIso) { catalogo?.nombreEjercicio(it) ?: it }
                val st = MetasDominio.estado(m, act)
                val ultNota = m.historial.orEmpty().lastOrNull { !it.nota.isNullOrBlank() }?.nota
                val sufNota = if (ultNota != null) " · Nota: $ultNota" else ""
                linea("• ${m.titulo}: ${act ?: "—"} / ${m.objetivo} ${m.unidad} (${(st.progreso * 100).roundToInt()}%)$sufNota", sangria = 8f)
            }
        }

        // 5. Rutina y plantillas libres
        seccion("5. Tu rutina actual")
        val rut = estado.rutinaActiva
        if (rut == null) {
            linea("Sin rutina activa todavía.")
        } else {
            linea("Estructura: ${rut.estructura.ifBlank { "${rut.dias.size} días" }}", negrita = true)
            rut.dias.forEach { d ->
                val ejs = d.bloques.joinToString(", ") { b -> catalogo?.nombreEjercicio(b.ejercicio) ?: b.ejercicio }
                linea("• Día ${d.letra} (${d.nombre}): $ejs", sangria = 8f)
            }
        }
        val libres = estado.ajustes.entrenosLibres.orEmpty()
        if (libres.isNotEmpty()) {
            linea("Plantillas de entreno libre: ${libres.joinToString(", ") { "${it.nombre} (${it.ejercicios.size} ej.)" }}")
        }

        page?.let { doc.finishPage(it) }

        val dir = File(context.cacheDir, "informes").apply { mkdirs() }
        val salida = File(dir, "JowyFit-Informe-$hoyIso.pdf")
        FileOutputStream(salida).use { doc.writeTo(it) }
        doc.close()
        return salida
    }

    fun compartirPdf(context: Context, archivo: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", archivo)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, archivo.nameWithoutExtension)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Compartir informe PDF").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
