/**
 * The funeral's score, synthesised on the spot so nothing is downloaded: a
 * church bell as the lights go down, thunder with the strike, an organ under
 * it, wind while the ghost rises, and the thud of the weapon landing. Off
 * unless the viewer turned it on; browsers only let sound play after the
 * viewer has interacted with the page, and when they will not, this fails
 * silently and the scene plays mute.
 */
const KEY = 'survivor:funeral:sound'

export function funeralSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setFuneralSound(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: the toggle just does not stick */
  }
}

type Ctx = AudioContext

function noiseBuffer(ctx: Ctx, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function bell(ctx: Ctx, out: AudioNode, at: number, base = 196) {
  // A bell is a fundamental and a few inharmonic partials, each dying at its own rate.
  for (const [ratio, gain, decay] of [
    [1, 0.5, 3.2],
    [2.76, 0.22, 2.2],
    [5.4, 0.1, 1.4],
    [8.9, 0.05, 0.8],
  ] as const) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = base * ratio
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(env).connect(out)
    osc.start(at)
    osc.stop(at + decay + 0.1)
  }
}

function organ(ctx: Ctx, out: AudioNode, at: number, seconds: number) {
  for (const [freq, gain] of [
    [55, 0.18],
    [110, 0.12],
    [164.8, 0.06],
  ] as const) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + 0.5)
    env.gain.setValueAtTime(gain, at + seconds - 0.9)
    env.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    osc.connect(env).connect(out)
    osc.start(at)
    osc.stop(at + seconds + 0.1)
  }
}

function thunder(ctx: Ctx, out: AudioNode, at: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 2.4)
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 140
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.9, at + 0.08)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 2.2)
  src.connect(low).connect(env).connect(out)
  src.start(at)
  src.stop(at + 2.4)
}

function wind(ctx: Ctx, out: AudioNode, at: number, seconds: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, seconds + 0.5)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 520
  band.Q.value = 0.6
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.16, at + 1.2)
  env.gain.setValueAtTime(0.16, at + seconds - 1.2)
  env.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
  // The gusts.
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 0.27
  depth.gain.value = 0.07
  lfo.connect(depth).connect(env.gain)
  src.connect(band).connect(env).connect(out)
  lfo.start(at)
  src.start(at)
  src.stop(at + seconds + 0.5)
  lfo.stop(at + seconds + 0.5)
}

function thud(ctx: Ctx, out: AudioNode, at: number) {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(95, at)
  osc.frequency.exponentialRampToValueAtTime(38, at + 0.18)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.7, at + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + 0.35)
}

/** Plays the score against the scene's clock. Returns a stop function. */
export function playFuneralScore(): () => void {
  const AC =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return () => {}
  let ctx: AudioContext
  try {
    ctx = new AC()
  } catch {
    return () => {}
  }
  void ctx.resume().catch(() => {})
  const master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)
  const t = ctx.currentTime
  try {
    bell(ctx, master, t + 0.5)
    bell(ctx, master, t + 3, 174.6)
    thunder(ctx, master, t + 5.42)
    organ(ctx, master, t + 5.3, 5)
    wind(ctx, master, t + 12, 5.5)
    thud(ctx, master, t + 15.3)
    bell(ctx, master, t + 18.4, 146.8)
  } catch {
    /* a browser that refuses: the scene plays mute */
  }
  return () => {
    void ctx.close().catch(() => {})
  }
}
