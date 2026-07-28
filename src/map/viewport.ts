import { MAP_HEIGHT, MAP_WIDTH } from "./projection";

export interface MapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export const MAP_VIEW_ASPECT = 16 / 9;
export const MIN_MAP_VIEW_WIDTH = 230;
export const MAX_MAP_VIEW_WIDTH = MAP_WIDTH;

export function constrainMapViewport(next: MapViewport): MapViewport {
  const width = Math.min(MAX_MAP_VIEW_WIDTH, Math.max(MIN_MAP_VIEW_WIDTH, next.width));
  const height = width / MAP_VIEW_ASPECT;
  return {
    x: Math.min(MAP_WIDTH - width, Math.max(0, next.x)),
    y: Math.min(MAP_HEIGHT - height, Math.max(0, next.y)),
    width,
    height,
  };
}

/**
 * The map uses xMidYMid slice so it always fills its stage. This maps a
 * screen-space pointer back into the currently visible SVG coordinates,
 * including the cropped portion on non-16:9 screens.
 */
export function mapPointFromClient(
  clientX: number,
  clientY: number,
  frame: MapFrame,
  viewport: MapViewport,
): MapPoint {
  if (frame.width <= 0 || frame.height <= 0) {
    return { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
  }
  const scale = Math.max(frame.width / viewport.width, frame.height / viewport.height);
  const renderedWidth = viewport.width * scale;
  const renderedHeight = viewport.height * scale;
  const offsetX = (frame.width - renderedWidth) / 2;
  const offsetY = (frame.height - renderedHeight) / 2;
  return {
    x: viewport.x + (clientX - frame.left - offsetX) / scale,
    y: viewport.y + (clientY - frame.top - offsetY) / scale,
  };
}

export function zoomMapViewport(current: MapViewport, factor: number, anchor: MapPoint): MapViewport {
  const width = current.width * factor;
  const height = width / MAP_VIEW_ASPECT;
  const relativeX = (anchor.x - current.x) / current.width;
  const relativeY = (anchor.y - current.y) / current.height;
  return constrainMapViewport({
    x: anchor.x - relativeX * width,
    y: anchor.y - relativeY * height,
    width,
    height,
  });
}

export function panMapViewport(
  start: MapViewport,
  deltaClientX: number,
  deltaClientY: number,
  frame: Pick<MapFrame, "width" | "height">,
): MapViewport {
  if (frame.width <= 0 || frame.height <= 0) return start;
  const scale = Math.max(frame.width / start.width, frame.height / start.height);
  return constrainMapViewport({
    ...start,
    x: start.x - deltaClientX / scale,
    y: start.y - deltaClientY / scale,
  });
}

export function mapViewportViewBox(viewport: MapViewport): string {
  return `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`;
}
