import { describe, expect, it } from "vitest";
import { countColors, quantize } from "./quantize";

function solid(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = rgb[0];
    pixels[index * 4 + 1] = rgb[1];
    pixels[index * 4 + 2] = rgb[2];
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

const redBlue = [
  { hex: "#ff0000", count: 1 },
  { hex: "#0000ff", count: 8 },
];

describe("quantize", () => {
  it("keeps limited colors inside their counts", () => {
    const colors = quantize(solid(2, 2, [255, 0, 0]), 2, redBlue, {
      algorithm: "two-phase",
      metric: "ciede2000",
      tie: "none",
      unlimited: false,
      bleed: false,
      overrides: [null, null, null, null],
    });
    const counts = countColors(colors);
    expect(counts.get("#ff0000")).toBe(1);
    expect(counts.get("#0000ff")).toBe(3);
  });

  it("locks painted studs before spending the rest of the budget", () => {
    const colors = quantize(solid(2, 1, [255, 0, 0]), 2, redBlue, {
      algorithm: "two-phase",
      metric: "ciede2000",
      tie: "none",
      unlimited: false,
      bleed: false,
      overrides: ["#0000ff", null],
    });
    expect(colors[0]).toBe("#0000ff");
    expect(colors[1]).toBe("#ff0000");
  });

  it("dithers a flat mid-gray instead of painting it one color", () => {
    const nearest = quantize(solid(8, 2, [128, 128, 128]), 8, [
      { hex: "#000000", count: 99 },
      { hex: "#ffffff", count: 99 },
    ], {
      algorithm: "two-phase",
      metric: "rgb",
      tie: "none",
      unlimited: true,
      bleed: false,
      overrides: Array(16).fill(null),
    });
    const dithered = quantize(solid(8, 2, [128, 128, 128]), 8, [
      { hex: "#000000", count: 99 },
      { hex: "#ffffff", count: 99 },
    ], {
      algorithm: "floyd",
      metric: "rgb",
      tie: "none",
      unlimited: true,
      bleed: false,
      overrides: Array(16).fill(null),
    });
    expect(new Set(nearest).size).toBe(1);
    expect(new Set(dithered).size).toBeGreaterThan(1);
  });
});
