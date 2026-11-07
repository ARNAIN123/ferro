import { Cabecera } from '../../components/Cabecera'

interface Credito {
  nombre: string
  uso: string
  licencia: string
  enlace: string
}

const SECCIONES: { titulo: string; creditos: Credito[] }[] = [
  {
    titulo: 'Ejercicios y cuerpo',
    creditos: [
      { nombre: 'Free Exercise DB', uso: 'Lista de ejercicios e instrucciones (traducidas). Sin sus fotos.', licencia: 'Dominio público (The Unlicense)', enlace: 'https://github.com/yuhonas/free-exercise-db' },
      { nombre: 'Open Muscle Map', uso: 'Base de la figura del avatar muscular.', licencia: 'MIT', enlace: 'https://github.com/PerspicaciousGuy/Open-Muscle-Map' },
      { nombre: 'three.js', uso: 'Visor 3D del avatar.', licencia: 'MIT', enlace: 'https://threejs.org' },
    ],
  },
  {
    titulo: 'Nutrición',
    creditos: [
      { nombre: 'USDA FoodData Central (SR Legacy)', uso: 'Valores de los alimentos genéricos, con nombres en español, estado y raciones añadidos.', licencia: 'Dominio público (CC0 1.0)', enlace: 'https://fdc.nal.usda.gov' },
      { nombre: 'Open Food Facts', uso: 'Productos por código de barras y búsqueda de marcas.', licencia: 'ODbL 1.0 (base de datos) · DbCL 1.0 (contenido)', enlace: 'https://world.openfoodfacts.org' },
      { nombre: 'Google ML Kit (code scanner)', uso: 'Lectura de códigos de barras, mediante @capacitor-mlkit/barcode-scanning.', licencia: 'Apache 2.0 · condiciones de Google', enlace: 'https://github.com/capawesome-team/capacitor-mlkit' },
      { nombre: 'SDK de Anthropic', uso: 'Interpretar comidas escritas, solo con tu propia clave.', licencia: 'Apache 2.0', enlace: 'https://github.com/anthropics/anthropic-sdk-typescript' },
    ],
  },
  {
    titulo: 'App',
    creditos: [
      { nombre: 'Capacitor y plugins', uso: 'App de Android, archivos, avisos y vibración.', licencia: 'MIT', enlace: 'https://capacitorjs.com' },
      { nombre: 'Health Connect (Jetpack)', uso: 'Pasos y peso de la báscula.', licencia: 'Apache 2.0', enlace: 'https://developer.android.com/health-and-fitness/guides/health-connect' },
    ],
  },
]

/** Créditos: de dónde sale cada dato y modelo, con su licencia. */
export function CreditosPage() {
  return (
    <div className="space-y-4 pb-6">
      <Cabecera titulo="Créditos" atras />
      {SECCIONES.map((s) => (
        <section key={s.titulo}>
          <h2 className="mb-1.5 px-1 text-sm font-semibold tracking-wide text-muted uppercase">{s.titulo}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {s.creditos.map((c) => (
              <li key={c.nombre} className="px-4 py-3">
                <a href={c.enlace} target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-2 active:underline">
                  {c.nombre}
                </a>
                <p className="text-sm">{c.uso}</p>
                <p className="text-xs text-muted">{c.licencia}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <a href="/licencias.txt" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl font-semibold text-accent active:bg-surface-2">
        Textos completos de las licencias
      </a>
    </div>
  )
}
