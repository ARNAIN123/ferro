package com.ferro.app.deteccion

import android.content.Context
import androidx.core.content.edit
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Una línea del "Registro de detección" que se ve en Ajustes. */
data class Anotacion(
    val hora: Long,
    /** s3_abierta, wifi_desconectada, comprobacion, prueba… */
    val evento: String,
    val decision: String,
    val distanciaM: Double? = null,
    val precisionM: Double? = null,
) {
    fun json(): JSONObject = JSONObject()
        .put("hora", hora)
        .put("evento", evento)
        .put("decision", decision)
        .apply {
            distanciaM?.let { put("distancia", Math.round(it)) }
            precisionM?.let { put("precision", Math.round(it)) }
        }
}

/**
 * Estado de la detección en el almacenamiento de Android. Los receptores corren sin la web
 * abierta, así que no pueden escribir en IndexedDB: dejan las entradas y salidas en una cola
 * que la app pasa a su base de datos al abrirse.
 */
object Almacen {
    private const val NOMBRE = "ferro_deteccion"
    private const val MAX_REGISTRO = 200

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE)

    // --- Configuración (la escribe la app desde Ajustes) ---

    @Synchronized
    fun guardarConfig(ctx: Context, gimnasio: Gimnasio?, notificar: Boolean) {
        prefs(ctx).edit {
            if (gimnasio == null) {
                remove("gimnasio")
            } else {
                putString(
                    "gimnasio",
                    JSONObject()
                        .put("lat", gimnasio.lat)
                        .put("lng", gimnasio.lng)
                        .put("radio", gimnasio.radioM)
                        .put("margen", gimnasio.margenSalidaM)
                        .put("horas", gimnasio.horasEntreEntradas)
                        .toString(),
                )
            }
            putBoolean("notificar", notificar)
        }
    }

    @Synchronized
    fun gimnasio(ctx: Context): Gimnasio? {
        val j = prefs(ctx).getString("gimnasio", null)?.let(::JSONObject) ?: return null
        return Gimnasio(
            lat = j.getDouble("lat"),
            lng = j.getDouble("lng"),
            radioM = j.optDouble("radio", 150.0),
            margenSalidaM = j.optDouble("margen", 150.0),
            horasEntreEntradas = j.optDouble("horas", 3.0),
        )
    }

    fun notificar(ctx: Context): Boolean = prefs(ctx).getBoolean("notificar", true)

    // --- Estancia abierta y última entrada ---

    @Synchronized
    fun presencia(ctx: Context): Presencia? {
        val j = prefs(ctx).getString("presencia", null)?.let(::JSONObject) ?: return null
        return Presencia(
            entrada = j.getLong("entrada"),
            primeraSenalSalida = if (j.has("senal")) j.getLong("senal") else null,
            fuerasSeguidas = j.optInt("fueras", 0),
        )
    }

    @Synchronized
    fun guardarPresencia(ctx: Context, p: Presencia?) {
        prefs(ctx).edit {
            if (p == null) {
                remove("presencia")
            } else {
                val j = JSONObject().put("entrada", p.entrada).put("fueras", p.fuerasSeguidas)
                p.primeraSenalSalida?.let { j.put("senal", it) }
                putString("presencia", j.toString())
            }
        }
    }

    fun ultimaEntrada(ctx: Context): Long? = prefs(ctx).getLong("ultimaEntrada", 0L).takeIf { it > 0 }

    fun guardarUltimaEntrada(ctx: Context, hora: Long) = prefs(ctx).edit { putLong("ultimaEntrada", hora) }

    // --- Cola de eventos para la app ---

    @Synchronized
    fun encolarEntrada(ctx: Context, hora: Long) =
        encolar(ctx, JSONObject().put("id", UUID.randomUUID().toString()).put("tipo", "entrada").put("hora", hora))

    @Synchronized
    fun encolarSalida(ctx: Context, hora: Long, entrada: Long) = encolar(
        ctx,
        JSONObject().put("id", UUID.randomUUID().toString()).put("tipo", "salida").put("hora", hora).put("entrada", entrada),
    )

    // La cola se escribe en el acto (commit): el proceso puede morir justo después de un aviso.
    private fun encolar(ctx: Context, evento: JSONObject) {
        val cola = JSONArray(prefs(ctx).getString("eventos", "[]"))
        cola.put(evento)
        prefs(ctx).edit(commit = true) { putString("eventos", cola.toString()) }
    }

    /** Devuelve los eventos pendientes y vacía la cola (la app los guarda en su base de datos). */
    @Synchronized
    fun tomarEventos(ctx: Context): JSONArray {
        val cola = JSONArray(prefs(ctx).getString("eventos", "[]"))
        prefs(ctx).edit(commit = true) { putString("eventos", "[]") }
        return cola
    }

    // --- Registro de detección ---

    @Synchronized
    fun anotar(ctx: Context, a: Anotacion) {
        val viejo = JSONArray(prefs(ctx).getString("registro", "[]"))
        val nuevo = JSONArray().put(a.json())
        for (i in 0 until minOf(viejo.length(), MAX_REGISTRO - 1)) nuevo.put(viejo.get(i))
        prefs(ctx).edit { putString("registro", nuevo.toString()) }
    }

    /** Del más reciente al más antiguo. */
    @Synchronized
    fun registro(ctx: Context): JSONArray = JSONArray(prefs(ctx).getString("registro", "[]"))
}
