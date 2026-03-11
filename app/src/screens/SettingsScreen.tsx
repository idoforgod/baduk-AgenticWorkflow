// =============================================================================
// screens/SettingsScreen.tsx — Application settings
// =============================================================================
// Settings: board size, komi, AI difficulty (1-30), language, theme, sound.
// Persisted via SettingsRepository (Step 11).
// =============================================================================

import { Moon, Save, Sun, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { SettingsRepository } from '../db/repositories/settings-repository'

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------
interface AppSettings {
  boardSize: '9' | '13' | '19'
  komi: string
  aiDifficulty: number
  language: 'en' | 'ko' | 'ja'
  theme: 'dark' | 'light'
  soundEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  boardSize: '9',
  komi: '5.5',
  aiDifficulty: 10,
  language: 'en',
  theme: 'dark',
  soundEnabled: true,
}

const settingsRepo = new SettingsRepository()

// ---------------------------------------------------------------------------
// Difficulty level label helpers
// ---------------------------------------------------------------------------
function difficultyLabel(level: number): string {
  if (level <= 5) return 'Beginner'
  if (level <= 10) return 'Novice'
  if (level <= 15) return 'Intermediate'
  if (level <= 20) return 'Advanced'
  if (level <= 25) return 'Expert'
  return 'Master'
}

function difficultyBadgeVariant(level: number): 'success' | 'warning' | 'destructive' | 'default' {
  if (level <= 10) return 'success'
  if (level <= 20) return 'warning'
  return 'destructive'
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Individual setting row
// ---------------------------------------------------------------------------
function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsScreen component
// ---------------------------------------------------------------------------

export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load persisted settings on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      const boardSizeResult = await settingsRepo.getSettingWithDefault(
        'boardSize',
        DEFAULT_SETTINGS.boardSize
      )
      const komiResult = await settingsRepo.getSettingWithDefault('komi', DEFAULT_SETTINGS.komi)
      const diffResult = await settingsRepo.getSettingWithDefault(
        'aiDifficulty',
        DEFAULT_SETTINGS.aiDifficulty
      )
      const langResult = await settingsRepo.getSettingWithDefault(
        'language',
        DEFAULT_SETTINGS.language
      )
      const themeResult = await settingsRepo.getSettingWithDefault('theme', DEFAULT_SETTINGS.theme)
      const soundResult = await settingsRepo.getSettingWithDefault(
        'soundEnabled',
        DEFAULT_SETTINGS.soundEnabled
      )

      setSettings({
        boardSize: boardSizeResult.ok
          ? (boardSizeResult.value as AppSettings['boardSize'])
          : DEFAULT_SETTINGS.boardSize,
        komi: komiResult.ok ? (komiResult.value as string) : DEFAULT_SETTINGS.komi,
        aiDifficulty: diffResult.ok ? (diffResult.value as number) : DEFAULT_SETTINGS.aiDifficulty,
        language: langResult.ok
          ? (langResult.value as AppSettings['language'])
          : DEFAULT_SETTINGS.language,
        theme: themeResult.ok
          ? (themeResult.value as AppSettings['theme'])
          : DEFAULT_SETTINGS.theme,
        soundEnabled: soundResult.ok
          ? (soundResult.value as boolean)
          : DEFAULT_SETTINGS.soundEnabled,
      })
      setLoading(false)
    }
    load()
  }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    await settingsRepo.setTypedSetting('boardSize', settings.boardSize)
    await settingsRepo.setTypedSetting('komi', settings.komi)
    await settingsRepo.setTypedSetting('aiDifficulty', settings.aiDifficulty)
    await settingsRepo.setTypedSetting('language', settings.language)
    await settingsRepo.setTypedSetting('theme', settings.theme)
    await settingsRepo.setTypedSetting('soundEnabled', settings.soundEnabled)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <Button onClick={handleSave} data-testid="save-settings-button">
          <Save size={16} />
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {/* Game settings */}
      <SettingsSection title="Game" description="Default game configuration for Quick Go.">
        <SettingRow label="Board Size" description="9x9 recommended for lunch break games">
          <Select
            value={settings.boardSize}
            onValueChange={(v) => updateSetting('boardSize', v as AppSettings['boardSize'])}
          >
            <SelectTrigger className="w-28" data-testid="board-size-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">9x9</SelectItem>
              <SelectItem value="13">13x13</SelectItem>
              <SelectItem value="19">19x19</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Komi" description="Compensation points for White">
          <Select value={settings.komi} onValueChange={(v) => updateSetting('komi', v)}>
            <SelectTrigger className="w-28" data-testid="komi-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="5.5">5.5</SelectItem>
              <SelectItem value="6.5">6.5</SelectItem>
              <SelectItem value="7.5">7.5</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* AI difficulty */}
      <SettingsSection
        title="AI Difficulty"
        description="30 levels — from complete beginner to professional strength."
      >
        <SettingRow
          label={`Level ${settings.aiDifficulty}`}
          description={difficultyLabel(settings.aiDifficulty)}
        >
          <Badge variant={difficultyBadgeVariant(settings.aiDifficulty)}>
            {difficultyLabel(settings.aiDifficulty)}
          </Badge>
        </SettingRow>

        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={30}
            value={settings.aiDifficulty}
            onChange={(e) => updateSetting('aiDifficulty', Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
            aria-label="AI difficulty level"
            data-testid="ai-difficulty-slider"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>1 — Beginner</span>
            <span>15 — Intermediate</span>
            <span>30 — Master</span>
          </div>
        </div>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance">
        <SettingRow label="Theme" description="Dark theme recommended for board games">
          <div className="flex items-center gap-2">
            <Sun size={16} style={{ color: 'var(--text-muted)' }} />
            <Switch
              checked={settings.theme === 'dark'}
              onCheckedChange={(checked) => updateSetting('theme', checked ? 'dark' : 'light')}
              aria-label="Toggle dark mode"
              data-testid="theme-switch"
            />
            <Moon size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </SettingRow>

        <SettingRow label="Language">
          <Select
            value={settings.language}
            onValueChange={(v) => updateSetting('language', v as AppSettings['language'])}
          >
            <SelectTrigger className="w-32" data-testid="language-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ko">Korean</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Audio */}
      <SettingsSection title="Audio">
        <SettingRow label="Sound Effects" description="Stone placement and game sounds">
          <div className="flex items-center gap-2">
            {settings.soundEnabled ? (
              <Volume2 size={16} style={{ color: 'var(--text-muted)' }} />
            ) : (
              <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />
            )}
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
              aria-label="Toggle sound"
              data-testid="sound-switch"
            />
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  )
}
