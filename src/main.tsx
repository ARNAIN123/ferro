import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { pedirPersistencia, prepararCatalogo } from './db/db'
import './index.css'
import { iniciarNativo } from './lib/nativo'

void pedirPersistencia()
void prepararCatalogo()
void iniciarNativo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
