/**
 * Authentic QQ Aeroplane Chess 3D (QQ飞行棋 3D) Simulation Engine & Tactical AI.
 *
 * Implements 100% authentic Tencent QQ Game Hall *QQ飞行棋* rules:
 * - Takeoff on 5/6 (default fast rule) or 6-only (classic rule)
 * - Bonus roll on 6 + Triple-6 safety cap (3 consecutive 6s)
 * - Same-Color Jump (+4 tiles on outer ring, excluding relStep=50 Home Entry)
 * - Dashed Fly-Across Shortcut (+12 tiles from relStep=18 to relStep=30)
 * - Jump->Fly (14 -> 18 -> 30) and Fly->Jump (18 -> 30 -> 34) chaining with visited Set guard
 * - Mid-Runway Enemy Capture (飞棋撞子 on intersected opposite Home Stretch step 53 & midpoint)
 * - Regular Enemy Capture (撞子) & Friendly Plane Stacking (叠机 with 3D count badge)
 * - Exact Goal Crown (relStep=56 -> Trophy Pedestal) & Overshoot Bounce-Back (终点反弹)
 * - Quick 2-Plane Kids Mode (planesToWin=2) & Classic 4-Plane Mode (planesToWin=4)
 * - 1P vs 3 Smart Tactical AI & 2P-4P Pass-and-Play -> Top-3 3D Star Podium (3/2/1/0 stars)
 */

import {
  BOARD_TOPOLOGY,
  COLOR_IDS,
  COLOR_META,
  EVENT_TYPES,
  FIRST_HOME_REL_STEP,
  FIRST_TRACK_REL_STEP,
  FLY_END_REL_STEP,
  FLY_START_REL_STEP,
  GOAL_REL_STEP,
  HANGAR_REL_STEP,
  HOME_ENTRY_REL_STEP,
  LAUNCHPAD_REL_STEP,
  MATCH_PHASES,
  PACE_CONSTANTS,
  PLANE_STATES,
  POST_FLY_JUMP_REL_STEP,
  RUNWAY_INTERSECT_HOME_REL_STEP,
  TURN_PHASES,
  createMulberry32,
  isSameColorOuterStep,
  relStepToTrackIndex,
  resolvePlaneWorldCoords,
} from '../contracts/constants.js';

function recordAeroplaneHallProgress(humanRank, humanStars) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = 'qq_hall_progress';
    const raw = window.localStorage.getItem(key);
    let root = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          root = parsed;
        }
      } catch (_) {
        root = {};
      }
    }
    const prev =
      root.aeroplane && typeof root.aeroplane === 'object' ? root.aeroplane : {};
    const prevPlays = Number.isFinite(Number(prev.plays)) ? Number(prev.plays) : 0;
    const prevBest = Number.isFinite(Number(prev.best)) ? Number(prev.best) : 0;
    const prevStars = Number.isFinite(Number(prev.stars)) ? Number(prev.stars) : 0;
    const stars = Math.max(0, Math.min(3, Math.round(Number(humanStars) || 0)));
    const won = humanRank === 1 ? 1 : 0;
    const best = Math.max(prevBest + won, stars, 1);
    root.aeroplane = {
      plays: prevPlays + 1,
      best,
      stars: Math.max(prevStars, stars),
      last: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(root));
  } catch (_) {
    // Ignore storage errors in restricted environments
  }
}

function normalizeStateFromRelStep(relStep, explicitState = null) {
  if (explicitState && Object.values(PLANE_STATES).includes(explicitState)) {
    if (explicitState === PLANE_STATES.HANGAR) return { state: PLANE_STATES.HANGAR, relStep: HANGAR_REL_STEP };
    if (explicitState === PLANE_STATES.LAUNCHPAD) return { state: PLANE_STATES.LAUNCHPAD, relStep: LAUNCHPAD_REL_STEP };
    if (explicitState === PLANE_STATES.GOAL) return { state: PLANE_STATES.GOAL, relStep: GOAL_REL_STEP };
    if (explicitState === PLANE_STATES.HOMESTRETCH) {
      const clamped = Math.max(FIRST_HOME_REL_STEP, Math.min(GOAL_REL_STEP - 1, Number(relStep) || FIRST_HOME_REL_STEP));
      return { state: PLANE_STATES.HOMESTRETCH, relStep: clamped };
    }
    if (explicitState === PLANE_STATES.TRACK) {
      const clamped = Math.max(FIRST_TRACK_REL_STEP, Math.min(HOME_ENTRY_REL_STEP, Number(relStep) || FIRST_TRACK_REL_STEP));
      return { state: PLANE_STATES.TRACK, relStep: clamped };
    }
  }
  const r = Number.isFinite(Number(relStep)) ? Math.round(Number(relStep)) : HANGAR_REL_STEP;
  if (r < 0) return { state: PLANE_STATES.HANGAR, relStep: HANGAR_REL_STEP };
  if (r === 0) return { state: PLANE_STATES.LAUNCHPAD, relStep: LAUNCHPAD_REL_STEP };
  if (r >= FIRST_TRACK_REL_STEP && r <= HOME_ENTRY_REL_STEP) {
    return { state: PLANE_STATES.TRACK, relStep: r };
  }
  if (r >= FIRST_HOME_REL_STEP && r < GOAL_REL_STEP) {
    return { state: PLANE_STATES.HOMESTRETCH, relStep: r };
  }
  return { state: PLANE_STATES.GOAL, relStep: GOAL_REL_STEP };
}

