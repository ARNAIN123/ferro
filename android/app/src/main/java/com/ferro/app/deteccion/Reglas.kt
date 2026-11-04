package com.ferro.app.deteccion

import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Reglas de la detección de entrada y salida del gimnasio. Funciones puras, con tests en ReglasTest.

/** Gimnasio guardado en Ajustes y sus reglas. */
data class Gimnasio(
    val lat: Double,
    val lng: Double,
    val radioM: Double = 150.0,
    /** La salida exige estar a más de radio + margen (por defecto 150 + 150 = 300 m). */
    val margenSalidaM: Double = 150.0,
    val horasEntreEntradas: Double = 3.0,
)

/** Una lectura de ubicación pedida de forma activa. */
data class Lectura(val lat: Double, val lng: Double, val precisionM: Double, val hora: Long)

/** Estancia abierta en el gimnasio: entrada sin salida todavía. */
data class Presencia(
    val entrada: Long,
    /** Primera señal de salida (WiFi desconectada o primera comprobación fuera). Es la hora de salida si se confirma. */
    val primeraSenalSalida: Long? = null,
    val fuerasSeguidas: Int = 0,
)

enum class DecisionEntrada(val texto: String) {
    REGISTRADA("Entrada registrada"),
    FUERA("Descartada: fuera del radio"),
    IMPRECISA("Descartada: ubicación poco precisa"),
    SIN_UBICACION("Descartada: sin ubicación (¿permiso o GPS?)"),
    DUPLICADA("Descartada: ya hay una entrada en las últimas horas"),
    SIN_GIMNASIO("Descartada: falta guardar la ubicación del gimnasio"),
}

enum class DecisionSalida(val texto: String) {
    DENTRO("Sigue en el gimnasio"),
    PRIMERA_FUERA("Primera comprobación fuera"),
    SALIDA("Salida confirmada"),
    DUDOSA("Sin decidir: cerca del límite"),
    IMPRECISA("Sin decidir: ubicación poco precisa"),
    SIN_UBICACION("Sin decidir: sin ubicación"),
}

data class ResultadoSalida(val decision: DecisionSalida, val presencia: Presencia, val horaSalida: Long? = null)

object Reglas {
    /** Una lectura con más error que esto no decide nada (se reintenta una vez). */
    const val PRECISION_MAXIMA_M = 200.0

    /** Parte de la imprecisión que se perdona al decidir que estoy dentro. */
    const val TOLERANCIA_MAXIMA_M = 50.0

    /** Comprobaciones durante la estancia, y más seguidas tras una primera lectura fuera. */
    const val INTERVALO_MS = 12 * 60_000L
    const val INTERVALO_CONFIRMAR_MS = 4 * 60_000L

    /** Sin salida detectada en este tiempo se deja de comprobar (la app cierra la sesión por inactividad). */
    const val TOPE_ESTANCIA_MS = 5 * 3_600_000L

    private const val RADIO_TIERRA_M = 6_371_000.0

