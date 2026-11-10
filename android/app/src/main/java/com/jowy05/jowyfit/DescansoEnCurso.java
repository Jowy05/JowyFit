package com.jowy05.jowyfit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Servicio en primer plano mientras dura el descanso, con la cuenta atrás en la notificación (también en la pantalla
 * de bloqueo). Con un servicio así el sistema no congela ni cierra la app al bloquear el móvil: en capas como la de
 * Nubia/RedMagic, sin él, la alarma de AvisoDescanso podía no llegar a FinDescanso. Lo para FinDescanso al acabar o
 * AvisoDescanso al cancelar.
 */
public class DescansoEnCurso extends Service {

    private static final int ID = 9002;
    private static final String CANAL = "descanso_curso";
    private static final String HASTA = "hasta";
    private static final String TITULO = "titulo";
    private static final String TEXTO = "texto";

    private final Handler reloj = new Handler(Looper.getMainLooper());

    /** Solo se puede arrancar con la app delante (al apuntar la serie o al volver a ella); si no, sigue solo la alarma. */
    static void empezar(Context c, long hasta, String titulo, String texto) {
        Intent i = new Intent(c, DescansoEnCurso.class).putExtra(HASTA, hasta).putExtra(TITULO, titulo).putExtra(TEXTO, texto);
        try {
            ContextCompat.startForegroundService(c, i);
        } catch (RuntimeException e) {
            // ForegroundServiceStartNotAllowedException (app en segundo plano): la alarma de reloj avisa igual.
        }
    }

    static void parar(Context c) {
        c.stopService(new Intent(c, DescansoEnCurso.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        long hasta = intent == null ? 0 : intent.getLongExtra(HASTA, 0);
        Notification n = notificacion(this, hasta, intent == null ? null : intent.getStringExtra(TITULO), intent == null ? null : intent.getStringExtra(TEXTO));
        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ID, n, tipo);
        // Por si la alarma no llegara nunca: el servicio no se queda puesto para siempre.
        reloj.removeCallbacksAndMessages(null);
        reloj.postDelayed(this::stopSelf, Math.max(0, hasta - System.currentTimeMillis()) + 60_000);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        reloj.removeCallbacksAndMessages(null);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static Notification notificacion(Context c, long hasta, String titulo, String texto) {
        crearCanal(c);
        return new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_stat_jowyfit)
            .setColor(Color.parseColor("#7F26FB"))
            .setContentTitle(titulo == null || titulo.isEmpty() ? c.getString(R.string.app_name) : titulo)
            .setContentText(texto)
            .setContentIntent(AvisoDescanso.abrirApp(c))
            .setWhen(hasta)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    /** La app crea el canal con su nombre traducido; si aún no existe, se crea aquí. Sin sonido ni vibración. */
    private static void crearCanal(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Descanso en curso", NotificationManager.IMPORTANCE_LOW);
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(canal);
    }
}
