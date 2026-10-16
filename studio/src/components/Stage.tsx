import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../i18n/locale";
import type { PieceId } from "../lib/pieces";
import type { MosaicResult } from "../lib/pipeline";
import { drawMosaic, hitTestStud } from "../lib/render";

export type Tool = "pan" | "paint" | "sample";
export type PreviewMode = "studs" | "photo" | "split";

interface StageProps {
  mosaic: MosaicResult | null;
  piece: PieceId;
  view: PreviewMode;
  onView: (view: PreviewMode) => void;
  split: number;
  onSplit: (split: number) => void;
  tool: Tool;
  onTool: (tool: Tool) => void;
  painted: Record<number, string>;
  showEdits: boolean;
  onStrokeStart: () => void;
  onPaint: (index: number) => void;
  onSample: (hex: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPaint: () => void;
  shortage: number;
}

export function Stage({
  mosaic,
  piece,
  view,
  onView,
  split,
  onSplit,
  tool,
  onTool,
  painted,
  showEdits,
  onStrokeStart,
  onPaint,
  onSample,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPaint,
  shortage,
}: StageProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const userMoved = useRef(false);
  const fittedKey = useRef("");
  const painting = useRef(false);
  const panning = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const [space, setSpace] = useState(false);
  const paintedSet = useMemo(() => (showEdits ? new Set(Object.keys(painted).map(Number)) : null), [painted, showEdits]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawMosaic(context, {
      colors: mosaic.colors,
      photo: mosaic.adjusted,
      width: mosaic.width,
      height: mosaic.height,
      piece,
      depth: mosaic.depth,
      view,
      split,
      hover,
      painted: paintedSet,
    });
    const key = `${mosaic.width}x${mosaic.height}`;
    if (fittedKey.current !== key) {
      fittedKey.current = key;
      userMoved.current = false;
      fit();
    }
  }, [mosaic, piece, view, split, hover, paintedSet]);

  function fit() {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const naturalWidth = canvas.clientWidth || bounds.width / zoom;
    const naturalHeight = canvas.clientHeight || bounds.height / zoom;
    if (!naturalWidth || !naturalHeight) return;
    const next = Math.min(viewport.clientWidth / naturalWidth, viewport.clientHeight / naturalHeight) * 0.92;
    setZoom(next);
    setPan({
      x: (viewport.clientWidth - naturalWidth * next) / 2,
      y: (viewport.clientHeight - naturalHeight * next) / 2,
    });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!userMoved.current) fit();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [mosaic?.width, mosaic?.height]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const next = Math.min(8, Math.max(0.15, zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
      const scale = next / zoom;
      userMoved.current = true;
      setPan({ x: px - (px - pan.x) * scale, y: py - (py - pan.y) * scale });
      setZoom(next);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoom, pan]);

  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setSpace(true);
      }
    }
    function up(event: KeyboardEvent) {
      if (event.code === "Space") setSpace(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function point(event: ReactPointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.clientWidth;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.clientHeight;
    return hitTestStud(x, y, mosaic.width, mosaic.height);
  }

  function applyTool(index: number | null) {
    if (index == null || !mosaic) return;
    if (tool === "paint") onPaint(index);
    if (tool === "sample") onSample(mosaic.colors[index]);
  }

  const panMode = tool === "pan" || space;
  const cursor = panMode ? "" : tool === "paint" ? "painting" : "sampling";

  return (
    <section className="stage">
      <div className="stage-toolbar">
        <div className="segmented" role="toolbar" aria-label={t("tools")}>
          <button type="button" aria-pressed={tool === "pan"} onClick={() => onTool("pan")} title={t("panTitle")}>
            {t("pan")}
          </button>
          <button type="button" aria-pressed={tool === "paint"} onClick={() => onTool("paint")} title={t("paintTitle")}>
            {t("paint")}
          </button>
          <button type="button" aria-pressed={tool === "sample"} onClick={() => onTool("sample")} title={t("pickTitle")}>
            {t("pick")}
          </button>
        </div>
        <div className="segmented" role="toolbar" aria-label={t("preview")}>
          <button type="button" aria-pressed={view === "studs"} onClick={() => onView("studs")}>
            {t("studs")}
          </button>
          <button type="button" aria-pressed={view === "split"} onClick={() => onView("split")}>
            {t("split")}
          </button>
          <button type="button" aria-pressed={view === "photo"} onClick={() => onView("photo")}>
            {t("photo")}
          </button>
        </div>
        {view === "split" && (
          <input
            className="split-range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={split}
            aria-label={t("splitPosition")}
            onChange={(event) => onSplit(Number(event.target.value))}
          />
        )}
        <span className="grow" />
        <button className="btn tiny" type="button" disabled={!canUndo} onClick={onUndo}>
          {t("undo")}
        </button>
        <button className="btn tiny" type="button" disabled={!canRedo} onClick={onRedo}>
          {t("redo")}
        </button>
        <button className="btn tiny" type="button" onClick={onClearPaint}>
          {t("clearEdits")}
        </button>
        <button
          className="btn tiny"
          type="button"
          onClick={() => {
            userMoved.current = false;
            fit();
          }}
        >
          {t("fit")}
        </button>
      </div>
      {shortage > 0 && <div className="banner">{t("shortage", { count: shortage })}</div>}
      <div
        ref={viewportRef}
        className={`viewport ${cursor}`}
        onPointerDown={(event) => {
          if (!mosaic) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (panMode || event.button === 1) {
            panning.current = { x: event.clientX, y: event.clientY, pan };
            return;
          }
          painting.current = true;
          if (tool === "paint") onStrokeStart();
          applyTool(point(event));
        }}
        onPointerMove={(event) => {
          if (panning.current) {
            userMoved.current = true;
            setPan({
              x: panning.current.pan.x + event.clientX - panning.current.x,
              y: panning.current.pan.y + event.clientY - panning.current.y,
            });
            return;
          }
          const index = point(event);
          setHover(index);
          if (painting.current && tool === "paint") applyTool(index);
        }}
        onPointerUp={() => {
          painting.current = false;
          panning.current = null;
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="canvas-wrap" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <canvas ref={canvasRef} aria-label={t("mosaicPreview")} />
        </div>
      </div>
    </section>
  );
}
