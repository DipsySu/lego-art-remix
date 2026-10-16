import {
  type Lab,
  type RGB,
  ciede2000,
  cie76,
  darkenRgb,
  hexToRgb,
  rgbEuclidean,
  rgbToLab,
} from "./color";

export type DistanceMetric = "ciede2000" | "cie76" | "rgb";
export type QuantizeAlgorithm = "two-phase" | "greedy" | "floyd" | "atkinson" | "jarvis" | "sierra";
export type TieMode = "none" | "random" | "alternating";

export interface PaletteEntry {
  hex: string;
  count: number;
}

export interface PreparedSwatch {
  hex: string;
  rgb: RGB;
  lab: Lab;
  matchRgb: RGB;
  matchLab: Lab;
  count: number;
}

export interface QuantizeOptions {
  algorithm: QuantizeAlgorithm;
  metric: DistanceMetric;
  tie: TieMode;
  unlimited: boolean;
  bleed: boolean;
  overrides: (string | null)[];
}

interface KernelTap {
  row: number;
  col: number;
  val: number;
}

const FLOYD: KernelTap[] = [
  { row: 0, col: 1, val: 7 },
  { row: 1, col: -1, val: 3 },
  { row: 1, col: 0, val: 5 },
  { row: 1, col: 1, val: 1 },
];

const JARVIS: KernelTap[] = [
  { row: 0, col: 1, val: 7 },
  { row: 0, col: 2, val: 5 },
  { row: 1, col: -2, val: 3 },
  { row: 1, col: -1, val: 5 },
  { row: 1, col: 0, val: 7 },
  { row: 1, col: 1, val: 5 },
  { row: 1, col: 2, val: 3 },
  { row: 2, col: -2, val: 1 },
  { row: 2, col: -1, val: 3 },
  { row: 2, col: 0, val: 5 },
  { row: 2, col: 1, val: 3 },
  { row: 2, col: 2, val: 1 },
];

const SIERRA: KernelTap[] = [
  { row: 0, col: 1, val: 5 },
  { row: 0, col: 2, val: 3 },
  { row: 1, col: -2, val: 2 },
  { row: 1, col: -1, val: 4 },
  { row: 1, col: 0, val: 5 },
  { row: 1, col: 1, val: 4 },
  { row: 1, col: 2, val: 2 },
  { row: 2, col: -1, val: 2 },
  { row: 2, col: 0, val: 3 },
  { row: 2, col: 1, val: 2 },
];

/** Classic Atkinson keeps a quarter of the error, which avoids the harsh crawl of full diffusion. */
const ATKINSON: KernelTap[] = [
  { row: 0, col: 1, val: 1 },
  { row: 0, col: 2, val: 1 },
  { row: 1, col: -1, val: 1 },
  { row: 1, col: 0, val: 1 },
  { row: 1, col: 1, val: 1 },
  { row: 2, col: 0, val: 1 },
];

const KERNELS: Record<Exclude<QuantizeAlgorithm, "two-phase" | "greedy">, { taps: KernelTap[]; divisor: number }> = {
  floyd: { taps: FLOYD, divisor: 16 },
  jarvis: { taps: JARVIS, divisor: 48 },
  sierra: { taps: SIERRA, divisor: 32 },
  atkinson: { taps: ATKINSON, divisor: 8 },
};

const TIE_RATIO = 0.001;

export function prepareSwatches(entries: PaletteEntry[], bleed: boolean): PreparedSwatch[] {
  const seen = new Set<string>();
  const swatches: PreparedSwatch[] = [];
  for (const entry of entries) {
    const hex = entry.hex.toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    const rgb = hexToRgb(hex);
    const matchRgb = bleed ? darkenRgb(rgb) : rgb;
    swatches.push({
      hex,
      rgb,
      lab: rgbToLab(rgb),
      matchRgb,
      matchLab: rgbToLab(matchRgb),
      count: entry.count,
    });
  }
  return swatches;
}

function distance(metric: DistanceMetric, rgb: RGB, lab: Lab, swatch: PreparedSwatch): number {
  if (metric === "rgb") return rgbEuclidean(rgb, swatch.matchRgb);
  if (metric === "cie76") return cie76(lab, swatch.matchLab);
  return ciede2000(lab, swatch.matchLab);
}

function nearest(
  rgb: RGB,
  lab: Lab,
  swatches: PreparedSwatch[],
  metric: DistanceMetric,
): { swatch: PreparedSwatch; dist: number } {
  let best = swatches[0];
  let bestDistance = Infinity;
  for (const swatch of swatches) {
    const next = distance(metric, rgb, lab, swatch);
    if (next < bestDistance) {
      best = swatch;
      bestDistance = next;
    }
  }
  return { swatch: best, dist: bestDistance };
}

function workingSample(rgb: RGB, bleed: boolean): { rgb: RGB; lab: Lab } {
  const sample = bleed ? darkenRgb(rgb) : rgb;
  return { rgb: sample, lab: rgbToLab(sample) };
}

