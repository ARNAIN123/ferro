package com.ferro.app.deteccion

import android.content.Context

/**
 * Orquesta la detección: aplica las Reglas a cada aviso o comprobación, guarda el resultado,
 * programa la siguiente comprobación y lo apunta todo en el registro. Nunca abre la app.
 * `fin` se llama siempre al terminar (los receptores lo usan para cerrar su goAsync).
 */
object Detector {

    /** MacroDroid avisa de que se ha abierto S3 FIT ZONE (o pruebo desde Ajustes). */
    fun alAbrirS3(ctx: Context, hora: Long, evento: String, fin: () -> Unit) {
        val g = Almacen.gimnasio(ctx)
        val previa = Reglas.previaEntrada(g, Almacen.ultimaEntrada(ctx), hora)
        if (previa != null || g == null) {
            Almacen.anotar(ctx, Anotacion(hora, evento, (previa ?: DecisionEntrada.SIN_GIMNASIO).texto))
            DeteccionPlugin.avisarCambio()
            return fin()
        }
        Ubicacion.leer(ctx) { lectura ->
            val decision = Reglas.decidirEntrada(g, lectura)
            val texto = if (lectura == null && !Ubicacion.tienePermisoSiempre(ctx)) {
                "Descartada: falta el permiso de ubicación «Permitir todo el tiempo»"
            } else {
                decision.texto
            }
            Almacen.anotar(ctx, Anotacion(hora, evento, texto, lectura?.let { Reglas.distanciaM(g, it) }, lectura?.precisionM))
            if (decision == DecisionEntrada.REGISTRADA) {
                Almacen.guardarUltimaEntrada(ctx, hora)
                Almacen.guardarPresencia(ctx, Presencia(entrada = hora))
                Almacen.encolarEntrada(ctx, hora)
                Alarmas.programar(ctx, Reglas.INTERVALO_MS)
                AvisosDeteccion.entrada(ctx, hora)
            }
            DeteccionPlugin.avisarCambio()
            fin()
        }
    }

    /** MacroDroid avisa de que el móvil se ha desconectado de la WiFi del gimnasio. */
    fun alDesconectarWifi(ctx: Context, hora: Long, evento: String, fin: () -> Unit) =
        comprobarSalida(ctx, evento, senalWifi = hora, hora = hora, fin = fin)

    /** Comprobación periódica (alarma) durante la estancia. */
    fun comprobar(ctx: Context, fin: () -> Unit) =
        comprobarSalida(ctx, "comprobacion", senalWifi = null, hora = System.currentTimeMillis(), fin = fin)

    private fun comprobarSalida(ctx: Context, evento: String, senalWifi: Long?, hora: Long, fin: () -> Unit) {
        val g = Almacen.gimnasio(ctx)
        val p = Almacen.presencia(ctx)
        if (g == null || p == null) {
            Alarmas.cancelar(ctx)
            if (evento != "comprobacion") Almacen.anotar(ctx, Anotacion(hora, evento, "Ignorado: no hay ninguna entrada abierta"))
            return fin()
        }
        if (Reglas.estanciaCaducada(p, hora)) {
            Almacen.guardarPresencia(ctx, null)
            Alarmas.cancelar(ctx)
            Almacen.anotar(ctx, Anotacion(hora, evento, "Sin salida detectada en 5 h: se deja de comprobar"))
            DeteccionPlugin.avisarCambio()
            return fin()
        }
        Ubicacion.leer(ctx) { lectura ->
            val r = Reglas.evaluarSalida(g, p, lectura, senalWifi)
            Almacen.anotar(ctx, Anotacion(hora, evento, r.decision.texto, lectura?.let { Reglas.distanciaM(g, it) }, lectura?.precisionM))
            val salida = r.horaSalida
            if (r.decision == DecisionSalida.SALIDA && salida != null) {
                Almacen.guardarPresencia(ctx, null)
                Almacen.encolarSalida(ctx, salida, p.entrada)
                Alarmas.cancelar(ctx)
                AvisosDeteccion.salida(ctx, salida)
            } else {
                Almacen.guardarPresencia(ctx, r.presencia)
                Reglas.siguienteComprobacion(r.decision)?.let { Alarmas.programar(ctx, it) }
            }
            DeteccionPlugin.avisarCambio()
            fin()
        }
    }
}
