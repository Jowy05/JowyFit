package com.jowy05.jowyfit

import android.app.Application
import com.jowy05.jowyfit.datos.db.BaseJowyFit
import com.jowy05.jowyfit.datos.modelo.Ajustes
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.nativo.GestorTareasFondo
import com.jowy05.jowyfit.nativo.ServicioDescanso
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class JowyFitApp : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        ServicioDescanso.crearCanales(this)
        appScope.launch {
            runCatching {
                val reg = BaseJowyFit.obtener(this@JowyFitApp).registros().leerUno("ajustes", "app")
                val ajustes = reg?.let { JsonJowyFit.decodeFromString<Ajustes>(it.payloadJson) } ?: Ajustes()
                GestorTareasFondo.sincronizar(this@JowyFitApp, ajustes)
            }
        }
    }
}
