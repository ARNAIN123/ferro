package com.ferro.app.deteccion

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

/** Puente entre la web (Ajustes, Hoy) y la detección nativa. Ver src/lib/deteccion.ts. */
@CapacitorPlugin(
    name = "Deteccion",
    permissions = [
        Permission(alias = "ubicacion", strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION]),
        Permission(alias = "ubicacionSiempre", strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION]),
    ],
)
class DeteccionPlugin : Plugin() {

    override fun load() {
        instancia = this
    }

    /** La app manda aquí el gimnasio y las reglas cada vez que cambian en Ajustes. */
    @PluginMethod
    fun configurar(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")
        val g = if (lat != null && lng != null) {
            Gimnasio(
                lat = lat,
                lng = lng,
                radioM = call.getDouble("radio") ?: 150.0,
                margenSalidaM = call.getDouble("margen") ?: 150.0,
                horasEntreEntradas = call.getDouble("horas") ?: 3.0,
            )
        } else {
            null
        }
        Almacen.guardarConfig(context, g, call.getBoolean("notificar") ?: true)
        call.resolve()
    }

    @PluginMethod
    fun estado(call: PluginCall) = call.resolve(estadoJs())

    /** Entradas y salidas pendientes de pasar a la base de datos de la app (vacía la cola). */
    @PluginMethod
    fun tomarEventos(call: PluginCall) {
        val r = JSObject()
        r.put("eventos", JSArray(Almacen.tomarEventos(context).toString()))
        call.resolve(r)
    }

    @PluginMethod
    fun registro(call: PluginCall) {
        val r = JSObject()
        r.put("registro", JSArray(Almacen.registro(context).toString()))
        call.resolve(r)
    }

    /** "Estoy en el gimnasio ahora": una lectura activa con Ferro abierta. */
    @PluginMethod
    fun ubicacionActual(call: PluginCall) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) {
            requestPermissionForAlias("ubicacion", call, "trasPermisoUbicacion")
        } else {
            leerPara(call)
        }
    }

    @PermissionCallback
    private fun trasPermisoUbicacion(call: PluginCall) {
        if (getPermissionState("ubicacion") == PermissionState.GRANTED) leerPara(call) else call.reject("Ferro no tiene permiso de ubicación.")
    }

    private fun leerPara(call: PluginCall) {
        Ubicacion.leer(context) { l ->
            if (l == null) {
                call.reject("No se ha podido obtener la ubicación. ¿Está activada la ubicación del móvil?")
            } else {
                call.resolve(JSObject().put("lat", l.lat).put("lng", l.lng).put("precision", l.precisionM))
            }
        }
    }

    /** Ubicación primero "mientras se usa" y después "Permitir todo el tiempo" (Android exige ese orden). */
    @PluginMethod
    fun pedirUbicacionSiempre(call: PluginCall) {
        when {
            getPermissionState("ubicacion") != PermissionState.GRANTED ->
                requestPermissionForAlias("ubicacion", call, "trasUbicacionPrimero")
            necesitaSiempre() -> requestPermissionForAlias("ubicacionSiempre", call, "trasUbicacionSiempre")
            else -> call.resolve(estadoJs())
        }
    }

    @PermissionCallback
    private fun trasUbicacionPrimero(call: PluginCall) {
        if (getPermissionState("ubicacion") == PermissionState.GRANTED && necesitaSiempre()) {
            requestPermissionForAlias("ubicacionSiempre", call, "trasUbicacionSiempre")
        } else {
            call.resolve(estadoJs())
        }
    }

    @PermissionCallback
    private fun trasUbicacionSiempre(call: PluginCall) = call.resolve(estadoJs())

    private fun necesitaSiempre() =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("ubicacionSiempre") != PermissionState.GRANTED

    /** Ajustes de Android de la app (permisos, batería, inicio automático en HyperOS). */
    @PluginMethod
    fun abrirAjustesApp(call: PluginCall) {
        val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
        context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        call.resolve()
    }

    /** Prueba desde Ajustes: hace exactamente lo mismo que el aviso de MacroDroid. */
    @PluginMethod
    fun simular(call: PluginCall) {
        val ahora = System.currentTimeMillis()
        val fin = { call.resolve(estadoJs()) }
        when (call.getString("evento") ?: "s3_abierta") {
            "wifi_desconectada" -> Detector.alDesconectarWifi(context, ahora, "prueba (WiFi)", fin)
            else -> Detector.alAbrirS3(context, ahora, "prueba (S3 FIT ZONE)", fin)
        }
    }

    private fun estadoJs(): JSObject {
        val ctx = context
        val p = Almacen.presencia(ctx)
        val energia = ctx.getSystemService(PowerManager::class.java)
        val r = JSObject()
        r.put("gimnasioGuardado", Almacen.gimnasio(ctx) != null)
        r.put("presencia", p?.let { JSObject().put("entrada", it.entrada).put("fuerasSeguidas", it.fuerasSeguidas) } ?: JSONObject.NULL)
        r.put(
            "permisos",
            JSObject()
                .put("ubicacion", Ubicacion.tienePermiso(ctx))
                .put("ubicacionSiempre", Ubicacion.tienePermisoSiempre(ctx))
                .put("notificaciones", NotificationManagerCompat.from(ctx).areNotificationsEnabled())
                .put("alarmasExactas", Alarmas.exactasPermitidas(ctx))
                .put("sinRestriccionesBateria", energia?.isIgnoringBatteryOptimizations(ctx.packageName) == true),
        )
        r.put(
            "receptor",
            JSObject().put("paquete", ctx.packageName).put("clase", AvisoReceiver::class.java.name).put("accion", ACCION),
        )
        return r
    }

    private fun avisar() = notifyListeners("cambio", JSObject())

    companion object {
        const val ACCION = "com.ferro.app.AVISO"

        @Volatile
        private var instancia: DeteccionPlugin? = null

        /** Si la app está abierta, que pase los eventos a su base de datos al momento. */
        fun avisarCambio() {
            instancia?.avisar()
        }
    }
}
