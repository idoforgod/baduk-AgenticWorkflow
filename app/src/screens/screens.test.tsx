// =============================================================================
// screens/screens.test.tsx — Screen component tests
// =============================================================================
// Coverage: each screen renders, navigation works, settings controls work.
// Uses MemoryRouter to avoid BrowserRouter in tests.
// Mocks: @tauri-apps/api/core (invoke), react-router-dom navigation.
// =============================================================================

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// =============================================================================
// Mock Tauri invoke — MUST come before any import that uses it
// =============================================================================
const mockInvoke = vi.fn().mockResolvedValue(null)
vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

import { useGameStore } from '../game-engine/store'
import { AnalysisScreen } from './AnalysisScreen'
import { GameScreen } from './GameScreen'
// =============================================================================
// Import screens AFTER mocks
// =============================================================================
import { HomeScreen } from './HomeScreen'
import { Layout } from './Layout'
import { OnboardingScreen } from './OnboardingScreen'
import { QuickGoScreen } from './QuickGoScreen'
import { SettingsScreen } from './SettingsScreen'

// =============================================================================
// Test helpers
// =============================================================================

/** Wrap a component in MemoryRouter with an initial path */
function renderWithRouter(
  ui: React.ReactElement,
  {
    initialPath = '/',
    routes = [],
  }: { initialPath?: string; routes?: { path: string; element: React.ReactElement }[] } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={initialPath} element={ui} />
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Routes>
    </MemoryRouter>
  )
}

/** Wrap component inside a Layout (with nav) using MemoryRouter */
function renderInLayout(initialPath: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path={initialPath} element={element} />
          <Route path="/" element={<HomeScreen />} />
          <Route path="/quick-go" element={<QuickGoScreen />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/analysis/:id" element={<AnalysisScreen />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeEach(() => {
  // Reset game store to pristine state before each test
  useGameStore.getState().reset()
  mockInvoke.mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// 1. HomeScreen
// =============================================================================

describe('HomeScreen', () => {
  it('renders without crashing', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.getByText('Quick Go')).toBeInTheDocument()
  })

  it('shows the Quick Go start button', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.getByText(/Quick Go — Play Now/i)).toBeInTheDocument()
  })

  it('shows player stats section', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('Games')).toBeInTheDocument()
  })

  it('shows recent games list', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.getByText(/AI Lv\.5/)).toBeInTheDocument()
    expect(screen.getByText(/AI Lv\.8/)).toBeInTheDocument()
  })

  it('shows quick guide section', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.getByText('Quick Guide')).toBeInTheDocument()
    expect(screen.getByText('Place stones')).toBeInTheDocument()
  })

  it('does not show Resume Game button when no active game', () => {
    renderWithRouter(<HomeScreen />)
    expect(screen.queryByText(/Resume Game/i)).not.toBeInTheDocument()
  })
})

// =============================================================================
// 2. GameScreen
// =============================================================================

describe('GameScreen', () => {
  it('renders without crashing', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByTestId('board-placeholder')).toBeInTheDocument()
  })

  it('shows player info sections', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('AI Opponent')).toBeInTheDocument()
  })

  it('does not show game controls when no active game', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    // Game is not started — controls should be absent
    expect(screen.queryByTestId('pass-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resign-button')).not.toBeInTheDocument()
  })

  it('shows move history panel', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByText('Move History')).toBeInTheDocument()
    expect(screen.getByText('No moves yet')).toBeInTheDocument()
  })

  it('shows game info panel with board size', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByText('Game Info')).toBeInTheDocument()
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.getByText('9x9')).toBeInTheDocument()
  })

  it('shows prompt to start game when not playing', () => {
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByText(/No active game/i)).toBeInTheDocument()
  })

  it('shows game result banner when game is finished', () => {
    const store = useGameStore.getState()
    store.setResult({ winner: 'B', resultString: 'B+R', score: null, endReason: 'resignation' })
    renderWithRouter(<GameScreen />, { initialPath: '/game' })
    expect(screen.getByTestId('game-result-banner')).toBeInTheDocument()
    expect(screen.getByText(/B\+R/)).toBeInTheDocument()
  })
})

// =============================================================================
// 3. AnalysisScreen
// =============================================================================

