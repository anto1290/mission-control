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
  task?: string;
}

interface Props {
  agents: AgentStation[];
  onAgentClick?: (agent: AgentStation) => void;
}

// ─── Room Zones ──────────────────────────────────────────────────────────────

const ROOMS = [
  { id: 'workspace', name: 'Workspace', x: -12, z: -10, w: 14, d: 8, color: 0x1e3a5f },
  { id: 'meeting', name: 'Meeting Room', x: 6, z: -10, w: 8, d: 8, color: 0x5f1e3a },
  { id: 'lounge', name: 'Lounge', x: -12, z: 4, w: 10, d: 8, color: 0x1e5f3a },
  { id: 'kitchen', name: 'Kitchen', x: 6, z: 4, w: 8, d: 6, color: 0x5f4a1e },
];

const ZONE_COLORS = [0x3b82f6, 0x8b5cf6, 0x10b981, 0xf59e0b, 0xef4444, 0x6366f1];

// ─── Seating ─────────────────────────────────────────────────────────────────

function getSeatPosition(index: number): { x: number; z: number; room: string } {
  const room = ROOMS[index % ROOMS.length];
  const col = Math.floor(index / ROOMS.length) % 3;
  const row = Math.floor((index / ROOMS.length) / 3);
  return {
    x: room.x + room.w / 2 + (col - 1) * 2.5,
    z: room.z + room.d / 2 + (row - 1) * 2.2,
    room: room.id,
  };
}

// ─── Character Builder ────────────────────────────────────────────────────────

function createCharacter(color: string, active: boolean): THREE.Group {
  const grp = new THREE.Group();
  const skinColor = active ? 0xf4c7a8 : 0x9ca3af;
  const bodyColor = active ? new THREE.Color(color) : 0x475569;

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.25),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  body.userData.isBody = true;
  grp.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 })
  );
  head.position.y = 0.95;
  head.castShadow = true;
  grp.add(head);

  // Hair
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2c2c2c })
  );
  hair.position.y = 1.0;
  grp.add(hair);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
  [-0.1, 0.1].forEach(x => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.2, 0);
    leg.castShadow = true;
    grp.add(leg);
  });

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4);
  [-0.25, 0.25].forEach(x => {
    const arm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: bodyColor }));
    arm.position.set(x, 0.55, 0);
    arm.castShadow = true;
    arm.userData.isArm = true;
    grp.add(arm);
  });

  // Status glow ring
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

// ─── Furniture ───��────────────────────────────────────────────────────────────

function createDesk(x: number, z: number): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);

  // Table top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.08, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.1 })
  );
  top.position.y = 0.75;
  top.castShadow = true;
  top.receiveShadow = true;
  grp.add(top);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
  [[-0.8, 0.375, -0.45], [0.8, 0.375, -0.45], [-0.8, 0.375, 0.45], [0.8, 0.375, 0.45]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    grp.add(leg);
  });

  // Monitor
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.4 })
  );
  monitor.position.set(0, 1.1, -0.4);
  monitor.castShadow = true;
  grp.add(monitor);

  // Screen glow
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.47),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.3 })
  );
  screen.position.set(0, 1.1, -0.37);
  grp.add(screen);

  // Keyboard
  const kb = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.02, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  kb.position.set(0, 0.8, 0.15);
  grp.add(kb);

  return grp;
}

function createChair(x: number, z: number): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
  );
  seat.position.y = 0.45;
  seat.castShadow = true;
  grp.add(seat);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
  );
  back.position.set(0, 0.7, 0.22);
  back.castShadow = true;
  grp.add(back);

  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 })
  );
  leg.position.y = 0.225;
  grp.add(leg);

  return grp;
}

function createMeetingTable(x: number, z: number): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.1, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.2 })
  );
  table.position.y = 0.75;
  table.castShadow = true;
  table.receiveShadow = true;
  grp.add(table);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const cx = Math.cos(angle) * 1.6;
    const cz = Math.sin(angle) * 1.0;
    grp.add(createChair(cx, cz));
  }

  return grp;
}

// ─── Room Builder ─────────────────────────────────────────────────────────────

