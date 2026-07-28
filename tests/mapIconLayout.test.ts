import { describe, expect, it } from "vitest";
import { layoutMapActors, type MapActorPoint } from "../src/map/mapIconLayout";

const actors: MapActorPoint[] = [
  { id: "merchant", kind: "merchant", x: 100, y: 100 },
  { id: "army", kind: "army", x: 108, y: 102 },
];

describe("layoutMapActors", () => {
  it("clusters nearby actors in the realm overview and keeps the army glyph on top", () => {
    const layout = layoutMapActors(actors, [], "wide");
    expect(layout).toHaveLength(1);
    expect(layout[0].actorIds).toEqual(["army", "merchant"]);
    expect(layout[0].primaryActorId).toBe("army");
  });

  it("fans actors out at close detail", () => {
    const layout = layoutMapActors(actors, [], "close");
    expect(layout).toHaveLength(2);
    expect(Math.hypot(layout[0].x - layout[1].x, layout[0].y - layout[1].y)).toBeGreaterThanOrEqual(9.5);
  });

  it("can keep persistent route tokens separate while still avoiding occupied marks", () => {
    const layout = layoutMapActors(actors, [{ id: "city", x: 100, y: 100, radius: 11 }], "wide", false);
    expect(layout).toHaveLength(2);
    expect(layout.every((item) => item.actorIds.length === 1)).toBe(true);
    expect(layout.every((item) => Math.hypot(item.x - 100, item.y - 100) >= 16)).toBe(true);
  });

  it("moves a road actor away from a city while preserving its true anchor", () => {
    const layout = layoutMapActors(
      [{ id: "patrol", kind: "patrol", x: 100, y: 100 }],
      [{ id: "city", x: 100, y: 100, radius: 12 }],
      "wide",
    );
    expect(layout[0].anchorX).toBe(100);
    expect(layout[0].anchorY).toBe(100);
    expect(Math.hypot(layout[0].x - 100, layout[0].y - 100)).toBeGreaterThanOrEqual(22);
  });

  it("is deterministic", () => {
    expect(layoutMapActors(actors, [], "mid")).toEqual(layoutMapActors(actors, [], "mid"));
  });
});
