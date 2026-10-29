/**
 * Master Application Coordinator & Frozen `window.__AEROPLANE__` Diagnostic Seam
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * Wires AeroplaneSimEngine + Renderer3D + AudioSynth + HudScreens
 * with 100% relative ES2022 module imports and zero importmaps.
 */

import {
  BOARD_TOPOLOGY,
  FIXED_DT,
  MATCH_PHASES,
  MAX_ACCUMULATOR_SEC,
  SCREEN_IDS,
  TEST_IDS,
  TURN_PHASES,
} from './contracts/constants.js';
import { AeroplaneSimEngine } from './sim/engine.js';
import { Renderer3D } from './render/renderer.js';
import { AudioSynth } from './audio/synth.js';
import { HudScreens } from './ui/hud.js';

function cloneJsonSafe(val) {
  if (val === null || val === undefined) return val;
  return JSON.parse(JSON.stringify(val));
}

function getTrackedErrors() {
  const src =
    typeof window !== 'undefined' && window.__E2E_ERROR_TRACKER__
      ? window.__E2E_ERROR_TRACKER__
      : { jsErrors: [], unhandledRejections: [], resourceErrors: [] };
  return {
    jsErrors: Array.isArray(src.jsErrors) ? src.jsErrors.slice() : [],
    unhandledRejections: Array.isArray(src.unhandledRejections)
      ? src.unhandledRejections.slice()
      : [],
    resourceErrors: Array.isArray(src.resourceErrors) ? src.resourceErrors.slice() : [],
  };
}

