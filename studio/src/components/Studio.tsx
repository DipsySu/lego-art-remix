import { useCallback, useEffect, useRef, useState } from "react";
import { entriesFromSet, setById } from "../data/catalog";
import { NEUTRAL_ADJUSTMENTS, type Adjustments } from "../lib/color";
import {
  canvasToPng,
  downloadText,
  instructionsHtml,
  paletteDocument,
  parsePalette,
  wantedListXml,
} from "../lib/export";
import { coverCrop, loadImage, readFileAsDataUrl, reshapeCrop, sampleCrop, type Crop } from "../lib/image";
import { pieceById, type PieceId } from "../lib/pieces";
import { buildMosaic, type MosaicResult } from "../lib/pipeline";
import type { DistanceMetric, PaletteEntry, QuantizeAlgorithm, TieMode } from "../lib/quantize";
import { drawMosaic } from "../lib/render";
import { Inspector } from "./Inspector";
import { SourcePanel } from "./SourcePanel";
import { Stage, type PreviewMode, type Tool } from "./Stage";

const SAMPLES = [
  { name: "Lenna", url: "/png/lenna.png" },
  { name: "Hogwarts crest", url: "/png/lego-art-remix-discount-hogwarts-crest.png" },
];

const DITHERS = new Set<QuantizeAlgorithm>(["floyd", "atkinson", "jarvis", "sierra"]);

function clampSize(value: number): number {
  if (!Number.isFinite(value)) return 48;
  return Math.min(160, Math.max(8, Math.round(value)));
}

