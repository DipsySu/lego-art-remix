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

function drawStudNub(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hex: string) {
  context.beginPath();
  context.ellipse(cx, cy + radius * 0.72, radius * 0.92, radius * 0.28, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,0.22)";
  context.fill();

  context.beginPath();
  context.arc(cx, cy + radius * 0.16, radius, 0, Math.PI * 2);
  context.fillStyle = shadeHex(hex, 0.58);
  context.fill();

  const cap = context.createRadialGradient(
    cx - radius * 0.38,
    cy - radius * 0.42,
    radius * 0.08,
    cx,
    cy + radius * 0.08,
    radius,
  );
  cap.addColorStop(0, shadeHex(hex, 1.34));
  cap.addColorStop(0.48, hex);
  cap.addColorStop(1, shadeHex(hex, 0.74));
  context.beginPath();
  context.arc(cx, cy, radius * 0.86, 0, Math.PI * 2);
  context.fillStyle = cap;
  context.fill();

  context.beginPath();
  context.arc(cx, cy + radius * 0.02, radius * 0.36, 0, Math.PI * 2);
  context.lineWidth = Math.max(0.9, radius * 0.09);
  context.strokeStyle = "rgba(0,0,0,0.28)";
  context.stroke();
  context.beginPath();
  context.arc(cx, cy, radius * 0.36, Math.PI * 1.1, Math.PI * 1.9);
  context.strokeStyle = "rgba(255,255,255,0.4)";
  context.stroke();

  context.beginPath();
  context.ellipse(cx - radius * 0.26, cy - radius * 0.32, radius * 0.3, radius * 0.16, -0.65, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,0.45)";
  context.fill();
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

  context.fillStyle = shadeHex(hex, 0.5);
  roundRect(context, left, top + topHeight - 3, size, front + 3, 2.4);
  context.fill();
  context.fillStyle = "rgba(0,0,0,0.16)";
  context.fillRect(left + size - 3.2, top + topHeight - 1, 3.2, front + 1);

  const face = context.createLinearGradient(left, top, left + size * 0.2, top + topHeight);
  face.addColorStop(0, shadeHex(hex, 1.14));
  face.addColorStop(0.55, hex);
  face.addColorStop(1, shadeHex(hex, 0.86));
  roundRect(context, left, top, size, topHeight, 2.6);
  context.fillStyle = face;
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.28)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(left + 2.4, top + 1.4);
  context.lineTo(left + size - 2.4, top + 1.4);
  context.stroke();

  const cx = left + size / 2;
  const cy = top + topHeight / 2;
  if (stud) drawStudNub(context, cx, cy, size * 0.3, hex);
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
  const cy = y + STUD_CELL / 2 - level * 4;
  const radius = STUD_CELL * 0.45;
  const wall = 4.2 + level * 2.4;

  context.fillStyle = shadeHex(hex, 0.46);
  context.beginPath();
  context.arc(cx, cy + wall * 0.55, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(0,0,0,0.2)";
  context.beginPath();
  context.ellipse(cx, cy + wall * 0.85, radius * 0.86, 2.4, 0, 0, Math.PI);
  context.fill();

  if (stud) {
    drawStudNub(context, cx, cy + 1, radius * 0.78, hex);
    drawStudNub(context, cx, cy - radius * 0.18, radius * 0.5, hex);
  } else {
    drawStudNub(context, cx, cy, radius * 0.9, hex);
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