function bootstrapApp() {
  const canvas = document.querySelector(`[data-testid="${TEST_IDS.BOARD_CANVAS}"]`);
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    throw new Error('Missing #board-canvas or #ui-root in index.html');
  }

  let uiScreen = SCREEN_IDS.TITLE;
  let deterministicMode = false;
  let nextMatchSeed = 20261029;

  const selectedConfig = {
    modeId: 'quick_2',
    takeoffRule: 'five_six',
    humanCount: 1,
    humanColorIndex: 0,
    autoAdvanceSingleMove: true,
  };

  let lastRestartOptions = { ...selectedConfig };
  let simEngine = null;
  let currentSimSnapshot = null;
  let previewEngine = null;
  let previewSnapshot = null;

  const audio = new AudioSynth();
  audio.setTrack('menu');

  const renderer = new Renderer3D(canvas);
  let lastViewportW = 0;
  let lastViewportH = 0;
  let stepRendersInTask = 0;
  let screenNeedsSyncRender = true;
  let microtaskFlushQueued = false;
  let deferredRenderPending = false;
  let deferredRenderDt = 0;
  let lastRenderEndMs = 0;
  let lastRenderCostMs = 0;
  let disposed = false;
  let rafId = 0;
  const pendingVisualEvents = [];

  function syncViewportSize(force = false) {
    const w = Math.max(1, Math.round(window.innerWidth || canvas.clientWidth || 1280));
    const h = Math.max(1, Math.round(window.innerHeight || canvas.clientHeight || 800));
    if (force || w !== lastViewportW || h !== lastViewportH) {
      lastViewportW = w;
      lastViewportH = h;
      stepRendersInTask = 0;
      screenNeedsSyncRender = true;
      renderer.resize(w, h);
    }
  }

  function rebuildPreviewDiorama() {
    previewEngine = new AeroplaneSimEngine({
      ...selectedConfig,
      seed: 9001,
      customPlaneStates: {
        red: [0, 6, 18, -1],
        yellow: [0, 10, -1, -1],
        blue: [0, 14, -1, -1],
        green: [0, 22, -1, -1],
      },
    });
    previewSnapshot = previewEngine.getSnapshot();
  }

  function renderActiveScene(dtSec = FIXED_DT) {
    if (disposed) return;
    syncViewportSize(false);
    const activeSnap =
      uiScreen === SCREEN_IDS.PLAYING ||
      uiScreen === SCREEN_IDS.PAUSED ||
      uiScreen === SCREEN_IDS.PODIUM
        ? currentSimSnapshot
        : previewSnapshot;
    const eventsBatch =
      pendingVisualEvents.length > 0
        ? pendingVisualEvents.splice(0, pendingVisualEvents.length)
        : [];
    const t0 = performance.now();
    renderer.render(activeSnap, dtSec, {
      uiScreen,
      pendingEvents: eventsBatch,
    });
    const t1 = performance.now();
    lastRenderEndMs = t1;
    lastRenderCostMs = t1 - t0;
    screenNeedsSyncRender = false;
    deferredRenderPending = false;
    deferredRenderDt = 0;
  }

  function renderFromStepFrames(dtSec = FIXED_DT) {
    if (!microtaskFlushQueued) {
      microtaskFlushQueued = true;
      queueMicrotask(() => {
        microtaskFlushQueued = false;
        stepRendersInTask = 0;
        if (deferredRenderPending && !disposed) {
          renderActiveScene(deferredRenderDt || FIXED_DT);
        }
      });
    }
    const isFastHardwareGpu = lastRenderCostMs > 0 && lastRenderCostMs <= 16;
    if (
      lastRenderEndMs === 0 ||
      screenNeedsSyncRender ||
      (isFastHardwareGpu && stepRendersInTask < 1)
    ) {
      stepRendersInTask += 1;
      renderActiveScene(dtSec);
    } else {
      deferredRenderPending = true;
      deferredRenderDt += dtSec;
    }
  }

  function openSelectScreen() {
    audio.playUiTap();
    simEngine = null;
    currentSimSnapshot = null;
    pendingVisualEvents.length = 0;
    uiScreen = SCREEN_IDS.SELECT;
    audio.setTrack('menu');
    hud.syncSelectedConfig(selectedConfig);
    hud.setScreen(SCREEN_IDS.SELECT);
    rebuildPreviewDiorama();
    renderer.setScreenMode(SCREEN_IDS.SELECT);
    screenNeedsSyncRender = true;
    renderActiveScene(FIXED_DT);
  }

  function transitionToPodium() {
    uiScreen = SCREEN_IDS.PODIUM;
    audio.setTrack('podium');
    hud.updatePodium(currentSimSnapshot);
    hud.setScreen(SCREEN_IDS.PODIUM);
    renderer.setScreenMode(SCREEN_IDS.PODIUM);
    screenNeedsSyncRender = true;
  }

  function syncSnapshotAndEvents(snap) {
    currentSimSnapshot = snap;
    if (Array.isArray(snap.events) && snap.events.length > 0) {
      for (const ev of snap.events) {
        pendingVisualEvents.push(ev);
      }
      if (pendingVisualEvents.length > 96) {
        pendingVisualEvents.splice(0, pendingVisualEvents.length - 96);
      }
      audio.consumeEvents(snap.events);
    }
    if (snap.phase === MATCH_PHASES.FINISHED && uiScreen !== SCREEN_IDS.PODIUM) {
      transitionToPodium();
    } else if (uiScreen === SCREEN_IDS.PLAYING) {
      hud.updateHud(currentSimSnapshot, audio.isMuted());
    }
  }

  function togglePauseState() {
    if (uiScreen === SCREEN_IDS.PLAYING && simEngine) {
      audio.playUiTap();
      uiScreen = SCREEN_IDS.PAUSED;
      hud.setScreen(SCREEN_IDS.PAUSED);
      renderer.setScreenMode(SCREEN_IDS.PAUSED);
      screenNeedsSyncRender = true;
      renderActiveScene(0);
    } else if (uiScreen === SCREEN_IDS.PAUSED && simEngine) {
      audio.playUiTap();
      uiScreen = SCREEN_IDS.PLAYING;
      hud.setScreen(SCREEN_IDS.PLAYING);
      renderer.setScreenMode(SCREEN_IDS.PLAYING);
      screenNeedsSyncRender = true;
      renderActiveScene(0);
    }
  }

  function toggleMuteState() {
    const muted = audio.toggleMuted();
    hud.syncAudioMuted(muted);
  }

  function isHumanTurn() {
    if (!simEngine || uiScreen !== SCREEN_IDS.PLAYING) return false;
    const activePlayer = simEngine.players[simEngine.currentPlayer];
    return Boolean(activePlayer && !activePlayer.isAi);
  }

  function handleRollOrQuickMove() {
    if (!isHumanTurn()) return;
    if (simEngine.turnPhase === TURN_PHASES.AWAIT_ROLL) {
      rollDice();
    } else if (simEngine.turnPhase === TURN_PHASES.AWAIT_MOVE && simEngine.legalMoves.length > 0) {
      const best = simEngine.chooseBestMoveForAi(simEngine.legalMoves);
      if (best) {
        selectPlane(best.planeIndex);
      }
    }
  }

  const hud = new HudScreens(uiRoot, {
    onTitleQuickPlay: () => {
      audio.playUiTap();
      nextMatchSeed = (nextMatchSeed + 7919) >>> 0;
      startMatch({
        ...selectedConfig,
        seed: nextMatchSeed,
      });
    },
    onOpenSelect: () => {
      openSelectScreen();
    },
    onToggleMode: () => {
      audio.playUiTap();
      selectedConfig.modeId = selectedConfig.modeId === 'quick_2' ? 'classic_4' : 'quick_2';
      hud.syncSelectedConfig(selectedConfig);
    },
    onToggleRule: () => {
      audio.playUiTap();
      selectedConfig.takeoffRule =
        selectedConfig.takeoffRule === 'five_six' ? 'strict_six' : 'five_six';
      hud.syncSelectedConfig(selectedConfig);
    },
    onTogglePlayers: () => {
      audio.playUiTap();
      const order = [1, 2, 4];
      const idx = order.indexOf(selectedConfig.humanCount);
      selectedConfig.humanCount = order[(idx + 1) % order.length];
      hud.syncSelectedConfig(selectedConfig);
    },
    onToggleColor: () => {
      audio.playUiTap();
      selectedConfig.humanColorIndex = (selectedConfig.humanColorIndex + 1) % 4;
      hud.syncSelectedConfig(selectedConfig);
    },
    onStartMatch: () => {
      audio.playUiTap();
      nextMatchSeed = (nextMatchSeed + 7919) >>> 0;
      startMatch({
        ...selectedConfig,
        seed: nextMatchSeed,
      });
    },
    onToggleAudio: () => {
      toggleMuteState();
    },
    onTogglePause: () => {
      togglePauseState();
    },
    onRollOrQuickMove: () => {
      handleRollOrQuickMove();
    },
    onSelectPlane: (planeIndex) => {
      if (!isHumanTurn()) return;
      selectPlane(planeIndex);
    },
    onRestartMatch: () => {
      audio.playUiTap();
      nextMatchSeed = (nextMatchSeed + 131) >>> 0;
      startMatch({
        ...lastRestartOptions,
        seed: nextMatchSeed,
      });
    },
  });

  // 3D Raycast click/tap on canvas to pick highlighted legal planes directly on the 3D board!
  canvas.addEventListener('click', (ev) => {
    if (!isHumanTurn()) return;
    const hit = renderer.raycastPlaneAtClientXY(ev.clientX, ev.clientY, currentSimSnapshot);
    if (hit && hit.isLegal) {
      selectPlane(hit.planeIndex);
    }
  });

  // Keyboard controls (immune to key hold `ev.repeat`, gated on human player turns)
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const code = ev.code || '';
    if (code === 'KeyM') {
      toggleMuteState();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (uiScreen === SCREEN_IDS.PLAYING || uiScreen === SCREEN_IDS.PAUSED) {
        togglePauseState();
      }
      return;
    }
    if (!isHumanTurn()) return;
    if (code === 'Space' || code === 'Enter') {
      ev.preventDefault();
      handleRollOrQuickMove();
    } else if (code === 'Digit1' || code === 'Numpad1') {
      selectPlane(0);
    } else if (code === 'Digit2' || code === 'Numpad2') {
      selectPlane(1);
    } else if (code === 'Digit3' || code === 'Numpad3') {
      selectPlane(2);
    } else if (code === 'Digit4' || code === 'Numpad4') {
      selectPlane(3);
    }
  });

  function startMatch(options = {}) {
    if (options.deterministic !== undefined) {
      deterministicMode = Boolean(options.deterministic);
    }

    const seed =
      options.seed !== undefined && Number.isFinite(Number(options.seed))
        ? Number(options.seed) >>> 0
        : (nextMatchSeed = (nextMatchSeed + 17) >>> 0);

    simEngine = new AeroplaneSimEngine({
      ...selectedConfig,
      ...options,
      seed,
    });

    selectedConfig.modeId = simEngine.modeId;
    selectedConfig.takeoffRule = simEngine.takeoffRule;
    lastRestartOptions = {
      modeId: simEngine.modeId,
      takeoffRule: simEngine.takeoffRule,
      humanCount: simEngine.humanCount,
      humanColorIndex: simEngine.humanColorIndex,
    };

    pendingVisualEvents.length = 0;
    uiScreen = SCREEN_IDS.PLAYING;
    audio.setTrack('match');

    currentSimSnapshot = simEngine.getSnapshot();
    hud.syncSelectedConfig(selectedConfig);
    hud.setScreen(SCREEN_IDS.PLAYING);
    hud.updateHud(currentSimSnapshot, audio.isMuted());

    if (currentSimSnapshot.phase === MATCH_PHASES.FINISHED) {
      transitionToPodium();
    } else {
      renderer.setScreenMode(SCREEN_IDS.PLAYING);
    }

    screenNeedsSyncRender = true;
    renderActiveScene(0);
    return getState();
  }

  function rollDice() {
    if (!simEngine || uiScreen !== SCREEN_IDS.PLAYING) {
      return getState();
    }
    const snap = simEngine.rollDice();
    syncSnapshotAndEvents(snap);
    screenNeedsSyncRender = true;
    renderFromStepFrames(FIXED_DT);
    return getState();
  }

  function selectPlane(planeIndex) {
    if (!simEngine || uiScreen !== SCREEN_IDS.PLAYING) {
      return getState();
    }
    const snap = simEngine.selectPlane(planeIndex);
    syncSnapshotAndEvents(snap);
    screenNeedsSyncRender = true;
    renderFromStepFrames(FIXED_DT);
    return getState();
  }

  function stepFrames(count = 1) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    syncViewportSize(false);
    if (n === 0) return getState();

    if (uiScreen === SCREEN_IDS.PLAYING && simEngine) {
      for (let i = 0; i < n; i += 1) {
        const snap = simEngine.step(FIXED_DT);
        syncSnapshotAndEvents(snap);
        if (uiScreen !== SCREEN_IDS.PLAYING) {
          const rem = n - 1 - i;
          renderFromStepFrames(Math.max(1, rem + 1) * FIXED_DT);
          return getState();
        }
      }
      renderFromStepFrames(n * FIXED_DT);
    } else if (uiScreen === SCREEN_IDS.PAUSED) {
      renderFromStepFrames(0);
    } else {
      renderFromStepFrames(n * FIXED_DT);
    }

    return getState();
  }

  function setDeterministicMode(enabled) {
    deterministicMode = Boolean(enabled);
    accumulatorSec = 0;
    return deterministicMode;
  }

  function getPlaneScreenCoords(colorIndex, planeIndex) {
    return renderer.getPlaneScreenCoords(colorIndex, planeIndex);
  }

  function getState() {
    syncViewportSize(false);
    return {
      uiScreen,
      selectedConfig: { ...selectedConfig },
      hudClickableCount: hud.getVisibleClickableCount(),
      errors: getTrackedErrors(),
      sim: currentSimSnapshot ? cloneJsonSafe(currentSimSnapshot) : null,
      render: cloneJsonSafe(renderer.getDiagnostics(currentSimSnapshot)),
      audio: audio.getDiagnostics(),
      boardMeta: {
        trackTileCount: BOARD_TOPOLOGY.trackTiles.length,
        runways: cloneJsonSafe(BOARD_TOPOLOGY.runways),
      },
    };
  }

  // Initial Title Screen Diorama
  rebuildPreviewDiorama();
  hud.syncSelectedConfig(selectedConfig);
  hud.setScreen(SCREEN_IDS.TITLE);
  syncViewportSize(true);
  renderer.setScreenMode(SCREEN_IDS.TITLE);
  renderActiveScene(0);

  window.addEventListener('resize', () => {
    if (disposed) return;
    syncViewportSize(true);
    renderActiveScene(0);
  });

  function cleanupOnUnload() {
    if (disposed) return;
    disposed = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    audio.setMuted(true);
    renderer.dispose();
  }

  window.addEventListener('pagehide', cleanupOnUnload);
  window.addEventListener('beforeunload', cleanupOnUnload);

  let lastRafMs = performance.now();
  let accumulatorSec = 0;

  function onAnimationFrame(nowMs) {
    if (disposed) return;
    const rawDt = Math.max(0, (nowMs - lastRafMs) / 1000);
    lastRafMs = nowMs;

    if (!deterministicMode) {
      const shouldYieldSoftwareRender =
        lastRenderCostMs > 45 && nowMs - lastRenderEndMs < Math.min(200, lastRenderCostMs * 1.4);
      const clampedDt = Math.min(rawDt, MAX_ACCUMULATOR_SEC);

      if (uiScreen === SCREEN_IDS.PLAYING && simEngine) {
        accumulatorSec = Math.min(MAX_ACCUMULATOR_SEC, accumulatorSec + clampedDt);
        while (accumulatorSec >= FIXED_DT && uiScreen === SCREEN_IDS.PLAYING) {
          const snap = simEngine.step(FIXED_DT);
          syncSnapshotAndEvents(snap);
          accumulatorSec -= FIXED_DT;
        }
        if (!shouldYieldSoftwareRender) {
          renderActiveScene(clampedDt || FIXED_DT);
        }
      } else if (uiScreen === SCREEN_IDS.PAUSED) {
        accumulatorSec = 0;
        if (!shouldYieldSoftwareRender) {
          renderActiveScene(0);
        }
      } else {
        accumulatorSec = 0;
        if (!shouldYieldSoftwareRender) {
          renderActiveScene(clampedDt || FIXED_DT);
        }
      }
    }

    if (!disposed) {
      rafId = requestAnimationFrame(onAnimationFrame);
    }
  }

  rafId = requestAnimationFrame(onAnimationFrame);

  const publicApi = Object.freeze({
    version: '1.0.0',
    startMatch,
    stepFrames,
    rollDice,
    selectPlane,
    getState,
    setDeterministicMode,
    getPlaneScreenCoords,
  });

  Object.defineProperty(window, '__AEROPLANE__', {
    value: publicApi,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  Object.defineProperty(window, '__QQ_AEROPLANE__', {
    value: publicApi,
    writable: false,
    configurable: false,
    enumerable: true,
  });
}

bootstrapApp();
