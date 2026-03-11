// =============================================================================
// screens/AppRouter.tsx — Application route definitions
// =============================================================================

import { HashRouter, Route, Routes } from 'react-router-dom'
import { AnalysisScreen } from './AnalysisScreen'
import { GameScreen } from './GameScreen'
import { HomeScreen } from './HomeScreen'
import { Layout } from './Layout'
import { OnboardingScreen } from './OnboardingScreen'
import { QuickGoScreen } from './QuickGoScreen'
import { SettingsScreen } from './SettingsScreen'

/**
 * Route map:
 *   /                  → HomeScreen
 *   /game              → GameScreen (new game)
 *   /game/:id          → GameScreen (load saved game)
 *   /analysis/:id      → AnalysisScreen
 *   /settings          → SettingsScreen
 *   /quick-go          → QuickGoScreen
 *   /onboarding        → OnboardingScreen
 */
export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        {/* Onboarding is full-screen (no shared layout) */}
        <Route path="/onboarding" element={<OnboardingScreen />} />

        {/* All other routes share the Layout wrapper */}
        <Route element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/game/:id" element={<GameScreen />} />
          <Route path="/analysis/:id" element={<AnalysisScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/quick-go" element={<QuickGoScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
