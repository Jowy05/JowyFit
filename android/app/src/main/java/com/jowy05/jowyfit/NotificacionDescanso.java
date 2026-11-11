package com.jowy05.jowyfit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/** Lo común a las dos notificaciones del descanso: la cuenta atrás (DescansoEnCurso) y el aviso final (FinDescanso). */
final class NotificacionDescanso {

    /** Id del aviso final y de los PendingIntent de la alarma y de abrir la app. */
    static final int ID = 9001;
    /** Id de la cuenta atrás (la notificación del servicio en primer plano). */
    static final int ID_CUENTA_ATRAS = 9002;

    /** Aviso final: suena y vibra, también en el reloj. */
    static final String CANAL_FIN = "descanso";
    /** Cuenta atrás: sin sonido ni vibración. */
    static final String CANAL_CURSO = "descanso_curso";

    private NotificacionDescanso() {}

    /** Crea el canal o, si ya existe, le pone el nombre en el idioma actual del móvil (lo demás no cambia). */
    static void asegurarCanal(Context c, String canal) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        boolean fin = CANAL_FIN.equals(canal);
        NotificationChannel nc = new NotificationChannel(
            canal,
            c.getString(fin ? R.string.canal_fin_descanso : R.string.canal_descanso_curso),
            fin ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_LOW);
        nc.setDescription(c.getString(fin ? R.string.canal_fin_descanso_desc : R.string.canal_descanso_curso_desc));
        nc.enableVibration(fin);
        nc.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(nc);
    }

    /** Icono, color, título (el nombre de la app si viene vacío), visible en la pantalla de bloqueo y que al tocarla abra la app. */
    static NotificationCompat.Builder base(Context c, String canal, String titulo) {
        asegurarCanal(c, canal);
        return new NotificationCompat.Builder(c, canal)
            .setSmallIcon(R.drawable.ic_stat_jowyfit)
            .setColor(ContextCompat.getColor(c, R.color.morado))
            .setContentTitle(titulo == null || titulo.isEmpty() ? c.getString(R.string.app_name) : titulo)
            .setContentIntent(abrirApp(c))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    }

    static PendingIntent abrirApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
