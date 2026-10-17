export type PieceId = "round-tile" | "round-plate" | "square-tile" | "square-plate" | "brick";

export interface PieceSpec {
  id: PieceId;
  name: string;
  part: string;
  shape: "round" | "square";
  stud: boolean;
  bleeds: boolean;
}

export const PIECES: PieceSpec[] = [
  { id: "round-tile", name: "Round tile", part: "98138", shape: "round", stud: false, bleeds: true },
  { id: "round-plate", name: "Round plate", part: "4073", shape: "round", stud: true, bleeds: true },
  { id: "square-tile", name: "Square tile", part: "3070b", shape: "square", stud: false, bleeds: false },
  { id: "square-plate", name: "Square plate", part: "3024", shape: "square", stud: true, bleeds: false },
  { id: "brick", name: "1×1 brick", part: "3005", shape: "square", stud: true, bleeds: false },
];

export function pieceById(id: PieceId): PieceSpec {
  return PIECES.find((piece) => piece.id === id) ?? PIECES[0];
}