export class AeroplaneSimEngine {
  constructor(options = {}) {
    this.seed =
      options.seed !== undefined && Number.isFinite(Number(options.seed))
        ? Number(options.seed) >>> 0
        : 20261029;
    this.rng = createMulberry32(this.seed);

    // Mode & planesToWin resolution
    const rawMode = String(options.modeId || options.mode || 'quick_2').toLowerCase();
    this.modeId = rawMode.includes('4') || rawMode.includes('classic') ? 'classic_4' : 'quick_2';
    if (options.planesToWin !== undefined && Number.isFinite(Number(options.planesToWin))) {
      this.planesToWin = Math.max(1, Math.min(4, Math.round(Number(options.planesToWin))));
      if (this.planesToWin === 4) this.modeId = 'classic_4';
      else if (this.planesToWin === 2) this.modeId = 'quick_2';
    } else {
      this.planesToWin = this.modeId === 'classic_4' ? 4 : 2;
    }

    // Takeoff rule: 'five_six' ([5, 6] default) or 'strict_six' ([6])
    const rawRule = String(options.takeoffRule || 'five_six').toLowerCase();
    const strictSix =
      Boolean(options.strictSixTakeoff) ||
      rawRule === 'strict_six' ||
      rawRule === 'six' ||
      rawRule === '6' ||
      options.takeoffOnFive === false;
    this.takeoffRule = strictSix ? 'strict_six' : 'five_six';
    this.takeoffDiceValues = strictSix ? [6] : [5, 6];
    if (Array.isArray(options.takeoffDiceValues) && options.takeoffDiceValues.length > 0) {
      this.takeoffDiceValues = options.takeoffDiceValues
        .map((v) => Math.round(Number(v)))
        .filter((v) => v >= 1 && v <= 6);
    }

    // Forced dice queue for deterministic testing
    this.forcedDiceQueue = [];
    if (Array.isArray(options.forcedDiceQueue)) {
      for (const v of options.forcedDiceQueue) {
        const d = Math.round(Number(v));
        if (d >= 1 && d <= 6) {
          this.forcedDiceQueue.push(d);
        }
      }
    }

    // Human vs AI player configuration
    this.humanColorIndex =
      options.humanColorIndex !== undefined
        ? Math.max(0, Math.min(3, Number(options.humanColorIndex) || 0))
        : 0;
    const humanCount =
      options.humanCount !== undefined
        ? Math.max(0, Math.min(4, Math.round(Number(options.humanCount))))
        : options.allAi || options.autoPlayAll
          ? 0
          : 1;
    this.humanCount = humanCount;

    // Auto-advance single legal move option (only when not using explicit test overrides unless requested)
    const hasTestOverrides =
      (Array.isArray(options.forcedDiceQueue) && options.forcedDiceQueue.length > 0) ||
      Boolean(options.customPlaneStates);
    this.autoAdvanceSingleMove =
      options.autoAdvanceSingleMove !== undefined
        ? Boolean(options.autoAdvanceSingleMove)
        : !hasTestOverrides;

    // Fast-start default: every player begins with 1 plane on its launchpad
    // AND the human's very first roll of a match is guaranteed to be a takeoff die (5 or 6).
    // Both are exposed as options so legacy tests can disable them.
    this.fastStart =
      options.fastStart !== undefined
        ? Boolean(options.fastStart)
        : !Boolean(options.customPlaneStates);
    this.guaranteedFirstTakeoff =
      options.guaranteedFirstTakeoff !== undefined
        ? Boolean(options.guaranteedFirstTakeoff)
        : Boolean(this.fastStart);
    this._humanFirstRollGuaranteedUsed = false;

    this.players = COLOR_IDS.map((colorId, c) => {
      const meta = COLOR_META[colorId];
      let isAi = true;
      if (Array.isArray(options.playerTypes) && options.playerTypes[c]) {
        isAi = String(options.playerTypes[c]).toLowerCase() === 'ai';
      } else if (options.allAi || options.autoPlayAll) {
        isAi = true;
      } else if (humanCount === 1) {
        isAi = c !== this.humanColorIndex;
      } else {
        isAi = c >= humanCount;
      }

      const planes = [0, 1, 2, 3].map((pIdx) => {
        const startsOnLaunchpad = this.fastStart && pIdx === 0;
        return {
          id: `${colorId}_${pIdx}`,
          globalIndex: c * 4 + pIdx,
          colorIndex: c,
          colorId,
          planeIndex: pIdx,
          state: startsOnLaunchpad ? PLANE_STATES.LAUNCHPAD : PLANE_STATES.HANGAR,
          relStep: startsOnLaunchpad ? LAUNCHPAD_REL_STEP : HANGAR_REL_STEP,
          trackIndex: -1,
          stackCount: 1,
          stackIndex: 0,
          crowned: false,
          x: startsOnLaunchpad
            ? BOARD_TOPOLOGY.launchPads[c].x
            : BOARD_TOPOLOGY.hangars[c].slots[pIdx].x,
          z: startsOnLaunchpad
            ? BOARD_TOPOLOGY.launchPads[c].z
            : BOARD_TOPOLOGY.hangars[c].slots[pIdx].z,
        };
      });

      return {
        index: c,
        colorIndex: c,
        colorId,
        nameZh: meta.nameZh,
        shortZh: meta.shortZh,
        hex: meta.hex,
        isAi,
        crownedCount: 0,
        capturesMade: 0,
        timesCaptured: 0,
        jumpsMade: 0,
        fliesMade: 0,
        finishRank: 0,
        starsAwarded: 0,
        planes,
      };
    });

    if (options.customPlaneStates) {
      this._applyCustomPlaneStates(options.customPlaneStates);
    }
    this._recomputeStacksAndCoordinates();

    this.phase = MATCH_PHASES.PLAYING;
    this.currentPlayer =
      options.startingPlayer !== undefined
        ? Math.max(0, Math.min(3, Number(options.startingPlayer) || 0))
        : 0;
    this.turnPhase = TURN_PHASES.AWAIT_ROLL;
    this.turnNumber = 1;
    this.tick = 0;
    this.elapsedSec = 0;
    this.timeScale = 1.0;
    this.slowMoRemainingSec = 0;

    this.diceValue = null;
    this.lastDiceRoll = null;
    this.consecutiveSixes = 0;
    this.bonusRoll = false;
    this.tripleSixCapped = false;
    this.tripleSixCount = 0;
    this.noMovesStamp = null;

    this.legalPlaneIndices = [];
    this.legalMoves = [];
    this.lastMoveResult = null;
    this.activeAnimation = null;
    this.rankings = [];
    this.winnerColorIndex = null;
    this.winnerColorId = null;
    this._hallProgressRecorded = false;

    this._phaseTimerFrames = 0;
    this._aiThinkFrames = this.players[this.currentPlayer].isAi
      ? PACE_CONSTANTS.AI_THINK_FRAMES
      : 0;
    this._singleMoveAutoTimer = 0;
    this._frameEvents = [];

    this._checkImmediateVictoryState();
  }

