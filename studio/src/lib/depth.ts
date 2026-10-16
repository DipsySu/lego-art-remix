import { luminance, type RGB } from "./color";

export function depthValues(pixels: Uint8ClampedArray): Float64Array {
  const count = pixels.length / 4;
  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const rgb: RGB = [pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]];
    values[index] = luminance(rgb);
  }
  return values;
}

/** Split values into evenly populated layers. Higher values sit closer to the viewer. */
export function layersFromValues(values: ArrayLike<number>, levels: number, invert: boolean): Uint8Array {
  const output = new Uint8Array(values.length);
  if (levels <= 1 || values.length === 0) return output;
  const sorted = Array.from(values).sort((a, b) => a - b);
  for (let index = 0; index < values.length; index += 1) {
    let level = 0;
    for (let step = 1; step < levels; step += 1) {
      const threshold = sorted[Math.floor(((sorted.length - 1) * step) / levels)];
      if (values[index] > threshold) level = step;
    }
    output[index] = invert ? levels - 1 - level : level;
  }
  return output;
}
