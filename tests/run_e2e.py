#!/usr/bin/env python3
"""Comprehensive 36-Test E2E Verification Suite for QQ Aeroplane Chess 3D (QQ飞行棋 3D).

Covers:
- Safari/iPadOS zero-importmap & relative ES module import hygiene
- Strict /qq-aeroplane-chess-3d/ subpath hosting with 0 HTTP 404s
- Authentic QQ飞行棋 ruleset:
  * 5/6 Fast Takeoff & Classic Strict-6 Takeoff
  * Bonus roll on 6 & Triple-6 safety cap
  * Normal movement across all 4 colors (Red, Yellow, Blue, Green)
  * Same-Color Jump (+4 tiles) & Home Stretch Entry Arrow (relStep=50) non-jump
  * Dashed Fly-Across Shortcut (+12 tiles, 18 -> 30)
  * Fly->Jump (18 -> 30 -> 34) & Jump->Fly (14 -> 18 -> 30) chains (0 infinite loops)
  * Mid-Runway Enemy Capture (飞棋撞子 on opposite Home Stretch step 53 & midpoint)
  * Regular Outer-Track Enemy Capture (撞子) & Enemy Stack Capture
  * Friendly Plane Stacking (叠机 2/3/4 planes + 3D count badge)
  * Exact Goal Crown (relStep=56 -> Trophy Pedestal) & Overshoot Bounce-Back (终点反弹)
  * Smart Tactical AI decision priority & full match completion to 3D Podium
- 3D Raycast click selection on highlighted planes & keyboard controls
- Multi-viewport zero-scroll, <= 6 HUD controls & >= 68x68px touch target audit
  across 1280x800, 1024x768, 844x390, and 390x844
- WebAudio gesture unlock & key-hold autoRepeat immunity
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from typing import Callable

from harness import (
    AeroplaneTestHarness,
    DEFAULT_PROJECT_ROOT,
    MAGICK_BIN,
    RecordedStaticHTTPServer,
)


def t01_safari_zero_importmap_and_relative_imports(h: AeroplaneTestHarness) -> None:
  root = h.root_dir
  html_files = list(root.rglob("*.html"))
  js_files = [p for p in root.rglob("*.js") if "vendor" not in p.parts]
  assert html_files, "Expected index.html"
  assert js_files, "Expected src/*.js files"

  for hf in html_files:
    txt = hf.read_text(encoding="utf-8")
    assert "importmap" not in txt.lower(), f"Forbidden importmap in {hf}"

  import_re = re.compile(r"""(?:import|export)\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]""")
  for jf in js_files:
    txt = jf.read_text(encoding="utf-8")
    assert "speechSynthesis" not in txt, f"Forbidden speechSynthesis in {jf}"
    for m in import_re.finditer(txt):
      spec = m.group(1)
      assert spec.startswith("./") or spec.startswith("../"), (
          f"Bare or root-absolute import specifier '{spec}' in {jf}"
      )


def t02_subpath_hosting_zero_404(h: AeroplaneTestHarness) -> None:
  sub = RecordedStaticHTTPServer(
      h.root_dir, strict_subpath="/qq-aeroplane-chess-3d"
  ).start()
  try:
    h.clear_diagnostics()
    h.navigate(sub.base_url, wait_api=True)
    h.eval_js("window.__AEROPLANE__.stepFrames(5)")
    errs = sub.get_error_records(ignore_favicon=False)
    assert errs == [], f"Expected 0 subpath HTTP errors, got {errs}"
    h.assert_zero_errors("subpath-hosting", ignore_favicon=False)
  finally:
    sub.close()
    h.navigate(h.http_server.base_url, wait_api=True)


def t03_webgl2_context_and_3d_board_scene(h: AeroplaneTestHarness) -> None:
  st = h.get_state()
  assert st["render"]["webgl2"] is True, f"Expected WebGL2 true, got {st['render']}"
  assert st["render"]["drawCalls"] >= 20, f"Expected rich 3D scene drawCalls, got {st['render']}"
  assert st["render"]["triangles"] >= 1000, f"Expected rich 3D geometry triangles, got {st['render']}"
  assert st["boardMeta"]["trackTileCount"] == 52
  assert len(st["boardMeta"]["runways"]) == 4


def t04_frozen_api_and_deep_clone_state(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        const frozen = Object.isFrozen(window.__AEROPLANE__);
        const desc = Object.getOwnPropertyDescriptor(window, '__AEROPLANE__');
        const nonWritable = desc && desc.writable === false && desc.configurable === false;
        const noPushCheat = !('pushForcedDice' in window.__AEROPLANE__);
        window.__AEROPLANE__.startMatch({ seed: 101, forcedDiceQueue: [2] });
        // Passing an argument to rollDice(6) must be ignored in favor of the queue/PRNG
        const afterRoll = window.__AEROPLANE__.rollDice(6);
        const s1 = window.__AEROPLANE__.getState();
        s1.sim.currentPlayer = 999;
        s1.sim.players[0].planes[0].relStep = 999;
        const s2 = window.__AEROPLANE__.getState();
        return {
          frozen,
          nonWritable,
          noPushCheat,
          rolledVal: afterRoll.sim.lastDiceRoll,
          currentPlayer: s2.sim.currentPlayer,
          relStep: s2.sim.players[0].planes[0].relStep,
        };
      })()"""
  )
  assert res["frozen"] is True, res
  assert res["nonWritable"] is True, res
  assert res["noPushCheat"] is True, res
  assert res["rolledVal"] == 2, res
  assert res["currentPlayer"] == 0, res
  assert res["relStep"] == -1, res