  _applyCustomPlaneStates(custom) {
    const applyOne = (colorIndex, planeIndex, spec) => {
      if (colorIndex < 0 || colorIndex > 3 || planeIndex < 0 || planeIndex > 3) return;
      const plane = this.players[colorIndex].planes[planeIndex];
      if (typeof spec === 'number') {
        const norm = normalizeStateFromRelStep(spec, null);
        plane.state = norm.state;
        plane.relStep = norm.relStep;
      } else if (typeof spec === 'string') {
        const norm = normalizeStateFromRelStep(null, spec.toLowerCase());
        plane.state = norm.state;
        plane.relStep = norm.relStep;
      } else if (spec && typeof spec === 'object') {
        let rel = spec.relStep !== undefined ? spec.relStep : spec.step;
        if (rel === undefined && spec.homeStep !== undefined) {
          rel = FIRST_HOME_REL_STEP + Number(spec.homeStep) - 1;
        }
        if (rel === undefined && spec.trackIndex !== undefined && Number(spec.trackIndex) >= 0) {
          const tIdx = ((Number(spec.trackIndex) % 52) + 52) % 52;
          const startIdx = (colorIndex * 13) % 52;
          rel = ((tIdx - startIdx + 52) % 52) + 1;
        }
        const norm = normalizeStateFromRelStep(rel, spec.state ? String(spec.state).toLowerCase() : null);
        plane.state = norm.state;
        plane.relStep = norm.relStep;
      }
      plane.crowned = plane.state === PLANE_STATES.GOAL;
      plane.trackIndex =
        plane.state === PLANE_STATES.TRACK
          ? relStepToTrackIndex(colorIndex, plane.relStep)
          : -1;
    };

    if (Array.isArray(custom)) {
      if (custom.length > 0 && Array.isArray(custom[0])) {
        // 4x4 matrix: [[p0..p3], [p0..p3], ...]
        for (let c = 0; c < Math.min(4, custom.length); c += 1) {
          const row = custom[c];
          if (Array.isArray(row)) {
            for (let p = 0; p < Math.min(4, row.length); p += 1) {
              if (row[p] !== undefined && row[p] !== null) {
                applyOne(c, p, row[p]);
              }
            }
          }
        }
      } else {
        // Flat list of override objects or 16-plane flat list
        for (let i = 0; i < custom.length; i += 1) {
          const item = custom[i];
          if (item && typeof item === 'object' && (item.colorIndex !== undefined || item.color || item.colorId || item.playerIndex !== undefined)) {
            let c = item.colorIndex ?? item.playerIndex;
            if (c === undefined && (item.color || item.colorId)) {
              c = COLOR_IDS.indexOf(String(item.color || item.colorId).toLowerCase());
            }
            const p = item.planeIndex ?? item.plane ?? 0;
            applyOne(Number(c), Number(p), item);
          } else if (i < 16) {
            applyOne(Math.floor(i / 4), i % 4, item);
          }
        }
      }
    } else if (custom && typeof custom === 'object') {
      for (const [key, val] of Object.entries(custom)) {
        const lower = key.toLowerCase();
        let c = COLOR_IDS.indexOf(lower);
        if (c < 0 && /^p?[0-3]$/.test(lower)) {
          c = Number(lower.replace('p', ''));
        }
        if (c >= 0 && Array.isArray(val)) {
          for (let p = 0; p < Math.min(4, val.length); p += 1) {
            if (val[p] !== undefined && val[p] !== null) {
              applyOne(c, p, val[p]);
            }
          }
        }
      }
    }
  }

