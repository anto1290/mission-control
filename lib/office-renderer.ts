/**
 * Isometric office renderer — pure canvas drawing.
 * All geometry + colors in one module so page.tsx stays thin.
 * ponytail: no external 3D lib; Canvas2D is enough for this use case.
 */

export interface Station {
  id: string;
  name: string;
  model: string;
  status: 'Running' | 'Stopped' | string;
  room: string;
  seat: number;
  color: string;
}

export interface OfficeFrame {
  rotation: number; // degrees
  zoom: number;
  offsetX: number;
  offsetY: number;
  hovered: Station | null;
  selected: Station | null;
  stations: Station[];
}

// ------------------------------------------------------------------
// World layout constants (units ~ meters in world space)
// ------------------------------------------------------------------

const ROOMS: Record<string, { x: number; y: number; w: number; d: number; label: string }> = {
  meeting:  { x: -190, y: -160, w: 130, d: 100, label: 'Meeting' },
  lounge:   { x: -190, y: -40,  w: 90,  d: 90,  label: 'Lounge' },
  reception:{ x: -90,  y: -40,  w: 130, d: 90,  label: 'Reception' },
  open:     { x: 40,   y: -160, w: 150, d: 190, label: 'Open Office' },
  kitchen:  { x: 40,   y: 40,   w: 110, d: 80,  label: 'Kitchen' },
  relax:    { x: 150,  y: 40,   w: 80,  d: 80,  label: 'Relax' },
};

// Assign agents to rooms in a sensible default pattern
function seatFor(station: Station, index: number): { x: number; y: number } {
  const room = ROOMS[station.room] || ROOMS.open;
  switch (station.room) {
    case 'meeting':
      return { x: room.x + 30 + (index % 2) * 60, y: room.y + 50 };
    case 'lounge':
      return { x: room.x + 45, y: room.y + 45 };
    case 'reception':
      return { x: room.x + 65, y: room.y + 45 };
    case 'kitchen':
      return { x: room.x + 55, y: room.y + 40 };
    case 'relax':
      return { x: room.x + 40, y: room.y + 40 };
    default: {
      // Open office grid: 3 columns x 3 rows of desks
      const cols = 3;
      const col = index % cols;
      const row = Math.floor(index / cols) % 3;
      return {
        x: room.x + 25 + col * 45,
        y: room.y + 30 + row * 55,
      };
    }
  }
}

// ------------------------------------------------------------------
// Projection helpers
// ------------------------------------------------------------------

function iso(
  cx: number,
  cy: number,
  cz: number,
  frame: OfficeFrame,
  w: number,
  h: number,
): { x: number; y: number } {
  const rad = (frame.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ax = (cx - cy) * 0.866;
  const ay = (cx + cy) * 0.5 - cz;
  const rx = ax * cos - ay * sin;
  const ry = ax * sin + ay * cos;
  return {
    x: rx * frame.zoom + w / 2 + frame.offsetX,
    y: ry * frame.zoom + h / 2 + frame.offsetY,
  };
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  top: string,
  frame: OfficeFrame,
  cw: number,
  ch: number,
) {
  const c = shade;
  const left = c(top, -25);
  const right = c(top, -55);

  const p = {
    bl: iso(x, y, z, frame, cw, ch),
    br: iso(x + w, y, z, frame, cw, ch),
    fl: iso(x, y + d, z, frame, cw, ch),
    tbl: iso(x, y, z + h, frame, cw, ch),
    tbr: iso(x + w, y, z + h, frame, cw, ch),
    tfbl: iso(x, y + d, z + h, frame, cw, ch),
    tfr: iso(x + w, y + d, z + h, frame, cw, ch),
  };

  // right face
  ctx.fillStyle = right;
  poly(ctx, [p.bl, p.br, p.tbr, p.tbl]);
  ctx.fill();

  // left face
  ctx.fillStyle = left;
  poly(ctx, [p.bl, p.fl, p.tfbl, p.tbl]);
  ctx.fill();

  // top face
  ctx.fillStyle = top;
  poly(ctx, [p.tbl, p.tbr, p.tfr, p.tfbl]);
  ctx.fill();

  // subtle top outline
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.8;
  poly(ctx, [p.tbl, p.tbr, p.tfr, p.tfbl]);
  ctx.stroke();
}

// ------------------------------------------------------------------
// Furniture primitives
// ------------------------------------------------------------------

function desk(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 38, 22, 12, '#ffffff', frame, cw, ch);
  box(ctx, x, y, 12, 38, 22, 2, '#e8e2d8', frame, cw, ch); // top
  // legs (thin)
  for (const [dx, dy] of [[0, 0], [36, 0], [0, 20], [36, 20]] as const) {
    box(ctx, x + dx, y + dy, 0, 2.5, 2.5, 12, '#b8b0a5', frame, cw, ch);
  }
  // monitor
  box(ctx, x + 10, y + 4, 14, 18, 1.5, 14, '#1f2937', frame, cw, ch);
  box(ctx, x + 15, y + 5, 28, 8, 1.5, 2, '#111827', frame, cw, ch); // stand
}

