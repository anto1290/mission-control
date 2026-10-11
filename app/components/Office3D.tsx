'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

function createCharacter(color: string, active: boolean): THREE.Group {
  const g = getGeo();
  const root = new THREE.Group();
  const skinColor = active ? 0xf4c7a8 : 0x9ca3af;
  const bodyColor = active ? new THREE.Color(color) : 0x475569;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

  const attach = (parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number, pivotX = 0, pivotY = 0, pivotZ = 0) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    mesh.position.set(pivotX, pivotY, pivotZ);
    pivot.add(mesh);
    parent.add(pivot);
    return pivot;
  };

  const legs: THREE.Group[] = [];
  [-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(g.leg, legMat);
    leg.castShadow = true;
    legs.push(attach(root, leg, x, 0.4, 0, 0, -0.2, 0));
  });

  const body = new THREE.Mesh(g.body, bodyMat);
  body.castShadow = true;
  root.add(body);
  body.position.y = 0.55;
  root.userData.isBody = true;

  const arms: THREE.Group[] = [];
  [-0.25, 0.25].forEach(x => {
    const arm = new THREE.Mesh(g.arm, bodyMat.clone());
    arm.castShadow = true;
    arms.push(attach(root, arm, x, 0.8, 0, 0, -0.2, 0));
  });

  const head = new THREE.Mesh(g.head, skinMat);
  head.castShadow = true;
  root.add(head);
  head.position.y = 0.95;

  const hair = new THREE.Mesh(g.hair, hairMat);
  root.add(hair);
  hair.position.y = 1.0;

  let glow: THREE.Mesh | undefined;
  if (active) {
    glow = new THREE.Mesh(
      g.ring,
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    glow.position.y = 0.05;
    glow.rotation.x = -Math.PI / 2;
    root.add(glow);
    root.userData.isGlow = true;
  }

  // Expose the rig through userData so the per-frame animator can reach it
  // without a separate registry (keeps the existing per-character lookup).
  root.userData.rig = { root, legs, arms, head, glow, bodyMat };
  return root;
}

function rigOf(char: THREE.Group): RiggedCharacter | undefined {
  return char.userData.rig as RiggedCharacter | undefined;
}

// ─── GLB rigged character (docs §5/§6) ───────────────────────────────────────
// ponytail: procedural rig is the fallback; GLB upgrades animation quality
// when a compatible asset is available. RobotExpressv2.glb is a CC0 asset
// from the three.js examples repo with Idle/Run/Dance clips.
const GLB_URL = 'https://threejs.org/examples/models/gltf/RobotExpressv2/RobotExpressv2.glb';

interface GlbState {
  loaded: boolean;
  gltfScene: THREE.Group | null;
  clips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; meeting?: THREE.AnimationClip };
}
const glbState: GlbState = { loaded: false, gltfScene: null, clips: {} };

async function loadGlbCharacter(): Promise<boolean> {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(GLB_URL);
    const clips = gltf.animations;
    if (clips.length === 0) return false;
    gltfScene = gltf.scene;
    clips.forEach((c, i) => {
      const name = c.name.toLowerCase();
      if (name.includes('idle') || name === 'robot express') glbState.clips.idle = c;
      else if (name.includes('run') || name.includes('walk') || i === 1) glbState.clips.walk = c;
      else glbState.clips.meeting = c;
    });
    if (!glbState.clips.idle && clips[0]) glbState.clips.idle = clips[0];
    if (!glbState.clips.walk && clips[1]) glbState.clips.walk = clips[1];
    glbState.loaded = true;
    return true;
  } catch {
    return false;
  }
}

let gltfScene: THREE.Group | null = null;

