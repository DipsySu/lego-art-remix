import { COLOR_BY_HEX, colorName } from "../data/catalog";
import type { PieceId } from "./pieces";
import { pieceById } from "./pieces";

export function downloadBlob(filename: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type }));
}

export function canvasToPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(filename, blob);
  }, "image/png");
}

export function wantedListXml(usage: Map<string, number>, piece: PieceId): string {
  const part = pieceById(piece).part;
  const items: string[] = [];
  const colors = [...usage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [hex, count] of colors) {
    if (count <= 0) continue;
    const color = COLOR_BY_HEX.get(hex.toLowerCase());
    if (!color) continue;
    items.push(`  <ITEM>
    <ITEMTYPE>P</ITEMTYPE>
    <ITEMID>${part}</ITEMID>
    <COLOR>${color.id}</COLOR>
    <MINQTY>${count}</MINQTY>
    <CONDITION>N</CONDITION>
  </ITEM>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<INVENTORY>
${items.join("\n")}
</INVENTORY>
`;
}

export function paletteDocument(entries: { hex: string; count: number }[], name: string) {
  const studMap: Record<string, number> = {};
  for (const entry of entries) studMap[entry.hex.toLowerCase()] = entry.count;
  return {
    name,
    studMap,
    sortedStuds: Object.keys(studMap),
    entries,
  };
}

export function parsePalette(raw: string): { hex: string; count: number }[] {
  const parsed = JSON.parse(raw) as {
    studMap?: Record<string, number>;
    entries?: { hex: string; count: number }[];
  };
  if (Array.isArray(parsed.entries)) {
    return parsed.entries
      .filter((entry) => typeof entry.hex === "string" && Number.isFinite(entry.count))
      .map((entry) => ({ hex: entry.hex.toLowerCase(), count: Math.max(0, Math.round(entry.count)) }));
  }
  if (parsed.studMap && typeof parsed.studMap === "object") {
    return Object.entries(parsed.studMap).map(([hex, count]) => ({
      hex: hex.toLowerCase(),
      count: Math.max(0, Math.round(Number(count) || 0)),
    }));
  }
  throw new Error("That file is not a stud map");
}

function cellSymbol(index: number): string {
  const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return String(index + 1);
}

export function instructionsHtml(options: {
  title: string;
  colors: string[];
  width: number;
  height: number;
  depth: Uint8Array | null;
  pieceName: string;
  usage: Map<string, number>;
}): string {
  const legend = [...options.usage.entries()].sort((a, b) => b[1] - a[1]);
  const symbol = new Map(legend.map(([hex], index) => [hex, cellSymbol(index)]));
  const plates: string[] = [];
  const plate = 16;
  for (let top = 0; top < options.height; top += plate) {
    for (let left = 0; left < options.width; left += plate) {
      const rows: string[] = [];
      const plateHeight = Math.min(plate, options.height - top);
      const plateWidth = Math.min(plate, options.width - left);
      for (let row = 0; row < plateHeight; row += 1) {
        const cells: string[] = [];
        for (let col = 0; col < plateWidth; col += 1) {
          const index = (top + row) * options.width + left + col;
          const hex = options.colors[index];
          const mark = symbol.get(hex) ?? "?";
          const ink = luminanceOf(hex) > 150 ? "#1a140f" : "#fffaf3";
          cells.push(
            `<i style="background:${hex};color:${ink}" title="${escapeHtml(colorName(hex))}">${mark}</i>`,
          );
        }
        rows.push(`<div class="row">${cells.join("")}</div>`);
      }
      const plateNumber = plates.length + 1;
      plates.push(
        `<section><h2>Plate ${plateNumber} <small>rows ${top + 1}–${top + plateHeight}, columns ${left + 1}–${left + plateWidth}</small></h2><div class="plate">${rows.join("")}</div></section>`,
      );
    }
  }

  const legendHtml = legend
    .map(([hex, count]) => {
      const mark = symbol.get(hex);
      return `<li><i style="background:${hex}">${mark}</i><span>${escapeHtml(colorName(hex))}</span><b>${count}</b></li>`;
    })
    .join("");

  const depthSection =
    options.depth == null
      ? ""
      : `<section><h2>Relief levels</h2><p>0 sits on the base. Higher numbers stack further forward.</p>${depthGrid(options)}</section>`;

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<title>${escapeHtml(options.title)} — mosaic instructions</title>
<style>
  body { font-family: Outfit, "Segoe UI", sans-serif; margin: 24px; color: #1c1612; background: #f6f1ea; }
  h1 { font-family: Fraunces, Georgia, serif; margin-bottom: 0; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  h2 small { font-weight: 450; color: #6d6258; }
  .meta { color: #6d6258; margin-bottom: 24px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; list-style: none; padding: 0; }
  .legend li { display: flex; align-items: center; gap: 8px; min-width: 180px; }
  .legend b { margin-left: auto; }
  i { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 10px; font-weight: 650; box-shadow: inset 0 0 0 1px rgba(0,0,0,.18); }
  section { break-inside: avoid; margin: 0 0 28px; }
  .plate { display: inline-block; padding: 8px; background: #fff; border: 1px solid #e4d9cc; }
  .row { display: flex; }
  .plate i { width: 18px; height: 18px; border-radius: 50%; margin: 1px; }
  @media print { body { background: white; } section { break-inside: avoid; } }
</style>
<h1>${escapeHtml(options.title)}</h1>
<p class="meta">${options.width} × ${options.height} studs · ${escapeHtml(options.pieceName)} · Not an official LEGO instruction booklet</p>
<h2>Pieces</h2>
<ul class="legend">${legendHtml}</ul>
${plates.join("")}
${depthSection}
`;
}

function depthGrid(options: { colors: string[]; width: number; height: number; depth: Uint8Array | null }): string {
  if (!options.depth) return "";
  const rows: string[] = [];
  for (let row = 0; row < options.height; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < options.width; col += 1) {
      const index = row * options.width + col;
      cells.push(`<i style="background:${options.colors[index]};color:#fff">${options.depth[index]}</i>`);
    }
    rows.push(`<div class="row">${cells.join("")}</div>`);
  }
  return `<div class="plate">${rows.join("")}</div>`;
}

function luminanceOf(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[character];
  });
}
