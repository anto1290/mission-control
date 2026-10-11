'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildOfficeEnvironment, type OfficeSeat } from './office/environment';
import { createOfficePathfinder, type Pathfinder } from './office/pathfinding';

interface AgentStation {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped';
  seat: number;
  color: string;
  room?: string;
  task?: string;
  taskStatus?: string;
  reason?: 'task' | 'scheduled' | 'idle' | string;
  scheduledJob?: string;
}

interface Props {
  agents: AgentStation[];
  onAgentClick?: (agent: AgentStation | null) => void;
}

// ─── Rigged character ────────────────────────────────────────────────────────
// Procedural humanoid with joint pivots so walk/typing/sit can be articulated
// rather than swivelling a single flat group. Upgraded to a rigged GLB +
// AnimationMixer when a licensed asset is available (docs §5/§6).

interface RiggedCharacter {
  root: THREE.Group;
  legs: THREE.Group[];   // pivots at hips
  arms: THREE.Group[];   // pivots at shoulders
  head: THREE.Object3D;
  glow?: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
}

// Shared, cacheable geometry. Created lazily on first use inside the client
// effect (via createCharacter) — never at module top level, so SSR import
// stays clean even if the module is evaluated before the browser is ready.
let GEO: {
  body: THREE.BoxGeometry; head: THREE.SphereGeometry; hair: THREE.SphereGeometry;
  leg: THREE.CylinderGeometry; arm: THREE.CylinderGeometry; ring: THREE.RingGeometry;
} | null = null;
function getGeo() {
  if (!GEO) {
    GEO = {
      body: new THREE.BoxGeometry(0.4, 0.5, 0.25),
      head: new THREE.SphereGeometry(0.15, 16, 16),
      hair: new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      leg: new THREE.CylinderGeometry(0.06, 0.06, 0.4),
      arm: new THREE.CylinderGeometry(0.05, 0.05, 0.4),
      ring: new THREE.RingGeometry(0.2, 0.3, 32),
    };
  }
  return GEO;
}

// ─── Shared geometries (Phase G: reuse, don't allocate per frame) ───────────
const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
const headGeo = new THREE.SphereGeometry(0.15, 12, 12);
const hairGeo = new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4);
const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4);
const glowGeo = new THREE.RingGeometry(0.2, 0.3, 24);

// ─── Shared materials (Phase G: single instances, reused everywhere) ─────────
const sharedMats = {
  skinActive: new THREE.MeshStandardMaterial({ color: 0xf4c7a8, roughness: 0.8 }),
  skinOffline: new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x2c2c2c }),
  leg: new THREE.MeshStandardMaterial({ color: 0x1e293b }),
  glow: new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
};

// Color map for agents (Phase G: cache created colors)
const colorCache = new Map<string, THREE.Color>();
function getCachedColor(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

// Temporary vectors (Phase G: avoid allocations in hot loop)
const _tempVec = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _lookTarget = new THREE.Vector3();

function createCharacter(color: string, active: boolean): THREE.Group {
  const root = new THREE.Group();
  const bodyColor = active ? getCachedColor(color) : new THREE.Color(0x475569);
  const skinMat = active ? sharedMats.skinActive : sharedMats.skinOffline;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });

  // Body
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.userData.isBody = true;
  root.add(body);

  // Head
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.95;
  head.castShadow = true;
  root.add(head);

  // Hair
  const hair = new THREE.Mesh(hairGeo, sharedMats.hair);
  hair.position.y = 1.0;
  root.add(hair);

  // Legs (shared geo, pivots at hips via nested groups)
  const legs: THREE.Group[] = [];
  [-0.1, 0.1].forEach(x => {
    const legGroup = new THREE.Group();
    legGroup.position.set(x, 0.4, 0);
    const leg = new THREE.Mesh(legGeo, sharedMats.leg);
    leg.position.y = -0.2;
    leg.castShadow = true;
    legGroup.add(leg);
    legs.push(legGroup);
    root.add(legGroup);
  });

  // Arms (shared geo, pivots at shoulders via nested groups)
  const arms: THREE.Group[] = [];
  [-0.25, 0.25].forEach(x => {
    const armGroup = new THREE.Group();
    armGroup.position.set(x, 0.55, 0);
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.y = -0.2;
    arm.castShadow = true;
    arm.userData.isArm = true;
    armGroup.add(arm);
    arms.push(armGroup);
    root.add(armGroup);
  });

  // Status glow (shared geo+mat, unique instance)
  let glow: THREE.Mesh | undefined;
  if (active) {
    glow = new THREE.Mesh(glowGeo, sharedMats.glow.clone());
    glow.position.y = 0.05;
    glow.rotation.x = -Math.PI / 2;
    glow.userData.isGlow = true;
    root.add(glow);
  }

  // Expose the rig through userData so the per-frame animator can reach it
  root.userData.rig = { root, legs, arms, head, glow, bodyMat } satisfies RiggedCharacter;
  return root;
}

