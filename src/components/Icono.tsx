import type { ReactNode } from 'react'

const TRAZOS = {
  hoy: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  rutinas: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  progreso: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ajustes: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  puntos: (
    <>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" />
    </>
  ),
  arrastre: (
    <>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" />
    </>
  ),
  atras: <path d="M15 5 8 12l7 7" />,
  adelante: <path d="m9 5 7 7-7 7" />,
  abajo: <path d="m6 9 6 6 6-6" />,
  copiar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  archivar: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
    </>
  ),
  papelera: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  cambiar: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  saltar: <path d="m5 5 8 7-8 7zM19 5v14" />,
  aviso: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />,
  ubicacion: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  llama: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2-4.6.3 1.7 1.1 2.6 2 3.1-.6-2.9.2-5.8 1-8.5z" />,
  bascula: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0L12 12" />
    </>
  ),
  editar: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  historial: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  trofeo: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11" />
      <path d="M12 13v4M8 20h8M9.5 17h5" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  enlace: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />,
  mano: <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v6.5A7.5 7.5 0 0 1 9.5 21 5.5 5.5 0 0 1 5 18.5l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L8 16" />,
  nota: (
    <>
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M9 11h6M9 15h6M14 3v5h5" />
    </>
  ),
  descargar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  subir: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  cadena: <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />,
  bandera: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  nutricion: (
    <>
      <path d="M12 7.5c-1.5-1.3-3.4-1.6-5-.8C4.6 8 4 11.2 5.2 14.6 6.3 17.8 8.6 20.6 10.4 20c.7-.2 1-.6 1.6-.6s.9.4 1.6.6c1.8.6 4.1-2.2 5.2-5.4 1.2-3.4.6-6.6-1.8-7.9-1.6-.8-3.5-.5-5 .8z" />
      <path d="M12 7.5c0-2 .8-3.6 2.5-4.5" />
    </>
  ),
  codigo: <path d="M4 6v12M7 6v12M10 6v12M13 6v12M17 6v12M20 6v12M3 4h3M18 4h3M3 20h3M18 20h3" />,
  agua: <path d="M12 3.5c3.4 4.3 6 7.6 6 10.9a6 6 0 0 1-12 0c0-3.3 2.6-6.6 6-10.9z" />,
  chispa: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
} satisfies Record<string, ReactNode>

export type NombreIcono = keyof typeof TRAZOS

interface Props {
  nombre: NombreIcono
  className?: string
  tamano?: number
  grosor?: number
}

export function Icono({ nombre, className, tamano = 24, grosor = 2 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
