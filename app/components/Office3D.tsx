'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

const ROOMS = [
  { name: '研发部', x: -10, z: -10, w: 10, d: 8, color: 0x3b82f6 },
  { name: '产品部', x: 2, z: -10, w: 10, d: 8, color: 0x8b5cf6 },
  { name: '设计部', x: -10, z: 0, w: 10, d: 8, color: 0x10b981 },
  { name: '市场部', x: 2, z: 0, w: 10, d: 8, color: 0xf59e0b },
  { name: '运维部', x: -10, z: 10, w: 10, d: 8, color: 0xef4444 },
  { name: '管理层', x: 2, z: 10, w: 10, d: 8, color: 0x6366f1 },
];

interface HoveredAgent {
  agent: AgentStation;
}

export default function Office3D({ agents, onAgentClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentStation | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<HoveredAgent | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const getRoom = useCallback((seat: number) => {
    return ROOMS[seat % ROOMS.length];
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 30, 60);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(25, 25, 25);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    
    const sunLight = new THREE.DirectionalLight(0xfff4e6, 1.0);
    sunLight.position.set(15, 30, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.25);
    fillLight.position.set(-15, 15, -15);
    scene.add(fillLight);

    ROOMS.forEach(room => {
      const pl = new THREE.PointLight(room.color, 0.5, 12);
      pl.position.set(room.x + room.w / 2, 4, room.z + room.d / 2);
      scene.add(pl);
    });

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(50, 50, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Rooms
    ROOMS.forEach(room => {
      const rf = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w, room.d),
        new THREE.MeshStandardMaterial({ color: room.color, transparent: true, opacity: 0.15 })
      );
      rf.rotation.x = -Math.PI / 2;
      rf.position.set(room.x + room.w / 2, 0.02, room.z + room.d / 2);
      scene.add(rf);

      const wm = new THREE.MeshStandardMaterial({ color: room.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      const bw = new THREE.Mesh(new THREE.PlaneGeometry(room.w, 3), wm);
      bw.position.set(room.x + room.w / 2, 1.5, room.z);
      scene.add(bw);

      const lw = new THREE.Mesh(new THREE.PlaneGeometry(room.d, 3), wm);
      lw.rotation.y = Math.PI / 2;
      lw.position.set(room.x, 1.5, room.z + room.d / 2);
      scene.add(lw);

      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#' + room.color.toString(16).padStart(6, '0');
      ctx.textAlign = 'center';
      ctx.fillText(room.name, 128, 42);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 0.75),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
      );
      label.position.set(room.x + room.w / 2, 2.8, room.z + 0.1);
      scene.add(label);
    });

    // Desks & Agents
    const deskSpacing = { x: 4, z: 3.5 };

    agents.forEach((agent, index) => {
      const room = getRoom(agent.seat);
      const col = index % 3;
      const row = Math.floor(index / 3);
      const pos = { x: room.x + 1.5 + col * deskSpacing.x, z: room.z + 1.5 + row * deskSpacing.z };

      const deskGroup = new THREE.Group();
      deskGroup.position.set(pos.x, 0, pos.z);

      // Desk
      const dt = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.08, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 })
      );
      dt.position.y = 0.9; dt.castShadow = true; dt.receiveShadow = true;
      deskGroup.add(dt);

      const lm = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 });
      [[-0.95, 0.45, -0.55], [-0.95, 0.45, 0.55], [0.95, 0.45, -0.55], [0.95, 0.45, 0.55]].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), lm);
        leg.position.set(lx, ly, lz); leg.castShadow = true;
        deskGroup.add(leg);
      });

      // Monitor
      const isRunning = agent.status === 'Running';
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.9, 0.05),
        new THREE.MeshStandardMaterial({
          color: isRunning ? 0x22c55e : 0x334155,
          emissive: isRunning ? 0x22c55e : 0x000000,
          emissiveIntensity: isRunning ? 0.4 : 0,
          roughness: 0.2, metalness: 0.8,
        })
      );
      screen.position.set(0, 1.6, -0.4); screen.castShadow = true;
      deskGroup.add(screen);

      // Keyboard & Mouse
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.25), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      kb.position.set(0, 0.96, 0.15); deskGroup.add(kb);
      const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.18), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      mouse.position.set(0.5, 0.96, 0.15); deskGroup.add(mouse);

      // Chair
      const cm = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), cm);
      seat.position.set(0, 0.55, 1.0); seat.castShadow = true;
      deskGroup.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05), cm);
      back.position.set(0, 0.95, 1.35); back.castShadow = true;
      deskGroup.add(back);

      // Humanoid Agent
      const ag = new THREE.Group();
      const am = new THREE.MeshStandardMaterial({ color: agent.color, roughness: 0.5, metalness: 0.2 });
      
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), am);
      body.position.set(0, 1.5, 0.6); body.castShadow = true; ag.add(body);
      
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 }));
      head.position.set(0, 1.95, 0.6); head.castShadow = true; ag.add(head);
      
      const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4);
      const la = new THREE.Mesh(armGeo, am); la.position.set(-0.28, 1.45, 0.6); la.rotation.z = 0.2; la.castShadow = true; ag.add(la);
      const ra = new THREE.Mesh(armGeo, am); ra.position.set(0.28, 1.45, 0.6); ra.rotation.z = -0.2; ra.castShadow = true; ag.add(ra);
      
      const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5);
      const ll = new THREE.Mesh(legGeo, am); ll.position.set(-0.12, 0.95, 0.6); ll.castShadow = true; ag.add(ll);
      const rl = new THREE.Mesh(legGeo, am); rl.position.set(0.12, 0.95, 0.6); rl.castShadow = true; ag.add(rl);

      // Halo
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.03, 8, 32),
        new THREE.MeshStandardMaterial({
          color: isRunning ? 0x22c55e : 0x64748b,
          emissive: isRunning ? 0x22c55e : 0x000000,
          emissiveIntensity: isRunning ? 0.6 : 0,
        })
      );
      halo.position.set(0, 1.5, 0.6); halo.rotation.x = Math.PI / 2;
      ag.add(halo);

      ag.userData = { agentId: agent.id, isAgent: true };
      deskGroup.add(ag);

      // Decorations
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      cup.position.set(0.8, 0.98, 0.3); deskGroup.add(cup);
      
      if (index % 3 === 0) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.15), new THREE.MeshStandardMaterial({ color: 0x92400e }));
        pot.position.set(-0.9, 0.98, -0.4); deskGroup.add(pot);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
        leaf.position.set(-0.9, 1.15, -0.4); leaf.castShadow = true; deskGroup.add(leaf);
      }

      scene.add(deskGroup);
    });

    // Windows
    const wm = new THREE.MeshStandardMaterial({ color: 0x87ceeb, emissive: 0x87ceeb, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), wm);
      win.position.set(-15 + i * 5, 3, -18);
      scene.add(win);
    }

    // Animation
    let time = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      time += delta;

      scene.traverse(obj => {
        if (obj instanceof THREE.Group && obj.userData?.isAgent) {
          const agentId = obj.userData.agentId;
          const agent = agentsRef.current.find(a => a.id === agentId);
          if (!agent) return;
          obj.position.y = Math.sin(time * 2 + parseInt(agentId) * 0.5) * 0.002;
          obj.children.forEach(child => {
            if (child instanceof THREE.Mesh && child.geometry.type === 'TorusGeometry') {
              child.rotation.z = time * 1.5;
              child.scale.setScalar(1 + Math.sin(time * 3) * 0.05);
            }
          });
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Interaction
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !camera) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);
      let found: HoveredAgent | null = null;
      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.isAgent) {
            const agent = agentsRef.current.find(a => a.id === obj.userData.agentId);
            if (agent) { found = { agent }; break; }
          }
          obj = obj.parent;
        }
        if (found) break;
      }
      setHoveredAgent(found);
    };

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current || !camera) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);
      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.isAgent) {
            const agent = agentsRef.current.find(a => a.id === obj.userData.agentId);
            if (agent) { setSelectedAgent(agent); onAgentClick?.(agent); }
            return;
          }
          obj = obj.parent;
        }
      }
    };

    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove);
        containerRef.current.removeEventListener('click', handleClick);
        containerRef.current.removeChild(renderer.domElement);
      }
      cancelAnimationFrame(animationRef.current);
      renderer.dispose();
    };
  }, [agents, onAgentClick, getRoom]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {hoveredAgent && (
        <div className="absolute pointer-events-none bg-slate-900/95 backdrop-blur border border-slate-600 rounded-lg px-3 py-2 text-sm z-10" style={{ left: '50%', bottom: '10%', transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredAgent.agent.color }} />
            <span className="text-white font-medium">{hoveredAgent.agent.name}</span>
            <span className="text-slate-400 text-xs">{hoveredAgent.agent.model}</span>
          </div>
          <div className="text-slate-300 text-xs mt-1">{hoveredAgent.agent.status === 'Running' ? '🟢 运行中' : '⚪ 已停止'}</div>
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
    </div>
  );
}
