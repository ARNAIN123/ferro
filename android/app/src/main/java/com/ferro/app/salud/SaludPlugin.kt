package com.ferro.app.salud

import android.content.Intent
import androidx.core.net.toUri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

/**
 * Pasos y peso desde Health Connect (solo lectura). Ver src/lib/salud.ts.
 * Los pasos se piden con la agregación de Health Connect, que junta las fuentes (móvil, pulsera,
 * Google Health, Mi Fitness…) sin contar dos veces el mismo paso.
 */
@CapacitorPlugin(name = "Salud")
class SaludPlugin : Plugin() {

    private val ambito = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val contrato = PermissionController.createRequestPermissionResultContract()

    private fun cliente(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }

    /** Ejecuta en una corrutina y, si algo falla, rechaza la llamada en lugar de cerrar la app. */
    private fun PluginCall.lanzar(bloque: suspend PluginCall.() -> Unit) {
        val call = this
        ambito.launch {
            try {
                call.bloque()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                call.reject(e.message ?: "Error de Health Connect", null, e as? Exception ?: Exception(e))
            }
        }
    }

    private suspend fun estadoJs(): JSObject {
        val r = JSObject()
        r.put(
            "disponible",
            when (HealthConnectClient.getSdkStatus(context)) {
                HealthConnectClient.SDK_AVAILABLE -> "si"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "actualizar"
                else -> "no"
            },
        )
        val concedidos = cliente()?.permissionController?.getGrantedPermissions() ?: emptySet()
        r.put("pasos", PERMISO_PASOS in concedidos)
        r.put("peso", PERMISO_PESO in concedidos)
        return r
    }

    @PluginMethod
    fun estado(call: PluginCall) = call.lanzar { resolve(estadoJs()) }

    /** Abre la pantalla de Health Connect para conceder pasos y peso (nada más). */
    @PluginMethod
    fun pedirPermisos(call: PluginCall) = call.lanzar {
        val c = cliente()
        if (c == null || c.permissionController.getGrantedPermissions().containsAll(PERMISOS)) {
            resolve(estadoJs())
            return@lanzar
        }
        startActivityForResult(this, contrato.createIntent(context, PERMISOS), "alVolverDePermisos")
    }

    @ActivityCallback
    private fun alVolverDePermisos(call: PluginCall?, @Suppress("UNUSED_PARAMETER") resultado: ActivityResult) {
        call?.lanzar { resolve(estadoJs()) }
    }

    /**
     * Total de pasos de cada tramo [{desde, hasta}] (milisegundos). El primero suele ser el día
     * entero y los siguientes, los entrenos de hoy (para no contar dos veces sus pasos).
     */
    @PluginMethod
    fun pasos(call: PluginCall) = call.lanzar {
        val c = cliente() ?: return@lanzar reject("Health Connect no está disponible")
        val tramos = getArray("tramos") ?: JSArray()
        val totales = JSArray()
        for (i in 0 until tramos.length()) {
            val t = tramos.getJSONObject(i)
            val desde = Instant.ofEpochMilli(t.getLong("desde"))
            val hasta = Instant.ofEpochMilli(t.getLong("hasta"))
            if (!hasta.isAfter(desde)) {
                totales.put(0)
                continue
            }
            val r = c.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(desde, hasta)))
            totales.put(r[StepsRecord.COUNT_TOTAL] ?: 0L)
        }
        resolve(JSObject().put("pasos", totales))
    }

    /** Último peso de los últimos 30 días, si lo hay. */
    @PluginMethod
    fun ultimoPeso(call: PluginCall) = call.lanzar {
        val c = cliente() ?: return@lanzar reject("Health Connect no está disponible")
        val ahora = Instant.now()
        val leidos = c.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.between(ahora.minus(Duration.ofDays(30)), ahora),
                ascendingOrder = false,
                pageSize = 1,
            ),
        )
        val r = JSObject()
        leidos.records.firstOrNull()?.let {
            r.put("kg", it.weight.inKilograms)
            r.put("hora", it.time.toEpochMilli())
        }
        resolve(r)
    }

    /** Todas las mediciones de peso entre dos instantes (ms), de la más antigua a la más reciente. */
    @PluginMethod
    fun pesos(call: PluginCall) = call.lanzar {
        val c = cliente() ?: return@lanzar reject("Health Connect no está disponible")
        val desde = Instant.ofEpochMilli(getLong("desde") ?: 0L)
        val hasta = Instant.ofEpochMilli(getLong("hasta") ?: System.currentTimeMillis())
        val lista = JSArray()
        var pagina: String? = null
        do {
            val r = c.readRecords(
                ReadRecordsRequest(
                    recordType = WeightRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(desde, hasta),
                    ascendingOrder = true,
                    pageSize = 500,
                    pageToken = pagina,
                ),
            )
            r.records.forEach { lista.put(JSObject().put("kg", it.weight.inKilograms).put("hora", it.time.toEpochMilli())) }
            pagina = r.pageToken
        } while (pagina != null)
        resolve(JSObject().put("pesos", lista))
    }

    /** Ajustes de Health Connect, o su ficha en Play Store si hay que instalarlo o actualizarlo. */
    @PluginMethod
    fun abrirHealthConnect(call: PluginCall) {
        val intent = if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
        } else {
            Intent(Intent.ACTION_VIEW, "market://details?id=$PAQUETE_HC".toUri()).setPackage("com.android.vending")
        }
        try {
            activity.startActivity(intent)
        } catch (_: Exception) {
            activity.startActivity(Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=$PAQUETE_HC".toUri()))
        }
        call.resolve()
    }

    override fun handleOnDestroy() {
        ambito.cancel()
        super.handleOnDestroy()
    }

    companion object {
        private const val PAQUETE_HC = "com.google.android.apps.healthdata"
        private val PERMISO_PASOS = HealthPermission.getReadPermission(StepsRecord::class)
        private val PERMISO_PESO = HealthPermission.getReadPermission(WeightRecord::class)
        private val PERMISOS = setOf(PERMISO_PASOS, PERMISO_PESO)
    }
}