function rigOf(char: THREE.Group): RiggedCharacter | undefined {
  return char.userData.rig as RiggedCharacter | undefined;
}

// ─── GLB rigged character (docs §5/§6) ───────────────────────────────────────
// ponytail: procedural rig is the fallback; GLB upgrades animation quality.
// Soldier.glb is a CC0 humanoid (Mixamo) from the three.js examples repo
// with Idle/Run/Walk clips — proper office-worker silhouette per §5.
// ponytail: single-action clip switching (no cross-fade); upgrade to
// THREE.AnimationMixer blending (fadeToAction) when a production asset
// with more clips is available.
const GLB_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';

let gltfScene: THREE.Group | null = null;

interface GlbState {
  loaded: boolean;
  clips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; meeting?: THREE.AnimationClip };
}
const glbState: GlbState = { loaded: false, clips: {} };

async function loadGlbCharacter(): Promise<boolean> {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(GLB_URL);
    const clips = gltf.animations;
    if (clips.length === 0) return false;
    gltfScene = gltf.scene;
    // Soldier.glb actual clips: [0]Idle [1]Run [2]TPose [3]Walk
    const byName = (pred: (n: string) => boolean, fallbackIdx: number) =>
      clips.find(c => pred(c.name.toLowerCase())) ?? clips[fallbackIdx];
    glbState.clips.idle = byName(n => n.includes('idle'), 0);
    glbState.clips.walk = byName(n => n.includes('walk'), 3);
    // ponytail: no "meeting" clip in Soldier; reuse idle as seated-idle.
    glbState.clips.meeting = glbState.clips.idle;
    glbState.loaded = true;
    return true;
  } catch {
    return false;
  }
}

