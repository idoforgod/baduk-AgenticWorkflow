// =============================================================================
// utils/soundEffects.ts — Web Audio API sound synthesis for Go game
// =============================================================================
// Generates game sounds programmatically — no audio files needed.
// All functions are pure side-effect producers (play sound, return void).
//
// Sounds:
//   - Stone placement: short percussive "tak" (wooden click)
//   - Capture: deeper resonant thud
//   - Game end: two-tone chime
//   - Pass: soft muted tap
//
// Layer: Utility (pure side-effect)
// Depends on: Web Audio API (browser built-in)
// =============================================================================

// ---------------------------------------------------------------------------
// Shared AudioContext (lazy singleton)
// ---------------------------------------------------------------------------

let _ctx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext()
  }
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') {
    _ctx.resume()
  }
  return _ctx
}

// ---------------------------------------------------------------------------
// Stone placement — short percussive click
// ---------------------------------------------------------------------------

export function playStonePlacement(): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // Noise burst for percussive attack
  const duration = 0.08
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    // Filtered noise with fast decay
    const t = i / ctx.sampleRate
    const envelope = Math.exp(-t * 60)
    data[i] = (Math.random() * 2 - 1) * envelope * 0.3
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  // Bandpass filter for "wooden" character
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 2.0

  // Tonal component — adds body to the click
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 400

  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(0.15, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.5

  noise.connect(filter)
  filter.connect(masterGain)
  osc.connect(oscGain)
  oscGain.connect(masterGain)
  masterGain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + duration)
  osc.start(now)
  osc.stop(now + 0.06)
}

// ---------------------------------------------------------------------------
// Capture — deeper resonant thud
// ---------------------------------------------------------------------------

export function playCapture(): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.15)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

  // Second harmonic for richness
  const osc2 = ctx.createOscillator()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(330, now)
  osc2.frequency.exponentialRampToValueAtTime(120, now + 0.12)

  const gain2 = ctx.createGain()
  gain2.gain.setValueAtTime(0.1, now)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.2)
  osc2.start(now)
  osc2.stop(now + 0.15)
}

// ---------------------------------------------------------------------------
// Pass — soft muted tap
// ---------------------------------------------------------------------------

export function playPass(): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 600

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.1)
}

// ---------------------------------------------------------------------------
// Game end — two-tone chime
// ---------------------------------------------------------------------------

export function playGameEnd(): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // First note (C5)
  const osc1 = ctx.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.value = 523.25

  const gain1 = ctx.createGain()
  gain1.gain.setValueAtTime(0.2, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.4)

  // Second note (E5) — delayed
  const osc2 = ctx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = 659.25

  const gain2 = ctx.createGain()
  gain2.gain.setValueAtTime(0.0001, now)
  gain2.gain.setValueAtTime(0.2, now + 0.15)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.15)
  osc2.stop(now + 0.6)

  // Third note (G5) — more delayed
  const osc3 = ctx.createOscillator()
  osc3.type = 'sine'
  osc3.frequency.value = 783.99

  const gain3 = ctx.createGain()
  gain3.gain.setValueAtTime(0.0001, now)
  gain3.gain.setValueAtTime(0.15, now + 0.3)
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

  osc3.connect(gain3)
  gain3.connect(ctx.destination)
  osc3.start(now + 0.3)
  osc3.stop(now + 0.8)
}
