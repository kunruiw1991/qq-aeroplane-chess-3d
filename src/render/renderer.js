/**
 * Main Three.js r170 WebGL2 Renderer, Responsive Camera Rig,
 * 3D Plane Raycaster & 3D Top-3 Star Podium Scene
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 */

import * as THREE from '../../vendor/three.module.min.js';
import {
  COLOR_IDS,
  COLOR_META,
  SCREEN_IDS,
} from '../contracts/constants.js';
import { buildBoardSceneGroup } from './board_meshes.js';
import { buildAllPlanesAndEffectsGroup } from './plane_meshes.js';

function build3DPodiumGroup() {
  const podiumGroup = new THREE.Group();
  podiumGroup.name = 'Podium3DStage';
  podiumGroup.position.set(0, 1.35, 0);
  podiumGroup.visible = false;

  const stageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.10,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.22,
    metalness: 0.20,
    emissive: 0xd97706,
    emissiveIntensity: 0.28,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.24,
    metalness: 0.20,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    roughness: 0.26,
    metalness: 0.18,
  });

  const stageDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 0.36, 32),
    stageMat
  );
  stageDisc.position.y = -0.18;
  podiumGroup.add(stageDisc);

  // 1st (Center), 2nd (Left), 3rd (Right) Pillars
  const pillars = [
    { rank: 1, x: 0, h: 1.65, mat: goldMat, stars: 3 },
    { rank: 2, x: -2.05, h: 1.15, mat: silverMat, stars: 2 },
    { rank: 3, x: 2.05, h: 0.85, mat: bronzeMat, stars: 1 },
  ];

  const starMeshes = [];
  const topperMeshes = [];

  for (const p of pillars) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.86, p.h, 24),
      p.mat
    );
    col.position.set(p.x, p.h * 0.5, 0);
    podiumGroup.add(col);

    // Winner plane emblem sphere/plane on top of each pillar
    const topper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.45, 10, 16),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.25,
        metalness: 0.14,
      })
    );
    topper.rotation.x = Math.PI / 2;
    topper.position.set(p.x, p.h + 0.46, 0);
    podiumGroup.add(topper);
    topperMeshes.push({ rank: p.rank, mesh: topper, baseY: p.h + 0.46 });

    // 3D Gold Stars floating above each pillar (3/2/1 stars)
    for (let s = 0; s < p.stars; s += 1) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        goldMat
      );
      const offset = (s - (p.stars - 1) * 0.5) * 0.46;
      star.position.set(p.x + offset, p.h + 1.12, 0);
      podiumGroup.add(star);
      starMeshes.push(star);
    }
  }

  function updatePodium(simSnap, timeSec) {
    if (simSnap && Array.isArray(simSnap.rankings)) {
      for (const t of topperMeshes) {
        const entry = simSnap.rankings.find((r) => r.rank === t.rank);
        if (entry && COLOR_META[entry.colorId]) {
          t.mesh.material.color.set(COLOR_META[entry.colorId].hex);
        }
        t.mesh.position.y = t.baseY + Math.sin(timeSec * 3.5 + t.rank) * 0.08;
        t.mesh.rotation.z = Math.sin(timeSec * 2.4 + t.rank) * 0.15;
      }
    }
    for (let i = 0; i < starMeshes.length; i += 1) {
      starMeshes[i].rotation.y = timeSec * 2.8 + i * 0.5;
    }
  }

  return {
    group: podiumGroup,
    updatePodium,
  };
}

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.viewportWidth = Math.max(1, window.innerWidth || 1280);
    this.viewportHeight = Math.max(1, window.innerHeight || 800);
    this.screenMode = SCREEN_IDS.TITLE;
    this.elapsedSec = 0;

    let gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (_) {
      gl = null;
    }
    this.isWebGL2 = Boolean(gl);

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      context: gl || undefined,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.webgl.setSize(this.viewportWidth, this.viewportHeight, false);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7dd3fc');

    this.camera = new THREE.PerspectiveCamera(
      42,
      this.viewportWidth / this.viewportHeight,
      0.5,
      120
    );
    this.cameraDistance = 20.5;
    this.baseCameraDistance = 19.6;
    this.cameraZoomRatio = 1.0;
    this.cameraPunchState = {
      active: false,
      remainingSec: 0,
      maxSec: 0.65,
      targetX: 0,
      targetZ: 0,
    };
    this.cameraFollowActive = false;
    this.floatingTexts = [];
    this._fxIdSeq = 0;

    // Warm cheerful sky lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbae6fd, 1.25);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sunLight.position.set(10, 22, 14);
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
    fillLight.position.set(-12, 14, -10);
    this.scene.add(fillLight);

    this.boardBundle = buildBoardSceneGroup();
    this.scene.add(this.boardBundle.root);

    this.planesBundle = buildAllPlanesAndEffectsGroup();
    this.scene.add(this.planesBundle.root);

    this.podiumBundle = build3DPodiumGroup();
    this.scene.add(this.podiumBundle.group);

    this.raycaster = new THREE.Raycaster();
    this.ndcPointer = new THREE.Vector2();

    this._lastDrawCalls = 0;
    this._lastTriangles = 0;
    this._updateCameraForViewport();
  }

  resize(width, height) {
    this.viewportWidth = Math.max(1, Math.round(Number(width) || 1280));
    this.viewportHeight = Math.max(1, Math.round(Number(height) || 800));
    this.webgl.setSize(this.viewportWidth, this.viewportHeight, false);
    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.updateProjectionMatrix();
    this._updateCameraForViewport();
  }

  _updateCameraForViewport() {
    const aspect = this.viewportWidth / Math.max(1, this.viewportHeight);
    if (this.screenMode === SCREEN_IDS.PODIUM) {
      const dist = aspect < 1.0 ? 15.5 : 11.2;
      this.cameraDistance = dist;
      this.camera.position.set(0, dist * 0.45, dist * 0.88);
      this.camera.lookAt(0, 2.1, 0);
      return;
    }

    // Ensure the 17.8x17.8 board fills >= 60% of the viewport across all 4 target resolutions
    let baseDist = 19.6;
    if (aspect < 1.0) {
      // Portrait (e.g. 390x844): pull back so full cross board width fits cleanly
      baseDist = 18.2 / Math.max(0.50, aspect * 1.12);
    } else if (aspect > 1.85) {
      // Wide mobile landscape (e.g. 844x390): frame tightly vertically
      baseDist = 18.4;
    }

    this.baseCameraDistance = baseDist;
    this.cameraDistance = baseDist * (this.cameraZoomRatio || 1.0);
    this.camera.position.set(0, baseDist * 0.80, baseDist * 0.58);
    this.camera.lookAt(0, -0.25, 0.35);
  }

  setScreenMode(mode) {
    this.screenMode = mode;
    this.podiumBundle.group.visible = mode === SCREEN_IDS.PODIUM;
    this.cameraZoomRatio = 1.0;
    this.cameraPunchState.active = false;
    this.cameraPunchState.remainingSec = 0;
    this.cameraFollowActive = false;
    this.floatingTexts.length = 0;
    this._updateCameraForViewport();
  }

  projectWorldToScreen(x, y, z) {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3(x, y, z);
    worldPos.project(this.camera);

    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.viewportWidth;
    const h = rect.height || this.viewportHeight;
    const clientX = (rect.left || 0) + (worldPos.x * 0.5 + 0.5) * w;
    const clientY = (rect.top || 0) + (-worldPos.y * 0.5 + 0.5) * h;

    return {
      clientX: Number(clientX.toFixed(1)),
      clientY: Number(clientY.toFixed(1)),
    };
  }

  /**
   * Raycasts against the 16 3D planes (and destination ghost previews) from client (x, y) coordinates.
   * Prioritizes legal movable planes of the current player when in `await_move`.
   */
  raycastPlaneAtClientXY(clientX, clientY, simSnap = null) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    this.ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.ndcPointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.planesBundle.raycastTargets, true);
    if (!hits || hits.length === 0) return null;

    const legalSet = new Set(simSnap?.legalPlaneIndices || []);
    const activeColor = simSnap?.currentPlayer ?? -1;

    // First look for a hit on a legal movable plane (or its destination ghost) of the current player
    for (const hit of hits) {
      const ud = hit.object?.userData;
      if (
        ud &&
        ud.colorIndex === activeColor &&
        legalSet.has(ud.planeIndex)
      ) {
        return {
          colorIndex: ud.colorIndex,
          colorId: ud.colorId || COLOR_IDS[ud.colorIndex],
          planeIndex: ud.planeIndex,
          globalPlaneIndex: ud.globalPlaneIndex,
          isLegal: true,
          isGhostDestination: Boolean(ud.isGhostDestination),
        };
      }
    }

    // Otherwise return the closest plane hit
    for (const hit of hits) {
      const ud = hit.object?.userData;
      if (ud && ud.planeIndex !== undefined && !ud.isGhostDestination) {
        return {
          colorIndex: ud.colorIndex,
          colorId: ud.colorId || COLOR_IDS[ud.colorIndex],
          planeIndex: ud.planeIndex,
          globalPlaneIndex: ud.globalPlaneIndex,
          isLegal: ud.colorIndex === activeColor && legalSet.has(ud.planeIndex),
          isGhostDestination: false,
        };
      }
    }
    return null;
  }

  /**
   * Projects a 3D plane's world position into viewport client (x, y) pixel coordinates
   * so E2E tests and touch helpers can verify and click 3D planes directly on canvas!
   */
  getPlaneScreenCoords(colorIndex, planeIndex) {
    const globalIdx = colorIndex * 4 + planeIndex;
    const entry = this.planesBundle.planeEntries[globalIdx];
    if (!entry) return null;

    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    entry.hitMesh.getWorldPosition(worldPos);
    worldPos.project(this.camera);

    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.viewportWidth;
    const h = rect.height || this.viewportHeight;
    const clientX = (rect.left || 0) + (worldPos.x * 0.5 + 0.5) * w;
    const clientY = (rect.top || 0) + (-worldPos.y * 0.5 + 0.5) * h;

    return {
      colorIndex,
      planeIndex,
      globalPlaneIndex: globalIdx,
      clientX: Number(clientX.toFixed(1)),
      clientY: Number(clientY.toFixed(1)),
      highlighted: Boolean(entry.legalHighlightGroup.visible),
      isBestHint: Boolean(entry.isBestHint),
    };
  }

  _spawnFloatingText(kind, text, fullText, x, y, z, durationSec = 1.05) {
    this._fxIdSeq += 1;
    this.floatingTexts.push({
      id: this._fxIdSeq,
      kind,
      text,
      fullText,
      x: Number(x) || 0,
      y: Number(y) || 1.15,
      z: Number(z) || 0,
      remainingSec: durationSec,
      maxSec: durationSec,
    });
    if (this.floatingTexts.length > 8) {
      this.floatingTexts.splice(0, this.floatingTexts.length - 8);
    }
  }

  render(simSnap, dtSec = 1 / 60, uiState = {}) {
    const rawDt = Math.max(0, dtSec);
    this.elapsedSec += rawDt;
    const pendingEvents = uiState.pendingEvents || [];

    // Trigger camera punch-in & floating spectacle texts from match events
    for (const ev of pendingEvents) {
      if (ev.type === 'plane_capture' || ev.type === 'runway_capture') {
        const cx = ev.x ?? 0;
        const cz = ev.z ?? 0;
        this.cameraPunchState.active = true;
        this.cameraPunchState.remainingSec = 0.65;
        this.cameraPunchState.maxSec = 0.65;
        this.cameraPunchState.targetX = cx;
        this.cameraPunchState.targetZ = cz;
        this._spawnFloatingText('capture', '击落!', '💥 击落!', cx, 1.18, cz, 1.05);
      } else if (ev.type === 'plane_goal') {
        this._spawnFloatingText('goal', '到家!', '👑 到家!', 0, 1.38, 0, 1.25);
      } else if (ev.type === 'plane_fly') {
        this._spawnFloatingText('fly', '超级飞棋!', '✈️ 超级飞棋!', 0, 1.25, 0, 0.95);
      }
    }

    // Update floating text timers
    for (let i = this.floatingTexts.length - 1; i >= 0; i -= 1) {
      const ft = this.floatingTexts[i];
      ft.remainingSec -= rawDt;
      ft.y += rawDt * 0.65;
      if (ft.remainingSec <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    this.boardBundle.updateBoardAnimations(simSnap, this.elapsedSec, rawDt);
    this.planesBundle.updatePlanesAndEffects(simSnap, this.elapsedSec, rawDt, pendingEvents);

    if (this.screenMode === SCREEN_IDS.PODIUM) {
      this.podiumBundle.group.visible = true;
      this.podiumBundle.updatePodium(simSnap, this.elapsedSec);
    } else {
      this.podiumBundle.group.visible = false;
    }

    const fxDiag = this.planesBundle.getEffectDiagnostics();
    const baseDist = this.baseCameraDistance || 19.6;

    if (this.screenMode === SCREEN_IDS.TITLE || this.screenMode === SCREEN_IDS.SELECT) {
      this.cameraZoomRatio = 1.0;
      this.cameraPunchState.active = false;
      this.cameraFollowActive = false;
      const angle = Math.sin(this.elapsedSec * 0.35) * 0.22;
      const dist = baseDist;
      this.cameraDistance = dist;
      this.camera.position.set(
        Math.sin(angle) * dist * 0.55,
        dist * 0.78,
        Math.cos(angle) * dist * 0.58
      );
      this.camera.lookAt(0, -0.2, 0.2);
    } else if (this.screenMode === SCREEN_IDS.PLAYING) {
      const anim = simSnap?.activeAnimation || null;
      const animProgress = anim
        ? Math.min(1, Math.max(0, (anim.elapsedFrames || 0) / Math.max(1, anim.totalFrames || 1)))
        : 1;

      if (!anim) {
        // Move animation has finished -> guarantee camera is 100% eased back to full-board framing
        // before the next human AWAIT_ROLL!
        this.cameraPunchState.active = false;
        this.cameraPunchState.remainingSec = 0;
        this.cameraFollowActive = false;
        this.cameraZoomRatio = 1.0;
        this.cameraDistance = baseDist;
        this.camera.position.set(0, baseDist * 0.80, baseDist * 0.58);
        this.camera.lookAt(0, -0.25, 0.35);
      } else if (this.cameraPunchState.active || (anim.capturedPlanes && anim.capturedPlanes.length > 0)) {
        // 15% camera punch-in toward impact for first 55% of capture animation,
        // then smoothly ease back to 1.0 full-board framing within <= 0.9s!
        this.cameraPunchState.active = true;
        this.cameraFollowActive = false;
        if (!this.cameraPunchState.targetX && !this.cameraPunchState.targetZ && fxDiag.lastCaptureImpact) {
          this.cameraPunchState.targetX = fxDiag.lastCaptureImpact.x;
          this.cameraPunchState.targetZ = fxDiag.lastCaptureImpact.z;
        }
        let punchWeight = 1.0;
        if (animProgress > 0.55) {
          const t = Math.min(1, Math.max(0, (animProgress - 0.55) / 0.45));
          punchWeight = 1.0 - t * t * (3 - 2 * t);
        }
        this.cameraZoomRatio = 1.0 - 0.15 * punchWeight;
        const dist = baseDist * this.cameraZoomRatio;
        this.cameraDistance = dist;
        const tx = this.cameraPunchState.targetX * punchWeight;
        const tz = this.cameraPunchState.targetZ * punchWeight;
        this.camera.position.set(
          tx * 0.25,
          dist * 0.80,
          dist * 0.58 + tz * 0.20
        );
        this.camera.lookAt(
          tx * 0.45,
          -0.25 + 0.30 * punchWeight,
          0.35 + (this.cameraPunchState.targetZ - 0.35) * 0.45 * punchWeight
        );
      } else if (fxDiag.activeFlyingPlaneWorldPos) {
        // Camera follows the plane during 18->30 super-fly bridge and eases back at the end!
        this.cameraFollowActive = true;
        let followWeight = 1.0;
        if (animProgress > 0.65) {
          const t = Math.min(1, Math.max(0, (animProgress - 0.65) / 0.35));
          followWeight = 1.0 - t * t * (3 - 2 * t);
        }
        this.cameraZoomRatio = 1.0 - 0.10 * followWeight;
        const dist = baseDist * this.cameraZoomRatio;
        this.cameraDistance = dist;
        const fp = fxDiag.activeFlyingPlaneWorldPos;
        this.camera.position.set(
          fp.x * 0.30 * followWeight,
          dist * (0.80 - 0.04 * followWeight),
          dist * (0.58 - 0.03 * followWeight) + fp.z * 0.24 * followWeight
        );
        this.camera.lookAt(
          fp.x * 0.55 * followWeight,
          -0.25 + 0.45 * followWeight,
          0.35 + (fp.z * 0.55 - 0.35) * followWeight
        );
      } else {
        this.cameraFollowActive = false;
        this.cameraZoomRatio = 1.0;
        this.cameraDistance = baseDist;
        this.camera.position.set(0, baseDist * 0.80, baseDist * 0.58);
        this.camera.lookAt(0, -0.25, 0.35);
      }
    }

    this.webgl.render(this.scene, this.camera);
    this._lastDrawCalls = this.webgl.info?.render?.calls ?? 0;
    this._lastTriangles = this.webgl.info?.render?.triangles ?? 0;
  }

  getDiagnostics(simSnap = null) {
    const highlightedPlanes = [];
    for (const entry of this.planesBundle.planeEntries) {
      if (entry.legalHighlightGroup.visible) {
        const sc = this.getPlaneScreenCoords(entry.colorIndex, entry.planeIndex);
        if (sc) highlightedPlanes.push(sc);
      }
    }

    const fxDiag = this.planesBundle.getEffectDiagnostics();
    const ghostPreviews = (fxDiag.activeGhosts || []).map((g) => {
      const sc = this.projectWorldToScreen(g.destX, 0.52, g.destZ);
      return {
        ...g,
        clientX: sc.clientX,
        clientY: sc.clientY,
      };
    });

    const activeFloatingTexts = this.floatingTexts.map((ft) => {
      const sc = this.projectWorldToScreen(ft.x, ft.y, ft.z);
      return {
        id: ft.id,
        kind: ft.kind,
        text: ft.text,
        fullText: ft.fullText,
        clientX: sc.clientX,
        clientY: sc.clientY,
        remainingSec: Number(ft.remainingSec.toFixed(2)),
      };
    });

    return {
      webgl2: this.isWebGL2,
      drawCalls: this._lastDrawCalls,
      triangles: this._lastTriangles,
      cameraDistance: Number(this.cameraDistance.toFixed(2)),
      baseCameraDistance: Number((this.baseCameraDistance || 19.6).toFixed(2)),
      cameraZoomRatio: Number((this.cameraZoomRatio || 1.0).toFixed(3)),
      cameraPunchActive: Boolean(this.cameraPunchState.active),
      cameraFollowActive: Boolean(this.cameraFollowActive),
      cameraFov: this.camera.fov,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      highlightedPlaneCount: highlightedPlanes.length,
      highlightedPlanes,
      ghostPreviewCount: ghostPreviews.length,
      ghostPreviews,
      activeFloatingTexts,
      activeSmokePuffCount: fxDiag.activeSmokePuffCount,
      activeFireworkCount: fxDiag.activeFireworkCount,
      flySpeedLinesActive: fxDiag.flySpeedLinesActive,
      dieScale: this.boardBundle.getDieScale(),
      timeScale: simSnap?.timeScale ?? 1.0,
    };
  }

  dispose() {
    try {
      this.webgl.dispose();
    } catch (_) {}
  }
}