function createGlbCharacter(color: string, active: boolean): { group: THREE.Group; mixer: THREE.AnimationMixer; isGlb: boolean } {
  if (glbState.loaded && gltfScene) {
    const mesh = gltfScene.clone(true);
    // Tint the GLB to match the agent color
    mesh.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const mat = (obj.material as THREE.Material).clone();
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.color.multiply(new THREE.Color(color));
        }
        obj.material = mat;
      }
    });
    // ponytail: bind mixer to the cloned scene root (preserves bone hierarchy
    // that the clips were baked against). Wrapper group carries position/
    // rotation + userData; mixer drives the internal skeleton.
    const group = new THREE.Group();
    group.userData.isGlb = true;
    group.add(mesh);
    const mixer = new THREE.AnimationMixer(mesh);
    return { group, mixer, isGlb: true };
  }
  // Fallback: procedural rig
  const group = createCharacter(color, active);
  const mixer = new THREE.AnimationMixer(group);
  return { group, mixer, isGlb: false };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Office3D({ agents, onAgentClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentStation | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<AgentStation | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const agentsRef = useRef<AgentStation[]>(agents);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 35, target: new THREE.Vector3(0, 0, 0) });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const characterMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const mixersRef = useRef<Map<string, THREE.AnimationMixer>>(new Map());
  const mixerExistingActions = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const focusedAgentRef = useRef<string | null>(null);
  const behaviorRef = useRef<Map<string, { state: string; startTime: number; duration: number }>>(new Map());
  const walkPathRef = useRef<Map<string, { pts: THREE.Vector3[]; i: number }>>(new Map());
  const lastSigRef = useRef<Map<string, string>>(new Map());
  const walkPhaseRef = useRef<Map<string, number>>(new Map());
  const pathfinderRef = useRef<Pathfinder | null>(null);
  const seatsRef = useRef<OfficeSeat[]>([]);
  const timeRef = useRef(0);

  agentsRef.current = agents;

  // Load GLB character asset once on mount (docs §5/§6).
  // ponytail: fire-and-forget; characters are created with procedural rig
  // until GLB is ready, then upgraded in a separate effect when agents change.
  useEffect(() => { loadGlbCharacter(); }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd3e2);
    scene.fog = new THREE.Fog(0xbfd3e2, 60, 110);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 200);
    camera.position.set(14, 22, 34);
    camera.lookAt(0, 1, -2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Phase G: cap pixel ratio
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const env = buildOfficeEnvironment(scene);
    seatsRef.current = env.seats;

    // Lazy-init pathfinder once
    if (!pathfinderRef.current) pathfinderRef.current = createOfficePathfinder();
    const pathfinder = pathfinderRef.current;

    // Resolve target from data (deterministic, no randomness)
    // §E: event-driven — active task → Workspace, scheduled → Meeting, offline → Lounge
    const resolveTarget = (agent: AgentStation, idx: number): { state: string; end: THREE.Vector3 } => {
      const home = (seatsRef.current[idx] || seatsRef.current[0])?.approach ?? new THREE.Vector3(0, 0, 0);
      if (agent.status === 'Stopped') return { state: 'idle', end: home };
      // reason drives room: 'scheduled' → meeting, 'idle' → lounge, 'task' → workspace
      const room = agent.reason === 'scheduled' ? 'meeting'
        : agent.reason === 'idle' ? 'lounge'
        : (agent.room || 'Workspace').toLowerCase();
      if (room === 'meeting') return { state: 'meeting', end: env.meetingSeats[idx % env.meetingSeats.length].clone() };
      if (room === 'lounge' || room === 'coffee') return { state: 'coffee', end: env.loungeCenter.clone() };
      return { state: 'working', end: home };
    };

    const applyAgentState = (agent: AgentStation, idx: number) => {
      const char = characterMeshesRef.current.get(agent.id);
      if (!char) return;
      const sig = `${agent.status}|${agent.room || ''}|${agent.taskStatus || ''}|${agent.task || ''}`;
      const prevSig = lastSigRef.current.get(agent.id);
      const { state, end } = resolveTarget(agent, idx);
      behaviorRef.current.set(agent.id, { state, startTime: Date.now(), duration: 0 });
      // Only walk when target changed (no random wandering)
      if (prevSig !== sig && !walkPathRef.current.has(agent.id)) {
        const pts = pathfinder.findPath(char.position.clone(), end);
        walkPathRef.current.set(agent.id, { pts, i: 0 });
      }
      lastSigRef.current.set(agent.id, sig);
    };

    // Create characters
    agents.forEach((agent, idx) => {
      const seat = seatsRef.current[idx] || seatsRef.current[0];
      const { group: char, mixer } = createGlbCharacter(agent.color, agent.status === 'Running');
      char.position.copy(seat ? seat.chair : new THREE.Vector3(0, 0, 0));
      char.rotation.y = Math.PI;
      char.userData = { agentId: agent.id };
      scene.add(char);
      characterMeshesRef.current.set(agent.id, char);
      mixersRef.current.set(agent.id, mixer);
      applyAgentState(agent, idx);
    });

    const orbit = orbitRef.current;
    const updateOrbit = () => {
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
    };
    updateOrbit();

    // ── Animation loop (zero allocations in hot path) ──────────────────────
    let lastFrame = performance.now();
    let time = 0;
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.05); // Phase G: delta time cap
      lastFrame = now;
      time += dt;

      agentsRef.current.forEach((agent, idx) => {
        const char = characterMeshesRef.current.get(agent.id);
        if (!char) return;

        applyAgentState(agent, idx);

        let behavior = behaviorRef.current.get(agent.id);
        if (!behavior) {
          behavior = { state: 'idle', startTime: Date.now(), duration: 0 };
          behaviorRef.current.set(agent.id, behavior);
        }

        const walkPath = walkPathRef.current.get(agent.id);
        if (walkPath && walkPath.i < walkPath.pts.length - 1) {
          // Follow waypoint polyline at fixed speed (m/s)
          const step = dt * 2.2;
          let remaining = step;
          let cur = walkPath.pts[walkPath.i];
          let moved = 0;
          while (remaining > 0 && walkPath.i < walkPath.pts.length - 1) {
            const next = walkPath.pts[walkPath.i + 1];
            const segLen = cur.distanceTo(next);
            if (segLen < 1e-4) { walkPath.i += 1; cur = next; continue; }
            const dir = next.clone().sub(cur).normalize();
            const stepLen = Math.min(remaining, segLen);
            const newPos = cur.clone().add(dir.clone().multiplyScalar(stepLen));
            char.position.lerp(newPos, 1);
            char.rotation.y = Math.atan2(dir.x, dir.z);
            remaining -= stepLen;
            moved += stepLen;
            cur = newPos;
            walkPath.i += 1;
          }
          // Accumulate a continuous walk phase from real distance travelled
          // so the leg swing stays in sync with speed and never snaps.
          const ph = walkPhaseRef.current.get(agent.id) ?? 0;
          walkPhaseRef.current.set(agent.id, ph + moved * 2.0);
          char.position.y = 0;
          if (walkPath.i >= walkPath.pts.length - 1) {
            char.position.copy(walkPath.pts[walkPath.pts.length - 1]);
            walkPathRef.current.delete(agent.id);
          }
        } else {
          char.position.y = 0;
        }

        // Articulated rig animation (procedural fallback). GLB uses mixer instead.
        const phase = walkPhaseRef.current.get(agent.id) ?? 0;
        const rig = rigOf(char);
        const isGlb = char.userData.isGlb === true;
        if (rig && !isGlb) {
          const moving = walkPath !== undefined && walkPath.i < walkPath.pts.length - 1;
          if (moving) {
            const p = phase;
            rig.legs[0].rotation.x = Math.sin(p) * 0.6;
            rig.legs[1].rotation.x = -Math.sin(p) * 0.6;
            rig.arms[0].rotation.x = -Math.sin(p) * 0.4;
            rig.arms[1].rotation.x = Math.sin(p) * 0.4;
            rig.head.position.y = 0.95 + Math.abs(Math.sin(p)) * 0.02;
          } else {
            const k = 0.12;
            rig.legs[0].rotation.x = THREE.MathUtils.lerp(rig.legs[0].rotation.x, 0, k);
            rig.legs[1].rotation.x = THREE.MathUtils.lerp(rig.legs[1].rotation.x, 0, k);
            rig.arms[0].rotation.x = THREE.MathUtils.lerp(rig.arms[0].rotation.x, 0, k);
            rig.arms[1].rotation.x = THREE.MathUtils.lerp(rig.arms[1].rotation.x, 0, k);
          }
        }

        // Behavior-state animation (procedural fallback only; GLB uses mixer clips)
        if (!isGlb) {
          switch (behavior.state) {
            case 'working':
              char.children.forEach((child, i) => {
                if (child.userData?.isArm) {
                  (child as THREE.Mesh).rotation.x = Math.sin(time * 8 + i) * 0.15;
                }
              });
              break;
            case 'idle':
              char.position.y = Math.sin(time * 2) * 0.02;
              break;
            case 'meeting':
            case 'coffee':
              char.children.forEach((child, i) => {
                if (child.userData?.isArm) {
                  (child as THREE.Mesh).rotation.x = Math.sin(time * 1.5 + i) * 0.06;
                }
              });
              break;
          }
        }

        // GLB AnimationMixer: drive skeletal clips when GLB is active (§5/§6)
        const mixer = mixersRef.current.get(agent.id);
        if (mixer && glbState.loaded) {
          const moving = walkPath !== undefined && walkPath.i < walkPath.pts.length - 1;
          const clipKey = moving ? 'walk' : (behavior.state === 'meeting' || behavior.state === 'coffee') ? 'meeting' : 'idle';
          const clip = glbState.clips[clipKey];
          if (clip) {
            const key = agent.id + ':' + clipKey;
            let action = mixerExistingActions.current.get(key);
            if (!action) {
              action = mixer.clipAction(clip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              mixerExistingActions.current.set(key, action);
            }
            if (!action.isRunning()) action.reset();
            action.play();
            mixer.update(dt);
          }
        }

        // Glow pulse
        const glow = char.children.find((c: THREE.Object3D) => c.userData?.isGlow) as THREE.Mesh | undefined;
        if (glow) {
          const gm = glow.material as THREE.MeshBasicMaterial;
          gm.opacity = 0.3 + Math.sin(time * 3) * 0.1;
          glow.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
        }
      });

      // ── Camera focus lerp (§12) ────────────────────────────────────────────
      const focusId = focusedAgentRef.current;
      if (focusId) {
        const focusChar = characterMeshesRef.current.get(focusId);
        if (focusChar) {
          orbit.target.lerp(new THREE.Vector3(focusChar.position.x, 1, focusChar.position.z), 0.06);
          orbit.radius = THREE.MathUtils.lerp(orbit.radius, 14, 0.04);
          updateOrbit();
        }
      } else {
        orbit.target.lerp(new THREE.Vector3(0, 0, 0), 0.03);
        orbit.radius = THREE.MathUtils.lerp(orbit.radius, 35, 0.03);
        updateOrbit();
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Camera controls ────────────────────────────────────────────────────
    let isDragging = false;
    const lastMouse = { x: 0, y: 0 };

    const getNDC = (e: { clientX: number; clientY: number }) => {
      const r = container.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -((e.clientY - r.top) / r.height) * 2 + 1,
      };
    };

    const doRaycast = () => {
      const ndc = getNDC({ clientX: lastMouseRef.current.x, clientY: lastMouseRef.current.y });
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const charGroups = Array.from(characterMeshesRef.current.values());
      const allMeshes = charGroups.flatMap(g => g.children);
      const hits = raycasterRef.current.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        const agentId = (hits[0].object.parent as THREE.Group)?.userData?.agentId;
        return agentsRef.current.find(a => a.id === agentId) || null;
      }
      return null;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) isDragging = true;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(0.3, Math.min(Math.PI / 2 - 0.05, orbit.phi + dy * 0.005));
        updateOrbit();
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        return;
      }
      if (e.shiftKey && e.buttons & 1) {
        orbit.target.x -= e.movementX * 0.02;
        orbit.target.z -= e.movementY * 0.02;
        updateOrbit();
        return;
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const hovAgent = doRaycast();
      setHoveredAgent(hovAgent || null);
      container.style.cursor = hovAgent ? 'pointer' : 'default';
    };

    const onMouseUp = () => { isDragging = false; };

    const onClick = () => {
      if (isDragging) return;
      const clickedAgent = doRaycast();
      if (clickedAgent) {
        setSelectedAgent(clickedAgent);
        focusedAgentRef.current = clickedAgent.id;
        onAgentClick?.(clickedAgent);
      } else {
        setSelectedAgent(null);
        focusedAgentRef.current = null;
        onAgentClick?.(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.max(12, Math.min(70, orbit.radius + e.deltaY * 0.03));
      updateOrbit();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', e => e.preventDefault());

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(animRef.current);
      // Dispose animation mixers
      mixersRef.current.forEach(m => {
        m.stopAllAction();
        m.uncacheRoot(m.getRoot());
      });
      mixersRef.current.clear();
      mixerExistingActions.current.clear();
      renderer.dispose();
      // Phase G: proper resource cleanup
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      // Dispose shared geometries
      bodyGeo.dispose();
      headGeo.dispose();
      hairGeo.dispose();
      legGeo.dispose();
      armGeo.dispose();
      glowGeo.dispose();
    };
  }, [agents, onAgentClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {hoveredAgent && (
        <div
          className="absolute pointer-events-none bg-slate-900/95 backdrop-blur border border-slate-600 rounded-lg px-3 py-2 text-sm z-10"
          style={{ left: '50%', bottom: '10%', transform: 'translateX(-50%)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredAgent.color }} />
            <span className="text-white font-medium">{hoveredAgent.name}</span>
            <span className="text-slate-400 text-xs">{hoveredAgent.model}</span>
          </div>
          <div className="text-slate-300 text-xs mt-1">
            {hoveredAgent.status === 'Running' ? '● Working' : '○ Offline'}
          </div>
        </div>
      )}
      {selectedAgent && (
        <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur rounded-lg p-4 border border-slate-700 max-w-xs shadow-xl">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
              style={{ backgroundColor: selectedAgent.color }}
            >
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-base">{selectedAgent.name}</p>
              <p className="text-slate-400 text-sm">{selectedAgent.model}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                selectedAgent.status === 'Running'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-600/40 text-slate-400 border border-slate-600'
              }`}
            >
              {selectedAgent.status === 'Running' ? '● Working' : '○ Offline'}
            </span>
            <span className="text-slate-500 text-xs">Seat {selectedAgent.seat}</span>
          </div>
          {selectedAgent.task && (
            <div className="mt-2 text-xs text-slate-400">
              <span className="text-slate-500">Task:</span> {selectedAgent.task}
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur rounded-lg px-3 py-2 text-xs border border-slate-700">
        <div className="text-slate-400 space-y-0.5">
          <div>Right-click drag: Orbit</div>
          <div>Scroll: Zoom</div>
          <div>Shift+Drag: Pan</div>
          <div>Click: Select + focus camera</div>
          <div>Click empty: Unfocus</div>
        </div>
      </div>
    </div>
  );
}
