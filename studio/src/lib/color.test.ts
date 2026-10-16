import { describe, expect, it } from "vitest";
import { adjustBrightness, ciede2000, hexToRgb, rgbToHex, rgbToLab } from "./color";

describe("color", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(...hexToRgb("#42c0fb"))).toBe("#42c0fb");
  });

  it("matches a published CIEDE2000 pair", () => {
    const delta = ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485]);
    expect(delta).toBeCloseTo(2.0425, 3);
  });

  it("treats identical colors as zero distance", () => {
    const lab = rgbToLab([180, 40, 40]);
    expect(ciede2000(lab, lab)).toBeCloseTo(0, 6);
  });

  it("raises brightness without leaving 0–255", () => {
    expect(adjustBrightness([250, 10, 0], 20)).toEqual([255, 30, 20]);
  });
});
