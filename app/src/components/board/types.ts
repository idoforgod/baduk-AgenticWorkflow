// =============================================================================
// Board UI Component Types
// =============================================================================
// Shared prop interfaces and constants for all board components.
// Imports foundational types from @core/interfaces.
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  ExplanationOutput,
  MoveInfo,
  Player,
  PlayerTimerState,
  Tier,
} from '@core/interfaces'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KaTrain-inspired color scheme for move quality visualization */
export const KATRAIN_COLORS = {
  /** Good move (WR delta > -2%) */
  green: '#4CAF50',
  /** Slightly inaccurate (WR delta -2% to -5%) */
  blue: '#2196F3',
  /** Inaccuracy (WR delta -5% to -10%) */
  yellow: '#FFC107',
  /** Mistake (WR delta -10% to -15%) */
  orange: '#FF9800',
  /** Blunder (WR delta < -15%) */
  red: '#F44336',
} as const

/** GTP column letters (skips I to avoid confusion with 1) */
export const GTP_COLUMNS = 'ABCDEFGHJKLMNOPQRST'

/** Star point (hoshi) positions for each board size */
export const STAR_POINTS: Record<BoardSize, readonly number[]> = {
  9: [20, 24, 40, 56, 60], // (2,2), (2,6), (4,4), (6,2), (6,6)
  13: [42, 48, 84, 120, 126, 45, 81, 87, 123], // corners + sides + center
  19: [
    60,
    66,
    72, // row 3: D4, K4, Q4
    174,
    180,
    186, // row 9: D10, K10, Q10
    288,
    294,
    300, // row 15: D16, K16, Q16
  ],
}

// Pre-compute the actual star point positions more accurately
// 9x9: (2,2), (6,2), (4,4), (2,6), (6,6)
// 13x13: (3,3), (9,3), (6,6), (3,9), (9,9), (3,6), (6,3), (6,9), (9,6)
// 19x19: (3,3), (9,3), (15,3), (3,9), (9,9), (15,9), (3,15), (9,15), (15,15)