    /** Distancia en metros entre dos puntos (haversine). */
    fun distanciaM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val rad = { g: Double -> Math.toRadians(g) }
        val dLat = rad(lat2 - lat1)
        val dLng = rad(lng2 - lng1)
        val h = sin(dLat / 2) * sin(dLat / 2) + cos(rad(lat1)) * cos(rad(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * RADIO_TIERRA_M * asin(min(1.0, sqrt(h)))
    }

    fun distanciaM(g: Gimnasio, l: Lectura): Double = distanciaM(g.lat, g.lng, l.lat, l.lng)

    /** Dentro si la distancia cabe en el radio más parte de la imprecisión de la lectura (como mucho 50 m). */
    fun dentro(g: Gimnasio, l: Lectura): Boolean = distanciaM(g, l) <= g.radioM + min(l.precisionM, TOLERANCIA_MAXIMA_M)

    /** Fuera seguro: ni con toda la imprecisión a favor se llega al radio más el margen de salida. */
    fun fueraSeguro(g: Gimnasio, l: Lectura): Boolean = distanciaM(g, l) - l.precisionM > g.radioM + g.margenSalidaM

    fun lecturaValida(l: Lectura?): Boolean = l != null && l.precisionM <= PRECISION_MAXIMA_M

    /** De dos lecturas, la más precisa. */
    fun mejor(a: Lectura?, b: Lectura?): Lectura? = when {
        a == null -> b
        b == null -> a
        b.precisionM < a.precisionM -> b
        else -> a
    }

    fun esDuplicada(ultimaEntrada: Long?, hora: Long, horas: Double): Boolean =
        ultimaEntrada != null && abs(hora - ultimaEntrada) < (horas * 3_600_000).toLong()

    /** Lo que se puede decidir antes de encender el GPS (así no se gasta batería en balde). */
    fun previaEntrada(g: Gimnasio?, ultimaEntrada: Long?, hora: Long): DecisionEntrada? = when {
        g == null -> DecisionEntrada.SIN_GIMNASIO
        esDuplicada(ultimaEntrada, hora, g.horasEntreEntradas) -> DecisionEntrada.DUPLICADA
        else -> null
    }

    fun decidirEntrada(g: Gimnasio, l: Lectura?): DecisionEntrada = when {
        l == null -> DecisionEntrada.SIN_UBICACION
        l.precisionM > PRECISION_MAXIMA_M -> DecisionEntrada.IMPRECISA
        dentro(g, l) -> DecisionEntrada.REGISTRADA
        else -> DecisionEntrada.FUERA
    }

    /**
     * Una comprobación durante la estancia. La salida se confirma con dos comprobaciones seguidas
     * fuera del radio más el margen, y su hora es la primera señal de salida (WiFi o primera lectura fuera).
     * Una lectura dentro lo reinicia todo; una dudosa o imprecisa no cuenta ni reinicia.
     */
    fun evaluarSalida(g: Gimnasio, p: Presencia, l: Lectura?, senalWifi: Long? = null): ResultadoSalida {
        val conSenal = if (senalWifi != null && p.primeraSenalSalida == null) p.copy(primeraSenalSalida = senalWifi) else p
        if (l == null) return ResultadoSalida(DecisionSalida.SIN_UBICACION, conSenal)
        if (l.precisionM > PRECISION_MAXIMA_M) return ResultadoSalida(DecisionSalida.IMPRECISA, conSenal)
        if (dentro(g, l)) return ResultadoSalida(DecisionSalida.DENTRO, Presencia(p.entrada))
        if (!fueraSeguro(g, l)) return ResultadoSalida(DecisionSalida.DUDOSA, conSenal)
        val fuera = conSenal.copy(
            fuerasSeguidas = conSenal.fuerasSeguidas + 1,
            primeraSenalSalida = conSenal.primeraSenalSalida ?: l.hora,
        )
        return if (fuera.fuerasSeguidas >= 2) {
            ResultadoSalida(DecisionSalida.SALIDA, fuera, fuera.primeraSenalSalida)
        } else {
            ResultadoSalida(DecisionSalida.PRIMERA_FUERA, fuera)
        }
    }

    /** Cuándo volver a comprobar, o null si ya no hace falta. */
    fun siguienteComprobacion(d: DecisionSalida): Long? = when (d) {
        DecisionSalida.SALIDA -> null
        DecisionSalida.PRIMERA_FUERA -> INTERVALO_CONFIRMAR_MS
        else -> INTERVALO_MS
    }

    fun estanciaCaducada(p: Presencia, ahora: Long): Boolean = ahora - p.entrada > TOPE_ESTANCIA_MS

    /**
     * Hora que manda MacroDroid en el extra "hora": acepta milisegundos o segundos. Si falta o es
     * absurda (más de 10 min en el futuro o de hace más de 1 h), vale la hora de recepción.
     */
    fun horaDelAviso(valor: String?, recibido: Long): Long {
        val n = valor?.trim()?.toLongOrNull() ?: return recibido
        val ms = if (n < 100_000_000_000L) n * 1000 else n
        return if (ms > recibido + 10 * 60_000 || ms < recibido - 3_600_000) recibido else ms
    }
}
