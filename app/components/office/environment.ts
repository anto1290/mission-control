import * as THREE from 'three';

/**
 * Phase B — office environment builder.
 * Builds the static architecture (floor, walls, windows, glass partition,
 * meeting room, lounge, 10 aligned workstations, plants, lighting) as one
 * THREE.Group and exposes world-space location data for character placement
 * (Phase C) and pathfinding (Phase D).
 *
 * World scale: 1 unit = 1 meter. Human height ~1.7. Office footprint 40 x 24.
 */

export interface OfficeSeat {
  id: string;
  desk: THREE.Vector3;     // desk center (world)
  chair: THREE.Vector3;   // seated position (world)
  approach: THREE.Vector3; // where a walking employee stops to sit down
  forward: THREE.Vector3; // seated facing direction (normalized)
}

export interface OfficeEnvironment {
  group: THREE.Group;
  seats: OfficeSeat[];
  meetingTable: THREE.Vector3;
  meetingSeats: THREE.Vector3[];
  loungeCenter: THREE.Vector3;
  bounds: { x: [number, number]; z: [number, number] };
}

// ── Shared materials (light-neutral corporate palette, reused everywhere) ──
const mat = {
  floor: new THREE.MeshStandardMaterial({ color: 0xd9d5ce, roughness: 0.96 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.92 }),
  desk: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5 }),
  deskLeg: new THREE.MeshStandardMaterial({ color: 0xb7b3ac, roughness: 0.55, metalness: 0.25 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.75 }),
  metalL: new THREE.MeshStandardMaterial({ color: 0x9a9ea6, roughness: 0.35, metalness: 0.65 }),
  monitor: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5, metalness: 0.3 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x8fd0ff, emissiveIntensity: 0.3, roughness: 0.4 }),
  kb: new THREE.MeshStandardMaterial({ color: 0x3a3d43, roughness: 0.85 }),
  chair: new THREE.MeshStandardMaterial({ color: 0x2d2f34, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xa9c7da, transparent: true, opacity: 0.18,
    roughness: 0.06, metalness: 0.25, side: THREE.DoubleSide, depthWrite: false,
  }),
  winFrame: new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.5 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xa5814f, roughness: 0.85 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f7d4d, roughness: 0.8 }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x98a2ad, roughness: 0.9 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.6 }),
  rug: new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.98 }),
  tableTop: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.45 }),
  white: new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.6 }),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function B(
  g: THREE.Group,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  m: THREE.Material,
  cast = true, recv = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = recv;
  g.add(mesh);
  return mesh;
}

// ── Perimeter: floor + walls (back wall has 4 large black-framed windows) ──
function addPerimeter(g: THREE.Group) {
  const H = 4, t = 0.2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // Back wall (z = -12): base strip, top strip, mullions, then window units
  B(g, 40, 1, t, 0, 0.5, -12, mat.wall);          // base 0–1
  B(g, 40, 0.5, t, 0, 3.75, -12, mat.wall);       // top 3.5–4
  const mullions: [number, number][] = [
    [-19.25, 1.5], [-10, 3], [0, 3], [10, 3], [19.25, 1.5],
  ];
  mullions.forEach(([cx, cw]) => B(g, cw, 2.5, t, cx, 2.25, -12, mat.wall));

  [-15, -5, 5, 15].forEach(cx => {
    const w = 7, y0 = 1, y1 = 3.5, gh = y1 - y0, cy = (y0 + y1) / 2, z = -12;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, gh), mat.glass);
    glass.position.set(cx, cy, z + 0.06);
    g.add(glass);
    const f = 0.12;
    B(g, w + f, f, f, cx, y0, z + 0.06, mat.winFrame, true, false); // bottom bar
    B(g, w + f, f, f, cx, y1, z + 0.06, mat.winFrame, true, false); // top bar
    B(g, f, gh + f, f, cx - w / 2, cy, z + 0.06, mat.winFrame, true, false);
    B(g, f, gh + f, f, cx + w / 2, cy, z + 0.06, mat.winFrame, true, false);
    B(g, f, gh, f, cx, cy, z + 0.06, mat.winFrame, true, false);    // center mullion
  });

  // Front / side solid walls
  B(g, 40, H, t, 0, H / 2, 12, mat.wall);
  B(g, t, H, 24, -20, H / 2, 0, mat.wall);
  B(g, t, H, 24, 20, H / 2, 0, mat.wall);
}