def t05_seeded_mulberry32_prng_determinism(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        const runSeq = (seed) => {
          window.__AEROPLANE__.startMatch({ seed, allAi: true });
          window.__AEROPLANE__.stepFrames(120);
          const st = window.__AEROPLANE__.getState();
          return st.sim.planes.map((p) => `${p.state}:${p.relStep}`).join(',');
        };
        const a = runSeq(20261029);
        const b = runSeq(20261029);
        const c = runSeq(99999991);
        return { a, b, c };
      })()"""
  )
  assert res["a"] == res["b"], f"Same seed must produce identical state: {res}"
  assert res["a"] != res["c"], f"Different seeds should diverge: {res}"


def t06_takeoff_five_six_rule_roll_5(h: AeroplaneTestHarness) -> None:
  st = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          takeoffRule: 'five_six',
          forcedDiceQueue: [5],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        return window.__AEROPLANE__.getState();
      })()"""
  )
  p0 = st["sim"]["players"][0]["planes"][0]
  assert p0["state"] == "launchpad" and p0["relStep"] == 0, p0
  assert st["sim"]["lastMoveResult"]["tookOff"] is True
  assert st["sim"]["currentPlayer"] == 1  # Roll 5 does not grant bonus roll


def t07_takeoff_five_six_rule_roll_6(h: AeroplaneTestHarness) -> None:
  st = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          takeoffRule: 'five_six',
          forcedDiceQueue: [6],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(1);
        return window.__AEROPLANE__.getState();
      })()"""
  )
  p1 = st["sim"]["players"][0]["planes"][1]
  assert p1["state"] == "launchpad" and p1["relStep"] == 0, p1
  assert st["sim"]["lastMoveResult"]["tookOff"] is True
  assert st["sim"]["currentPlayer"] == 0  # Roll 6 grants bonus roll!


def t08_takeoff_five_six_rejects_1_to_4(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        const counts = [];
        for (const d of [1, 2, 3, 4]) {
          window.__AEROPLANE__.startMatch({
            takeoffRule: 'five_six',
            forcedDiceQueue: [d],
          });
          const s = window.__AEROPLANE__.rollDice();
          counts.push(s.sim.legalPlaneIndices.length);
        }
        return counts;
      })()"""
  )
  assert res == [0, 0, 0, 0], f"Expected 0 legal moves from hangar on 1..4, got {res}"


def t09_takeoff_strict_six_rule(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          takeoffRule: 'strict_six',
          forcedDiceQueue: [5, 6],
          humanCount: 4,
        });
        const s5 = window.__AEROPLANE__.rollDice();
        const legalOn5 = s5.sim.legalPlaneIndices.length;
        window.__AEROPLANE__.stepFrames(55); // Advance to next player after no moves
        const s6 = window.__AEROPLANE__.rollDice();
        const legalOn6 = s6.sim.legalPlaneIndices.length;
        return { legalOn5, legalOn6 };
      })()"""
  )
  assert res["legalOn5"] == 0 and res["legalOn6"] == 4, res


def t10_bonus_roll_on_six(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          forcedDiceQueue: [6, 3],
          humanCount: 4,
        });
        window.__AEROPLANE__.rollDice(); // Rolls 6
        window.__AEROPLANE__.selectPlane(0); // Plane 0 -> launchpad (relStep=0), still player 0!
        const midPlayer = window.__AEROPLANE__.getState().sim.currentPlayer;
        window.__AEROPLANE__.rollDice(); // Bonus roll -> 3
        window.__AEROPLANE__.selectPlane(0); // Plane 0 -> relStep=3
        const endState = window.__AEROPLANE__.getState().sim;
        return {
          midPlayer,
          endPlayer: endState.currentPlayer,
          planeRelStep: endState.players[0].planes[0].relStep,
        };
      })()"""
  )
  assert res["midPlayer"] == 0, res
  assert res["endPlayer"] == 1, res
  assert res["planeRelStep"] == 3, res


