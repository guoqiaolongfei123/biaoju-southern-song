import { useEffect, useMemo, useRef, useState } from "react";
import { geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from "geojson";
import { CITIES, FACTIONS, ROUTES, TERRAIN_LABEL } from "../core/data";
import { cityStatusEffect } from "../core/cityContent";
import { frontlineSituation } from "../core/frontlineContent";
import { ROUTE_CONDITION_EFFECTS } from "../core/routeContent";
import { worldActorEffectLabel } from "../core/worldActorContent";
import { regionalWeatherSnapshot, weatherForCity } from "../core/weatherContent";
import type { CityTier, FactionId, GameState, RouteDefinition, WorldActorKind } from "../core/types";
import { chinaProjection, MAP_HEIGHT, MAP_WIDTH, projectLonLat } from "../map/projection";
import { CITY_GLYPH_SCALE, layoutCityLabels, mapDetailForViewportWidth } from "../map/cityLabels";
import { detailedCityIds, nearestCityToPoint } from "../map/cityMarkers";
import { layoutMapActors, type MapIconObstacle } from "../map/mapIconLayout";
import { politicalBorderCityIds, routeCrossesPoliticalBorder, routeOwners, splitQuadraticCurve } from "../map/politicalBorders";
import { routeCandidateAnchorRouteId, routeCandidateCityRole, routeCandidateSeal, type MapRouteCandidate } from "../map/routeComparison";
import {
  MAP_VIEW_ASPECT,
  constrainMapViewport,
  mapPointFromClient,
  mapViewportViewBox,
  panMapViewport,
  zoomMapViewport,
  type MapViewport,
} from "../map/viewport";
import eastAsiaLandData from "../map/east-asia-land-50m.json";

const PAINTED_MAP_URL = `${import.meta.env.BASE_URL}assets/map/southern-song-painted-map-v1.png`;

interface WorldMapProps {
  game: GameState;
  selectedCityId: string;
  activeRouteIds?: string[];
  routeCandidates?: MapRouteCandidate[];
  previewRouteId?: string | null;
  onPreviewRoute?: (routeId: string) => void;
  onSelectCity: (cityId: string) => void;
}

type MapFocus = "realm" | "song" | "frontier";

const VIEW_BOXES: Record<MapFocus, MapViewport> = {
  realm: { x: 90, y: 95, width: 1020, height: 573.75 },
  song: { x: 500, y: 318, width: 444, height: 249.75 },
  frontier: { x: 578, y: 276, width: 320, height: 180 },
};

const terrainColor = { official: "#90774e", mountain: "#74543d", river: "#52787c" };
const weatherMarkerOffset: Record<string, { x: number; y: number }> = {
  "tibetan-plateau": { x: 0, y: 0 },
  northwest: { x: -18, y: 11 },
  "northern-plains": { x: 22, y: 10 },
  "sichuan-basin": { x: -18, y: 13 },
  "middle-yangtze": { x: -16, y: -14 },
  "jiangnan-coast": { x: 20, y: 13 },
  "southern-coast": { x: 18, y: 12 },
};
const mapPath = geoPath(chinaProjection);
const eastAsiaLand = eastAsiaLandData as unknown as FeatureCollection<Geometry>;
const preciseLandPath = mapPath(eastAsiaLand) ?? "";

function geoPolygon(points: Array<[number, number]>): Feature<Polygon> {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...points, points[0]]] } };
}

function geoLine(points: Array<[number, number]>): Feature<LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } };
}

const historicalRegions: Array<{ faction: FactionId; shape: Feature<Polygon>; label: string; labelAt: [number, number] }> = [
  { faction: "mongol", label: "蒙古诸部", labelAt: [106, 45.2], shape: geoPolygon([[88, 42], [98, 41], [108, 42], [119, 45], [130, 48], [134, 54], [92, 55]]) },
  { faction: "jin", label: "大 金", labelAt: [116, 38.2], shape: geoPolygon([[103, 34.4], [106, 40.3], [115, 44], [128, 48], [132, 42], [126, 39], [122, 36], [121, 33.5], [117, 33], [113, 32.5], [109, 33]]) },
  { faction: "xixia", label: "西 夏", labelAt: [103.5, 39.7], shape: geoPolygon([[94, 34], [99, 32.8], [104, 34.4], [108, 38], [106, 42.2], [98, 42.8], [94, 39]]) },
  { faction: "song", label: "大 宋", labelAt: [113, 28.3], shape: geoPolygon([[100, 32.8], [104, 33.8], [109, 33], [113, 32.5], [117, 33], [121, 33.5], [123, 30], [122, 25], [118, 21], [108, 20], [103, 22], [100, 26]]) },
  { faction: "dali", label: "大 理", labelAt: [101, 25.5], shape: geoPolygon([[97, 22], [104, 22.5], [105, 26.5], [103, 29.5], [99, 30], [96, 26]]) },
  { faction: "tibetan", label: "吐蕃诸部", labelAt: [91.5, 33.5], shape: geoPolygon([[73, 29], [80, 26], [90, 27], [97, 22], [99, 30], [104, 33.8], [99, 39], [88, 40], [77, 37]]) },
];

const rivers = [
  { id: "yellow", name: "黄 河", width: 4, shape: geoLine([[96, 35], [101, 34.4], [104, 36.2], [107, 37.2], [110, 36], [112, 34.8], [114, 35.1], [116, 37], [119.2, 37.8]]) },
  { id: "yangtze", name: "大 江", width: 5, shape: geoLine([[91, 33], [96, 31.5], [101, 30.5], [105, 29.7], [108, 29.9], [111, 30.6], [114.3, 30.6], [117, 30.9], [119, 32], [121.8, 31.4]]) },
  { id: "han", name: "汉 水", width: 3, shape: geoLine([[107, 33.1], [110, 32.8], [112.2, 32.1], [114.3, 30.6]]) },
  { id: "huai", name: "淮 水", width: 3, shape: geoLine([[111, 33], [114, 33.2], [116.8, 32.7], [119.2, 33.3]]) },
  { id: "pearl", name: "珠 江", width: 3, shape: geoLine([[105, 24.3], [108, 23], [110.5, 23], [113.4, 22.8]]) },
  { id: "canal", name: "运 河", width: 2, shape: geoLine([[120.2, 30.2], [120.4, 32.1], [119.4, 34], [117.2, 36], [116.4, 39.5]]) },
];