function createGlbCharacter(color: string, active: boolean): { group: THREE.Group; mixer: THREE.AnimationMixer; isGlb: boolean } {
  if (glbState.loaded && glbState.gltfScene) {
    const group = new THREE.Group();
    const mesh = glbState.gltfScene.clone(true);
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
    group.add(mesh);
    const mixer = new THREE.AnimationMixer(group);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const env = buildOfficeEnvironment(scene);
    seatsRef.current = env.seats;

    // Resolve the destination a real agent field should send a character to.
    // Deterministic from data (status + room + task), no randomness: movement
    // only happens when the underlying agent state actually changes.
    const resolveTarget = (agent: AgentStation, idx: number): { state: string; end: THREE.Vector3 } => {
      const home = (seatsRef.current[idx] || seatsRef.current[0])?.approach ?? new THREE.Vector3(0, 0, 0);
      if (agent.status === 'Stopped') {
        // Offline: sit back at their desk, no activity.
        return { state: 'idle', end: home };
      }
      const room = (agent.reason === 'scheduled' || agent.room === 'meeting' || agent.room?.toLowerCase() === 'meeting')
        ? 'meeting'
        : (agent.reason === 'idle' || agent.room === 'lounge' || agent.room?.toLowerCase() === 'lounge' || agent.room?.toLowerCase() === 'coffee')
          ? 'lounge'
          : 'workspace';
      if (room === 'meeting') {
        return { state: 'meeting', end: env.meetingSeats[idx % env.meetingSeats.length].clone() };
      }
      if (room === 'lounge') {
        return { state: 'coffee', end: env.loungeCenter.clone() };
      }
      // Workspace (or running with no room signal): work at their desk.
      return { state: 'working', end: home };
    };

    // Lazy-init the pathfinder once (static layout → build the grid a single
    // time; A* is cached inside Pathfinder, so per-agent calls are cheap).
    if (!pathfinderRef.current) pathfinderRef.current = createOfficePathfinder();
    const pathfinder = pathfinderRef.current;

    const applyAgentState = (agent: AgentStation, idx: number) => {
      const char = characterMeshesRef.current.get(agent.id);
      if (!char) return;
      const sig = `${agent.status}|${agent.room || ''}|${agent.taskStatus || ''}|${agent.task || ''}`;
      const prevSig = lastSigRef.current.get(agent.id);
      const { state, end } = resolveTarget(agent, idx);
      behaviorRef.current.set(agent.id, { state, startTime: Date.now(), duration: 0 });
      // Only walk when the data-driven target actually changed; otherwise the
      // character stays put (explicit-transition requirement, no drift).
      if (prevSig !== sig && !walkPathRef.current.has(agent.id)) {
        // Phase D: walk a real obstacle-avoiding path, not a straight line.
        const pts = pathfinder.findPath(char.position.clone(), end);
        walkPathRef.current.set(agent.id, { pts, i: 0 });
      }
      lastSigRef.current.set(agent.id, sig);
    };

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
    // ── Animation loop (frame-delta time) ──
    let lastFrame = performance.now();
    let time = 0;
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      time += dt;

      agentsRef.current.forEach((agent, idx) => {
        const char = characterMeshesRef.current.get(agent.id);
        if (!char) return;

        // Data-driven transition: recompute target from the live agent fields.
        // Walk only when the signature (status/room/task) changed since the
        // last applied state. No random wandering, no timer-based hops.
        applyAgentState(agent, idx);

        let behavior = behaviorRef.current.get(agent.id);
        if (!behavior) {
          behavior = { state: 'idle', startTime: Date.now(), duration: 0 };
          behaviorRef.current.set(agent.id, behavior);
        }

        const walkPath = walkPathRef.current.get(agent.id);
        if (walkPath && walkPath.i < walkPath.pts.length - 1) {
          // Follow the waypoint polyline: advance toward the next node at a
          // fixed speed (m/s), then the next, until the final node.
          const speed = 2.2; // metres per second
          let remaining = speed * dt;
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

        // Articulated rig animation. Drives the joint pivots (legs/arms)
        // with a phase-based walk swing, seated typing, meeting gestures,
        // and a subtle idle sway. No snapping; blends by walking phase.
        const phase = walkPhaseRef.current.get(agent.id) ?? 0;
        const rig = rigOf(char);
        if (rig) {
          // Forward (+Z) is travel direction; rotate the rig's local facing
          // to match the group's world yaw. The group already points travel;
          // we just offset the body so it reads as "facing the desk/camera".
          const moving = walkPath.i < walkPath.pts.length - 1;
          if (moving) {
            const p = phase;
            rig.legs[0].rotation.x = Math.sin(p) * 0.6;
            rig.legs[1].rotation.x = -Math.sin(p) * 0.6;
            rig.arms[0].rotation.x = -Math.sin(p) * 0.4;
            rig.arms[1].rotation.x = Math.sin(p) * 0.4;
            // Subtle head bob to sell the gait.
            rig.head.position.y = 0.95 + Math.abs(Math.sin(p)) * 0.02;
          } else {
            // Ease joints back to neutral when the character is stationary.
            const k = 0.12;
            rig.legs[0].rotation.x = THREE.MathUtils.lerp(rig.legs[0].rotation.x, 0, k);
            rig.legs[1].rotation.x = THREE.MathUtils.lerp(rig.legs[1].rotation.x, 0, k);
            rig.arms[0].rotation.x = THREE.MathUtils.lerp(rig.arms[0].rotation.x, 0, k);
            rig.arms[1].rotation.x = THREE.MathUtils.lerp(rig.arms[1].rotation.x, 0, k);
          }

          switch (behavior.state) {
            case 'working':
              // Seated typing: forearms tap toward the desk.
              rig.arms[0].rotation.x = -1.2 + Math.sin(time * 9) * 0.06;
              rig.arms[1].rotation.x = -1.2 + Math.sin(time * 9 + 1.4) * 0.06;
              break;
            case 'idle':
              // Standing, breathing sway.
              rig.arms[0].rotation.x = Math.sin(time * 1.5) * 0.05;
              rig.arms[1].rotation.x = -Math.sin(time * 1.5) * 0.05;
              rig.head.rotation.y = Math.sin(time * 0.5) * 0.1;
              break;
            case 'meeting':
            case 'coffee':
              // Seated: relaxed arms, occasional nod/talk gesture.
              rig.arms[0].rotation.x = -0.5 + Math.sin(time * 1.2) * 0.05;
              rig.arms[1].rotation.x = -0.5 + Math.cos(time * 1.2) * 0.05;
              rig.head.rotation.x = Math.sin(time * 2.5) * 0.08;
              break;
          }

          const glow = rig.glow;
          if (glow) {
            const gm = glow.material as THREE.MeshBasicMaterial;
            gm.opacity = 0.3 + Math.sin(time * 3) * 0.1;
            glow.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
          }
        }

        // GLB AnimationMixer: drive skeletal clips when GLB is active.
        // ponytail: only one action at a time (idle/walk/meeting); upgrade
        // to ActionState blending with cross-fade when a production asset
        // with more clips is available.
        const mixer = mixersRef.current.get(agent.id);
        if (mixer && glbState.loaded) {
          const moving = walkPath && walkPath.i < walkPath.pts.length - 1;
          let actionName: string;
          if (moving) actionName = 'walk';
          else if (behavior.state === 'meeting' || behavior.state === 'coffee') actionName = 'meeting';
          else actionName = 'idle';
          const clip = glbState.clips[actionName as keyof typeof glbState.clips];
          if (clip) {
            // Create an action on first use per clip; reuse thereafter.
            let action = mixerExistingActions.current.get(agent.id + ':' + actionName);
            if (!action) {
              action = mixer.clipAction(clip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              mixerExistingActions.current.set(agent.id + ':' + actionName, action);
            }
            if (!action.isRunning()) {
              action.reset();
            }
            action.play();
            mixer.update(dt);
          }
        }
      });

      // ── Camera focus lerp (§12): when an agent is focused, ease the orbit
      // target toward that character's position; when unfocused, return to origin.
      const focusId = focusedAgentRef.current;
      if (focusId) {
        const focusChar = characterMeshesRef.current.get(focusId);
        if (focusChar) {
          orbit.target.lerp(new THREE.Vector3(focusChar.position.x, 1, focusChar.position.z), 0.06);
          orbit.radius = THREE.MathUtils.lerp(orbit.radius, 14, 0.04);
        }
      } else {
        orbit.target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
        orbit.radius = THREE.MathUtils.lerp(orbit.radius, 35, 0.03);
      }
      updateOrbit();

      renderer.render(scene, camera);
    };
    animate();

    // ── Camera controls ──
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
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
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


