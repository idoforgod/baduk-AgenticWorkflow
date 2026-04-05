// =============================================================================
// Board UI Components — Test Suite
// =============================================================================
// 35+ tests covering rendering, interaction, and board sizes for all 20
// board components.
// =============================================================================

import type { ExplanationOutput, MoveInfo, PlayerTimerState } from '@core/interfaces'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Board } from './Board'
import { BranchMarker } from './BranchMarker'
import { CaptureCounter } from './CaptureCounter'
import { Coordinates } from './Coordinates'
import { DeadStoneMarker } from './DeadStoneMarker'
import { ExplanationCard } from './ExplanationCard'
import { GhostStone } from './GhostStone'
import { Heatmap } from './Heatmap'
import { KomiDisplay } from './KomiDisplay'
import { LastMoveMarker } from './LastMoveMarker'
import { Marker } from './Marker'
import { MoveNavigator } from './MoveNavigator'
import { PassButton } from './PassButton'
import { PlayerInfo } from './PlayerInfo'
import { ResignButton } from './ResignButton'
import { Stone, StoneDefs } from './Stone'
import { TerritoryOverlay } from './TerritoryOverlay'
import { TimerDisplay } from './TimerDisplay'
import {
  computeLayout,
  getStarPoints,
  indexToRowCol,
  rowColToIndex,
  rowColToSvg,
  svgToRowCol,
} from './types'
import { UndoButton } from './UndoButton'
import { WinRateGraph } from './WinRateGraph'

