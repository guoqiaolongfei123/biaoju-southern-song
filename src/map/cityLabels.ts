import type { CityDefinition, CityTier } from "../core/types";

export type MapDetail = "wide" | "mid" | "close";

export function mapDetailForViewportWidth(width: number): MapDetail {
  if (width <= 360) return "close";
  if (width <= 760) return "mid";
  return "wide";
}

export interface LabelViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CityLabelLayout {
  visible: boolean;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  leader: boolean;
}

interface Box { left: number; right: number; top: number; bottom: number }

export interface CityLabelObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
}

const FONT_SIZE: Record<MapDetail, Record<CityTier, number>> = {
  wide: { capital: 18, major: 14, station: 11 },
  mid: { capital: 11.5, major: 10, station: 8.5 },
  close: { capital: 8.5, major: 7.2, station: 6.4 },
};

export const CITY_GLYPH_SCALE: Record<MapDetail, Record<CityTier, number>> = {
  wide: { capital: .85, major: .7, station: .55 },
  mid: { capital: .65, major: .48, station: .38 },
  close: { capital: .47, major: .34, station: .27 },
};

function glyphRadius(tier: CityTier, detail: MapDetail): number {
  const base = tier === "capital" ? 15 : tier === "major" ? 12 : 6.5;
  return base * CITY_GLYPH_SCALE[detail][tier];
}

function compactGlyphRadius(detail: MapDetail): number {
  return detail === "wide" ? 4.2 : detail === "mid" ? 3.2 : 2.8;
}

function overlaps(a: Box, b: Box, padding = 1.2): boolean {
  return a.left < b.right + padding && a.right > b.left - padding && a.top < b.bottom + padding && a.bottom > b.top - padding;
}

function estimatedLabelWidth(city: CityDefinition, detail: MapDetail): number {
  const font = FONT_SIZE[detail][city.tier];
  return Math.max(font * 1.7, city.name.length * font * 1.22) + 5;
}

export function cityLabelBounds(city: CityDefinition, layout: Pick<CityLabelLayout, "x" | "y" | "anchor">, detail: MapDetail): Box {
  const font = FONT_SIZE[detail][city.tier];
  // 古风中文字体带有额外字面与字距，碰撞框需略宽于理论 em，避免屏幕上边缘相压。
  const width = estimatedLabelWidth(city, detail);
  const left = layout.anchor === "start" ? city.x + layout.x : layout.anchor === "end" ? city.x + layout.x - width : city.x + layout.x - width / 2;
  return { left, right: left + width, top: city.y + layout.y - font * .92, bottom: city.y + layout.y + font * .34 };
}

function candidateOffsets(city: CityDefinition, detail: MapDetail) {
  const radius = glyphRadius(city.tier, detail);
  const font = FONT_SIZE[detail][city.tier];
  const gap = detail === "wide" ? 2.6 : 1.8;
  const vertical = radius + font + gap;
  const horizontal = radius + gap + 1;
  const near: Array<Omit<CityLabelLayout, "visible">> = [
    { x: 0, y: vertical, anchor: "middle", leader: false },
    { x: horizontal, y: font * .32, anchor: "start", leader: true },
    { x: -horizontal, y: font * .32, anchor: "end", leader: true },
    { x: 0, y: -vertical + font * .15, anchor: "middle", leader: true },
    { x: horizontal, y: -radius * .62, anchor: "start", leader: true },
    { x: -horizontal, y: -radius * .62, anchor: "end", leader: true },
    { x: horizontal, y: radius + font, anchor: "start", leader: true },
    { x: -horizontal, y: radius + font, anchor: "end", leader: true },
  ];
  // 强制显示的当前城、路线节点和分号在密集地区需要第二圈候选位，
  // 否则八个近位都冲突时只能把文字叠在一起。
  const farHorizontal = horizontal + font * 2.2;
  const farVertical = vertical + font * 1.5;
  const far: Array<Omit<CityLabelLayout, "visible">> = [
    { x: farHorizontal, y: font * .28, anchor: "start", leader: true },
    { x: -farHorizontal, y: font * .28, anchor: "end", leader: true },
    { x: 0, y: farVertical, anchor: "middle", leader: true },
    { x: 0, y: -farVertical + font * .2, anchor: "middle", leader: true },
    { x: farHorizontal, y: farVertical * .62, anchor: "start", leader: true },
    { x: -farHorizontal, y: farVertical * .62, anchor: "end", leader: true },
    { x: farHorizontal, y: -farVertical * .5, anchor: "start", leader: true },
    { x: -farHorizontal, y: -farVertical * .5, anchor: "end", leader: true },
  ];
  // A third ring is reserved for mandatory route, office and current-city
  // labels in dense corridors. A longer ink leader is easier to read than two
  // historical place names merged into one word.
  const labelWidth = estimatedLabelWidth(city, detail);
  const outerHorizontal = horizontal + labelWidth * 1.08;
  const outerVertical = farVertical + font * 2.5;
  const outer: Array<Omit<CityLabelLayout, "visible">> = [
    { x: outerHorizontal, y: font * .28, anchor: "start", leader: true },
    { x: -outerHorizontal, y: font * .28, anchor: "end", leader: true },
    { x: 0, y: outerVertical, anchor: "middle", leader: true },
    { x: 0, y: -outerVertical + font * .2, anchor: "middle", leader: true },
    { x: outerHorizontal, y: outerVertical * .58, anchor: "start", leader: true },
    { x: -outerHorizontal, y: outerVertical * .58, anchor: "end", leader: true },
    { x: outerHorizontal, y: -outerVertical * .54, anchor: "start", leader: true },
    { x: -outerHorizontal, y: -outerVertical * .54, anchor: "end", leader: true },
  ];
  const rotation = city.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % near.length;
  return [
    ...near.slice(rotation), ...near.slice(0, rotation),
    ...far.slice(rotation), ...far.slice(0, rotation),
    ...outer.slice(rotation), ...outer.slice(0, rotation),
  ];
}

