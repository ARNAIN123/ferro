package com.ferro.app.deteccion

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

/**
 * Ubicación pedida de forma activa en el momento (getCurrentLocation de alta precisión),
 * nunca geofencing pasivo: en HyperOS las geovallas llegan tarde o no llegan.
 */
object Ubicacion {
    private const val ESPERA_MS = 20_000L
    private const val ESPERA_REINTENTO_MS = 15_000L

    /** Una posición de hace unos segundos vale (otra app pudo pedirla justo antes). */
    private const val ANTIGUEDAD_MAXIMA_MS = 15_000L

    fun tienePermiso(ctx: Context): Boolean =
        concedido(ctx, Manifest.permission.ACCESS_FINE_LOCATION) || concedido(ctx, Manifest.permission.ACCESS_COARSE_LOCATION)

    /** "Permitir todo el tiempo": imprescindible para leerla con Ferro cerrada. */
    fun tienePermisoSiempre(ctx: Context): Boolean =
        tienePermiso(ctx) &&
            (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || concedido(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION))

    private fun concedido(ctx: Context, permiso: String) =
        ContextCompat.checkSelfPermission(ctx, permiso) == PackageManager.PERMISSION_GRANTED

    /** Pide una lectura; si no llega o es imprecisa, reintenta una vez y se queda con la mejor. */
    fun leer(ctx: Context, alTerminar: (Lectura?) -> Unit) {
        intento(ctx, ESPERA_MS) { primera ->
            if (Reglas.lecturaValida(primera)) {
                alTerminar(primera)
            } else {
                intento(ctx, ESPERA_REINTENTO_MS) { segunda -> alTerminar(Reglas.mejor(primera, segunda)) }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun intento(ctx: Context, esperaMs: Long, alTerminar: (Lectura?) -> Unit) {
        if (!tienePermiso(ctx)) return alTerminar(null)
        val peticion = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .setDurationMillis(esperaMs)
            .setMaxUpdateAgeMillis(ANTIGUEDAD_MAXIMA_MS)
            .build()
        try {
            LocationServices.getFusedLocationProviderClient(ctx)
                .getCurrentLocation(peticion, CancellationTokenSource().token)
                .addOnCompleteListener { tarea ->
                    val l = if (tarea.isSuccessful) tarea.result else null
                    alTerminar(l?.let { Lectura(it.latitude, it.longitude, it.accuracy.toDouble(), System.currentTimeMillis()) })
                }
        } catch (_: SecurityException) {
            alTerminar(null)
        } catch (_: IllegalStateException) {
            // Sin Google Play Services.
            alTerminar(null)
        }
    }
}
