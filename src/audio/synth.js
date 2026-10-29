/**
 * Procedural WebAudio BGM Sequencer & Sky-Arcade SFX Synthesizer
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * - Pure ES2022 relative imports only
 * - Idempotent user-gesture unlock (immune to keydown `ev.repeat` hold)
 * - Pure WebAudio procedural synthesis only (zero browser TTS APIs)
 */

import { EVENT_TYPES } from '../contracts/constants.js';

function midiToFreq(midi) {
  if (!midi || midi <= 0) return 0;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const TRACK_PATTERNS = Object.freeze({
  menu: {
    bpm: 128,
    leadWave: 'triangle',
    bassWave: 'sine',
    leadGain: 0.13,
    bassGain: 0.10,
    hats: true,
    lead: [72, 76, 79, 84, 81, 79, 76, 72, 74, 77, 81, 86, 84, 79, 76, 0],
    bass: [48, 0, 55, 0, 57, 0, 52, 0, 50, 0, 55, 0, 48, 55, 60, 0],
  },
  match: {
    bpm: 136,
    leadWave: 'triangle',
    bassWave: 'triangle',
    leadGain: 0.14,
    bassGain: 0.11,
    hats: true,
    // Upbeat QQ飞行棋 cheerful sky-island march in F major
    lead: [77, 81, 84, 89, 88, 84, 81, 77, 79, 82, 86, 89, 84, 81, 79, 77],
    bass: [53, 0, 60, 0, 58, 0, 60, 0, 55, 0, 60, 0, 53, 57, 60, 0],
  },
  podium: {
    bpm: 140,
    leadWave: 'triangle',
    bassWave: 'triangle',
    leadGain: 0.15,
    bassGain: 0.12,
    hats: true,
    lead: [72, 76, 79, 84, 84, 88, 91, 0, 89, 86, 84, 83, 84, 79, 84, 0],
    bass: [48, 55, 60, 0, 52, 55, 60, 0, 53, 57, 60, 55, 48, 55, 60, 0],
  },
});

export class AudioSynth {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._bgmGain = null;
    this._sfxGain = null;
    this._noiseBuffer = null;

    this._unlocked = false;
    this._muted = false;
    this._currentTrack = 'menu';
    this._sfxCount = 0;
    this._bgmStepCount = 0;
    this._unlockCallCount = 0;
    this._diceTickCount = 0;
    this._flyWhooshCount = 0;
    this._captureSfxCount = 0;
    this._fanfareCount = 0;

    this._stepIndex = 0;
    this._seqTimer = null;
    this._seqTimerTrack = null;
    this._seqTimerStepMs = 0;

    this._boundGestureUnlock = (ev) => {
      if (ev && ev.repeat) return;
      if (
        this._unlocked &&
        this._ctx &&
        this._ctx.state === 'running' &&
        (this._muted || !this._currentTrack || this._seqTimer !== null)
      ) {
        return;
      }
      this.unlock();
    };
    this._attachGlobalGestureListeners();
  }

  _attachGlobalGestureListeners() {
    if (typeof window === 'undefined') return;
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', this._boundGestureUnlock, opts);
    window.addEventListener('mousedown', this._boundGestureUnlock, opts);
    window.addEventListener('touchstart', this._boundGestureUnlock, opts);
    window.addEventListener('keydown', this._boundGestureUnlock, opts);
  }

  _ensureContext() {
    if (this._ctx) return this._ctx;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = this._muted ? 0 : 0.34;
      master.connect(ctx.destination);

      const bgm = ctx.createGain();
      bgm.gain.value = 0.50;
      bgm.connect(master);

      const sfx = ctx.createGain();
      sfx.gain.value = 0.86;
      sfx.connect(master);

      this._ctx = ctx;
      this._masterGain = master;
      this._bgmGain = bgm;
      this._sfxGain = sfx;
      this._noiseBuffer = this._buildNoiseBuffer(ctx);
      return ctx;
    } catch (_) {
      return null;
    }
  }

  _buildNoiseBuffer(ctx) {
    try {
      const length = Math.floor(ctx.sampleRate * 0.3);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    } catch (_) {
      return null;
    }
  }

  unlock() {
    this._unlocked = true;
    this._unlockCallCount += 1;
    const ctx = this._ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {}
    }
    this._syncSequencerTimer();
    return this._unlocked;
  }

  isMuted() {
    return this._muted;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._masterGain && this._ctx) {
      try {
        this._masterGain.gain.setValueAtTime(
          this._muted ? 0 : 0.34,
          this._ctx.currentTime
        );
      } catch (_) {
        this._masterGain.gain.value = this._muted ? 0 : 0.34;
      }
    }
    this._syncSequencerTimer();
    return this._muted;
  }

  toggleMuted() {
    return this.setMuted(!this._muted);
  }

  setTrack(trackName) {
    const next = TRACK_PATTERNS[trackName] ? trackName : 'menu';
    if (this._currentTrack !== next) {
      this._currentTrack = next;
      this._stepIndex = 0;
    }
    this._syncSequencerTimer();
  }

  _stopSequencerTimer() {
    if (this._seqTimer !== null) {
      clearInterval(this._seqTimer);
      this._seqTimer = null;
      this._seqTimerTrack = null;
      this._seqTimerStepMs = 0;
    }
  }

  _syncSequencerTimer() {
    if (this._muted || !this._unlocked || !this._currentTrack) {
      this._stopSequencerTimer();
      return;
    }
    const pattern = TRACK_PATTERNS[this._currentTrack] || TRACK_PATTERNS.menu;
    const stepMs = Math.max(95, Math.round((60000 / pattern.bpm) / 4));
    if (
      this._seqTimer !== null &&
      this._seqTimerTrack === this._currentTrack &&
      this._seqTimerStepMs === stepMs
    ) {
      return;
    }
    this._stopSequencerTimer();
    this._seqTimerTrack = this._currentTrack;
    this._seqTimerStepMs = stepMs;
    this._seqTimer = setInterval(() => {
      this._stepBgmSequencer();
    }, stepMs);
  }

  _stepBgmSequencer() {
    if (this._muted || !this._unlocked) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._bgmGain) return;

    const pattern = TRACK_PATTERNS[this._currentTrack] || TRACK_PATTERNS.menu;
    const idx = this._stepIndex % pattern.lead.length;
    this._stepIndex = (this._stepIndex + 1) % pattern.lead.length;
    this._bgmStepCount += 1;

    const now = ctx.currentTime;
    const stepDur = Math.max(0.08, (60 / pattern.bpm) / 4);

    const leadMidi = pattern.lead[idx];
    if (leadMidi > 0) {
      this._scheduleTone(
        this._bgmGain,
        midiToFreq(leadMidi),
        pattern.leadWave,
        now,
        stepDur * 0.85,
        pattern.leadGain
      );
    }

    const bassMidi = pattern.bass[idx];
    if (bassMidi > 0) {
      this._scheduleTone(
        this._bgmGain,
        midiToFreq(bassMidi),
        pattern.bassWave,
        now,
        stepDur * 1.4,
        pattern.bassGain
      );
    }
  }

  _scheduleTone(dest, freq, type, startTime, duration, peakGain, endFreq = null) {
    const ctx = this._ctx;
    if (!ctx || !dest || freq <= 0) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      if (endFreq && endFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
      }
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.015, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    } catch (_) {}
  }

  _scheduleNoise(startTime, duration, peakGain) {
    const ctx = this._ctx;
    if (!ctx || !this._sfxGain || !this._noiseBuffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peakGain, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this._sfxGain);
      src.start(startTime);
      src.stop(startTime + duration + 0.01);
    } catch (_) {}
  }

  playUiTap() {
    this._sfxCount += 1;
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._sfxGain) return;
    const now = ctx.currentTime;
    this._scheduleTone(this._sfxGain, 660, 'sine', now, 0.065, 0.18, 880);
  }

  consumeEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return;
    for (const ev of events) {
      if (!ev || !ev.type) continue;
      this._sfxCount += 1;
      if (ev.type === EVENT_TYPES.DICE_ROLL) this._diceTickCount += 6;
      else if (ev.type === EVENT_TYPES.PLANE_FLY) this._flyWhooshCount += 1;
      else if (
        ev.type === EVENT_TYPES.PLANE_CAPTURE ||
        ev.type === EVENT_TYPES.RUNWAY_CAPTURE
      ) {
        this._captureSfxCount += 1;
      } else if (ev.type === EVENT_TYPES.PLANE_GOAL) {
        this._fanfareCount += 1;
      }

      if (this._muted) continue;
      const ctx = this._ensureContext();
      if (!ctx || !this._sfxGain) continue;
      const now = ctx.currentTime;

      switch (ev.type) {
        case EVENT_TYPES.DICE_ROLL: {
          // 6 rapid decelerating tumble tick clicks + 1.6x stamp pop chime
          const tickOffsets = [0.0, 0.055, 0.115, 0.185, 0.265, 0.355];
          for (let i = 0; i < tickOffsets.length; i += 1) {
            const t = now + tickOffsets[i];
            const f0 = 480 + i * 75;
            this._scheduleTone(this._sfxGain, f0, 'triangle', t, 0.042, 0.18, f0 * 1.35);
          }
          this._scheduleTone(this._sfxGain, 880, 'sine', now + 0.43, 0.09, 0.25, 1174.66);
          break;
        }
        case EVENT_TYPES.NO_MOVES:
          // Gentle comic stamp thud ("没掷到5/6，起飞失败")
          this._scheduleTone(this._sfxGain, 392, 'triangle', now, 0.09, 0.19, 293.66);
          this._scheduleTone(this._sfxGain, 293.66, 'triangle', now + 0.095, 0.14, 0.20, 220);
          break;
        case EVENT_TYPES.PLANE_TAKEOFF:
          // Ascending propeller takeoff whoosh
          this._scheduleTone(this._sfxGain, 330, 'triangle', now, 0.18, 0.24, 880);
          this._scheduleNoise(now, 0.14, 0.12);
          break;
        case EVENT_TYPES.PLANE_HOP:
          this._scheduleTone(this._sfxGain, 587.33, 'sine', now, 0.08, 0.20, 783.99);
          break;
        case EVENT_TYPES.PLANE_JUMP:
          this._scheduleTone(this._sfxGain, 523.25, 'triangle', now, 0.08, 0.22, 659.25);
          this._scheduleTone(this._sfxGain, 659.25, 'triangle', now + 0.07, 0.11, 0.24, 1046.5);
          break;
        case EVENT_TYPES.PLANE_FLY:
          // High-speed jet whoosh across dashed Fly-Across runway
          this._scheduleNoise(now, 0.32, 0.24);
          this._scheduleTone(this._sfxGain, 330, 'sawtooth', now, 0.28, 0.18, 1320);
          this._scheduleTone(this._sfxGain, 660, 'triangle', now + 0.08, 0.24, 0.24, 1760);
          break;
        case EVENT_TYPES.PLANE_CAPTURE:
        case EVENT_TYPES.RUNWAY_CAPTURE:
          // Slow-mo impact punch + spiraling smoke whistle
          this._scheduleNoise(now, 0.26, 0.28);
          this._scheduleTone(this._sfxGain, 260, 'sawtooth', now, 0.24, 0.28, 65);
          this._scheduleTone(this._sfxGain, 880, 'sine', now + 0.08, 0.32, 0.20, 220);
          break;
        case EVENT_TYPES.PLANE_STACK:
          this._scheduleTone(this._sfxGain, 659.25, 'sine', now, 0.08, 0.18, 880);
          this._scheduleTone(this._sfxGain, 987.77, 'sine', now + 0.06, 0.10, 0.18, 1318.5);
          break;
        case EVENT_TYPES.PLANE_BOUNCE:
          this._scheduleTone(this._sfxGain, 620, 'triangle', now, 0.15, 0.22, 260);
          break;
        case EVENT_TYPES.PLANE_GOAL:
          // 3-note brassy crown fanfare ("到家!") + firework sparkle
          this._scheduleTone(this._sfxGain, 523.25, 'triangle', now, 0.11, 0.26);
          this._scheduleTone(this._sfxGain, 659.25, 'triangle', now + 0.11, 0.11, 0.26);
          this._scheduleTone(this._sfxGain, 783.99, 'triangle', now + 0.22, 0.28, 0.28);
          this._scheduleTone(this._sfxGain, 1046.5, 'sawtooth', now + 0.22, 0.28, 0.16);
          this._scheduleNoise(now + 0.22, 0.18, 0.12);
          break;
        case EVENT_TYPES.MATCH_FINISH:
          this._scheduleTone(this._sfxGain, 523.25, 'triangle', now, 0.11, 0.24);
          this._scheduleTone(this._sfxGain, 659.25, 'triangle', now + 0.09, 0.11, 0.24);
          this._scheduleTone(this._sfxGain, 783.99, 'triangle', now + 0.18, 0.11, 0.24);
          this._scheduleTone(this._sfxGain, 1046.5, 'triangle', now + 0.27, 0.28, 0.28);
          break;
        case EVENT_TYPES.TRIPLE_SIX:
          this._scheduleTone(this._sfxGain, 440, 'square', now, 0.09, 0.14, 330);
          this._scheduleTone(this._sfxGain, 330, 'square', now + 0.10, 0.12, 0.14, 220);
          break;
        default:
          break;
      }
    }
  }

  getDiagnostics() {
    return {
      unlocked: this._unlocked,
      muted: this._muted,
      currentTrack: this._currentTrack,
      contextState: this._ctx ? this._ctx.state : 'uninitialized',
      sfxCount: this._sfxCount,
      diceTickCount: this._diceTickCount,
      flyWhooshCount: this._flyWhooshCount,
      captureSfxCount: this._captureSfxCount,
      fanfareCount: this._fanfareCount,
      bgmStepCount: this._bgmStepCount,
      unlockCallCount: this._unlockCallCount,
      sequencerActive: this._seqTimer !== null,
      ttsUsed: false,
    };
  }
}
