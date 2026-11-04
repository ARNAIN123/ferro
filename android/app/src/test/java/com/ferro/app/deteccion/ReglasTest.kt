package com.ferro.app.deteccion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReglasTest {
    // Gimnasio de prueba en Madrid. 0,001° de latitud ≈ 111 m.
    private val gym = Gimnasio(lat = 40.4168, lng = -3.7038, radioM = 150.0, margenSalidaM = 150.0, horasEntreEntradas = 3.0)
    private val h = 1_730_000_000_000L
    private fun aMetros(norte: Double, precision: Double = 15.0, hora: Long = h) =
        Lectura(gym.lat + norte / 111_195.0, gym.lng, precision, hora)

    @Test
    fun distancia() {
        assertEquals(111_195.0, Reglas.distanciaM(40.0, -3.0, 41.0, -3.0), 50.0)
        assertEquals(300.0, Reglas.distanciaM(gym, aMetros(300.0)), 1.0)
        assertEquals(0.0, Reglas.distanciaM(gym, aMetros(0.0)), 0.001)
    }

    @Test
    fun entradaDentroYFueraDelRadio() {
        assertEquals(DecisionEntrada.REGISTRADA, Reglas.decidirEntrada(gym, aMetros(0.0)))
        assertEquals(DecisionEntrada.REGISTRADA, Reglas.decidirEntrada(gym, aMetros(140.0)))
        assertEquals(DecisionEntrada.FUERA, Reglas.decidirEntrada(gym, aMetros(170.0, precision = 10.0)))
        // En casa (a 2 km) no se registra nada.
        assertEquals(DecisionEntrada.FUERA, Reglas.decidirEntrada(gym, aMetros(2_000.0)))
    }

    @Test
    fun entradaTieneEnCuentaLaPrecision() {
        // A 180 m con 40 m de error: puede estar dentro.
        assertEquals(DecisionEntrada.REGISTRADA, Reglas.decidirEntrada(gym, aMetros(180.0, precision = 40.0)))
        // La tolerancia no pasa de 50 m aunque el error sea mayor.
        assertEquals(DecisionEntrada.FUERA, Reglas.decidirEntrada(gym, aMetros(210.0, precision = 150.0)))
        // Lecturas peores de 200 m no deciden.
        assertEquals(DecisionEntrada.IMPRECISA, Reglas.decidirEntrada(gym, aMetros(0.0, precision = 250.0)))
        assertEquals(DecisionEntrada.SIN_UBICACION, Reglas.decidirEntrada(gym, null))
    }

    @Test
    fun deduplicacionDeEntradas() {
        assertEquals(DecisionEntrada.SIN_GIMNASIO, Reglas.previaEntrada(null, null, h))
        assertNull(Reglas.previaEntrada(gym, null, h))
        val haceDosHoras = h - 2 * 3_600_000L
        assertEquals(DecisionEntrada.DUPLICADA, Reglas.previaEntrada(gym, haceDosHoras, h))
        assertEquals(DecisionEntrada.DUPLICADA, Reglas.previaEntrada(gym, h - (3 * 3_600_000L - 60_000), h))
        assertNull(Reglas.previaEntrada(gym, h - (3 * 3_600_000L + 60_000), h))
    }

    @Test
    fun salidaConDosComprobacionesSeguidasFuera() {
        val p = Presencia(entrada = h)
        val primera = Reglas.evaluarSalida(gym, p, aMetros(500.0, hora = h + 60 * 60_000))
        assertEquals(DecisionSalida.PRIMERA_FUERA, primera.decision)
        val segunda = Reglas.evaluarSalida(gym, primera.presencia, aMetros(900.0, hora = h + 64 * 60_000))
        assertEquals(DecisionSalida.SALIDA, segunda.decision)
        // La hora de salida es la de la primera señal, no la de la confirmación.
        assertEquals(h + 60 * 60_000, segunda.horaSalida)
    }

    @Test
    fun salidaDesdeLaWifiUsaLaHoraDeLaDesconexion() {
        val p = Presencia(entrada = h)
        val wifi = h + 70 * 60_000
        val r1 = Reglas.evaluarSalida(gym, p, aMetros(400.0, hora = wifi + 20_000), senalWifi = wifi)
        assertEquals(DecisionSalida.PRIMERA_FUERA, r1.decision)
        val r2 = Reglas.evaluarSalida(gym, r1.presencia, aMetros(1_200.0, hora = wifi + 5 * 60_000))
        assertEquals(DecisionSalida.SALIDA, r2.decision)
        assertEquals(wifi, r2.horaSalida)
    }

    @Test
    fun unaLecturaDentroReiniciaLaCuenta() {
        val p = Presencia(entrada = h)
        val fuera = Reglas.evaluarSalida(gym, p, aMetros(500.0, hora = h + 30 * 60_000))
        val dentro = Reglas.evaluarSalida(gym, fuera.presencia, aMetros(20.0, hora = h + 34 * 60_000))
        assertEquals(DecisionSalida.DENTRO, dentro.decision)
        assertEquals(Presencia(entrada = h), dentro.presencia)
        // La WiFi se desconectó pero sigo dentro: no hay salida.
        val wifiDentro = Reglas.evaluarSalida(gym, p, aMetros(30.0), senalWifi = h + 40 * 60_000)
        assertEquals(DecisionSalida.DENTRO, wifiDentro.decision)
        assertNull(wifiDentro.presencia.primeraSenalSalida)
    }

    @Test
    fun cercaDelLimiteOImprecisaNoDecide() {
        val p = Presencia(entrada = h)
        // A 250 m: fuera del radio pero dentro de radio + margen (300 m).
        val dudosa = Reglas.evaluarSalida(gym, p, aMetros(250.0))
        assertEquals(DecisionSalida.DUDOSA, dudosa.decision)
        assertEquals(0, dudosa.presencia.fuerasSeguidas)
        // A 350 m pero con 80 m de error: podría estar a menos de 300.
        assertEquals(DecisionSalida.DUDOSA, Reglas.evaluarSalida(gym, p, aMetros(350.0, precision = 80.0)).decision)
        assertEquals(DecisionSalida.IMPRECISA, Reglas.evaluarSalida(gym, p, aMetros(900.0, precision = 400.0)).decision)
        assertEquals(DecisionSalida.SIN_UBICACION, Reglas.evaluarSalida(gym, p, null).decision)
        // Una dudosa entre dos lecturas fuera no impide confirmar.
        val f1 = Reglas.evaluarSalida(gym, p, aMetros(600.0, hora = h + 10))
        val d = Reglas.evaluarSalida(gym, f1.presencia, aMetros(260.0, hora = h + 20))
        val f2 = Reglas.evaluarSalida(gym, d.presencia, aMetros(700.0, hora = h + 30))
        assertEquals(DecisionSalida.SALIDA, f2.decision)
        assertEquals(h + 10, f2.horaSalida)
    }

    @Test
    fun ritmoDeComprobaciones() {
        assertEquals(Reglas.INTERVALO_CONFIRMAR_MS, Reglas.siguienteComprobacion(DecisionSalida.PRIMERA_FUERA))
        assertEquals(Reglas.INTERVALO_MS, Reglas.siguienteComprobacion(DecisionSalida.DENTRO))
        assertNull(Reglas.siguienteComprobacion(DecisionSalida.SALIDA))
        assertTrue(Reglas.INTERVALO_MS in 10 * 60_000L..15 * 60_000L)
        assertFalse(Reglas.estanciaCaducada(Presencia(h), h + 4 * 3_600_000L))
        assertTrue(Reglas.estanciaCaducada(Presencia(h), h + 6 * 3_600_000L))
    }

    @Test
    fun horaQueMandaMacroDroid() {
        val recibido = 1_730_000_000_000L
        assertEquals(recibido - 2_000, Reglas.horaDelAviso("${recibido - 2_000}", recibido))
        assertEquals(1_729_999_990_000L, Reglas.horaDelAviso("1729999990", recibido))
        assertEquals(recibido, Reglas.horaDelAviso(null, recibido))
        assertEquals(recibido, Reglas.horaDelAviso("{system_time}", recibido))
        assertEquals(recibido, Reglas.horaDelAviso("${recibido + 3_600_000}", recibido))
    }

    @Test
    fun laMejorLecturaEsLaMasPrecisa() {
        val a = aMetros(0.0, precision = 80.0)
        val b = aMetros(0.0, precision = 12.0)
        assertEquals(b, Reglas.mejor(a, b))
        assertEquals(a, Reglas.mejor(a, null))
        assertNull(Reglas.mejor(null, null))
    }
}