function monitorGlow(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  const p = iso(x + 19, y + 4.5, 24, frame, cw, ch);
  ctx.fillStyle = 'rgba(59,130,246,0.35)';
  ctx.fillRect(p.x - 9, p.y - 7, 18, 14);
}

function chair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 10, 10, 4, '#1f2937', frame, cw, ch); // base
  box(ctx, x + 3, y + 3, 4, 4, 4, 20, color, frame, cw, ch); // back
}

function sofa(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 40, 18, 10, color, frame, cw, ch);
  box(ctx, x, y, 10, 40, 5, 8, shade(color, -10), frame, cw, ch); // backrest
}

function rug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, color: string, frame: OfficeFrame, cw: number, ch: number) {
  const p = [
    iso(x, y, 0, frame, cw, ch),
    iso(x + w, y, 0, frame, cw, ch),
    iso(x + w, y + d, 0, frame, cw, ch),
    iso(x, y + d, 0, frame, cw, ch),
  ];
  ctx.fillStyle = color;
  poly(ctx, p);
  ctx.fill();
}

function plant(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean, frame: OfficeFrame, cw: number, ch: number) {
  const s = big ? 1.5 : 1;
  box(ctx, x - 4 * s, y - 4 * s, 0, 8 * s, 8 * s, 10 * s, '#d6a978', frame, cw, ch);
  for (let i = 0; i < 4; i++) {
    const p = iso(x + (i - 1.5) * 5 * s, y + ((i % 2) - 0.5) * 5 * s, 10 * s + i * 3, frame, cw, ch);
    ctx.fillStyle = ['#3f8f5f', '#4fa872', '#2f7a50', '#48a06a'][i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tv(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 20, 44, 3, 30, '#111827', frame, cw, ch);
  box(ctx, x + 3, y + 0.5, 23, 38, 1.5, 24, '#1f2937', frame, cw, ch); // frame
  // speakers
  box(ctx, x - 12, y + 2, 0, 6, 18, 20, '#1f2937', frame, cw, ch);
  box(ctx, x + 52, y + 2, 0, 6, 18, 20, '#1f2937', frame, cw, ch);
}

function refrigerator(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 22, 18, 55, '#d1d5db', frame, cw, ch);
  box(ctx, x + 4, y + 14, 30, 14, 14, 4, '#9ca3af', frame, cw, ch); // handle
}

function coffeeTable(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 26, 26, 6, color, frame, cw, ch);
  for (const [dx, dy] of [[0, 0], [24, 0], [0, 24], [24, 24]] as const) {
    box(ctx, x + dx, y + dy, 0, 2, 2, 6, '#6b7280', frame, cw, ch);
  }
}

function waterCooler(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 10, 10, 40, '#f3f4f6', frame, cw, ch);
  box(ctx, x + 1, y + 1, 44, 8, 8, 12, '#3b82f6', frame, cw, ch); // bottle
}

