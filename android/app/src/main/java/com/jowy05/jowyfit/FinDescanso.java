package com.jowy05.jowyfit;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Llega la alarma de AvisoDescanso: quita la cuenta atrás, enciende la pantalla un momento si está apagada y saca la
 * notificación «Descanso terminado» por el canal del descanso (con vibración, también en el reloj).
 */
public class FinDescanso extends BroadcastReceiver {

    static final String TITULO = "titulo";
    static final String TEXTO = "texto";

    @Override
    public void onReceive(Context c, Intent intent) {
        DescansoEnCurso.parar(c);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationCompat.Builder n = NotificacionDescanso.base(c, NotificacionDescanso.CANAL_FIN, intent.getStringExtra(TITULO))
            .setContentText(intent.getStringExtra(TEXTO))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL);
        encenderPantalla(c);
        NotificationManagerCompat.from(c).notify(NotificacionDescanso.ID, n.build());
    }

    /**
     * Con el móvil bloqueado la notificación no enciende la pantalla en muchos móviles: se enciende unos segundos, como
     * hace un temporizador, para que se vea en la pantalla de bloqueo. El aviso deprecado es el único que lo consigue sin
     * abrir una actividad encima del bloqueo.
     */
    @SuppressWarnings("deprecation")
    private static void encenderPantalla(Context c) {
        PowerManager pm = c.getSystemService(PowerManager.class);
        if (pm == null || pm.isInteractive()) return;
        pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "jowyfit:fin-descanso").acquire(5_000);
    }
}
