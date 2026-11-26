package com.jowy05.jowyfit.nativo

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.max

/** Integración 100 % nativa con Health Connect SDK: lee pasos, peso y % grasa; escribe entrenos de fuerza. */
object ClienteHealthConnect {

    val PERMISOS: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
    )

    fun estaDisponible(context: Context): Boolean =
        runCatching { HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE }.getOrDefault(false)

    suspend fun tienePermisos(context: Context): Boolean = withContext(Dispatchers.IO) {
        if (!estaDisponible(context)) return@withContext false
        runCatching {
            val client = HealthConnectClient.getOrCreate(context)
            val concedidos = client.permissionController.getGrantedPermissions()
            PERMISOS.all { it in concedidos }
        }.getOrDefault(false)
    }

    data class DatosSincronizados(
        val pasosHoy: Int?,
        val ultimoPesoKg: Double?,
        val ultimaGrasaPct: Double?,
    )

    suspend fun sincronizarHoy(context: Context): DatosSincronizados? = withContext(Dispatchers.IO) {
        if (!estaDisponible(context)) return@withContext null
        runCatching {
            val client = HealthConnectClient.getOrCreate(context)
            val concedidos = client.permissionController.getGrantedPermissions()
            val zona = ZoneId.systemDefault()
            val inicioHoy = LocalDate.now().atStartOfDay(zona).toInstant()
            val ahora = Instant.now()

            val pasos = if (HealthPermission.getReadPermission(StepsRecord::class) in concedidos) {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(inicioHoy, ahora),
                    ),
                )
                agg[StepsRecord.COUNT_TOTAL]?.toInt()
            } else null

            val hace30d = LocalDate.now().minusDays(30).atStartOfDay(zona).toInstant()
            val peso = if (HealthPermission.getReadPermission(WeightRecord::class) in concedidos) {
                client.readRecords(ReadRecordsRequest(WeightRecord::class, TimeRangeFilter.between(hace30d, ahora)))
                    .records.maxByOrNull { it.time }?.weight?.inKilograms
            } else null

            val grasa = if (HealthPermission.getReadPermission(BodyFatRecord::class) in concedidos) {
                client.readRecords(ReadRecordsRequest(BodyFatRecord::class, TimeRangeFilter.between(hace30d, ahora)))
                    .records.maxByOrNull { it.time }?.percentage?.value
            } else null

            DatosSincronizados(pasos, peso, grasa)
        }.getOrNull()
    }

    suspend fun escribirEntreno(context: Context, sesion: Sesion, pesoKg: Double = 75.0): Boolean = withContext(Dispatchers.IO) {
        if (!estaDisponible(context)) return@withContext false
        runCatching {
            val client = HealthConnectClient.getOrCreate(context)
            val concedidos = client.permissionController.getGrantedPermissions()
            if (HealthPermission.getWritePermission(ExerciseSessionRecord::class) !in concedidos) return@withContext false

            val inicio = Instant.ofEpochMilli(sesion.inicio)
            val finMs = max(sesion.inicio + 60_000L, sesion.fin ?: System.currentTimeMillis())
            val fin = Instant.ofEpochMilli(finMs)
            val offset = ZoneId.systemDefault().rules.getOffset(inicio)
            val durMin = max(1L, (finMs - sesion.inicio) / 60_000L)
            val kcalEst = (durMin * (pesoKg * 0.085)).coerceIn(20.0, 1200.0)

            val registroSesion = ExerciseSessionRecord(
                startTime = inicio,
                startZoneOffset = offset,
                endTime = fin,
                endZoneOffset = offset,
                exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                title = sesion.nombre.ifBlank { "JowyFit · Entreno" },
                metadata = Metadata.manualEntry(),
            )
            val registros = buildList {
                add(registroSesion)
                if (HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class) in concedidos) {
                    add(
                        ActiveCaloriesBurnedRecord(
                            startTime = inicio,
                            startZoneOffset = offset,
                            endTime = fin,
                            endZoneOffset = offset,
                            energy = Energy.kilocalories(kcalEst),
                            metadata = Metadata.manualEntry(),
                        ),
                    )
                }
            }
            client.insertRecords(registros)
            true
        }.getOrDefault(false)
    }
}