def t11_triple_six_safety_cap(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          forcedDiceQueue: [6, 6, 6],
          humanCount: 4,
        });
        // 1st six
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        // 2nd six
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(1);
        // 3rd consecutive six -> triggers Triple-6 Safety Cap!
        const s3 = window.__AEROPLANE__.rollDice();
        const capped = s3.sim.tripleSixCapped;
        const count = s3.sim.tripleSixCount;
        window.__AEROPLANE__.stepFrames(15);
        const afterStep = window.__AEROPLANE__.getState().sim;
        return {
          capped,
          count,
          nextPlayer: afterStep.currentPlayer,
          consecutiveSixes: afterStep.consecutiveSixes,
        };
      })()"""
  )
  assert res["capped"] is True and res["count"] == 1, res
  assert res["nextPlayer"] == 1 and res["consecutiveSixes"] == 0, res


def t12_normal_outer_track_advance_all_4_colors(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        const out = [];
        for (let c = 0; c < 4; c++) {
          window.__AEROPLANE__.startMatch({
            startingPlayer: c,
            humanCount: 4,
            customPlaneStates: [{ colorIndex: c, planeIndex: 0, relStep: 0 }],
            forcedDiceQueue: [3],
          });
          window.__AEROPLANE__.rollDice();
          window.__AEROPLANE__.selectPlane(0);
          const p = window.__AEROPLANE__.getState().sim.players[c].planes[0];
          out.push({ state: p.state, relStep: p.relStep, trackIndex: p.trackIndex });
        }
        return out;
      })()"""
  )
  expected_track = [2, 15, 28, 41]
  for c in range(4):
    assert res[c]["state"] == "track", res[c]
    assert res[c]["relStep"] == 3, res[c]
    assert res[c]["trackIndex"] == expected_track[c], res[c]


def t13_same_color_jump_plus_4(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [0, -1, -1, -1] },
          forcedDiceQueue: [2],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          relStep: sim.players[0].planes[0].relStep,
          didJump: sim.lastMoveResult.didJump,
          chainTypes: sim.lastMoveResult.chainTypes,
        };
      })()"""
  )
  # Landing on relStep = 2 (same color!) jumps +4 to relStep = 6
  assert res["relStep"] == 6, res
  assert res["didJump"] is True, res
  assert res["chainTypes"] == ["jump"], res


def t14_home_entry_arrow_rel50_does_not_jump(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [47, -1, -1, -1] },
          forcedDiceQueue: [3],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          relStep: sim.players[0].planes[0].relStep,
          didJump: sim.lastMoveResult.didJump,
        };
      })()"""
  )
  assert res["relStep"] == 50 and res["didJump"] is False, res


def t15_direct_fly_across_shortcut_and_post_fly_jump_chain(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [15, -1, -1, -1] },
          forcedDiceQueue: [3], // 15 + 3 = 18 (Fly start) -> 30 (Fly +12) -> 34 (Jump +4)
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          relStep: sim.players[0].planes[0].relStep,
          didFly: sim.lastMoveResult.didFly,
          didJump: sim.lastMoveResult.didJump,
          chainTypes: sim.lastMoveResult.chainTypes,
        };
      })()"""
  )
  assert res["relStep"] == 34, res
  assert res["didFly"] is True and res["didJump"] is True, res
  assert res["chainTypes"] == ["fly", "jump"], res


def t16_jump_into_fly_across_shortcut_chain(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [11, -1, -1, -1] },
          forcedDiceQueue: [3], // 11 + 3 = 14 (Jump +4) -> 18 (Fly +12) -> 30
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          relStep: sim.players[0].planes[0].relStep,
          didJump: sim.lastMoveResult.didJump,
          didFly: sim.lastMoveResult.didFly,
          chainTypes: sim.lastMoveResult.chainTypes,
        };
      })()"""
  )
  assert res["relStep"] == 30, res
  assert res["didJump"] is True and res["didFly"] is True, res
  assert res["chainTypes"] == ["jump", "fly"], res


