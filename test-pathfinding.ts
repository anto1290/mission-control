import * as THREE from 'three';
import { createOfficePathfinder } from './app/components/office/pathfinding.ts';

// Self-check: A* routes an agent from the open office to the meeting room
// through a real door gap (never a straight line that clips the x=10 glass
// or the z=2 divider).
const pf = createOfficePathfinder();
const path = pf.findPath(new THREE.Vector3(-15, 0, 8), new THREE.Vector3(15, 0, -6));

const allFree = path.every(p => !pf.isBlockedPoint(p.x, p.z));
const hasTurn = path.length > 2;
console.log(`waypoints=${path.length} hasTurn=${hasTurn} allFree=${allFree}`);
console.log(path.map(p => `  (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).join('\n'));

if (!allFree || !hasTurn) {
  console.error('FAIL: path did not route around walls');
  process.exit(1);
}
console.log('PASS');


