export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function coverCrop(imageWidth: number, imageHeight: number, aspect: number): Crop {
  const imageAspect = imageWidth / imageHeight;
  if (imageAspect > aspect) {
    const h = imageHeight;
    const w = h * aspect;
    return { x: (imageWidth - w) / 2, y: 0, w, h };
  }
  const w = imageWidth;
  const h = w / aspect;
  return { x: 0, y: (imageHeight - h) / 2, w, h };
}

export function clampCrop(crop: Crop, imageWidth: number, imageHeight: number): Crop {
  const w = Math.min(crop.w, imageWidth);
  const h = Math.min(crop.h, imageHeight);
  return {
    x: Math.min(Math.max(0, crop.x), Math.max(0, imageWidth - w)),
    y: Math.min(Math.max(0, crop.y), Math.max(0, imageHeight - h)),
    w,
    h,
  };
}

export function reshapeCrop(crop: Crop, aspect: number, imageWidth: number, imageHeight: number): Crop {
  const centerX = crop.x + crop.w / 2;
  const centerY = crop.y + crop.h / 2;
  let w = crop.w;
  let h = w / aspect;
  if (h > imageHeight) {
    h = imageHeight;
    w = h * aspect;
  }
  if (w > imageWidth) {
    w = imageWidth;
    h = w / aspect;
  }
  return clampCrop({ x: centerX - w / 2, y: centerY - h / 2, w, h }, imageWidth, imageHeight);
}

export function zoomCrop(crop: Crop, factor: number, focusX: number, focusY: number, imageWidth: number, imageHeight: number): Crop {
  const aspect = crop.w / crop.h;
  const minWidth = Math.min(imageWidth, imageHeight * aspect) / 8;
  let w = Math.min(imageWidth, Math.max(minWidth, crop.w * factor));
  let h = w / aspect;
  if (h > imageHeight) {
    h = imageHeight;
    w = h * aspect;
  }
  const relativeX = crop.w === 0 ? 0.5 : (focusX - crop.x) / crop.w;
  const relativeY = crop.h === 0 ? 0.5 : (focusY - crop.y) / crop.h;
  return clampCrop({ x: focusX - relativeX * w, y: focusY - relativeY * h, w, h }, imageWidth, imageHeight);
}

export function sampleCrop(
  image: CanvasImageSource,
  crop: Crop,
  width: number,
  height: number,
  smooth: boolean,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.imageSmoothingEnabled = smooth;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image"));
    image.src = source;
  });
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}
