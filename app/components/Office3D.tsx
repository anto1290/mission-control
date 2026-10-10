'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';

interface AgentStation {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped';
  seat: number;
  color: string;
  room?: string;
}

interface Props {
  agents: AgentStation[];
  onAgentClick?: (agent: AgentStation) => void;
}

const ZONE_COLORS = [0x3b82f6, 0x8b5cf6, 0x10b981, 0xf59e0b, 0xef4444, 0x6366f1];

const ZONES = [
  { name: 'R&D', x: -8, z: -7, w: 7, d: 6 },
  { name: 'Product', x: 1, z: -7, w: 7, d: 6 },
  { name: 'Design', x: -8, z: 1, w: 7, d: 6 },
  { name: 'Marketing', x: 1, z: 1, w: 7, d: 6 },
  { name: 'Ops', x: -8, z: 9, w: 7, d: 6 },
  { name: 'Mgmt', x: 1, z: 9, w: 7, d: 6 },
];

function getAgentPos(index: number) {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const zone = ZONES[row % ZONES.length];
  return {
    x: zone.x + zone.w / 2 + (col - 1) * 2.2,
    z: zone.z + zone.d / 2 + ((row % 3) - 1) * 2.0,
    zoneIndex: row % ZONES.length,
  };
}

export default function Office3D({ agents, onAgentClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentStation | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<AgentStation | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const agentsRef = useRef(agents);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.5, radius: 30, target: new THREE.Vector3(0, 0, 1) });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const agentMeshesRef = useRef<THREE.Mesh[]>([]);
  const zoneMeshesRef = useRef<THREE.Mesh[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  agentsRef.current = agents;

  const zoneAgents = useMemo(() => {
    const map: Record<number, AgentStation[]> = {};
    agents.forEach((a, i) => {
      const zIdx = Math.floor(i / 3) % ZONES.length;
      (map[zIdx] = map[zIdx] || []).push(a);
    });
    return map;
  }, [agents]);

  const updateCamera = useCallback(() => {
    const { theta, phi, radius, target } = orbitRef.current;
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta)
    );
    cam.lookAt(target);
  }, []);

  useEffect(() => { updateCamera(); }, [updateCamera]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090e19);
    scene.fog = new THREE.Fog(0x090e19, 40, 80);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 200);
    camera.position.set(22, 22, 22);
    camera.lookAt(0, 0, 1);
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
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0x8899bb, 0.4));
    scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.3));
    const dirLight = new THREE.DirectionalLight(0xfff4e6, 0.9);
    dirLight.position.set(15, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);
    const fill = new THREE.DirectionalLight(0x6366f1, 0.15);
    fill.position.set(-10, 10, -10);
    scene.add(fill);
    ZONES.forEach((z) => {
      const idx = ZONES.indexOf(z);
      const pl = new THREE.PointLight(ZONE_COLORS[idx], 0.3, 14);
      pl.position.set(z.x + z.w / 2, 3, z.z + z.d / 2);
      scene.add(pl);
    });

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111b2b, roughness: 0.85, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x0f172a);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    scene.add(grid);

    // Zone floors & borders
    const zoneMeshes: THREE.Mesh[] = [];
    ZONES.forEach((zone, i) => {
      const zf = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.w, zone.d),
        new THREE.MeshStandardMaterial({ color: ZONE_COLORS[i], transparent: true, opacity: 0.06, roughness: 1 })
      );
      zf.rotation.x = -Math.PI / 2;
      zf.position.set(zone.x + zone.w / 2, 0.02, zone.z + zone.d / 2);
      zf.receiveShadow = true;
      zf.userData = { isZone: true, zoneIndex: i };
      zoneMeshes.push(zf);
      scene.add(zf);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(zone.w, 0.05, zone.d)),
        new THREE.LineBasicMaterial({ color: ZONE_COLORS[i], transparent: true, opacity: 0.2 })
      );
      edges.position.set(zone.x + zone.w / 2, 0.03, zone.z + zone.d / 2);
      scene.add(edges);
    });
    zoneMeshesRef.current = zoneMeshes;

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const bw = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 0.2), wallMat);
    bw.position.set(0, 5, -20.1);
    bw.receiveShadow = true;
    scene.add(bw);
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 40), wallMat);
    lw.position.set(-30.1, 5, 0);
    lw.receiveShadow = true;
    scene.add(lw);

    // Build workstations
    const agentMeshes: THREE.Mesh[] = [];
    agents.forEach((agent, idx) => {
      const { x, z } = getAgentPos(idx);
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);

      // Desk top
      const dt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.1 }));
      dt.position.y = 0.76; dt.castShadow = true; dt.receiveShadow = true;
      grp.add(dt);
      // Edge trim
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.04, 1.52), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.3 }));
      edge.position.y = 0.82;
      grp.add(edge);
      // Legs
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.76);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
      [[-1.2, 0.38, -0.65], [1.2, 0.38, -0.65], [-1.2, 0.38, 0.65], [1.2, 0.38, 0.65]].forEach((p: [number, number, number]) => {
        const l = new THREE.Mesh(legGeo, legMat); l.position.set(p[0], p[1], p[2]); l.castShadow = true;
        grp.add(l);
      });
      // Monitor bezel
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.4 }));
      bezel.position.set(0, 1.55, -0.55); bezel.castShadow = true;
      grp.add(bezel);
      // Screen glow
      const isRunning = agent.status === 'Running';
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.83), new THREE.MeshBasicMaterial({ color: isRunning ? 0x34d399 : 0x475569, transparent: true, opacity: isRunning ? 0.35 : 0.15 }));
      screen.position.set(0, 1.55, -0.51);
      grp.add(screen);
      // Monitor stand
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 }));
      stand.position.set(0, 0.91, -0.55); stand.castShadow = true;
      grp.add(stand);
      // Keyboard
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.28), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
      kb.position.set(0, 0.83, 0.15);
      grp.add(kb);
      // Chair
      const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
      cSeat.position.set(0, 0.5, 0.7); cSeat.castShadow = true;
      grp.add(cSeat);
      const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
      cBack.position.set(0, 0.88, 1.0); cBack.castShadow = true;
      grp.add(cBack);
      const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), legMat);
      cLeg.position.set(0, 0.25, 0.7);
      grp.add(cLeg);

      // Agent orb
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 24, 24),
        new THREE.MeshStandardMaterial({ color: isRunning ? 0x34d399 : 0x64748b, emissive: isRunning ? 0x34d399 : 0x000000, emissiveIntensity: isRunning ? 0.8 : 0, roughness: 0.2, metalness: 0.6 })
      );
      orb.position.set(0, 2.1, 0);
      orb.userData = { isAgent: true, agentId: agent.id };
      grp.add(orb);
      agentMeshes.push(orb);

      // Ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.025, 8, 32),
        new THREE.MeshBasicMaterial({ color: isRunning ? 0x34d399 : 0x475569, transparent: true, opacity: 0.5 })
      );
      ring.position.set(0, 2.1, 0);
      grp.add(ring);

      // Move orb + ring to floating position above desk
      orb.position.set(x, 2.5, z);
      ring.position.set(x, 2.5, z);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      scene.add(grp);
    });
    agentMeshesRef.current = agentMeshes;

    // Windows
    const wm = new THREE.MeshStandardMaterial({ color: 0x87ceeb, emissive: 0x87ceeb, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), wm);
      win.position.set(-15 + i * 5, 3, -18);
      scene.add(win);
    }

    // Animation
    let time = 0;

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      time += 0.016;

      // Float orbs + rotate rings
      agents.forEach((_, i) => {
        const orb = agentMeshes[i];
        if (!orb) return;
        orb.position.y = 2.5 + Math.sin(time * 2 + i) * 0.1;
        const ring = orb.parent?.children.find((c: any) => (c as THREE.Mesh).geometry?.type === 'TorusGeometry') as THREE.Mesh | undefined;
        if (ring) {
          ring.position.y = orb.position.y;
          ring.rotation.z = time * 0.8;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Camera orbit state
    const orbit = { theta: Math.PI / 4, phi: Math.PI / 3.5, radius: 30, target: new THREE.Vector3(0, 0, 1) };
    const isDragging = { current: false };
    const lastMouse = { x: 0, y: 0 };
    let shiftDown = false;

    const updateOrbit = () => {
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
    };

    const getNDC = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -((e.clientY - r.top) / r.height) * 2 + 1
      };
    };

    const doRaycast = () => {
      const ndc = getNDC({ clientX: lastMouseRef.current.x, clientY: lastMouseRef.current.y } as MouseEvent);
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hits = raycasterRef.current.intersectObjects(agentMeshes, false);
      if (hits.length > 0) {
        const a = agentsRef.current.find(ag => ag.id === (hits[0].object as THREE.Mesh).userData.agentId);
        if (a) return { agent: a as AgentStation, zone: null as number | null };
      }
      const zoneHits = raycasterRef.current.intersectObjects(zoneMeshesRef.current, false);
      if (zoneHits.length > 0) {
        return { agent: null as AgentStation | null, zone: (zoneHits[0].object as THREE.Mesh).userData.zoneIndex as number };
      }
      return { agent: null as AgentStation | null, zone: null as number | null };
    };

    // Right-click drag → orbit
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) {
        isDragging.current = true;
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        return;
      }
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      lastMouseRef.current.x = e.clientX;
      lastMouseRef.current.y = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(0.3, Math.min(Math.PI / 2 - 0.05, orbit.phi + dy * 0.005));
        updateOrbit();
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        return;
      }
      // Shift+drag pan
      if (e.shiftKey && (e.buttons & 1)) {
        orbit.target.x -= e.movementX * 0.02;
        orbit.target.z -= e.movementY * 0.02;
        updateOrbit();
        return;
      }
      // Hover raycast
      const { agent: hovAgent, zone: hovZone } = doRaycast();
      setHoveredAgent(hovAgent || null);
      container.style.cursor = (hovAgent || hovZone !== null) ? 'pointer' : 'default';
    };

    const onMouseUp = () => { isDragging.current = false; };

    // Click → select agent or zone
    const onClick = (e: MouseEvent) => {
      if (isDragging.current) return;
      const { agent: clickedAgent, zone: clickedZone } = doRaycast();
      if (clickedAgent) {
        setSelectedAgent(clickedAgent);
        setSelectedZone(null);
        onAgentClick?.(clickedAgent);
      } else if (clickedZone !== null) {
        setSelectedZone(clickedZone);
        setSelectedAgent(null);
      } else {
        setSelectedAgent(null);
        setSelectedZone(null);
      }
    };

    // Wheel → zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.max(12, Math.min(60, orbit.radius + e.deltaY * 0.03));
      updateOrbit();
    };

    // Shift key tracking for pan hint
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftDown = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftDown = false; };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', (e: Event) => e.preventDefault());
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
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
        <div className="absolute pointer-events-none bg-slate-900/95 backdrop-blur border border-slate-600 rounded-lg px-3 py-2 text-sm z-10" style={{ left: '50%', bottom: '10%', transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredAgent.color }} />
            <span className="text-white font-medium">{hoveredAgent.name}</span>
            <span className="text-slate-400 text-xs">{hoveredAgent.model}</span>
          </div>
          <div className="text-slate-300 text-xs mt-1">{hoveredAgent.status === 'Running' ? '🟢 运行中' : '⚪ 已停止'}</div>
        </div>
      )}
      {!hoveredAgent && (
        <div className="absolute pointer-events-none bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg px-3 py-1.5 text-xs z-10" style={{ left: '50%', bottom: '4%', transform: 'translateX(-50%)' }}>
          <span className="text-slate-400">Click a zone floor for details</span>
        </div>
      )}
      {selectedAgent && (
        <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur rounded-lg p-4 border border-slate-700 max-w-xs shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg" style={{ backgroundColor: selectedAgent.color }}>
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-base">{selectedAgent.name}</p>
              <p className="text-slate-400 text-sm">{selectedAgent.model}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${selectedAgent.status === 'Running' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-600/40 text-slate-400 border border-slate-600'}`}>
              {selectedAgent.status === 'Running' ? '● 运行中' : '○ 已停止'}
            </span>
            <span className="text-slate-500 text-xs">工位 {selectedAgent.seat}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">点击空白处关闭</div>
        </div>
      )}
      {selectedZone !== null && (
        <div className="absolute bottom-4 right-4 bg-slate-900/95 backdrop-blur rounded-lg p-4 border border-slate-700 w-64 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `#${ZONE_COLORS[selectedZone].toString(16).padStart(6, '0')}` }} />
            <p className="text-white font-semibold text-sm">{ZONES[selectedZone].name} Zone</p>
            <button onClick={() => setSelectedZone(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>
          <div className="flex gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
              {(zoneAgents[selectedZone] || []).length} Agents
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${(zoneAgents[selectedZone] || []).filter(a => a.status === 'Running').length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              {(zoneAgents[selectedZone] || []).filter(a => a.status === 'Running').length} Active
            </span>
          </div>
          <div className="space-y-1">
            {(zoneAgents[selectedZone] || []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${a.status === 'Running' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <span className="text-slate-300">{a.name}</span>
                <span className="ml-auto text-slate-500">{a.model}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