describe('AnalysisScreen', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByText('Game Analysis')).toBeInTheDocument()
  })

  it('shows the board placeholder', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByTestId('board-placeholder')).toBeInTheDocument()
  })

  it('shows win rate graph placeholder', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByTestId('win-rate-graph')).toBeInTheDocument()
  })

  it('shows explanation cards in Summary tab', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByText('Your Best Move')).toBeInTheDocument()
    expect(screen.getByText('Biggest Mistake')).toBeInTheDocument()
    expect(screen.getByText('Key Moment')).toBeInTheDocument()
  })

  it('shows move counter with 0/0 when no game loaded', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByTestId('move-counter')).toHaveTextContent('0 / 0')
  })

  it('shows Play Again button', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    expect(screen.getByText('Play Again')).toBeInTheDocument()
  })

  it('renders both Summary and Moves tabs', () => {
    renderWithRouter(<AnalysisScreen />, { initialPath: '/analysis/abc' })
    // Both tabs must exist in DOM
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Moves' })).toBeInTheDocument()
    // Summary tab is active by default
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('data-state', 'active')
  })

  it('shows game id from URL params', () => {
    render(
      <MemoryRouter initialEntries={['/analysis/game-xyz-123']}>
        <Routes>
          <Route path="/analysis/:id" element={<AnalysisScreen />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText(/game-xyz-123/)).toBeInTheDocument()
  })
})

// =============================================================================
// 4. SettingsScreen
// =============================================================================

