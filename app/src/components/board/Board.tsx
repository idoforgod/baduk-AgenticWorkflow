// =============================================================================
// Board — Main SVG Go board component
// =============================================================================
// Composes all overlay components (stones, markers, heatmap, territory, etc.)
// Design: "Innovate around the board, not the board itself."
// The grid is clean and traditional; innovation lives in overlays.
// =============================================================================

import { useCallback, useRef, useState } from 'react'
import { BranchMarker } from './BranchMarker'
import { Coordinates } from './Coordinates'
import { DeadStoneMarker } from './DeadStoneMarker'
import { GhostStone } from './GhostStone'
import { Heatmap } from './Heatmap'
import { LastMoveMarker } from './LastMoveMarker'
import { PolicyOverlay } from './PolicyOverlay'
import { Stone, StoneDefs } from './Stone'
import { TerritoryOverlay } from './TerritoryOverlay'
import {
  type BoardLayout,
  type BoardProps,
  computeLayout,
  getStarPoints,
  indexToRowCol,
  rowColToIndex,
  rowColToSvg,
} from './types'

/**
 * Renders the SVG grid lines for the Go board.
 */
function GridLines({ layout }: { readonly layout: BoardLayout }) {
  const { boardSize, padding, cellSize } = layout
  const lines: JSX.Element[] = []
  const boardEnd = padding + (boardSize - 1) * cellSize

  // Horizontal lines
  for (let row = 0; row < boardSize; row++) {
    const y = padding + row * cellSize
    lines.push(
      <line
        key={`h-${row}`}
        x1={padding}
        y1={y}
        x2={boardEnd}
        y2={y}
        stroke="#333"
        strokeWidth={row === 0 || row === boardSize - 1 ? 1.5 : 0.8}
      />
    )
  }

  // Vertical lines
  for (let col = 0; col < boardSize; col++) {
    const x = padding + col * cellSize
    lines.push(
      <line
        key={`v-${col}`}
        x1={x}
        y1={padding}
        x2={x}
        y2={boardEnd}
        stroke="#333"
        strokeWidth={col === 0 || col === boardSize - 1 ? 1.5 : 0.8}
      />
    )
  }

  return <g data-testid="grid-lines">{lines}</g>
}

/**
 * Renders star points (hoshi) on the board.
 */
function StarPoints({ layout }: { readonly layout: BoardLayout }) {
  const points = getStarPoints(layout.boardSize)
  const r = Math.max(2.5, layout.cellSize * 0.08)

  return (
    <g data-testid="star-points">
      {points.map((p) => {
        const { x, y } = rowColToSvg(p.row, p.col, layout)
        return <circle key={`star-${p.row}-${p.col}`} cx={x} cy={y} r={r} fill="#333" />
      })}
    </g>
  )
}

/**
 * Invisible click targets covering each intersection for interaction.
 */
function ClickTargets({
  layout,
  onIntersectionClick,
}: {
  readonly layout: BoardLayout
  readonly onIntersectionClick: (index: number) => void
}) {
  const targets: JSX.Element[] = []
  const hitRadius = layout.cellSize * 0.45

  for (let row = 0; row < layout.boardSize; row++) {
    for (let col = 0; col < layout.boardSize; col++) {
      const { x, y } = rowColToSvg(row, col, layout)
      const index = rowColToIndex(row, col, layout.boardSize)
      targets.push(
        <circle
          key={`click-${index}`}
          cx={x}
          cy={y}
          r={hitRadius}
          fill="transparent"
          cursor="pointer"
          role="gridcell"
          onClick={() => onIntersectionClick(index)}
          data-testid={`intersection-${index}`}
        />
      )
    }
  }

  return <g data-testid="click-targets">{targets}</g>
}

/**
 * Main Go board SVG component.
 *
 * Supports 9x9, 13x13, 19x19 sizes. Renders grid lines, star points,
 * stones, and composes overlay components for analysis visualization.
 *
 * Interaction: Tap-Preview-Confirm pattern. First click shows a ghost
 * stone preview; second click on the same intersection confirms the move.
 * Clicking elsewhere cancels the preview.
 */
