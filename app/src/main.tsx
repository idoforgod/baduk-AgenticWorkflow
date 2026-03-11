import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { configureGameStore } from './game-engine/store'
import { createRulesEngine } from './rules-engine'
import './styles/globals.css'

// Bootstrap: inject rules engine into game store before rendering
const rulesEngine = createRulesEngine()
configureGameStore(rulesEngine)

const root = document.getElementById('root')
if (!root) {
  throw new Error('[main] #root element not found in DOM — check index.html')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
