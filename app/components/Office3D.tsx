'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface AgentStation {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped';
  seat: number;
  color: string;
  position: { x: number; z: number };
}

interface Props {
  agents: AgentStation[];
  onAgentClick?: (agent: AgentStation) => void;
}

export default function Office3D({ agents, onAgentClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationRef = useRef<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentStation | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 20, 50);
    sceneRef.current = scene;

    // Camera - isometric view
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(40, 40);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    scene.add(gridHelper);

    // Create desks and agents
    const deskPositions = [
      { x: -8, z: -8 }, { x: -4, z: -8 },
      { x: 4, z: -8 }, { x: 8, z: -8 },
      { x: -8, z: 0 }, { x: -4, z: 0 },
      { x: 4, z: 0 }, { x: 8, z: 0 },
      { x: -8, z: 8 }, { x: -4, z: 8 },
      { x: 4, z: 8 }, { x: 8, z: 8 },
    ];

    agents.forEach((agent, index) => {
      const pos = deskPositions[index % deskPositions.length];
      
      // Desk
      const deskGroup = new THREE.Group();
      deskGroup.position.set(pos.x, 0, pos.z);

      // Desk top
      const deskGeometry = new THREE.BoxGeometry(2.5, 0.1, 1.5);
      const deskMaterial = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.5,
        metalness: 0.3,
      });
      const deskTop = new THREE.Mesh(deskGeometry, deskMaterial);
      deskTop.position.y = 1;
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;
      deskGroup.add(deskTop);

      // Desk legs
      const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
      const legMaterial = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const legPositions = [
        [-1.1, 0.5, -0.6], [-1.1, 0.5, 0.6],
        [1.1, 0.5, -0.6], [1.1, 0.5, 0.6]
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        deskGroup.add(leg);
      });

      // Monitor
      const monitorStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      monitorStand.position.set(0, 1.2, -0.3);
      deskGroup.add(monitorStand);

      const monitorScreen = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 0.05),
        new THREE.MeshStandardMaterial({ 
          color: agent.status === 'Running' ? 0x22c55e : 0x475569,
          emissive: agent.status === 'Running' ? 0x22c55e : 0x000000,
          emissiveIntensity: agent.status === 'Running' ? 0.3 : 0,
        })
      );
      monitorScreen.position.set(0, 1.8, -0.3);
      monitorScreen.castShadow = true;
      deskGroup.add(monitorScreen);

      // Keyboard
      const keyboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.03, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      keyboard.position.set(0, 1.08, 0.2);
      deskGroup.add(keyboard);

      // Chair
      const chairSeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.05, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      chairSeat.position.set(0, 0.5, 1.2);
      chairSeat.castShadow = true;
      deskGroup.add(chairSeat);

      const chairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      chairBack.position.set(0, 0.9, 1.6);
      chairBack.castShadow = true;
      deskGroup.add(chairBack);

      const chairLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      chairLeg.position.set(0, 0.25, 1.2);
      deskGroup.add(chairLeg);

      // Agent indicator (glowing sphere)
      const indicatorGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const indicatorMaterial = new THREE.MeshStandardMaterial({
        color: agent.status === 'Running' ? 0x22c55e : 0x64748b,
        emissive: agent.status === 'Running' ? 0x22c55e : 0x000000,
        emissiveIntensity: agent.status === 'Running' ? 0.8 : 0,
      });
      const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
      indicator.position.set(0, 2.5, 0);
      indicator.userData = { agentId: agent.id };
      deskGroup.add(indicator);

      scene.add(deskGroup);
    });

    // Walls (back and left)
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      transparent: true,
      opacity: 0.3,
    });

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 10),
      wallMaterial
    );
    backWall.position.set(0, 5, -20);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 10),
      wallMaterial
    );
    leftWall.position.set(-20, 5, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    // Animation loop
    let time = 0;
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      time += 0.01;

      // Animate indicators
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.agentId) {
          object.position.y = 2.5 + Math.sin(time * 2) * 0.1;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight || 600;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Click handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        if (intersect.object.userData.agentId) {
          const agent = agents.find(a => a.id === intersect.object.userData.agentId);
          if (agent) {
            setSelectedAgent(agent);
            onAgentClick?.(agent);
          }
          break;
        }
      }
    };
    containerRef.current.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleClick);
        containerRef.current.removeChild(renderer.domElement);
      }
      cancelAnimationFrame(animationRef.current);
      renderer.dispose();
    };
  }, [agents, onAgentClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      {selectedAgent && (
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur rounded-lg p-4 border border-slate-700 max-w-xs">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: selectedAgent.color }}
            >
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{selectedAgent.name}</p>
              <p className="text-slate-400 text-sm">{selectedAgent.model}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                selectedAgent.status === 'Running'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-600/40 text-slate-400'
              }`}
            >
              {selectedAgent.status}
            </span>
            <span className="text-slate-500 text-xs">Seat {selectedAgent.seat}</span>
          </div>
        </div>
      )}
    </div>
  );
}
