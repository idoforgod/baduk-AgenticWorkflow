// =============================================================================
// components/board/CoachPanel.tsx — AI Coach Commentary Panel
// =============================================================================
// Chat-bubble style coaching panel that displays coaching messages.
// - Emotion-based styling (positive=green, cautionary=orange, encouraging=blue, neutral=default)
// - Collapsible (default: expanded)
// - Auto-scroll to latest message
// - Max 5 recent messages visible
// - Each bubble shows: coaching text + emotion icon + move number
// =============================================================================

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CoachingEmotion, CoachingMessage } from '../../coaching/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

// =============================================================================
// Emotion Configuration
// =============================================================================

interface EmotionStyle {
  readonly backgroundColor: string
  readonly borderColor: string
  readonly textColor: string
  readonly icon: string
}

const EMOTION_STYLES: Readonly<Record<CoachingEmotion, EmotionStyle>> = {
  positive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    textColor: 'var(--text-primary)',
    icon: '\u{1F44D}',
  },
  cautionary: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
    textColor: 'var(--text-primary)',
    icon: '\u26A0\uFE0F',
  },
  encouraging: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    textColor: 'var(--text-primary)',
    icon: '\u{1F4AA}',
  },
  neutral: {
    backgroundColor: 'var(--bg-elevated)',
    borderColor: 'var(--border)',
    textColor: 'var(--text-primary)',
    icon: '\u{1F4AC}',
  },
}

// =============================================================================
// Props
// =============================================================================

interface CoachPanelProps {
  messages: readonly CoachingMessage[]
}

// =============================================================================
// Component
// =============================================================================

export function CoachPanel({ messages }: CoachPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isCollapsed])

  // Show only the last 5 messages
  const visibleMessages = messages.slice(-5)

  return (
    <Card data-testid="coach-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>AI Coach</span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isCollapsed ? 'Expand coaching panel' : 'Collapse coaching panel'}
            data-testid="coach-panel-toggle"
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </CardTitle>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          {visibleMessages.length === 0 ? (
            <div
              className="text-xs text-center py-3"
              style={{ color: 'var(--text-muted)' }}
              data-testid="coach-panel-empty"
            >
              Play a move to receive coaching
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="space-y-2 max-h-48 overflow-y-auto"
              data-testid="coach-panel-messages"
            >
              {visibleMessages.map((msg, i) => {
                const style = EMOTION_STYLES[msg.emotion]
                return (
                  <div
                    key={`${msg.moveNumber}-${i}`}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{
                      backgroundColor: style.backgroundColor,
                      border: `1px solid ${style.borderColor}`,
                      color: style.textColor,
                    }}
                    data-testid="coach-bubble"
                    data-emotion={msg.emotion}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 text-sm" role="img" aria-label={msg.emotion}>
                        {style.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="leading-relaxed">{msg.text}</div>
                        <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Move {msg.moveNumber + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
