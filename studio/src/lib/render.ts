import { shadeHex } from "./color";
import type { PieceId } from "./pieces";
import { pieceById } from "./pieces";

export const STUD_CELL = 42;

export interface DrawOptions {
  colors: string[];
  photo: Uint8ClampedArray | null;
  width: number;
  height: number;
  piece: PieceId;
  depth: Uint8Array | null;
  view: "studs" | "photo" | "split";
  split: number;
  hover: number | null;
  painted: ReadonlySet<number> | null;
}

export function mosaicPixelSize(width: number, height: number): { width: number; height: number } {
  return { width: width * STUD_CELL, height: height * STUD_CELL };
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

interface StudMark {
  x: number;
  y: number;
  round: boolean;
}

// Official geometry, millimetres. Pitch is the centre-to-centre grid.
const PITCH_MM = 8;
const PART_MM = 7.8;
const STUD_DIAMETER_MM = 4.8;
const STUD_HEIGHT_MM = 1.8;

function drawLegoStud(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hex: string) {
  const wall = radius * (STUD_HEIGHT_MM / (STUD_DIAMETER_MM / 2)) * 0.42;
  context.beginPath();
  context.ellipse(cx, cy + radius * 0.78, radius * 0.92, wall * 0.55, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,0.14)";
  context.fill();

  context.beginPath();
  context.arc(cx, cy + wall * 0.55, radius, 0, Math.PI * 2);
  context.fillStyle = shadeHex(hex, 0.8);
  context.fill();

  context.beginPath();
  context.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
  context.fillStyle = hex;
  context.fill();

  context.beginPath();
  context.arc(cx, cy, radius * 0.9, Math.PI * 1.08, Math.PI * 1.92);
  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = Math.max(0.7, radius * 0.07);
  context.stroke();
  context.beginPath();
  context.arc(cx, cy, radius * 0.9, Math.PI * 0.12, Math.PI * 0.88);
  context.strokeStyle = "rgba(0,0,0,0.16)";
  context.stroke();

  const fontSize = Math.max(3.2, radius * 0.46);
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = Math.max(0.45, radius * 0.045);
  context.strokeStyle = "rgba(0,0,0,0.28)";
  context.strokeText("LEGO", cx, cy + fontSize * 0.06);
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.strokeText("LEGO", cx, cy - fontSize * 0.08);
}

function drawSquarePiece(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  hex: string,
  stud: boolean,
  tall: boolean,
  level: number,
): StudMark {
  const gap = 1.4;
  const left = x + gap;
  const size = STUD_CELL - gap * 2;
  const extra = level * 5;
  const front = (tall ? size * 0.24 : size * 0.13) + extra * 0.35;
  const top = y + gap - extra;
  const topHeight = Math.max(size * 0.62, size - front);

  context.fillStyle = shadeHex(hex, 0.72);
  roundRect(context, left, top + topHeight - 3, size, front + 3, 2.2);
  context.fill();

  roundRect(context, left, top, size, topHeight, 2.2);
  context.fillStyle = hex;
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left + 2.2, top + 1.2);
  context.lineTo(left + size - 2.2, top + 1.2);
  context.stroke();

  const cx = left + size / 2;
  const cy = top + topHeight / 2;
  if (stud) drawLegoStud(context, cx, cy - size * 0.02, (size * STUD_DIAMETER_MM) / PART_MM / 2, hex);
  return { x: cx, y: cy, round: false };
}

function drawRoundPiece(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  hex: string,
  stud: boolean,
  level: number,
): StudMark {
  const cx = x + STUD_CELL / 2;
  const cy = y + STUD_CELL / 2 - level * 3;
  const radius = ((STUD_CELL * PART_MM) / PITCH_MM) / 2;
  const wall = (STUD_CELL * 3.2) / PITCH_MM * 0.55 + level;

  context.beginPath();
  context.arc(cx, cy + wall * 0.65, radius, 0, Math.PI * 2);
  context.fillStyle = shadeHex(hex, 0.72);
  context.fill();
  context.beginPath();
  context.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
  context.fillStyle = hex;
  context.fill();
  context.beginPath();
  context.arc(cx, cy, radius * 0.9, Math.PI * 1.1, Math.PI * 1.9);
  context.strokeStyle = "rgba(255,255,255,0.35)";
  context.lineWidth = 1;
  context.stroke();

  if (stud) {
    drawLegoStud(context, cx, cy - radius * 0.08, (radius * STUD_DIAMETER_MM) / PART_MM, hex);
  }
  return { x: cx, y: cy, round: true };
}

function drawStud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  hex: string,
  piece: PieceId,
  level: number,
): StudMark {
  const spec = pieceById(piece);
  if (spec.shape === "round") return drawRoundPiece(context, x, y, hex, spec.stud, level);
  return drawSquarePiece(context, x, y, hex, spec.stud, spec.id === "brick", level);
}

function drawPhotoCell(context: CanvasRenderingContext2D, pixels: Uint8ClampedArray, index: number, x: number, y: number) {
  const offset = index * 4;
  context.fillStyle = `rgb(${pixels[offset]}, ${pixels[offset + 1]}, ${pixels[offset + 2]})`;
  context.fillRect(x, y, STUD_CELL, STUD_CELL);
}

export function drawMosaic(context: CanvasRenderingContext2D, options: DrawOptions) {
  const { colors, width, height } = options;
  const size = mosaicPixelSize(width, height);
  const canvas = context.canvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = "#1a1918";
  context.fillRect(0, 0, size.width, size.height);

  const depth = options.view === "studs" ? options.depth : null;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      const level = depth ? depth[index] : 0;
      const x = col * STUD_CELL;
      const y = row * STUD_CELL;
      const showPhoto =
        options.photo != null && (options.view === "photo" || (options.view === "split" && col < width * options.split));
      const center = showPhoto && options.photo
        ? (drawPhotoCell(context, options.photo, index, x, y), { x: x + STUD_CELL / 2, y: y + STUD_CELL / 2 })
        : drawStud(context, x, y, colors[index], options.piece, level);
      const round = "round" in center && center.round && !showPhoto;

      if (options.painted?.has(index) && !showPhoto) {
        context.strokeStyle = "rgba(255, 200, 87, 0.95)";
        context.lineWidth = 1.6;
        context.beginPath();
        if (round) context.arc(center.x, center.y, STUD_CELL * 0.42, 0, Math.PI * 2);
        else context.rect(x + 2, y + 2, STUD_CELL - 4, STUD_CELL - 4);
        context.stroke();
      }
      if (options.hover === index) {
        context.strokeStyle = "rgba(255,255,255,0.9)";
        context.lineWidth = 2;
        context.beginPath();
        if (round) context.arc(center.x, center.y, STUD_CELL * 0.46, 0, Math.PI * 2);
        else context.rect(x + 1.2, y + 1.2, STUD_CELL - 2.4, STUD_CELL - 2.4);
        context.stroke();
      }
    }
  }
}

export function hitTestStud(x: number, y: number, width: number, height: number): number | null {
  const col = Math.floor(x / STUD_CELL);
  const row = Math.floor(y / STUD_CELL);
  if (col < 0 || row < 0 || col >= width || row >= height) return null;
  return row * width + col;
}
