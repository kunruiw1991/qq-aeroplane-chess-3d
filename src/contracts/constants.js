/**
 * Core Constants, Board Topology & Seeded Mulberry32 PRNG
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * Pure ES2022 module with zero external dependencies.
 */

export const FIXED_DT = 1 / 60;
export const MAX_ACCUMULATOR_SEC = 0.25;

export const SCREEN_IDS = Object.freeze({
  TITLE: 'title',
  SELECT: 'select',
  PLAYING: 'playing',
  PAUSED: 'paused',
  PODIUM: 'podium',
});

export const MATCH_PHASES = Object.freeze({
  PLAYING: 'playing',
  FINISHED: 'finished',
});

export const TURN_PHASES = Object.freeze({
  AWAIT_ROLL: 'await_roll',
  ROLLING: 'rolling',
  AWAIT_MOVE: 'await_move',
  MOVING: 'moving',
  NO_MOVES: 'no_moves',
  TRIPLE_SIX: 'triple_six',
  FINISHED: 'finished',
});

export const PLANE_STATES = Object.freeze({
  HANGAR: 'hangar',
  LAUNCHPAD: 'launchpad',
  TRACK: 'track',
  HOMESTRETCH: 'homestretch',
  GOAL: 'goal',
});

export const MODE_IDS = Object.freeze(['quick_2', 'classic_4']);
export const TAKEOFF_RULES = Object.freeze(['five_six', 'strict_six']);
export const COLOR_IDS = Object.freeze(['red', 'yellow', 'blue', 'green']);

export const COLOR_META = Object.freeze({
  red: {
    index: 0,
    id: 'red',
    nameZh: '红鹰号',
    shortZh: '红方',
    hex: '#ef4444',
    lightHex: '#fca5a5',
    darkHex: '#b91c1c',
    emissiveHex: '#dc2626',
    pilotHatHex: '#ef4444',
  },
  yellow: {
    index: 1,
    id: 'yellow',
    nameZh: '黄蜂号',
    shortZh: '黄方',
    hex: '#f59e0b',
    lightHex: '#fde68a',
    darkHex: '#b45309',
    emissiveHex: '#d97706',
    pilotHatHex: '#f59e0b',
  },
  blue: {
    index: 2,
    id: 'blue',
    nameZh: '蓝鲨号',
    shortZh: '蓝方',
    hex: '#3b82f6',
    lightHex: '#93c5fd',
    darkHex: '#1d4ed8',
    emissiveHex: '#2563eb',
    pilotHatHex: '#3b82f6',
  },
  green: {
    index: 3,
    id: 'green',
    nameZh: '绿龙号',
    shortZh: '绿方',
    hex: '#10b981',
    lightHex: '#6ee7b7',
    darkHex: '#047857',
    emissiveHex: '#059669',
    pilotHatHex: '#10b981',
  },
});

export const TEST_IDS = Object.freeze({
  BOARD_CANVAS: 'board-canvas',
  BTN_TITLE_PLAY: 'btn-title-play',
  BTN_TITLE_SETUP: 'btn-title-setup',
  BTN_MODE_TOGGLE: 'btn-mode-toggle',
  BTN_RULE_TOGGLE: 'btn-rule-toggle',
  BTN_PLAYERS_TOGGLE: 'btn-players-toggle',
  BTN_COLOR_TOGGLE: 'btn-color-toggle',
  BTN_START_MATCH: 'btn-start-match',
  HUD_BTN_ROLL: 'hud-btn-roll',
  HUD_BTN_AUDIO: 'hud-btn-audio',
  HUD_BTN_PAUSE: 'hud-btn-pause',
  HUD_BTN_PLANE_0: 'hud-btn-plane-0',
  HUD_BTN_PLANE_1: 'hud-btn-plane-1',
  HUD_BTN_PLANE_2: 'hud-btn-plane-2',
  HUD_BTN_PLANE_3: 'hud-btn-plane-3',
  BTN_RESUME: 'btn-resume',
  BTN_RESTART: 'btn-restart',
  BTN_QUIT_SELECT: 'btn-quit-select',
  BTN_PLAY_AGAIN: 'btn-play-again',
  BTN_PODIUM_SELECT: 'btn-podium-select',
});