function presentationBoard(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  // whiteboard on wall
  box(ctx, x, y, 25, 50, 2, 30, '#ffffff', frame, cw, ch);
  box(ctx, x + 2, y + 0.5, 27, 46, 1, 26, '#f8fafc', frame, cw, ch);
  // green marker board
  box(ctx, x + 60, y, 25, 30, 2, 30, '#065f46', frame, cw, ch);
}

function kitchenCounter(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 80, 20, 28, '#f3f4f6', frame, cw, ch);
  // sink
  box(ctx, x + 10, y + 4, 28, 20, 12, 2, '#d1d5db', frame, cw, ch);
}

function diningTable(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 40, 40, 4, '#dbeafe', frame, cw, ch); // blue top
  for (const [dx, dy] of [[0, 0], [38, 0], [0, 38], [38, 38]] as const) {
    box(ctx, x + dx, y + dy, 0, 2.5, 2.5, 4, '#93c5fd', frame, cw, ch);
  }
}

function receptionDesk(ctx: CanvasRenderingContext2D, x: number, y: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y, 0, 70, 24, 30, '#ffffff', frame, cw, ch);
  box(ctx, x, y, 30, 70, 24, 2, '#fbbf24', frame, cw, ch); // accent stripe
  box(ctx, x + 18, y + 6, 32, 24, 12, 2, '#fbbf24', frame, cw, ch); // logo panel
}

// ------------------------------------------------------------------
// Walls & glass
// ------------------------------------------------------------------

function glassWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: OfficeFrame, cw: number, ch: number) {
  const p = {
    b: iso(x, y, 0, frame, cw, ch),
    tr: iso(x + w, y, 0, frame, cw, ch),
    tb: iso(x, y, h, frame, cw, ch),
    tl: iso(x + w, y, h, frame, cw, ch),
  };
  ctx.fillStyle = 'rgba(147,197,253,0.18)';
  poly(ctx, [p.b, p.tr, p.tl, p.tb]);
  ctx.fill();
  // mullions
  ctx.strokeStyle = 'rgba(107,114,128,0.5)';
  ctx.lineWidth = 1;
  const m = Math.max(1, Math.round(w / 30));
  for (let i = 0; i <= m; i++) {
    const gx = x + (w / m) * i;
    const b0 = iso(gx, y, 0, frame, cw, ch);
    const t0 = iso(gx, y, h, frame, cw, ch);
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(t0.x, t0.y);
    ctx.stroke();
  }
  // top rail
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.tb.x, p.tb.y);
  ctx.lineTo(p.tl.x, p.tl.y);
  ctx.stroke();
}

function solidWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: OfficeFrame, cw: number, ch: number) {
  box(ctx, x, y - 0.5, 0, w, 1, h, '#f5f5f4', frame, cw, ch);
}

// ------------------------------------------------------------------
// Avatar generation — procedural, deterministic per agent name
// ------------------------------------------------------------------

type HairStyle = 'short' | 'wavy' | 'spiky' | 'curly' | 'bald';
type Accessory = 'none' | 'glasses' | 'cap' | 'headphones';

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function pickHair(name: string): HairStyle {
  const styles: HairStyle[] = ['short', 'wavy', 'spiky', 'curly', 'bald'];
  return styles[hashStr(name) % styles.length];
}

function pickAccessory(name: string): Accessory {
  const opts: Accessory[] = ['none', 'none', 'glasses', 'cap', 'headphones'];
  return opts[hashStr(name + 'acc') % opts.length];
}

const skinTones = ['#fdebd0', '#f5cba7', '#e8b88a', '#d4915a', '#a0674b', '#6d4c41'];
const hairColors = ['#2c2c2c', '#4a3728', '#8b6914', '#c0392b', '#f5f5dc', '#7d3c98', '#e67e22'];