function tieFactor(mode: TieMode, row: number, col: number, width: number): number {
  if (mode === "random") return TIE_RATIO * Math.random();
  if (mode === "alternating") {
    return (
      TIE_RATIO *
      (((row + col) % 2) +
        ((row + width - col) % 3) * TIE_RATIO +
        ((row + col) % 4) * TIE_RATIO * TIE_RATIO +
        ((row + width - col) % 5) * TIE_RATIO * TIE_RATIO * TIE_RATIO)
    );
  }
  return TIE_RATIO;
}

function swatchForHex(hex: string, swatches: PreparedSwatch[], bleed: boolean): PreparedSwatch {
  const normalized = hex.toLowerCase();
  return swatches.find((swatch) => swatch.hex === normalized) ?? prepareSwatches([{ hex: normalized, count: 0 }], bleed)[0];
}

function twoPhase(
  rgbs: RGB[],
  width: number,
  swatches: PreparedSwatch[],
  options: QuantizeOptions,
): string[] {
  const pool = options.unlimited ? swatches : swatches.filter((swatch) => swatch.count > 0);
  if (pool.length === 0) return rgbs.map(() => swatches[0]?.hex ?? "#000000");

  const chosen: PreparedSwatch[] = new Array(rgbs.length);
  const distances: number[] = new Array(rgbs.length);
  const samples = rgbs.map((rgb) => workingSample(rgb, options.bleed));

  for (let index = 0; index < rgbs.length; index += 1) {
    const locked = options.overrides[index];
    if (locked) {
      chosen[index] = swatchForHex(locked, swatches, options.bleed);
      distances[index] = 0;
    } else {
      const hit = nearest(samples[index].rgb, samples[index].lab, pool, options.metric);
      chosen[index] = hit.swatch;
      distances[index] = hit.dist;
    }
  }

  if (options.unlimited) return chosen.map((swatch) => swatch.hex);

  const remaining = new Map(pool.map((swatch) => [swatch.hex, swatch.count]));
  for (let index = 0; index < rgbs.length; index += 1) {
    if (!options.overrides[index]) continue;
    const hex = chosen[index].hex;
    remaining.set(hex, (remaining.get(hex) ?? 0) - 1);
  }

  const buckets = new Map<string, { index: number; dist: number }[]>();
  for (let index = 0; index < rgbs.length; index += 1) {
    if (options.overrides[index]) continue;
    const row = Math.floor(index / width);
    const col = index % width;
    const hex = chosen[index].hex;
    const list = buckets.get(hex) ?? [];
    list.push({ index, dist: distances[index] + tieFactor(options.tie, row, col, width) });
    buckets.set(hex, list);
  }

  const problematic: { index: number; dist: number }[] = [];
  for (const [hex, list] of buckets) {
    list.sort((a, b) => b.dist - a.dist);
    let available = Math.max(0, remaining.get(hex) ?? 0);
    while (list.length > 0 && available > 0) {
      list.pop();
      available -= 1;
    }
    remaining.set(hex, available);
    for (const item of list) problematic.push(item);
  }

  for (const [hex, count] of remaining) {
    if (count <= 0) remaining.delete(hex);
  }

  problematic.sort((a, b) => b.dist - a.dist);
  for (const problem of problematic) {
    const index = problem.index;
    const available = pool.filter((swatch) => (remaining.get(swatch.hex) ?? 0) > 0);
    if (available.length === 0) break;
    const hit = nearest(samples[index].rgb, samples[index].lab, available, options.metric);
    chosen[index] = hit.swatch;
    const left = (remaining.get(hit.swatch.hex) ?? 0) - 1;
    if (left <= 0) remaining.delete(hit.swatch.hex);
    else remaining.set(hit.swatch.hex, left);
  }

  return chosen.map((swatch) => swatch.hex);
}

function diffuse(
  rgbs: RGB[],
  width: number,
  swatches: PreparedSwatch[],
  options: QuantizeOptions,
  kernel: { taps: KernelTap[]; divisor: number },
): string[] {
  const pool = options.unlimited ? swatches : swatches.filter((swatch) => swatch.count > 0);
  const height = rgbs.length / width;
  const matrix: RGB[][] = [];
  for (let row = 0; row < height; row += 1) {
    matrix[row] = [];
    for (let col = 0; col < width; col += 1) {
      matrix[row][col] = workingSample(rgbs[row * width + col], options.bleed).rgb;
    }
  }

  const output: string[] = new Array(rgbs.length);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      const locked = options.overrides[index];
      if (locked) {
        output[index] = swatchForHex(locked, swatches, options.bleed).hex;
        continue;
      }
      const current = matrix[row][col];
      const sample = { rgb: current, lab: rgbToLab(current) };
      const hit = nearest(sample.rgb, sample.lab, pool.length ? pool : swatches, options.metric);
      output[index] = hit.swatch.hex;
      const error: RGB = [
        current[0] - hit.swatch.matchRgb[0],
        current[1] - hit.swatch.matchRgb[1],
        current[2] - hit.swatch.matchRgb[2],
      ];
      for (const tap of kernel.taps) {
        const nextRow = matrix[row + tap.row];
        if (!nextRow || nextRow[col + tap.col] == null) continue;
        const pixel = nextRow[col + tap.col];
        nextRow[col + tap.col] = [
          clampChannel(pixel[0] + (error[0] * tap.val) / kernel.divisor),
          clampChannel(pixel[1] + (error[1] * tap.val) / kernel.divisor),
          clampChannel(pixel[2] + (error[2] * tap.val) / kernel.divisor),
        ];
      }
    }
  }
  return output;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value));
}

