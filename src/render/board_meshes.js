/**
 * 3D Cross Board, 52 Perimeter Tiles, 4x6 Home Stretch Arrows,
 * 4 Corner Hangar Aprons & Launch Pads, 4 Dashed Fly-Across Runways (飞棋航线),
 * and Center 3D Crystal Dice Dome with Tumbling 3D Die
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * Uses Three.js r170 via relative import (`../../vendor/three.module.min.js`).
 * Strictly `metalness <= 0.22` for bright, kid-friendly toy aesthetics.
 */

import * as THREE from '../../vendor/three.module.min.js';
import {
  BOARD_TOPOLOGY,
  COLOR_IDS,
  COLOR_META,
} from '../contracts/constants.js';

// Target Euler rotations on the 3D die so face `d` (1..6) points straight up (+Y):
// Face layout on cube:
// +Y = 1, -Y = 6, +Z = 2, -Z = 5, +X = 3, -X = 4
const DIE_FACE_UP_ROTATIONS = Object.freeze({
  1: { rx: 0, rz: 0 },
  6: { rx: Math.PI, rz: 0 },
  2: { rx: -Math.PI / 2, rz: 0 },
  5: { rx: Math.PI / 2, rz: 0 },
  3: { rx: 0, rz: Math.PI / 2 },
  4: { rx: 0, rz: -Math.PI / 2 },
});

function makeToyMaterial(colorHex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: opts.roughness ?? 0.34,
    metalness: Math.min(0.22, opts.metalness ?? 0.10),
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0.0,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1.0,
  });
}

function createArrowShape(width = 0.42, length = 0.50) {
  const shape = new THREE.Shape();
  const hw = width * 0.28;
  const headW = width * 0.58;
  const tailZ = -length * 0.45;
  const neckZ = length * 0.05;
  const tipZ = length * 0.48;

  shape.moveTo(-hw, tailZ);
  shape.lineTo(hw, tailZ);
  shape.lineTo(hw, neckZ);
  shape.lineTo(headW, neckZ);
  shape.lineTo(0, tipZ);
  shape.lineTo(-headW, neckZ);
  shape.lineTo(-hw, neckZ);
  shape.closePath();
  return shape;
}

