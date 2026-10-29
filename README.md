# QQ飞行棋 3D — QQ Aeroplane Chess 3D

**Live Playable URL:** [https://kunruiw1991.github.io/qq-aeroplane-chess-3d/](https://kunruiw1991.github.io/qq-aeroplane-chess-3d/)  
**GitHub Repository:** [https://github.com/kunruiw1991/qq-aeroplane-chess-3d](https://github.com/kunruiw1991/qq-aeroplane-chess-3d)

![QQ飞行棋 3D Gameplay Screenshot](./screenshot.jpg)

A 3D WebGL2 remake of Tencent QQ Game Hall's classic **QQ飞行棋 (QQ Aeroplane Chess)** built with Three.js r170, procedural WebAudio synthesis, and a deterministic 60Hz simulation engine designed for both young touch-screen players on iPad and nostalgic desktop players.

---

## Authentic *QQ飞行棋* Features & Ruleset

1. **Classic 3D Cross Sky-Island Board & 16 Chibi Biplanes (`红 / 黄 / 蓝 / 绿`)**:
   - **52-Tile 4-Color Outer Perimeter Loop**: Rounded 3D tiles in Red (`红鹰号`), Yellow (`黄蜂号`), Blue (`蓝鲨号`), and Green (`绿龙号`).
   - **4x6 Colored Home Stretch Corridors (`终点走廊`)**: Glowing directional arrow corridors leading to the Center Star Goal Monument.
   - **4 Corner Hangar Aprons (`机库停机坪`) & Launch Pads (`起飞坪`)**: Each with 4 parking bays, spinning control-tower radar, Trophy Crown pedestals, and exterior Launch Pad.
   - **4 Glowing Dashed Fly-Across Runways (`飞棋航线`)**: Elevated sky-bridges across the board with animated dashed light strips.
   - **16 Bespoke 3D Chibi Toy Biplanes & Tumbling 3D Die**: Multi-part 3D biplanes with spinning 3-blade nose propellers, wings, tailfins, and Chibi QQ Penguin pilots with aviator goggles peeking out of the cockpits (`metalness <= 0.22`), plus a 3D physics-tumbling die inside the center crystal dome.
2. **100% Authentic *QQ飞行棋* Rules**:
   - **Takeoff (`起飞`)**: Rolling `5` or `6` launches a plane from Hangar to its Launch Pad (`relStep = 0`) in default QQ Fast `5/6` mode (or selectable Classic Strict-`6` mode).
   - **Bonus Roll & Triple-`6` Safety Cap (`连投奖励与三连6限制`)**: Rolling `6` grants a bonus roll; rolling three consecutive `6`s triggers the classic safety cap and passes the turn.
   - **Same-Color Jump (`跳棋`, `+4` tiles)**: Landing on an outer-ring tile of your own color (except the Home Stretch entry arrow at `relStep = 50`) hops `+4` tiles to the next same-color tile.
   - **Dashed Fly-Across Shortcut (`飞棋`, `+12` tiles) & Chaining**:
     - Direct landing on the Fly-Across start tile (`relStep = 18`) flies `+12` tiles across the dashed bridge to `relStep = 30` and chains one final `+4` Jump to `relStep = 34` (`Fly -> Jump`).
     - Landing on `relStep = 14` jumps `+4` to `relStep = 18` and immediately chains the `+12` Fly-Across to `relStep = 30` (`Jump -> Fly`).
   - **Mid-Runway Capture (`飞棋撞子`) & Regular Capture (`撞子`)**: Flying across the dashed runway bounces any enemy planes sitting on the intersected center Home Stretch runway tile (`relStep = 53`) or midpoint back to their Hangar with firework VFX; landing on enemy planes on the outer track also sends them back to Hangar.
   - **Friendly Plane Stacking (`叠机`)**: Landing on friendly plane(s) stacks them with a 3D orbiting stack badge (`×2 / ×3 / ×4`).
   - **Exact Goal (`终点到达`) & Overshoot Bounce-Back (`终点反弹`)**: Landing on exact step `56` crowns the plane (`👑`), while overshooting step `56` bounces backward along the Home Stretch by the excess steps.
   - **Modes & Top-3 3D Star Podium**: Supports **Quick 2-Plane Kids Mode (`速战2机`)** and **Classic 4-Plane Mode (`经典4机`)**, **1P vs 3 Smart Tactical AI**, and **2P–4P Pass-and-Play**, finishing on a 3D Top-3 Star Podium (`3/2/1/0` stars).

---

## Controls (iPad Touch & Desktop Keyboard)

- **Touch / Mouse**:
  - Tap the glowing **`🎲 掷骰子`** button to roll.
  - Tap directly on any **gold-highlighted 3D plane** on the board (via 3D raycast) OR tap its quick-pick plane button (`✈️ 1号机..4号机`) in the bottom dock.
- **Keyboard**:
  - `Space` / `Enter`: Roll dice (or move the recommended plane)
  - `1` / `2` / `3` / `4`: Select legal plane `1..4`
  - `P` / `Escape`: Pause / Resume
  - `M`: Mute / Unmute WebAudio BGM & SFX

---

## Running & Verifying Locally

```bash
python3 -m http.server 18802
# Run the 36-test headless WebGL2 E2E suite:
python3 tests/run_e2e.py
```