const mountainRanges = [
  { id: "tianshan", name: "天 山", labelAt: [84, 43.2], shape: geoLine([[76, 43], [82, 43.5], [88, 43], [94, 42]]) },
  { id: "kunlun", name: "昆 仑", labelAt: [87, 36], shape: geoLine([[76, 36], [84, 36.5], [91, 36], [98, 35]]) },
  { id: "himalaya", name: "雪 山", labelAt: [86, 29.2], shape: geoLine([[76, 30], [83, 29.5], [90, 29], [96, 28]]) },
  { id: "qinling", name: "秦 岭", labelAt: [108, 33.7], shape: geoLine([[103, 34.1], [107, 34], [111, 33.5], [114, 33.2]]) },
  { id: "taihang", name: "太 行", labelAt: [112.8, 36.6], shape: geoLine([[112, 40], [112.5, 38], [113, 36], [112.5, 34.5]]) },
  { id: "nanling", name: "南 岭", labelAt: [112.5, 25.2], shape: geoLine([[107, 25.5], [111, 25], [115, 25.2], [117, 24.8]]) },
  { id: "wuyi", name: "武夷山", labelAt: [117.7, 27], shape: geoLine([[118.5, 29], [118, 27], [117.3, 25]]) },
];

function projectedLabel(lon: number, lat: number): { x: number; y: number } {
  const [x, y] = projectLonLat(lon, lat);
  return { x, y };
}

function routeCurve(route: RouteDefinition) {
  const from = CITIES.find((city) => city.id === route.from)!;
  const to = CITIES.find((city) => city.id === route.to)!;
  const key = [route.from, route.to].sort().join("-");
  const routeIndex = ROUTES.findIndex((candidate) => candidate.id === route.id);
  const groupIndex = ROUTES.slice(0, routeIndex).filter((candidate) => [candidate.from, candidate.to].sort().join("-") === key).length;
  const curveSign = route.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
  const offset = (groupIndex * 5 + 3) * curveSign;
  return {
    from,
    to,
    mx: (from.x + to.x) / 2 + (to.y - from.y) * 0.025 + offset,
    my: (from.y + to.y) / 2 - (to.x - from.x) * 0.025 - offset,
  };
}

function pointOnRoute(route: RouteDefinition, progress: number, fromCityId: string) {
  const curve = routeCurve(route);
  const t = fromCityId === route.from ? progress : 1 - progress;
  const inverse = 1 - t;
  return {
    x: inverse * inverse * curve.from.x + 2 * inverse * t * curve.mx + t * t * curve.to.x,
    y: inverse * inverse * curve.from.y + 2 * inverse * t * curve.my + t * t * curve.to.y,
  };
}

function WorldActorGlyph({ kind }: { kind: WorldActorKind }) {
  if (kind === "army") {
    return <>
      <circle className="actor-halo" r="9.6" />
      <path className="actor-dark" d="M-7 5.8 Q0 2.2 7 5.8 L5.4 7.4 H-5.4 Z M-4.2 3.6 L-2.3 -.2 L0 3.6 Z M.4 3.6 L3 -1.2 L5.5 3.6 Z" />
      <path className="actor-main" d="M-4.6 4.8 H4.6 L3.4 6.2 H-3.4 Z M-1.7 1.9 Q0 -1.6 1.7 1.9 L1.1 4.4 H-1.1 Z" />
      <path className="actor-accent" d="M-4.6 -7.8 V2.8 M3 -7.2 V2.8 M-4.2 -7.3 L1.3 -5.4 L-4.2 -2.8 Z M3.4 -6.7 L7.1 -5.2 L3.4 -3.3 Z" />
      <path className="actor-detail" d="M-6.2 5.5 H6.2 M0 1.2 V4.7 M-1.4 2.2 H1.4" />
    </>;
  }
  if (kind === "patrol") {
    return <>
      <circle className="actor-halo" r="8.2" />
      <path className="actor-dark" d="M-5.8 5.3 Q0 1.5 5.8 5.3 L4 7 H-4 Z" />
      <path className="actor-main" d="M-3 3 Q0 -1.8 3 3 L2.2 5.4 H-2.2 Z M-1.3 -1.6 V-7" />
      <path className="actor-accent" d="M-1 -6.5 Q3.7 -7 5.4 -3.3 Q2.2 -3.9 -1 -2.7 Z" />
      <path className="actor-detail" d="M-5.5 5.2 H5.5 M0 2.2 V5.2" />
    </>;
  }
  if (kind === "rival") {
    return <>
      <circle className="actor-halo" r="8.2" />
      <path className="actor-dark" d="M-5.8 5.5 H5.8 L4.2 7 H-4.2 Z" />
      <path className="actor-main" d="M-4 4.8 V-6 M4 4.8 V-5" />
      <path className="actor-accent" d="M-3.7 -5.8 L2.2 -4.2 L-3.7 -1.5 Z M3.7 -4.8 L-1.2 -3.1 L3.7 -1 Z" />
      <rect className="actor-seal" x="-2.4" y="1" width="4.8" height="4.8" />
    </>;
  }
  return <>
    <circle className="actor-halo" r="8.2" />
    <circle className="actor-wheel" cx="-4.2" cy="5.3" r="1.8" />
    <circle className="actor-wheel" cx="4.2" cy="5.3" r="1.8" />
    <path className="actor-dark" d="M-6 1.7 H6 L4.9 5.1 H-4.9 Z" />
    <path className="actor-main" d="M-5.4 1.8 Q-4.1 -4.7 0 -5.5 Q4.1 -4.7 5.4 1.8 Z" />
    <path className="actor-accent" d="M-5.1 -1 H5.1 M0 -5.3 V1.5" />
  </>;
}

function WeatherGlyph({ kind }: { kind: ReturnType<typeof regionalWeatherSnapshot>[number]["kind"] }) {
  if (kind === "clear" || kind === "heat") return <>
    <circle className="weather-symbol-main" r="3.7" />
    <path d="M0 -8 V-5.8 M0 5.8 V8 M-8 0 H-5.8 M5.8 0 H8 M-5.6 -5.6 L-4 -4 M4 4 L5.6 5.6 M5.6 -5.6 L4 -4 M-4 4 L-5.6 5.6" />
    {kind === "heat" && <path className="weather-symbol-accent" d="M-4.5 8 Q-1.5 4.6 0 8 Q1.5 4.6 4.5 8" />}
  </>;
  if (kind === "fog") return <>
    <path className="weather-symbol-cloud" d="M-7 -1 Q-5 -6 -1.4 -4.7 Q1.1 -8 4 -4.5 Q7 -4 7.5 -1 Z" />
    <path d="M-8 1.8 H5.5 M-5.5 5 H8 M-7.5 8 H3.5" />
  </>;
  if (kind === "gale") return <>
    <path d="M-8 -3 H3.5 Q8 -3 6 -6 M-7 1 H7.5 Q10 1 8 4 M-8 5 H2.5 Q6 5 4 8" />
  </>;
  if (kind === "frost") return <>
    <path d="M0 -8 V8 M-6.8 -4 L6.8 4 M6.8 -4 L-6.8 4 M0 -8 L-2 -6 M0 -8 L2 -6 M0 8 L-2 6 M0 8 L2 6" />
  </>;
  return <>
    <path className="weather-symbol-cloud" d="M-8 0 Q-7 -5 -2.6 -4 Q0 -8 3.6 -4.6 Q7 -4.5 8 0 Z" />
    {kind === "storm"
      ? <path className="weather-symbol-accent" d="M1 1 L-2 6 H1 L-1 10 L5 4 H2.3 L4 1 Z" />
      : <path d="M-5 2 L-7 7 M0 2 L-2 7 M5 2 L3 7" />}
  </>;
}

