import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { pedirPersistencia, prepararCatalogo } from './db/db'
import './index.css'
import { iniciarNativo } from './lib/nativo'

void pedirPersistencia()
void prepararCatalogo()
void iniciarNativo()
// Las fotos de los ejercicios ya no se usan (ahora son animaciones): se libera su caché antigua.
if ('caches' in window) void caches.delete('ferro-imagenes').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
