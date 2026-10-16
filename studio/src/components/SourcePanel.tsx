import { useEffect, useRef } from "react";
import type { Adjustments } from "../lib/color";
import { NEUTRAL_ADJUSTMENTS } from "../lib/color";
import type { Crop } from "../lib/image";
import { zoomCrop } from "../lib/image";

const STUD_CM = 0.8;

interface SourcePanelProps {
  image: HTMLImageElement;
  imageName: string;
  crop: Crop;
  onCrop: (crop: Crop) => void;
  studsW: number;
  studsH: number;
  linked: boolean;
  onLinked: (linked: boolean) => void;
  onStudsW: (value: number) => void;
  onStudsH: (value: number) => void;
  onPreset: (size: number) => void;
  smooth: boolean;
  onSmooth: (value: boolean) => void;
  adjustments: Adjustments;
  onAdjustments: (adjustments: Adjustments) => void;
  onReplace: () => void;
}

export function SourcePanel({
  image,
  imageName,
  crop,
  onCrop,
  studsW,
  studsH,
  linked,
  onLinked,
  onStudsW,
  onStudsH,
  onPreset,
  smooth,
  onSmooth,
  adjustments,
  onAdjustments,
  onReplace,
}: SourcePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const aspect = studsW / studsH;
  const coverWidth = image.naturalWidth / image.naturalHeight > aspect ? image.naturalHeight * aspect : image.naturalWidth;
  const zoom = coverWidth / crop.w;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 280;
    const height = canvas.clientHeight || 200;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,0.45)";
    context.lineWidth = 1;
    context.beginPath();
    for (const t of [1 / 3, 2 / 3]) {
      context.moveTo(width * t, 0);
      context.lineTo(width * t, height);
      context.moveTo(0, height * t);
      context.lineTo(width, height * t);
    }
    context.stroke();
  }, [image, crop]);

  useEffect(() => {
    const node = canvasRef.current?.parentElement;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.06 : 0.94;
      onCrop(zoomCrop(crop, factor, crop.x + crop.w / 2, crop.y + crop.h / 2, image.naturalWidth, image.naturalHeight));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [crop, image, onCrop]);

  function panTo(clientX: number, clientY: number) {
    const start = drag.current;
    const canvas = canvasRef.current;
    if (!start || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = ((clientX - start.x) / rect.width) * start.crop.w;
    const dy = ((clientY - start.y) / rect.height) * start.crop.h;
    const x = Math.min(Math.max(0, start.crop.x - dx), image.naturalWidth - start.crop.w);
    const y = Math.min(Math.max(0, start.crop.y - dy), image.naturalHeight - start.crop.h);
    onCrop({ ...start.crop, x, y });
  }

  return (
    <aside className="panel">
      <div className="panel-scroll">
        <section>
          <div className="section-title">
            <span>Frame</span>
            <button className="btn tiny" type="button" onClick={onReplace}>
              Replace
            </button>
          </div>
          <div
            className="frame"
            style={{ aspectRatio: `${studsW} / ${studsH}` }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, crop };
            }}
            onPointerMove={(event) => panTo(event.clientX, event.clientY)}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <canvas ref={canvasRef} />
          </div>
          <p className="hint">{imageName}. Drag to move, scroll to zoom.</p>
          <div className="slider-row" style={{ marginTop: 8 }}>
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={6}
              step={0.01}
              value={Math.min(6, Math.max(1, zoom))}
              aria-label="Zoom into the photo"
              onChange={(event) => {
                const next = Number(event.target.value);
                const factor = zoom / next;
                onCrop(zoomCrop(crop, factor, crop.x + crop.w / 2, crop.y + crop.h / 2, image.naturalWidth, image.naturalHeight));
              }}
            />
            <b>{zoom.toFixed(1)}×</b>
          </div>
        </section>

        <section>
          <div className="section-title">
            <span>Studs</span>
            <span className="measure">
              {(studsW * STUD_CM).toFixed(1)} × {(studsH * STUD_CM).toFixed(1)} cm
            </span>
          </div>
          <div className="grid-2">
            <SizeField label="Width" value={studsW} onChange={onStudsW} />
            <SizeField label="Height" value={studsH} onChange={onStudsH} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div className="presets grow">
              {[32, 48, 64].map((size) => (
                <button
                  key={size}
                  className="btn tiny"
                  type="button"
                  onClick={() => onPreset(size)}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={linked}
                onChange={(event) => onLinked(event.target.checked)}
              />
              Link
            </label>
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={smooth} onChange={(event) => onSmooth(event.target.checked)} />
            Smooth the photo before sampling
          </label>
          <p className="hint">Each stud is 0.8 cm. Official Art mosaics are often 48×48.</p>
        </section>

        <section>
          <div className="section-title">
            <span>Color</span>
            <button className="btn tiny" type="button" onClick={() => onAdjustments(NEUTRAL_ADJUSTMENTS)}>
              Reset
            </button>
          </div>
          <Slider label="Hue" min={-180} max={180} value={adjustments.hue} onChange={(hue) => onAdjustments({ ...adjustments, hue })} />
          <Slider
            label="Saturation"
            min={-100}
            max={100}
            value={adjustments.saturation}
            onChange={(saturation) => onAdjustments({ ...adjustments, saturation })}
          />
          <Slider
            label="Value"
            min={-100}
            max={100}
            value={adjustments.value}
            onChange={(value) => onAdjustments({ ...adjustments, value })}
          />
          <Slider
            label="Brightness"
            min={-128}
            max={128}
            value={adjustments.brightness}
            onChange={(brightness) => onAdjustments({ ...adjustments, brightness })}
          />
          <Slider
            label="Contrast"
            min={-128}
            max={128}
            value={adjustments.contrast}
            onChange={(contrast) => onAdjustments({ ...adjustments, contrast })}
          />
        </section>
      </div>
    </aside>
  );
}

function SizeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  function set(next: number) {
    onChange(Math.min(160, Math.max(8, Math.round(next))));
  }
  return (
    <label className="field">
      {label}
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - 1)}>
          −
        </button>
        <input
          aria-label={label}
          type="number"
          min={8}
          max={160}
          value={value}
          onChange={(event) => set(Number(event.target.value))}
        />
        <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + 1)}>
          +
        </button>
      </div>
    </label>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
      <b>{value}</b>
    </div>
  );
}