def t17_mid_runway_enemy_capture_on_home_stretch_intersection(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        // Red's Fly-Across bridge (18 -> 30) intersects Blue's (colorIndex=2) Home Stretch step 3 (relStep=53)
        window.__AEROPLANE__.startMatch({
          customPlaneStates: {
            red: [15, -1, -1, -1],
            blue: [53, -1, -1, -1],
          },
          forcedDiceQueue: [3],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          redRelStep: sim.players[0].planes[0].relStep,
          blueState: sim.players[2].planes[0].state,
          blueRelStep: sim.players[2].planes[0].relStep,
          midRunwayCapture: sim.lastMoveResult.midRunwayCapture,
          capturesMade: sim.players[0].capturesMade,
        };
      })()"""
  )
  assert res["redRelStep"] == 34, res
  assert res["blueState"] == "hangar" and res["blueRelStep"] == -1, res
  assert res["midRunwayCapture"] is True and res["capturesMade"] == 1, res


def t18_mid_runway_enemy_capture_on_track_midpoint(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        // Red's Fly-Across (18 -> 30) crosses ONLY Blue's Home Stretch step 3 (relStep=53),
        // NOT the outer arm-tip trackIndex=23 (Blue relStep=50 / Yellow relStep=11)!
        window.__AEROPLANE__.startMatch({
          customPlaneStates: {
            red: [15, -1, -1, -1],
            yellow: [11, -1, -1, -1],
          },
          forcedDiceQueue: [3], // Red 15 + 3 = 18 -> flies 18 -> 30 -> 34
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          yellowState: sim.players[1].planes[0].state,
          yellowRelStep: sim.players[1].planes[0].relStep,
          midRunwayCapture: sim.lastMoveResult.midRunwayCapture,
        };
      })()"""
  )
  assert res["yellowState"] == "track" and res["yellowRelStep"] == 11, res
  assert res["midRunwayCapture"] is False, res


def t19_regular_outer_track_enemy_capture(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        // Put Yellow plane 0 on trackIndex = 4 (which is Red's relStep = 5)
        window.__AEROPLANE__.startMatch({
          customPlaneStates: [
            { colorIndex: 0, planeIndex: 0, relStep: 2 },
            { colorIndex: 1, planeIndex: 0, trackIndex: 4 },
          ],
          forcedDiceQueue: [3], // Red 2 + 3 = 5 (trackIndex=4) -> captures Yellow!
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          redRelStep: sim.players[0].planes[0].relStep,
          yellowState: sim.players[1].planes[0].state,
          capturesMade: sim.players[0].capturesMade,
          capturedCount: sim.lastMoveResult.capturedPlanes.length,
        };
      })()"""
  )
  assert res["redRelStep"] == 5, res
  assert res["yellowState"] == "hangar", res
  assert res["capturesMade"] == 1 and res["capturedCount"] == 1, res


def t20_capture_enemy_stack_bounces_all_to_hangar(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: [
            { colorIndex: 0, planeIndex: 0, relStep: 1 },
            { colorIndex: 1, planeIndex: 0, trackIndex: 3 },
            { colorIndex: 1, planeIndex: 1, trackIndex: 3 },
          ],
          forcedDiceQueue: [3], // Red 1 + 3 = 4 (trackIndex=3) -> captures both Yellow planes!
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          y0: sim.players[1].planes[0].state,
          y1: sim.players[1].planes[1].state,
          capturedCount: sim.lastMoveResult.capturedPlanes.length,
        };
      })()"""
  )
  assert res["y0"] == "hangar" and res["y1"] == "hangar", res
  assert res["capturedCount"] == 2, res


def t21_friendly_stacking_2_3_4_planes_with_3d_badge(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: {
            red: [8, 8, 5, -1],
          },
          forcedDiceQueue: [3], // Plane 2 at relStep=5 rolls 3 -> joins stack at relStep=8 (stackCount=3)!
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(2);
        const sim = window.__AEROPLANE__.getState().sim;
        const planes = sim.players[0].planes;
        return {
          s0: planes[0].stackCount,
          s1: planes[1].stackCount,
          s2: planes[2].stackCount,
          resultingStackCount: sim.lastMoveResult.resultingStackCount,
        };
      })()"""
  )
  assert res["s0"] == 3 and res["s1"] == 3 and res["s2"] == 3, res
  assert res["resultingStackCount"] == 3, res


def t22_home_stretch_entry_and_safe_corridor(h: AeroplaneTestHarness) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [49, -1, -1, -1] },
          forcedDiceQueue: [4], // 49 + 4 = 53 (Home Stretch step 3)
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const p0 = window.__AEROPLANE__.getState().sim.players[0].planes[0];
        return { state: p0.state, relStep: p0.relStep, trackIndex: p0.trackIndex };
      })()"""
  )
  assert res["state"] == "homestretch" and res["relStep"] == 53 and res["trackIndex"] == -1, res