export function Studio() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("Photo");
  const [crop, setCrop] = useState<Crop | null>(null);
  const [studsW, setStudsW] = useState(48);
  const [studsH, setStudsH] = useState(48);
  const [linked, setLinked] = useState(false);
  const ratioRef = useRef(1);
  const [smooth, setSmooth] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const [paletteId, setPaletteId] = useState("all_tile_colors");
  const [entries, setEntries] = useState<PaletteEntry[]>(() => entriesFromSet(setById("all_tile_colors")));
  const [unlimited, setUnlimited] = useState(true);
  const [algorithm, setAlgorithm] = useState<QuantizeAlgorithm>("two-phase");
  const [metric, setMetric] = useState<DistanceMetric>("ciede2000");
  const [tie, setTie] = useState<TieMode>("alternating");
  const [piece, setPiece] = useState<PieceId>("round-tile");
  const [bleed, setBleed] = useState(true);
  const [paintColor, setPaintColor] = useState("#42c0fb");
  const [paint, setPaint] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<Record<number, string>[]>([]);
  const [future, setFuture] = useState<Record<number, string>[]>([]);
  const [tool, setTool] = useState<Tool>("pan");
  const [view, setView] = useState<PreviewMode>("studs");
  const [split, setSplit] = useState(0.5);
  const [showEdits, setShowEdits] = useState(true);
  const [depthEnabled, setDepthEnabled] = useState(false);
  const [depthLevels, setDepthLevels] = useState(3);
  const [depthInvert, setDepthInvert] = useState(false);
  const [depthImage, setDepthImage] = useState<HTMLImageElement | null>(null);
  const [depthName, setDepthName] = useState<string | null>(null);
  const [mosaic, setMosaic] = useState<MosaicResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aboutRef = useRef<HTMLDialogElement>(null);
  const blobUrl = useRef<string | null>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const dragDepth = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("art-remix-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openUrl = useCallback(async (url: string, name: string) => {
    const next = await loadImage(url);
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
    setImage(next);
    setImageName(name);
  }, []);

  const openFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const next = await loadImage(url);
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = url;
      setImage(next);
      setImageName(file.name);
    } catch {
      URL.revokeObjectURL(url);
      setNotice("That image could not be opened.");
    }
  }, []);

  useEffect(() => {
    if (!image) return;
    setCrop((current) =>
      current
        ? reshapeCrop(current, studsW / studsH, image.naturalWidth, image.naturalHeight)
        : coverCrop(image.naturalWidth, image.naturalHeight, studsW / studsH),
    );
  }, [image, studsW, studsH]);

  useEffect(() => {
    setPaint({});
    setHistory([]);
    setFuture([]);
  }, [image, studsW, studsH]);

  useEffect(() => {
    if (!image || !crop) return;
    let cancelled = false;
    const handle = window.requestAnimationFrame(() => {
      const pixels = sampleCrop(image, crop, studsW, studsH, smooth);
      const depthPixels = depthImage ? sampleCrop(depthImage, crop, studsW, studsH, true) : null;
      const result = buildMosaic({
        pixels,
        depthPixels,
        algorithm,
        metric,
        tie,
        unlimited: unlimited || DITHERS.has(algorithm),
        bleed,
        adjustments,
        entries,
        overrides: paint,
        depthEnabled,
        depthLevels,
        depthInvert,
      });
      if (!cancelled) setMosaic(result);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(handle);
    };
  }, [
    image,
    crop,
    studsW,
    studsH,
    smooth,
    depthImage,
    algorithm,
    metric,
    tie,
    unlimited,
    bleed,
    adjustments,
    entries,
    paint,
    depthEnabled,
    depthLevels,
    depthInvert,
  ]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
      if (file) void openFile(file);
    }
    function onDragEnter(event: DragEvent) {
      if (![...(event.dataTransfer?.items ?? [])].some((item) => item.kind === "file")) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    }
    function onDragOver(event: DragEvent) {
      if (dragDepth.current > 0) event.preventDefault();
    }
    function onDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void openFile(file);
    }
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === "v") setTool("pan");
      else if (event.key.toLowerCase() === "b") setTool("paint");
      else if (event.key.toLowerCase() === "i") setTool("sample");
    }
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("keydown", onKey);
    };
  }, [openFile]);

  function undo() {
    setHistory((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setFuture((next) => [paintRef.current, ...next]);
      setPaint(previous);
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const [nextPaint, ...rest] = stack;
      setHistory((past) => [...past, paintRef.current]);
      setPaint(nextPaint);
      return rest;
    });
  }

  function beginStroke() {
    setHistory((stack) => [...stack.slice(-40), paintRef.current]);
    setFuture([]);
  }

  function paintAt(index: number) {
    setPaint((current) => (current[index] === paintColor ? current : { ...current, [index]: paintColor }));
  }

  function clearPaint() {
    if (Object.keys(paintRef.current).length === 0) return;
    beginStroke();
    setPaint({});
  }

  function selectSet(id: string) {
    if (id === "custom") return;
    const chosen = setById(id);
    setPaletteId(id);
    setEntries(entriesFromSet(chosen));
    setUnlimited(chosen.kind === "open");
    setPaintColor(chosen.studs[0]?.[0] ?? paintColor);
  }

  function mergeSet(id: string) {
    const chosen = setById(id);
    const merged = new Map(entries.map((entry) => [entry.hex, entry.count]));
    for (const [hex, count] of chosen.studs) {
      merged.set(hex, Math.min(99999, (merged.get(hex) ?? 0) + count));
    }
    setEntries([...merged.entries()].map(([hex, count]) => ({ hex, count })));
    setPaletteId("custom");
    if (chosen.kind === "set") setUnlimited(false);
    setNotice(`Merged ${chosen.name}.`);
  }

  function changeWidth(value: number) {
    const next = clampSize(value);
    setStudsW(next);
    if (linked) setStudsH(clampSize(Math.round(next / ratioRef.current)));
  }

  function changeHeight(value: number) {
    const next = clampSize(value);
    setStudsH(next);
    if (linked) setStudsW(clampSize(Math.round(next * ratioRef.current)));
  }

  async function importPalette(file: File) {
    try {
      const text = await file.text();
      const next = parsePalette(text);
      if (next.length === 0) throw new Error("empty");
      setEntries(next);
      setPaletteId("custom");
      setUnlimited(next.every((entry) => entry.count >= 9999));
      setPaintColor(next[0].hex);
      setNotice(`Imported ${next.length} colors.`);
    } catch {
      setNotice("That file is not a stud map.");
    }
  }

  async function loadDepth(file: File) {
    const url = await readFileAsDataUrl(file);
    const next = await loadImage(url);
    setDepthImage(next);
    setDepthName(file.name);
    setDepthEnabled(true);
  }

  function exportPng() {
    if (!mosaic) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    drawMosaic(context, {
      colors: mosaic.colors,
      photo: null,
      width: mosaic.width,
      height: mosaic.height,
      piece,
      depth: mosaic.depth,
      view: "studs",
      split: 1,
      hover: null,
      painted: null,
    });
    canvasToPng(canvas, `${slug(imageName)}.png`);
  }

  function exportInstructions() {
    if (!mosaic) return;
    const html = instructionsHtml({
      title: imageName.replace(/\.[^.]+$/, ""),
      colors: mosaic.colors,
      width: mosaic.width,
      height: mosaic.height,
      depth: mosaic.depth,
      pieceName: pieceById(piece).name,
      usage: mosaic.usage,
    });
    downloadText(`${slug(imageName)}-instructions.html`, html, "text/html");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="stud-logo" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Art Remix</h1>
            <p>A mosaic studio for bricks you already have</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn tiny" type="button" onClick={() => setShowEdits((value) => !value)} aria-pressed={showEdits}>
            {showEdits ? "Edits shown" : "Edits hidden"}
          </button>
          <button className="btn tiny" type="button" onClick={() => aboutRef.current?.showModal()}>
            About
          </button>
          <button className="btn tiny" type="button" onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {image && crop ? (
        <div className="workspace">
          <SourcePanel
            image={image}
            imageName={imageName}
            crop={crop}
            onCrop={setCrop}
            studsW={studsW}
            studsH={studsH}
            linked={linked}
            onLinked={(value) => {
              setLinked(value);
              if (value) ratioRef.current = studsW / studsH;
            }}
            onStudsW={changeWidth}
            onStudsH={changeHeight}
            onPreset={(size) => {
              setStudsW(size);
              setStudsH(size);
              ratioRef.current = 1;
            }}
            smooth={smooth}
            onSmooth={setSmooth}
            adjustments={adjustments}
            onAdjustments={setAdjustments}
            onReplace={() => fileRef.current?.click()}
          />
          <Stage
            mosaic={mosaic}
            piece={piece}
            view={view}
            onView={setView}
            split={split}
            onSplit={setSplit}
            tool={tool}
            onTool={setTool}
            painted={paint}
            showEdits={showEdits}
            onStrokeStart={beginStroke}
            onPaint={paintAt}
            onSample={(hex) => {
              setPaintColor(hex);
              setTool("paint");
            }}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onUndo={undo}
            onRedo={redo}
            onClearPaint={clearPaint}
            shortage={mosaic && !unlimited && !DITHERS.has(algorithm) ? mosaic.shortage : 0}
          />
          <Inspector
            paletteId={paletteId}
            entries={entries}
            unlimited={unlimited}
            onSelectSet={selectSet}
            onMergeSet={mergeSet}
            onUnlimited={setUnlimited}
            onEntries={(next) => {
              setEntries(next);
              setPaletteId("custom");
            }}
            algorithm={algorithm}
            onAlgorithm={setAlgorithm}
            metric={metric}
            onMetric={setMetric}
            tie={tie}
            onTie={setTie}
            piece={piece}
            onPiece={(next) => {
              setPiece(next);
              setBleed(pieceById(next).bleeds);
            }}
            bleed={bleed}
            onBleed={setBleed}
            paintColor={paintColor}
            onPaintColor={setPaintColor}
            depthEnabled={depthEnabled}
            onDepthEnabled={setDepthEnabled}
            depthLevels={depthLevels}
            onDepthLevels={setDepthLevels}
            depthInvert={depthInvert}
            onDepthInvert={setDepthInvert}
            onDepthFile={(file) => void loadDepth(file)}
            depthName={depthName}
            onClearDepth={() => {
              setDepthImage(null);
              setDepthName(null);
            }}
            mosaic={mosaic}
            needed={studsW * studsH}
            onExportPng={exportPng}
            onExportInstructions={exportInstructions}
            onExportXml={() => {
              if (!mosaic) return;
              downloadText(`${slug(imageName)}-wanted.xml`, wantedListXml(mosaic.usage, piece), "application/xml");
            }}
            onExportPalette={() => {
              downloadText(
                `${slug(imageName)}-palette.json`,
                JSON.stringify(paletteDocument(entries, paletteId), null, 2),
                "application/json",
              );
            }}
            onImportPalette={(file) => void importPalette(file)}
          />
        </div>
      ) : (
        <main className="empty">
          <div className="empty-card">
            <div className="stud-logo" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>Turn a photo into studs.</h2>
            <p className="hint" style={{ fontSize: 16 }}>
              Pick a LEGO Art set, or any BrickLink colors you own. The picture stays in this browser.
            </p>
            <div className="drop">
              <p>Drop a photo, paste one, or choose a file.</p>
              <button className="btn primary" type="button" onClick={() => fileRef.current?.click()}>
                Choose photo
              </button>
              <div className="presets" style={{ justifyContent: "center", marginTop: 12 }}>
                {SAMPLES.map((sample) => (
                  <button key={sample.url} className="btn tiny" type="button" onClick={() => void openUrl(sample.url, sample.name)}>
                    Try {sample.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="features">
              <article>
                <h3>Sets, not a guess</h3>
                <p>Palettes know how many studs come in each Art set.</p>
              </article>
              <article>
                <h3>Fix it by hand</h3>
                <p>Paint individual studs when a face or logo needs a nudge.</p>
              </article>
              <article>
                <h3>Build from a list</h3>
                <p>Export a picture, printable plates, or a BrickLink wanted list.</p>
              </article>
            </div>
          </div>
        </main>
      )}

      {dragging && <div className="overlay">Drop to mosaic</div>}
      {notice && <div className="toast">{notice}</div>}
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
          event.target.value = "";
        }}
      />
      <dialog ref={aboutRef}>
        <h2>About Art Remix</h2>
        <p>
          This is a modified version of Lego Art Remix, updated on 16 October 2026. The original was made by Deb. It is
          not affiliated with the LEGO Group. LEGO, BrickLink, and the set names belong to their owners.
        </p>
        <p>
          Photos are processed locally. Piece counts and color names come from the original project’s BrickLink
          palettes. The source is available under the GNU GPL v3.
        </p>
        <p>
          <a href="https://github.com/debkbanerji/lego-art-remix" target="_blank" rel="noreferrer">
            Original source
          </a>
        </p>
        <form method="dialog">
          <button className="btn" type="submit">
            Close
          </button>
        </form>
      </dialog>
    </div>
  );
}

function slug(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "mosaic";
}