function createRoom(room: typeof ROOMS[0], scene: THREE.Scene) {
  const { x, z, w, d, color } = room;
  const wallH = 3.5;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, transparent: true, opacity: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.15, roughness: 0.1, metalness: 0.3 });

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x + w / 2, 0.01, z + d / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallThick = 0.1;
  // Back wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, wallThick), wallMat);
  backWall.position.set(x + w / 2, wallH / 2, z);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, d), wallMat);
  leftWall.position.set(x, wallH / 2, z + d / 2);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall (with door opening)
  const rightWallTop = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH * 0.4, d), wallMat);
  rightWallTop.position.set(x + w, wallH * 0.8, z + d / 2);
  scene.add(rightWallTop);
  const rightWallBot = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH * 0.3, d * 0.3), wallMat);
  rightWallBot.position.set(x + w, wallH * 0.15, z + d * 0.15);
  scene.add(rightWallBot);
  const rightWallBot2 = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH * 0.3, d * 0.3), wallMat);
  rightWallBot2.position.set(x + w, wallH * 0.15, z + d * 0.85);
  scene.add(rightWallBot2);

  // Glass partition
  const glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, wallH * 0.7), glassMat);
  glassPanel.position.set(x + w * 0.7, wallH * 0.5, z + d * 0.5);
  glassPanel.rotation.y = Math.PI / 2;
  scene.add(glassPanel);

  // Door frame
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, wallH, 1.2), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 }));
  doorFrame.position.set(x + w - 0.025, wallH / 2, z + d * 0.5);
  scene.add(doorFrame);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, wallH * 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
  door.position.set(x + w - 0.025, wallH * 0.45, z + d * 0.5);
  scene.add(door);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(room.name, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  label.position.set(x + w / 2, wallH + 0.5, z + d / 2);
  scene.add(label);
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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 35, target: new THREE.Vector3(0, 0, 0) });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const characterMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const timeRef = useRef(0);
  const behaviorRef = useRef<Map<string, { state: string; startTime: number; duration: number }>>(new Map());
  const walkPathRef = useRef<Map<string, { start: THREE.Vector3; end: THREE.Vector3; progress: number }>>(new Map());
  const roomTargetsRef = useRef<Map<string, THREE.Vector3>>(new Map());

  agentsRef.current = agents;

  // Initialize behaviors
  useMemo(() => {
    agents.forEach((agent, i) => {
      behaviorRef.current.set(agent.id, {
        state: agent.status === 'Running' ? 'working' : 'idle',
        startTime: Date.now(),
        duration: 3000 + Math.random() * 5000,
      });
      const pos = getSeatPosition(i);
      roomTargetsRef.current.set(agent.id, new THREE.Vector3(pos.x, 0, pos.z));
    });
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
    scene.fog = new THREE.Fog(0x090e19, 50, 100);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 200);
    camera.position.set(25, 25, 25);
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

    // Lighting
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.4));
    const dirLight = new THREE.DirectionalLight(0xfff4e6, 1.0);
    dirLight.position.set(20, 40, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);
    const fill = new THREE.DirectionalLight(0x6366f1, 0.2);
    fill.position.set(-15, 20, -15);
    scene.add(fill);

    // Main floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111b2b, roughness: 0.85, metalness: 0.05 });
    const mainFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), floorMat);
    mainFloor.rotation.x = -Math.PI / 2;
    mainFloor.receiveShadow = true;
    scene.add(mainFloor);

    const grid = new THREE.GridHelper(80, 40, 0x1e293b, 0x0f172a);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.position.y = 0.02;
    scene.add(grid);

    // Build rooms
    ROOMS.forEach(room => createRoom(room, scene));

    // Meeting table in meeting room
    const meetingPos = getSeatPosition(0);
    scene.add(createMeetingTable(ROOMS[1].x + ROOMS[1].w / 2, ROOMS[1].z + ROOMS[1].d / 2));

    // Build desks and characters
    agents.forEach((agent, idx) => {
      const pos = getSeatPosition(idx);
      const { x, z } = pos;

      const desk = createDesk(x, z);
      scene.add(desk);

      const chair = createChair(x, z + 0.8);
      scene.add(chair);

      const char = createCharacter(agent.color, agent.status === 'Running');
      char.position.set(x, 0, z - 0.5);
      char.userData = { agentId: agent.id };
      scene.add(char);
      characterMeshesRef.current.set(agent.id, char);
    });

    // Windows on back wall
    const winMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, emissive: 0x87ceeb, emissiveIntensity: 0.3, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3), winMat);
      win.position.set(-25 + i * 8, 3, -24);
      scene.add(win);
    }

    // Corner plants
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x16a34a });
    [[-35, -20], [35, -20], [-35, 20], [35, 20]].forEach(([px, pz]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: 0x92400e }));
      pot.position.set(px, 0.3, pz);
      scene.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5), plantMat);
      leaves.position.set(px, 1.0, pz);
      leaves.castShadow = true;
      scene.add(leaves);
    });

    // Animation loop
    let time = 0;
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      time += 0.016;
      timeRef.current = time;

      const now = Date.now();
      agentsRef.current.forEach((agent, idx) => {
        const char = characterMeshesRef.current.get(agent.id)!;
        if (!char) return;

        let behavior = behaviorRef.current.get(agent.id);
        if (!behavior) {
          behavior = { state: 'working', startTime: now, duration: 3000 };
          behaviorRef.current.set(agent.id, behavior);
        }

        // State machine transitions
        if (now - behavior.startTime > behavior.duration) {
          const states = ['working', 'idle', 'meeting', 'coffee'];
          const newState = states[Math.floor(Math.random() * states.length)];
          behavior.state = newState;
          behavior.startTime = now;
          behavior.duration = 2000 + Math.random() * 4000;

          if (newState === 'meeting' || newState === 'coffee') {
            const targetRoom = newState === 'meeting' ? ROOMS[1] : ROOMS[3];
            walkPathRef.current.set(agent.id, {
              start: char.position.clone(),
              end: new THREE.Vector3(targetRoom.x + targetRoom.w / 2, 0, targetRoom.z + targetRoom.d / 2),
              progress: 0,
            });
          } else {
            const seatPos = getSeatPosition(idx);
            walkPathRef.current.set(agent.id, {
              start: char.position.clone(),
              end: new THREE.Vector3(seatPos.x, 0, seatPos.z),
              progress: 0,
            });
          }
        }

        // Walking animation
        const walkPath = walkPathRef.current.get(agent.id);
        if (walkPath && walkPath.progress < 1) {
          walkPath.progress += 0.015;
          if (walkPath.progress >= 1) {
            walkPath.progress = 1;
            walkPathRef.current.delete(agent.id);
          } else {
            char.position.lerpVectors(walkPath.start, walkPath.end, walkPath.progress);
            char.position.y = Math.sin(time * 10) * 0.05;
          }
        } else {
          char.position.y = 0;
        }

        // Animation based on state
        switch (behavior.state) {
          case 'working':
            char.children.forEach((child, i) => {
              if (child.userData?.isArm) {
                child.rotation.x = Math.sin(time * 8 + i) * 0.15;
              }
            });
            break;
          case 'idle':
            char.position.y = Math.sin(time * 2) * 0.02;
            break;
          case 'meeting':
            char.rotation.y = Math.PI / 2;
            break;
          case 'coffee':
            char.rotation.z = 0.05;
            break;
        }

        // Glow animation
        const glow = char.children.find((c: any) => c.userData?.isGlow);
        if (glow) {
          glow.material.opacity = 0.3 + Math.sin(time * 3) * 0.1;
          glow.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Camera controls
    const orbit = { theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 35, target: new THREE.Vector3(0, 0, 0) };
    const isDragging = { current: false };
    const lastMouse = { x: 0, y: 0 };

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
      const charGroups = Array.from(characterMeshesRef.current.values());
      const allMeshes = charGroups.flatMap(g => g.children);
      const hits = raycasterRef.current.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        const char = hits[0].object.parent as THREE.Group;
        const agentId = char?.userData?.agentId;
        if (agentId) {
          return { agent: agentsRef.current.find(a => a.id === agentId) || null, zone: null };
        }
      }
      return { agent: null, zone: null };
    };

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
      if (e.shiftKey && (e.buttons & 1)) {
        orbit.target.x -= e.movementX * 0.02;
        orbit.target.z -= e.movementY * 0.02;
        updateOrbit();
        return;
      }
      lastMouseRef.current.x = e.clientX;
      lastMouseRef.current.y = e.clientY;
      const { agent: hovAgent } = doRaycast();
      setHoveredAgent(hovAgent || null);
      container.style.cursor = hovAgent ? 'pointer' : 'default';
    };

    const onMouseUp = () => { isDragging.current = false; };

    const onClick = (e: MouseEvent) => {
      if (isDragging.current) return;
      const { agent: clickedAgent } = doRaycast();
      if (clickedAgent) {
        setSelectedAgent(clickedAgent);
        onAgentClick?.(clickedAgent);
      } else {
        setSelectedAgent(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.max(15, Math.min(70, orbit.radius + e.deltaY * 0.03));
      updateOrbit();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', e => e.preventDefault());

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
          <div className="text-slate-300 text-xs mt-1">{hoveredAgent.status === 'Running' ? '🟢 Working' : '⚪ Offline'}</div>
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
              {selectedAgent.status === 'Running' ? '● Working' : '○ Offline'}
            </span>
            <span className="text-slate-500 text-xs">Seat {selectedAgent.seat}</span>
          </div>
          {selectedAgent.task && (
            <div className="mt-2 text-xs text-slate-400">
              <span className="text-slate-500">Task:</span> {selectedAgent.task}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">Click空白处关闭</div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur rounded-lg px-3 py-2 text-xs border border-slate-700">
        <div className="text-slate-400">
          <div>🖱️ Right-click drag: Orbit</div>
          <div>🖱️ Scroll: Zoom</div>
          <div>⇧+Drag: Pan</div>
          <div>👆 Click: Select agent</div>
        </div>
      </div>
    </div>
  );
}
