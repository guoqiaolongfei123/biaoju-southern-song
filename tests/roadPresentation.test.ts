import { describe, expect, it } from "vitest";
import type { CityDefinition, RouteDefinition } from "../src/core/types";
import { mapRoadPresentation } from "../src/map/roadPresentation";

const city = (id: string, tier: CityDefinition["tier"]): CityDefinition => ({
  id, name: id, subtitle: id, x: 0, y: 0, lon: 0, lat: 0, defaultOwner: "song", tier, description: "", specialties: [],
});
const route = (terrain: RouteDefinition["terrain"], days = 3): RouteDefinition => ({
  id: `${terrain}-${days}`, from: "a", to: "b", name: "test", terrain, days, danger: 20, note: "",
});

describe("map road presentation", () => {
  it("keeps capital official roads visible as arterial roads", () => {
    expect(mapRoadPresentation(route("official"), city("a", "capital"), city("b", "major")).grade).toBe("arterial");
  });

  it("treats short major river links as arterial shipping lanes", () => {
    expect(mapRoadPresentation(route("river", 2), city("a", "capital"), city("b", "major")).grade).toBe("arterial");
  });

  it("lets remote mountain links recede into local roads", () => {
    expect(mapRoadPresentation(route("mountain", 4), city("a", "station"), city("b", "station")).grade).toBe("local");
  });
});