interface HeapNode {
  index: number;
  dist: number;
  generation: number;
}

function greedy(rgbs: RGB[], swatches: PreparedSwatch[], options: QuantizeOptions): string[] {
  const pool = swatches.filter((swatch) => swatch.count > 0);
  if (options.unlimited || pool.length === 0) return twoPhase(rgbs, 1, swatches, { ...options, algorithm: "two-phase" });

  const samples = rgbs.map((rgb) => workingSample(rgb, options.bleed));
  const remaining = new Map(pool.map((swatch) => [swatch.hex, swatch.count]));
  const output: (string | null)[] = rgbs.map((_, index) => options.overrides[index]?.toLowerCase() ?? null);
  for (let index = 0; index < output.length; index += 1) {
    const locked = output[index];
    if (!locked) continue;
    remaining.set(locked, (remaining.get(locked) ?? 0) - 1);
  }

  const generation = new Uint32Array(rgbs.length);
  const heap: HeapNode[] = [];
  const push = (node: HeapNode) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].dist >= heap[index].dist) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  };
  const pop = (): HeapNode | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let index = 0;
      for (;;) {
        let largest = index;
        const left = index * 2 + 1;
        const right = left + 1;
        if (left < heap.length && heap[left].dist > heap[largest].dist) largest = left;
        if (right < heap.length && heap[right].dist > heap[largest].dist) largest = right;
        if (largest === index) break;
        [heap[index], heap[largest]] = [heap[largest], heap[index]];
        index = largest;
      }
    }
    return top;
  };

  const availableSwatches = () => pool.filter((swatch) => (remaining.get(swatch.hex) ?? 0) > 0);

  const consider = (index: number) => {
    if (output[index]) return;
    const choices = availableSwatches();
    if (choices.length === 0) return;
    const hit = nearest(samples[index].rgb, samples[index].lab, choices, options.metric);
    push({ index, dist: hit.dist, generation: generation[index] });
  };

  for (let index = 0; index < rgbs.length; index += 1) consider(index);

  while (heap.length > 0) {
    const node = pop();
    if (!node || node.generation !== generation[node.index] || output[node.index]) continue;
    const choices = availableSwatches();
    if (choices.length === 0) break;
    const hit = nearest(samples[node.index].rgb, samples[node.index].lab, choices, options.metric);
    output[node.index] = hit.swatch.hex;
    const left = (remaining.get(hit.swatch.hex) ?? 0) - 1;
    remaining.set(hit.swatch.hex, left);
    if (left <= 0) {
      for (let index = 0; index < rgbs.length; index += 1) {
        if (!output[index]) generation[index] += 1;
      }
      for (let index = 0; index < rgbs.length; index += 1) consider(index);
    }
  }

  return output.map((hex, index) => {
    if (hex) return hex;
    return nearest(samples[index].rgb, samples[index].lab, swatches, options.metric).swatch.hex;
  });
}

export function quantize(pixels: Uint8ClampedArray, width: number, entries: PaletteEntry[], options: QuantizeOptions): string[] {
  const swatches = prepareSwatches(entries, options.bleed);
  if (swatches.length === 0) return [];
  const count = pixels.length / 4;
  const rgbs: RGB[] = [];
  for (let index = 0; index < count; index += 1) {
    rgbs.push([pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]]);
  }

  if (options.algorithm === "greedy") return greedy(rgbs, swatches, options);
  if (options.algorithm === "two-phase") return twoPhase(rgbs, width, swatches, options);
  return diffuse(rgbs, width, swatches, options, KERNELS[options.algorithm]);
}

export function countColors(colors: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  return counts;
}

export function averageCiede(pixels: Uint8ClampedArray, colors: string[]): number {
  if (colors.length === 0) return 0;
  const cache = new Map<string, Lab>();
  let total = 0;
  for (let index = 0; index < colors.length; index += 1) {
    const hex = colors[index];
    let lab = cache.get(hex);
    if (!lab) {
      lab = rgbToLab(hexToRgb(hex));
      cache.set(hex, lab);
    }
    const pixelLab = rgbToLab([pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]]);
    total += ciede2000(pixelLab, lab);
  }
  return total / colors.length;
}
