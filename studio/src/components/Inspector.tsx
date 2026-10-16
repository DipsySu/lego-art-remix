import { useMemo, useState } from "react";
import { COLORS, SETS, colorName, setById } from "../data/catalog";
import type { DistanceMetric, PaletteEntry, QuantizeAlgorithm, TieMode } from "../lib/quantize";
import { PIECES, type PieceId } from "../lib/pieces";
import type { MosaicResult } from "../lib/pipeline";

interface InspectorProps {
  paletteId: string;
  entries: PaletteEntry[];
  unlimited: boolean;
  onSelectSet: (id: string) => void;
  onMergeSet: (id: string) => void;
  onUnlimited: (value: boolean) => void;
  onEntries: (entries: PaletteEntry[]) => void;
  algorithm: QuantizeAlgorithm;
  onAlgorithm: (algorithm: QuantizeAlgorithm) => void;
  metric: DistanceMetric;
  onMetric: (metric: DistanceMetric) => void;
  tie: TieMode;
  onTie: (tie: TieMode) => void;
  piece: PieceId;
  onPiece: (piece: PieceId) => void;
  bleed: boolean;
  onBleed: (value: boolean) => void;
  paintColor: string;
  onPaintColor: (hex: string) => void;
  depthEnabled: boolean;
  onDepthEnabled: (value: boolean) => void;
  depthLevels: number;
  onDepthLevels: (value: number) => void;
  depthInvert: boolean;
  onDepthInvert: (value: boolean) => void;
  onDepthFile: (file: File) => void;
  depthName: string | null;
  onClearDepth: () => void;
  mosaic: MosaicResult | null;
  needed: number;
  onExportPng: () => void;
  onExportInstructions: () => void;
  onExportXml: () => void;
  onExportPalette: () => void;
  onImportPalette: (file: File) => void;
}

const ALGORITHMS: { id: QuantizeAlgorithm; name: string; note: string }[] = [
  { id: "two-phase", name: "Match, then fit", note: "Closest color first. Overflow studs move to the next available color." },
  { id: "greedy", name: "Greedy", note: "Scarce colors go to the studs that need them most." },
  { id: "floyd", name: "Floyd–Steinberg", note: "Fine dither. Ignores piece counts so the pattern can form." },
  { id: "atkinson", name: "Atkinson", note: "Lighter dither that keeps more of the original contrast." },
  { id: "jarvis", name: "Jarvis–Judice–Ninke", note: "Wider dither, softer grain." },
  { id: "sierra", name: "Sierra", note: "A middle ground between Floyd and Jarvis." },
];

