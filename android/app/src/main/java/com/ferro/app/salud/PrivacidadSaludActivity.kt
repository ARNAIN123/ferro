package com.ferro.app.salud

import android.app.Activity
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView

/**
 * Health Connect la abre cuando tocas "Política de privacidad" al conceder permisos (y en
 * Android 14+, desde los ajustes de permisos de salud). Es obligatoria para poder pedirlos.
 */
class PrivacidadSaludActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "Ferro y tus datos de salud"
        val margen = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 24f, resources.displayMetrics).toInt()
        val texto = TextView(this).apply {
            setPadding(margen, margen, margen, margen)
            textSize = 17f
            setLineSpacing(0f, 1.25f)
            text = """
                Ferro y tus datos de salud

                Ferro lee de Health Connect solo dos cosas:

                • Tus pasos de hoy, para el anillo de pasos y para estimar las calorías de caminar.
                • Tu último peso, si no lo has apuntado en Ferro, para estimar las calorías.

                Ferro no escribe nada en Health Connect, no lee ningún otro dato y no envía nada a ningún sitio: todo se calcula y se queda en este móvil.

                Puedes quitar el permiso cuando quieras desde los ajustes de Health Connect.
            """.trimIndent()
        }
        setContentView(ScrollView(this).apply { addView(texto) })
    }
}
