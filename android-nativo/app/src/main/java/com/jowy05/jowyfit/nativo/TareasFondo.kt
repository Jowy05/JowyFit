package com.jowy05.jowyfit.nativo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.jowy05.jowyfit.MainActivity
import com.jowy05.jowyfit.R
import com.jowy05.jowyfit.datos.RepositorioJowyFit
import com.jowy05.jowyfit.datos.db.BaseJowyFit
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.util.concurrent.TimeUnit

/**
 * Recordatorio inteligente de pasos (WorkManager): solo notifica a partir de la hora elegida
 * si llevas menos del 50 % de tu objetivo diario; si ya superaste el 50 %, se queda en silencio.
 */
class WorkerRecordatorioPasos(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val dao = BaseJowyFit.obtener(applicationContext).registros()
        val ajustes = dao.leerUno("ajustes", "app")?.let {
            runCatching { JsonJowyFit.decodeFromString<Ajustes>(it.payloadJson) }.getOrNull()
        } ?: return Result.success()
        if (ajustes.noti.pasos != true) return Result.success()

        val partesHora = (ajustes.noti.pasosHora ?: "18:00").split(":")
        val horaObj = partesHora.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 18
        val minObj = partesHora.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
        val ahora = LocalTime.now()
        if (ahora.hour * 60 + ahora.minute < horaObj * 60 + minObj) return Result.success()

        val perfil = dao.leerUno("perfil", "yo")?.let {
            runCatching { JsonJowyFit.decodeFromString<Perfil>(it.payloadJson) }.getOrNull()
        } ?: Perfil()
        val hoy = LocalDate.now().toString()
        val pasosHoy = dao.leerUno("pasos", hoy)?.let {
            runCatching { JsonJowyFit.decodeFromString<PasosDia>(it.payloadJson) }.getOrNull()
        }?.pasos ?: 0

        if (pasosHoy * 2 >= perfil.pasosObjetivo) return Result.success()

        val prefs = applicationContext.getSharedPreferences("jowyfit_avisos", Context.MODE_PRIVATE)
        if (prefs.getString("ultimo_aviso_pasos", null) == hoy) return Result.success()
        prefs.edit().putString("ultimo_aviso_pasos", hoy).apply()

        val nm = applicationContext.getSystemService(NotificationManager::class.java) ?: return Result.success()
        nm.createNotificationChannel(
            NotificationChannel("jowyfit_recordatorios", "Recordatorios JowyFit", NotificationManager.IMPORTANCE_DEFAULT),
        )
        val abrir = PendingIntent.getActivity(
            applicationContext,
            9201,
            Intent(applicationContext, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val noti = NotificationCompat.Builder(applicationContext, "jowyfit_recordatorios")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("¿Damos un paseo corto?")
            .setContentText("Llevas $pasosHoy de ${perfil.pasosObjetivo} pasos hoy.")
            .setAutoCancel(true)
            .setContentIntent(abrir)
            .build()
        runCatching { nm.notify(9201, noti) }
        return Result.success()
    }
}

/** Copia automática semanal en el almacenamiento privado de la app (WorkManager). */
class WorkerCopiaAuto(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val repo = RepositorioJowyFit(applicationContext)
        val dao = BaseJowyFit.obtener(applicationContext).registros()
        val ajustes = dao.leerUno("ajustes", "app")?.let {
            runCatching { JsonJowyFit.decodeFromString<Ajustes>(it.payloadJson) }.getOrNull()
        } ?: return Result.success()
        if (!ajustes.copiaAuto) return Result.success()
        val perfil = dao.leerUno("perfil", "yo")?.let {
            runCatching { JsonJowyFit.decodeFromString<Perfil>(it.payloadJson) }.getOrNull()
        }
        if (perfil?.altaCompleta != true) return Result.success()

        runCatching {
            val bytes = repo.exportarCopia()
            if (bytes.size < 100) return@runCatching
            val dir = File(applicationContext.filesDir, "copias_auto").apply { mkdirs() }
            val existentes = dir.listFiles()?.filter { it.name.endsWith(".jowyfit") }?.sortedByDescending { it.name }.orEmpty()
            val tamUltima = existentes.firstOrNull()?.length() ?: 0L
            val tmp = File(dir, "jowyfit-auto-${LocalDate.now()}.tmp")
            val fichero = File(dir, "jowyfit-auto-${LocalDate.now()}.jowyfit")
            tmp.writeBytes(bytes)
            if (fichero.exists()) fichero.delete()
            if (!tmp.renameTo(fichero)) {
                tmp.copyTo(fichero, overwrite = true)
                tmp.delete()
            }
            // No borrar automáticas previas si la nueva ocupa menos de la mitad (protege contra pérdida accidental).
            if (bytes.size >= tamUltima / 2L) {
                val maxCopias = ajustes.copiasAuto.coerceIn(1, 20)
                dir.listFiles()?.filter { it.name.endsWith(".jowyfit") }?.sortedByDescending { it.name }?.drop(maxCopias)?.forEach { it.delete() }
            }
        }
        return Result.success()
    }
}

object GestorTareasFondo {
    private const val TRABAJO_PASOS = "jowyfit_recordatorio_pasos"
    private const val TRABAJO_COPIA = "jowyfit_copia_semanal"

    fun sincronizar(context: Context, ajustes: Ajustes) {
        val wm = WorkManager.getInstance(context)
        if (ajustes.noti.pasos == true) {
            val req = PeriodicWorkRequestBuilder<WorkerRecordatorioPasos>(2, TimeUnit.HOURS).build()
            wm.enqueueUniquePeriodicWork(TRABAJO_PASOS, ExistingPeriodicWorkPolicy.KEEP, req)
        } else {
            wm.cancelUniqueWork(TRABAJO_PASOS)
        }
        if (ajustes.copiaAuto) {
            val req = PeriodicWorkRequestBuilder<WorkerCopiaAuto>(7, TimeUnit.DAYS).build()
            wm.enqueueUniquePeriodicWork(TRABAJO_COPIA, ExistingPeriodicWorkPolicy.KEEP, req)
        } else {
            wm.cancelUniqueWork(TRABAJO_COPIA)
        }
    }
}
