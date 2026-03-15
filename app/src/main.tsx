import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { saveGameToStorage } from './db/adapters/save-game-adapter'
import { configureGameStore } from './game-engine/store'
import { createRulesEngine } from './rules-engine'
import './styles/globals.css'

// Bootstrap: inject rules engine + save adapter into game store before rendering
const rulesEngine = createRulesEngine()

// saveGameFn adapter: store calls with (gameId, moves), adapter reads full state
const saveGameFn = async (gameId: string, _moves: unknown): Promise<boolean> => {
  return saveGameToStorage(gameId)
}

configureGameStore(rulesEngine, saveGameFn)

const root = document.getElementById('root')
if (!root) {
  throw new Error('[main] #root element not found in DOM — check index.html')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