def t23_exact_goal_crown_rel56_and_trophy_pedestal(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          planesToWin: 4,
          customPlaneStates: { red: [52, -1, -1, -1] },
          forcedDiceQueue: [4], // 52 + 4 = 56 (Exact Goal!)
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        const p0 = sim.players[0].planes[0];
        return {
          state: p0.state,
          relStep: p0.relStep,
          crowned: p0.crowned,
          crownedCount: sim.players[0].crownedCount,
        };
      })()"""
  )
  assert res["state"] == "goal" and res["relStep"] == 56, res
  assert res["crowned"] is True and res["crownedCount"] == 1, res


def t24_overshoot_goal_bounce_back_rel53_roll_5(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [53, -1, -1, -1] },
          forcedDiceQueue: [5], // 53 + 5 = 58 (overshoot by 2) -> bounces back to 56 - 2 = 54!
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          state: sim.players[0].planes[0].state,
          relStep: sim.players[0].planes[0].relStep,
          bouncedBack: sim.lastMoveResult.bouncedBack,
          overshootSteps: sim.lastMoveResult.overshootSteps,
        };
      })()"""
  )
  assert res["state"] == "homestretch" and res["relStep"] == 54, res
  assert res["bouncedBack"] is True and res["overshootSteps"] == 2, res


def t25_overshoot_goal_bounce_back_rel55_roll_6(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [55, -1, -1, -1] },
          forcedDiceQueue: [6], // 55 + 6 = 61 (overshoot by 5) -> bounces back to 56 - 5 = 51!
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(0);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          relStep: sim.players[0].planes[0].relStep,
          bouncedBack: sim.lastMoveResult.bouncedBack,
          overshootSteps: sim.lastMoveResult.overshootSteps,
        };
      })()"""
  )
  assert res["relStep"] == 51 and res["bouncedBack"] is True and res["overshootSteps"] == 5, res


def t26_smart_tactical_ai_prioritizes_capture_and_fly(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        // Yellow AI (player 1): plane 0 at relStep=1, plane 1 at relStep=15 (roll 3 -> 18 Fly+Jump!)
        window.__AEROPLANE__.startMatch({
          startingPlayer: 1,
          customPlaneStates: {
            yellow: [1, 15, -1, -1],
          },
          forcedDiceQueue: [3],
        });
        window.__AEROPLANE__.stepFrames(80);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          movedPlane: sim.lastMoveResult.planeIndex,
          didFly: sim.lastMoveResult.didFly,
          newRelStep: sim.players[1].planes[1].relStep,
        };
      })()"""
  )
  assert res["movedPlane"] == 1 and res["didFly"] is True and res["newRelStep"] == 34, res


def t27_smart_tactical_ai_prioritizes_exact_goal_crown(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        // Yellow AI (player 1): plane 0 at relStep=3, plane 1 at relStep=53 (roll 3 -> 56 Exact Goal!)
        window.__AEROPLANE__.startMatch({
          startingPlayer: 1,
          planesToWin: 4,
          customPlaneStates: {
            yellow: [3, 53, -1, -1],
          },
          forcedDiceQueue: [3],
        });
        window.__AEROPLANE__.stepFrames(80);
        const sim = window.__AEROPLANE__.getState().sim;
        return {
          movedPlane: sim.lastMoveResult.planeIndex,
          crowned: sim.lastMoveResult.crowned,
          crownedCount: sim.players[1].crownedCount,
        };
      })()"""
  )
  assert res["movedPlane"] == 1 and res["crowned"] is True and res["crownedCount"] == 1, res


def t28_quick_2_plane_kids_mode_full_match_to_3d_podium(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          seed: 20261029,
          modeId: 'quick_2',
          allAi: true,
        });
        let st = window.__AEROPLANE__.getState();
        let steps = 0;
        while (st.uiScreen !== 'podium' && steps < 45000) {
          st = window.__AEROPLANE__.stepFrames(400);
          steps += 400;
        }
        return {
          uiScreen: st.uiScreen,
          phase: st.sim.phase,
          turnNumber: st.sim.turnNumber,
          winnerColorId: st.sim.winnerColorId,
          rankings: st.sim.rankings,
        };
      })()"""
  )
  assert res["uiScreen"] == "podium" and res["phase"] == "finished", res
  assert len(res["rankings"]) == 4, res
  assert [r["stars"] for r in res["rankings"]] == [3, 2, 1, 0], res
  assert res["rankings"][0]["crownedCount"] >= 2, res
  assert res["turnNumber"] <= 260, f"Expected brisk Kids Mode match, got {res['turnNumber']} turns"