export const EVENT_TYPES = Object.freeze({
  DICE_ROLL: 'dice_roll',
  PLANE_TAKEOFF: 'plane_takeoff',
  PLANE_HOP: 'plane_hop',
  PLANE_JUMP: 'plane_jump',
  PLANE_FLY: 'plane_fly',
  PLANE_CAPTURE: 'plane_capture',
  RUNWAY_CAPTURE: 'runway_capture',
  PLANE_STACK: 'plane_stack',
  PLANE_BOUNCE: 'plane_bounce',
  PLANE_GOAL: 'plane_goal',
  TRIPLE_SIX: 'triple_six',
  MATCH_FINISH: 'match_finish',
});

// Relative step constants for every player color (0..3):
// relStep = -1 : In Hangar
// relStep = 0  : On Corner Launch Pad
// relStep = 1..50 : On 52-tile Outer Perimeter Loop
// relStep = 51..55 : On 6-step Colored Home Stretch Corridor (steps 1..5)
// relStep = 56 : Exact Center Star Goal (step 6 of Home Stretch -> Crowned!)
export const HANGAR_REL_STEP = -1;
export const LAUNCHPAD_REL_STEP = 0;
export const FIRST_TRACK_REL_STEP = 1;
export const FLY_START_REL_STEP = 18;
export const FLY_END_REL_STEP = 30;
export const POST_FLY_JUMP_REL_STEP = 34;
export const HOME_ENTRY_REL_STEP = 50;
export const FIRST_HOME_REL_STEP = 51;
export const RUNWAY_INTERSECT_HOME_REL_STEP = 53;
export const GOAL_REL_STEP = 56;
export const TRACK_TILE_COUNT = 52;
export const QUADRANT_TILE_COUNT = 13;

/**
 * Deterministic Mulberry32 PRNG.
 */
export function createMulberry32(seed = 20261029) {
  let state = (Number(seed) >>> 0) || 1;
  return {
    nextFloat() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextDie() {
      return Math.floor(this.nextFloat() * 6) + 1;
    },
    getState() {
      return state >>> 0;
    },
    setState(nextState) {
      state = (Number(nextState) >>> 0) || 1;
    },
  };
}

/**
 * Rotates a 2D board point (x, z) by 90 degrees clockwise `quadrant` times.
 * Quadrant 0 = West/Top-Left (Red), 1 = North/Top-Right (Yellow),
 * 2 = East/Bottom-Right (Blue), 3 = South/Bottom-Left (Green).
 */
export function rotateBoardPoint(x, z, quadrant = 0) {
  const q = ((quadrant % 4) + 4) % 4;
  if (q === 0) return { x, z };
  if (q === 1) return { x: -z, z: x };
  if (q === 2) return { x: -x, z: -z };
  return { x: z, z: -x };
}

/**
 * Converts (colorIndex, relStep) on the outer track (1..50) to global trackIndex (0..51).
 */
export function relStepToTrackIndex(colorIndex, relStep) {
  if (relStep < FIRST_TRACK_REL_STEP || relStep > HOME_ENTRY_REL_STEP) {
    return -1;
  }
  return (colorIndex * QUADRANT_TILE_COUNT + (relStep - 1)) % TRACK_TILE_COUNT;
}

/**
 * Converts a global trackIndex (0..51) to its tile colorIndex (0..3).
 * Ensures relStep % 4 === 2 (i.e. 2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50)
 * always matches `colorIndex`.
 */
export function getTrackTileColorIndex(trackIndex) {
  const idx = ((trackIndex % TRACK_TILE_COUNT) + TRACK_TILE_COUNT) % TRACK_TILE_COUNT;
  return (idx + 3) % 4;
}

/**
 * Checks whether a relative step (1..50) is of the moving plane's own color.
 */
export function isSameColorOuterStep(relStep) {
  return relStep >= FIRST_TRACK_REL_STEP && relStep <= HOME_ENTRY_REL_STEP && relStep % 4 === 2;
}

