package com.jowy05.jowyfit;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/** Llega la alarma de AvisoDescanso: saca la notificación «Descanso terminado» por el canal del descanso (con vibración, también en el reloj). */
public class FinDescanso extends BroadcastReceiver {

    static final String TITULO = "titulo";
    static final String TEXTO = "texto";
    private static final String CANAL = "descanso";

    @Override
    public void onReceive(Context c, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        crearCanal(c);
        String titulo = intent.getStringExtra(TITULO);
        NotificationCompat.Builder n = new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_stat_jowyfit)
            .setColor(Color.parseColor("#7F26FB"))
            .setContentTitle(titulo == null || titulo.isEmpty() ? c.getString(R.string.app_name) : titulo)
            .setContentText(intent.getStringExtra(TEXTO))
            .setContentIntent(AvisoDescanso.abrirApp(c))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL);
        NotificationManagerCompat.from(c).notify(AvisoDescanso.ID, n.build());
    }

    /** La app crea el canal (con su nombre traducido) al programar; si aún no existe, se crea aquí igual. */
    private static void crearCanal(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Fin del descanso", NotificationManager.IMPORTANCE_HIGH);
        canal.enableVibration(true);
        canal.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(canal);
    }
}
