import * as THREE from 'three';

/**
 * Phase D — grid-based A* pathfinding for the fixed office layout.
 * Coarse occupancy grid (docs §9). A* runs only on target change and is
 * cached. 1 unit = 1 m; office 40 x 24.
 */

export interface WallSegment {
  h: boolean; // horizontal (along X at fixed z) vs vertical (along Z at fixed x)
  a: number;
  b: number;
  along: number;
}

export interface PathfinderConfig {
  bounds: { x: [number, number]; z: [number, number] };
  cell: number;
  walls: WallSegment[];
}

export class Pathfinder {

  private cfg: PathfinderConfig;
  private cols: number;
  private rows: number;
  private ox: number;
  private oz: number;
  private blocked: Uint8Array;
  private cache = new Map<string, THREE.Vector3[]>();

  constructor(cfg: PathfinderConfig) {
    this.cfg = cfg;
    const { bounds, cell } = cfg;
    this.ox = bounds.x[0];
    this.oz = bounds.z[0];
    this.cols = Math.round((bounds.x[1] - bounds.x[0]) / cell);
    this.rows = Math.round((bounds.z[1] - bounds.z[0]) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.buildBlockSet();
  }

  private buildBlockSet() {
    const { cell } = this.cfg;
    const mark = (cx: number, cz: number) => {
      if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return;
      this.blocked[cz * this.cols + cx] = 1;
    };
    for (const w of this.cfg.walls) {
      if (w.h) {
        const z = w.along;
        const x0 = Math.min(w.a, w.b);
        const x1 = Math.max(w.a, w.b);
        for (let x = x0; x <= x1; x += cell / 2) mark(this.toCol(x), this.toRow(z));
      } else {
        const x = w.along;
        const z0 = Math.min(w.a, w.b);
        const z1 = Math.max(w.a, w.b);
        for (let z = z0; z <= z1; z += cell / 2) mark(this.toCol(x), this.toRow(z));
      }
    }
  }

  private toCol(x: number) {
    return Math.floor((x - this.ox) / this.cfg.cell);
  }
  private toRow(z: number) {
    return Math.floor((z - this.oz) / this.cfg.cell);
  }
  private toWorldX(c: number) {
    return this.ox + (c + 0.5) * this.cfg.cell;
  }
  private toWorldZ(r: number) {
    return this.oz + (r + 0.5) * this.cfg.cell;
  }
  private cellPassable(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked[r * this.cols + c] === 0;
  }

  private nearestPassable(wx: number, wz: number): [number, number] {
    const c0 = Math.max(0, Math.min(this.cols - 1, this.toCol(wx)));
    const r0 = Math.max(0, Math.min(this.rows - 1, this.toRow(wz)));
    if (this.cellPassable(c0, r0)) return [c0, r0];
    for (let rad = 1; rad <= Math.max(this.cols, this.rows); rad++) {
      for (let dc = -rad; dc <= rad; dc++) {
        for (let dr = -rad; dr <= rad; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
          if (this.cellPassable(c0 + dc, r0 + dr)) return [c0 + dc, r0 + dr];
        }
      }
    }
    return [c0, r0];
  }

  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const [sc, sr] = this.nearestPassable(from.x, from.z);
    const [tc, tr] = this.nearestPassable(to.x, to.z);
    const key = `${sc},${sr}->${tc},${tr}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const start = sr * this.cols + sc;
    const target = tr * this.cols + tc;
    if (start === target) {
      const direct = [from.clone(), to.clone()];
      this.cache.set(key, direct);
      return direct;
    }

    const n = this.cols * this.rows;
    const g = new Float32Array(n).fill(Infinity);
    const f = new Float32Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    g[start] = 0;
    f[start] = this.h(sc, sr, tc, tr);

    const open: number[] = [start];
    const H8 = this.cfg.cell * Math.SQRT2;
    const H = this.cfg.cell;
    const neighbors: [number, number, number][] = [
      [1, 0, H], [-1, 0, H], [0, 1, H], [0, -1, H],
      [1, 1, H8], [1, -1, H8], [-1, 1, H8], [-1, -1, H8],
    ];

    const inBounds = (c: number, r: number) => c >= 0 && r >= 0 && c < this.cols && r < this.rows;
    let best: number[] | null = null;

    while (open.length > 0 && best === null) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === target) {
        best = [];
        let c = cur;
        while (c !== -1) { best.push(c); c = cameFrom[c]; }
        best.reverse();
        break;
      }
      closed[cur] = 1;
      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (const [dc, dr, cost] of neighbors) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!inBounds(nc, nr)) continue;
        if (dc !== 0 && dr !== 0) {
          if (!this.cellPassable(cc + dc, cr) || !this.cellPassable(cc, cr + dr)) continue;
        }
        const idx = nr * this.cols + nc;
        const ng = g[cur] + cost;
        if (ng < g[idx]) {
          g[idx] = ng;
          f[idx] = ng + this.h(nc, nr, tc, tr);
          cameFrom[idx] = cur;
          if (!closed[idx] && !open.includes(idx)) open.push(idx);
        }
      }
    }

    if (!best) {
      const direct = [from.clone(), to.clone()];
      this.cache.set(key, direct);
      return direct;
    }

    const waypoints: THREE.Vector3[] = [from.clone()];
    for (const idx of best) {
      const c = idx % this.cols;
      const r = Math.floor(idx / this.cols);
      waypoints.push(new THREE.Vector3(this.toWorldX(c), 0, this.toWorldZ(r)));
    }
    waypoints.push(to.clone());

    this.cache.set(key, this.shorten(waypoints));
    return this.cache.get(key)!;
  }

  private h(c: number, r: number, tc: number, tr: number) {
    const dc = Math.abs(c - tc);
    const dr = Math.abs(r - tr);
    return this.cfg.cell * Math.min(dc, dr) * Math.SQRT2 + this.cfg.cell * (Math.max(dc, dr) - Math.min(dc, dr));
  }

  private shorten(pts: THREE.Vector3[]): THREE.Vector3[] {
    if (pts.length <= 3) return pts;
    const out: THREE.Vector3[] = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (let k = pts.length - 1; k > i + 1; k--) {
        if (this.clearPath(pts[i], pts[k])) { j = k; break; }
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  private clearPath(a: THREE.Vector3, b: THREE.Vector3) {
    // Sample along the segment finely (0.25 m) so a doorway gap can't be
    // skipped; every sampled cell center must be free.
    const steps = Math.ceil(a.distanceTo(b) / 0.25) + 1;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const c = this.toCol(a.x + (b.x - a.x) * t);
      const r = this.toRow(a.z + (b.z - a.z) * t);
      if (!this.cellPassable(c, r)) return false;
    }
    return true;
  }

  /** World-space point test: is this XZ position inside a blocked cell? */
  isBlockedPoint(x: number, z: number) {
    return !this.cellPassable(this.toCol(x), this.toRow(z));
  }
}

/**
 * Default office pathfinder config — mirrors the walls in `environment.ts`:
 * perimeter bounds, glass partition at x=10 (with door gaps z[-8,-6.5] and
 * z[5.5,7]), meeting/lounge divider at z=2 (door gap x[15,16.5]).
 *
 * We only block the *structural* walls. Door gaps are left open by NOT adding
 * wall segments across them.
 */
export const officePathfinderConfig: PathfinderConfig = {
  bounds: { x: [-20, 20], z: [-12, 12] },
  cell: 0.5,
  walls: [
    // Perimeter (keep agents on the floor; 0.5 margin inward)
    { h: true, a: -20, b: 20, along: -12 },  // back
    { h: true, a: -20, b: 20, along: 12 },   // front
    { h: false, a: -12, b: 12, along: -20 }, // left
    { h: false, a: -12, b: 12, along: 20 },  // right
    // Glass partition at x=10 — three solid segments, two door gaps open
    { h: false, a: -12, b: -8, along: 10 },  // back solid
    { h: false, a: -6.5, b: 5.5, along: 10 },// middle solid
    { h: false, a: 7, b: 12, along: 10 },    // front solid
    // Meeting/lounge divider at z=2 — two solid segments, door gap x[15,16.5]
    { h: true, a: 10, b: 15, along: 2 },
    { h: true, a: 16.5, b: 20, along: 2 },
  ],
};

export function createOfficePathfinder() {
  return new Pathfinder(officePathfinderConfig);
}
