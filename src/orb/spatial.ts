import type { DepthZone } from "./state";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface SpatialVisual {
  scale: number;
  opacity: number;
  blurPx: number;
  detail: number;
}

const DEPTH: Record<DepthZone, SpatialVisual> = {
  Z0: { scale: 0.32, opacity: 0.42, blurPx: 0.75, detail: 0.45 },
  Z1: { scale: 0.52, opacity: 0.7, blurPx: 0.35, detail: 0.62 },
  Z2: { scale: 0.78, opacity: 0.9, blurPx: 0.08, detail: 0.82 },
  Z3: { scale: 1, opacity: 1, blurPx: 0, detail: 1 },
  Z4: { scale: 1.18, opacity: 1, blurPx: 0, detail: 1 },
  Z5: { scale: 1.42, opacity: 1, blurPx: 0, detail: 1 },
};

export const depthVisual = (zone: DepthZone) => DEPTH[zone];

export function overlapArea(a: Rect, b: Rect): number {
  const x = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const y = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  return x * y;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function containsPoint(rect: Rect, point: Point) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

export function choosePlacement(
  viewport: Rect,
  orbSize: number,
  occupied: Rect[],
  margin = 18,
): Point {
  const maxX = viewport.x + viewport.width - orbSize - margin;
  const maxY = viewport.y + viewport.height - orbSize - margin;
  const candidates: Point[] = [
    { x: maxX, y: viewport.y + margin },
    { x: maxX, y: maxY },
    { x: viewport.x + margin, y: viewport.y + margin },
    { x: viewport.x + margin, y: maxY },
    {
      x: viewport.x + viewport.width / 2 - orbSize / 2,
      y: viewport.y + margin,
    },
    {
      x: maxX,
      y: viewport.y + viewport.height / 2 - orbSize / 2,
    },
  ];

  const score = (point: Point) => {
    const rect = { x: point.x, y: point.y, width: orbSize, height: orbSize };
    return occupied.reduce((sum, area) => sum + overlapArea(rect, area), 0);
  };

  return candidates.sort((a, b) => score(a) - score(b))[0];
}

export function chooseWindowAwarePlacement(
  viewport: Rect,
  orbSize: number,
  focused: Rect,
  margin = 18,
): Point {
  const minX = viewport.x + margin;
  const minY = viewport.y + margin;
  const maxX = viewport.x + viewport.width - orbSize - margin;
  const maxY = viewport.y + viewport.height - orbSize - margin;
  const focusCenter = rectCenter(focused);

  const clampPoint = (point: Point): Point => ({
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY),
  });

  const candidates = [
    // Stay near the working window when there is open desktop beside it.
    {
      point: clampPoint({
        x: focused.x + focused.width + margin,
        y: focusCenter.y - orbSize / 2,
      }),
      preference: 0,
    },
    {
      point: clampPoint({
        x: focused.x - orbSize - margin,
        y: focusCenter.y - orbSize / 2,
      }),
      preference: 1,
    },
    {
      point: clampPoint({
        x: focusCenter.x - orbSize / 2,
        y: focused.y + focused.height + margin,
      }),
      preference: 2,
    },
    {
      point: clampPoint({
        x: focusCenter.x - orbSize / 2,
        y: focused.y - orbSize - margin,
      }),
      preference: 3,
    },
    // Quiet corners are the fallback for maximized/fullscreen windows.
    { point: { x: maxX, y: minY }, preference: 4 },
    { point: { x: maxX, y: maxY }, preference: 5 },
    { point: { x: minX, y: minY }, preference: 6 },
    { point: { x: minX, y: maxY }, preference: 7 },
  ];

  const scored = candidates.map(({ point, preference }) => {
    const orb = { x: point.x, y: point.y, width: orbSize, height: orbSize };
    const overlap = overlapArea(orb, focused);
    const center = rectCenter(orb);
    const distance = Math.hypot(center.x - focusCenter.x, center.y - focusCenter.y);

    // Avoid covering work first, then remain close enough to feel attached to it.
    return {
      point,
      score: overlap * 10_000 + distance + preference * 0.01,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].point;
}

export function quantizedWindowKey(
  appId: string | null,
  title: string | null,
  bounds: Rect,
  quantum = 32,
) {
  const q = (value: number) => Math.round(value / quantum);
  return [
    appId ?? "",
    title ?? "",
    q(bounds.x),
    q(bounds.y),
    q(bounds.width),
    q(bounds.height),
  ].join("|");
}