// ── Glass partition at x = 10 (divides open office from meeting + lounge) ──
function addPartition(g: THREE.Group) {
  const x = 10, H = 4;
  const segs: [number, number][] = [[-12, -8], [-6.5, 5.5], [7, 12]];
  segs.forEach(([a, b]) => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(b - a, H), mat.glass);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(x, H / 2, (a + b) / 2);
    g.add(glass);
  });
  [-12, -8, -6.5, -4, 0, 4, 8, 12, 5.5].forEach(z =>
    B(g, 0.08, H, 0.08, x, H / 2, z, mat.metal, true, false),
  );
  B(g, 0.08, 0.1, 24, x, 0.05, 0, mat.metal, false, true);
  B(g, 0.08, 0.1, 24, x, H - 0.05, 0, mat.metal, false, true);
  // Door frames at the two doorway gaps
  [[-8, -6.5], [5.5, 7]].forEach(([a, b]) => {
    const d = b - a, c = (a + b) / 2;
    B(g, 0.12, 0.12, d, x, 2.3, c, mat.metal, true, false);
    B(g, 0.12, 2.3, 0.12, x, 1.15, a, mat.metal, true, false);
    B(g, 0.12, 2.3, 0.12, x, 1.15, b, mat.metal, true, false);
  });
}

// ── Divider wall z = 2 (meeting vs lounge) with a doorway ──
function addMeetingDivider(g: THREE.Group) {
  const H = 4;
  B(g, 5, H, 0.2, 12.5, H / 2, 2, mat.wall);   // x[10,15]
  B(g, 3.5, H, 0.2, 18.25, H / 2, 2, mat.wall); // x[16.5,20]
  B(g, 0.15, 0.15, 0.22, 15, 2.35, 2, mat.metal, true, false);
  B(g, 0.15, 2.3, 0.22, 16.5, 1.15, 2, mat.metal, true, false);
}


// ── Furniture builders ───────────────────────────────────────────────────────
function addDesk(g: THREE.Group, x: number, z: number) {
  const d = new THREE.Group();
  d.position.set(x, 0, z);
  B(d, 1.6, 0.05, 0.9, 0, 0.72, 0, mat.desk, true, true);
  B(d, 0.05, 0.72, 0.85, -0.78, 0.36, 0, mat.deskLeg);
  B(d, 0.05, 0.72, 0.85, 0.78, 0.36, 0, mat.deskLeg);
  B(d, 1.5, 0.04, 0.05, 0, 0.16, -0.4, mat.deskLeg, false, false);
  B(d, 0.62, 0.38, 0.03, 0, 1.0, -0.28, mat.monitor, true, false);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), mat.screen);
  scr.position.set(0, 1.0, -0.263);
  d.add(scr);
  B(d, 0.06, 0.28, 0.06, 0, 0.82, -0.3, mat.monitor, true, false);
  B(d, 0.26, 0.02, 0.18, 0, 0.73, -0.3, mat.monitor, true, false);
  B(d, 0.46, 0.02, 0.16, 0, 0.745, 0.12, mat.kb, false, true);
  g.add(d);
}

function addChair(g: THREE.Group, x: number, z: number, rotY = 0) {
  const c = new THREE.Group();
  c.position.set(x, 0, z);
  c.rotation.y = rotY;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.04, 20), mat.metalL);
  base.position.y = 0.03;
  c.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 12), mat.metalL);
  pole.position.y = 0.24;
  c.add(pole);
  B(c, 0.52, 0.09, 0.5, 0, 0.46, 0, mat.chair, true, true);
  B(c, 0.52, 0.58, 0.08, 0, 0.84, 0.27, mat.chair, true, false);
  g.add(c);
}

function addSofa(g: THREE.Group, x: number, z: number, rotY = 0) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  s.rotation.y = rotY;
  B(s, 2.1, 0.4, 0.9, 0, 0.2, 0, mat.sofa, true, true);
  B(s, 2.1, 0.5, 0.16, 0, 0.6, -0.37, mat.sofa, true, false);
  B(s, 0.16, 0.55, 0.9, -0.97, 0.45, 0, mat.sofa, true, false);
  B(s, 0.16, 0.55, 0.9, 0.97, 0.45, 0, mat.sofa, true, false);
  B(s, 0.9, 0.12, 0.7, -0.45, 0.42, 0.05, mat.cushion, true, false);
  B(s, 0.9, 0.12, 0.7, 0.45, 0.42, 0.05, mat.cushion, true, false);
  g.add(s);
}

function addCoffeeTable(g: THREE.Group, x: number, z: number) {
  B(g, 1.3, 0.05, 0.75, x, 0.42, z, mat.tableTop, true, true);
  [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([lx, lz]) =>
    B(g, 0.08, 0.42, 0.08, x + lx, 0.21, z + lz, mat.metalL),
  );
}

