package com.jowy05.jowyfit

import android.app.Application
import com.jowy05.jowyfit.nativo.ServicioDescanso

class JowyFitApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServicioDescanso.crearCanales(this)
    }
}
