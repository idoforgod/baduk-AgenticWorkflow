// =============================================================================
// screens/OnboardingScreen.tsx — 3-step onboarding flow
// =============================================================================
// Steps: Welcome → Feature intro → Get started
// Full-screen (no Layout wrapper — see AppRouter).
// =============================================================================

import { BookOpen, ChevronLeft, ChevronRight, Target, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'

// ---------------------------------------------------------------------------
// Step content definitions
// ---------------------------------------------------------------------------
interface OnboardingStep {
  id: number
  title: string
  subtitle: string
  description: string
  icon: React.ReactNode
  color: string
}

const STEPS: OnboardingStep[] = [
  {
    id: 0,
    title: 'Welcome to Baduk',
    subtitle: 'The ancient game of Go',
    description:
      'Go is a 2500-year-old strategy game. Two players place black and white stones on a grid, competing to surround the most territory. Simple rules, infinite depth.',
    icon: <BookOpen size={48} />,
    color: 'var(--accent)',
  },
  {
    id: 1,
    title: 'Quick Go Mode',
    subtitle: 'One game on your lunch break',
    description:
      'Play a full game on a 9x9 board in just 3 minutes. Our AI opponent adapts to your level across 30 difficulty settings. After each game, AI analysis shows you exactly what went right and wrong.',
    icon: <Zap size={48} />,
    color: 'var(--warning)',
  },
  {
    id: 2,
    title: 'Ready to Play',
    subtitle: 'Your first game awaits',
    description:
      "Start with Beginner difficulty and work your way up. Every game includes post-game analysis powered by KataGo — the world's strongest open-source Go AI.",
    icon: <Target size={48} />,
    color: 'var(--success)',
  },
]

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center" role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: total }, (_, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional, no unique ID
          key={`dot-${i}`}
          type="button"
          role="tab"
          aria-selected={i === current}
          className="h-2 rounded-full transition-all"
          style={{
            width: i === current ? '24px' : '8px',
            backgroundColor: i === current ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            padding: 0,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// OnboardingScreen
// ---------------------------------------------------------------------------

export function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const navigate = useNavigate()

  const step = STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === STEPS.length - 1

  function handleNext() {
    if (isLast) {
      navigate('/')
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  function handleSkip() {
    navigate('/')
  }

  if (!step) return null

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
      data-testid="onboarding-screen"
    >
      {/* Skip button */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          data-testid="skip-onboarding-button"
          style={{ color: 'var(--text-muted)' }}
        >
          Skip
        </Button>
      </div>

      {/* Content card */}
      <div
        className="w-full max-w-md rounded-2xl p-8 border space-y-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Icon */}
        <div
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${step.color} 15%, transparent)`,
            color: step.color,
          }}
        >
          {step.icon}
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {step.subtitle}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {step.title}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {step.description}
          </p>
        </div>

        {/* Progress dots */}
        <ProgressDots total={STEPS.length} current={currentStep} />

        {/* Navigation buttons */}
        <div className="flex items-center gap-3">
          {!isFirst && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              data-testid="onboarding-back-button"
              aria-label="Previous step"
            >
              <ChevronLeft size={18} />
            </Button>
          )}

          <Button
            size="lg"
            className="flex-1"
            onClick={handleNext}
            data-testid="onboarding-next-button"
          >
            {isLast ? (
              <>
                <Zap size={18} />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight size={18} />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Step counter */}
      <p
        className="mt-6 text-xs"
        style={{ color: 'var(--text-muted)' }}
        data-testid="onboarding-step-counter"
      >
        Step {currentStep + 1} of {STEPS.length}
      </p>
    </div>
  )
}