// ---------------------------------------------------------------------------
// Helper: wrap SVG components in an <svg> element for rendering
// ---------------------------------------------------------------------------
function renderSvg(children: React.ReactNode) {
  return render(
    <svg>
      <title>Test</title>
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// 1. Types & Utilities
// ---------------------------------------------------------------------------
describe('Board utility functions', () => {
  it('computeLayout returns correct dimensions for 9x9', () => {
    const layout = computeLayout(9, 500)
    expect(layout.boardSize).toBe(9)
    expect(layout.width).toBe(500)
    expect(layout.height).toBe(500)
    expect(layout.padding).toBe(30)
    expect(layout.cellSize).toBeCloseTo((500 - 60) / 8)
  })

  it('computeLayout returns correct dimensions for 19x19', () => {
    const layout = computeLayout(19, 500)
    expect(layout.boardSize).toBe(19)
    expect(layout.cellSize).toBeCloseTo((500 - 60) / 18)
  })

  it('indexToRowCol converts correctly', () => {
    expect(indexToRowCol(0, 9)).toEqual({ row: 0, col: 0 })
    expect(indexToRowCol(8, 9)).toEqual({ row: 0, col: 8 })
    expect(indexToRowCol(9, 9)).toEqual({ row: 1, col: 0 })
    expect(indexToRowCol(80, 9)).toEqual({ row: 8, col: 8 })
  })

  it('rowColToIndex is the inverse of indexToRowCol', () => {
    for (let i = 0; i < 81; i++) {
      const { row, col } = indexToRowCol(i, 9)
      expect(rowColToIndex(row, col, 9)).toBe(i)
    }
  })

  it('rowColToSvg maps correctly', () => {
    const layout = computeLayout(9, 500)
    const origin = rowColToSvg(0, 0, layout)
    expect(origin.x).toBe(layout.padding)
    expect(origin.y).toBe(layout.padding)

    const end = rowColToSvg(8, 8, layout)
    expect(end.x).toBeCloseTo(layout.padding + 8 * layout.cellSize)
    expect(end.y).toBeCloseTo(layout.padding + 8 * layout.cellSize)
  })

  it('svgToRowCol returns correct intersection', () => {
    const layout = computeLayout(9, 500)
    const pos = svgToRowCol(layout.padding, layout.padding, layout)
    expect(pos).toEqual({ row: 0, col: 0 })
  })

  it('svgToRowCol returns null for out-of-bounds', () => {
    const layout = computeLayout(9, 500)
    expect(svgToRowCol(-10, -10, layout)).toBeNull()
    expect(svgToRowCol(600, 600, layout)).toBeNull()
  })

  it('getStarPoints returns 5 points for 9x9', () => {
    const points = getStarPoints(9)
    expect(points).toHaveLength(5)
    // Center point
    expect(points).toContainEqual({ row: 4, col: 4 })
  })

  it('getStarPoints returns 9 points for 13x13', () => {
    expect(getStarPoints(13)).toHaveLength(9)
  })

  it('getStarPoints returns 9 points for 19x19', () => {
    const points = getStarPoints(19)
    expect(points).toHaveLength(9)
    // Tengen (center)
    expect(points).toContainEqual({ row: 9, col: 9 })
  })
})

// ---------------------------------------------------------------------------
// 2. Stone
// ---------------------------------------------------------------------------
describe('Stone', () => {
  it('renders a black stone', () => {
    renderSvg(<Stone cx={100} cy={100} r={20} color="black" />)
    const stone = screen.getByTestId('stone-black')
    expect(stone).toBeInTheDocument()
    expect(stone.tagName).toBe('circle')
  })

  it('renders a white stone with stroke', () => {
    renderSvg(<Stone cx={100} cy={100} r={20} color="white" />)
    const stone = screen.getByTestId('stone-white')
    expect(stone).toBeInTheDocument()
    expect(stone.getAttribute('stroke')).toBe('#888')
  })
})

describe('StoneDefs', () => {
  it('renders gradient and filter defs', () => {
    const { container } = renderSvg(<StoneDefs />)
    const defs = container.querySelector('defs')
    expect(defs).toBeInTheDocument()
    expect(container.querySelector('#stone-gradient-black')).toBeInTheDocument()
    expect(container.querySelector('#stone-gradient-white')).toBeInTheDocument()
    expect(container.querySelector('#stone-shadow')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 3. Marker
// ---------------------------------------------------------------------------
describe('Marker', () => {
  it('renders circle marker', () => {
    renderSvg(<Marker cx={100} cy={100} size={20} shape="circle" />)
    expect(screen.getByTestId('marker-circle')).toBeInTheDocument()
  })

  it('renders triangle marker', () => {
    renderSvg(<Marker cx={100} cy={100} size={20} shape="triangle" />)
    expect(screen.getByTestId('marker-triangle')).toBeInTheDocument()
  })

  it('renders square marker', () => {
    renderSvg(<Marker cx={100} cy={100} size={20} shape="square" />)
    expect(screen.getByTestId('marker-square')).toBeInTheDocument()
  })

  it('renders number marker with text', () => {
    renderSvg(<Marker cx={100} cy={100} size={20} shape="number" text="42" />)
    const marker = screen.getByTestId('marker-number')
    expect(marker).toBeInTheDocument()
    expect(marker.textContent).toBe('42')
  })

  it('renders letter marker with text', () => {
    renderSvg(<Marker cx={100} cy={100} size={20} shape="letter" text="A" />)
    const marker = screen.getByTestId('marker-letter')
    expect(marker.textContent).toBe('A')
  })
})

// ---------------------------------------------------------------------------
// 4. Coordinates
// ---------------------------------------------------------------------------
describe('Coordinates', () => {
  it('renders coordinate labels', () => {
    const layout = computeLayout(9, 500)
    renderSvg(<Coordinates layout={layout} />)
    expect(screen.getByTestId('coordinates')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 5. Heatmap
// ---------------------------------------------------------------------------
describe('Heatmap', () => {
  const baseMoveInfo: MoveInfo = {
    move: 'D4',
    visits: 100,
    edgeVisits: 100,
    winrate: 0.55,
    scoreMean: 3.5,
    scoreLead: 3.5,
    scoreStdev: 1.0,
    scoreSelfplay: 3.5,
    prior: 0.1,
    utility: 0.3,
    utilityLcb: 0.25,
    lcb: 0.5,
    weight: 100,
    edgeWeight: 100,
    order: 0,
    playSelectionValue: 100,
    pv: ['D4', 'E5'],
  }

  it('renders heatmap dots', () => {
    const layout = computeLayout(9, 500)
    const moveInfos: MoveInfo[] = [
      { ...baseMoveInfo, move: 'D4', winrate: 0.55 },
      { ...baseMoveInfo, move: 'E5', winrate: 0.5, visits: 50, order: 1 },
    ]
    renderSvg(<Heatmap layout={layout} moveInfos={moveInfos} boardSize={9} />)
    expect(screen.getByTestId('heatmap')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-dot-D4')).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-dot-E5')).toBeInTheDocument()
  })

  it('returns null for empty moveInfos', () => {
    const layout = computeLayout(9, 500)
    const { container } = renderSvg(<Heatmap layout={layout} moveInfos={[]} boardSize={9} />)
    expect(container.querySelector('[data-testid="heatmap"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6. LastMoveMarker
// ---------------------------------------------------------------------------
describe('LastMoveMarker', () => {
  it('renders a contrasting marker on black stone', () => {
    renderSvg(<LastMoveMarker cx={100} cy={100} size={20} stoneColor="black" />)
    const marker = screen.getByTestId('last-move-marker')
    expect(marker).toBeInTheDocument()
    expect(marker.getAttribute('stroke')).toBe('#ffffff')
  })

  it('renders a dark marker on white stone', () => {
    renderSvg(<LastMoveMarker cx={100} cy={100} size={20} stoneColor="white" />)
    const marker = screen.getByTestId('last-move-marker')
    expect(marker.getAttribute('stroke')).toBe('#000000')
  })
})

// ---------------------------------------------------------------------------
// 7. BranchMarker
// ---------------------------------------------------------------------------
describe('BranchMarker', () => {
  it('renders branch labels', () => {
    const layout = computeLayout(9, 500)
    const branches = [
      { index: 0, label: 'A', winrate: 0.55 },
      { index: 1, label: 'B', winrate: 0.5 },
    ]
    renderSvg(<BranchMarker layout={layout} boardSize={9} branches={branches} />)
    expect(screen.getByTestId('branch-A')).toBeInTheDocument()
    expect(screen.getByTestId('branch-B')).toBeInTheDocument()
  })

  it('returns null for empty branches', () => {
    const layout = computeLayout(9, 500)
    const { container } = renderSvg(<BranchMarker layout={layout} boardSize={9} branches={[]} />)
    expect(container.querySelector('[data-testid="branch-markers"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 8. GhostStone
// ---------------------------------------------------------------------------
describe('GhostStone', () => {
  it('renders a semi-transparent stone', () => {
    renderSvg(<GhostStone cx={100} cy={100} r={20} color="black" />)
    const ghost = screen.getByTestId('ghost-stone')
    expect(ghost).toBeInTheDocument()
    expect(ghost.getAttribute('opacity')).toBe('0.5')
  })
})

// ---------------------------------------------------------------------------
// 9. TerritoryOverlay
// ---------------------------------------------------------------------------
describe('TerritoryOverlay', () => {
  it('renders territory markers', () => {
    const layout = computeLayout(9, 500)
    renderSvg(
      <TerritoryOverlay
        layout={layout}
        boardSize={9}
        blackTerritory={new Set([0, 1, 2])}
        whiteTerritory={new Set([78, 79, 80])}
      />
    )
    expect(screen.getByTestId('territory-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('territory-black-0')).toBeInTheDocument()
    expect(screen.getByTestId('territory-white-80')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 10. DeadStoneMarker
// ---------------------------------------------------------------------------
describe('DeadStoneMarker', () => {
  it('renders X marks on dead stones', () => {
    const layout = computeLayout(9, 500)
    renderSvg(<DeadStoneMarker layout={layout} boardSize={9} deadStones={new Set([40, 41])} />)
    expect(screen.getByTestId('dead-stone-markers')).toBeInTheDocument()
    expect(screen.getByTestId('dead-stone-40')).toBeInTheDocument()
    expect(screen.getByTestId('dead-stone-41')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 11. PassButton
// ---------------------------------------------------------------------------
describe('PassButton', () => {
  it('renders and fires onClick', () => {
    const onClick = vi.fn()
    render(<PassButton onClick={onClick} />)
    const btn = screen.getByTestId('pass-button')
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toBe('Pass')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when prop set', () => {
    render(<PassButton onClick={vi.fn()} disabled />)
    expect(screen.getByTestId('pass-button')).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 12. ResignButton
// ---------------------------------------------------------------------------
describe('ResignButton', () => {
  it('renders and fires onClick', () => {
    const onClick = vi.fn()
    render(<ResignButton onClick={onClick} />)
    const btn = screen.getByTestId('resign-button')
    expect(btn.textContent).toBe('Resign')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when prop set', () => {
    render(<ResignButton onClick={vi.fn()} disabled />)
    expect(screen.getByTestId('resign-button')).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 13. UndoButton
// ---------------------------------------------------------------------------
describe('UndoButton', () => {
  it('renders and fires onClick', () => {
    const onClick = vi.fn()
    render(<UndoButton onClick={onClick} />)
    const btn = screen.getByTestId('undo-button')
    expect(btn.textContent).toBe('Undo')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 14. TimerDisplay
// ---------------------------------------------------------------------------
describe('TimerDisplay', () => {
  const baseTimer: PlayerTimerState = {
    mainTimeRemaining: 180,
    byoyomiPeriodsRemaining: 3,
    byoyomiTimeRemaining: 10,
    inByoyomi: false,
  }

  it('renders main time in MM:SS format', () => {
    render(<TimerDisplay playerTimer={baseTimer} isActive={true} playerColor="B" />)
    expect(screen.getByTestId('timer-time-B').textContent).toBe('03:00')
  })

  it('renders byoyomi info when in byoyomi', () => {
    const byoyomiTimer: PlayerTimerState = {
      mainTimeRemaining: 0,
      byoyomiPeriodsRemaining: 2,
      byoyomiTimeRemaining: 8,
      inByoyomi: true,
    }
    render(<TimerDisplay playerTimer={byoyomiTimer} isActive={true} playerColor="W" />)
    expect(screen.getByTestId('timer-byoyomi-W')).toBeInTheDocument()
  })

  it('shows white label for white player', () => {
    render(<TimerDisplay playerTimer={baseTimer} isActive={false} playerColor="W" />)
    expect(screen.getByTestId('timer-W')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 15. CaptureCounter
// ---------------------------------------------------------------------------
describe('CaptureCounter', () => {
  it('renders capture counts', () => {
    render(<CaptureCounter blackCaptures={5} whiteCaptures={3} />)
    expect(screen.getByTestId('captures-black').textContent).toBe('5')
    expect(screen.getByTestId('captures-white').textContent).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// 16. KomiDisplay
// ---------------------------------------------------------------------------
describe('KomiDisplay', () => {
  it('renders komi value', () => {
    render(<KomiDisplay komi={7.5} />)
    expect(screen.getByTestId('komi-value').textContent).toBe('7.5')
  })

  it('renders integer komi', () => {
    render(<KomiDisplay komi={0} />)
    expect(screen.getByTestId('komi-value').textContent).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// 17. PlayerInfo
// ---------------------------------------------------------------------------
describe('PlayerInfo', () => {
  it('renders player name and color', () => {
    render(<PlayerInfo name="Alice" color="B" isCurrentTurn={true} />)
    expect(screen.getByTestId('player-name-B').textContent).toBe('Alice')
  })

  it('renders rank when provided', () => {
    render(<PlayerInfo name="Bob" color="W" rank="5d" isCurrentTurn={false} />)
    expect(screen.getByTestId('player-rank-W').textContent).toBe('5d')
  })

  it('does not render rank when not provided', () => {
    render(<PlayerInfo name="Carol" color="B" isCurrentTurn={false} />)
    expect(screen.queryByTestId('player-rank-B')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 18. MoveNavigator
// ---------------------------------------------------------------------------
describe('MoveNavigator', () => {
  it('renders move counter', () => {
    render(
      <MoveNavigator
        currentMove={5}
        totalMoves={20}
        onFirst={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onLast={vi.fn()}
      />
    )
    expect(screen.getByTestId('nav-move-display').textContent).toBe('5 / 20')
  })

  it('disables prev/first at start', () => {
    render(
      <MoveNavigator
        currentMove={0}
        totalMoves={10}
        onFirst={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onLast={vi.fn()}
      />
    )
    expect(screen.getByTestId('nav-first')).toBeDisabled()
    expect(screen.getByTestId('nav-prev')).toBeDisabled()
    expect(screen.getByTestId('nav-next')).not.toBeDisabled()
  })

  it('disables next/last at end', () => {
    render(
      <MoveNavigator
        currentMove={10}
        totalMoves={10}
        onFirst={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onLast={vi.fn()}
      />
    )
    expect(screen.getByTestId('nav-next')).toBeDisabled()
    expect(screen.getByTestId('nav-last')).toBeDisabled()
    expect(screen.getByTestId('nav-first')).not.toBeDisabled()
  })

  it('fires navigation callbacks', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(
      <MoveNavigator
        currentMove={5}
        totalMoves={10}
        onFirst={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        onLast={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('nav-prev'))
    expect(onPrev).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('nav-next'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('renders autoplay button when provided', () => {
    render(
      <MoveNavigator
        currentMove={5}
        totalMoves={10}
        onFirst={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onLast={vi.fn()}
        onAutoPlay={vi.fn()}
        isAutoPlaying={false}
      />
    )
    expect(screen.getByTestId('nav-autoplay')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 19. WinRateGraph
// ---------------------------------------------------------------------------
describe('WinRateGraph', () => {
  it('renders empty state', () => {
    render(<WinRateGraph data={[]} />)
    expect(screen.getByTestId('winrate-graph-empty')).toBeInTheDocument()
  })

  it('renders graph with data', () => {
    const data = [
      { move: 1, blackWinRate: 50 },
      { move: 2, blackWinRate: 55 },
      { move: 3, blackWinRate: 48 },
    ]
    render(<WinRateGraph data={data} />)
    expect(screen.getByTestId('winrate-graph')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 20. ExplanationCard
// ---------------------------------------------------------------------------
describe('ExplanationCard', () => {
  const baseExplanation: ExplanationOutput = {
    text: 'This move strengthens your group in the corner.',
    matchedPatterns: ['P-T1-MQ-001'],
    category: 'move_quality',
    moveQuality: 'good',
    tier: 'beginner',
    computed: {
      winrateDelta: -1.5,
      scoreLeadDelta: -0.5,
      bestMovePlayed: false,
      moveRank: 2,
      topMoveGap: 0.03,
      movePhase: 'opening',
      confidenceLevel: 'high',
    },
    isMandatoryTemplate: false,
    usedLLMFallback: false,
  }

  it('renders explanation text', () => {
    render(<ExplanationCard explanation={baseExplanation} tier="beginner" onTierChange={vi.fn()} />)
    expect(screen.getByTestId('explanation-text').textContent).toBe(
      'This move strengthens your group in the corner.'
    )
  })

  it('renders move quality badge', () => {
    render(<ExplanationCard explanation={baseExplanation} tier="beginner" onTierChange={vi.fn()} />)
    expect(screen.getByTestId('move-quality-badge').textContent).toBe('good')
  })

  it('renders tier toggle buttons', () => {
    render(<ExplanationCard explanation={baseExplanation} tier="beginner" onTierChange={vi.fn()} />)
    expect(screen.getByTestId('tier-beginner')).toBeInTheDocument()
    expect(screen.getByTestId('tier-intermediate')).toBeInTheDocument()
    expect(screen.getByTestId('tier-advanced')).toBeInTheDocument()
  })

  it('fires onTierChange when tier button clicked', () => {
    const onTierChange = vi.fn()
    render(
      <ExplanationCard explanation={baseExplanation} tier="beginner" onTierChange={onTierChange} />
    )
    fireEvent.click(screen.getByTestId('tier-advanced'))
    expect(onTierChange).toHaveBeenCalledWith('advanced')
  })

  it('does not render quality badge when moveQuality is null', () => {
    const explanation: ExplanationOutput = {
      ...baseExplanation,
      moveQuality: null,
    }
    render(<ExplanationCard explanation={explanation} tier="beginner" onTierChange={vi.fn()} />)
    expect(screen.queryByTestId('move-quality-badge')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Board (main component)
// ---------------------------------------------------------------------------
describe('Board', () => {
  it('renders 9x9 board with grid lines and star points', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} />)
    expect(screen.getByTestId('go-board')).toBeInTheDocument()
    expect(screen.getByTestId('grid-lines')).toBeInTheDocument()
    expect(screen.getByTestId('star-points')).toBeInTheDocument()
  })

  it('renders 13x13 board', () => {
    const board = new Uint8Array(169)
    render(<Board boardSize={13} board={board} />)
    expect(screen.getByTestId('go-board')).toBeInTheDocument()
  })

  it('renders 19x19 board', () => {
    const board = new Uint8Array(361)
    render(<Board boardSize={19} board={board} />)
    expect(screen.getByTestId('go-board')).toBeInTheDocument()
  })

  it('renders stones on the board', () => {
    const board = new Uint8Array(81)
    board[0] = 1 // Black at top-left
    board[8] = 2 // White at top-right
    render(<Board boardSize={9} board={board} />)
    const blackStones = screen.getAllByTestId('stone-black')
    const whiteStones = screen.getAllByTestId('stone-white')
    expect(blackStones).toHaveLength(1)
    expect(whiteStones).toHaveLength(1)
  })

  it('renders coordinates when showCoordinates is true', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} showCoordinates={true} />)
    expect(screen.getByTestId('coordinates')).toBeInTheDocument()
  })

  it('does not render coordinates when showCoordinates is false', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} showCoordinates={false} />)
    expect(screen.queryByTestId('coordinates')).toBeNull()
  })

  it('renders last move marker', () => {
    const board = new Uint8Array(81)
    board[40] = 1 // Black at center
    render(<Board boardSize={9} board={board} lastMoveIndex={40} />)
    expect(screen.getByTestId('last-move-marker')).toBeInTheDocument()
  })

  it('does not render last move marker when lastMoveIndex is null', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} lastMoveIndex={null} />)
    expect(screen.queryByTestId('last-move-marker')).toBeNull()
  })

  it('renders ghost stone at preview position', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} previewIndex={20} previewColor="black" />)
    expect(screen.getByTestId('ghost-stone')).toBeInTheDocument()
  })

  it('renders click targets when interactive', () => {
    const board = new Uint8Array(81)
    const onClick = vi.fn()
    render(<Board boardSize={9} board={board} onIntersectionClick={onClick} interactive={true} />)
    expect(screen.getByTestId('click-targets')).toBeInTheDocument()
  })

  it('does not render click targets when not interactive', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} interactive={false} />)
    expect(screen.queryByTestId('click-targets')).toBeNull()
  })

  it('Tap-Preview-Confirm: first click shows ghost, second confirms', () => {
    const board = new Uint8Array(81)
    const onClick = vi.fn()
    render(<Board boardSize={9} board={board} onIntersectionClick={onClick} interactive={true} />)

    // First click: should not call onIntersectionClick, sets preview
    fireEvent.click(screen.getByTestId('intersection-20'))
    expect(onClick).not.toHaveBeenCalled()

    // Second click on same intersection: confirms the move
    fireEvent.click(screen.getByTestId('intersection-20'))
    expect(onClick).toHaveBeenCalledWith(20)
  })

  it('Tap-Preview-Confirm: clicking different intersection changes preview', () => {
    const board = new Uint8Array(81)
    const onClick = vi.fn()
    render(<Board boardSize={9} board={board} onIntersectionClick={onClick} interactive={true} />)

    // First click
    fireEvent.click(screen.getByTestId('intersection-20'))
    expect(onClick).not.toHaveBeenCalled()

    // Click different intersection: changes preview, does not confirm
    fireEvent.click(screen.getByTestId('intersection-30'))
    expect(onClick).not.toHaveBeenCalled()

    // Confirm the new preview
    fireEvent.click(screen.getByTestId('intersection-30'))
    expect(onClick).toHaveBeenCalledWith(30)
  })

  it('renders territory overlay when provided', () => {
    const board = new Uint8Array(81)
    render(
      <Board
        boardSize={9}
        board={board}
        blackTerritory={new Set([0, 1])}
        whiteTerritory={new Set([79, 80])}
      />
    )
    expect(screen.getByTestId('territory-overlay')).toBeInTheDocument()
  })

  it('renders dead stone markers when provided', () => {
    const board = new Uint8Array(81)
    board[40] = 1
    render(<Board boardSize={9} board={board} deadStones={new Set([40])} />)
    expect(screen.getByTestId('dead-stone-markers')).toBeInTheDocument()
  })

  it('renders branch markers when provided', () => {
    const board = new Uint8Array(81)
    const branches = [
      { index: 10, label: 'A', winrate: 0.55 },
      { index: 20, label: 'B', winrate: 0.5 },
    ]
    render(<Board boardSize={9} board={board} branches={branches} />)
    expect(screen.getByTestId('branch-markers')).toBeInTheDocument()
  })

  it('accepts custom SVG size via viewBox', () => {
    const board = new Uint8Array(81)
    render(<Board boardSize={9} board={board} svgSize={300} />)
    const svg = screen.getByTestId('go-board')
    // SVG is now responsive (no width/height attributes); size is controlled by viewBox
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 300')
  })
})
