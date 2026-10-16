import { shadeHex } from "./color";
import type { PieceId } from "./pieces";
import { pieceById } from "./pieces";

export const STUD_CELL = 36;

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

function drawStud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  hex: string,
  piece: PieceId,
  level: number,
): { x: number; y: number } {
  const spec = pieceById(piece);
  const round = spec.shape === "round";
  const lip = level * STUD_CELL * 0.16;
  const centerX = x + STUD_CELL / 2;
  const radius = STUD_CELL * 0.34;
  const centerY = Math.max(y + radius + 1, y + STUD_CELL / 2 - lip * 0.72);

  if (lip > 0) {
    context.fillStyle = shadeHex(hex, 0.48);
    const stemTop = centerY + radius * 0.15;
    const stemBottom = y + STUD_CELL - 3;
    if (round) {
      context.fillRect(centerX - radius * 0.82, stemTop, radius * 1.64, Math.max(0, stemBottom - stemTop));
      context.beginPath();
      context.ellipse(centerX, stemBottom, radius * 0.82, 3.2, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(x + 4, stemTop, STUD_CELL - 8, Math.max(0, stemBottom - stemTop + 2));
    }
  }

  context.fillStyle = hex;
  if (round) {
    context.beginPath();
    context.arc(centerX, centerY, STUD_CELL * 0.36, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(centerX - STUD_CELL * 0.1, centerY - STUD_CELL * 0.1, STUD_CELL * 0.1, STUD_CELL * 0.06, -0.6, 0, Math.PI * 2);
    context.fillStyle = "rgba(255,255,255,0.3)";
    context.fill();
  } else {
    const height = Math.max(10, STUD_CELL - 6 - lip * 0.45);
    roundRect(context, x + 3, centerY - height / 2, STUD_CELL - 6, height, 3);
    context.fillStyle = hex;
    context.fill();
  }

  if (spec.stud) {
    context.beginPath();
    context.arc(centerX, centerY, STUD_CELL * 0.15, 0, Math.PI * 2);
    context.fillStyle = shadeHex(hex, 1.12);
    context.fill();
    context.lineWidth = 1.15;
    context.strokeStyle = "rgba(0,0,0,0.28)";
    context.stroke();
  }

  return { x: centerX, y: centerY };
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
  context.fillStyle = "#141210";
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
      const round = pieceById(options.piece).shape === "round" && !showPhoto;

      if (options.painted?.has(index) && !showPhoto) {
        context.strokeStyle = "rgba(255, 200, 87, 0.95)";
        context.lineWidth = 1.6;
        context.beginPath();
        if (round) context.arc(center.x, center.y, STUD_CELL * 0.42, 0, Math.PI * 2);
        else context.rect(x + 2.5, y + 2.5, STUD_CELL - 5, STUD_CELL - 5);
        context.stroke();
      }
      if (options.hover === index) {
        context.strokeStyle = "rgba(255,255,255,0.9)";
        context.lineWidth = 2;
        context.beginPath();
        if (round) context.arc(center.x, center.y, STUD_CELL * 0.46, 0, Math.PI * 2);
        else context.rect(x + 1, y + 1, STUD_CELL - 2, STUD_CELL - 2);
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
