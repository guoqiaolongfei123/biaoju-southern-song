import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import JourneyChronicle from "../src/components/JourneyChronicle";
import { acceptContract, createInitialGame } from "../src/core/game";
import { appendJourneyChronicle } from "../src/core/journeyChronicle";

describe("镖行纪界面", () => {
  it("keeps recent decisions directly visible and uses chronological order on the settlement paper", () => {
    const game = createInitialGame(1208);
    const planning = acceptContract(game, game.contracts[0].id);
    const journey = appendJourneyChronicle(planning.journey!, {
      id: "later-road",
      day: planning.day + 2,
      kind: "road",
      tone: "risk",
      seal: "驿",
      title: "雨中行路",
      detail: "车马踏过泥泞官道。",
    });

    const travelMarkup = renderToStaticMarkup(<JourneyChronicle journey={journey} />);
    const paperMarkup = renderToStaticMarkup(<JourneyChronicle journey={journey} paper />);

    expect(travelMarkup.indexOf("雨中行路")).toBeLessThan(travelMarkup.indexOf("受领「"));
    expect(paperMarkup.indexOf("受领「")).toBeLessThan(paperMarkup.indexOf("雨中行路"));
    expect(travelMarkup).toContain("aria-label=\"本趟镖行纪\"");
    expect(travelMarkup).not.toContain("<details");
  });
});