function priority(city: CityDefinition, pinned: Set<string>): number {
  if (pinned.has(city.id)) return 400;
  if (city.tier === "capital") return 300;
  if (city.tier === "major") return 200;
  return 100;
}

export function layoutCityLabels(
  cities: CityDefinition[],
  viewport: LabelViewport,
  detail: MapDetail,
  pinned: Set<string>,
  obstacleCities: CityDefinition[] = cities,
  detailedCityIds: Set<string> = new Set(cities.map((city) => city.id)),
  externalObstacles: readonly CityLabelObstacle[] = [],
): Record<string, CityLabelLayout> {
  const layout: Record<string, CityLabelLayout> = {};
  const inView = cities.filter((city) => city.x >= viewport.x - 20 && city.x <= viewport.x + viewport.width + 20 && city.y >= viewport.y - 20 && city.y <= viewport.y + viewport.height + 20);
  const obstacleCitiesInView = obstacleCities.filter((city) => city.x >= viewport.x - 20 && city.x <= viewport.x + viewport.width + 20 && city.y >= viewport.y - 20 && city.y <= viewport.y + viewport.height + 20);
  const iconBoxes = obstacleCitiesInView.map((city) => {
    const radius = (detailedCityIds.has(city.id) ? glyphRadius(city.tier, detail) : compactGlyphRadius(detail)) + .8;
    return { id: city.id, box: { left: city.x - radius, right: city.x + radius, top: city.y - radius, bottom: city.y + radius } };
  });
  const externalBoxes = externalObstacles
    .filter((obstacle) => obstacle.x + obstacle.radius >= viewport.x - 20
      && obstacle.x - obstacle.radius <= viewport.x + viewport.width + 20
      && obstacle.y + obstacle.radius >= viewport.y - 20
      && obstacle.y - obstacle.radius <= viewport.y + viewport.height + 20)
    .map((obstacle) => ({
      id: obstacle.id,
      box: {
        left: obstacle.x - obstacle.radius,
        right: obstacle.x + obstacle.radius,
        top: obstacle.y - obstacle.radius,
        bottom: obstacle.y + obstacle.radius,
      },
    }));
  const labels: Box[] = [];
  const ordered = [...inView].sort((a, b) => priority(b, pinned) - priority(a, pinned) || a.y - b.y || a.id.localeCompare(b.id));

  for (const city of ordered) {
    const mustShow = pinned.has(city.id);
    if (detail === "wide" && city.tier === "station" && !mustShow) {
      layout[city.id] = { visible: false, x: 0, y: 0, anchor: "middle", leader: false };
      continue;
    }
    const candidates = candidateOffsets(city, detail);
    let chosen: CityLabelLayout | undefined;
    let leastConflict: { score: number; layout: CityLabelLayout } | undefined;
    for (const candidate of candidates) {
      const box = cityLabelBounds(city, candidate, detail);
      const iconConflicts = iconBoxes.filter((item) => item.id !== city.id && overlaps(box, item.box)).length;
      const overlayConflicts = externalBoxes.filter((item) => overlaps(box, item.box, 1.8)).length;
      const labelConflicts = labels.filter((other) => overlaps(box, other)).length;
      const outside = box.left < viewport.x + 3 || box.right > viewport.x + viewport.width - 3 || box.top < viewport.y + 3 || box.bottom > viewport.y + viewport.height - 3;
      const score = iconConflicts * 3 + overlayConflicts * 5 + labelConflicts * 4 + (outside ? 8 : 0);
      const option = { visible: true, ...candidate };
      if (score === 0) { chosen = option; labels.push(box); break; }
      if (!leastConflict || score < leastConflict.score) leastConflict = { score, layout: option };
    }
    if (!chosen && mustShow && leastConflict) {
      chosen = leastConflict.layout;
      labels.push(cityLabelBounds(city, chosen, detail));
    }
    layout[city.id] = chosen ?? { visible: false, x: 0, y: 0, anchor: "middle", leader: false };
  }

  for (const city of cities) layout[city.id] ??= { visible: false, x: 0, y: 0, anchor: "middle", leader: false };
  return layout;
}