function createStarShape(outerR = 1.15, innerR = 0.52, points = 8) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function buildBoardSceneGroup() {
  const root = new THREE.Group();
  root.name = 'AeroplaneChessBoardRoot';

  const paletteMats = {};
  for (const cid of COLOR_IDS) {
    const meta = COLOR_META[cid];
    paletteMats[cid] = {
      main: makeToyMaterial(meta.hex, { roughness: 0.28, metalness: 0.12 }),
      light: makeToyMaterial(meta.lightHex, { roughness: 0.35, metalness: 0.08 }),
      dark: makeToyMaterial(meta.darkHex, { roughness: 0.38, metalness: 0.12 }),
      glow: makeToyMaterial(meta.hex, {
        roughness: 0.22,
        metalness: 0.14,
        emissive: meta.emissiveHex,
        emissiveIntensity: 0.32,
      }),
    };
  }

  const whiteRimMat = makeToyMaterial('#ffffff', { roughness: 0.25, metalness: 0.08 });
  const ivoryDeckMat = makeToyMaterial('#fffbeb', { roughness: 0.38, metalness: 0.06 });
  const woodFrameMat = makeToyMaterial('#d97706', { roughness: 0.42, metalness: 0.10 });
  const grassIslandMat = makeToyMaterial('#34d399', { roughness: 0.48, metalness: 0.05 });
  const goldMat = makeToyMaterial('#fbbf24', {
    roughness: 0.24,
    metalness: 0.20,
    emissive: '#f59e0b',
    emissiveIntensity: 0.25,
  });

  // 1. Sky-Island Tabletop Base & Wooden Frame
  const islandBase = new THREE.Mesh(
    new THREE.CylinderGeometry(12.2, 10.6, 1.1, 36),
    grassIslandMat
  );
  islandBase.position.y = -0.92;
  islandBase.receiveShadow = true;
  root.add(islandBase);

  const woodFrame = new THREE.Mesh(
    new THREE.BoxGeometry(17.8, 0.48, 17.8),
    woodFrameMat
  );
  woodFrame.position.y = -0.28;
  woodFrame.receiveShadow = true;
  root.add(woodFrame);

  const boardSurface = new THREE.Mesh(
    new THREE.BoxGeometry(16.9, 0.22, 16.9),
    ivoryDeckMat
  );
  boardSurface.position.y = -0.10;
  boardSurface.receiveShadow = true;
  root.add(boardSurface);

  // Subtle cross arm plate inlay
  const crossArmH = new THREE.Mesh(
    new THREE.BoxGeometry(16.2, 0.06, 5.4),
    makeToyMaterial('#e0f2fe', { roughness: 0.36, metalness: 0.05 })
  );
  crossArmH.position.y = 0.02;
  root.add(crossArmH);

  const crossArmV = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.06, 16.2),
    makeToyMaterial('#e0f2fe', { roughness: 0.36, metalness: 0.05 })
  );
  crossArmV.position.y = 0.02;
  root.add(crossArmV);

  // 2. 52 Outer Perimeter Loop Tiles
  const tileRimGeo = new THREE.CylinderGeometry(0.45, 0.48, 0.12, 24);
  const tileTopGeo = new THREE.CylinderGeometry(0.38, 0.40, 0.15, 24);
  const centerDotGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.17, 16);
  const arrowShape = createArrowShape(0.36, 0.44);
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
    depth: 0.05,
    bevelEnabled: false,
  });
  arrowGeo.rotateX(Math.PI / 2);

  for (const tile of BOARD_TOPOLOGY.trackTiles) {
    const tileGroup = new THREE.Group();
    tileGroup.position.set(tile.x, 0.04, tile.z);

    const rim = new THREE.Mesh(tileRimGeo, whiteRimMat);
    const top = new THREE.Mesh(tileTopGeo, paletteMats[tile.colorId].main);
    top.position.y = 0.02;
    tileGroup.add(rim, top);

    if (tile.isFlyStartForColor >= 0 || tile.isHomeEntryForColor >= 0) {
      // Gold star ring marker for Fly-Across Start (relStep=18) & Home Entry (relStep=50)
      const badge = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.045, 10, 20),
        goldMat
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.y = 0.10;
      tileGroup.add(badge);
    } else {
      const dot = new THREE.Mesh(centerDotGeo, whiteRimMat);
      dot.position.y = 0.02;
      tileGroup.add(dot);
    }

    root.add(tileGroup);
  }

  // 3. 4x6 Colored Home Stretch Arrow Corridors (终点走廊)
  const homePadGeo = new THREE.BoxGeometry(0.84, 0.14, 0.84);
  for (let c = 0; c < 4; c += 1) {
    const cid = COLOR_IDS[c];
    const stretch = BOARD_TOPOLOGY.homeStretches[c];
    for (const stepTile of stretch) {
      if (stepTile.isGoal) continue;
      const g = new THREE.Group();
      g.position.set(stepTile.x, 0.05, stepTile.z);

      const basePad = new THREE.Mesh(homePadGeo, paletteMats[cid].glow);
      const borderPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.10, 0.92),
        whiteRimMat
      );
      borderPad.position.y = -0.01;
      g.add(borderPad, basePad);

      const arrowMesh = new THREE.Mesh(arrowGeo, whiteRimMat);
      arrowMesh.position.y = 0.09;
      // Rotate arrow to point toward (0, 0)
      const angleToCenter = Math.atan2(-stepTile.x, -stepTile.z);
      arrowMesh.rotation.y = angleToCenter;
      g.add(arrowMesh);

      if (stepTile.isRunwayIntersection) {
        const crossRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.04, 10, 24),
          goldMat
        );
        crossRing.rotation.x = Math.PI / 2;
        crossRing.position.y = 0.09;
        g.add(crossRing);
      }

      root.add(g);
    }
  }

  // 4. 4 Glowing Dashed Fly-Across Runways (飞棋航线)
  const runwayDashes = [];
  for (const rw of BOARD_TOPOLOGY.runways) {
    const rwGroup = new THREE.Group();
    const dx = rw.endX - rw.startX;
    const dz = rw.endZ - rw.startZ;
    const length = Math.hypot(dx, dz);
    const midX = (rw.startX + rw.endX) * 0.5;
    const midZ = (rw.startZ + rw.endZ) * 0.5;
    const yaw = Math.atan2(dx, dz);

    rwGroup.position.set(midX, 0.11, midZ);
    rwGroup.rotation.y = yaw;

    // Translucent runway light strip
    const bridgeStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.03, Math.max(0.5, length - 0.55)),
      makeToyMaterial(COLOR_META[rw.colorId].lightHex, {
        roughness: 0.25,
        metalness: 0.10,
        transparent: true,
        opacity: 0.65,
      })
    );
    rwGroup.add(bridgeStrip);

    // 7 glowing dashed chevrons along the Fly-Across bridge
    const dashCount = 7;
    for (let i = 0; i < dashCount; i += 1) {
      const frac = (i + 0.5) / dashCount - 0.5;
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.05, 0.30),
        paletteMats[rw.colorId].glow
      );
      dash.position.set(0, 0.03, frac * (length - 0.9));
      rwGroup.add(dash);
      runwayDashes.push({ mesh: dash, phase: i * 0.6 + rw.colorIndex });
    }

    root.add(rwGroup);
  }

  // 5. 4 Corner Hangar Aprons & Launch Pads
  const hangarPadGeo = new THREE.CylinderGeometry(0.50, 0.54, 0.14, 24);
  const hangarInnerGeo = new THREE.CylinderGeometry(0.40, 0.42, 0.16, 24);
  const radarDishes = [];

  for (let c = 0; c < 4; c += 1) {
    const cid = COLOR_IDS[c];
    const hangar = BOARD_TOPOLOGY.hangars[c];
    const lp = BOARD_TOPOLOGY.launchPads[c];

    const apronGroup = new THREE.Group();
    apronGroup.position.set(hangar.centerX, 0.03, hangar.centerZ);

    const apronBase = new THREE.Mesh(
      new THREE.BoxGeometry(3.35, 0.16, 3.35),
      paletteMats[cid].light
    );
    const apronRim = new THREE.Mesh(
      new THREE.BoxGeometry(3.55, 0.12, 3.55),
      paletteMats[cid].main
    );
    apronRim.position.y = -0.01;
    apronGroup.add(apronRim, apronBase);

    // Miniature control tower + spinning radar at the center of the Hangar Apron
    const towerPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.55, 14),
      whiteRimMat
    );
    towerPillar.position.y = 0.30;
    const towerCab = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.22, 0.22, 14),
      paletteMats[cid].glow
    );
    towerCab.position.y = 0.62;
    const radarGroup = new THREE.Group();
    radarGroup.position.y = 0.80;
    const radarBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.06, 0.08),
      goldMat
    );
    radarGroup.add(radarBar);
    radarDishes.push(radarGroup);
    apronGroup.add(towerPillar, towerCab, radarGroup);

    root.add(apronGroup);

    // 4 Hangar Parking Bays
    for (const slot of hangar.slots) {
      const bayGroup = new THREE.Group();
      bayGroup.position.set(slot.x, 0.12, slot.z);
      const bayOuter = new THREE.Mesh(hangarPadGeo, whiteRimMat);
      const bayInner = new THREE.Mesh(hangarInnerGeo, paletteMats[cid].main);
      bayInner.position.y = 0.01;
      bayGroup.add(bayOuter, bayInner);
      root.add(bayGroup);
    }

    // Exterior Corner Launch Pad (起飞坪)
    const lpGroup = new THREE.Group();
    lpGroup.position.set(lp.x, 0.06, lp.z);
    const lpOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.58, 0.14, 24),
      goldMat
    );
    const lpInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.44, 0.16, 24),
      paletteMats[cid].glow
    );
    lpInner.position.y = 0.02;
    lpGroup.add(lpOuter, lpInner);
    root.add(lpGroup);
  }

  // 6. Center Star Goal Monument & 3D Crystal Dice Dome with Tumbling 3D Die
  const centerGroup = new THREE.Group();
  centerGroup.position.set(0, 0.08, 0);

  const starShape = createStarShape(1.12, 0.54, 8);
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  starGeo.rotateX(Math.PI / 2);
  const starBase = new THREE.Mesh(starGeo, goldMat);
  starBase.position.y = 0.08;
  centerGroup.add(starBase);

  // 3D Tumbling Die inside Center Crystal Dome
  const dieGroup = build3DDieMesh();
  dieGroup.position.set(0, 0.56, 0);
  centerGroup.add(dieGroup);

  const crystalDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.32,
    })
  );
  crystalDome.position.y = 0.14;
  centerGroup.add(crystalDome);

  root.add(centerGroup);

  // 7. Decorative 3D Sky Clouds & Mini Balloons around the island perimeter
  const clouds = [];
  const cloudPositions = [
    { x: -10.8, y: 1.2, z: -8.5, s: 1.1 },
    { x: 10.8, y: 1.5, z: -8.2, s: 1.0 },
    { x: -11.2, y: 1.1, z: 8.4, s: 0.95 },
    { x: 11.0, y: 1.4, z: 8.6, s: 1.05 },
  ];
  const cloudMat = makeToyMaterial('#ffffff', { roughness: 0.45, metalness: 0.02 });
  for (let i = 0; i < cloudPositions.length; i += 1) {
    const cp = cloudPositions[i];
    const cg = new THREE.Group();
    cg.position.set(cp.x, cp.y, cp.z);
    cg.scale.setScalar(cp.s);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), cloudMat);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), cloudMat);
    p2.position.set(0.62, -0.1, 0.15);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), cloudMat);
    p3.position.set(-0.58, -0.12, -0.1);
    cg.add(p1, p2, p3);
    root.add(cg);
    clouds.push({ group: cg, baseY: cp.y, phase: i * 1.4 });
  }

  let currentDieTarget = { rx: 0, rz: 0 };
  let tumbleSpinTimer = 0;
  let lastSeenRoll = null;

  function updateBoardAnimations(simSnap, timeSec, dtSec) {
    for (const r of radarDishes) {
      r.rotation.y += dtSec * 2.4;
    }
    for (let i = 0; i < clouds.length; i += 1) {
      const c = clouds[i];
      c.group.position.y = c.baseY + Math.sin(timeSec * 1.5 + c.phase) * 0.16;
    }
    for (const d of runwayDashes) {
      const pulse = 0.25 + 0.22 * Math.sin(timeSec * 4.5 - d.phase);
      d.mesh.material.emissiveIntensity = pulse;
    }

    const rollVal = simSnap?.diceValue || simSnap?.lastDiceRoll || 6;
    if (rollVal !== lastSeenRoll && DIE_FACE_UP_ROTATIONS[rollVal]) {
      lastSeenRoll = rollVal;
      currentDieTarget = DIE_FACE_UP_ROTATIONS[rollVal];
      tumbleSpinTimer = 0.80;
    }

    if (tumbleSpinTimer > 0) {
      tumbleSpinTimer = Math.max(0, tumbleSpinTimer - dtSec);
      dieGroup.rotation.x += dtSec * 18;
      dieGroup.rotation.y += dtSec * 14;
      dieGroup.rotation.z += dtSec * 16;
      dieGroup.position.y = 0.56 + Math.sin((tumbleSpinTimer / 0.80) * Math.PI) * 0.52;
    } else {
      dieGroup.position.y = 0.54 + Math.sin(timeSec * 3.0) * 0.04;
      dieGroup.rotation.x += (currentDieTarget.rx - dieGroup.rotation.x) * Math.min(1, dtSec * 14);
      dieGroup.rotation.z += (currentDieTarget.rz - dieGroup.rotation.z) * Math.min(1, dtSec * 14);
      dieGroup.rotation.y = Math.sin(timeSec * 0.8) * 0.15;
    }
  }

  return {
    root,
    dieGroup,
    updateBoardAnimations,
  };
}