// Base 13 points for d = 0..12 starting at West arm tip center (trackIndex = 49):
// d = 0 -> trackIndex 49 (Red Home Stretch entry at (-7.6, 0))
// d = 1 -> trackIndex 50
// d = 2 -> trackIndex 51
// d = 3 -> trackIndex 0  (Red relStep = 1)
// ...
// d = 6 -> trackIndex 3  (Blue Fly-Across End at (-3.4, -2.1))
// d = 7 -> trackIndex 4  (Green Fly-Across Start at (-2.1, -3.4))
// ...
// d = 12 -> trackIndex 9
const BASE_QUADRANT_PATH = Object.freeze([
  { x: -7.6, z: 0.0 },   // d = 0 (arm tip center, Home Stretch entry)
  { x: -7.6, z: -1.05 }, // d = 1
  { x: -7.6, z: -2.1 },  // d = 2 (arm tip outer corner)
  { x: -6.55, z: -2.1 }, // d = 3 (relStep = 1, first perimeter step)
  { x: -5.5, z: -2.1 },  // d = 4 (relStep = 2, same-color)
  { x: -4.45, z: -2.1 }, // d = 5 (relStep = 3)
  { x: -3.4, z: -2.1 },  // d = 6 (relStep = 4, opposite Fly-Across End)
  { x: -2.1, z: -3.4 },  // d = 7 (relStep = 5, adjacent Fly-Across Start)
  { x: -2.1, z: -4.45 }, // d = 8 (relStep = 6, same-color)
  { x: -2.1, z: -5.5 },  // d = 9 (relStep = 7)
  { x: -2.1, z: -6.55 }, // d = 10 (relStep = 8)
  { x: -2.1, z: -7.6 },  // d = 11 (relStep = 9)
  { x: -1.05, z: -7.6 }, // d = 12 (relStep = 10, same-color)
]);

const HOME_STRETCH_X_STEPS = Object.freeze([
  -6.2, // relStep = 51 (step 1)
  -4.8, // relStep = 52 (step 2)
  -3.4, // relStep = 53 (step 3 - exact Fly-Across runway intersection!)
  -2.2, // relStep = 54 (step 4)
  -1.15, // relStep = 55 (step 5)
  -0.35, // relStep = 56 (step 6 - Center Star Goal)
]);

const BASE_HANGAR_SLOTS = Object.freeze([
  { x: -6.35, z: -6.35 },
  { x: -4.95, z: -6.35 },
  { x: -6.35, z: -4.95 },
  { x: -4.95, z: -4.95 },
]);

const BASE_TROPHY_SLOTS = Object.freeze([
  { x: -6.35, z: -6.35 },
  { x: -4.95, z: -6.35 },
  { x: -6.35, z: -4.95 },
  { x: -4.95, z: -4.95 },
]);

const BASE_LAUNCHPAD = Object.freeze({ x: -6.65, z: -3.45 });

function buildBoardTopology() {
  const trackTiles = new Array(TRACK_TILE_COUNT);
  for (let q = 0; q < 4; q += 1) {
    for (let d = 0; d < QUADRANT_TILE_COUNT; d += 1) {
      const trackIndex = (49 + q * QUADRANT_TILE_COUNT + d) % TRACK_TILE_COUNT;
      const basePt = BASE_QUADRANT_PATH[d];
      const pt = rotateBoardPoint(basePt.x, basePt.z, q);
      const colorIndex = getTrackTileColorIndex(trackIndex);
      trackTiles[trackIndex] = Object.freeze({
        trackIndex,
        colorIndex,
        colorId: COLOR_IDS[colorIndex],
        x: Number(pt.x.toFixed(3)),
        z: Number(pt.z.toFixed(3)),
        isHomeEntryForColor: d === 0 ? q : -1,
        isFlyStartForColor: d === 7 ? (q + 3) % 4 : -1,
        isFlyEndForColor: d === 6 ? (q + 2) % 4 : -1,
      });
    }
  }

  const homeStretches = [];
  const hangars = [];
  const launchPads = [];
  const runways = [];

  for (let c = 0; c < 4; c += 1) {
    const colorId = COLOR_IDS[c];
    const stretch = [];
    for (let s = 0; s < 6; s += 1) {
      const relStep = FIRST_HOME_REL_STEP + s;
      const pt = rotateBoardPoint(HOME_STRETCH_X_STEPS[s], 0, c);
      stretch.push(
        Object.freeze({
          colorIndex: c,
          colorId,
          homeStep: s + 1,
          relStep,
          x: Number(pt.x.toFixed(3)),
          z: Number(pt.z.toFixed(3)),
          isRunwayIntersection: relStep === RUNWAY_INTERSECT_HOME_REL_STEP,
          isGoal: relStep === GOAL_REL_STEP,
        })
      );
    }
    homeStretches.push(Object.freeze(stretch));

    const slots = BASE_HANGAR_SLOTS.map((slot, slotIdx) => {
      const pt = rotateBoardPoint(slot.x, slot.z, c);
      const trophyPt = rotateBoardPoint(BASE_TROPHY_SLOTS[slotIdx].x, BASE_TROPHY_SLOTS[slotIdx].z, c);
      return Object.freeze({
        colorIndex: c,
        colorId,
        slotIndex: slotIdx,
        x: Number(pt.x.toFixed(3)),
        z: Number(pt.z.toFixed(3)),
        trophyX: Number(trophyPt.x.toFixed(3)),
        trophyZ: Number(trophyPt.z.toFixed(3)),
      });
    });
    const centerPt = rotateBoardPoint(-5.65, -5.65, c);
    hangars.push(
      Object.freeze({
        colorIndex: c,
        colorId,
        centerX: Number(centerPt.x.toFixed(3)),
        centerZ: Number(centerPt.z.toFixed(3)),
        slots: Object.freeze(slots),
      })
    );

    const lpPt = rotateBoardPoint(BASE_LAUNCHPAD.x, BASE_LAUNCHPAD.z, c);
    launchPads.push(
      Object.freeze({
        colorIndex: c,
        colorId,
        x: Number(lpPt.x.toFixed(3)),
        z: Number(lpPt.z.toFixed(3)),
      })
    );
  }

  for (let c = 0; c < 4; c += 1) {
    const startTrackIndex = relStepToTrackIndex(c, FLY_START_REL_STEP);
    const endTrackIndex = relStepToTrackIndex(c, FLY_END_REL_STEP);
    const intersectHomeColorIndex = (c + 2) % 4;
    const startTile = trackTiles[startTrackIndex];
    const endTile = trackTiles[endTrackIndex];
    const intersectTile = homeStretches[intersectHomeColorIndex][2]; // relStep = 53
    runways.push(
      Object.freeze({
        colorIndex: c,
        colorId: COLOR_IDS[c],
        startRelStep: FLY_START_REL_STEP,
        endRelStep: FLY_END_REL_STEP,
        postFlyJumpRelStep: POST_FLY_JUMP_REL_STEP,
        startTrackIndex,
        endTrackIndex,
        intersectHomeColorIndex,
        intersectHomeRelStep: RUNWAY_INTERSECT_HOME_REL_STEP,
        startX: startTile.x,
        startZ: startTile.z,
        endX: endTile.x,
        endZ: endTile.z,
        intersectX: intersectTile.x,
        intersectZ: intersectTile.z,
      })
    );
  }

  return Object.freeze({
    trackTiles: Object.freeze(trackTiles),
    homeStretches: Object.freeze(homeStretches),
    hangars: Object.freeze(hangars),
    launchPads: Object.freeze(launchPads),
    runways: Object.freeze(runways),
  });
}

