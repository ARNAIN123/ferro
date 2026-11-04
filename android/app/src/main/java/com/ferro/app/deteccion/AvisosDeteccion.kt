package com.ferro.app.deteccion

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.ferro.app.MainActivity
import com.ferro.app.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Notificación discreta "Entrada registrada · 18:04" (opcional en Ajustes). No abre la app. */
object AvisosDeteccion {
    private const val CANAL = "deteccion"
    private const val ID = 2001

    fun entrada(ctx: Context, hora: Long) = mostrar(ctx, "Entrada registrada · ${hhmm(hora)}")

    fun salida(ctx: Context, hora: Long) = mostrar(ctx, "Salida registrada · ${hhmm(hora)}")

    private fun hhmm(hora: Long) = SimpleDateFormat("HH:mm", Locale.forLanguageTag("es-ES")).format(Date(hora))

    private fun mostrar(ctx: Context, titulo: String) {
        if (!Almacen.notificar(ctx)) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm?.createNotificationChannel(
            NotificationChannel(CANAL, "Entrada y salida del gimnasio", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Aviso discreto cuando Ferro registra la entrada o la salida"
            },
        )
        val abrir = PendingIntent.getActivity(
            ctx,
            0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(R.drawable.ic_stat_ferro)
            .setColor(0xFFFF6B1F.toInt())
            .setContentTitle(titulo)
            .setContentIntent(abrir)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(ID, n)
        } catch (_: SecurityException) {
            // Sin permiso de notificaciones: el registro de detección lo recoge igualmente.
        }
    }
}
