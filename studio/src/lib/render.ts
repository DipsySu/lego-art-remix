import { hexToRgb, shadeHex } from "./color";
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

// A near-overhead view: keep the 8 mm pitch and 4.8 mm stud, with just
// enough visible sidewall to show height. All surfaces share an upper-left light.
const PART_SIZE = (STUD_CELL * PART_MM) / PITCH_MM;
const PART_GAP = (STUD_CELL - PART_SIZE) / 2;
const TOP_SQUASH = 0.94;

function litColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r + (255 - r) * amount}, ${g + (255 - g) * amount}, ${b + (255 - b) * amount})`;
}

function plasticSurface(context: CanvasRenderingContext2D, hex: string, x: number, y: number, size: number) {
  const finish = context.createLinearGradient(x, y, x + size * 0.8, y + size);
  finish.addColorStop(0, litColor(hex, 0.12));
  finish.addColorStop(0.35, litColor(hex, 0.035));
  finish.addColorStop(0.72, hex);
  finish.addColorStop(1, shadeHex(hex, 0.93));
  return finish;
}

function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function drawLegoStud(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hex: string) {
  const wall = (STUD_CELL * STUD_HEIGHT_MM / PITCH_MM) * 0.28;
  const ry = radius * TOP_SQUASH;
  const topY = cy - wall * 0.55;

  // A soft contact shadow falls behind the cylinder, outside its top face.
  // Radial falloff avoids the outlined, sunken appearance of an inner ring.
  context.save();
  context.translate(cx + 1.1, cy + 1.5);
  context.scale(1, TOP_SQUASH);
  const shadow = context.createRadialGradient(0, 0, radius * 0.65, 0, 0, radius + 3.2);
  shadow.addColorStop(0, "rgba(0,0,0,0.25)");
  shadow.addColorStop(0.65, "rgba(0,0,0,0.18)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = shadow;
  context.fillRect(-radius - 4, -radius - 4, radius * 2 + 8, radius * 2 + 8);
  context.restore();

  const side = context.createLinearGradient(cx - radius, cy, cx + radius, cy + wall);
  side.addColorStop(0, shadeHex(hex, 0.83));
  side.addColorStop(0.35, shadeHex(hex, 0.72));
  side.addColorStop(0.8, shadeHex(hex, 0.55));
  side.addColorStop(1, shadeHex(hex, 0.67));
  ellipse(context, cx, topY + wall, radius, ry);
  context.fillStyle = side;
  context.fill();

  // The bevel belongs on the silhouette; the cap remains a flat plastic disk.
  ellipse(context, cx, topY, radius, ry);
  context.fillStyle = plasticSurface(context, hex, cx - radius, topY - ry, radius * 2);
  context.fill();
  context.save();
  context.clip();
  const reflection = context.createRadialGradient(cx - radius * 0.38, topY - ry * 0.5, 0, cx - radius * 0.2, topY - ry * 0.25, radius * 1.3);
  reflection.addColorStop(0, "rgba(255,255,255,0.13)");
  reflection.addColorStop(0.6, "rgba(255,255,255,0.025)");
  reflection.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = reflection;
  context.fillRect(cx - radius, topY - ry, radius * 2, ry * 2);
  context.restore();

  const rim = context.createLinearGradient(cx - radius, topY - ry, cx + radius, topY + ry);
  rim.addColorStop(0, "rgba(255,255,255,0.48)");
  rim.addColorStop(0.35, "rgba(255,255,255,0.12)");
  rim.addColorStop(0.65, "rgba(0,0,0,0.02)");
  rim.addColorStop(1, "rgba(0,0,0,0.18)");
  ellipse(context, cx, topY, radius - 0.3, ry - 0.3);
  context.strokeStyle = rim;
  context.lineWidth = 0.6;
  context.stroke();

  // Restrained molded lettering, using a filled relief instead of hollow text.
  const fontSize = radius * 0.43;
  context.font = `900 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(0,0,0,0.16)";
  context.fillText("LEGO", cx + 0.2, topY + 0.45);
  context.fillStyle = "rgba(255,255,255,0.24)";
  context.fillText("LEGO", cx - 0.15, topY - 0.15);
  context.fillStyle = litColor(hex, 0.07);
  context.fillText("LEGO", cx, topY + 0.1);
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
  const left = x + PART_GAP;
  const size = PART_SIZE;
  const extra = level * 3;
  const front = (tall ? 3.3 : stud ? 1.6 : 1.1) + extra * 0.3;
  const top = y + PART_GAP - extra;
  const topHeight = size - front;
  const corner = 1.15;

  roundRect(context, left, top + 1, size, size - 1, corner);
  const side = context.createLinearGradient(left, top, left + size, top + size);
  side.addColorStop(0, shadeHex(hex, 0.82));
  side.addColorStop(1, shadeHex(hex, 0.58));
  context.fillStyle = side;
  context.fill();

  roundRect(context, left, top, size, topHeight, corner);
  context.fillStyle = plasticSurface(context, hex, left, top, size);
  context.fill();
  // Narrow injection-molded edge, rather than a thick black grid or white frame.
  const bevel = context.createLinearGradient(left, top, left + size, top + topHeight);
  bevel.addColorStop(0, "rgba(255,255,255,0.4)");
  bevel.addColorStop(0.45, "rgba(255,255,255,0.04)");
  bevel.addColorStop(1, "rgba(0,0,0,0.16)");
  roundRect(context, left + 0.35, top + 0.35, size - 0.7, topHeight - 0.7, corner);
  context.strokeStyle = bevel;
  context.lineWidth = 0.7;
  context.stroke();

  const cx = left + size / 2;
  const cy = top + topHeight / 2;
  if (stud) drawLegoStud(context, cx, cy, (STUD_CELL * STUD_DIAMETER_MM / PITCH_MM) / 2, hex);
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
  const radius = PART_SIZE / 2;
  const wall = (stud ? 1.8 : 1.2) + level * 0.3;
  const cx = x + STUD_CELL / 2;
  const cy = y + STUD_CELL / 2 - wall / 2 - level * 3;
  const ry = radius * TOP_SQUASH;

  ellipse(context, cx, cy + wall, radius, ry);
  const side = context.createLinearGradient(cx - radius, cy, cx + radius, cy + ry);
  side.addColorStop(0, shadeHex(hex, 0.82));
  side.addColorStop(1, shadeHex(hex, 0.57));
  context.fillStyle = side;
  context.fill();

  ellipse(context, cx, cy, radius, ry);
  context.fillStyle = plasticSurface(context, hex, cx - radius, cy - ry, radius * 2);
  context.fill();
  const bevel = context.createLinearGradient(cx - radius, cy - ry, cx + radius, cy + ry);
  bevel.addColorStop(0, "rgba(255,255,255,0.42)");
  bevel.addColorStop(0.4, "rgba(255,255,255,0.05)");
  bevel.addColorStop(1, "rgba(0,0,0,0.2)");
  ellipse(context, cx, cy, radius - 0.35, ry - 0.35);
  context.strokeStyle = bevel;
  context.lineWidth = 0.7;
  context.stroke();

  if (stud) drawLegoStud(context, cx, cy, (STUD_CELL * STUD_DIAMETER_MM / PITCH_MM) / 2, hex);
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
  // Reuse each color/height within this frame instead of rebuilding its gradients
  // for every stud. Padding retains raised pieces and their contact shadows.
  const sprites = new Map<string, { canvas: HTMLCanvasElement; center: StudMark }>();
  const padding = 24;
  const spriteSize = STUD_CELL + padding * 2;
  function drawPiece(x: number, y: number, hex: string, level: number): StudMark {
    const key = `${hex}:${level}`;
    let sprite = sprites.get(key);
    if (!sprite) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = Math.round(spriteSize * dpr);
      const tileContext = tile.getContext("2d");
      if (!tileContext) return drawStud(context, x, y, hex, options.piece, level);
      tileContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      const center = drawStud(tileContext, padding, padding, hex, options.piece, level);
      sprite = { canvas: tile, center };
      sprites.set(key, sprite);
    }
    context.drawImage(sprite.canvas, x - padding, y - padding, spriteSize, spriteSize);
    return { x: x + sprite.center.x - padding, y: y + sprite.center.y - padding, round: sprite.center.round };
  }
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
        : drawPiece(x, y, colors[index], level);
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