  _recomputeStacksAndCoordinates() {
    for (let c = 0; c < 4; c += 1) {
      const player = this.players[c];
      let crowned = 0;
      const groups = new Map();

      for (const plane of player.planes) {
        if (plane.state === PLANE_STATES.GOAL || plane.relStep >= GOAL_REL_STEP) {
          plane.state = PLANE_STATES.GOAL;
          plane.relStep = GOAL_REL_STEP;
          plane.trackIndex = -1;
          plane.crowned = true;
          plane.stackCount = 1;
          plane.stackIndex = 0;
          crowned += 1;
        } else if (plane.state === PLANE_STATES.HANGAR || plane.relStep < 0) {
          plane.state = PLANE_STATES.HANGAR;
          plane.relStep = HANGAR_REL_STEP;
          plane.trackIndex = -1;
          plane.crowned = false;
          plane.stackCount = 1;
          plane.stackIndex = 0;
        } else {
          plane.crowned = false;
          if (plane.relStep === LAUNCHPAD_REL_STEP) {
            plane.state = PLANE_STATES.LAUNCHPAD;
            plane.trackIndex = -1;
          } else if (plane.relStep <= HOME_ENTRY_REL_STEP) {
            plane.state = PLANE_STATES.TRACK;
            plane.trackIndex = relStepToTrackIndex(c, plane.relStep);
          } else {
            plane.state = PLANE_STATES.HOMESTRETCH;
            plane.trackIndex = -1;
          }
          const key = `${plane.state}:${plane.relStep}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(plane);
        }
      }

      for (const stackPlanes of groups.values()) {
        const count = stackPlanes.length;
        stackPlanes.forEach((pl, idx) => {
          pl.stackCount = count;
          pl.stackIndex = idx;
        });
      }

      for (const plane of player.planes) {
        const coords = resolvePlaneWorldCoords(
          c,
          plane.planeIndex,
          plane.state,
          plane.relStep,
          plane.stackIndex,
          plane.stackCount
        );
        plane.x = coords.x;
        plane.z = coords.z;
      }

      player.crownedCount = crowned;
    }
  }

  canTakeoffWithRoll(diceValue) {
    return this.takeoffDiceValues.includes(Number(diceValue));
  }

  /**
   * Computes the full authentic QQ飞行棋 trajectory and outcome for moving
   * `player.planes[planeIndex]` with `diceValue` (1..6).
   * Returns `null` if the plane cannot legally move on `diceValue`.
   */
  computeMovePreview(colorIndex, planeIndex, diceValue) {
    const d = Math.round(Number(diceValue));
    if (d < 1 || d > 6) return null;
    const player = this.players[colorIndex];
    if (!player) return null;
    const plane = player.planes[planeIndex];
    if (!plane || plane.state === PLANE_STATES.GOAL) return null;

    // Case 1: Takeoff from Hangar -> Launch Pad (relStep = 0)
    if (plane.state === PLANE_STATES.HANGAR) {
      if (!this.canTakeoffWithRoll(d)) return null;
      const destCoords = resolvePlaneWorldCoords(colorIndex, planeIndex, PLANE_STATES.LAUNCHPAD, LAUNCHPAD_REL_STEP, 0, 1);
      const friendlyOnLaunchpad = player.planes.filter(
        (p) => p.planeIndex !== planeIndex && p.state === PLANE_STATES.LAUNCHPAD
      ).length;
      return {
        colorIndex,
        planeIndex,
        globalPlaneIndex: plane.globalIndex,
        diceValue: d,
        fromState: PLANE_STATES.HANGAR,
        fromRelStep: HANGAR_REL_STEP,
        toState: PLANE_STATES.LAUNCHPAD,
        toRelStep: LAUNCHPAD_REL_STEP,
        toTrackIndex: -1,
        tookOff: true,
        didJump: false,
        didFly: false,
        bouncedBack: false,
        overshootSteps: 0,
        crowned: false,
        chainTypes: ['takeoff'],
        chainSteps: [
          {
            type: 'takeoff',
            fromRelStep: HANGAR_REL_STEP,
            toRelStep: LAUNCHPAD_REL_STEP,
          },
        ],
        walkRelSteps: [LAUNCHPAD_REL_STEP],
        touchedTrackIndices: [],
        runwayCaptureTargets: [],
        landingCaptureTargets: [],
        allCaptureTargets: [],
        formsFriendlyStack: friendlyOnLaunchpad > 0,
        resultingStackCount: friendlyOnLaunchpad + 1,
        destX: destCoords.x,
        destZ: destCoords.z,
        waypoints: [
          { x: plane.x, z: plane.z, kind: 'start', relStep: HANGAR_REL_STEP },
          { x: destCoords.x, z: destCoords.z, kind: 'takeoff', relStep: LAUNCHPAD_REL_STEP },
        ],
      };
    }

    // Case 2: Advance from Launch Pad (0), Outer Track (1..50), or Home Stretch (51..55)
    const startRel = plane.relStep;
    const walkRelSteps = [];
    const waypoints = [{ x: plane.x, z: plane.z, kind: 'start', relStep: startRel }];

    let curRel = startRel;
    let dir = 1;
    let bouncedBack = false;
    let overshootSteps = 0;

    for (let s = 1; s <= d; s += 1) {
      if (dir === 1) {
        if (curRel < GOAL_REL_STEP) {
          curRel += 1;
          if (curRel === GOAL_REL_STEP && s < d) {
            dir = -1;
            bouncedBack = true;
            overshootSteps = d - s;
          }
        } else {
          dir = -1;
          curRel -= 1;
          bouncedBack = true;
          overshootSteps += 1;
        }
      } else {
        curRel -= 1;
      }
      walkRelSteps.push(curRel);
      const stepState =
        curRel === GOAL_REL_STEP
          ? PLANE_STATES.GOAL
          : curRel >= FIRST_HOME_REL_STEP
            ? PLANE_STATES.HOMESTRETCH
            : PLANE_STATES.TRACK;
      const stepCoords = resolvePlaneWorldCoords(colorIndex, planeIndex, stepState, curRel, 0, 1);
      waypoints.push({
        x: stepCoords.x,
        z: stepCoords.z,
        kind: bouncedBack && dir === -1 ? 'bounce' : 'hop',
        relStep: curRel,
      });
    }

    let didJump = false;
    let didFly = false;
    const chainTypes = [];
    const chainSteps = [];
    const touchedTrackIndices = [];
    const runwayCaptureTargets = [];

    const addTrackTouch = (relStep) => {
      if (relStep >= FIRST_TRACK_REL_STEP && relStep <= HOME_ENTRY_REL_STEP) {
        const tIdx = relStepToTrackIndex(colorIndex, relStep);
        if (tIdx >= 0 && !touchedTrackIndices.includes(tIdx)) {
          touchedTrackIndices.push(tIdx);
        }
      }
    };

    addTrackTouch(curRel);

    // Chained Same-Color Jump (+4) and Dashed Fly-Across (+12) on Outer Track (1..49)
    // Explicit visited Set guarantees zero infinite loops.
    const visitedRelSteps = new Set([curRel]);
    while (curRel >= FIRST_TRACK_REL_STEP && curRel < HOME_ENTRY_REL_STEP) {
      if (curRel === FLY_START_REL_STEP && !didFly) {
        const nextRel = FLY_END_REL_STEP; // 18 + 12 = 30
        if (visitedRelSteps.has(nextRel)) break;
        visitedRelSteps.add(nextRel);
        didFly = true;
        chainTypes.push('fly');
        chainSteps.push({
          type: 'fly',
          fromRelStep: FLY_START_REL_STEP,
          toRelStep: nextRel,
        });

        // Mid-runway enemy capture check (飞棋撞子):
        // Strictly captures enemy planes sitting on the opposite color's
        // Home Stretch step 3 (relStep = 53) crossed by the dashed bridge.
        const runway = BOARD_TOPOLOGY.runways[colorIndex];
        const oppPlayer = this.players[runway.intersectHomeColorIndex];
        for (const enemyPlane of oppPlayer.planes) {
          if (
            enemyPlane.state === PLANE_STATES.HOMESTRETCH &&
            enemyPlane.relStep === RUNWAY_INTERSECT_HOME_REL_STEP
          ) {
            runwayCaptureTargets.push({
              colorIndex: enemyPlane.colorIndex,
              colorId: enemyPlane.colorId,
              planeIndex: enemyPlane.planeIndex,
              globalIndex: enemyPlane.globalIndex,
              fromState: enemyPlane.state,
              fromRelStep: enemyPlane.relStep,
              reason: 'runway_intersection',
            });
          }
        }

        curRel = nextRel;
        addTrackTouch(curRel);
        const flyCoords = resolvePlaneWorldCoords(colorIndex, planeIndex, PLANE_STATES.TRACK, curRel, 0, 1);
        waypoints.push({
          x: runway.intersectX,
          z: runway.intersectZ,
          kind: 'fly_mid',
          relStep: curRel,
        });
        waypoints.push({
          x: flyCoords.x,
          z: flyCoords.z,
          kind: 'fly_land',
          relStep: curRel,
        });
        continue;
      }

      if (isSameColorOuterStep(curRel) && curRel < HOME_ENTRY_REL_STEP && !didJump) {
        const nextRel = curRel + 4;
        if (nextRel > HOME_ENTRY_REL_STEP || visitedRelSteps.has(nextRel)) break;
        const prevRel = curRel;
        visitedRelSteps.add(nextRel);
        didJump = true;
        chainTypes.push('jump');
        chainSteps.push({
          type: 'jump',
          fromRelStep: prevRel,
          toRelStep: nextRel,
        });
        curRel = nextRel;
        addTrackTouch(curRel);
        const jumpCoords = resolvePlaneWorldCoords(colorIndex, planeIndex, PLANE_STATES.TRACK, curRel, 0, 1);
        waypoints.push({
          x: jumpCoords.x,
          z: jumpCoords.z,
          kind: 'jump',
          relStep: curRel,
        });
        continue;
      }

      break;
    }

    const finalState =
      curRel === GOAL_REL_STEP
        ? PLANE_STATES.GOAL
        : curRel >= FIRST_HOME_REL_STEP
          ? PLANE_STATES.HOMESTRETCH
          : PLANE_STATES.TRACK;
    const finalTrackIndex =
      finalState === PLANE_STATES.TRACK ? relStepToTrackIndex(colorIndex, curRel) : -1;

    // Enemy planes on any touched outer-track landing tile are captured!
    const landingCaptureTargets = [];
    for (const tIdx of touchedTrackIndices) {
      for (let ec = 0; ec < 4; ec += 1) {
        if (ec === colorIndex) continue;
        for (const enemyPlane of this.players[ec].planes) {
          if (enemyPlane.state === PLANE_STATES.TRACK && enemyPlane.trackIndex === tIdx) {
            const alreadyListed =
              landingCaptureTargets.some((t) => t.globalIndex === enemyPlane.globalIndex) ||
              runwayCaptureTargets.some((t) => t.globalIndex === enemyPlane.globalIndex);
            if (!alreadyListed) {
              landingCaptureTargets.push({
                colorIndex: enemyPlane.colorIndex,
                colorId: enemyPlane.colorId,
                planeIndex: enemyPlane.planeIndex,
                globalIndex: enemyPlane.globalIndex,
                fromState: enemyPlane.state,
                fromRelStep: enemyPlane.relStep,
                trackIndex: tIdx,
                reason: tIdx === finalTrackIndex ? 'landing_capture' : 'chain_capture',
              });
            }
          }
        }
      }
    }

    const allCaptureTargets = [...runwayCaptureTargets, ...landingCaptureTargets];

    const friendlyAtDest =
      finalState === PLANE_STATES.GOAL
        ? 0
        : player.planes.filter(
            (p) => p.planeIndex !== planeIndex && p.state === finalState && p.relStep === curRel
          ).length;

    const destCoords = resolvePlaneWorldCoords(colorIndex, planeIndex, finalState, curRel, 0, 1);

    return {
      colorIndex,
      planeIndex,
      globalPlaneIndex: plane.globalIndex,
      diceValue: d,
      fromState: plane.state,
      fromRelStep: startRel,
      toState: finalState,
      toRelStep: curRel,
      toTrackIndex: finalTrackIndex,
      tookOff: false,
      didJump,
      didFly,
      bouncedBack,
      overshootSteps,
      crowned: finalState === PLANE_STATES.GOAL,
      chainTypes,
      chainSteps,
      walkRelSteps,
      touchedTrackIndices,
      runwayCaptureTargets,
      landingCaptureTargets,
      allCaptureTargets,
      formsFriendlyStack: friendlyAtDest > 0,
      resultingStackCount: friendlyAtDest + 1,
      destX: destCoords.x,
      destZ: destCoords.z,
      waypoints,
    };
  }

  _computeLegalMovesForCurrentPlayer(diceValue) {
    const moves = [];
    for (let pIdx = 0; pIdx < 4; pIdx += 1) {
      const preview = this.computeMovePreview(this.currentPlayer, pIdx, diceValue);
      if (preview) {
        moves.push(preview);
      }
    }
    return this._decorateAndScoreLegalMoves(moves);
  }

  _decorateAndScoreLegalMoves(moves) {
    if (!Array.isArray(moves) || moves.length === 0) return [];
    const player = this.players[this.currentPlayer];
    const activeOnBoard = player.planes.filter(
      (p) =>
        p.state === PLANE_STATES.LAUNCHPAD ||
        p.state === PLANE_STATES.TRACK ||
        p.state === PLANE_STATES.HOMESTRETCH
    ).length;
    const neededToWin = Math.max(1, this.planesToWin - player.crownedCount);

    let bestScore = -Infinity;
    let bestPlaneIndex = moves[0].planeIndex;
    const seenEquivKeys = new Set();

    for (const move of moves) {
      let score = 0;
      if (move.allCaptureTargets.length > 0) {
        score += 950 * move.allCaptureTargets.length;
      }
      if (move.didFly && move.didJump) {
        score += 820;
      } else if (move.didFly) {
        score += 720;
      } else if (move.didJump) {
        score += 420;
      }
      if (move.crowned) {
        score += 900;
      }
      if (move.tookOff) {
        score += activeOnBoard < neededToWin ? 540 : 210;
      }
      if (move.bouncedBack) {
        score -= 420;
      }
      if (move.toState === PLANE_STATES.HOMESTRETCH) {
        score += 320 + move.toRelStep * 4;
      } else if (move.toState === PLANE_STATES.TRACK) {
        score += move.toRelStep * 5;
      }
      if (move.formsFriendlyStack) {
        score += 65;
      }

      let outcomeType = 'advance';
      let outcomeIcon = '✈️';
      let outcomeLabel = `前进+${move.diceValue}`;
      if (move.allCaptureTargets.length > 0) {
        outcomeType = 'capture';
        outcomeIcon = '💥';
        outcomeLabel = '击落!';
      } else if (move.crowned) {
        outcomeType = 'home';
        outcomeIcon = '⭐';
        outcomeLabel = '到家!';
      } else if (move.didFly) {
        outcomeType = 'fly';
        outcomeIcon = '✈️';
        outcomeLabel = move.didJump ? '飞棋+跳!' : '飞棋+12';
      } else if (move.didJump) {
        outcomeType = 'jump';
        outcomeIcon = '🦘';
        outcomeLabel = '跳子+4';
      } else if (move.bouncedBack) {
        outcomeType = 'bounce';
        outcomeIcon = '↩';
        outcomeLabel = '反弹';
      } else if (move.toState === PLANE_STATES.HOMESTRETCH) {
        outcomeType = 'home';
        outcomeIcon = '⭐';
        outcomeLabel = '冲刺走廊';
      } else if (move.tookOff) {
        outcomeType = 'takeoff';
        outcomeIcon = '🛫';
        outcomeLabel = '起飞';
      }

      // Dedupe equivalent moves (same destination & outcome, e.g. multiple hangar planes taking off
      // or stacked planes advancing together): keep lowest planeIndex as isUniqueOutcome = true.
      const equivKey = `${move.toState}:${move.toRelStep}:${outcomeType}`;
      if (seenEquivKeys.has(equivKey)) {
        move.isUniqueOutcome = false;
        score -= 5;
      } else {
        seenEquivKeys.add(equivKey);
        move.isUniqueOutcome = true;
      }

      move.score = score;
      move.outcomeType = outcomeType;
      move.outcomeIcon = outcomeIcon;
      move.outcomeLabel = outcomeLabel;
      move.isBestHint = false;

      if (score > bestScore) {
        bestScore = score;
        bestPlaneIndex = move.planeIndex;
      }
    }

    for (const move of moves) {
      move.isBestHint = move.planeIndex === bestPlaneIndex;
    }

    return moves;
  }

  /**
   * Smart Tactical AI move selector:
   * Prioritizes Capture > Fly+Jump > Exact Goal Crown > Takeoff > Safe Advance.
   */
  chooseBestMoveForAi(legalMoves = this.legalMoves) {
    if (!Array.isArray(legalMoves) || legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];

    const hinted = legalMoves.find((m) => m.isBestHint);
    if (hinted) return hinted;

    const decorated = this._decorateAndScoreLegalMoves(legalMoves);
    return decorated.find((m) => m.isBestHint) || decorated[0];
  }

  /**
   * Rolls the dice for the current player.
   * Strictly arg-less (draws only from `forcedDiceQueue` set via `startMatch` or PRNG).
   */
  rollDice() {
    if (this.phase !== MATCH_PHASES.PLAYING) {
      return this.getSnapshot();
    }

    // If a previous no-moves or triple-six turn was waiting for its visual timer,
    // flush the turn handoff first so back-to-back rollDice() calls work cleanly.
    if (
      this.turnPhase === TURN_PHASES.NO_MOVES ||
      this.turnPhase === TURN_PHASES.TRIPLE_SIX
    ) {
      this._advanceToNextPlayerTurn();
    }

    if (this.turnPhase !== TURN_PHASES.AWAIT_ROLL) {
      return this.getSnapshot();
    }

    // Clear any residual animation from a prior move if caller invoked rollDice() directly
    this.activeAnimation = null;
    this.noMovesStamp = null;

    const activePlayer = this.players[this.currentPlayer];
    let rolled = null;
    if (this.forcedDiceQueue.length > 0) {
      rolled = this.forcedDiceQueue.shift();
      if (!activePlayer.isAi) {
        this._humanFirstRollGuaranteedUsed = true;
      }
    }
    if (rolled === null) {
      if (
        !activePlayer.isAi &&
        this.guaranteedFirstTakeoff &&
        !this._humanFirstRollGuaranteedUsed
      ) {
        this._humanFirstRollGuaranteedUsed = true;
        const pool =
          Array.isArray(this.takeoffDiceValues) && this.takeoffDiceValues.length > 0
            ? this.takeoffDiceValues
            : [5, 6];
        const idx = Math.floor(this.rng.nextFloat() * pool.length) % pool.length;
        rolled = pool[idx];
      } else {
        if (!activePlayer.isAi) {
          this._humanFirstRollGuaranteedUsed = true;
        }
        rolled = this.rng.nextDie();
      }
    }

    this.diceValue = rolled;
    this.lastDiceRoll = rolled;
    this._frameEvents.push({
      type: EVENT_TYPES.DICE_ROLL,
      playerIndex: this.currentPlayer,
      colorId: COLOR_IDS[this.currentPlayer],
      diceValue: rolled,
    });

    if (rolled === 6) {
      this.consecutiveSixes += 1;
    } else {
      this.consecutiveSixes = 0;
    }

    // Check Classic Triple-6 Safety Cap (3 consecutive 6s)
    if (this.consecutiveSixes >= 3) {
      this.tripleSixCapped = true;
      this.tripleSixCount += 1;
      this.bonusRoll = false;
      this.consecutiveSixes = 0;
      this.legalMoves = this._computeLegalMovesForCurrentPlayer(rolled);
      this.legalPlaneIndices = this.legalMoves.map((m) => m.planeIndex);
      this.turnPhase = TURN_PHASES.TRIPLE_SIX;
      this._phaseTimerFrames = 10;
      this._frameEvents.push({
        type: EVENT_TYPES.TRIPLE_SIX,
        playerIndex: this.currentPlayer,
        colorId: COLOR_IDS[this.currentPlayer],
      });
      return this.getSnapshot();
    }

    this.tripleSixCapped = false;
    this.bonusRoll = rolled === 6;
    this.legalMoves = this._computeLegalMovesForCurrentPlayer(rolled);
    this.legalPlaneIndices = this.legalMoves.map((m) => m.planeIndex);

    if (this.legalMoves.length === 0) {
      this.bonusRoll = false;
      this.consecutiveSixes = 0;
      this.turnPhase = TURN_PHASES.NO_MOVES;
      this._phaseTimerFrames = PACE_CONSTANTS.NO_MOVES_PAUSE_FRAMES;
      this.noMovesStamp = {
        playerIndex: this.currentPlayer,
        colorId: COLOR_IDS[this.currentPlayer],
        isHuman: !activePlayer.isAi,
        size: activePlayer.isAi ? 'tiny' : 'big',
        diceValue: rolled,
        text: '没掷到5/6，起飞失败',
      };
      this._frameEvents.push({
        type: EVENT_TYPES.NO_MOVES,
        playerIndex: this.currentPlayer,
        colorId: COLOR_IDS[this.currentPlayer],
        isHuman: !activePlayer.isAi,
        diceValue: rolled,
        text: '没掷到5/6，起飞失败',
      });
    } else {
      this.turnPhase = TURN_PHASES.AWAIT_MOVE;
      this._phaseTimerFrames = PACE_CONSTANTS.DICE_TUMBLE_FRAMES;
      this._singleMoveAutoTimer =
        !activePlayer.isAi &&
        this.autoAdvanceSingleMove &&
        this.legalMoves.length === 1
          ? PACE_CONSTANTS.SINGLE_MOVE_AUTO_FRAMES
          : 0;
      if (activePlayer.isAi) {
        this._aiThinkFrames = PACE_CONSTANTS.DICE_TUMBLE_FRAMES;
      }
    }

    return this.getSnapshot();
  }

  /**
   * Selects and moves `planeIndex` (0..3 for currentPlayer, or globalIndex 0..15).
   * Applies logical board state immediately while queuing the 3D parabolic hop
   * animation in `this.activeAnimation`.
   */
  selectPlane(planeSpec) {
    if (this.phase !== MATCH_PHASES.PLAYING) {
      return this.getSnapshot();
    }
    if (
      this.turnPhase !== TURN_PHASES.AWAIT_MOVE &&
      this.turnPhase !== TURN_PHASES.ROLLING &&
      this.turnPhase !== TURN_PHASES.TRIPLE_SIX
    ) {
      return this.getSnapshot();
    }

    let localIdx = -1;
    if (typeof planeSpec === 'string') {
      const m = planeSpec.match(/([0-3])$/);
      if (m) localIdx = Number(m[1]);
    } else if (Number.isFinite(Number(planeSpec))) {
      const n = Math.round(Number(planeSpec));
      if (n >= 0 && n <= 3) {
        localIdx = n;
      } else if (n >= 4 && n < 16 && Math.floor(n / 4) === this.currentPlayer) {
        localIdx = n % 4;
      }
    }

    // If Triple-6 cap was active and caller explicitly called selectPlane,
    // forfeit/cap the 3rd six and pass the turn cleanly to next player.
    if (this.turnPhase === TURN_PHASES.TRIPLE_SIX) {
      this._advanceToNextPlayerTurn();
      return this.getSnapshot();
    }

    let move = this.legalMoves.find((m) => m.planeIndex === localIdx);
    if (!move && localIdx === -1 && this.legalMoves.length > 0) {
      move = this.chooseBestMoveForAi(this.legalMoves);
    }
    if (!move) {
      return this.getSnapshot();
    }

    this._executeMove(move);
    return this.getSnapshot();
  }

  _executeMove(move) {
    const player = this.players[move.colorIndex];
    const plane = player.planes[move.planeIndex];

    // Apply destination state to moving plane
    plane.state = move.toState;
    plane.relStep = move.toRelStep;
    plane.trackIndex = move.toTrackIndex;
    plane.crowned = move.crowned;

    if (move.tookOff) {
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_TAKEOFF,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
      });
    } else {
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_HOP,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
        steps: move.diceValue,
      });
    }

    if (move.didJump) {
      player.jumpsMade += 1;
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_JUMP,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
      });
    }

    if (move.didFly) {
      player.fliesMade += 1;
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_FLY,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
      });
    }

    if (move.bouncedBack) {
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_BOUNCE,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
        overshootSteps: move.overshootSteps,
      });
    }

    // Process enemy captures (mid-runway + landing)
    const capturedPlanes = [];
    for (const target of move.allCaptureTargets) {
      const enemyPlayer = this.players[target.colorIndex];
      const enemyPlane = enemyPlayer.planes[target.planeIndex];
      const prevX = enemyPlane.x;
      const prevZ = enemyPlane.z;
      enemyPlane.state = PLANE_STATES.HANGAR;
      enemyPlane.relStep = HANGAR_REL_STEP;
      enemyPlane.trackIndex = -1;
      enemyPlane.crowned = false;
      enemyPlane.stackCount = 1;
      enemyPlane.stackIndex = 0;

      player.capturesMade += 1;
      enemyPlayer.timesCaptured += 1;
      capturedPlanes.push({
        ...target,
        prevX,
        prevZ,
      });

      this._frameEvents.push({
        type:
          target.reason === 'runway_intersection'
            ? EVENT_TYPES.RUNWAY_CAPTURE
            : EVENT_TYPES.PLANE_CAPTURE,
        attackerColorIndex: move.colorIndex,
        victimColorIndex: target.colorIndex,
        victimPlaneIndex: target.planeIndex,
        x: prevX,
        z: prevZ,
      });
    }

    this._recomputeStacksAndCoordinates();

    if (plane.stackCount > 1) {
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_STACK,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
        stackCount: plane.stackCount,
      });
    }

    if (move.crowned) {
      this._frameEvents.push({
        type: EVENT_TYPES.PLANE_GOAL,
        playerIndex: move.colorIndex,
        planeIndex: move.planeIndex,
        crownedCount: player.crownedCount,
      });
    }

    // Build 3D animation trajectory descriptor (8 frames per tile hop, whole move capped at 54 frames = 0.9s)
    const finalWaypoints = move.waypoints.map((wp, idx) =>
      idx === move.waypoints.length - 1
        ? { ...wp, x: plane.x, z: plane.z }
        : wp
    );
    const segmentCount = Math.max(1, finalWaypoints.length - 1);
    const rawHopFrames = Math.max(
      PACE_CONSTANTS.HOP_FRAMES_PER_TILE,
      segmentCount * PACE_CONSTANTS.HOP_FRAMES_PER_TILE
    );
    const captureReturnFrames = capturedPlanes.length > 0 ? 12 : 0;
    const totalFrames = Math.min(
      PACE_CONSTANTS.MAX_MOVE_FRAMES,
      rawHopFrames + captureReturnFrames
    );
    const hopFrames = Math.min(totalFrames, rawHopFrames);

    if (capturedPlanes.length > 0) {
      this.slowMoRemainingSec = PACE_CONSTANTS.CAPTURE_SLOWMO_SEC;
      this.timeScale = PACE_CONSTANTS.CAPTURE_SLOWMO_SCALE;
    }

    this.activeAnimation = {
      colorIndex: move.colorIndex,
      planeIndex: move.planeIndex,
      globalPlaneIndex: plane.globalIndex,
      waypoints: finalWaypoints,
      elapsedFrames: 0,
      hopFrames,
      totalFrames,
      didFly: Boolean(move.didFly),
      didJump: Boolean(move.didJump),
      crowned: Boolean(move.crowned),
      capturedPlanes,
    };

    this.lastMoveResult = {
      colorIndex: move.colorIndex,
      colorId: COLOR_IDS[move.colorIndex],
      planeIndex: move.planeIndex,
      globalPlaneIndex: plane.globalIndex,
      diceValue: move.diceValue,
      fromState: move.fromState,
      fromRelStep: move.fromRelStep,
      toState: plane.state,
      toRelStep: plane.relStep,
      toTrackIndex: plane.trackIndex,
      tookOff: move.tookOff,
      didJump: move.didJump,
      didFly: move.didFly,
      bouncedBack: move.bouncedBack,
      overshootSteps: move.overshootSteps,
      crowned: plane.crowned,
      chainTypes: move.chainTypes.slice(),
      chainSteps: move.chainSteps.slice(),
      midRunwayCapture: move.runwayCaptureTargets.length > 0,
      capturedPlanes,
      resultingStackCount: plane.stackCount,
      bonusRollGranted: this.bonusRoll,
    };

    this.legalMoves = [];
    this.legalPlaneIndices = [];

    // Check if this move crowned the winning plane!
    if (player.crownedCount >= this.planesToWin) {
      this._finalizeMatchWithWinner(move.colorIndex);
      return;
    }

    if (this.bonusRoll) {
      // Same player rolls again on a 6!
      this.turnPhase = TURN_PHASES.AWAIT_ROLL;
      this.diceValue = null;
      this._aiThinkFrames = player.isAi ? PACE_CONSTANTS.AI_THINK_FRAMES : 0;
    } else {
      this._advanceToNextPlayerTurn();
    }
  }

  _advanceToNextPlayerTurn() {
    this.bonusRoll = false;
    this.consecutiveSixes = 0;
    this.diceValue = null;
    this.noMovesStamp = null;
    this.legalMoves = [];
    this.legalPlaneIndices = [];
    this.currentPlayer = (this.currentPlayer + 1) % 4;
    this.turnNumber += 1;
    this.turnPhase = TURN_PHASES.AWAIT_ROLL;
    this._phaseTimerFrames = 0;
    this._singleMoveAutoTimer = 0;
    this._aiThinkFrames = this.players[this.currentPlayer].isAi
      ? PACE_CONSTANTS.AI_THINK_FRAMES
      : 0;
  }

  _checkImmediateVictoryState() {
    for (let c = 0; c < 4; c += 1) {
      if (this.players[c].crownedCount >= this.planesToWin) {
        this._finalizeMatchWithWinner(c);
        return true;
      }
    }
    return false;
  }

  _finalizeMatchWithWinner(winnerColorIndex) {
    this.phase = MATCH_PHASES.FINISHED;
    this.turnPhase = TURN_PHASES.FINISHED;
    this.winnerColorIndex = winnerColorIndex;
    this.winnerColorId = COLOR_IDS[winnerColorIndex];
    this.legalMoves = [];
    this.legalPlaneIndices = [];

    // Rank all 4 players by:
    // 1) Explicit winner first
    // 2) crownedCount descending
    // 3) Total progress steps of remaining planes descending
    // 4) Captures made descending
    const scored = this.players.map((p) => {
      const progressSum = p.planes.reduce((acc, pl) => {
        if (pl.state === PLANE_STATES.GOAL) return acc + 60;
        if (pl.state === PLANE_STATES.HANGAR) return acc;
        return acc + Math.max(1, pl.relStep + 1);
      }, 0);
      return {
        colorIndex: p.colorIndex,
        colorId: p.colorId,
        nameZh: p.nameZh,
        isAi: p.isAi,
        crownedCount: p.crownedCount,
        capturesMade: p.capturesMade,
        progressSum,
        isWinner: p.colorIndex === winnerColorIndex,
      };
    });

    scored.sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      if (b.crownedCount !== a.crownedCount) return b.crownedCount - a.crownedCount;
      if (b.progressSum !== a.progressSum) return b.progressSum - a.progressSum;
      if (b.capturesMade !== a.capturesMade) return b.capturesMade - a.capturesMade;
      return a.colorIndex - b.colorIndex;
    });

    const starTable = [3, 2, 1, 0];
    this.rankings = scored.map((entry, idx) => {
      const rank = idx + 1;
      const stars = starTable[idx] ?? 0;
      const p = this.players[entry.colorIndex];
      p.finishRank = rank;
      p.starsAwarded = stars;
      return {
        rank,
        stars,
        colorIndex: entry.colorIndex,
        colorId: entry.colorId,
        nameZh: entry.nameZh,
        isAi: entry.isAi,
        crownedCount: entry.crownedCount,
        capturesMade: entry.capturesMade,
        progressSum: entry.progressSum,
      };
    });

    const humanPlayer = this.players[this.humanColorIndex] || this.players[0];
    if (!this._hallProgressRecorded) {
      this._hallProgressRecorded = true;
      recordAeroplaneHallProgress(humanPlayer.finishRank, humanPlayer.starsAwarded);
    }

    this._frameEvents.push({
      type: EVENT_TYPES.MATCH_FINISH,
      winnerColorIndex,
      winnerColorId: this.winnerColorId,
      rankings: this.rankings.slice(),
    });
  }

  /**
   * Advances the fixed-timestep simulation by 1 tick (FIXED_DT = 1/60s).
   * Freezes AI & turn timers while `this.activeAnimation` is playing so moves
   * never overlap or cut off an in-progress hop/capture animation.
   */
  step(dt = 1 / 60) {
    this._frameEvents = [];
    this.tick += 1;
    this.elapsedSec += dt;

    let stepScale = 1.0;
    if (this.slowMoRemainingSec > 0) {
      this.slowMoRemainingSec = Math.max(0, Number((this.slowMoRemainingSec - dt).toFixed(6)));
      this.timeScale = this.slowMoRemainingSec > 0 ? PACE_CONSTANTS.CAPTURE_SLOWMO_SCALE : 1.0;
      stepScale = PACE_CONSTANTS.CAPTURE_SLOWMO_SCALE;
    } else {
      this.timeScale = 1.0;
    }

    if (this.activeAnimation) {
      this.activeAnimation.elapsedFrames = Number(
        (this.activeAnimation.elapsedFrames + stepScale).toFixed(4)
      );
      if (this.activeAnimation.elapsedFrames >= this.activeAnimation.totalFrames) {
        this.activeAnimation = null;
      } else {
        return this.getSnapshot();
      }
    }

    if (this.phase !== MATCH_PHASES.PLAYING) {
      return this.getSnapshot();
    }

    // Handle transient NO_MOVES or TRIPLE_SIX delay
    if (
      this.turnPhase === TURN_PHASES.NO_MOVES ||
      this.turnPhase === TURN_PHASES.TRIPLE_SIX
    ) {
      this._phaseTimerFrames -= 1;
      if (this._phaseTimerFrames <= 0) {
        this._advanceToNextPlayerTurn();
      }
      return this.getSnapshot();
    }

    const activePlayer = this.players[this.currentPlayer];

    // AI Turn Execution
    if (activePlayer.isAi) {
      if (this.turnPhase === TURN_PHASES.AWAIT_ROLL) {
        this._aiThinkFrames -= 1;
        if (this._aiThinkFrames <= 0) {
          this.rollDice();
        }
      } else if (this.turnPhase === TURN_PHASES.AWAIT_MOVE) {
        this._aiThinkFrames -= 1;
        if (this._aiThinkFrames <= 0) {
          const best = this.chooseBestMoveForAi(this.legalMoves);
          if (best) {
            this._executeMove(best);
          } else {
            this._advanceToNextPlayerTurn();
          }
        }
      }
      return this.getSnapshot();
    }

    // Human single-move auto-advance after brief visual highlight
    if (
      this.turnPhase === TURN_PHASES.AWAIT_MOVE &&
      this.autoAdvanceSingleMove &&
      this.legalMoves.length === 1 &&
      this._singleMoveAutoTimer > 0
    ) {
      this._singleMoveAutoTimer -= 1;
      if (this._singleMoveAutoTimer <= 0) {
        this._executeMove(this.legalMoves[0]);
      }
    }

    return this.getSnapshot();
  }

  getSnapshot() {
    const humanPlayer = this.players[this.humanColorIndex] || this.players[0];
    return {
      phase: this.phase,
      modeId: this.modeId,
      planesToWin: this.planesToWin,
      takeoffRule: this.takeoffRule,
      takeoffDiceValues: this.takeoffDiceValues.slice(),
      autoAdvanceSingleMove: this.autoAdvanceSingleMove,
      fastStart: this.fastStart,
      guaranteedFirstTakeoff: this.guaranteedFirstTakeoff,
      humanFirstRollGuaranteedUsed: this._humanFirstRollGuaranteedUsed,
      seed: this.seed,
      tick: this.tick,
      timeScale: this.timeScale,
      slowMoRemainingSec: this.slowMoRemainingSec,
      turnNumber: this.turnNumber,
      currentPlayer: this.currentPlayer,
      currentColorId: COLOR_IDS[this.currentPlayer],
      turnPhase: this.turnPhase,
      diceValue: this.diceValue,
      lastDiceRoll: this.lastDiceRoll,
      consecutiveSixes: this.consecutiveSixes,
      bonusRoll: this.bonusRoll,
      tripleSixCapped: this.tripleSixCapped,
      tripleSixCount: this.tripleSixCount,
      noMovesStamp: this.noMovesStamp ? { ...this.noMovesStamp } : null,
      legalPlaneIndices: this.legalPlaneIndices.slice(),
      legalMoves: this.legalMoves.map((m) => ({
        planeIndex: m.planeIndex,
        globalPlaneIndex: m.globalPlaneIndex,
        fromState: m.fromState,
        fromRelStep: m.fromRelStep,
        toState: m.toState,
        toRelStep: m.toRelStep,
        toTrackIndex: m.toTrackIndex,
        tookOff: m.tookOff,
        didJump: m.didJump,
        didFly: m.didFly,
        bouncedBack: m.bouncedBack,
        overshootSteps: m.overshootSteps,
        crowned: m.crowned,
        chainTypes: m.chainTypes.slice(),
        allCaptureTargets: m.allCaptureTargets.slice(),
        formsFriendlyStack: m.formsFriendlyStack,
        resultingStackCount: m.resultingStackCount,
        destX: m.destX,
        destZ: m.destZ,
        score: m.score ?? 0,
        isBestHint: Boolean(m.isBestHint),
        outcomeType: m.outcomeType || 'advance',
        outcomeIcon: m.outcomeIcon || '✈️',
        outcomeLabel: m.outcomeLabel || '',
      })),
      lastMoveResult: this.lastMoveResult ? { ...this.lastMoveResult } : null,
      activeAnimation: this.activeAnimation ? { ...this.activeAnimation } : null,
      winnerColorIndex: this.winnerColorIndex,
      winnerColorId: this.winnerColorId,
      rankings: this.rankings.slice(),
      humanRank: humanPlayer.finishRank,
      humanStars: humanPlayer.starsAwarded,
      players: this.players.map((p) => ({
        index: p.index,
        colorIndex: p.colorIndex,
        colorId: p.colorId,
        nameZh: p.nameZh,
        shortZh: p.shortZh,
        hex: p.hex,
        isAi: p.isAi,
        crownedCount: p.crownedCount,
        capturesMade: p.capturesMade,
        timesCaptured: p.timesCaptured,
        jumpsMade: p.jumpsMade,
        fliesMade: p.fliesMade,
        finishRank: p.finishRank,
        starsAwarded: p.starsAwarded,
        planes: p.planes.map((pl) => ({ ...pl })),
      })),
      planes: this.players.flatMap((p) => p.planes.map((pl) => ({ ...pl }))),
      runways: BOARD_TOPOLOGY.runways,
      events: this._frameEvents.slice(),
    };
  }
}