export function Board({
  boardSize,
  board,
  onIntersectionClick,
  lastMoveIndex,
  previewIndex,
  previewColor = 'black',
  showCoordinates = true,
  analysisData,
  showHeatmap = false,
  blackTerritory,
  whiteTerritory,
  deadStones,
  branches,
  svgSize = 500,
  interactive = true,
  candidates,
}: BoardProps) {
  const layout = computeLayout(boardSize, svgSize)
  const svgRef = useRef<SVGSVGElement>(null)

  // Tap-Preview-Confirm state
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  const handleIntersectionClick = useCallback(
    (index: number) => {
      if (!interactive || !onIntersectionClick) return

      // If clicking the same intersection as the preview, confirm the move
      if (previewIdx === index) {
        onIntersectionClick(index)
        setPreviewIdx(null)
        return
      }

      // Otherwise, set this as the new preview
      setPreviewIdx(index)
    },
    [interactive, onIntersectionClick, previewIdx]
  )

  // Use the externally provided preview if present, otherwise internal state
  const effectivePreviewIndex = previewIndex !== undefined ? previewIndex : previewIdx

  // Board background color (traditional wood)
  const boardBgColor = '#DEB887'

  return (
    <svg
      ref={svgRef}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      data-testid="go-board"
      style={{ userSelect: 'none', display: 'block' }}
    >
      <title>{`Go Board ${boardSize}×${boardSize}`}</title>
      {/* Board background */}
      <rect x={0} y={0} width={layout.width} height={layout.height} fill={boardBgColor} rx={4} />

      {/* SVG defs (gradients, filters) */}
      <StoneDefs />

      {/* Coordinates */}
      {showCoordinates && <Coordinates layout={layout} />}

      {/* Grid lines */}
      <GridLines layout={layout} />

      {/* Star points */}
      <StarPoints layout={layout} />

      {/* Heatmap overlay (behind stones) */}
      {showHeatmap && analysisData && (
        <Heatmap layout={layout} moveInfos={analysisData.moveInfos} boardSize={boardSize} />
      )}

      {/* Territory overlay */}
      {blackTerritory && whiteTerritory && (
        <TerritoryOverlay
          layout={layout}
          boardSize={boardSize}
          blackTerritory={blackTerritory}
          whiteTerritory={whiteTerritory}
        />
      )}

      {/* Stones */}
      {Array.from(board).map((cell, pos) => {
        if (cell === 0) return null
        const { row, col } = indexToRowCol(pos, boardSize)
        const { x, y } = rowColToSvg(row, col, layout)
        const color = cell === 1 ? 'black' : 'white'
        return (
          <Stone key={`stone-${row}-${col}`} cx={x} cy={y} r={layout.stoneRadius} color={color} />
        )
      })}

      {/* Dead stone markers */}
      {deadStones && deadStones.size > 0 && (
        <DeadStoneMarker layout={layout} boardSize={boardSize} deadStones={deadStones} />
      )}

      {/* Last move marker */}
      {lastMoveIndex != null &&
        lastMoveIndex >= 0 &&
        board[lastMoveIndex] !== 0 &&
        (() => {
          const { row, col } = indexToRowCol(lastMoveIndex, boardSize)
          const { x, y } = rowColToSvg(row, col, layout)
          const stoneColor = board[lastMoveIndex] === 1 ? ('black' as const) : ('white' as const)
          return (
            <LastMoveMarker cx={x} cy={y} size={layout.stoneRadius * 2} stoneColor={stoneColor} />
          )
        })()}

      {/* Ghost stone preview */}
      {effectivePreviewIndex != null &&
        board[effectivePreviewIndex] === 0 &&
        (() => {
          const { row, col } = indexToRowCol(effectivePreviewIndex, boardSize)
          const { x, y } = rowColToSvg(row, col, layout)
          return <GhostStone cx={x} cy={y} r={layout.stoneRadius} color={previewColor} />
        })()}

      {/* Branch markers */}
      {branches && branches.length > 0 && (
        <BranchMarker layout={layout} boardSize={boardSize} branches={branches} />
      )}

      {/* Policy network candidate moves */}
      {candidates && candidates.length > 0 && (
        <PolicyOverlay layout={layout} boardSize={boardSize} candidates={candidates} />
      )}

      {/* Interaction click targets (on top of everything) */}
      {interactive && onIntersectionClick && (
        <ClickTargets layout={layout} onIntersectionClick={handleIntersectionClick} />
      )}
    </svg>
  )
}
