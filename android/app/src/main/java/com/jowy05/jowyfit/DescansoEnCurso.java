package com.jowy05.jowyfit;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

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

    private static final String HASTA = "hasta";
    private static final String DURANTE = "durante";
    private static final String TEXTO = "texto";

    /*
     * Un servicio arrancado con startForegroundService que se para antes de llamar a startForeground cierra la app
     * («did not then call Service.startForeground()»). Pasa si se programa y enseguida se cancela o se reprograma
     * («+15 s», «Saltar», o el aviso vencido al volver a la app). Por eso parar() no para un servicio con arranques
     * pendientes: lo apunta y lo para el propio servicio en onStartCommand, después de ponerse en primer plano.
     * Lo tocan el hilo del plugin, FinDescanso y el servicio: todo bajo el candado de la clase.
     */
    private static int arranquesPendientes;
    private static long ultimoArranque;
    private static boolean enPrimerPlano;
    private static boolean pararAlArrancar;

    private final Handler reloj = new Handler(Looper.getMainLooper());

    /** Solo se puede arrancar con la app delante (al apuntar la serie o al volver a ella); si no, sigue solo la alarma. */
    static void empezar(Context c, long hasta, String durante, String texto) {
        Intent i = new Intent(c, DescansoEnCurso.class).putExtra(HASTA, hasta).putExtra(DURANTE, durante).putExtra(TEXTO, texto);
        synchronized (DescansoEnCurso.class) {
            pararAlArrancar = false;
            arranquesPendientes++;
            ultimoArranque = SystemClock.elapsedRealtime();
        }
        try {
            ContextCompat.startForegroundService(c, i);
        } catch (RuntimeException e) {
            // ForegroundServiceStartNotAllowedException (app en segundo plano): la alarma de reloj avisa igual.
            synchronized (DescansoEnCurso.class) {
                arranquesPendientes--;
            }
        }
    }

    static void parar(Context c) {
        synchronized (DescansoEnCurso.class) {
            // Un arranque de hace más de 10 s que no ha llegado ya no llegará: se olvida y se para sin esperarlo.
            if (arranquesPendientes > 0 && SystemClock.elapsedRealtime() - ultimoArranque > 10_000) arranquesPendientes = 0;
            if (arranquesPendientes > 0) pararAlArrancar = true;
            else if (enPrimerPlano) c.stopService(new Intent(c, DescansoEnCurso.class));
        }
    }

    /** Si la cuenta atrás está puesta y nadie ha pedido quitarla. */
    static boolean enMarcha() {
        synchronized (DescansoEnCurso.class) {
            return enPrimerPlano && !pararAlArrancar;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        long hasta = intent == null ? 0 : intent.getLongExtra(HASTA, 0);
        Notification n = notificacion(this, hasta, intent == null ? null : intent.getStringExtra(DURANTE), intent == null ? null : intent.getStringExtra(TEXTO));
        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NotificacionDescanso.ID_CUENTA_ATRAS, n, tipo);
        synchronized (DescansoEnCurso.class) {
            if (intent != null) arranquesPendientes = Math.max(0, arranquesPendientes - 1);
            enPrimerPlano = true;
            if (pararAlArrancar && arranquesPendientes == 0) {
                pararAlArrancar = false;
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        // Por si la alarma no llegara nunca: el servicio no se queda puesto para siempre.
        reloj.removeCallbacksAndMessages(null);
        reloj.postDelayed(() -> parar(this), Math.max(0, hasta - System.currentTimeMillis()) + 60_000);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        synchronized (DescansoEnCurso.class) {
            enPrimerPlano = false;
        }
        reloj.removeCallbacksAndMessages(null);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static Notification notificacion(Context c, long hasta, String durante, String texto) {
        return NotificacionDescanso.base(c, NotificacionDescanso.CANAL_CURSO, durante)
            .setContentText(texto)
            .setWhen(hasta)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
}