function CityGlyph({ tier, color }: { tier: CityTier; color: string }) {
  if (tier === "capital") {
    return (
      <g className="city-glyph city-glyph-capital" style={{ color }} aria-hidden="true">
        <circle className="city-icon-halo" r="14.5" />
        <path className="city-icon-shadow" d="M-12 8.5 H12 V11 H-12 Z" />
        <path className="city-icon-wall" d="M-10 0 H10 V9 H-10 Z M-7 -4 H7 V1 H-7 Z M-4 -8 H4 V-3 H-4 Z" />
        <path className="city-icon-roof" d="M-13 0 H13 L9 -3.4 H-9 Z M-10 -4 H10 L6 -7.2 H-6 Z M-7 -8 H7 L3 -11.5 H-3 Z" />
        <path className="city-icon-gate" d="M-2.6 9 V4.7 Q0 1.7 2.6 4.7 V9 Z" />
        <path className="city-icon-detail" d="M-7 1 V8 M7 1 V8 M-4 -3 V0 M4 -3 V0 M0 -7 V-4 M-12 2 H12" />
        <path className="city-icon-highlight" d="M-9 -3.5 H9 M-6 -7.5 H6" />
      </g>
    );
  }
  if (tier === "major") {
    return (
      <g className="city-glyph city-glyph-major" style={{ color }} aria-hidden="true">
        <path className="city-icon-halo city-icon-halo-wall" d="M-12 -7 H12 V11 H-12 Z" />
        <path className="city-icon-shadow" d="M-11 8 H11 V11 H-11 Z" />
        <path className="city-icon-wall" d="M-10 -1 H10 V9 H-10 Z M-9 -5 H-3 V1 H-9 Z M3 -5 H9 V1 H3 Z" />
        <path className="city-icon-roof" d="M-11 -5 H-1 L-4 -8 H-8 Z M1 -5 H11 L8 -8 H4 Z M-6 -1 H6 L3 -4 H-3 Z" />
        <path className="city-icon-gate" d="M-2.8 9 V4.2 Q0 1.4 2.8 4.2 V9 Z" />
        <path className="city-icon-detail" d="M-8 0 V7 M8 0 V7 M-5 0 H5 M-10 2 H10" />
        <path className="city-icon-highlight" d="M-8.5 -5.4 H-2.2 M2.2 -5.4 H8.5" />
      </g>
    );
  }
  return (
    <g className="city-glyph city-glyph-station" style={{ color }} aria-hidden="true">
      <circle className="city-icon-halo" r="6.2" />
      <circle className="city-icon-roof" r="4.5" />
      <circle className="city-icon-wall" r="2.25" />
      <path className="city-icon-detail" d="M0 -5.5 V-3.6 M5.5 0 H3.6 M0 5.5 V3.6 M-5.5 0 H-3.6" />
      <circle className="city-icon-highlight-dot" cx="-1.3" cy="-1.4" r=".8" />
    </g>
  );
}

function CityDotGlyph({ tier, color }: { tier: CityTier; color: string }) {
  if (tier === "major") {
    return (
      <g className="city-dot-glyph city-dot-major" style={{ color }} aria-hidden="true">
        <path className="city-dot-halo" d="M0 -4.6 L4.6 0 L0 4.6 L-4.6 0 Z" />
        <path className="city-dot-core" d="M0 -2.35 L2.35 0 L0 2.35 L-2.35 0 Z" />
        <circle className="city-dot-glint" cx="-.7" cy="-.8" r=".55" />
      </g>
    );
  }
  return (
    <g className="city-dot-glyph city-dot-station" style={{ color }} aria-hidden="true">
      <circle className="city-dot-halo" r="3.45" />
      <circle className="city-dot-core" r="1.65" />
      <circle className="city-dot-glint" cx="-.55" cy="-.65" r=".45" />
    </g>
  );
}

