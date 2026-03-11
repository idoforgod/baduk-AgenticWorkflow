// =============================================================================
// Board UI Components — Public API Barrel Export
// =============================================================================
// 20 React components for the Go board UI (Step 17 implementation).
// All components are SVG-based (board rendering) or HTML (controls/panels).
// =============================================================================

// --- Board Core ---
export { Board } from './Board'
// --- Backward compatibility ---
export type { BoardPlaceholderProps } from './BoardPlaceholder'
export { BoardPlaceholder } from './BoardPlaceholder'
export { BranchMarker } from './BranchMarker'
export { CaptureCounter } from './CaptureCounter'
export { Coordinates } from './Coordinates'
export { DeadStoneMarker } from './DeadStoneMarker'
export { ExplanationCard } from './ExplanationCard'
export { GhostStone } from './GhostStone'
// --- Board Overlays ---
export { Heatmap } from './Heatmap'
export { KomiDisplay } from './KomiDisplay'
export { LastMoveMarker } from './LastMoveMarker'
export { Marker } from './Marker'
export { MoveNavigator } from './MoveNavigator'
// --- Action Buttons ---
export { PassButton } from './PassButton'
export { PlayerInfo } from './PlayerInfo'
export { ResignButton } from './ResignButton'
export { Stone, StoneDefs } from './Stone'
export { TerritoryOverlay } from './TerritoryOverlay'
// --- Information Displays ---
export { TimerDisplay } from './TimerDisplay'
// --- Types ---
export type {
  BoardLayout,
  BoardProps,
  BranchMarkerProps,
  CaptureCounterProps,
  CoordinatesProps,
  DeadStoneMarkerProps,
  ExplanationCardProps,
  GhostStoneProps,
  HeatmapProps,
  KomiDisplayProps,
  LastMoveMarkerProps,
  MarkerProps,
  MarkerShape,
  MoveNavigatorProps,
  PassButtonProps,
  PlayerInfoProps,
  ResignButtonProps,
  StoneProps,
  TerritoryOverlayProps,
  TimerDisplayProps,
  UndoButtonProps,
  WinRateGraphProps,
} from './types'
export {
  computeLayout,
  GTP_COLUMNS,
  getStarPoints,
  indexToRowCol,
  KATRAIN_COLORS,
  rowColToIndex,
  rowColToSvg,
  svgToRowCol,
} from './types'
export { UndoButton } from './UndoButton'
// --- Analysis Panels ---
export { WinRateGraph } from './WinRateGraph'