describe('SettingsScreen', () => {
  it('renders settings heading', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    // Wait for loading state to resolve
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  it('shows game configuration section', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByText('Game')).toBeInTheDocument()
    })
  })

  it('shows AI difficulty section with slider', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('ai-difficulty-slider')).toBeInTheDocument()
    })
  })

  it('slider has correct min/max range for 30 difficulty levels', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      const slider = screen.getByTestId('ai-difficulty-slider')
      expect(slider).toHaveAttribute('min', '1')
      expect(slider).toHaveAttribute('max', '30')
    })
  })

  it('shows theme toggle switch', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('theme-switch')).toBeInTheDocument()
    })
  })

  it('shows sound toggle switch', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('sound-switch')).toBeInTheDocument()
    })
  })

  it('shows Save button', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('save-settings-button')).toBeInTheDocument()
    })
  })

  it('AI difficulty slider fires onChange and updates label', async () => {
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('ai-difficulty-slider')).toBeInTheDocument()
    })
    const slider = screen.getByTestId('ai-difficulty-slider')
    fireEvent.change(slider, { target: { value: '25' } })
    // Level 25 is "Expert"
    await waitFor(() => {
      expect(screen.getAllByText('Expert').length).toBeGreaterThan(0)
    })
  })

  it('save button calls settings repository', async () => {
    mockInvoke.mockResolvedValue(undefined)
    renderWithRouter(<SettingsScreen />, { initialPath: '/settings' })
    await waitFor(() => {
      expect(screen.getByTestId('save-settings-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('save-settings-button'))
    await waitFor(() => {
      // setTypedSetting calls invoke via SettingsRepository
      expect(mockInvoke).toHaveBeenCalled()
    })
  })
})

// =============================================================================
// 5. QuickGoScreen
// =============================================================================

describe('QuickGoScreen', () => {
  it('renders without crashing', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    // "Quick Go" appears in both the heading and possibly nav links — use heading role
    expect(screen.getByRole('heading', { name: /Quick Go/i })).toBeInTheDocument()
  })

  it('shows board size selection', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    expect(screen.getByText('Board Size')).toBeInTheDocument()
    // Board sizes appear as button labels — getAllByText handles multiple occurrences
    expect(screen.getAllByText('9x9').length).toBeGreaterThan(0)
    expect(screen.getAllByText('13x13').length).toBeGreaterThan(0)
    expect(screen.getAllByText('19x19').length).toBeGreaterThan(0)
  })

  it('shows AI difficulty section', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    expect(screen.getByText('AI Difficulty')).toBeInTheDocument()
    expect(screen.getByText('Beginner')).toBeInTheDocument()
    expect(screen.getByText('Intermediate')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('shows time control section', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    expect(screen.getByText('Time Control')).toBeInTheDocument()
    expect(screen.getByText('Blitz')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Relaxed')).toBeInTheDocument()
  })

  it('has a Start Game button', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    expect(screen.getByTestId('start-game-button')).toBeInTheDocument()
  })

  it('9x9 board size is selected by default', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    const nineButton = screen.getByRole('button', { name: /9x9/i })
    expect(nineButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('Beginner difficulty is selected by default', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    const beginnerButton = screen.getByRole('button', { name: /Beginner/i })
    expect(beginnerButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('Standard time is selected by default', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    const standardButton = screen.getByRole('button', { name: /Standard/i })
    expect(standardButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('can change board size to 13x13', () => {
    renderWithRouter(<QuickGoScreen />, { initialPath: '/quick-go' })
    const thirteenButton = screen.getByRole('button', { name: /13x13/i })
    fireEvent.click(thirteenButton)
    expect(thirteenButton).toHaveAttribute('aria-pressed', 'true')
    const nineButton = screen.getByRole('button', { name: /9x9/i })
    expect(nineButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('Start Game navigates to /game', () => {
    // Render with routing so navigation can occur
    const { container } = render(
      <MemoryRouter initialEntries={['/quick-go']}>
        <Routes>
          <Route path="/quick-go" element={<QuickGoScreen />} />
          <Route path="/game" element={<div data-testid="game-screen-arrived" />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByTestId('start-game-button'))
    expect(container.querySelector('[data-testid="game-screen-arrived"]')).toBeInTheDocument()
  })
})

// =============================================================================
// 6. OnboardingScreen
// =============================================================================

describe('OnboardingScreen', () => {
  it('renders without crashing', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument()
  })

  it('shows first step title on load', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.getByText('Welcome to Baduk')).toBeInTheDocument()
  })

  it('shows step counter "Step 1 of 3"', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.getByTestId('onboarding-step-counter')).toHaveTextContent('Step 1 of 3')
  })

  it('shows Next button on first step', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.getByTestId('onboarding-next-button')).toHaveTextContent(/Next/i)
  })

  it('does not show Back button on first step', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.queryByTestId('onboarding-back-button')).not.toBeInTheDocument()
  })

  it('shows Skip button', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    expect(screen.getByTestId('skip-onboarding-button')).toBeInTheDocument()
  })

  it('advances to step 2 when Next is clicked', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByText('Quick Go Mode')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-step-counter')).toHaveTextContent('Step 2 of 3')
  })

  it('shows Back button after advancing past step 1', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByTestId('onboarding-back-button')).toBeInTheDocument()
  })

  it('goes back to step 1 when Back is clicked from step 2', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    fireEvent.click(screen.getByTestId('onboarding-back-button'))
    expect(screen.getByText('Welcome to Baduk')).toBeInTheDocument()
    expect(screen.getByTestId('onboarding-step-counter')).toHaveTextContent('Step 1 of 3')
  })

  it('advances through all 3 steps', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })

    // Step 1
    expect(screen.getByText('Welcome to Baduk')).toBeInTheDocument()

    // Step 2
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByText('Quick Go Mode')).toBeInTheDocument()

    // Step 3
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByText('Ready to Play')).toBeInTheDocument()
  })

  it('shows Get Started button on last step', () => {
    renderWithRouter(<OnboardingScreen />, { initialPath: '/onboarding' })
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByTestId('onboarding-next-button')).toHaveTextContent(/Get Started/i)
  })

  it('Skip button navigates to home', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/" element={<div data-testid="home-arrived" />} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByTestId('skip-onboarding-button'))
    expect(screen.getByTestId('home-arrived')).toBeInTheDocument()
  })

  it('Get Started on last step navigates to home', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/" element={<div data-testid="home-arrived" />} />
        </Routes>
      </MemoryRouter>
    )
    // Navigate to last step
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    // Click Get Started
    fireEvent.click(screen.getByTestId('onboarding-next-button'))
    expect(screen.getByTestId('home-arrived')).toBeInTheDocument()
  })
})

// =============================================================================
// 7. Layout (header navigation)
// =============================================================================

describe('Layout', () => {
  it('renders the Baduk header', () => {
    renderInLayout('/', <HomeScreen />)
    expect(screen.getByText('Baduk')).toBeInTheDocument()
  })

  it('shows all nav links', () => {
    renderInLayout('/', <HomeScreen />)
    // Home nav link: use aria-current to get the specific nav link
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument()
    // Quick Go appears in both nav and home page content — getAllByRole
    expect(screen.getAllByRole('link', { name: /Quick Go/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument()
  })

  it('marks the current route as active with aria-current', () => {
    renderInLayout('/', <HomeScreen />)
    const homeLink = screen.getAllByRole('link', { name: /Home/i })[0]
    expect(homeLink).toHaveAttribute('aria-current', 'page')
  })

  it('renders footer', () => {
    renderInLayout('/', <HomeScreen />)
    expect(screen.getByText(/Quick Go 9x9/)).toBeInTheDocument()
  })
})
