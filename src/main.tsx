import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { completarBiblioteca, pedirPersistencia } from './db/db'
import './index.css'

void pedirPersistencia()
void completarBiblioteca()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
