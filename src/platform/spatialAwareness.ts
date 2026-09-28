import {
  chooseWindowAwarePlacement,
  containsPoint,
  rectCenter,
  type Point,
  type Rect,
} from "../orb/spatial";
import type {
  ForegroundWindowSnapshot,
  MonitorSnapshot,
} from "./bridge";

function monitorRect(
  monitor: MonitorSnapshot,
  coordinateSpace: ForegroundWindowSnapshot["coordinateSpace"],
): Rect {
  if (coordinateSpace === "physical") {
    return {
      x: monitor.x,
      y: monitor.y,
      width: monitor.width,
      height: monitor.height,
    };
  }

  return {
    x: monitor.x / monitor.scaleFactor,
    y: monitor.y / monitor.scaleFactor,
    width: monitor.width / monitor.scaleFactor,
    height: monitor.height / monitor.scaleFactor,
  };
}

export function isReaperForeground(snapshot: ForegroundWindowSnapshot) {
  const identity = [
    snapshot.appName ?? "",
    snapshot.appId ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return /(^|[\\/\s._-])reaper(?:64)?(?:[\\/\s._-]|$)/.test(identity);
}

export function findForegroundMonitor(
  snapshot: ForegroundWindowSnapshot,
  monitors: MonitorSnapshot[],
): MonitorSnapshot | null {
  if (!snapshot.bounds || monitors.length === 0) return null;

  const center = rectCenter(snapshot.bounds);
  return (
    monitors.find((monitor) =>
      containsPoint(monitorRect(monitor, snapshot.coordinateSpace), center),
    ) ?? null
  );
}

function toPhysicalPoint(
  point: Point,
  monitor: MonitorSnapshot,
  coordinateSpace: ForegroundWindowSnapshot["coordinateSpace"],
): Point {
  if (coordinateSpace === "physical") return point;

  const logicalMonitor = monitorRect(monitor, "logical");
  return {
    x:
      monitor.x +
      (point.x - logicalMonitor.x) * monitor.scaleFactor,
    y:
      monitor.y +
      (point.y - logicalMonitor.y) * monitor.scaleFactor,
  };
}

export function planSpatialTarget(
  snapshot: ForegroundWindowSnapshot,
  monitors: MonitorSnapshot[],
  orbPhysicalSize: number,
  marginPhysical = 18,
): Point | null {
  if (!snapshot.bounds) return null;

  const monitor = findForegroundMonitor(snapshot, monitors);
  if (!monitor) return null;

  const scale =
    snapshot.coordinateSpace === "logical" ? monitor.scaleFactor : 1;
  const viewport = monitorRect(monitor, snapshot.coordinateSpace);
  const orbSize = orbPhysicalSize / scale;
  const margin = marginPhysical / scale;

  const logicalTarget = chooseWindowAwarePlacement(
    viewport,
    orbSize,
    snapshot.bounds,
    margin,
  );

  return toPhysicalPoint(
    logicalTarget,
    monitor,
    snapshot.coordinateSpace,
  );
}
