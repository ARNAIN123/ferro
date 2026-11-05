package com.ferro.app;

import android.os.Bundle;
import com.ferro.app.deteccion.DeteccionPlugin;
import com.ferro.app.salud.SaludPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios: hay que registrarlos antes de que arranque el puente.
        registerPlugin(DeteccionPlugin.class);
        registerPlugin(SaludPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