def t29_classic_4_plane_mode_completion_to_podium(
    h: AeroplaneTestHarness,
) -> None:
  res = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          modeId: 'classic_4',
          customPlaneStates: {
            red: [56, 56, 56, 52],
          },
          forcedDiceQueue: [4],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.selectPlane(3);
        const st = window.__AEROPLANE__.getState();
        return {
          uiScreen: st.uiScreen,
          crownedCount: st.sim.players[0].crownedCount,
          winnerColorId: st.sim.winnerColorId,
          stars: st.sim.rankings[0].stars,
        };
      })()"""
  )
  assert res["uiScreen"] == "podium" and res["crownedCount"] == 4, res
  assert res["winnerColorId"] == "red" and res["stars"] == 3, res


def t30_3d_raycast_click_on_highlighted_plane_moves_plane(
    h: AeroplaneTestHarness,
) -> None:
  h.set_viewport(1280, 800, mobile=False, touch=False)
  coords = h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [4, -1, -1, -1] },
          forcedDiceQueue: [3],
        });
        window.__AEROPLANE__.rollDice();
        return window.__AEROPLANE__.getPlaneScreenCoords(0, 0);
      })()"""
  )
  assert coords["highlighted"] is True, coords
  h.click_at(coords["clientX"], coords["clientY"])
  st = h.get_state()
  p0 = st["sim"]["players"][0]["planes"][0]
  assert p0["relStep"] == 7, f"Expected 3D raycast click to move plane 0 to relStep 7, got {p0}"


def t31_keyboard_space_and_digit_plane_selection(
    h: AeroplaneTestHarness,
) -> None:
  h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [0, 3, -1, -1] },
          forcedDiceQueue: [4, 5],
        });
      })()"""
  )
  h.tap_key("Space", hold_frames=2)  # Rolls dice (4) for human player 0
  st_mid = h.get_state()
  assert st_mid["sim"]["diceValue"] == 4, st_mid["sim"]
  h.tap_key("Digit2", hold_frames=2)  # Selects plane index 1 (at relStep 3 -> 7), turn passes to AI player 1
  st_end = h.get_state()
  assert st_end["sim"]["players"][0]["planes"][1]["relStep"] == 7, st_end["sim"]
  assert st_end["sim"]["currentPlayer"] == 1, st_end["sim"]

  # Pressing Space during Yellow AI's turn must NOT roll Yellow's dice early!
  h.key_down("Space")
  h.key_up("Space")
  st_gated = h.get_state()
  assert st_gated["sim"]["diceValue"] is None, (
      f"Human Space input must be gated during AI turn, got {st_gated['sim']}"
  )


def t32_webaudio_gesture_unlock_and_autorepeat_immunity(
    h: AeroplaneTestHarness,
) -> None:
  h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [0, 3, -1, -1] },
          forcedDiceQueue: [2, 3],
        });
      })()"""
  )
  h.key_down("Space", auto_repeat=False)
  diag1 = h.get_state()["audio"]
  assert diag1["unlocked"] is True, diag1
  unlock_calls_before = diag1["unlockCallCount"]

  # Dispatch 8 autoRepeat keyDown events -> must NOT increment unlockCallCount or re-roll
  for _ in range(8):
    h.key_down("Space", auto_repeat=True)
  h.key_up("Space")

  st_after = h.get_state()
  assert st_after["audio"]["unlockCallCount"] == unlock_calls_before, st_after["audio"]
  assert st_after["audio"]["ttsUsed"] is False, st_after["audio"]