export const BOARD_TOPOLOGY = buildBoardTopology();

/**
 * Resolves the exact 3D board world coordinates (x, z) for a plane given its
 * colorIndex, planeIndex (0..3), state, relStep, and stack offset.
 */
export function resolvePlaneWorldCoords(colorIndex, planeIndex, state, relStep, stackIndex = 0, stackCount = 1) {
  let baseX = 0;
  let baseZ = 0;

  if (state === PLANE_STATES.HANGAR || relStep < 0) {
    const slot = BOARD_TOPOLOGY.hangars[colorIndex].slots[planeIndex];
    return { x: slot.x, z: slot.z };
  }
  if (state === PLANE_STATES.GOAL || relStep >= GOAL_REL_STEP) {
    const slot = BOARD_TOPOLOGY.hangars[colorIndex].slots[planeIndex];
    return { x: slot.trophyX, z: slot.trophyZ };
  }
  if (state === PLANE_STATES.LAUNCHPAD || relStep === LAUNCHPAD_REL_STEP) {
    const lp = BOARD_TOPOLOGY.launchPads[colorIndex];
    baseX = lp.x;
    baseZ = lp.z;
  } else if (relStep >= FIRST_TRACK_REL_STEP && relStep <= HOME_ENTRY_REL_STEP) {
    const tIdx = relStepToTrackIndex(colorIndex, relStep);
    const tile = BOARD_TOPOLOGY.trackTiles[tIdx];
    baseX = tile.x;
    baseZ = tile.z;
  } else if (relStep >= FIRST_HOME_REL_STEP && relStep < GOAL_REL_STEP) {
    const homeIdx = Math.min(5, Math.max(0, relStep - FIRST_HOME_REL_STEP));
    const tile = BOARD_TOPOLOGY.homeStretches[colorIndex][homeIdx];
    baseX = tile.x;
    baseZ = tile.z;
  }

  if (stackCount > 1) {
    const angle = (stackIndex / stackCount) * Math.PI * 2 + 0.4;
    const radius = 0.30;
    baseX += Math.cos(angle) * radius;
    baseZ += Math.sin(angle) * radius;
  }

  return {
    x: Number(baseX.toFixed(3)),
    z: Number(baseZ.toFixed(3)),
  };
}
