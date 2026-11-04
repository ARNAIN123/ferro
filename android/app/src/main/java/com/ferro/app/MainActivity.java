package com.ferro.app;

import android.os.Bundle;
import com.ferro.app.deteccion.DeteccionPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios: hay que registrarlos antes de que arranque el puente.
        registerPlugin(DeteccionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
