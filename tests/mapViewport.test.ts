import { describe, expect, it } from "vitest";
import {
  MAP_VIEW_ASPECT,
  constrainMapViewport,
  mapPointFromClient,
  panMapViewport,
  zoomMapViewport,
  type MapViewport,
} from "../src/map/viewport";

const realm: MapViewport = { x: 90, y: 95, width: 1020, height: 573.75 };

describe("map viewport interaction", () => {
  it("keeps zoomed views inside the painted map and at a stable aspect ratio", () => {
    const constrained = constrainMapViewport({ x: 1190, y: -80, width: 400, height: 1 });
    expect(constrained.width / constrained.height).toBeCloseTo(MAP_VIEW_ASPECT, 8);
    expect(constrained.x + constrained.width).toBeLessThanOrEqual(1200);
    expect(constrained.y).toBe(0);
  });

  it("maps the stage center to the viewBox center even when slice crops a square stage", () => {
    const point = mapPointFromClient(500, 500, { left: 0, top: 0, width: 1000, height: 1000 }, realm);
    expect(point.x).toBeCloseTo(realm.x + realm.width / 2, 6);
    expect(point.y).toBeCloseTo(realm.y + realm.height / 2, 6);
  });

  it("keeps the pointer's map coordinate fixed while zooming", () => {
    const frame = { left: 40, top: 20, width: 960, height: 620 };
    const client = { x: 720, y: 260 };
    const anchor = mapPointFromClient(client.x, client.y, frame, realm);
    const zoomed = zoomMapViewport(realm, 0.82, anchor);
    const after = mapPointFromClient(client.x, client.y, frame, zoomed);
    expect(after.x).toBeCloseTo(anchor.x, 6);
    expect(after.y).toBeCloseTo(anchor.y, 6);
  });

  it("converts drag distance with the same slice scale used by the SVG", () => {
    const panned = panMapViewport(realm, 100, -50, { width: 1000, height: 1000 });
    const scale = Math.max(1000 / realm.width, 1000 / realm.height);
    expect(panned.x).toBeCloseTo(realm.x - 100 / scale, 6);
    expect(panned.y).toBeCloseTo(realm.y + 50 / scale, 6);
  });
});