def _verify_viewport_layout(
    h: AeroplaneTestHarness, width: int, height: int, mobile: bool, touch: bool
) -> None:
  dims = h.set_viewport(width, height, mobile=mobile, touch=touch)
  assert dims["innerWidth"] == width and dims["innerHeight"] == height, dims

  # Check playing screen with all 4 planes legal simultaneously (worst-case button count!)
  h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: { red: [0, 3, 7, 11] },
          forcedDiceQueue: [6],
        });
        window.__AEROPLANE__.rollDice();
      })()"""
  )
  audit = h.audit_viewport_and_hud()
  assert audit["scrollWidth"] <= width, f"Horizontal scroll overflow on {width}x{height}: {audit}"
  assert audit["scrollHeight"] <= height, f"Vertical scroll overflow on {width}x{height}: {audit}"
  assert 1 <= audit["controlCount"] <= 6, (
      f"Expected <= 6 visible HUD controls on {width}x{height}, got {audit['controlCount']}: {audit['controls']}"
  )
  assert audit["overlaps"] == [], f"Overlapping HUD controls on {width}x{height}: {audit['overlaps']}"
  for ctrl in audit["controls"]:
    assert ctrl["width"] >= 64 and ctrl["height"] >= 64, (
        f"Touch target < 64x64px on {width}x{height}: {ctrl}"
    )


def t33_viewport_1280x800_hud_and_zero_scroll_audit(
    h: AeroplaneTestHarness,
) -> None:
  _verify_viewport_layout(h, 1280, 800, mobile=False, touch=False)


def t34_viewport_1024x768_ipad_landscape_audit(
    h: AeroplaneTestHarness,
) -> None:
  _verify_viewport_layout(h, 1024, 768, mobile=True, touch=True)


def t35_viewport_844x390_mobile_landscape_audit(
    h: AeroplaneTestHarness,
) -> None:
  _verify_viewport_layout(h, 844, 390, mobile=True, touch=True)


def t36_viewport_390x844_mobile_portrait_and_gbrowser_cli_audit(
    h: AeroplaneTestHarness,
) -> None:
  _verify_viewport_layout(h, 390, 844, mobile=True, touch=True)
  # Restore 1280x800, stage an exciting mid-match scene, and capture screenshot.jpg
  h.set_viewport(1280, 800, mobile=False, touch=False)
  h.eval_js(
      """(() => {
        window.__AEROPLANE__.startMatch({
          customPlaneStates: {
            red: [18, 6, 56, 0],
            yellow: [10, 22, 0, -1],
            blue: [53, 14, 14, -1],
            green: [30, 52, 0, -1],
          },
          forcedDiceQueue: [6],
        });
        window.__AEROPLANE__.rollDice();
        window.__AEROPLANE__.stepFrames(14);
      })()"""
  )
  png_shot = h.capture_screenshot(h.shots_dir / "gameplay_1280x800.png")
  stats = h.inspect_image(png_shot)
  assert stats["width"] == 1280 and stats["height"] == 800, stats
  assert stats["std_dev"] > 0.08, f"Expected vibrant non-blank render, got {stats}"

  jpg_dest = h.root_dir / "screenshot.jpg"
  subprocess.run(
      [
          MAGICK_BIN,
          str(png_shot),
          "-quality",
          "88",
          str(jpg_dest),
      ],
      cwd="/tmp",
      check=True,
      timeout=15,
  )
  assert jpg_dest.exists() and jpg_dest.stat().st_size > 15000

  # Also run official gbrowser CLI check if available
  gb_res = h.run_gbrowser_cli(["js", "Boolean(window.__AEROPLANE__)"])
  if gb_res.returncode == 0 and "Unknown command" not in gb_res.stdout:
    assert "true" in gb_res.stdout.lower(), gb_res.stdout


ALL_TESTS: list[tuple[str, Callable[[AeroplaneTestHarness], None]]] = [
    ("T01_safari_zero_importmap_and_relative_imports", t01_safari_zero_importmap_and_relative_imports),
    ("T02_subpath_hosting_zero_404", t02_subpath_hosting_zero_404),
    ("T03_webgl2_context_and_3d_board_scene", t03_webgl2_context_and_3d_board_scene),
    ("T04_frozen_api_and_deep_clone_state", t04_frozen_api_and_deep_clone_state),
    ("T05_seeded_mulberry32_prng_determinism", t05_seeded_mulberry32_prng_determinism),
    ("T06_takeoff_five_six_rule_roll_5", t06_takeoff_five_six_rule_roll_5),
    ("T07_takeoff_five_six_rule_roll_6", t07_takeoff_five_six_rule_roll_6),
    ("T08_takeoff_five_six_rejects_1_to_4", t08_takeoff_five_six_rejects_1_to_4),
    ("T09_takeoff_strict_six_rule", t09_takeoff_strict_six_rule),
    ("T10_bonus_roll_on_six", t10_bonus_roll_on_six),
    ("T11_triple_six_safety_cap", t11_triple_six_safety_cap),
    ("T12_normal_outer_track_advance_all_4_colors", t12_normal_outer_track_advance_all_4_colors),
    ("T13_same_color_jump_plus_4", t13_same_color_jump_plus_4),
    ("T14_home_entry_arrow_rel50_does_not_jump", t14_home_entry_arrow_rel50_does_not_jump),
    ("T15_direct_fly_across_shortcut_and_post_fly_jump_chain", t15_direct_fly_across_shortcut_and_post_fly_jump_chain),
    ("T16_jump_into_fly_across_shortcut_chain", t16_jump_into_fly_across_shortcut_chain),
    ("T17_mid_runway_enemy_capture_on_home_stretch_intersection", t17_mid_runway_enemy_capture_on_home_stretch_intersection),
    ("T18_mid_runway_enemy_capture_on_track_midpoint", t18_mid_runway_enemy_capture_on_track_midpoint),
    ("T19_regular_outer_track_enemy_capture", t19_regular_outer_track_enemy_capture),
    ("T20_capture_enemy_stack_bounces_all_to_hangar", t20_capture_enemy_stack_bounces_all_to_hangar),
    ("T21_friendly_stacking_2_3_4_planes_with_3d_badge", t21_friendly_stacking_2_3_4_planes_with_3d_badge),
    ("T22_home_stretch_entry_and_safe_corridor", t22_home_stretch_entry_and_safe_corridor),
    ("T23_exact_goal_crown_rel56_and_trophy_pedestal", t23_exact_goal_crown_rel56_and_trophy_pedestal),
    ("T24_overshoot_goal_bounce_back_rel53_roll_5", t24_overshoot_goal_bounce_back_rel53_roll_5),
    ("T25_overshoot_goal_bounce_back_rel55_roll_6", t25_overshoot_goal_bounce_back_rel55_roll_6),
    ("T26_smart_tactical_ai_prioritizes_capture_and_fly", t26_smart_tactical_ai_prioritizes_capture_and_fly),
    ("T27_smart_tactical_ai_prioritizes_exact_goal_crown", t27_smart_tactical_ai_prioritizes_exact_goal_crown),
    ("T28_quick_2_plane_kids_mode_full_match_to_3d_podium", t28_quick_2_plane_kids_mode_full_match_to_3d_podium),
    ("T29_classic_4_plane_mode_completion_to_podium", t29_classic_4_plane_mode_completion_to_podium),
    ("T30_3d_raycast_click_on_highlighted_plane_moves_plane", t30_3d_raycast_click_on_highlighted_plane_moves_plane),
    ("T31_keyboard_space_and_digit_plane_selection", t31_keyboard_space_and_digit_plane_selection),
    ("T32_webaudio_gesture_unlock_and_autorepeat_immunity", t32_webaudio_gesture_unlock_and_autorepeat_immunity),
    ("T33_viewport_1280x800_hud_and_zero_scroll_audit", t33_viewport_1280x800_hud_and_zero_scroll_audit),
    ("T34_viewport_1024x768_ipad_landscape_audit", t34_viewport_1024x768_ipad_landscape_audit),
    ("T35_viewport_844x390_mobile_landscape_audit", t35_viewport_844x390_mobile_landscape_audit),
    ("T36_viewport_390x844_mobile_portrait_and_gbrowser_cli_audit", t36_viewport_390x844_mobile_portrait_and_gbrowser_cli_audit),
]


def main() -> int:
  parser = argparse.ArgumentParser(description="Run QQ Aeroplane Chess 3D E2E Suite")
  parser.add_argument("--filter", default="", help="Optional test name substring")
  args = parser.parse_args()

  selected = [
      (name, fn)
      for (name, fn) in ALL_TESTS
      if not args.filter or args.filter.lower() in name.lower()
  ]

  passed = 0
  failed = 0
  results = []

  with AeroplaneTestHarness(root_dir=DEFAULT_PROJECT_ROOT, preferred_http_port=18802) as h:
    h.navigate(wait_api=True)
    h.eval_js("window.__AEROPLANE__.setDeterministicMode(true)")

    for name, fn in selected:
      t0 = time.time()
      try:
        fn(h)
        h.assert_zero_errors(name)
        dt_ms = (time.time() - t0) * 1000.0
        passed += 1
        results.append({"name": name, "passed": True, "ms": round(dt_ms, 1)})
        print(f"[PASS] {name} ({dt_ms:.1f} ms)")
      except Exception as exc:
        dt_ms = (time.time() - t0) * 1000.0
        failed += 1
        results.append(
            {"name": name, "passed": False, "ms": round(dt_ms, 1), "error": str(exc)}
        )
        print(f"[FAIL] {name} ({dt_ms:.1f} ms): {exc}")

  print(
      json.dumps(
          {
              "suite": "qq_aeroplane_chess_3d",
              "total": len(selected),
              "passed": passed,
              "failed": failed,
          }
      )
  )
  return 0 if failed == 0 else 1


if __name__ == "__main__":
  sys.exit(main())
