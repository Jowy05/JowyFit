package com.jowy05.jowyfit;

import android.content.Intent;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord;
import androidx.health.connect.client.records.ExerciseSessionRecord;
import androidx.health.connect.client.records.Record;
import androidx.health.connect.client.records.metadata.Metadata;
import androidx.health.connect.client.units.Energy;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.Instant;
import java.time.ZoneId;
import java.time.zone.ZoneRules;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.jvm.JvmClassMappingKt;
import kotlinx.coroutines.BuildersKt;

/**
 * Guarda los entrenos terminados en Health Connect como sesión de fuerza, con sus kcal si se saben.
 * El plugin de salud (@capgo/capacitor-health) solo lee sesiones: escribirlas lo hace este, con el mismo cliente.
 * Los métodos de los plugins corren en un hilo aparte de Capacitor, así que esperar a Health Connect en ellos no
 * bloquea la pantalla. La vuelta de la hoja de permisos (alResponder) llega en el hilo principal: esa pasa la espera
 * al hilo de Capacitor.
 */
@CapacitorPlugin(name = "EntrenosSalud")
public class EntrenosSalud extends Plugin {

    private static final String SESION = "android.permission.health.WRITE_EXERCISE";
    private static final String CALORIAS = "android.permission.health.WRITE_ACTIVE_CALORIES_BURNED";
    private static final Set<String> PERMISOS = new HashSet<>(Arrays.asList(SESION, CALORIAS));

    private final ActivityResultContract<Set<String>, Set<String>> contrato = PermissionController.createRequestPermissionResultContract();

    private HealthConnectClient cliente() {
        return HealthConnectClient.getOrCreate(getContext());
    }

    private Set<String> concedidos() throws InterruptedException {
        HealthConnectClient c = cliente();
        return BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (ambito, sigue) -> c.getPermissionController().getGrantedPermissions(sigue));
    }

    private static JSObject estado(Set<String> dados) {
        JSObject r = new JSObject();
        r.put("sesion", dados.contains(SESION));
        r.put("calorias", dados.contains(CALORIAS));
        return r;
    }

    @PluginMethod
    public void permisos(PluginCall call) {
        try {
            call.resolve(estado(concedidos()));
        } catch (Exception e) {
            call.reject("Health Connect no está disponible", e);
        }
    }

    /** Abre la hoja de permisos de Health Connect solo si falta alguno (sin ella, se responde enseguida). */
    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        try {
            Set<String> ya = concedidos();
            if (ya.containsAll(PERMISOS)) {
                call.resolve(estado(ya));
                return;
            }
            Intent hoja = contrato.createIntent(getContext(), PERMISOS);
            startActivityForResult(call, hoja, "alResponder");
        } catch (Exception e) {
            call.reject("Health Connect no está disponible", e);
        }
    }

    @ActivityCallback
    private void alResponder(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        // Se vuelve a preguntar a Health Connect (la hoja solo dice lo que se ha dado esta vez), pero fuera del hilo
        // principal: aquí la espera dejaría la pantalla congelada.
        getBridge().execute(() -> {
            try {
                call.resolve(estado(concedidos()));
            } catch (Exception e) {
                call.resolve(estado(contrato.parseResult(resultado.getResultCode(), resultado.getData())));
            }
        });
    }

    /**
     * Guarda la sesión (y las kcal, si llegan y hay permiso). El id va como clientRecordId: con el mismo id,
     * Health Connect sobrescribe en vez de duplicar.
     */
    @PluginMethod
    public void guardar(PluginCall call) {
        String id = call.getString("id");
        Long inicio = call.getLong("inicio");
        Long fin = call.getLong("fin");
        String titulo = call.getString("titulo");
        Double kcal = call.getDouble("kcal");
        if (id == null || inicio == null || fin == null || fin <= inicio) {
            call.reject("Faltan datos del entreno");
            return;
        }
        try {
            Set<String> ya = concedidos();
            if (!ya.contains(SESION)) {
                call.reject("Sin permiso para guardar entrenos");
                return;
            }
            Instant a = Instant.ofEpochMilli(inicio);
            Instant b = Instant.ofEpochMilli(fin);
            ZoneRules zona = ZoneId.systemDefault().getRules();
            List<Record> registros = new ArrayList<>();
            registros.add(new ExerciseSessionRecord(a, zona.getOffset(a), b, zona.getOffset(b), Metadata.manualEntry(id),
                ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, titulo));
            boolean conKcal = kcal != null && kcal > 0 && ya.contains(CALORIAS);
            if (conKcal) {
                registros.add(new ActiveCaloriesBurnedRecord(a, zona.getOffset(a), b, zona.getOffset(b), Energy.kilocalories(kcal),
                    Metadata.manualEntry(id + "-kcal")));
            }
            HealthConnectClient c = cliente();
            BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (ambito, sigue) -> c.insertRecords(registros, sigue));
            JSObject r = new JSObject();
            r.put("calorias", conKcal);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se ha podido guardar en Health Connect", e);
        }
    }

    /** Quita la sesión y sus kcal (por su clientRecordId) cuando el entreno se borra en la app. */
    @PluginMethod
    public void borrar(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Falta el id del entreno");
            return;
        }
        try {
            Set<String> ya = concedidos();
            if (!ya.contains(SESION)) {
                call.reject("Sin permiso para guardar entrenos");
                return;
            }
            HealthConnectClient c = cliente();
            List<String> ninguno = Collections.emptyList();
            BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (ambito, sigue) -> c.deleteRecords(
                JvmClassMappingKt.getKotlinClass(ExerciseSessionRecord.class), ninguno, Collections.singletonList(id), sigue));
            // Sin el permiso de las kcal no se pudieron escribir, así que tampoco hay nada que borrar.
            if (ya.contains(CALORIAS)) {
                BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (ambito, sigue) -> c.deleteRecords(
                    JvmClassMappingKt.getKotlinClass(ActiveCaloriesBurnedRecord.class), ninguno, Collections.singletonList(id + "-kcal"), sigue));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("No se ha podido borrar de Health Connect", e);
        }
    }
}
