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
  };
}

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

  // 4 Ghost Destination Preview Rings (shown for each legal move's target tile)
  const destRingsGroup = new THREE.Group();
  const destRings = [];
  const destRingMat = makePlaneMat('#38bdf8', {
    roughness: 0.20,
    metalness: 0.15,
    emissive: '#0ea5e9',
    emissiveIntensity: 0.55,
  });
  for (let i = 0; i < 4; i += 1) {
    const rg = new THREE.Group();
    rg.visible = false;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.055, 12, 26),
      destRingMat
    );
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.14;
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      destRingMat
    );
    beacon.position.y = 0.42;
    rg.add(torus, beacon);
    destRingsGroup.add(rg);
    destRings.push({ group: rg, torus, beacon });
  }
  root.add(destRingsGroup);

  // Firework Particle Pool for Captures & Goal Crowns
  const particleGroup = new THREE.Group();
  const particles = [];
  const particleGeo = new THREE.SphereGeometry(0.085, 8, 8);
  for (let i = 0; i < 32; i += 1) {
    const mat = makePlaneMat('#fbbf24', {
      roughness: 0.2,
      metalness: 0.1,
      emissive: '#f59e0b',
      emissiveIntensity: 0.6,
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

  function spawnFireworkBurst(x, z, colorHex = '#fbbf24') {
    const col = new THREE.Color(colorHex);
    let spawned = 0;
    for (const pt of particles) {
      if (pt.active) continue;
      const angle = (spawned / 10) * Math.PI * 2;
      const speed = 2.2 + (spawned % 3) * 0.9;
      pt.active = true;
      pt.life = 0.55;
      pt.mesh.visible = true;
      pt.mesh.position.set(x, 0.45, z);
      pt.mesh.material.color.copy(col);
      pt.mesh.material.emissive.copy(col);
      pt.vx = Math.cos(angle) * speed;
      pt.vy = 2.8 + (spawned % 4) * 0.6;
      pt.vz = Math.sin(angle) * speed;
      spawned += 1;
      if (spawned >= 10) break;
    }
  }

  function updatePlanesAndEffects(simSnap, timeSec, dtSec, pendingEvents = []) {
    // Trigger firework bursts on capture or goal events
    if (Array.isArray(pendingEvents)) {
      for (const ev of pendingEvents) {
        if (ev.type === 'plane_capture' || ev.type === 'runway_capture') {
          spawnFireworkBurst(ev.x || 0, ev.z || 0, '#ef4444');
        } else if (ev.type === 'plane_goal') {
          spawnFireworkBurst(0, 0, '#fbbf24');
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
      pt.mesh.scale.setScalar(Math.max(0.1, pt.life * 1.8));
    }

    if (!simSnap || !Array.isArray(simSnap.planes)) return;

    const currentPlayer = simSnap.currentPlayer;
    const legalSet = new Set(simSnap.legalPlaneIndices || []);
    const activeAnim = simSnap.activeAnimation;

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

      // Spin propeller faster when flying or legal
      const propSpeed = isLegalMove ? 24 : pState.state === PLANE_STATES.HANGAR ? 5 : 14;
      entry.propellerGroup.rotation.z += dtSec * propSpeed;

      // Determine position (interpolated along parabolic hop waypoints, captured return arc, or settled)
      let posX = pState.x;
      let posY = 0.14;
      let posZ = pState.z;
      let targetYaw = Math.atan2(-posX, -posZ);

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
        const arcPeak = b.kind === 'fly_mid' || b.kind === 'fly_land' ? 1.55 : b.kind === 'jump' ? 1.05 : 0.65;
        posY = 0.14 + Math.sin(localT * Math.PI) * arcPeak;
        if (Math.hypot(b.x - a.x, b.z - a.z) > 0.01) {
          targetYaw = Math.atan2(b.x - a.x, b.z - a.z);
        }
      } else if (capturedEntry && activeAnim) {
        // Animate captured plane spiraling along a high parabolic arc back to its Hangar slot!
        const progress = Math.min(
          1,
          Math.max(0, activeAnim.elapsedFrames / Math.max(1, activeAnim.totalFrames))
        );
        posX = capturedEntry.prevX + (pState.x - capturedEntry.prevX) * progress;
        posZ = capturedEntry.prevZ + (pState.z - capturedEntry.prevZ) * progress;
        posY = 0.14 + Math.sin(progress * Math.PI) * 2.25;
        targetYaw = progress * Math.PI * 6.0;
      } else if (isLegalMove) {
        posY = 0.20 + Math.abs(Math.sin(timeSec * 5.5 + i)) * 0.14;
      }

      entry.group.position.set(posX, posY, posZ);
      entry.modelRoot.rotation.y = targetYaw;

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
        const s = 1.0 + 0.14 * Math.sin(timeSec * 7.0);
        entry.goldRing.scale.set(s, s, 1);
        entry.arrowPointer.position.y = 1.44 + Math.sin(timeSec * 6.5) * 0.15;
        entry.arrowPointer.rotation.y = timeSec * 3.0;
      }
    }

    // Update Ghost Destination Rings for legal moves
    const moves = simSnap.turnPhase === 'await_move' ? (simSnap.legalMoves || []) : [];
    for (let i = 0; i < destRings.length; i += 1) {
      const dr = destRings[i];
      if (i < moves.length) {
        const mv = moves[i];
        dr.group.visible = true;
        dr.group.position.set(mv.destX, 0, mv.destZ);
        const pulse = 0.92 + 0.14 * Math.sin(timeSec * 6.0 + i);
        dr.torus.scale.set(pulse, pulse, 1);
        dr.beacon.position.y = 0.42 + Math.sin(timeSec * 5.5 + i) * 0.10;
        dr.beacon.rotation.y = timeSec * 2.8;
      } else {
        dr.group.visible = false;
      }
    }
  }

  return {
    root,
    planeEntries,
    raycastTargets,
    destRings,
    updatePlanesAndEffects,
  };
}