export function getStarPoints(size: BoardSize): readonly { row: number; col: number }[] {
  switch (size) {
    case 9:
      return [
        { row: 2, col: 2 },
        { row: 2, col: 6 },
        { row: 4, col: 4 },
        { row: 6, col: 2 },
        { row: 6, col: 6 },
      ]
    case 13:
      return [
        { row: 3, col: 3 },
        { row: 3, col: 6 },
        { row: 3, col: 9 },
        { row: 6, col: 3 },
        { row: 6, col: 6 },
        { row: 6, col: 9 },
        { row: 9, col: 3 },
        { row: 9, col: 6 },
        { row: 9, col: 9 },
      ]
    case 19:
      return [
        { row: 3, col: 3 },
        { row: 3, col: 9 },
        { row: 3, col: 15 },
        { row: 9, col: 3 },
        { row: 9, col: 9 },
        { row: 9, col: 15 },
        { row: 15, col: 3 },
        { row: 15, col: 9 },
        { row: 15, col: 15 },
      ]
  }
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Board layout configuration */
export interface BoardLayout {
  /** Total SVG width */
  readonly width: number
  /** Total SVG height */
  readonly height: number
  /** Padding around the board for coordinates */
  readonly padding: number
  /** Distance between grid lines */
  readonly cellSize: number
  /** Stone radius */
  readonly stoneRadius: number
  /** Board size (9, 13, or 19) */
  readonly boardSize: BoardSize
}

export function computeLayout(boardSize: BoardSize, svgSize: number = 500): BoardLayout {
  const padding = 30
  const usableSize = svgSize - 2 * padding
  const cellSize = usableSize / (boardSize - 1)
  const stoneRadius = cellSize * 0.47

  return {
    width: svgSize,
    height: svgSize,
    padding,
    cellSize,
    stoneRadius,
    boardSize,
  }
}

/** Convert board index to row, col */
export function indexToRowCol(index: number, boardSize: BoardSize): { row: number; col: number } {
  return {
    row: Math.floor(index / boardSize),
    col: index % boardSize,
  }
}

/** Convert row, col to SVG coordinates */
export function rowColToSvg(
  row: number,
  col: number,
  layout: BoardLayout
): { x: number; y: number } {
  return {
    x: layout.padding + col * layout.cellSize,
    y: layout.padding + row * layout.cellSize,
  }
}

/** Convert SVG coordinates to row, col (nearest intersection) */
export function svgToRowCol(
  svgX: number,
  svgY: number,
  layout: BoardLayout
): { row: number; col: number } | null {
  const col = Math.round((svgX - layout.padding) / layout.cellSize)
  const row = Math.round((svgY - layout.padding) / layout.cellSize)

  if (row < 0 || row >= layout.boardSize || col < 0 || col >= layout.boardSize) {
    return null
  }

  return { row, col }
}

/** Convert row, col to board index */
export function rowColToIndex(row: number, col: number, boardSize: BoardSize): number {
  return row * boardSize + col
}

// ---------------------------------------------------------------------------
// Marker types
// ---------------------------------------------------------------------------

export type MarkerShape = 'circle' | 'triangle' | 'square' | 'number' | 'letter'

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

export interface StoneProps {
  /** SVG center x coordinate */
  readonly cx: number
  /** SVG center y coordinate */
  readonly cy: number
  /** Stone radius */
  readonly r: number
  /** Stone color */
  readonly color: 'black' | 'white'
}

export interface MarkerProps {
  /** SVG center x coordinate */
  readonly cx: number
  /** SVG center y coordinate */
  readonly cy: number
  /** Marker size (radius for circle, side for square) */
  readonly size: number
  /** Marker shape */
  readonly shape: MarkerShape
  /** Text to display (for number/letter markers) */
  readonly text?: string
  /** Marker color */
  readonly color?: string
}

export interface CoordinatesProps {
  readonly layout: BoardLayout
}

export interface HeatmapProps {
  readonly layout: BoardLayout
  /** Array of MoveInfo objects from KataGo analysis */
  readonly moveInfos: readonly MoveInfo[]
  /** Board size for coordinate conversion */
  readonly boardSize: BoardSize
}

export interface LastMoveMarkerProps {
  /** SVG center x */
  readonly cx: number
  /** SVG center y */
  readonly cy: number
  /** Size of the marker */
  readonly size: number
  /** Color of the stone the marker is on */
  readonly stoneColor: 'black' | 'white'
}

export interface BranchMarkerProps {
  readonly layout: BoardLayout
  readonly boardSize: BoardSize
  /** Branch moves to display with labels */
  readonly branches: readonly { index: number; label: string; winrate?: number }[]
}

export interface GhostStoneProps {
  /** SVG center x */
  readonly cx: number
  /** SVG center y */
  readonly cy: number
  /** Stone radius */
  readonly r: number
  /** Stone color */
  readonly color: 'black' | 'white'
}

export interface TerritoryOverlayProps {
  readonly layout: BoardLayout
  readonly boardSize: BoardSize
  /** Board indices classified as black territory */
  readonly blackTerritory: ReadonlySet<number>
  /** Board indices classified as white territory */
  readonly whiteTerritory: ReadonlySet<number>
}

export interface DeadStoneMarkerProps {
  readonly layout: BoardLayout
  readonly boardSize: BoardSize
  /** Board indices of dead stones */
  readonly deadStones: ReadonlySet<number>
}

export interface PassButtonProps {
  readonly onClick: () => void
  readonly disabled?: boolean
}

export interface ResignButtonProps {
  readonly onClick: () => void
  readonly disabled?: boolean
}

export interface UndoButtonProps {
  readonly onClick: () => void
  readonly disabled?: boolean
}

export interface TimerDisplayProps {
  readonly playerTimer: PlayerTimerState
  readonly isActive: boolean
  readonly playerColor: Player
}

export interface CaptureCounterProps {
  readonly blackCaptures: number
  readonly whiteCaptures: number
}

export interface KomiDisplayProps {
  readonly komi: number
}

export interface PlayerInfoProps {
  readonly name: string
  readonly color: Player
  readonly rank?: string
  readonly isCurrentTurn: boolean
}

export interface MoveNavigatorProps {
  readonly currentMove: number
  readonly totalMoves: number
  readonly onFirst: () => void
  readonly onPrev: () => void
  readonly onNext: () => void
  readonly onLast: () => void
  readonly onAutoPlay?: () => void
  readonly isAutoPlaying?: boolean
}

export interface WinRateGraphProps {
  /** Win rate data points per move. Values 0-100. */
  readonly data: readonly { move: number; blackWinRate: number }[]
  /** Width of the chart */
  readonly width?: number
  /** Height of the chart */
  readonly height?: number
  /** Currently selected move index (for highlight) */
  readonly currentMove?: number
}

export interface ExplanationCardProps {
  /** Explanation output from the explanation engine */
  readonly explanation: ExplanationOutput
  /** Currently selected tier */
  readonly tier: Tier
  /** Callback when tier changes */
  readonly onTierChange: (tier: Tier) => void
}

/** Main Board component props */
export interface BoardProps {
  /** Board size: 9, 13, or 19 */
  readonly boardSize: BoardSize
  /** Flat board array. grid[row * size + col] = CellState (0=empty, 1=black, 2=white) */
  readonly board: Uint8Array
  /** Callback when an intersection is clicked */
  readonly onIntersectionClick?: (index: number) => void
  /** Index of the last played move (for LastMoveMarker) */
  readonly lastMoveIndex?: number | null
  /** Index being previewed (GhostStone) */
  readonly previewIndex?: number | null
  /** Color for the ghost stone preview */
  readonly previewColor?: 'black' | 'white'
  /** Show coordinates (default true) */
  readonly showCoordinates?: boolean
  /** Analysis data for heatmap overlay */
  readonly analysisData?: AnalysisResponse | null
  /** Whether to show the heatmap */
  readonly showHeatmap?: boolean
  /** Territory overlay data */
  readonly blackTerritory?: ReadonlySet<number>
  readonly whiteTerritory?: ReadonlySet<number>
  /** Dead stone markers */
  readonly deadStones?: ReadonlySet<number>
  /** Branch markers */
  readonly branches?: readonly { index: number; label: string; winrate?: number }[]
  /** SVG size in pixels (default 500) */
  readonly svgSize?: number
  /** Whether interaction is enabled */
  readonly interactive?: boolean
  /** Policy network candidate moves to display as overlay */
  readonly candidates?: readonly {
    move: string
    index: number
    winRate: number
    scoreLead: number
    visits: number
    prior: number
  }[]
}
