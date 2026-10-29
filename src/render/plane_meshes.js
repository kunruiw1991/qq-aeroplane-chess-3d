/**
 * 16 Bespoke 3D Chibi Toy Biplanes/Jets, QQ Pilot Heads in Cockpits,
 * 3D Stack Orbs & Crown Badges, Pulsing Gold Legal-Move Rings,
 * Bouncing 3D Gold Arrows, Ghost Destination Rings & 3D Firework Particles
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * - Strictly `metalness <= 0.22`
 * - Zero 2D canvas drawing (100% pure Three.js 3D geometry)
 */

import * as THREE from '../../vendor/three.module.min.js';
import {
  COLOR_IDS,
  COLOR_META,
  PLANE_STATES,
} from '../contracts/constants.js';

function makePlaneMat(colorHex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: opts.roughness ?? 0.30,
    metalness: Math.min(0.22, opts.metalness ?? 0.12),
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0.0,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1.0,
  });
}

function buildSingleChibiPlaneMesh(colorIndex, planeIndex) {
  const colorId = COLOR_IDS[colorIndex];
  const meta = COLOR_META[colorId];
  const globalIndex = colorIndex * 4 + planeIndex;

  const group = new THREE.Group();
  group.name = `Plane_${colorId}_${planeIndex}`;
  group.userData = {
    isPlaneRoot: true,
    colorIndex,
    colorId,
    planeIndex,
    globalPlaneIndex: globalIndex,
  };

  const bodyMat = makePlaneMat(meta.hex, {
    roughness: 0.26,
    metalness: 0.14,
    emissive: meta.emissiveHex,
    emissiveIntensity: 0.12,
  });
  const accentMat = makePlaneMat(meta.lightHex, { roughness: 0.30, metalness: 0.10 });
  const darkMat = makePlaneMat(meta.darkHex, { roughness: 0.34, metalness: 0.14 });
  const whiteMat = makePlaneMat('#ffffff', { roughness: 0.24, metalness: 0.08 });
  const goldMat = makePlaneMat('#fbbf24', {
    roughness: 0.22,
    metalness: 0.18,
    emissive: '#f59e0b',
    emissiveIntensity: 0.35,
  });
  const blackMat = makePlaneMat('#1e293b', { roughness: 0.25, metalness: 0.10 });
  const beakMat = makePlaneMat('#fb923c', { roughness: 0.28, metalness: 0.08 });
  const goggleLensMat = makePlaneMat('#38bdf8', {
    roughness: 0.15,
    metalness: 0.18,
    emissive: '#0284c7',
    emissiveIntensity: 0.25,
  });

  const modelRoot = new THREE.Group();
  modelRoot.scale.setScalar(0.94);
  group.add(modelRoot);

  // 1. Chubby Toy Fuselage (+Z forward)
  const fuselage = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.52, 10, 18),
    bodyMat
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0.36, 0);
  fuselage.castShadow = true;
  modelRoot.add(fuselage);

  // White racing stripe along fuselage sides
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.10, 0.56),
    whiteMat
  );
  stripe.position.set(0, 0.36, 0.02);
  modelRoot.add(stripe);

  // 2. Nose Cone & Spinning 3-Blade Propeller
  const noseCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.26, 16),
    whiteMat
  );
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, 0.36, 0.56);
  modelRoot.add(noseCone);

  const propellerGroup = new THREE.Group();
  propellerGroup.position.set(0, 0.36, 0.70);
  const spinnerHub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), goldMat);
  propellerGroup.add(spinnerHub);
  for (let b = 0; b < 3; b += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.34, 0.02),
      darkMat
    );
    const angle = (b / 3) * Math.PI * 2;
    blade.position.set(Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0);
    blade.rotation.z = angle + Math.PI / 2;
    propellerGroup.add(blade);
  }
  modelRoot.add(propellerGroup);

  // 3. Lower & Upper Biplane Wings + Struts + Wingtip Roundels
  const lowerWing = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.06, 0.36),
    accentMat
  );
  lowerWing.position.set(0, 0.28, 0.08);
  lowerWing.castShadow = true;
  modelRoot.add(lowerWing);

  const upperWing = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.06, 0.32),
    bodyMat
  );
  upperWing.position.set(0, 0.64, 0.12);
  upperWing.castShadow = true;
  modelRoot.add(upperWing);

  for (const sx of [-0.44, 0.44]) {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8),
      whiteMat
    );
    strut.position.set(sx, 0.46, 0.10);
    modelRoot.add(strut);

    const wingStar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12),
      whiteMat
    );
    wingStar.position.set(sx, 0.65, 0.12);
    modelRoot.add(wingStar);
  }

  // 4. Tailfin Rudder & Horizontal Stabilizer
  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.28),
    bodyMat
  );
  tailFin.position.set(0, 0.54, -0.42);
  modelRoot.add(tailFin);

  const tailStab = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.05, 0.22),
    accentMat
  );
  tailStab.position.set(0, 0.40, -0.42);
  modelRoot.add(tailStab);

  // 5. Chibi QQ Penguin Pilot Head Peeking from Open Cockpit
  const pilotGroup = new THREE.Group();
  pilotGroup.position.set(0, 0.60, -0.04);

  const headSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 14, 12),
    blackMat
  );
  const facePatch = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    whiteMat
  );
  facePatch.position.set(0, -0.02, 0.07);
  const pilotHelmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    bodyMat
  );
  pilotHelmet.position.y = 0.02;

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.11, 10),
    beakMat
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.03, 0.22);

  for (const ex of [-0.065, 0.065]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), blackMat);
    eye.position.set(ex, 0.03, 0.19);
    const goggle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), goggleLensMat);
    goggle.rotation.x = Math.PI / 2;
    goggle.position.set(ex, 0.10, 0.18);
    pilotGroup.add(eye, goggle);
  }
  pilotGroup.add(headSphere, facePatch, pilotHelmet, beak);
  modelRoot.add(pilotGroup);

  // 6. 3D Stack Count Orbs (shown when friendly planes stack ×2, ×3, ×4)
  const stackBadgeGroup = new THREE.Group();
  stackBadgeGroup.position.set(0, 1.24, 0);
  stackBadgeGroup.visible = false;
  const stackOrbs = [];
  for (let k = 0; k < 4; k += 1) {
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), goldMat);
    stackBadgeGroup.add(orb);
    stackOrbs.push(orb);
  }
  group.add(stackBadgeGroup);

  // 7. 3D Golden Crown (shown when plane reaches exact Goal relStep=56!)
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 1.20, 0);
  crownGroup.visible = false;
  const crownRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.055, 10, 18),
    goldMat
  );
  crownRing.rotation.x = Math.PI / 2;
  crownGroup.add(crownRing);
  for (let p = 0; p < 4; p += 1) {
    const a = (p / 4) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), goldMat);
    spike.position.set(Math.cos(a) * 0.20, 0.09, Math.sin(a) * 0.20);
    crownGroup.add(spike);
  }
  group.add(crownGroup);

  // 8. Legal Move Highlight: Pulsing Gold 3D Selection Ring + Bouncing 3D Arrow
  const legalHighlightGroup = new THREE.Group();
  legalHighlightGroup.visible = false;

  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.075, 12, 28),
    goldMat
  );
  goldRing.rotation.x = Math.PI / 2;
  goldRing.position.y = 0.06;
  legalHighlightGroup.add(goldRing);

  const arrowPointer = new THREE.Group();
  arrowPointer.position.set(0, 1.44, 0);
  const arrowCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.34, 12),
    goldMat
  );
  arrowCone.rotation.x = Math.PI;
  const arrowStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10),
    goldMat
  );
  arrowStem.position.y = 0.24;
  arrowPointer.add(arrowCone, arrowStem);
  legalHighlightGroup.add(arrowPointer);
  group.add(legalHighlightGroup);

  // 9. Generous Invisible Raycast Hit-Sphere for Kid-Friendly Touch/Click
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  hitMesh.position.set(0, 0.52, 0);
  hitMesh.userData = {
    isPlaneHitTarget: true,
    colorIndex,
    colorId,
    planeIndex,
    globalPlaneIndex: globalIndex,
  };
  group.add(hitMesh);

  // Tag all child meshes with plane metadata so raycasting any part works
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData = {
        ...child.userData,
        colorIndex,
        colorId,
        planeIndex,
        globalPlaneIndex: globalIndex,
      };
    }
  });

  return {
    group,
    modelRoot,
    bodyMat,
    propellerGroup,
    stackBadgeGroup,
    stackOrbs,
    crownGroup,
    legalHighlightGroup,
    goldRing,
    arrowPointer,
    hitMesh,
    colorIndex,
    planeIndex,
    globalPlaneIndex: globalIndex,
    isBestHint: false,
  };
}

