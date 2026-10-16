export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function clamp255(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace("#", "").trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : cleaned;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => clamp255(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function darkenRgb(rgb: RGB): RGB {
  return rgb.map((channel) => Math.round((channel * Math.PI) / 4)) as RGB;
}

function pivotRgb(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(rgb: RGB): Lab {
  const r = pivotRgb(rgb[0]);
  const g = pivotRgb(rgb[1]);
  const b = pivotRgb(rgb[2]);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function cie76(lab1: Lab, lab2: Lab): number {
  return Math.hypot(lab1[0] - lab2[0], lab1[1] - lab2[1], lab1[2] - lab2[2]);
}

function hueDegrees(y: number, x: number): number {
  if (Math.hypot(x, y) < 1e-8) return 0;
  return (Math.atan2(y, x) * 180) / Math.PI + (Math.atan2(y, x) < 0 ? 360 : 0);
}

/** CIEDE2000 color difference. Verified against Sharma's published sample pairs. */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const avgL = (l1 + l2) / 2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const avgCp = (c1p + c2p) / 2;
  const h1p = hueDegrees(b1, a1p);
  const h2p = hueDegrees(b2, a2p);

  let deltaHue: number;
  if (c1p < 1e-8 || c2p < 1e-8) deltaHue = 0;
  else if (Math.abs(h2p - h1p) <= 180) deltaHue = h2p - h1p;
  else if (h2p - h1p > 180) deltaHue = h2p - h1p - 360;
  else deltaHue = h2p - h1p + 360;

  const deltaL = l2 - l1;
  const deltaC = c2p - c1p;
  const deltaH = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltaHue * Math.PI) / 360);

  let avgHp: number;
  if (c1p < 1e-8 || c2p < 1e-8) avgHp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) / 2;
  else avgHp = (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);
  const deltaRo = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const rt = -Math.sin((2 * deltaRo * Math.PI) / 180) * rc;

  return Math.sqrt((deltaL / sl) ** 2 + (deltaC / sc) ** 2 + (deltaH / sh) ** 2 + rt * (deltaC / sc) * (deltaH / sh));
}

export function rgbEuclidean(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const v = Math.max(r, g, b);
  const n = v - Math.min(r, g, b);
  const h = n === 0 ? 0 : v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
  return [60 * (h < 0 ? h + 6 : h), v === 0 ? 0 : n / v, v];
}

export function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return [f(5), f(3), f(1)];
}

export function adjustHsv(rgb: RGB, hue: number, saturation: number, value: number): RGB {
  const scaled = rgb.map((channel) => channel / 255) as RGB;
  const base = rgb2hsv(scaled[0], scaled[1], scaled[2]);
  const nextHue = (base[0] + Math.round(hue) + 360) % 360;
  const nextSaturation = Math.min(1, Math.max(0, base[1] + saturation));
  const nextValue = Math.min(1, Math.max(0, base[2] + value));
  const result = hsv2rgb(nextHue, nextSaturation, nextValue);
  return result.map((channel) => Math.round(channel * 255)) as RGB;
}

export function adjustBrightness(rgb: RGB, offset: number): RGB {
  return rgb.map((channel) => clamp255(channel + offset)) as RGB;
}

export function adjustContrast(rgb: RGB, offset: number): RGB {
  const factor = (259 * (255 + offset)) / (255 * (259 - offset));
  return rgb.map((channel) => clamp255(factor * (channel - 128) + 128)) as RGB;
}

export interface Adjustments {
  hue: number;
  saturation: number;
  value: number;
  brightness: number;
  contrast: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  hue: 0,
  saturation: 0,
  value: 0,
  brightness: 0,
  contrast: 0,
};

export function applyAdjustments(pixels: Uint8ClampedArray, adjustments: Adjustments): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels);
  const identity =
    adjustments.hue === 0 &&
    adjustments.saturation === 0 &&
    adjustments.value === 0 &&
    adjustments.brightness === 0 &&
    adjustments.contrast === 0;
  if (identity) return output;

  for (let index = 0; index < pixels.length; index += 4) {
    let rgb: RGB = [pixels[index], pixels[index + 1], pixels[index + 2]];
    rgb = adjustHsv(rgb, adjustments.hue, adjustments.saturation / 100, adjustments.value / 100);
    rgb = adjustBrightness(rgb, adjustments.brightness);
    rgb = adjustContrast(rgb, adjustments.contrast);
    output[index] = rgb[0];
    output[index + 1] = rgb[1];
    output[index + 2] = rgb[2];
  }
  return output;
}

export function luminance(rgb: RGB): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}