function drawHair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: HairStyle,
  color: string,
  r: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (style) {
    case 'short':
      ctx.arc(x, y - r * 0.3, r * 0.95, Math.PI, 0);
      ctx.fill();
      break;
    case 'wavy':
      for (let i = -3; i <= 3; i++) {
        ctx.arc(x + i * r * 0.25, y - r * 0.5, r * 0.35, Math.PI, 0);
      }
      ctx.fill();
      break;
    case 'spiky':
      for (let i = -3; i <= 3; i++) {
        const angle = (i / 3) * Math.PI * 0.5 - Math.PI * 0.5;
        const sx = x + Math.sin(angle) * r * 0.7;
        const sy = y - r * 0.3 - Math.cos(angle) * r * 0.6;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.15, sy + r * 0.2);
        ctx.lineTo(sx, sy - r * 0.3);
        ctx.lineTo(sx + r * 0.15, sy + r * 0.2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0);
      ctx.fill();
      break;
    case 'curly':
      for (let row = 0; row < 3; row++) {
        for (let col = -2; col <= 2; col++) {
          ctx.beginPath();
          ctx.arc(
            x + col * r * 0.3,
            y - r * 0.2 - row * r * 0.25,
            r * 0.22,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      break;
    case 'bald':
      // nothing
      break;
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skinColor: string,
  hairColor: string,
  hairStyle: HairStyle,
  accessory: Accessory,
  active: boolean,
) {
  const r = 10;

  // Ears
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(x - r, y - 2, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r, y - 2, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  drawHair(ctx, x, y, hairStyle, hairColor, r);

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 2, 3, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 4, y - 2, 3, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (look slightly up if active)
  const pupilY = active ? -1 : 0;
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.arc(x - 4, y - 2 + pupilY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 4, y - 2 + pupilY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = active ? '#c0392b' : '#7f8c8d';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (active) {
    // Smile
    ctx.arc(x, y + 4, 3, 0.2, Math.PI - 0.2);
  } else {
    // Neutral
    ctx.moveTo(x - 3, y + 5);
    ctx.lineTo(x + 3, y + 5);
  }
  ctx.stroke();

  // Accessory
  if (accessory === 'glasses') {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 4, y - 2, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 0.5, y - 2);
    ctx.lineTo(x + 0.5, y - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 8.5, y - 2);
    ctx.lineTo(x - 11, y - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 8.5, y - 2);
    ctx.lineTo(x + 11, y - 3);
    ctx.stroke();
  } else if (accessory === 'cap') {
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.6, r * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - r * 1.1, y - r * 0.6, r * 2.2, 4);
  } else if (accessory === 'headphones') {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y - 2, r * 1.2, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.stroke();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(x - r * 1.1, y - 1, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 1.1, y - 1, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Status glow ring
  if (active) {
    ctx.strokeStyle = 'rgba(16,185,129,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  active: boolean,
  isDesk: boolean,
) {
  // Torso
  ctx.fillStyle = active ? color : '#7f8c8d';
  ctx.beginPath();
  ctx.roundRect(x - 8, y + 8, 16, 16, 4);
  ctx.fill();

  // Shoulders
  if (isDesk && active) {
    // Arms on desk posture
    ctx.fillStyle = active ? color : '#7f8c8d';
    ctx.beginPath();
    ctx.roundRect(x - 10, y + 10, 4, 10, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 10, 4, 10, 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------
// Agent
// ------------------------------------------------------------------

function agent(ctx: CanvasRenderingContext2D, s: Station, index: number, frame: OfficeFrame, cw: number, ch: number) {
  const p = seatFor(s, index);
  const base = iso(p.x, p.y, 0, frame, cw, ch);
  const active = s.status === 'Running';
  const isDesk = ['meeting', 'open'].includes(s.room);
  const isLounge = ['lounge', 'relax'].includes(s.room);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + 6, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  drawBody(ctx, base.x, base.y, s.color, active, isDesk);

  // Face
  const skinIdx = hashStr(s.name) % skinTones.length;
  const hairIdx = hashStr(s.name + 'hair') % hairColors.length;
  const hairStyle = pickHair(s.name);
  const accessory = pickAccessory(s.name);

  drawFace(
    ctx,
    base.x,
    base.y - 8,
    skinTones[skinIdx],
    hairColors[hairIdx],
    hairStyle,
    accessory,
    active,
  );

  // Label below
  ctx.fillStyle = active ? '#374151' : '#9ca3af';
  ctx.font = '600 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.name, base.x, base.y + 18);

  // Room tag for lounge/relax
  if (isLounge) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 7px system-ui, sans-serif';
    ctx.fillText('🛋️', base.x, base.y + 27);
  }
}

// ------------------------------------------------------------------
// Main render
// ------------------------------------------------------------------

export function renderOffice(
  canvas: HTMLCanvasElement,
  stations: Station[],
  frame: OfficeFrame,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  frame.stations = stations;

  // Light background — matches the reference
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#eef1f5');
  bg.addColorStop(1, '#e5e9ef');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 + frame.offsetX, h / 2 + frame.offsetY);
  ctx.scale(frame.zoom, frame.zoom);

  // rotate world
  ctx.rotate((frame.rotation * Math.PI) / 180);

  // ----------------------------------------------------------------
  // Main floor — light wood planks
  // ----------------------------------------------------------------
  const floorTop = '#d4c3a8';
  const p0 = iso(-200, -170, 0, frame, 0, 0);
  const p1 = iso(240, -170, 0, frame, 0, 0);
  const p2 = iso(240, 130, 0, frame, 0, 0);
  const p3 = iso(-200, 130, 0, frame, 0, 0);
  ctx.fillStyle = floorTop;
  poly(ctx, [p0, p1, p2, p3]);
  ctx.fill();

  // planks (subtle)
  ctx.strokeStyle = 'rgba(180,160,130,0.35)';
  ctx.lineWidth = 0.5;
  for (let yy = -170; yy <= 130; yy += 20) {
    const a = iso(-200, yy, 0, frame, 0, 0);
    const b = iso(240, yy, 0, frame, 0, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Room rugs / accent floors
  // ----------------------------------------------------------------
  rug(ctx, ROOMS.lounge.x + 10, ROOMS.lounge.y + 10, 70, 70, 'rgba(229,231,235,0.7)', frame, 0, 0);
  rug(ctx, ROOMS.reception.x + 20, ROOMS.reception.y + 20, 90, 50, 'rgba(254,243,199,0.5)', frame, 0, 0);
  rug(ctx, ROOMS.kitchen.x + 15, ROOMS.kitchen.y + 15, 80, 50, 'rgba(186,230,253,0.4)', frame, 0, 0);

  // ----------------------------------------------------------------
  // Walls — glass on the perimeter, low solid dividers between rooms
  // ----------------------------------------------------------------
  const wallH = 60;
  // Back perimeter glass
  glassWall(ctx, -200, -170, 440, wallH, frame, 0, 0);
  // Left perimeter glass
  const L0 = iso(-200, -170, 0, frame, 0, 0);
  const L1 = iso(-200, 130, 0, frame, 0, 0);
  ctx.fillStyle = 'rgba(147,197,253,0.18)';
  poly(ctx, [L0, L1, iso(-200, 130, wallH, frame, 0, 0), iso(-200, -170, wallH, frame, 0, 0)]);
  ctx.fill();
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  const lm = 5;
  for (let i = 0; i <= lm; i++) {
    const yy = -170 + (300 / lm) * i;
    const a = iso(-200, yy, 0, frame, 0, 0);
    const b = iso(-200, yy, wallH, frame, 0, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Dividers
  solidWall(ctx, ROOMS.meeting.x + ROOMS.meeting.w, ROOMS.meeting.y, 1, 80, frame, 0, 0);
  solidWall(ctx, ROOMS.open.x - 1, ROOMS.open.y, 1, ROOMS.open.d, frame, 0, 0);
  solidWall(ctx, ROOMS.kitchen.x, ROOMS.kitchen.y, ROOMS.kitchen.w, 1, frame, 0, 0);
  solidWall(ctx, ROOMS.reception.x + ROOMS.reception.w, ROOMS.reception.y, 1, ROOMS.reception.d, frame, 0, 0);

  // ----------------------------------------------------------------
  // Room-specific furniture
  // ----------------------------------------------------------------

  // Meeting room
  {
    const r = ROOMS.meeting;
    box(ctx, r.x + 20, r.y + 30, 0, 50, 30, 5, '#1f2937', frame, 0, 0); // big table
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 0 : 1;
      const idx = i % 4;
      const cx = r.x + 12 + idx * 15;
      const cy = side === 0 ? r.y + 12 : r.y + 52;
      chair(ctx, cx, cy, '#1f2937', frame, 0, 0);
    }
    box(ctx, r.x + 5, r.y + 5, 0, 25, 4, 30, '#1f2937', frame, 0, 0); // bookshelf
    chair(ctx, r.x + 60, r.y + 8, '#3b82f6', frame, 0, 0); // blue armchair
    chair(ctx, r.x + 85, r.y + 8, '#3b82f6', frame, 0, 0);
    plant(ctx, r.x + 120, r.y + 15, true, frame, 0, 0);
  }

  // Lounge
  {
    const r = ROOMS.lounge;
    sofa(ctx, r.x + 10, r.y + 10, '#f3f4f6', frame, 0, 0);
    sofa(ctx, r.x + 10, r.y + 55, '#4ade80', frame, 0, 0);
    coffeeTable(ctx, r.x + 25, r.y + 32, '#f9fafb', frame, 0, 0);
    plant(ctx, r.x + 80, r.y + 10, false, frame, 0, 0);
  }

  // Reception
  {
    const r = ROOMS.reception;
    receptionDesk(ctx, r.x + 15, r.y + 30, frame, 0, 0);
    chair(ctx, r.x + 55, r.y + 55, '#fbbf24', frame, 0, 0);
    chair(ctx, r.x + 75, r.y + 55, '#fbbf24', frame, 0, 0);
  }

  // Open office — desks + monitors
  {
    const r = ROOMS.open;
    for (let i = 0; i < 9; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const dx = r.x + 25 + col * 45;
      const dy = r.y + 30 + row * 55;
      desk(ctx, dx, dy, frame, 0, 0);
      monitorGlow(ctx, dx, dy, frame, 0, 0);
      chair(ctx, dx + 10, dy + 24, '#1f2937', frame, 0, 0);
    }
    // presentation board on back wall
    presentationBoard(ctx, r.x + 20, r.y - 4, frame, 0, 0);
    waterCooler(ctx, r.x + 130, r.y + 8, frame, 0, 0);
    plant(ctx, r.x + 130, r.y + 60, true, frame, 0, 0);
  }

  // Kitchen
  {
    const r = ROOMS.kitchen;
    kitchenCounter(ctx, r.x + 5, r.y + 5, frame, 0, 0);
    refrigerator(ctx, r.x + 80, r.y + 8, frame, 0, 0);
    diningTable(ctx, r.x + 20, r.y + 45, frame, 0, 0);
    for (let i = 0; i < 4; i++) {
      chair(ctx, r.x + 15 + i * 12, r.y + 40, '#3b82f6', frame, 0, 0);
    }
    plant(ctx, r.x + 5, r.y + 70, true, frame, 0, 0);
  }

  // Relax
  {
    const r = ROOMS.relax;
    sofa(ctx, r.x + 8, r.y + 8, '#f3f4f6', frame, 0, 0); // L-shape sectional
    sofa(ctx, r.x + 8, r.y + 45, '#f3f4f6', frame, 0, 0);
    chair(ctx, r.x + 45, r.y + 15, '#f59e0b', frame, 0, 0);
    chair(ctx, r.x + 45, r.y + 45, '#f59e0b', frame, 0, 0);
    coffeeTable(ctx, r.x + 20, r.y + 30, '#dbeafe', frame, 0, 0);
    tv(ctx, r.x + 30, r.y + 65, frame, 0, 0);
    plant(ctx, r.x + 68, r.y + 68, true, frame, 0, 0);
  }

  // ----------------------------------------------------------------
  // Stations (agents)
  // ----------------------------------------------------------------
  stations.forEach((s, index) => agent(ctx, s, index, frame, 0, 0));

  ctx.restore();
}
