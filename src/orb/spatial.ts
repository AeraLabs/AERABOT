import type { DepthZone } from "./state";

export interface Rect { x: number; y: number; width: number; height: number; }
export interface Point { x: number; y: number; }
export interface SpatialVisual { scale: number; opacity: number; blurPx: number; detail: number; }

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
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

export function choosePlacement(viewport: Rect, orbSize: number, occupied: Rect[], margin = 18): Point {
  const candidates: Point[] = [
    { x: viewport.x + viewport.width - orbSize - margin, y: viewport.y + margin },
    { x: viewport.x + viewport.width - orbSize - margin, y: viewport.y + viewport.height - orbSize - margin },
    { x: viewport.x + margin, y: viewport.y + margin },
    { x: viewport.x + margin, y: viewport.y + viewport.height - orbSize - margin },
    { x: viewport.x + viewport.width / 2 - orbSize / 2, y: viewport.y + margin },
    { x: viewport.x + viewport.width - orbSize - margin, y: viewport.y + viewport.height / 2 - orbSize / 2 },
  ];
  const score = (point: Point) => {
    const rect = { x: point.x, y: point.y, width: orbSize, height: orbSize };
    return occupied.reduce((sum, area) => sum + overlapArea(rect, area), 0);
  };
  return candidates.sort((a, b) => score(a) - score(b))[0];
}
