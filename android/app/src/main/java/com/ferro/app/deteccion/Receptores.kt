package com.ferro.app.deteccion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Aviso de MacroDroid: broadcast **explícito** a com.ferro.app/.deteccion.AvisoReceiver
 * (acción com.ferro.app.AVISO) con el extra `evento` = s3_abierta | wifi_desconectada y,
 * opcionalmente, `hora`. Responde en segundo plano: nunca abre Ferro.
 */
class AvisoReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val ctx = context.applicationContext
        val recibido = System.currentTimeMillis()
        val evento = intent.getStringExtra("evento")?.trim()?.lowercase()
        @Suppress("DEPRECATION")
        val hora = Reglas.horaDelAviso(intent.extras?.get("hora")?.toString(), recibido)
        // goAsync da hasta ~1 min a un broadcast en segundo plano: de sobra para dos intentos de GPS (20 + 15 s).
        val pendiente = goAsync()
        val fin = { pendiente.finish() }
        when (evento) {
            "s3_abierta" -> Detector.alAbrirS3(ctx, hora, evento, fin)
            "wifi_desconectada" -> Detector.alDesconectarWifi(ctx, hora, evento, fin)
            else -> {
                Almacen.anotar(ctx, Anotacion(recibido, evento ?: "sin evento", "Ignorado: evento desconocido"))
                DeteccionPlugin.avisarCambio()
                fin()
            }
        }
    }
}

/** Alarma de comprobación de salida (ver Alarmas). */
class ComprobacionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pendiente = goAsync()
        Detector.comprobar(context.applicationContext) { pendiente.finish() }
    }
}

/** Tras reiniciar el móvil, las alarmas se pierden: si había una estancia abierta, se reprograma. */
class ArranqueReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != "android.intent.action.QUICKBOOT_POWERON") return
        if (Almacen.presencia(context) != null) Alarmas.programar(context, 60_000L)
    }
}