function build3DDieMesh() {
  const g = new THREE.Group();
  const cubeMat = makeToyMaterial('#ffffff', { roughness: 0.22, metalness: 0.08 });
  const redPipMat = makeToyMaterial('#ef4444', { roughness: 0.25, metalness: 0.10 });
  const darkPipMat = makeToyMaterial('#1e293b', { roughness: 0.28, metalness: 0.10 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), cubeMat);
  g.add(body);

  const pipGeo = new THREE.SphereGeometry(0.068, 10, 10);
  const bigPipGeo = new THREE.SphereGeometry(0.105, 12, 12);
  const d = 0.345;
  const o = 0.17;

  const addPip = (x, y, z, isBigRed = false) => {
    const m = new THREE.Mesh(isBigRed ? bigPipGeo : pipGeo, isBigRed ? redPipMat : darkPipMat);
    m.position.set(x, y, z);
    g.add(m);
  };

  // +Y = 1 (Red Bullseye Pip)
  addPip(0, d, 0, true);
  // -Y = 6
  for (const sx of [-o, o]) {
    for (const sz of [-o, 0, o]) addPip(sx, -d, sz, false);
  }
  // +Z = 2
  addPip(-o, o, d, false);
  addPip(o, -o, d, false);
  // -Z = 5
  addPip(0, 0, -d, false);
  for (const sx of [-o, o]) {
    for (const sy of [-o, o]) addPip(sx, sy, -d, false);
  }
  // +X = 3
  addPip(d, o, -o, false);
  addPip(d, 0, 0, false);
  addPip(d, -o, o, false);
  // -X = 4
  for (const sy of [-o, o]) {
    for (const sz of [-o, o]) addPip(-d, sy, sz, true);
  }

  return g;
}
