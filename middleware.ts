// Contraseña para la web de Vercel (la app Android no pasa por aquí: lleva la web dentro).
// Autenticación básica del navegador: el usuario da igual y la contraseña es la variable de
// entorno FERRO_CLAVE del proyecto en Vercel (no está en el código, que es público).
// Es gratis: no usa la "Password Protection" de pago de Vercel.

export const config = { matcher: '/:path*' }

/** Respuesta que deja seguir la petición hacia la web (lo mismo que `next()` de @vercel/functions). */
const seguir = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

const pedirClave = (texto: string) =>
  new Response(texto, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Ferro", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

export default function middleware(request: Request): Response {
  const clave = process.env.FERRO_CLAVE
  // Sin contraseña configurada la web no se abre: mejor cerrada que abierta por error.
  if (!clave) return pedirClave('Ferro: falta configurar la contraseña (FERRO_CLAVE).')
  const [tipo, datos] = (request.headers.get('authorization') ?? '').split(' ')
  if (tipo === 'Basic' && datos) {
    try {
      const texto = new TextDecoder().decode(Uint8Array.from(atob(datos), (c) => c.charCodeAt(0)))
      if (texto.slice(texto.indexOf(':') + 1) === clave) return seguir()
    } catch {
      // Cabecera mal formada: se vuelve a pedir la contraseña.
    }
  }
  return pedirClave('Ferro: hace falta la contraseña.')
}
