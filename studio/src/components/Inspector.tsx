import { useMemo, useState } from "react";
import { COLORS, SETS, colorName, setById } from "../data/catalog";
import { useI18n } from "../i18n/locale";
import type { MessageKey } from "../i18n/messages";
import { colorLabel, colorSearchText, PIECE_KEY, setLabel } from "../i18n/names";
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

const ALGORITHMS: { id: QuantizeAlgorithm; name: MessageKey; note: MessageKey }[] = [
  { id: "two-phase", name: "algoTwoPhase", note: "algoTwoPhaseNote" },
  { id: "greedy", name: "algoGreedy", note: "algoGreedyNote" },
  { id: "floyd", name: "algoFloyd", note: "algoFloydNote" },
  { id: "atkinson", name: "algoAtkinson", note: "algoAtkinsonNote" },
  { id: "jarvis", name: "algoJarvis", note: "algoJarvisNote" },
  { id: "sierra", name: "algoSierra", note: "algoSierraNote" },
];

export function Inspector(props: InspectorProps) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const [mergeId, setMergeId] = useState(SETS[0].id);
  const active = ALGORITHMS.find((item) => item.id === props.algorithm) ?? ALGORITHMS[0];
  const dithering = ["floyd", "atkinson", "jarvis", "sierra"].includes(props.algorithm);
  const set = props.paletteId === "custom" ? null : setById(props.paletteId);
  const setCopy = set ? setLabel(set.id, locale) : null;
  const numberLocale = locale === "zh" ? "zh-CN" : "en";
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return COLORS.filter((color) => colorSearchText(color.name).includes(needle) || color.hex.includes(needle)).slice(0, 8);
  }, [query]);

  function caption(hex: string): string {
    const english = colorName(hex);
    const label = colorLabel(hex, locale);
    return locale === "zh" && label !== english ? `${label} · ${english}` : label;
  }

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
          <h2 className="section-title">{t("palette")}</h2>
          <select className="select" value={props.paletteId} aria-label={t("palette")} onChange={(event) => props.onSelectSet(event.target.value)}>
            {props.paletteId === "custom" && <option value="custom">{t("customMix")}</option>}
            <optgroup label={t("sets")}>
              {SETS.filter((item) => item.kind === "set").map((item) => (
                <option key={item.id} value={item.id}>
                  {setLabel(item.id, locale).name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("openPalettes")}>
              {SETS.filter((item) => item.kind === "open").map((item) => (
                <option key={item.id} value={item.id}>
                  {setLabel(item.id, locale).name}
                </option>
              ))}
            </optgroup>
          </select>
          {setCopy && <p className="hint">{setCopy.description}</p>}
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={props.unlimited || dithering} disabled={dithering} onChange={(event) => props.onUnlimited(event.target.checked)} />
            {t("unlimited")}
          </label>
          {!props.unlimited && !dithering && (
            <p className="hint">
              {t("availableFor", {
                available: available.toLocaleString(numberLocale),
                needed: props.needed.toLocaleString(numberLocale),
              })}
            </p>
          )}
        </section>

        <section>
          <div className="section-title">
            <span>{t("paintColor")}</span>
            <span>{caption(props.paintColor)}</span>
          </div>
          {props.unlimited || dithering ? (
            <div className="swatches">
              {props.entries.map((entry) => (
                <button
                  key={entry.hex}
                  type="button"
                  className={entry.hex === props.paintColor ? "swatch on" : "swatch"}
                  style={{ background: entry.hex }}
                  title={caption(entry.hex)}
                  aria-label={caption(entry.hex)}
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
                    aria-label={t("paintWith", { name: caption(entry.hex) })}
                    onClick={() => props.onPaintColor(entry.hex)}
                  />
                  <span>{caption(entry.hex)}</span>
                  <input
                    className="number-input"
                    type="number"
                    min={0}
                    max={99999}
                    value={entry.count}
                    aria-label={t("countOf", { name: caption(entry.hex) })}
                    onChange={(event) => updateCount(entry.hex, Number(event.target.value))}
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={t("removeColor", { name: caption(entry.hex) })}
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
            placeholder={t("addColor")}
            value={query}
            aria-label={t("searchColors")}
            onChange={(event) => setQuery(event.target.value)}
          />
          {matches.length > 0 && (
            <div className="search-results">
              {matches.map((color) => (
                <button key={color.hex} type="button" onClick={() => addColor(color.hex)}>
                  <i className="dot" style={{ background: color.hex }} />
                  {caption(color.hex)}
                </button>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <select className="select" aria-label={t("mergeSet")} value={mergeId} onChange={(event) => setMergeId(event.target.value)}>
              {SETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {setLabel(item.id, locale).name}
                </option>
              ))}
            </select>
            <button className="btn tiny" type="button" onClick={() => props.onMergeSet(mergeId)}>
              {t("merge")}
            </button>
          </div>
        </section>

        <section>
          <h2 className="section-title">{t("recipe")}</h2>
          <label className="field">
            {t("algorithm")}
            <select className="select" value={props.algorithm} onChange={(event) => props.onAlgorithm(event.target.value as QuantizeAlgorithm)}>
              {ALGORITHMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.name)}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">{t(active.note)}</p>
          <label className="field" style={{ marginTop: 8 }}>
            {t("colorDistance")}
            <select className="select" value={props.metric} onChange={(event) => props.onMetric(event.target.value as DistanceMetric)}>
              <option value="ciede2000">CIEDE2000</option>
              <option value="cie76">CIE76</option>
              <option value="rgb">{t("distanceRgb")}</option>
            </select>
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            {t("piece")}
            <select className="select" value={props.piece} onChange={(event) => props.onPiece(event.target.value as PieceId)}>
              {PIECES.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(PIECE_KEY[item.id])}
                </option>
              ))}
            </select>
          </label>
          {props.algorithm === "two-phase" && !props.unlimited && (
            <label className="field" style={{ marginTop: 8 }}>
              {t("tie")}
              <select className="select" value={props.tie} onChange={(event) => props.onTie(event.target.value as TieMode)}>
                <option value="alternating">{t("tieAlternating")}</option>
                <option value="random">{t("tieRandom")}</option>
                <option value="none">{t("tieStable")}</option>
              </select>
            </label>
          )}
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={props.bleed} onChange={(event) => props.onBleed(event.target.checked)} />
            {t("bleed")}
          </label>
        </section>

        <section>
          <h2 className="section-title">{t("relief")}</h2>
          <label className="check">
            <input type="checkbox" checked={props.depthEnabled} onChange={(event) => props.onDepthEnabled(event.target.checked)} />
            {t("reliefToggle")}
          </label>
          {props.depthEnabled && (
            <>
              <div className="slider-row" style={{ marginTop: 8 }}>
                <span>{t("layers")}</span>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={props.depthLevels}
                  aria-label={t("reliefLayers")}
                  onChange={(event) => props.onDepthLevels(Number(event.target.value))}
                />
                <b>{props.depthLevels}</b>
              </div>
              <label className="check">
                <input type="checkbox" checked={props.depthInvert} onChange={(event) => props.onDepthInvert(event.target.checked)} />
                {t("invert")}
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <label className="btn tiny">
                  {props.depthName ? t("replaceDepth") : t("uploadDepth")}
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
                    {t("useBrightness")}
                  </button>
                )}
              </div>
              <p className="hint">
                {props.depthName ? t("depthNamed", { name: props.depthName }) : t("depthBrightness")}
              </p>
            </>
          )}
        </section>

        <section>
          <div className="section-title">
            <span>{t("piecesUsed")}</span>
            {props.mosaic && <span>ΔE {props.mosaic.averageError.toFixed(1)}</span>}
          </div>
          <ul className="usage">
            {used.map(([hex, count]) => {
              const allowed = budget.get(hex);
              const over = !props.unlimited && !dithering && allowed != null && count > allowed;
              return (
                <li key={hex}>
                  <i className="dot" style={{ background: hex }} />
                  <span>{caption(hex)}</span>
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
          {t("instructions")}
        </button>
        <button className="btn" type="button" onClick={props.onExportXml} disabled={!props.mosaic}>
          BrickLink XML
        </button>
        <button className="btn" type="button" onClick={props.onExportPalette}>
          {t("paletteJson")}
        </button>
        <label className="btn" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
          {t("importPalette")}
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