function addPlant(g: THREE.Group, x: number, z: number) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 20), mat.pot);
  pot.position.set(x, 0.25, z);
  pot.castShadow = true;
  g.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 8), mat.trunk);
  trunk.position.set(x, 0.7, z);
  g.add(trunk);
  const mk = (sx: number, sy: number, sz: number, cx: number, cy: number, cz: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 14), mat.leaf);
    m.position.set(x + cx, 0.85 + cy, z + cz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    g.add(m);
  };
  mk(1, 0.9, 1, 0, 0.3, 0);
  mk(0.7, 0.7, 0.7, 0.25, 0.15, 0.1);
  mk(0.6, 0.6, 0.6, -0.22, 0.1, -0.12);
}

// ── Rooms / zones ────────────────────────────────────────────────────────────
function addMeetingRoom(g: THREE.Group) {
  B(g, 3.4, 0.07, 1.6, 15, 0.74, -5, mat.tableTop, true, true);
  [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]].forEach(([lx, lz]) =>
    B(g, 0.12, 0.74, 0.12, 15 + lx, 0.37, -5 + lz, mat.metalL),
  );
  [13.9, 14.7, 15.3, 16.1].forEach(x => {
    addChair(g, x, -6.05, Math.PI); // south side, faces +z (toward table)
    addChair(g, x, -3.95, 0);       // north side, faces -z
  });
  B(g, 2.4, 1.4, 0.06, 15, 1.8, -11.85, mat.white, true, false); // whiteboard
  addPlant(g, 18.5, -11);
}

function addLounge(g: THREE.Group) {
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), mat.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(15, 0.012, 7);
  rug.receiveShadow = true;
  g.add(rug);
  addSofa(g, 13.2, 8.4, Math.PI / 2);
  addSofa(g, 16.8, 5.6, -Math.PI / 2);
  addCoffeeTable(g, 15, 7);
  B(g, 0.06, 0.9, 1.6, 19.85, 1.6, 7, mat.monitor, true, false); // wall screen
  addPlant(g, 18.5, 11);
  addPlant(g, 11.5, 11);
}



function addOpenOffice(g: THREE.Group, seats: OfficeSeat[]) {
  const cols = [-17, -11, -5, 1, 7];
  const rows = [-5, 3];
  let i = 0;
  rows.forEach(rz => {
    cols.forEach(cx => {
      addDesk(g, cx, rz);
      addChair(g, cx, rz + 0.75, 0);
      seats.push({
        id: `desk_${i}`,
        desk: new THREE.Vector3(cx, 0, rz),
        chair: new THREE.Vector3(cx, 0, rz + 0.75),
        approach: new THREE.Vector3(cx, 0, rz + 1.5),
        forward: new THREE.Vector3(0, 0, -1),
      });
      i++;
    });
  });
  addPlant(g, -18.5, -10.5);
  addPlant(g, -18.5, 10.5);
  addPlant(g, 8.5, -10.5);
}

// ── Lighting: soft daylight through the back windows + interior fill ──
function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0xb8b0a0, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  const sun = new THREE.DirectionalLight(0xfff2dc, 1.3);
  sun.position.set(-14, 26, -20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // Warm interior fill (no shadows, keeps rooms readable)
  const fills: [number, number, number, number][] = [
    [15, 3.2, -5, 0.5], [15, 3.2, 7, 0.45], [-8, 3.4, -2, 0.4],
  ];
  fills.forEach(([x, y, z, i]) => {
    const p = new THREE.PointLight(0xfff4e6, i, 26, 1.6);
    p.position.set(x, y, z);
    scene.add(p);
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────
export function buildOfficeEnvironment(scene: THREE.Scene): OfficeEnvironment {
  const group = new THREE.Group();
  const seats: OfficeSeat[] = [];

  addPerimeter(group);
  addPartition(group);
  addMeetingDivider(group);
  addMeetingRoom(group);
  addLounge(group);
  addOpenOffice(group, seats);
  scene.add(group);
  addLights(scene);

  const meetingSeats: THREE.Vector3[] = [];
  [13.9, 14.7, 15.3, 16.1].forEach(x => {
    meetingSeats.push(new THREE.Vector3(x, 0, -6.05));
    meetingSeats.push(new THREE.Vector3(x, 0, -3.95));
  });

  return {
    group,
    seats,
    meetingTable: new THREE.Vector3(15, 0, -5),
    meetingSeats,
    loungeCenter: new THREE.Vector3(15, 0, 7),
    bounds: { x: [-20, 20], z: [-12, 12] },
  };
}