function viewportForCities(cityIds: string[]): MapViewport | null {
  const points = cityIds
    .map((cityId) => CITIES.find((city) => city.id === cityId))
    .filter((city) => Boolean(city));
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((city) => city!.x));
  const maxX = Math.max(...points.map((city) => city!.x));
  const minY = Math.min(...points.map((city) => city!.y));
  const maxY = Math.max(...points.map((city) => city!.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  let width = Math.max(330, maxX - minX + 150);
  let height = Math.max(185, maxY - minY + 105);
  if (width / height < MAP_VIEW_ASPECT) width = height * MAP_VIEW_ASPECT;
  else height = width / MAP_VIEW_ASPECT;
  return constrainMapViewport({ x: centerX - width / 2, y: centerY - height / 2, width, height });
}

export default function WorldMap({
  game,
  selectedCityId,
  activeRouteIds = [],
  routeCandidates = [],
  previewRouteId = null,
  onPreviewRoute,
  onSelectCity,
}: WorldMapProps) {
  const [focus, setFocus] = useState<MapFocus | null>("realm");
  const [viewport, setViewport] = useState<MapViewport>(VIEW_BOXES.realm);
  const [dragging, setDragging] = useState(false);
  const [zooming, setZooming] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<MapViewport>(VIEW_BOXES.realm);
  const pendingViewportRef = useRef<MapViewport | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const wheelCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    viewport: MapViewport;
  } | null>(null);
  const activeRoutes = new Set(activeRouteIds);
  const selectedCity = CITIES.find((city) => city.id === selectedCityId);
  const currentCity = CITIES.find((city) => city.id === game.currentCityId);
  const selectedWeather = selectedCity ? weatherForCity(game.seed, game.day, selectedCity) : null;
  const regionalWeather = useMemo(() => regionalWeatherSnapshot(game.seed, game.day), [game.seed, game.day]);
  const activeCityIds = useMemo(() => new Set(game.journey?.plan.cityIds ?? []), [game.journey?.plan.id]);
  const routeCandidateSignature = routeCandidates.map((candidate) => candidate.id).join("|");
  const effectivePreviewId = routeCandidates.some((candidate) => candidate.id === previewRouteId) ? previewRouteId : routeCandidates[0]?.id ?? null;
  const previewCandidateIndex = routeCandidates.findIndex((candidate) => candidate.id === effectivePreviewId);
  const previewCandidate = previewCandidateIndex >= 0 ? routeCandidates[previewCandidateIndex] : null;
  const candidateCityIds = useMemo(() => new Set(previewCandidate?.cityIds ?? []), [previewCandidate?.id]);
  const mapDetail = mapDetailForViewportWidth(viewport.width);
  const zoomPercent = Math.round((VIEW_BOXES.realm.width / viewport.width) * 100);
  const officeCityIds = useMemo(() => Object.keys(game.offices), [game.offices]);
  const pinnedCityIds = useMemo(() => new Set([selectedCityId, game.currentCityId, ...activeCityIds, ...candidateCityIds, ...officeCityIds]), [selectedCityId, game.currentCityId, activeCityIds, candidateCityIds, officeCityIds]);
  const detailedCities = useMemo(() => detailedCityIds(CITIES, mapDetail, pinnedCityIds), [mapDetail, pinnedCityIds]);
  const detailedCityList = useMemo(() => CITIES.filter((city) => detailedCities.has(city.id)), [detailedCities]);
  const borderCityIds = useMemo(() => politicalBorderCityIds(game.cities, ROUTES), [game.cities]);
  const borderRouteCount = useMemo(() => ROUTES.filter((route) => routeCrossesPoliticalBorder(game.cities, route)).length, [game.cities]);
  const cityLabels = useMemo(
    () => layoutCityLabels(detailedCityList, viewport, mapDetail, pinnedCityIds, CITIES, detailedCities),
    [detailedCityList, viewport, mapDetail, pinnedCityIds, detailedCities],
  );
  const cityRenderOrder = useMemo(() => [...CITIES].sort((a, b) => {
    const priority = (cityId: string) =>
      (borderCityIds.has(cityId) ? 1 : 0)
      + (activeCityIds.has(cityId) ? 2 : 0)
      + (selectedCityId === cityId ? 4 : 0)
      + (game.currentCityId === cityId ? 8 : 0);
    return priority(a.id) - priority(b.id) || a.y - b.y || a.id.localeCompare(b.id);
  }), [activeCityIds, borderCityIds, selectedCityId, game.currentCityId]);
  const compactCityCount = CITIES.length - detailedCities.size;
  const actorLayout = useMemo(() => {
    const points = game.worldActors.flatMap((actor) => {
      const route = ROUTES.find((candidate) => candidate.id === actor.routeId);
      if (!route) return [];
      const point = pointOnRoute(route, actor.progress, actor.fromCityId);
      return [{ id: actor.id, kind: actor.kind, x: point.x, y: point.y }];
    });
    const cityObstacles: MapIconObstacle[] = CITIES.map((city) => {
      const glyphScale = CITY_GLYPH_SCALE[mapDetail][city.tier];
      const radius = detailedCities.has(city.id)
        ? (city.tier === "capital" ? 15 : city.tier === "major" ? 12 : 6.5) * glyphScale + 2.2
        : mapDetail === "wide" ? 5.2 : mapDetail === "mid" ? 4 : 3.2;
      return { id: city.id, x: city.x, y: city.y, radius };
    });
    return layoutMapActors(points, cityObstacles, mapDetail);
  }, [game.worldActors, mapDetail, detailedCities]);
  const actorsById = useMemo(() => new Map(game.worldActors.map((actor) => [actor.id, actor])), [game.worldActors]);
  const stackedActorGroups = actorLayout.filter((group) => group.actorIds.length > 1).length;

  function markerHitRadius(city: (typeof CITIES)[number]) {
    const minimum = mapDetail === "wide" ? 14 : mapDetail === "mid" ? 10 : 6.5;
    if (!detailedCities.has(city.id)) return minimum;
    const glyphScale = CITY_GLYPH_SCALE[mapDetail][city.tier];
    return Math.max(minimum, (city.tier === "capital" ? 18 : city.tier === "major" ? 15 : 10) * glyphScale);
  }

  function cancelInteractionFrame() {
    if (interactionFrameRef.current === null) return;
    cancelAnimationFrame(interactionFrameRef.current);
    interactionFrameRef.current = null;
  }

  function applyViewportOnNextFrame(next: MapViewport) {
    const constrained = constrainMapViewport(next);
    viewportRef.current = constrained;
    pendingViewportRef.current = constrained;
    if (interactionFrameRef.current !== null) return;
    interactionFrameRef.current = requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      const pending = pendingViewportRef.current;
      pendingViewportRef.current = null;
      if (pending) svgRef.current?.setAttribute("viewBox", mapViewportViewBox(pending));
    });
  }

  function commitViewport(next: MapViewport) {
    const constrained = constrainMapViewport(next);
    cancelInteractionFrame();
    pendingViewportRef.current = null;
    viewportRef.current = constrained;
    svgRef.current?.setAttribute("viewBox", mapViewportViewBox(constrained));
    setViewport(constrained);
  }

  function cancelWheelInteraction() {
    if (wheelCommitRef.current !== null) {
      clearTimeout(wheelCommitRef.current);
      wheelCommitRef.current = null;
    }
    setZooming(false);
  }

  useEffect(() => () => {
    cancelInteractionFrame();
    if (wheelCommitRef.current !== null) clearTimeout(wheelCommitRef.current);
  }, []);

  useEffect(() => {
    if (!routeCandidateSignature) return;
    const routeViewport = viewportForCities(routeCandidates.flatMap((candidate) => candidate.cityIds));
    if (!routeViewport) return;
    setFocus(null);
    cancelWheelInteraction();
    commitViewport(routeViewport);
  }, [routeCandidateSignature]);

  function selectFocus(nextFocus: MapFocus) {
    cancelWheelInteraction();
    setFocus(nextFocus);
    commitViewport(VIEW_BOXES[nextFocus]);
  }

  function focusCurrentCity() {
    if (!currentCity) return;
    onSelectCity(currentCity.id);
    const cityViewport = viewportForCities([currentCity.id]);
    if (!cityViewport) return;
    setFocus(null);
    cancelWheelInteraction();
    commitViewport(cityViewport);
  }

  function zoomBy(factor: number, anchor = {
    x: viewportRef.current.x + viewportRef.current.width / 2,
    y: viewportRef.current.y + viewportRef.current.height / 2,
  }) {
    cancelWheelInteraction();
    setFocus(null);
    commitViewport(zoomMapViewport(viewportRef.current, factor, anchor));
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const current = viewportRef.current;
    const anchor = mapPointFromClient(event.clientX, event.clientY, rect, current);
    const normalizedDelta = Math.max(-80, Math.min(80, event.deltaY));
    setFocus(null);
    setZooming(true);
    applyViewportOnNextFrame(zoomMapViewport(current, Math.exp(normalizedDelta * 0.0014), anchor));
    if (wheelCommitRef.current !== null) clearTimeout(wheelCommitRef.current);
    wheelCommitRef.current = setTimeout(() => {
      wheelCommitRef.current = null;
      commitViewport(viewportRef.current);
      setZooming(false);
    }, 110);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest(".city-node, .city-node-hit-target")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelWheelInteraction();
    commitViewport(viewportRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewport: viewportRef.current,
    };
    setFocus(null);
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    applyViewportOnNextFrame(panMapViewport(
      drag.viewport,
      event.clientX - drag.clientX,
      event.clientY - drag.clientY,
      rect,
    ));
  }

  function handlePointerEnd(event: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    commitViewport(viewportRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCityHit(event: React.MouseEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    event.stopPropagation();
    const point = mapPointFromClient(event.clientX, event.clientY, svg.getBoundingClientRect(), viewportRef.current);
    const nearest = nearestCityToPoint(CITIES.filter((city) => Boolean(game.cities[city.id])), point);
    if (nearest) onSelectCity(nearest.id);
  }

  return (
    <div className={`map-stage historical-map map-focus-${focus ?? "custom"} map-detail-${mapDetail} ${routeCandidates.length > 0 ? "has-route-candidates" : ""} ${dragging ? "is-dragging" : ""} ${dragging || zooming ? "is-interacting" : ""}`}>
      <div className="map-caption">
        <span>皇宋嘉定天下舆图</span>
        <small>城楼颜色为实控 · “界”印为异旗边路 · 无现代国境</small>
      </div>
      <div className="map-tools" aria-label="地图视野与缩放">
        <div className="map-focus-tools">
          <button className={focus === "realm" ? "active" : ""} onClick={() => selectFocus("realm")}>天下</button>
          <button className={focus === "song" ? "active" : ""} onClick={() => selectFocus("song")}>宋境</button>
          <button className={focus === "frontier" ? "active" : ""} onClick={() => selectFocus("frontier")}>边关</button>
        </div>
        <div className="map-zoom-tools">
          <button aria-label="缩小地图" title="缩小" onClick={() => zoomBy(1.22)}>−</button>
          <output aria-label="地图缩放比例">{zoomPercent}%</output>
          <button aria-label="放大地图" title="放大" onClick={() => zoomBy(0.82)}>＋</button>
          <button className="map-reset" onClick={() => selectFocus("realm")}>复位</button>
        </div>
      </div>
      <div className="map-gesture-hint">滚轮缩放 · 按住拖移</div>
      {currentCity && (
        <button className="map-current-location" onClick={focusCurrentCity} title={`定位到${currentCity.name}`}>
          <i>镖</i>
          <span>镖队所在<b>{currentCity.name}</b></span>
          <small>点击定位</small>
        </button>
      )}
      <div className="map-detail-readout" aria-live="polite">
        <b>{mapDetail === "wide" ? "天下总览" : mapDetail === "mid" ? "州府详览" : "驿路近览"}</b>
          <span>{detailedCities.size}座城楼{compactCityCount > 0 ? ` · ${compactCityCount}处驿点` : " · 城驿尽显"} · {borderRouteCount}处边路</span>
          {stackedActorGroups > 0 && <small>{stackedActorGroups}组同路行旅已合标 · 放大自动展开</small>}
        {selectedWeather && <small className={`weather-${selectedWeather.kind}`}>{selectedCity?.name} · {selectedWeather.seal}·{selectedWeather.label}</small>}
        {mapDetail !== "close" && <small>继续放大展开城池</small>}
      </div>
      {routeCandidates.length > 0 && (
        <section className="map-route-board" aria-label="候选行程地图对比">
          <header><span>行程路签</span><small>悬停路签或右侧方案，舆图同步显路</small></header>
          <div>
            {routeCandidates.map((candidate, index) => {
              const highlighted = candidate.id === effectivePreviewId;
              return (
                <button
                  key={candidate.id}
                  className={`route-candidate-choice candidate-tone-${index % 3} ${highlighted ? "is-highlighted" : ""}`}
                  aria-pressed={highlighted}
                  onMouseEnter={() => onPreviewRoute?.(candidate.id)}
                  onFocus={() => onPreviewRoute?.(candidate.id)}
                  onClick={() => onPreviewRoute?.(candidate.id)}
                  title={`${candidate.label}：${candidate.days}日，路险${candidate.dangerLabel}，${candidate.weatherLabel ?? "沿途天候未报"}，${candidate.borderSegments ? `跨${candidate.borderSegments}处边关` : "不跨边关"}`}
                >
                  <i>{routeCandidateSeal(index)}</i>
                  <span><b>{candidate.label}</b><small>{candidate.days}日 · 路险{candidate.dangerLabel} · {candidate.weatherLabel ?? "天候未报"}</small></span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <svg
        ref={svgRef}
        className="world-map"
        viewBox={mapViewportViewBox(viewport)}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="南宋时期中国城市、道路、山川与势力地图，可滚轮缩放并拖拽平移"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <defs>
          <filter id="paperRough" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="13" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
          </filter>
          <filter id="inkBleed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.38" />
          </filter>
          <radialGradient id="paperGlow" cx="56%" cy="48%" r="65%">
            <stop offset="0" stopColor="#f1dfb8" stopOpacity=".28" />
            <stop offset="1" stopColor="#765f3f" stopOpacity=".1" />
          </radialGradient>
          {Object.entries(FACTIONS).map(([id, faction]) => (
            <pattern key={id} id={`hatch-${id}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform={id === "song" ? "rotate(32)" : "rotate(-32)"}>
              <line x1="0" y1="0" x2="0" y2="9" stroke={faction.color} strokeOpacity=".2" strokeWidth="3" />
            </pattern>
          ))}
          <clipPath id="preciseLandClip"><path d={preciseLandPath} /></clipPath>
          <clipPath id="mapBoundsClip"><rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} /></clipPath>
        </defs>

        <g className="map-world-layer" clipPath="url(#mapBoundsClip)">
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-sea" />
        <image
          className="painted-map-atmosphere"
          href={PAINTED_MAP_URL}
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
        />
        <path className="precise-land-surface" d={preciseLandPath} />
        <image
          className="painted-map-land-art"
          href={PAINTED_MAP_URL}
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#preciseLandClip)"
        />
        <path className="precise-coastline" d={preciseLandPath} />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-art-glaze" />

        <g className="faction-regions">
          {historicalRegions.map((region) => (
            <path key={region.faction} className={`faction-region faction-${region.faction}`} d={mapPath(region.shape) ?? ""} fill={`url(#hatch-${region.faction})`} />
          ))}
        </g>

        <g className={`weather-atmosphere weather-detail-${mapDetail}`} aria-hidden="true">
          {regionalWeather.map((weather) => {
            const point = projectedLabel(...weather.region.center);
            const scale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .72 : .5;
            return (
              <g key={weather.region.id} className={`weather-region weather-${weather.kind}`} transform={`translate(${point.x} ${point.y})`}>
                <g transform={`scale(${scale})`}>
                  <path className="weather-wash" d="M-46 4 Q-42 -18 -24 -15 Q-15 -31 3 -19 Q19 -31 29 -14 Q45 -13 47 5 Q38 21 19 17 Q5 27 -8 18 Q-29 27 -42 13 Z" />
                </g>
              </g>
            );
          })}
        </g>

        <g className="mountain-ranges" aria-hidden="true">
          {mountainRanges.map((range) => {
            const label = projectedLabel(range.labelAt[0], range.labelAt[1]);
            return (
              <g key={range.id}>
                <path d={mapPath(range.shape) ?? ""} />
                <path d={mapPath(range.shape) ?? ""} transform="translate(0 4)" opacity=".35" />
                <text x={label.x} y={label.y}>{range.name}</text>
              </g>
            );
          })}
        </g>

        <g className="river-system" aria-hidden="true">
          {rivers.map((river) => (
            <path key={river.id} d={mapPath(river.shape) ?? ""} style={{ strokeWidth: river.width }}>
              <title>{river.name}</title>
            </path>
          ))}
        </g>

        <g className="region-labels" aria-hidden="true">
          {historicalRegions.map((region) => {
            const label = projectedLabel(...region.labelAt);
            return <text key={region.faction} className={`label-${region.faction}`} x={label.x} y={label.y}>{region.label}</text>;
          })}
        </g>

        <g className="political-control-network" aria-label="依当前城池归属绘制的势力交通范围">
          {ROUTES.map((route) => {
            const { from, to, mx, my } = routeCurve(route);
            const owners = routeOwners(game.cities, route);
            const curve = { from, to, control: { x: mx, y: my } };
            const fullPath = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
            if (owners.from === owners.to) {
              return <path key={route.id} className="control-corridor is-unified" d={fullPath} stroke={FACTIONS[owners.from].color} />;
            }
            const split = splitQuadraticCurve(curve);
            const borderScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .62 : .36;
            return (
              <g key={route.id} className="control-corridor-pair is-border">
                <path className="control-corridor side-from" d={split.fromPath} stroke={FACTIONS[owners.from].color} />
                <path className="control-corridor side-to" d={split.toPath} stroke={FACTIONS[owners.to].color} />
                <g className="political-border-seal" transform={`translate(${split.midpoint.x} ${split.midpoint.y}) scale(${borderScale})`}>
                  <circle className="border-seal-paper" r="6.7" />
                  <path className="border-seal-side side-from" d="M0 -5.5 A5.5 5.5 0 0 0 0 5.5 Z" fill={FACTIONS[owners.from].color} />
                  <path className="border-seal-side side-to" d="M0 -5.5 A5.5 5.5 0 0 1 0 5.5 Z" fill={FACTIONS[owners.to].color} />
                  <circle className="border-seal-frame" r="6.7" />
                  <text y="2.2" textAnchor="middle">界</text>
                  <title>{FACTIONS[owners.from].name}与{FACTIONS[owners.to].name}当前边路 · {route.name}</title>
                </g>
              </g>
            );
          })}
        </g>

        <g className="routes">
          {ROUTES.map((route) => {
            const { from, to, mx, my } = routeCurve(route);
            const path = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
            const active = activeRoutes.has(route.id);
            const intelAge = Math.max(0, game.day - (game.routeIntel[route.id]?.surveyedDay ?? -99));
            const intelClass = intelAge <= 2 ? "intel-fresh" : intelAge <= 6 ? "intel-aging" : "intel-rumor";
            const knownCondition = game.routeIntel[route.id]?.knownCondition ?? "clear";
            const conditionEffect = ROUTE_CONDITION_EFFECTS[knownCondition];
            return (
              <g key={route.id} className={`route route-${route.terrain} route-condition-${knownCondition} ${intelClass} ${active ? "is-active" : ""}`}>
                <path className="route-hit" d={path} />
                <path className="route-casing" d={path} />
                <path className="route-line" d={path} stroke={active ? "#e0b85d" : terrainColor[route.terrain]} />
                <path className="route-pattern" d={path} />
                {active && <circle className="route-marker" cx={mx} cy={my} r="3.5" />}
                {knownCondition !== "clear" && <g className={`route-condition-seal condition-${knownCondition} ${intelAge > 2 ? "is-stale" : ""}`} transform={`translate(${mx} ${my})`}><circle r="5" /><text y="2" textAnchor="middle">{conditionEffect.seal}</text></g>}
                <title>{route.name} · {TERRAIN_LABEL[route.terrain]} · {route.days}日 · {conditionEffect.label} · {intelAge <= 2 ? "新报" : intelAge <= 6 ? `${intelAge}日前旧报` : "仅有传闻"}</title>
              </g>
            );
          })}
        </g>

        <g className={`weather-system weather-detail-${mapDetail}`} aria-label={`第${game.day}日天下区域天候`}>
          {regionalWeather.map((weather) => {
            const point = projectedLabel(...weather.region.center);
            const offset = weatherMarkerOffset[weather.region.id] ?? { x: 0, y: 0 };
            const scale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .72 : .5;
            return (
              <g key={weather.region.id} className={`weather-region weather-${weather.kind}`} transform={`translate(${point.x + offset.x} ${point.y + offset.y})`}>
                {(offset.x !== 0 || offset.y !== 0) && <path className="weather-anchor-line" d={`M0 0 L${-offset.x} ${-offset.y}`} />}
                <g transform={`scale(${scale})`}>
                  <path className="weather-cartouche" d="M-28 -12 Q0 -19 28 -12 L31 10 Q0 16 -31 10 Z" />
                  <g className="weather-symbol" transform="translate(-13 -1)"><WeatherGlyph kind={weather.kind} /></g>
                  <text className="weather-token-seal" x="11" y="3.2" textAnchor="middle">{weather.seal}</text>
                  {mapDetail !== "close" && <text className="weather-region-label" y="23" textAnchor="middle">{weather.region.name} · {weather.label}</text>}
                </g>
                <title>{weather.region.name} · 第 {game.day} 日 · {weather.label} · {weather.description}</title>
              </g>
            );
          })}
        </g>

        {routeCandidates.length > 0 && (
          <g className="route-candidate-layer" aria-label="三条候选行程">
            {routeCandidates.map((candidate, candidateIndex) => {
              const highlighted = candidate.id === effectivePreviewId;
              const anchorRouteId = routeCandidateAnchorRouteId(candidate, routeCandidates);
              const anchorRoute = ROUTES.find((route) => route.id === anchorRouteId);
              const anchor = anchorRoute ? routeCurve(anchorRoute) : null;
              return (
                <g key={candidate.id} className={`route-candidate candidate-tone-${candidateIndex % 3} ${highlighted ? "is-highlighted" : "is-muted"}`}>
                  {candidate.routeIds.map((routeId) => {
                    const route = ROUTES.find((item) => item.id === routeId);
                    if (!route) return null;
                    const { from, to, mx, my } = routeCurve(route);
                    return <path key={routeId} className="route-candidate-segment" d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}><title>{routeCandidateSeal(candidateIndex)}路 · {candidate.label} · {candidate.days}日 · 路险{candidate.dangerLabel} · {candidate.weatherLabel ?? "天候未报"}</title></path>;
                  })}
                  {anchor && (
                    <g className="route-candidate-seal" transform={`translate(${anchor.mx} ${anchor.my})`} aria-hidden="true">
                      <circle r="7.3" />
                      <text y="2.8" textAnchor="middle">{routeCandidateSeal(candidateIndex)}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        <g className={`world-actors actor-detail-${mapDetail}`}>
          {actorLayout.map((layout) => {
            const actor = actorsById.get(layout.primaryActorId);
            if (!actor) return null;
            const route = ROUTES.find((candidate) => candidate.id === actor.routeId);
            if (!route) return null;
            const actorScale = actor.kind === "army"
              ? mapDetail === "wide" ? 1.18 : mapDetail === "mid" ? 0.88 : 0.64
              : mapDetail === "wide" ? 1.05 : mapDetail === "mid" ? 0.76 : 0.54;
            const faction = FACTIONS[actor.faction];
            const effect = worldActorEffectLabel(actor, game.relations[actor.faction] ?? 0);
            const members = layout.actorIds.map((id) => actorsById.get(id)).filter((member) => Boolean(member));
            const actorNames = members.map((member) => member!.name).join("、");
            const displaced = Math.hypot(layout.x - layout.anchorX, layout.y - layout.anchorY) > 1;
            return (
              <g
                key={layout.id}
                className={`world-actor actor-${actor.kind} ${layout.actorIds.length > 1 ? "is-stack" : ""}`}
                transform={`translate(${layout.x} ${layout.y})`}
                role="img"
                aria-label={`${actorNames}，正在附近道路行进${layout.actorIds.length > 1 ? `，共${layout.actorIds.length}队` : ""}`}
                style={{ color: faction.color }}
              >
                {displaced && <path className="actor-anchor-line" d={`M0 0 L${layout.anchorX - layout.x} ${layout.anchorY - layout.y}`} />}
                <g transform={`scale(${actorScale})`}><WorldActorGlyph kind={actor.kind} /></g>
                {layout.actorIds.length > 1 && <g className="actor-stack-count" transform={`translate(${7.4 * actorScale} ${-6.8 * actorScale})`}><circle r="4.3" /><text y="1.8" textAnchor="middle">{layout.actorIds.length}</text></g>}
                {mapDetail === "close" && <text className="actor-name" y="-6.5" textAnchor="middle">{actor.name}</text>}
                <title>{actorNames} · {route.name} · {effect}{layout.actorIds.length > 1 ? ` · 合并显示${layout.actorIds.length}队，放大后展开` : ""}</title>
              </g>
            );
          })}
        </g>

        <g className="city-hit-layer" aria-hidden="true">
          {cityRenderOrder.map((city) => game.cities[city.id] ? (
            <g
              key={city.id}
              className={`city-node-hit-target ${selectedCityId === city.id ? "is-selected" : ""} ${game.currentCityId === city.id ? "is-current" : ""}`}
              data-city-id={city.id}
              transform={`translate(${city.x} ${city.y})`}
              onClick={handleCityHit}
            >
              <circle className="city-node-hit" r={markerHitRadius(city)} />
            </g>
          ) : null)}
        </g>

        <g className="cities">
          {cityRenderOrder.map((city) => {
            const state = game.cities[city.id];
            if (!state) return null;
            const faction = FACTIONS[state.owner];
            const condition = cityStatusEffect(state);
            const frontline = frontlineSituation(game.cities, city.id, game.day, game.worldActors);
            const selected = selectedCityId === city.id;
            const current = game.currentCityId === city.id;
            const office = game.offices[city.id];
            const stale = game.day - state.intelDay > 3;
            const candidateRole = previewCandidate ? routeCandidateCityRole(previewCandidate, city.id) : null;
            const active = activeCityIds.has(city.id) || Boolean(candidateRole);
            const label = cityLabels[city.id];
            const glyphScale = CITY_GLYPH_SCALE[mapDetail][city.tier];
            const detailedMarker = detailedCities.has(city.id);
            const dotScale = mapDetail === "wide" ? 1 : .72;
            const showBadges = mapDetail !== "wide" || selected || current || active;
            const hitRadius = markerHitRadius(city);
            const locatorScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .58 : .32;
            const borderCity = borderCityIds.has(city.id);
            return (
              <g
                key={city.id}
                className={`city-node ${detailedMarker ? "marker-detailed" : "marker-dot"} tier-${city.tier} status-${state.status} ${frontline.visible ? `is-frontline frontline-${frontline.risk}` : ""} ${selected ? "is-selected" : ""} ${current ? "is-current" : ""} ${active ? "is-on-route" : ""} ${candidateRole ? `is-candidate-waypoint waypoint-${candidateRole} candidate-tone-${Math.max(0, previewCandidateIndex) % 3}` : ""}`}
                data-city-id={city.id}
                transform={`translate(${city.x} ${city.y})`}
                onClick={(event) => { event.stopPropagation(); onSelectCity(city.id); }}
              >
                {detailedMarker && showBadges && frontline.visible && <circle className={`frontline-ring risk-${frontline.risk}`} r={city.tier === "station" ? 10.5 : 16} aria-hidden="true" />}
                {detailedMarker
                  ? <g className="city-glyph-lod" transform={`scale(${glyphScale})`}><CityGlyph tier={city.tier} color={faction.color} /></g>
                  : <g className="city-dot-lod" transform={`scale(${dotScale})`}><CityDotGlyph tier={city.tier} color={faction.color} /></g>}
                {borderCity && detailedMarker && (
                  <g className="city-owner-badge" transform={`translate(${-hitRadius * .82} ${hitRadius * .72}) scale(${locatorScale})`} aria-hidden="true">
                    <circle r="5.6" style={{ color: faction.color }} />
                    <text y="2.1" textAnchor="middle">{faction.short}</text>
                  </g>
                )}
                {current && (
                  <g className="current-city-locator" aria-label={`镖队当前在${city.name}`}>
                    <circle className="current-city-halo" r={hitRadius + 5} />
                    <path className="current-city-brackets" d={`M${-hitRadius - 3} -4 V${-hitRadius - 3} H-4 M4 ${-hitRadius - 3} H${hitRadius + 3} V-4 M${hitRadius + 3} 4 V${hitRadius + 3} H4 M-4 ${hitRadius + 3} H${-hitRadius - 3} V4`} />
                    <g className="current-city-tag" transform={`translate(0 ${-hitRadius - 9 * locatorScale}) scale(${locatorScale})`}>
                      <path d="M-11 -6 H11 V5 H2 L0 8 L-2 5 H-11 Z" />
                      <text y="1.7" textAnchor="middle">镖队在此</text>
                    </g>
                  </g>
                )}
                {detailedMarker && showBadges && state.status === "besieged" && <path className="siege-mark" d="M-13 -13 l5 5 M8 -8 l5 -5" />}
                {detailedMarker && showBadges && state.status === "captured" && <path className="capture-mark" d="M-11 -12 q11 -8 22 0" />}
                {detailedMarker && showBadges && !["stable", "prosperous", "besieged", "captured"].includes(state.status) && (
                  <g className={`map-condition-marker condition-${state.status}`} transform={`translate(${city.tier === "station" ? -7 : -13} ${city.tier === "station" ? -7 : -13})`} aria-hidden="true">
                    <circle r={city.tier === "station" ? 4.2 : 5.2} />
                    <text y={city.tier === "station" ? 1.6 : 2} textAnchor="middle">{condition.seal}</text>
                  </g>
                )}
                {detailedMarker && showBadges && office && (
                  <g className={`map-office-marker office-${office.tier} ${office.active ? "is-active" : "is-closed"}`} transform={`translate(${city.tier === "station" ? 7 : 13} ${city.tier === "station" ? -7 : -13})`} aria-hidden="true">
                    <path d="M0 -5 L5 0 L0 5 L-5 0 Z" />
                    <text y="2.3" textAnchor="middle">{office.tier === "headquarters" ? "總" : office.tier === "branch" ? "號" : "樁"}</text>
                  </g>
                )}
                {detailedMarker && candidateRole && (
                  <g className={`map-route-waypoint waypoint-${candidateRole}`} transform={`translate(${city.tier === "station" ? 8 : 14} ${city.tier === "station" ? 8 : 13})`} aria-hidden="true">
                    <circle r={candidateRole === "stopover" ? 4.6 : 5.4} />
                    <text y="2" textAnchor="middle">{candidateRole === "origin" ? "起" : candidateRole === "destination" ? "达" : "驿"}</text>
                  </g>
                )}
                {detailedMarker && label?.visible && <>
                  {label.leader && <path className="city-label-leader" d={`M0 0 L${label.x * .68} ${label.y * .68}`} />}
                  <text className="city-name" x={label.x} y={label.y} textAnchor={label.anchor}>{city.name}</text>
                </>}
                <circle
                  className="city-node-accessible-hit"
                  r={Math.max(4.5, Math.min(9.5, hitRadius * .64))}
                  role="button"
                  tabIndex={0}
                  aria-label={`${city.name}，${faction.name}，${condition.label}${frontline.visible ? `，战线${frontline.label}` : ""}${stale ? "，情报可能过期" : ""}`}
                  onClick={handleCityHit}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelectCity(city.id); }}
                />
                <title>{city.name} · 东经 {city.lon.toFixed(2)}° · 北纬 {city.lat.toFixed(2)}°{frontline.visible ? ` · ${frontline.label} · 守势 ${frontline.defense} / 兵压 ${frontline.pressure}` : ""}</title>
              </g>
            );
          })}
        </g>

        {selectedCity && (
          <g className="map-crosshair" transform={`translate(${selectedCity.x} ${selectedCity.y})`} pointerEvents="none">
            <path d="M-24 0 H-15 M15 0 H24 M0 -24 V-15 M0 15 V24" />
          </g>
        )}
        <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#paperGlow)" pointerEvents="none" />
        </g>
      </svg>
      <div className="map-legend" aria-label="地图图例">
        <span><i className="legend-faction song" />宋</span>
        <span><i className="legend-faction jin" />金</span>
        <span><i className="legend-faction xixia" />西夏</span>
        <span><i className="legend-faction dali" />大理</span>
        <span><i className="legend-line official" />官道</span>
        <span><i className="legend-line mountain" />山路</span>
        <span><i className="legend-line river" />水路</span>
        <span><i className="legend-condition">异</i>路况</span>
        <span><i className="legend-traveler merchant" />商旅</span>
        <span><i className="legend-traveler patrol" />巡骑</span>
        <span><i className="legend-traveler army" />行营</span>
        <span><i className="legend-traveler rival" />同行镖队</span>
        <span><i className="legend-current-city">镖</i>镖队所在</span>
        <span><i className="legend-border-route">界</i>异旗边路</span>
        <span><i className="legend-weather">雨</i>区域天候</span>
        <span><i className="legend-stack">2</i>同路合标</span>
        <span><i className="legend-station-dot" />驿城标点</span>
        <span><i className="legend-capital" />都城</span>
      </div>
      <div className="map-era">约公元 1208 年 · 嘉定初</div>
    </div>
  );
}
