package com.jowy05.jowyfit;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Aviso de fin del descanso (y del calentamiento) con la app en segundo plano o la pantalla apagada.
 * Va como alarma de reloj (setAlarmClock): Android no la retrasa en reposo ni le pone cupo, al contrario que las
 * alarmas exactas normales del plugin de notificaciones, que con la app cerrada llegaban tarde o no llegaban.
 * Mientras dura el descanso sale el icono del despertador arriba y la cuenta atrás (DescansoEnCurso, que además
 * impide que el sistema congele la app con el móvil bloqueado); al tocarlos se abre la app.
 */
@CapacitorPlugin(name = "AvisoDescanso")
public class AvisoDescanso extends Plugin {

    /** Con menos margen no se arranca la cuenta atrás: el servicio llegaría a la vez que la alarma que lo para. */
    private static final long MARGEN_CUENTA_ATRAS_MS = 1_500;

    /** Lo último programado (hora y textos): al volver a la app se pide otra vez el mismo y no hay que tocar nada. */
    private static volatile String programado;

    @PluginMethod
    public void programar(PluginCall call) {
        Long hasta = call.getLong("hasta");
        if (hasta == null) {
            call.reject("Falta la hora");
            return;
        }
        String titulo = call.getString("titulo", "");
        String texto = call.getString("texto", "");
        String durante = call.getString("durante", "");
        String clave = hasta + "\n" + titulo + "\n" + texto + "\n" + durante;
        Context c = getContext();
        // Quitar y volver a poner el mismo aviso haría parpadear la cuenta atrás.
        if (clave.equals(programado) && DescansoEnCurso.enMarcha()) {
            call.resolve();
            return;
        }
        AlarmManager alarmas = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent alAcabar = alAcabar(c, titulo, texto);
        alarmas.cancel(alAcabar);
        NotificationManagerCompat.from(c).cancel(NotificacionDescanso.ID);
        boolean exacta = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmas.canScheduleExactAlarms();
        if (exacta) {
            alarmas.setAlarmClock(new AlarmManager.AlarmClockInfo(hasta, NotificacionDescanso.abrirApp(c)), alAcabar);
        } else {
            // Sin permiso de alarmas exactas (no debería pasar con USE_EXACT_ALARM): llega igual, algo más tarde.
            alarmas.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, hasta, alAcabar);
        }
        if (hasta - System.currentTimeMillis() > MARGEN_CUENTA_ATRAS_MS) DescansoEnCurso.empezar(c, hasta, durante, texto);
        else DescansoEnCurso.parar(c);
        programado = clave;
        call.resolve();
    }

    @PluginMethod
    public void cancelar(PluginCall call) {
        Context c = getContext();
        AlarmManager alarmas = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        alarmas.cancel(alAcabar(c, "", ""));
        NotificationManagerCompat.from(c).cancel(NotificacionDescanso.ID);
        DescansoEnCurso.parar(c);
        programado = null;
        call.resolve();
    }

    /** Si la app está fuera del ahorro de batería (así el sistema no la duerme y los avisos llegan con el móvil bloqueado). */
    @PluginMethod
    public void segundoPlano(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("permitido", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    /** Pregunta del sistema «¿Dejar que la app se ejecute siempre en segundo plano?»; si no sale, abre la lista del ahorro de batería. */
    @PluginMethod
    public void pedirSegundoPlano(PluginCall call) {
        Context c = getContext();
        try {
            c.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (RuntimeException e) {
            try {
                c.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (RuntimeException ignorada) {
                call.reject("No se puede abrir el ajuste");
                return;
            }
        }
        call.resolve();
    }

    /** El mismo PendingIntent (mismo código y destino) al programar y al cancelar: así cancelar siempre lo encuentra. */
    private static PendingIntent alAcabar(Context c, String titulo, String texto) {
        Intent i = new Intent(c, FinDescanso.class)
            .putExtra(FinDescanso.TITULO, titulo)
            .putExtra(FinDescanso.TEXTO, texto);
        return PendingIntent.getBroadcast(c, NotificacionDescanso.ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
