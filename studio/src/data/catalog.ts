import catalog from "./catalog.json";

export interface CatalogColor {
  name: string;
  hex: string;
  id: number;
}

export interface CatalogSet {
  id: string;
  name: string;
  officialName: string;
  description: string;
  kind: "set" | "open";
  studs: [string, number][];
}

export const COLORS = catalog.colors as CatalogColor[];
export const SETS = catalog.sets as CatalogSet[];

export const COLOR_BY_HEX = new Map(COLORS.map((color) => [color.hex, color]));

export function colorName(hex: string): string {
  return COLOR_BY_HEX.get(hex.toLowerCase())?.name ?? hex.toUpperCase();
}

export function setById(id: string): CatalogSet {
  return SETS.find((set) => set.id === id) ?? SETS[0];
}

export function entriesFromSet(set: CatalogSet): { hex: string; count: number }[] {
  return set.studs.map(([hex, count]) => ({ hex, count }));
}
