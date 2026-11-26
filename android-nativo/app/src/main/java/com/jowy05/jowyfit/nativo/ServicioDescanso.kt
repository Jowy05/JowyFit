package com.jowy05.jowyfit.nativo

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.jowy05.jowyfit.MainActivity
import com.jowy05.jowyfit.R
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Servicio interactivo nativo del descanso entre series:
 * - Cuenta atrás real en la notificación y pantalla de bloqueo (setAlarmClock + ForegroundService).
 * - Botones directos en la notificación: «+30 s» y «Saltar» sin tener que desbloquear ni abrir la app.
 */
class ServicioDescanso : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACCION_SALTAR -> {
                _eventoNotificacion.value = System.currentTimeMillis() to 0L
                cancelarTodo(this)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACCION_MAS_30 -> {
                val ahora = System.currentTimeMillis()
                val actual = hastaActualMs.coerceAtLeast(ahora)
                val nuevo = (actual + 30_000L).coerceAtMost(ahora + MAX_DESCANSO_MS)
                val titulo = tituloActual.ifBlank { "Descansando" }
                val texto = textoActual.ifBlank { "Siguiente serie" }
                _eventoNotificacion.value = ahora to nuevo
                iniciarOActualizar(nuevo, titulo, texto)
                return START_NOT_STICKY
            }
            else -> {
                val ahora = System.currentTimeMillis()
                val hastaRaw = intent?.getLongExtra(EXTRA_HASTA, 0L) ?: 0L
                if (hastaRaw <= ahora) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    return START_NOT_STICKY
                }
                val hasta = hastaRaw.coerceAtMost(ahora + MAX_DESCANSO_MS)
                val titulo = intent?.getStringExtra(EXTRA_TITULO).orEmpty().take(80).ifBlank { "Descansando" }
                val texto = intent?.getStringExtra(EXTRA_TEXTO).orEmpty().take(120).ifBlank { "Siguiente serie" }
                iniciarOActualizar(hasta, titulo, texto)
                return START_NOT_STICKY
            }
        }
    }

    private fun iniciarOActualizar(hastaMs: Long, titulo: String, texto: String) {
        hastaActualMs = hastaMs
        tituloActual = titulo
        textoActual = texto
        crearCanales(this)
        programarAlarmaFin(this, hastaMs, titulo, texto)
        val noti = construirNotificacionEnCurso(this, hastaMs, titulo, texto)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_CURSO, noti, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ID_CURSO, noti)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val CANAL_CURSO = "descanso_curso_nativo"
        const val CANAL_FIN = "descanso_fin_nativo"
        const val ID_CURSO = 9101
        const val ID_FIN = 9102
        const val COLOR_MORADO = 0xFF7F26FB.toInt()
        private const val MAX_DESCANSO_SEG = 3600
        private const val MAX_DESCANSO_MS = MAX_DESCANSO_SEG * 1000L

        const val ACCION_INICIAR = "com.jowy05.jowyfit.DESCANSO_INICIAR"
        const val ACCION_MAS_30 = "com.jowy05.jowyfit.DESCANSO_MAS_30"
        const val ACCION_SALTAR = "com.jowy05.jowyfit.DESCANSO_SALTAR"
        const val ACCION_FIN = "com.jowy05.jowyfit.DESCANSO_FIN"

        const val EXTRA_HASTA = "hasta"
        const val EXTRA_TITULO = "titulo"
        const val EXTRA_TEXTO = "texto"

        @Volatile var hastaActualMs: Long = 0L
        @Volatile var tituloActual: String = ""
        @Volatile var textoActual: String = ""

        /** Emite (timestampEvento, nuevoHastaMs) cuando el usuario pulsa +30 s o Saltar desde la notificación. */
        private val _eventoNotificacion = MutableStateFlow<Pair<Long, Long>?>(null)
        val eventoNotificacion: StateFlow<Pair<Long, Long>?> = _eventoNotificacion.asStateFlow()

        fun iniciar(context: Context, segundos: Int, titulo: String = "Descansando", texto: String = "Siguiente serie") {
            val seg = segundos.coerceIn(1, MAX_DESCANSO_SEG)
            val hasta = System.currentTimeMillis() + seg * 1000L
            val i = Intent(context, ServicioDescanso::class.java).apply {
                action = ACCION_INICIAR
                putExtra(EXTRA_HASTA, hasta)
                putExtra(EXTRA_TITULO, titulo.take(80))
                putExtra(EXTRA_TEXTO, texto.take(120))
            }
            context.startForegroundService(i)
        }

        fun cancelarTodo(context: Context) {
            hastaActualMs = 0L
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.cancel(pendingFin(context, "", ""))
            NotificationManagerCompat.from(context).cancel(ID_CURSO)
            NotificationManagerCompat.from(context).cancel(ID_FIN)
            context.stopService(Intent(context, ServicioDescanso::class.java))
        }

        fun crearCanales(context: Context) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CANAL_CURSO) == null) {
                val curso = NotificationChannel(CANAL_CURSO, "Cuenta atrás de descanso", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Muestra el tiempo restante y los botones +30 s y Saltar"
                    setSound(null, null)
                    enableVibration(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                nm.createNotificationChannel(curso)
            }
            if (nm.getNotificationChannel(CANAL_FIN) == null) {
                val sonido = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val fin = NotificationChannel(CANAL_FIN, "Fin del descanso", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Avisa cuando toca la siguiente serie"
                    enableVibration(true)
                    setSound(
                        sonido,
                        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build(),
                    )
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                nm.createNotificationChannel(fin)
            }
        }

        private fun abrirApp(context: Context): PendingIntent {
            val i = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(context, 1, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun pendingAccion(context: Context, accion: String, code: Int): PendingIntent {
            val i = Intent(context, ServicioDescanso::class.java).apply { action = accion }
            return PendingIntent.getService(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun pendingFin(context: Context, titulo: String, texto: String): PendingIntent {
            val i = Intent(context, ReceptorDescanso::class.java).apply {
                action = ACCION_FIN
                putExtra(EXTRA_TITULO, titulo)
                putExtra(EXTRA_TEXTO, texto)
            }
            return PendingIntent.getBroadcast(context, ID_FIN, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun programarAlarmaFin(context: Context, hastaMs: Long, titulo: String, texto: String) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = pendingFin(context, titulo, texto)
            am.cancel(pi)
            val exacta = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
            if (exacta) {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(hastaMs, abrirApp(context)), pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, hastaMs, pi)
            }
        }

        private fun construirNotificacionEnCurso(context: Context, hastaMs: Long, titulo: String, texto: String): Notification =
            NotificationCompat.Builder(context, CANAL_CURSO)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setColor(COLOR_MORADO)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setWhen(hastaMs)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(abrirApp(context))
                .addAction(0, "+30 s", pendingAccion(context, ACCION_MAS_30, 21))
                .addAction(0, "Saltar", pendingAccion(context, ACCION_SALTAR, 22))
                .build()
    }
}

class ReceptorDescanso : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ServicioDescanso.crearCanales(context)
        ServicioDescanso.hastaActualMs = 0L
        context.stopService(Intent(context, ServicioDescanso::class.java))

        // Enciende brevemente la pantalla al terminar el descanso.
        runCatching {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            val wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "jowyfit:fin_descanso",
            )
            wl.acquire(5_000L)
        }

        val texto = intent.getStringExtra(ServicioDescanso.EXTRA_TEXTO).orEmpty().ifBlank { "Toca la siguiente serie" }
        val abrir = PendingIntent.getActivity(
            context,
            2,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val noti = NotificationCompat.Builder(context, ServicioDescanso.CANAL_FIN)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setColor(ServicioDescanso.COLOR_MORADO)
            .setContentTitle("Descanso terminado")
            .setContentText(texto)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(abrir)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(ServicioDescanso.ID_FIN, noti)
        }
    }
}
