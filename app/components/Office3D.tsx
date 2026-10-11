'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
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
}

interface Props {
  agents: AgentStation[];
  onAgentClick?: (agent: AgentStation) => void;
}

function createCharacter(color: string, active: boolean): THREE.Group {
  const grp = new THREE.Group();
  const skinColor = active ? 0xf4c7a8 : 0x9ca3af;
  const bodyColor = active ? new THREE.Color(color) : 0x475569;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.25),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  body.userData.isBody = true;
  grp.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 })
  );
  head.position.y = 0.95;
  head.castShadow = true;
  grp.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2c2c2c })
  );
  hair.position.y = 1.0;
  grp.add(hair);

  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
  [-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.2, 0);
    leg.castShadow = true;
    grp.add(leg);
  });

  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4);
  [-0.25, 0.25].forEach(x => {
    const arm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: bodyColor }));
    arm.position.set(x, 0.55, 0);
    arm.castShadow = true;
    arm.userData.isArm = true;
    grp.add(arm);
  });

  if (active) {
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.3, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    glow.position.y = 0.05;
    glow.rotation.x = -Math.PI / 2;
    glow.userData.isGlow = true;
    grp.add(glow);
  }

  return grp;
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
  const behaviorRef = useRef<Map<string, { state: string; startTime: number; duration: number }>>(new Map());
  const walkPathRef = useRef<Map<string, { pts: THREE.Vector3[]; i: number }>>(new Map());
  const lastSigRef = useRef<Map<string, string>>(new Map());
  const pathfinderRef = useRef<Pathfinder | null>(null);
  const seatsRef = useRef<OfficeSeat[]>([]);

  agentsRef.current = agents;

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
      const room = (agent.room || 'Workspace').toLowerCase();
      if (room === 'meeting') {
        return { state: 'meeting', end: env.meetingSeats[idx % env.meetingSeats.length].clone() };
      }
      if (room === 'lounge' || room === 'coffee') {
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
      const char = createCharacter(agent.color, agent.status === 'Running');
      char.position.copy(seat ? seat.chair : new THREE.Vector3(0, 0, 0));
      char.rotation.y = Math.PI;
      char.userData = { agentId: agent.id };
      scene.add(char);
      characterMeshesRef.current.set(agent.id, char);
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
          const step = dt * 2.2; // metres per frame
          let remaining = step;
          let cur = walkPath.pts[walkPath.i];
          while (remaining > 0 && walkPath.i < walkPath.pts.length - 1) {
            const next = walkPath.pts[walkPath.i + 1];
            const segLen = cur.distanceTo(next);
            if (segLen < 1e-4) { walkPath.i += 1; cur = next; continue; }
            const along = next.clone().sub(cur).normalize().multiplyScalar(Math.min(remaining, segLen));
            const newPos = cur.clone().add(along);
            char.position.lerp(newPos, 1);
            char.position.y = Math.abs(Math.sin(time * 10)) * 0.05;
            char.rotation.y = Math.atan2(along.x, along.z);
            remaining -= segLen;
            walkPath.i += 1;
            cur = next;
          }
          if (walkPath.i >= walkPath.pts.length - 1) {
            char.position.copy(walkPath.pts[walkPath.pts.length - 1]);
            walkPathRef.current.delete(agent.id);
          }
        } else {
          char.position.y = 0;
        }

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
            // Seated at the table / lounge — relaxed, occasional arm motion.
            char.children.forEach((child, i) => {
              if (child.userData?.isArm) {
                (child as THREE.Mesh).rotation.x = Math.sin(time * 1.5 + i) * 0.06;
              }
            });
            break;
        }

        const glow = char.children.find((c: THREE.Object3D) => c.userData?.isGlow) as THREE.Mesh | undefined;
        if (glow) {
          const gm = glow.material as THREE.MeshBasicMaterial;
          gm.opacity = 0.3 + Math.sin(time * 3) * 0.1;
          glow.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
        }
      });

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
        onAgentClick?.(clickedAgent);
      } else {
        setSelectedAgent(null);
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
          <div>Click: Select agent</div>
        </div>
      </div>
    </div>
  );
}


