package com.ferro.app.deteccion

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Comprobaciones de salida mientras estoy en el gimnasio: alarmas exactas que despiertan el móvil
 * aunque esté en reposo (setExactAndAllowWhileIdle).
 *
 * Por qué alarmas y no WorkManager ni un servicio en primer plano:
 * - WorkManager no baja de 15 min entre ejecuciones y HyperOS (y el modo reposo de Android) las retrasa
 *   o agrupa sin aviso: una salida podría notarse una hora tarde.
 * - Un servicio en primer plano obliga a llevar una notificación fija toda la sesión y Android 12+
 *   no deja arrancarlo desde segundo plano (que es justo cuando llega el aviso de MacroDroid).
 * - Las alarmas exactas sí se pueden programar desde un receptor en segundo plano, suenan a su hora
 *   incluso en reposo (como mucho una cada ~9 min, de sobra para 12) y cada una solo enciende el GPS
 *   unos segundos. Con "Sin restricciones" e "Inicio automático" HyperOS las respeta.
 */
object Alarmas {
    private const val CODIGO = 4100

    fun programar(ctx: Context, enMs: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val cuando = System.currentTimeMillis() + enMs
        val pi = pendiente(ctx)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi)
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi)
        }
    }

    fun cancelar(ctx: Context) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(pendiente(ctx))
    }

    fun exactasPermitidas(ctx: Context): Boolean {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    }

    private fun pendiente(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
        ctx,
        CODIGO,
        Intent(ctx, ComprobacionReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
