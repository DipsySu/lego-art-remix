import { applyAdjustments, type Adjustments, luminance } from "./color";
import { depthValues, layersFromValues } from "./depth";
import { averageCiede, countColors, quantize, type DistanceMetric, type PaletteEntry, type QuantizeAlgorithm, type TieMode } from "./quantize";

export interface MosaicRequest {
  pixels: ImageData;
  depthPixels: ImageData | null;
  algorithm: QuantizeAlgorithm;
  metric: DistanceMetric;
  tie: TieMode;
  unlimited: boolean;
  bleed: boolean;
  adjustments: Adjustments;
  entries: PaletteEntry[];
  overrides: Record<number, string>;
  depthEnabled: boolean;
  depthLevels: number;
  depthInvert: boolean;
}

export interface MosaicResult {
  width: number;
  height: number;
  adjusted: Uint8ClampedArray;
  colors: string[];
  depth: Uint8Array | null;
  usage: Map<string, number>;
  averageError: number;
  missing: { hex: string; missing: number }[];
  shortage: number;
}

export function buildMosaic(request: MosaicRequest): MosaicResult {
  const { width, height } = request.pixels;
  const adjusted = applyAdjustments(request.pixels.data, request.adjustments);
  const overrides = Array.from({ length: width * height }, (_, index) => request.overrides[index] ?? null);
  const colors = quantize(adjusted, width, request.entries, {
    algorithm: request.algorithm,
    metric: request.metric,
    tie: request.tie,
    unlimited: request.unlimited,
    bleed: request.bleed,
    overrides,
  });
  const usage = countColors(colors);
  const budget = new Map(request.entries.map((entry) => [entry.hex.toLowerCase(), entry.count]));
  const missing: { hex: string; missing: number }[] = [];
  let shortage = 0;
  if (!request.unlimited) {
    for (const [hex, count] of usage) {
      const allowed = budget.get(hex) ?? 0;
      if (count > allowed) {
        const gap = count - allowed;
        missing.push({ hex, missing: gap });
        shortage += gap;
      }
    }
    missing.sort((a, b) => b.missing - a.missing);
  }

  let depth: Uint8Array | null = null;
  if (request.depthEnabled && request.depthLevels > 1) {
    const source = request.depthPixels ? depthValues(request.depthPixels.data) : luminanceField(adjusted);
    depth = layersFromValues(source, request.depthLevels, request.depthInvert);
  }

  return {
    width,
    height,
    adjusted,
    colors,
    depth,
    usage,
    averageError: averageCiede(adjusted, colors),
    missing,
    shortage,
  };
}

function luminanceField(pixels: Uint8ClampedArray): Float64Array {
  const values = new Float64Array(pixels.length / 4);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = luminance([pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]]);
  }
  return values;
}
