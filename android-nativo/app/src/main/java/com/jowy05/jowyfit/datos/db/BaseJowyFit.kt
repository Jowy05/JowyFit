package com.jowy05.jowyfit.datos.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/**
 * Almacén SQLite local de las 17 tablas de JowyFit.
 * Guarda cada fila con su clave original, fecha indexada y el JSON completo para conservar
 * el 100 % de fidelidad con copias .jowyfit (V1–V7) y futuras migraciones sin pérdida.
 */
@Entity(
    tableName = "registros",
    primaryKeys = ["tabla", "clave"],
    indices = [
        Index(value = ["tabla"]),
        Index(value = ["tabla", "fecha"]),
    ],
)
data class RegistroTablaEntity(
    val tabla: String,
    val clave: String,
    val fecha: String = "",
    val payloadJson: String,
)

@Dao
interface RegistroDao {

    @Query("SELECT * FROM registros WHERE tabla = :tabla ORDER BY fecha DESC, clave DESC")
    fun observarTabla(tabla: String): Flow<List<RegistroTablaEntity>>

    @Query("SELECT * FROM registros WHERE tabla = :tabla AND clave = :clave LIMIT 1")
    fun observarUno(tabla: String, clave: String): Flow<RegistroTablaEntity?>

    @Query("SELECT * FROM registros WHERE tabla = :tabla ORDER BY fecha DESC, clave DESC")
    suspend fun leerTabla(tabla: String): List<RegistroTablaEntity>

    @Query("SELECT * FROM registros WHERE tabla = :tabla AND clave = :clave LIMIT 1")
    suspend fun leerUno(tabla: String, clave: String): RegistroTablaEntity?

    @Query("SELECT * FROM registros WHERE tabla = :tabla AND fecha = :fecha ORDER BY clave ASC")
    fun observarPorFecha(tabla: String, fecha: String): Flow<List<RegistroTablaEntity>>

    @Query("SELECT * FROM registros WHERE tabla = :tabla AND fecha BETWEEN :desde AND :hasta ORDER BY fecha ASC")
    fun observarEntreFechas(tabla: String, desde: String, hasta: String): Flow<List<RegistroTablaEntity>>

    @Query("SELECT * FROM registros")
    suspend fun leerTodo(): List<RegistroTablaEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun guardar(registro: RegistroTablaEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun guardarVarios(registros: List<RegistroTablaEntity>)

    @Query("DELETE FROM registros WHERE tabla = :tabla AND clave = :clave")
    suspend fun borrarUno(tabla: String, clave: String)

    @Query("DELETE FROM registros")
    suspend fun borrarTodo()

    @Transaction
    suspend fun reemplazarTodo(registros: List<RegistroTablaEntity>) {
        borrarTodo()
        if (registros.isNotEmpty()) {
            guardarVarios(registros)
        }
    }
}

@Database(
    entities = [RegistroTablaEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class BaseJowyFit : RoomDatabase() {
    abstract fun registros(): RegistroDao

    companion object {
        @Volatile
        private var instancia: BaseJowyFit? = null

        fun obtener(context: Context): BaseJowyFit =
            instancia ?: synchronized(this) {
                instancia ?: Room.databaseBuilder(
                    context.applicationContext,
                    BaseJowyFit::class.java,
                    "jowyfit_nativo.db",
                ).build().also { instancia = it }
            }
    }
}
