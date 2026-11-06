package com.jowy05.jowyfit;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios de la app (no vienen de npm) se registran antes de arrancar el puente.
        registerPlugin(EntrenosSalud.class);
        registerPlugin(AvisoDescanso.class);
        super.onCreate(savedInstanceState);
    }
}
