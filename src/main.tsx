import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { pedirPersistencia, prepararCatalogo } from './db/db'
import './index.css'

void pedirPersistencia()
void prepararCatalogo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