function buildGhostMiniPlaneMesh(ghostMat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 8, 12), ghostMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.28;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.24), ghostMat);
  wing.position.set(0, 0.28, 0.04);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.20), ghostMat);
  tail.position.set(0, 0.40, -0.26);
  g.add(body, wing, tail);
  return g;
}

const OUTCOME_COLORS = Object.freeze({
  capture: '#ef4444',
  home: '#fbbf24',
  fly: '#38bdf8',
  jump: '#4ade80',
  bounce: '#fb923c',
  takeoff: '#a855f7',
  advance: '#38bdf8',
});

export function buildAllPlanesAndEffectsGroup() {
  const root = new THREE.Group();
  root.name = 'AllPlanesAndEffects';

  const planeEntries = [];
  const raycastTargets = [];

  for (let c = 0; c < 4; c += 1) {
    for (let p = 0; p < 4; p += 1) {
      const entry = buildSingleChibiPlaneMesh(c, p);
      root.add(entry.group);
      planeEntries.push(entry);
      raycastTargets.push(entry.group);
    }
  }

  // 4 Ghost Destination Preview Rings + Translucent 3D Ghost Planes
  const destRingsGroup = new THREE.Group();
  const destRings = [];
  for (let i = 0; i < 4; i += 1) {
    const ringMat = makePlaneMat('#38bdf8', {
      roughness: 0.20,
      metalness: 0.15,
      emissive: '#0ea5e9',
      emissiveIntensity: 0.60,
      transparent: true,
      opacity: 0.88,
    });
    const ghostMat = makePlaneMat('#38bdf8', {
      roughness: 0.22,
      metalness: 0.12,
      emissive: '#38bdf8',
      emissiveIntensity: 0.50,
      transparent: true,
      opacity: 0.58,
    });
    const hintHaloMat = makePlaneMat('#fbbf24', {
      roughness: 0.18,
      metalness: 0.18,
      emissive: '#f59e0b',
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.92,
    });
    const rg = new THREE.Group();
    rg.visible = false;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.065, 12, 28),
      ringMat
    );
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.14;

    const hintHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.05, 10, 28),
      hintHaloMat
    );
    hintHalo.rotation.x = Math.PI / 2;
    hintHalo.position.y = 0.16;
    hintHalo.visible = false;

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      ringMat
    );
    beacon.position.y = 0.72;

    const ghostPlane = buildGhostMiniPlaneMesh(ghostMat);

    const ghostHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    ghostHit.position.y = 0.42;
    ghostHit.userData = {
      isGhostDestination: true,
      ghostSlotIndex: i,
      colorIndex: 0,
      planeIndex: 0,
    };

    rg.add(torus, hintHalo, beacon, ghostPlane, ghostHit);
    destRingsGroup.add(rg);
    raycastTargets.push(ghostHit);
    destRings.push({
      group: rg,
      torus,
      hintHalo,
      beacon,
      ghostPlane,
      ghostHit,
      ringMat,
      ghostMat,
      meta: null,
    });
  }
  root.add(destRingsGroup);

  // Firework Particle Pool for Captures & Goal Crowns
  const particleGroup = new THREE.Group();
  const particles = [];
  const particleGeo = new THREE.SphereGeometry(0.095, 8, 8);
  for (let i = 0; i < 48; i += 1) {
    const mat = makePlaneMat('#fbbf24', {
      roughness: 0.2,
      metalness: 0.1,
      emissive: '#f59e0b',
      emissiveIntensity: 0.65,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.visible = false;
    particleGroup.add(mesh);
    particles.push({
      mesh,
      active: false,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
    });
  }
  root.add(particleGroup);

  // Smoke Puff Pool for Captured Planes Spinning Back to Hangar
  const smokeGroup = new THREE.Group();
  const smokeParticles = [];
  const smokeGeo = new THREE.SphereGeometry(0.15, 10, 8);
  for (let i = 0; i < 36; i += 1) {
    const mat = makePlaneMat('#e2e8f0', {
      roughness: 0.55,
      metalness: 0.04,
      emissive: '#94a3b8',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.78,
    });
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.visible = false;
    smokeGroup.add(mesh);
    smokeParticles.push({
      mesh,
      active: false,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.55,
    });
  }
  root.add(smokeGroup);

  // 3D Wind Speed Lines Group for Fly-Across Shortcut (18 -> 30)
  const speedLinesGroup = new THREE.Group();
  speedLinesGroup.visible = false;
  const speedLineMeshes = [];
  const speedLineMat = makePlaneMat('#e0f2fe', {
    roughness: 0.15,
    metalness: 0.10,
    emissive: '#38bdf8',
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.85,
  });
  const speedLineGeo = new THREE.CylinderGeometry(0.025, 0.004, 1.45, 6);
  speedLineGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 10; i += 1) {
    const sl = new THREE.Mesh(speedLineGeo, speedLineMat);
    const angle = (i / 10) * Math.PI * 2;
    const rad = 0.38 + (i % 3) * 0.16;
    sl.position.set(Math.cos(angle) * rad, Math.sin(angle) * rad * 0.55 + 0.38, -0.75 - (i % 4) * 0.28);
    speedLinesGroup.add(sl);
    speedLineMeshes.push({ mesh: sl, baseZ: sl.position.z, phase: i * 0.7 });
  }
  root.add(speedLinesGroup);

  let smokeSpawnAccum = 0;
  let activeFlyingPlaneWorldPos = null;
  let lastCaptureImpact = null;

  function spawnFireworkBurst(x, z, colorHex = '#fbbf24', count = 14) {
    const palette =
      colorHex === 'multi'
        ? ['#fbbf24', '#ef4444', '#38bdf8', '#10b981', '#f472b6']
        : [colorHex];
    let spawned = 0;
    for (const pt of particles) {
      if (pt.active) continue;
      const col = new THREE.Color(palette[spawned % palette.length]);
      const angle = (spawned / count) * Math.PI * 2;
      const speed = 2.4 + (spawned % 4) * 0.95;
      pt.active = true;
      pt.life = 0.68;
      pt.mesh.visible = true;
      pt.mesh.position.set(x, 0.48, z);
      pt.mesh.material.color.copy(col);
      pt.mesh.material.emissive.copy(col);
      pt.vx = Math.cos(angle) * speed;
      pt.vy = 3.1 + (spawned % 4) * 0.65;
      pt.vz = Math.sin(angle) * speed;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  function spawnSmokePuff(x, y, z, burstCount = 1) {
    let spawned = 0;
    for (const sp of smokeParticles) {
      if (sp.active) continue;
      const jitterX = ((spawned * 37) % 10 - 5) * 0.025;
      const jitterZ = ((spawned * 53) % 10 - 5) * 0.025;
      sp.active = true;
      sp.maxLife = 0.52;
      sp.life = 0.52;
      sp.mesh.visible = true;
      sp.mesh.position.set(x + jitterX, Math.max(0.18, y), z + jitterZ);
      sp.mesh.scale.setScalar(0.55);
      sp.mesh.material.opacity = 0.80;
      sp.vx = jitterX * 1.4;
      sp.vy = 0.75 + (spawned % 3) * 0.25;
      sp.vz = jitterZ * 1.4;
      spawned += 1;
      if (spawned >= burstCount) break;
    }
  }

  function updatePlanesAndEffects(simSnap, timeSec, dtSec, pendingEvents = []) {
    // Trigger firework bursts & smoke puffs on capture or goal events
    if (Array.isArray(pendingEvents)) {
      for (const ev of pendingEvents) {
        if (ev.type === 'plane_capture' || ev.type === 'runway_capture') {
          const cx = ev.x ?? 0;
          const cz = ev.z ?? 0;
          spawnFireworkBurst(cx, cz, '#ef4444', 16);
          spawnSmokePuff(cx, 0.36, cz, 5);
          lastCaptureImpact = { x: cx, z: cz, timeSec };
        } else if (ev.type === 'plane_goal') {
          spawnFireworkBurst(0, 0, 'multi', 24);
        }
      }
    }

    // Update firework particles
    for (const pt of particles) {
      if (!pt.active) continue;
      pt.life -= dtSec;
      if (pt.life <= 0) {
        pt.active = false;
        pt.mesh.visible = false;
        continue;
      }
      pt.mesh.position.x += pt.vx * dtSec;
      pt.mesh.position.y += pt.vy * dtSec;
      pt.mesh.position.z += pt.vz * dtSec;
      pt.vy -= 7.5 * dtSec;
      pt.mesh.scale.setScalar(Math.max(0.1, pt.life * 2.0));
    }

    // Update smoke puff particles
    for (const sp of smokeParticles) {
      if (!sp.active) continue;
      sp.life -= dtSec;
      if (sp.life <= 0) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      const norm = 1 - sp.life / sp.maxLife;
      sp.mesh.position.x += sp.vx * dtSec;
      sp.mesh.position.y += sp.vy * dtSec;
      sp.mesh.position.z += sp.vz * dtSec;
      sp.mesh.scale.setScalar(0.55 + norm * 1.15);
      sp.mesh.material.opacity = Math.max(0.05, (1 - norm) * 0.78);
    }

    activeFlyingPlaneWorldPos = null;
    speedLinesGroup.visible = false;

    if (!simSnap || !Array.isArray(simSnap.planes)) return;

    const currentPlayer = simSnap.currentPlayer;
    const legalSet = new Set(simSnap.legalPlaneIndices || []);
    const legalMovesByPlane = new Map();
    if (Array.isArray(simSnap.legalMoves)) {
      for (const m of simSnap.legalMoves) {
        legalMovesByPlane.set(m.planeIndex, m);
      }
    }
    const activeAnim = simSnap.activeAnimation;
    smokeSpawnAccum += dtSec;

    // Update all 16 planes
    for (let i = 0; i < planeEntries.length; i += 1) {
      const entry = planeEntries[i];
      const pState = simSnap.planes[i];
      if (!pState) continue;

      const isCurrentPlayersPlane = pState.colorIndex === currentPlayer;
      const isLegalMove =
        simSnap.turnPhase === 'await_move' &&
        isCurrentPlayersPlane &&
        legalSet.has(pState.planeIndex);
      const moveMeta = isLegalMove ? legalMovesByPlane.get(pState.planeIndex) : null;
      const isBestHint = Boolean(moveMeta && moveMeta.isBestHint);
      entry.isBestHint = isBestHint;

      // Spin propeller faster when flying or legal
      const propSpeed = isLegalMove ? (isBestHint ? 32 : 24) : pState.state === PLANE_STATES.HANGAR ? 5 : 14;
      entry.propellerGroup.rotation.z += dtSec * propSpeed;

      // Emissive glow on legal planes (brighter pulse on best-scored hint plane)
      if (isLegalMove) {
        const glowPulse = isBestHint
          ? 0.58 + 0.28 * Math.sin(timeSec * 9.0)
          : 0.36 + 0.16 * Math.sin(timeSec * 6.0);
        entry.bodyMat.emissiveIntensity = glowPulse;
      } else {
        entry.bodyMat.emissiveIntensity = 0.12;
      }

      // Determine position (interpolated along parabolic hop waypoints, captured return arc, or settled)
      let posX = pState.x;
      let posY = 0.14;
      let posZ = pState.z;
      let targetYaw = Math.atan2(-posX, -posZ);
      let targetPitch = 0;

      const capturedEntry =
        activeAnim && Array.isArray(activeAnim.capturedPlanes)
          ? activeAnim.capturedPlanes.find((c) => c.globalIndex === entry.globalPlaneIndex)
          : null;

      if (activeAnim && activeAnim.globalPlaneIndex === entry.globalPlaneIndex && activeAnim.waypoints?.length >= 2) {
        const wps = activeAnim.waypoints;
        const segCount = wps.length - 1;
        const hopTotal = Math.max(1, activeAnim.hopFrames || activeAnim.totalFrames);
        const progress = Math.min(1, Math.max(0, activeAnim.elapsedFrames / hopTotal));
        const scaled = progress * segCount;
        const segIdx = Math.min(segCount - 1, Math.floor(scaled));
        const localT = scaled - segIdx;
        const a = wps[segIdx];
        const b = wps[segIdx + 1];
        posX = a.x + (b.x - a.x) * localT;
        posZ = a.z + (b.z - a.z) * localT;
        const isFlySeg = b.kind === 'fly_mid' || b.kind === 'fly_land';
        const arcPeak = isFlySeg ? 1.75 : b.kind === 'jump' ? 1.15 : 0.65;
        posY = 0.14 + Math.sin(localT * Math.PI) * arcPeak;
        if (Math.hypot(b.x - a.x, b.z - a.z) > 0.01) {
          targetYaw = Math.atan2(b.x - a.x, b.z - a.z);
        }
        if (activeAnim.didFly) {
          activeFlyingPlaneWorldPos = { x: posX, y: posY, z: posZ, yaw: targetYaw };
          speedLinesGroup.visible = true;
          speedLinesGroup.position.set(posX, posY, posZ);
          speedLinesGroup.rotation.y = targetYaw;
          for (const sl of speedLineMeshes) {
            sl.mesh.position.z = sl.baseZ - ((timeSec * 12 + sl.phase) % 0.9);
          }
        }
      } else if (capturedEntry && activeAnim) {
        // Animate captured plane spinning back to its Hangar slot trailing smoke puffs!
        const progress = Math.min(
          1,
          Math.max(0, activeAnim.elapsedFrames / Math.max(1, activeAnim.totalFrames))
        );
        posX = capturedEntry.prevX + (pState.x - capturedEntry.prevX) * progress;
        posZ = capturedEntry.prevZ + (pState.z - capturedEntry.prevZ) * progress;
        posY = 0.14 + Math.sin(progress * Math.PI) * 2.45;
        targetYaw = progress * Math.PI * 8.0;
        targetPitch = Math.sin(progress * Math.PI * 6.0) * 0.42;
        if (smokeSpawnAccum >= 0.025 && progress < 0.95) {
          smokeSpawnAccum = 0;
          spawnSmokePuff(posX, posY + 0.15, posZ, 1);
        }
      } else if (isLegalMove) {
        const bobAmp = isBestHint ? 0.22 : 0.14;
        const bobFreq = isBestHint ? 7.5 : 5.5;
        posY = 0.22 + Math.abs(Math.sin(timeSec * bobFreq + i)) * bobAmp;
      }

      entry.group.position.set(posX, posY, posZ);
      entry.modelRoot.rotation.set(targetPitch, targetYaw, 0);

      // Crown visibility
      entry.crownGroup.visible = Boolean(pState.crowned || pState.state === PLANE_STATES.GOAL);
      if (entry.crownGroup.visible) {
        entry.crownGroup.rotation.y = timeSec * 2.2;
      }

      // Friendly stack count orbs (shown on stackIndex === 0 when stackCount > 1)
      if (pState.stackCount > 1 && pState.stackIndex === 0) {
        entry.stackBadgeGroup.visible = true;
        const n = Math.min(4, pState.stackCount);
        for (let k = 0; k < 4; k += 1) {
          const orb = entry.stackOrbs[k];
          orb.visible = k < n;
          if (orb.visible) {
            const a = timeSec * 3.2 + (k / n) * Math.PI * 2;
            orb.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
          }
        }
      } else {
        entry.stackBadgeGroup.visible = false;
      }

      // Legal move 3D ring & bouncing arrow
      entry.legalHighlightGroup.visible = isLegalMove;
      if (isLegalMove) {
        const baseScale = isBestHint ? 1.24 : 1.0;
        const s = baseScale * (1.0 + 0.16 * Math.sin(timeSec * (isBestHint ? 9.0 : 7.0)));
        entry.goldRing.scale.set(s, s, 1);
        entry.arrowPointer.scale.setScalar(isBestHint ? 1.25 : 1.0);
        entry.arrowPointer.position.y = 1.44 + Math.sin(timeSec * (isBestHint ? 8.5 : 6.5)) * 0.18;
        entry.arrowPointer.rotation.y = timeSec * 3.2;
      }
    }

    // Update Ghost Destination Previews for legal moves (deduplicated by target tile, keeping best hint)
    const rawMoves = simSnap.turnPhase === 'await_move' ? (simSnap.legalMoves || []) : [];
    const sortedMoves = rawMoves.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const uniqueMoves = [];
    const seenDestKeys = new Set();
    for (const mv of sortedMoves) {
      const key = `${mv.toState}:${mv.toRelStep}`;
      if (!seenDestKeys.has(key)) {
        seenDestKeys.add(key);
        uniqueMoves.push(mv);
      }
    }

    for (let i = 0; i < destRings.length; i += 1) {
      const dr = destRings[i];
      if (i < uniqueMoves.length) {
        const mv = uniqueMoves[i];
        const colHex = OUTCOME_COLORS[mv.outcomeType] || '#38bdf8';
        dr.ringMat.color.set(colHex);
        dr.ringMat.emissive.set(colHex);
        dr.ghostMat.color.set(colHex);
        dr.ghostMat.emissive.set(colHex);

        dr.group.visible = true;
        dr.group.position.set(mv.destX, 0, mv.destZ);

        const isHint = Boolean(mv.isBestHint);
        dr.hintHalo.visible = isHint;
        const pulse = (isHint ? 1.15 : 0.94) + (isHint ? 0.20 : 0.12) * Math.sin(timeSec * (isHint ? 8.5 : 6.0) + i);
        dr.torus.scale.set(pulse, pulse, 1);
        if (isHint) {
          const haloPulse = 1.06 + 0.16 * Math.cos(timeSec * 8.5);
          dr.hintHalo.scale.set(haloPulse, haloPulse, 1);
        }
        dr.beacon.position.y = 0.78 + Math.sin(timeSec * 6.5 + i) * 0.12;
        dr.beacon.rotation.y = timeSec * 3.2;

        dr.ghostPlane.position.y = 0.08 + Math.abs(Math.sin(timeSec * 5.5 + i)) * 0.12;
        dr.ghostPlane.rotation.y = Math.atan2(-mv.destX, -mv.destZ);
        dr.ghostPlane.scale.setScalar(isHint ? 1.18 : 1.0);

        dr.ghostHit.userData.colorIndex = simSnap.currentPlayer;
        dr.ghostHit.userData.planeIndex = mv.planeIndex;
        dr.ghostHit.userData.globalPlaneIndex = mv.globalPlaneIndex;
        dr.meta = {
          planeIndex: mv.planeIndex,
          globalPlaneIndex: mv.globalPlaneIndex,
          destX: mv.destX,
          destZ: mv.destZ,
          outcomeType: mv.outcomeType || 'advance',
          outcomeIcon: mv.outcomeIcon || '✈️',
          outcomeLabel: mv.outcomeLabel || '',
          isBestHint: isHint,
          score: mv.score ?? 0,
        };
      } else {
        dr.group.visible = false;
        dr.meta = null;
      }
    }
  }

  function getEffectDiagnostics() {
    const activeSmokePuffs = smokeParticles.filter((s) => s.active).length;
    const activeFireworks = particles.filter((p) => p.active).length;
    const activeGhosts = destRings
      .filter((d) => d.group.visible && d.meta)
      .map((d) => ({ ...d.meta }));
    return {
      activeSmokePuffCount: activeSmokePuffs,
      activeFireworkCount: activeFireworks,
      flySpeedLinesActive: Boolean(speedLinesGroup.visible),
      activeFlyingPlaneWorldPos: activeFlyingPlaneWorldPos
        ? { ...activeFlyingPlaneWorldPos }
        : null,
      lastCaptureImpact: lastCaptureImpact ? { ...lastCaptureImpact } : null,
      activeGhosts,
    };
  }

  return {
    root,
    planeEntries,
    raycastTargets,
    destRings,
    updatePlanesAndEffects,
    getEffectDiagnostics,
  };
}