export function Inspector(props: InspectorProps) {
  const [query, setQuery] = useState("");
  const [mergeId, setMergeId] = useState(SETS[0].id);
  const active = ALGORITHMS.find((item) => item.id === props.algorithm) ?? ALGORITHMS[0];
  const dithering = ["floyd", "atkinson", "jarvis", "sierra"].includes(props.algorithm);
  const set = props.paletteId === "custom" ? null : setById(props.paletteId);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return COLORS.filter((color) => color.name.toLowerCase().includes(needle) || color.hex.includes(needle)).slice(0, 6);
  }, [query]);

  const used = props.mosaic ? [...props.mosaic.usage.entries()].sort((a, b) => b[1] - a[1]) : [];
  const budget = new Map(props.entries.map((entry) => [entry.hex, entry.count]));
  const available = props.entries.reduce((sum, entry) => sum + entry.count, 0);

  function updateCount(hex: string, count: number) {
    props.onEntries(props.entries.map((entry) => (entry.hex === hex ? { ...entry, count: Math.max(0, count) } : entry)));
  }

  function addColor(hex: string) {
    if (props.entries.some((entry) => entry.hex === hex)) {
      props.onPaintColor(hex);
      return;
    }
    props.onEntries([...props.entries, { hex, count: props.unlimited ? 99999 : 200 }]);
    props.onPaintColor(hex);
    setQuery("");
  }

  return (
    <aside className="panel inspector">
      <div className="panel-scroll">
        <section>
          <h2 className="section-title">Palette</h2>
          <select className="select" value={props.paletteId} aria-label="Palette" onChange={(event) => props.onSelectSet(event.target.value)}>
            {props.paletteId === "custom" && <option value="custom">Custom mix</option>}
            <optgroup label="Sets">
              {SETS.filter((item) => item.kind === "set").map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Open palettes">
              {SETS.filter((item) => item.kind === "open").map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
          {set && <p className="hint">{set.description}</p>}
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={props.unlimited || dithering} disabled={dithering} onChange={(event) => props.onUnlimited(event.target.checked)} />
            Unlimited counts
          </label>
          {!props.unlimited && !dithering && (
            <p className="hint">
              {available.toLocaleString()} available for {props.needed.toLocaleString()} studs.
            </p>
          )}
        </section>

        <section>
          <div className="section-title">
            <span>Paint color</span>
            <span>{colorName(props.paintColor)}</span>
          </div>
          {props.unlimited || dithering ? (
            <div className="swatches">
              {props.entries.map((entry) => (
                <button
                  key={entry.hex}
                  type="button"
                  className={entry.hex === props.paintColor ? "swatch on" : "swatch"}
                  style={{ background: entry.hex }}
                  title={colorName(entry.hex)}
                  aria-label={colorName(entry.hex)}
                  onClick={() => props.onPaintColor(entry.hex)}
                />
              ))}
            </div>
          ) : (
            <ul className="inventory">
              {props.entries.map((entry) => (
                <li key={entry.hex}>
                  <button
                    type="button"
                    className={entry.hex === props.paintColor ? "swatch on" : "swatch"}
                    style={{ background: entry.hex }}
                    aria-label={`Paint with ${colorName(entry.hex)}`}
                    onClick={() => props.onPaintColor(entry.hex)}
                  />
                  <span>{colorName(entry.hex)}</span>
                  <input
                    className="number-input"
                    type="number"
                    min={0}
                    max={99999}
                    value={entry.count}
                    aria-label={`${colorName(entry.hex)} count`}
                    onChange={(event) => updateCount(entry.hex, Number(event.target.value))}
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={`Remove ${colorName(entry.hex)}`}
                    onClick={() => {
                      if (props.entries.length === 1) return;
                      props.onEntries(props.entries.filter((item) => item.hex !== entry.hex));
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            className="text-input"
            style={{ marginTop: 8 }}
            placeholder="Add a BrickLink color"
            value={query}
            aria-label="Search colors"
            onChange={(event) => setQuery(event.target.value)}
          />
          {matches.length > 0 && (
            <div className="search-results">
              {matches.map((color) => (
                <button key={color.hex} type="button" onClick={() => addColor(color.hex)}>
                  <i className="dot" style={{ background: color.hex }} />
                  {color.name}
                </button>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <select className="select" aria-label="Set to merge" value={mergeId} onChange={(event) => setMergeId(event.target.value)}>
              {SETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="btn tiny" type="button" onClick={() => props.onMergeSet(mergeId)}>
              Merge
            </button>
          </div>
        </section>

        <section>
          <h2 className="section-title">Recipe</h2>
          <label className="field">
            Algorithm
            <select className="select" value={props.algorithm} onChange={(event) => props.onAlgorithm(event.target.value as QuantizeAlgorithm)}>
              {ALGORITHMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">{active.note}</p>
          <label className="field" style={{ marginTop: 8 }}>
            Color distance
            <select className="select" value={props.metric} onChange={(event) => props.onMetric(event.target.value as DistanceMetric)}>
              <option value="ciede2000">CIEDE2000</option>
              <option value="cie76">CIE76</option>
              <option value="rgb">Euclidean RGB</option>
            </select>
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            Piece
            <select className="select" value={props.piece} onChange={(event) => props.onPiece(event.target.value as PieceId)}>
              {PIECES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {props.algorithm === "two-phase" && !props.unlimited && (
            <label className="field" style={{ marginTop: 8 }}>
              When colors tie
              <select className="select" value={props.tie} onChange={(event) => props.onTie(event.target.value as TieMode)}>
                <option value="alternating">Alternating</option>
                <option value="random">Random</option>
                <option value="none">Stable</option>
              </select>
            </label>
          )}
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={props.bleed} onChange={(event) => props.onBleed(event.target.checked)} />
            Match tiles on a black base
          </label>
        </section>

        <section>
          <h2 className="section-title">Relief</h2>
          <label className="check">
            <input type="checkbox" checked={props.depthEnabled} onChange={(event) => props.onDepthEnabled(event.target.checked)} />
            Stack brighter studs forward
          </label>
          {props.depthEnabled && (
            <>
              <div className="slider-row" style={{ marginTop: 8 }}>
                <span>Layers</span>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={props.depthLevels}
                  aria-label="Relief layers"
                  onChange={(event) => props.onDepthLevels(Number(event.target.value))}
                />
                <b>{props.depthLevels}</b>
              </div>
              <label className="check">
                <input type="checkbox" checked={props.depthInvert} onChange={(event) => props.onDepthInvert(event.target.checked)} />
                Invert
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <label className="btn tiny">
                  {props.depthName ? "Replace depth" : "Upload depth"}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) props.onDepthFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {props.depthName && (
                  <button className="btn tiny" type="button" onClick={props.onClearDepth}>
                    Use brightness
                  </button>
                )}
              </div>
              <p className="hint">
                {props.depthName
                  ? `Depth picture: ${props.depthName}.`
                  : "Uses brightness. Upload a depth picture if you already have one."}
              </p>
            </>
          )}
        </section>

        <section>
          <div className="section-title">
            <span>Pieces used</span>
            {props.mosaic && <span>ΔE {props.mosaic.averageError.toFixed(1)}</span>}
          </div>
          <ul className="usage">
            {used.map(([hex, count]) => {
              const allowed = budget.get(hex);
              const over = !props.unlimited && !dithering && allowed != null && count > allowed;
              return (
                <li key={hex}>
                  <i className="dot" style={{ background: hex }} />
                  <span>{colorName(hex)}</span>
                  <b className={over ? "over" : undefined}>
                    {count}
                    {!props.unlimited && !dithering && allowed != null ? ` / ${allowed}` : ""}
                  </b>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div className="export-bar">
        <button className="btn primary" type="button" onClick={props.onExportPng} disabled={!props.mosaic}>
          PNG
        </button>
        <button className="btn" type="button" onClick={props.onExportInstructions} disabled={!props.mosaic}>
          Instructions
        </button>
        <button className="btn" type="button" onClick={props.onExportXml} disabled={!props.mosaic}>
          BrickLink XML
        </button>
        <button className="btn" type="button" onClick={props.onExportPalette}>
          Palette JSON
        </button>
        <label className="btn" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
          Import palette
          <input
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onImportPalette(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </aside>
  );
}
