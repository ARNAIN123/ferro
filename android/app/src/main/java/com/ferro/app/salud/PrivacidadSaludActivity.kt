package com.ferro.app.salud

import android.app.Activity
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView
import com.ferro.app.R

/**
 * Health Connect la abre cuando tocas "Política de privacidad" al conceder permisos (y en
 * Android 14+, desde los ajustes de permisos de salud). Es obligatoria para poder pedirlos.
 */
class PrivacidadSaludActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = getString(R.string.salud_titulo)
        val margen = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 24f, resources.displayMetrics).toInt()
        val texto = TextView(this).apply {
            setPadding(margen, margen, margen, margen)
            textSize = 17f
            setLineSpacing(0f, 1.25f)
            text = getString(R.string.salud_privacidad)
        }
        setContentView(ScrollView(this).apply { addView(texto) })
    }
}
