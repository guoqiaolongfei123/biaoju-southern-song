import { useEffect, useMemo, useRef, useState } from "react";
import { geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from "geojson";
import { CITIES, FACTIONS, ROUTES, TERRAIN_LABEL } from "../core/data";
import { cityStatusEffect } from "../core/cityContent";
import { frontlineSituation } from "../core/frontlineContent";
import { ROUTE_CONDITION_EFFECTS } from "../core/routeContent";
import { ROUTE_LANDMARKS, routeLandmarkKind, type RouteLandmarkKind } from "../core/routeLandmarkContent";
import { worldActorEffectLabel } from "../core/worldActorContent";
import { rivalBureauByActor, rivalRank, rivalRelation } from "../core/rivalContent";
import { regionalWeatherSnapshot, weatherEffectForRoute, weatherForCity, weatherForRoute, weatherRoadPressure } from "../core/weatherContent";
import { gameCalendarDate, seasonalTravelAdvisory } from "../core/calendarContent";
import { roadInfluenceSnapshot } from "../core/roadPowerContent";
import { routeBusinessInsights } from "../core/routeBusiness";
import type { CityTier, FactionId, GameState, RouteDefinition, WorldActorKind } from "../core/types";
import { chinaProjection, MAP_HEIGHT, MAP_WIDTH, projectLonLat } from "../map/projection";
import { CITY_GLYPH_SCALE, layoutCityLabels, mapDetailForViewportWidth } from "../map/cityLabels";
import { cityClusterCalloutPlacement, cityClusterHitRadius, layoutCityMarkerClusters } from "../map/cityClusters";
import { cityMarkerHitRadius, detailedCityIds, nearestCityToPoint } from "../map/cityMarkers";
import { layoutMapActors, type MapIconObstacle } from "../map/mapIconLayout";
import { layoutRouteLandmarks } from "../map/routeLandmarkLayout";
import { layoutSettlementMarkers } from "../map/settlementMarkerLayout";
import { layoutWeatherMarkers } from "../map/weatherMarkerLayout";
import { politicalBorderCityIds, routeCrossesPoliticalBorder, routeOwners, splitQuadraticCurve } from "../map/politicalBorders";
import { routeCandidateAnchorRouteId, routeCandidateBusinessCaption, routeCandidateCityRole, routeCandidateSeal, type MapRouteCandidate } from "../map/routeComparison";
import { mapRoadPresentation } from "../map/roadPresentation";
import { layoutRouteBadges, type RouteBadgePoint } from "../map/routeBadgeLayout";
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
  deputyRouteIds?: string[];
  routeCandidates?: MapRouteCandidate[];
  previewRouteId?: string | null;
  onPreviewRoute?: (routeId: string) => void;
  onSelectCity: (cityId: string) => void;
}

type MapFocus = "realm" | "song" | "frontier";
type MapLayer = "overview" | "roads" | "business" | "weather";

const VIEW_BOXES: Record<MapFocus, MapViewport> = {
  realm: { x: 90, y: 95, width: 1020, height: 573.75 },
  song: { x: 500, y: 318, width: 444, height: 249.75 },
  frontier: { x: 578, y: 276, width: 320, height: 180 },
};

const terrainColor = { official: "#90774e", mountain: "#74543d", river: "#52787c" };
const terrainSeal = { official: "驿", mountain: "岭", river: "舟" };
const roadOutcomeLabel = { toll: "纳银立契", bluff: "报号退哨", victory: "胜阵清路", defeat: "败退扬匪", sacrifice: "弃镖纵匪", patrol: "遣哨搜山" };
const weatherTravelHint = { clear: "行旅顺畅", rain: "土路迟滞", storm: "渡口高危", fog: "哨路难辨", gale: "水路逆风", frost: "山路结滑", heat: "人马耗水" } as const;
const roadPresentationById = new Map(ROUTES.map((route) => [
  route.id,
  mapRoadPresentation(
    route,
    CITIES.find((city) => city.id === route.from)!,
    CITIES.find((city) => city.id === route.to)!,
  ),
]));
const weatherMarkerOffset: Record<string, { x: number; y: number }> = {
  "tibetan-plateau": { x: 0, y: 0 },
  northwest: { x: -18, y: 11 },
  "northern-plains": { x: 22, y: 10 },
  "sichuan-basin": { x: -18, y: 13 },
  "middle-yangtze": { x: -16, y: -14 },
  "jiangnan-coast": { x: 20, y: 13 },
  "southern-coast": { x: 18, y: -28 },
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

function routeHitPath(route: RouteDefinition) {
  const curve = routeCurve(route);
  const start = .13;
  const end = .87;
  const pointAt = (t: number) => {
    const inverse = 1 - t;
    return {
      x: inverse * inverse * curve.from.x + 2 * inverse * t * curve.mx + t * t * curve.to.x,
      y: inverse * inverse * curve.from.y + 2 * inverse * t * curve.my + t * t * curve.to.y,
    };
  };
  const from = pointAt(start);
  const to = pointAt(end);
  const control = {
    x: from.x + (end - start) * ((1 - start) * (curve.mx - curve.from.x) + start * (curve.to.x - curve.mx)),
    y: from.y + (end - start) * ((1 - start) * (curve.my - curve.from.y) + start * (curve.to.y - curve.my)),
  };
  return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
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

function RouteLandmarkGlyph({ kind }: { kind: RouteLandmarkKind }) {
  return <>
    <path className="landmark-paper" d="M-8 -7.2 Q0 -9.3 8 -7.2 L8.4 6.2 Q0 8.4 -8.4 6.2 Z" />
    {kind === "pass" && <>
      <path className="landmark-shadow" d="M-6.2 4.7 H6.2 V6.3 H-6.2 Z M-5.2 -1.5 H5.2 V.2 H-5.2 Z" />
      <path className="landmark-main" d="M-6 4.8 V-.8 L-4.7 -2.8 L-3.4 -.8 V4.8 M3.4 4.8 V-.8 L4.7 -2.8 L6 -.8 V4.8 M-2.7 4.8 V.3 H2.7 V4.8" />
      <path className="landmark-detail" d="M-7 -3 H-2.4 M2.4 -3 H7 M-1.2 .3 V-1.3 H1.2 V.3" />
    </>}
    {kind === "ferry" && <>
      <path className="landmark-main" d="M-6.7 2.4 Q0 5.1 6.7 2.4 L4.3 5.4 H-4.3 Z M-3.4 1.4 V-4.5 H3.7 V1.9" />
      <path className="landmark-accent" d="M-3 -4.1 Q.2 -6.8 3.8 -4.1 L3.8 -2.7 H-3 Z" />
      <path className="landmark-detail" d="M-7 6.3 Q-3.5 4.8 0 6.3 Q3.5 7.7 7 6.3" />
    </>}
    {kind === "post" && <>
      <path className="landmark-main" d="M-5.7 5.3 V-.7 H4.2 V5.3 M-6.8 -.7 L-.8 -5.1 L5.4 -.7 Z M-2.2 5.3 V1.3 H.4 V5.3" />
      <path className="landmark-accent" d="M4.3 -6.4 V4.7 M4.5 -5.9 L7 -4.8 L4.5 -3.3 Z" />
      <path className="landmark-detail" d="M-4.2 .8 H-2.8 M1.8 .8 H3.1" />
    </>}
    {kind === "fort" && <>
      <path className="landmark-main" d="M-6.4 5.4 V-2.1 L-4.9 -3.2 L-3.5 -2.1 L-2 -3.2 L-.5 -2.1 L1 -3.2 L2.5 -2.1 L4 -3.2 L5.6 -2.1 V5.4 Z M-1.8 5.4 V1 H1.4 V5.4" />
      <path className="landmark-accent" d="M-4.7 -5.9 V-1.8 M-4.5 -5.5 L-1.7 -4.5 L-4.5 -3.2 Z" />
      <path className="landmark-detail" d="M-4.5 .2 H-3 M3 .2 H4.5" />
    </>}
    {kind === "market" && <>
      <path className="landmark-accent" d="M-6.8 -2.5 H6.8 L5.2 .1 Q3.6 1.4 2 .1 Q.4 1.4 -1.2 .1 Q-2.8 1.4 -4.4 .1 Q-6 1.3 -6.8 -.1 Z" />
      <path className="landmark-main" d="M-5.5 .3 V5.4 H5.5 V.3 M-2.8 5.4 V2.2 H.2 V5.4 M2.2 2.1 H4.1 V3.5 H2.2 Z" />
      <path className="landmark-detail" d="M-5.8 -2.6 L-4.1 -5 H4.3 L6 -2.6" />
    </>}
    {kind === "temple" && <>
      <path className="landmark-main" d="M-5.3 5.3 V.1 H5.3 V5.3 M-6.8 .1 Q0 -2.1 6.8 .1 L5 -2.2 H-5 Z M-1.4 5.3 V1.8 H1.4 V5.3" />
      <path className="landmark-accent" d="M0 -6.1 V-2.8 M-1.5 -5 H1.5 M-1 -3.8 H1" />
      <path className="landmark-detail" d="M-6.8 5.5 H6.8" />
    </>}
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

function WeatherAtmosphereTexture({ kind }: { kind: ReturnType<typeof regionalWeatherSnapshot>[number]["kind"] }) {
  if (kind === "rain" || kind === "storm") return <g className="weather-texture weather-texture-rain">
    <path d="M-35 -5 l-8 13 M-20 -9 l-9 15 M-4 -5 l-9 16 M13 -10 L3 7 M30 -6 L20 11 M42 -2 L34 12" />
    {kind === "storm" && <path className="weather-texture-accent" d="M4 -19 L-5 -2 H2 L-3 13 L14 -7 H6 L12 -19" />}
  </g>;
  if (kind === "fog") return <g className="weather-texture weather-texture-fog">
    <path d="M-43 -10 Q-18 -17 5 -10 T44 -10 M-38 1 Q-12 -6 12 1 T40 1 M-44 12 Q-20 5 4 12 T43 12" />
  </g>;
  if (kind === "gale") return <g className="weather-texture weather-texture-gale">
    <path d="M-42 -10 H17 Q34 -10 28 -22 M-45 1 H35 Q49 1 43 13 M-35 13 H13 Q29 13 23 23" />
  </g>;
  if (kind === "frost") return <g className="weather-texture weather-texture-frost">
    <path d="M-28 -12 v24 M-38 -6 l20 12 M-18 -6 l-20 12 M17 -15 v30 M5 -8 l24 16 M29 -8 L5 8" />
  </g>;
  if (kind === "heat") return <g className="weather-texture weather-texture-heat">
    <path d="M-34 15 Q-43 4 -34 -7 Q-25 -18 -34 -27 M-10 17 Q-19 6 -10 -5 Q-1 -16 -10 -27 M15 17 Q6 6 15 -5 Q24 -16 15 -27 M37 15 Q28 4 37 -7 Q46 -18 37 -27" />
  </g>;
  return <g className="weather-texture weather-texture-clear"><path d="M-31 10 Q0 -12 31 10 M-20 18 Q0 5 20 18" /></g>;
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
  deputyRouteIds = [],
  routeCandidates = [],
  previewRouteId = null,
  onPreviewRoute,
  onSelectCity,
}: WorldMapProps) {
  const [focus, setFocus] = useState<MapFocus | null>("realm");
  const [mapLayer, setMapLayer] = useState<MapLayer>("overview");
  const [expandedCityIds, setExpandedCityIds] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
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
  const activeRouteSignature = activeRouteIds.join("|");
  const deputyRoutes = new Set(deputyRouteIds);
  const deputyRouteSignature = deputyRouteIds.join("|");
  const selectedCity = CITIES.find((city) => city.id === selectedCityId);
  const currentCity = CITIES.find((city) => city.id === game.currentCityId);
  const selectedWeather = selectedCity ? weatherForCity(game.seed, game.day, selectedCity) : null;
  const currentWeather = currentCity ? weatherForCity(game.seed, game.day, currentCity) : null;
  const selectedCityState = selectedCity ? game.cities[selectedCity.id] : null;
  const selectedCityCondition = selectedCityState ? cityStatusEffect(selectedCityState) : null;
  const selectedCityFaction = selectedCityState ? FACTIONS[selectedCityState.owner] : null;
  const hasRemoteCitySelection = Boolean(selectedCity && currentCity && selectedCity.id !== currentCity.id);
  const selectedRoute = selectedRouteId ? ROUTES.find((route) => route.id === selectedRouteId) ?? null : null;
  const hoveredRoute = hoveredRouteId ? ROUTES.find((route) => route.id === hoveredRouteId) ?? null : null;
  const readoutRoute = selectedRoute ?? hoveredRoute;
  const readoutRouteWeather = readoutRoute ? weatherForRoute(game.seed, game.day, readoutRoute) : null;
  const readoutRouteCondition = readoutRoute ? ROUTE_CONDITION_EFFECTS[game.routeIntel[readoutRoute.id]?.knownCondition ?? "clear"] : null;
  const selectedRouteIntel = selectedRoute ? game.routeIntel[selectedRoute.id] : null;
  const selectedRouteIntelAge = selectedRoute ? Math.max(0, game.day - (selectedRouteIntel?.surveyedDay ?? -99)) : 0;
  const selectedRouteCondition = selectedRoute ? ROUTE_CONDITION_EFFECTS[selectedRouteIntel?.knownCondition ?? "clear"] : null;
  const selectedRouteWeather = selectedRoute ? weatherForRoute(game.seed, game.day, selectedRoute) : null;
  const selectedRouteWeatherEffect = selectedRoute && selectedRouteWeather ? weatherEffectForRoute(selectedRouteWeather, selectedRoute.terrain) : null;
  const selectedRouteWeatherPressure = selectedRoute && selectedRouteWeather ? weatherRoadPressure(selectedRouteWeather, selectedRoute.terrain) : null;
  const selectedRoutePresentation = selectedRoute ? roadPresentationById.get(selectedRoute.id) ?? null : null;
  const selectedRoadInfluence = selectedRoute ? roadInfluenceSnapshot(selectedRoute.id, game.routeStates[selectedRoute.id], game.day) : null;
  const routeBusinessById = useMemo(() => routeBusinessInsights(ROUTES, game.routeIntel, game.businessLedger), [game.routeIntel, game.businessLedger]);
  const selectedRouteBusiness = selectedRoute ? routeBusinessById[selectedRoute.id] : null;
  const routeBusinessList = Object.values(routeBusinessById);
  const traveledBusinessRouteCount = routeBusinessList.filter((insight) => insight.trips > 0 || insight.ledgerTrips > 0).length;
  const profitableBusinessRouteCount = routeBusinessList.filter((insight) => insight.tone === "profit").length;
  const businessLedgerNet = game.businessLedger.reduce((sum, record) => sum + record.finance.netChange, 0);
  const selectedRouteOwners = selectedRoute ? routeOwners(game.cities, selectedRoute) : null;
  const selectedRouteActors = selectedRoute ? game.worldActors.filter((actor) => actor.routeId === selectedRoute.id) : [];
  const regionalWeather = useMemo(() => regionalWeatherSnapshot(game.seed, game.day), [game.seed, game.day]);
  const calendarDate = useMemo(() => gameCalendarDate(game.day), [game.day]);
  const seasonalAdvisory = useMemo(() => seasonalTravelAdvisory(game.day), [game.day]);
  const visibleRegionalWeather = useMemo(() => {
    if (mapLayer === "weather") return regionalWeather;
    if (mapLayer === "roads" || mapLayer === "business") return [];
    return regionalWeather
      .filter((weather) => weather.kind !== "clear")
      .sort((a, b) => b.severity - a.severity || a.region.id.localeCompare(b.region.id))
      .slice(0, 4);
  }, [regionalWeather, mapLayer]);
  const activeCityIds = useMemo(() => new Set([
    ...(game.journey?.plan.cityIds ?? []),
    ...game.deputyDispatches.flatMap((dispatch) => [dispatch.fromCityId, dispatch.toCityId]),
  ]), [game.journey?.plan.id, deputyRouteSignature]);
  const routeCandidateSignature = routeCandidates.map((candidate) => `${candidate.id}:${candidate.routeIds.join(",")}:${candidate.cityIds.join(",")}`).join("|");
  const effectivePreviewId = routeCandidates.some((candidate) => candidate.id === previewRouteId) ? previewRouteId : routeCandidates[0]?.id ?? null;
  const previewCandidateIndex = routeCandidates.findIndex((candidate) => candidate.id === effectivePreviewId);
  const previewCandidate = previewCandidateIndex >= 0 ? routeCandidates[previewCandidateIndex] : null;
  const candidateCityIds = useMemo(() => new Set(previewCandidate?.cityIds ?? []), [previewCandidate?.id, routeCandidateSignature]);
  const mapDetail = mapDetailForViewportWidth(viewport.width);
  const zoomPercent = Math.round((VIEW_BOXES.realm.width / viewport.width) * 100);
  const officeCityIds = useMemo(() => Object.keys(game.offices), [game.offices]);
  const borderCityIds = useMemo(() => politicalBorderCityIds(game.cities, ROUTES), [game.cities]);
  const pinnedCityIds = useMemo(() => new Set([selectedCityId, game.currentCityId, ...activeCityIds, ...candidateCityIds, ...officeCityIds, ...expandedCityIds]), [selectedCityId, game.currentCityId, activeCityIds, candidateCityIds, officeCityIds, expandedCityIds]);
  const baselineDetailedCities = useMemo(() => detailedCityIds(CITIES, mapDetail, pinnedCityIds), [mapDetail, pinnedCityIds]);
  const detailedCities = useMemo(() => {
    if (routeCandidates.length === 0) return baselineDetailedCities;
    return new Set(CITIES.filter((city) =>
      baselineDetailedCities.has(city.id) && (pinnedCityIds.has(city.id) || city.tier === "capital"),
    ).map((city) => city.id));
  }, [baselineDetailedCities, pinnedCityIds, routeCandidateSignature]);
  const protectedCityIds = useMemo(() => new Set([
    ...pinnedCityIds,
    ...CITIES.filter((city) => city.tier === "capital" || viewport.width <= 270 || (city.tier === "major" && borderCityIds.has(city.id))).map((city) => city.id),
  ]), [pinnedCityIds, viewport.width, borderCityIds]);
  const cityMarkerClusters = useMemo(
    () => layoutCityMarkerClusters(
      CITIES,
      protectedCityIds,
      mapDetail,
      (city) => game.cities[city.id]?.owner ?? city.defaultOwner,
    ),
    [protectedCityIds, mapDetail, game.cities],
  );
  const cityStackClusters = useMemo(() => cityMarkerClusters.filter((cluster) => cluster.cityIds.length > 1), [cityMarkerClusters]);
  const individualCityIds = useMemo(() => new Set([
    ...protectedCityIds,
    ...cityMarkerClusters.filter((cluster) => cluster.cityIds.length === 1).map((cluster) => cluster.primaryCityId),
  ]), [protectedCityIds, cityMarkerClusters]);
  const visibleDetailedCities = useMemo(() => new Set([...detailedCities].filter((cityId) => individualCityIds.has(cityId))), [detailedCities, individualCityIds]);
  const borderRouteCount = useMemo(() => ROUTES.filter((route) => routeCrossesPoliticalBorder(game.cities, route)).length, [game.cities]);
  const cityRenderOrder = useMemo(() => CITIES.filter((city) => individualCityIds.has(city.id)).sort((a, b) => {
    const priority = (cityId: string) =>
      (borderCityIds.has(cityId) ? 1 : 0)
      + (activeCityIds.has(cityId) ? 2 : 0)
      + (selectedCityId === cityId ? 4 : 0)
      + (game.currentCityId === cityId ? 8 : 0);
    return priority(a.id) - priority(b.id) || a.y - b.y || a.id.localeCompare(b.id);
  }), [activeCityIds, borderCityIds, selectedCityId, game.currentCityId, individualCityIds]);
  const compactCityCount = individualCityIds.size - visibleDetailedCities.size;
  const settlementMarkerLayout = useMemo(() => layoutSettlementMarkers([
    ...CITIES.filter((city) => individualCityIds.has(city.id)).map((city) => {
      const detailed = visibleDetailedCities.has(city.id);
      const glyphScale = CITY_GLYPH_SCALE[mapDetail][city.tier];
      const radius = detailed
        ? (city.tier === "capital" ? 15 : city.tier === "major" ? 12 : 6.5) * glyphScale + 2.2
        : mapDetail === "wide" ? 5.1 : mapDetail === "mid" ? 4 : 3.4;
      const priority = (game.currentCityId === city.id ? 1000 : 0)
        + (selectedCityId === city.id ? 900 : 0)
        + (activeCityIds.has(city.id) || candidateCityIds.has(city.id) ? 800 : 0)
        + (city.tier === "capital" ? 700 : city.tier === "major" ? 350 : 100)
        + (game.offices[city.id] ? 560 : 0)
        + (borderCityIds.has(city.id) ? 420 : 0);
      return {
        id: `city:${city.id}`,
        x: city.x,
        y: city.y,
        radius,
        priority,
        fixed: game.currentCityId === city.id,
      };
    }),
    ...cityStackClusters.map((cluster) => {
      const primary = CITIES.find((city) => city.id === cluster.primaryCityId)!;
      return {
        id: `cluster:${cluster.id}`,
        x: cluster.x,
        y: cluster.y,
        radius: cluster.radius + 3.2,
        priority: primary.tier === "major" ? 260 : 180,
      };
    }),
  ], mapDetail), [individualCityIds, visibleDetailedCities, mapDetail, game.currentCityId, game.offices, selectedCityId, activeCityIds, candidateCityIds, borderCityIds, cityStackClusters]);
  const settlementMarkerById = useMemo(() => new Map(settlementMarkerLayout.map((layout) => [layout.id, layout])), [settlementMarkerLayout]);
  const positionedIndividualCities = useMemo(() => CITIES.filter((city) => individualCityIds.has(city.id)).map((city) => {
    const layout = settlementMarkerById.get(`city:${city.id}`);
    return layout ? { ...city, x: layout.markerX, y: layout.markerY } : city;
  }), [individualCityIds, settlementMarkerById]);
  const positionedCityById = useMemo(() => new Map(positionedIndividualCities.map((city) => [city.id, city])), [positionedIndividualCities]);
  const detailedCityList = useMemo(() => positionedIndividualCities.filter((city) => visibleDetailedCities.has(city.id)), [positionedIndividualCities, visibleDetailedCities]);
  const cityIconObstacles = useMemo<MapIconObstacle[]>(() => settlementMarkerLayout.map((layout) => ({
    id: layout.id,
    x: layout.markerX,
    y: layout.markerY,
    radius: layout.radius,
  })), [settlementMarkerLayout]);
  const cityClusterObstacles = useMemo<MapIconObstacle[]>(() => settlementMarkerLayout
    .filter((layout) => layout.id.startsWith("cluster:"))
    .map((layout) => ({ id: layout.id, x: layout.markerX, y: layout.markerY, radius: layout.radius })), [settlementMarkerLayout]);
  const routeBadgeLayout = useMemo(() => {
    const roadBadges = ROUTES.flatMap((route) => {
      const curve = routeCurve(route);
      const knownCondition = game.routeIntel[route.id]?.knownCondition ?? "clear";
      const badgeRadius = mapDetail === "wide" ? 7.8 : mapDetail === "mid" ? 5.6 : 3.8;
      const badges: RouteBadgePoint[] = [];
      if (activeRoutes.has(route.id) || knownCondition !== "clear") {
        badges.push({ id: `route-state:${route.id}`, x: curve.mx, y: curve.my, radius: badgeRadius, priority: selectedRouteId === route.id ? 1_200 : activeRoutes.has(route.id) ? 1_080 : 880 });
      }
      if (deputyRoutes.has(route.id)) {
        badges.push({ id: `route-deputy:${route.id}`, x: curve.mx, y: curve.my, radius: badgeRadius, priority: 1_100 });
      }
      if (routeCrossesPoliticalBorder(game.cities, route)) {
        const split = splitQuadraticCurve({ from: curve.from, to: curve.to, control: { x: curve.mx, y: curve.my } });
        badges.push({ id: `route-border:${route.id}`, x: split.midpoint.x, y: split.midpoint.y, radius: badgeRadius, priority: 1_040 });
      } else if (mapLayer === "roads" && knownCondition === "clear" && !activeRoutes.has(route.id) && !deputyRoutes.has(route.id)) {
        const presentation = roadPresentationById.get(route.id);
        const showTerrainBadge = selectedRouteId === route.id
          || presentation?.grade === "arterial"
          || (mapDetail === "close" && presentation?.grade === "regional");
        if (showTerrainBadge) {
          badges.push({ id: `route-kind:${route.id}`, x: curve.mx, y: curve.my, radius: badgeRadius * .74, priority: selectedRouteId === route.id ? 1_160 : presentation?.grade === "arterial" ? 360 : 180 });
        }
      }
      return badges;
    });
    const candidateSealScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .78 : .58;
    const candidateBadges: RouteBadgePoint[] = routeCandidates.flatMap((candidate, index) => {
      const anchorRouteId = routeCandidateAnchorRouteId(candidate, routeCandidates);
      const route = ROUTES.find((item) => item.id === anchorRouteId);
      if (!route) return [];
      const curve = routeCurve(route);
      return [{
        id: `route-candidate:${candidate.id}`,
        x: curve.mx,
        y: curve.my,
        radius: 7.3 * candidateSealScale + 1.2,
        priority: candidate.id === effectivePreviewId ? 1_260 : 1_220 - index,
      }];
    });
    return layoutRouteBadges([...roadBadges, ...candidateBadges], cityIconObstacles, mapDetail);
  }, [game.cities, game.routeIntel, mapDetail, activeRouteSignature, deputyRouteSignature, mapLayer, selectedRouteId, cityIconObstacles, routeCandidateSignature, effectivePreviewId]);
  const routeBadgeById = useMemo(() => new Map(routeBadgeLayout.map((layout) => [layout.id, layout])), [routeBadgeLayout]);
  const routeBadgeObstacles = useMemo<MapIconObstacle[]>(() => routeBadgeLayout.map((layout) => ({
    id: layout.id,
    x: layout.markerX,
    y: layout.markerY,
    radius: layout.radius,
  })), [routeBadgeLayout]);
  const captivityMarkerAnchors = useMemo(() => {
    const groups = new Map<string, Array<{ id: string; name: string; captor: string }>>();
    for (const member of game.crew) {
      if (!member.captivity) continue;
      const members = groups.get(member.captivity.routeId) ?? [];
      members.push({ id: member.id, name: member.name, captor: member.captivity.captor });
      groups.set(member.captivity.routeId, members);
    }
    return [...groups.entries()].flatMap(([routeId, members]) => {
      const route = ROUTES.find((candidate) => candidate.id === routeId);
      if (!route) return [];
      const curve = routeCurve(route);
      const dx = curve.to.x - curve.from.x;
      const dy = curve.to.y - curve.from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const offset = mapDetail === "wide" ? 13 : mapDetail === "mid" ? 9 : 6;
      return [{
        route,
        members,
        x: curve.mx - dy / length * offset,
        y: curve.my + dx / length * offset,
      }];
    });
  }, [game.crew, mapDetail]);
  const captivityMarkerLayout = useMemo(() => layoutMapActors(
    captivityMarkerAnchors.map((marker) => ({ id: marker.route.id, kind: "army" as const, x: marker.x, y: marker.y })),
    [...cityIconObstacles, ...routeBadgeObstacles],
    mapDetail,
    false,
    mapDetail === "wide" ? 8 : mapDetail === "mid" ? 5 : 3,
  ), [captivityMarkerAnchors, cityIconObstacles, routeBadgeObstacles, mapDetail]);
  const captivityMarkers = useMemo(() => captivityMarkerAnchors.flatMap((marker) => {
    const layout = captivityMarkerLayout.find((candidate) => candidate.primaryActorId === marker.route.id);
    return layout ? [{ ...marker, x: layout.x, y: layout.y, anchorX: layout.anchorX, anchorY: layout.anchorY, radius: layout.radius }] : [];
  }), [captivityMarkerAnchors, captivityMarkerLayout]);
  const captivityObstacles = useMemo<MapIconObstacle[]>(() => captivityMarkers.map((marker) => ({
    id: `captivity:${marker.route.id}`,
    x: marker.x,
    y: marker.y,
    radius: marker.radius,
  })), [captivityMarkers]);
  const pinnedLandmarkRouteIds = useMemo(() => new Set([
    ...activeRouteIds,
    ...deputyRouteIds,
    ...(previewCandidate?.routeIds ?? []),
    ...(selectedRouteId ? [selectedRouteId] : []),
  ]), [activeRouteSignature, deputyRouteSignature, previewCandidate?.id, selectedRouteId]);
  const visibleLandmarks = useMemo(() => ROUTE_LANDMARKS.filter((landmark) => {
    if (pinnedLandmarkRouteIds.has(landmark.routeId)) return true;
    if (mapLayer === "weather") return false;
    if (mapLayer !== "roads" || mapDetail !== "close" || routeCandidates.length > 0) return landmark.prominence === "major";
    return true;
  }), [mapDetail, mapLayer, pinnedLandmarkRouteIds, routeCandidateSignature]);
  const landmarkLayout = useMemo(() => layoutRouteLandmarks(visibleLandmarks.flatMap((landmark) => {
    const route = ROUTES.find((candidate) => candidate.id === landmark.routeId);
    if (!route) return [];
    const point = pointOnRoute(route, landmark.progress, route.from);
    return [{
      id: landmark.id,
      kind: landmark.kind,
      prominence: landmark.prominence,
      pinned: pinnedLandmarkRouteIds.has(landmark.routeId),
      x: point.x,
      y: point.y,
    }];
  }), [...cityIconObstacles, ...routeBadgeObstacles, ...captivityObstacles], mapDetail), [visibleLandmarks, cityIconObstacles, routeBadgeObstacles, captivityObstacles, mapDetail, pinnedLandmarkRouteIds]);
  const landmarksById = useMemo(() => new Map(ROUTE_LANDMARKS.map((landmark) => [landmark.id, landmark])), []);
  const landmarkObstacles = useMemo<MapIconObstacle[]>(() => landmarkLayout.map((layout) => ({
    id: `landmark:${layout.id}`,
    x: layout.x,
    y: layout.y,
    radius: layout.radius,
  })), [landmarkLayout]);
  const actorLayout = useMemo(() => {
    const points = game.worldActors.flatMap((actor) => {
      if (mapLayer === "weather" && !pinnedLandmarkRouteIds.has(actor.routeId)) return [];
      if (routeCandidates.length > 0 && !pinnedLandmarkRouteIds.has(actor.routeId)) return [];
      const route = ROUTES.find((candidate) => candidate.id === actor.routeId);
      if (!route) return [];
      const point = pointOnRoute(route, actor.progress, actor.fromCityId);
      return [{ id: actor.id, kind: actor.kind, x: point.x, y: point.y }];
    });
    return layoutMapActors(points, [...cityIconObstacles, ...routeBadgeObstacles, ...captivityObstacles, ...landmarkObstacles], mapDetail, viewport.width > 270);
  }, [game.worldActors, mapDetail, mapLayer, viewport.width, cityIconObstacles, routeBadgeObstacles, captivityObstacles, landmarkObstacles, pinnedLandmarkRouteIds, routeCandidateSignature]);
  const actorsById = useMemo(() => new Map(game.worldActors.map((actor) => [actor.id, actor])), [game.worldActors]);
  const actorObstacles = useMemo<MapIconObstacle[]>(() => actorLayout.map((layout) => ({
    id: `actor:${layout.id}`,
    x: layout.x,
    y: layout.y,
    radius: layout.radius,
  })), [actorLayout]);
  const weatherMarkerLayout = useMemo(() => layoutWeatherMarkers(visibleRegionalWeather.map((weather) => {
    const point = projectedLabel(...weather.region.center);
    const offset = weatherMarkerOffset[weather.region.id] ?? { x: 0, y: 0 };
    return { id: weather.region.id, x: point.x, y: point.y, offsetX: offset.x, offsetY: offset.y };
  }), [...cityIconObstacles, ...routeBadgeObstacles, ...captivityObstacles, ...landmarkObstacles, ...actorObstacles], mapDetail), [visibleRegionalWeather, cityIconObstacles, routeBadgeObstacles, captivityObstacles, landmarkObstacles, actorObstacles, mapDetail]);
  const weatherByRegionId = useMemo(() => new Map<string, (typeof regionalWeather)[number]>(regionalWeather.map((weather) => [weather.region.id, weather])), [regionalWeather]);
  const notableWeather = useMemo(() => regionalWeather
    .filter((weather) => weather.kind !== "clear")
    .sort((a, b) => b.severity - a.severity || a.region.id.localeCompare(b.region.id))
    .slice(0, 3), [regionalWeather]);
  const adverseWeatherCount = useMemo(() => regionalWeather.filter((weather) => weather.kind !== "clear").length, [regionalWeather]);
  const knownRoadIssueCount = useMemo(() => ROUTES.filter((route) => (game.routeIntel[route.id]?.knownCondition ?? "clear") !== "clear").length, [game.routeIntel]);
  const overlayLabelObstacles = useMemo<MapIconObstacle[]>(() => [
    ...cityClusterObstacles,
    ...routeBadgeObstacles,
    ...captivityObstacles,
    ...landmarkObstacles,
    ...actorObstacles,
    ...weatherMarkerLayout.map((layout) => ({ id: `weather:${layout.id}`, x: layout.markerX, y: layout.markerY, radius: layout.radius })),
  ], [cityClusterObstacles, routeBadgeObstacles, captivityObstacles, landmarkObstacles, actorObstacles, weatherMarkerLayout]);
  const cityLabels = useMemo(
    () => layoutCityLabels(detailedCityList, viewport, mapDetail, pinnedCityIds, positionedIndividualCities, visibleDetailedCities, overlayLabelObstacles),
    [detailedCityList, viewport, mapDetail, pinnedCityIds, positionedIndividualCities, visibleDetailedCities, overlayLabelObstacles],
  );
  const stackedActorGroups = actorLayout.filter((group) => group.actorIds.length > 1).length;
  const stackedLandmarkGroups = landmarkLayout.filter((group) => group.landmarkIds.length > 1).length;

  useEffect(() => {
    if (mapDetail === "wide" && expandedCityIds.length > 0) setExpandedCityIds([]);
  }, [mapDetail, expandedCityIds.length]);

  function markerHitRadius(city: (typeof CITIES)[number]) {
    return cityMarkerHitRadius(city, mapDetail, detailedCities.has(city.id));
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
    setExpandedCityIds([]);
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

  function focusCities(cityIds: string[]) {
    const clusterViewport = viewportForCities(cityIds);
    if (!clusterViewport) return;
    setFocus(null);
    cancelWheelInteraction();
    commitViewport(clusterViewport);
  }

  function expandCityCluster(cityIds: string[]) {
    setExpandedCityIds(cityIds);
    focusCities(cityIds);
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
    if ((event.target as Element).closest(".city-node, .city-node-hit-target, .city-cluster, .route-hit-target")) return;
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
    const nearest = nearestCityToPoint(positionedIndividualCities.filter((city) => Boolean(game.cities[city.id])), point);
    if (nearest) onSelectCity(nearest.id);
  }

  function inspectRoute(routeId: string) {
    setSelectedRouteId((current) => current === routeId ? null : routeId);
    setMapLayer((current) => current === "business" ? current : "roads");
  }

  function focusRouteEndpoint(cityId: string) {
    onSelectCity(cityId);
    focusCities([cityId]);
  }

  return (
    <div className={`map-stage historical-map map-focus-${focus ?? "custom"} map-detail-${mapDetail} map-layer-${mapLayer} ${routeCandidates.length > 0 ? "has-route-candidates" : ""} ${selectedRoute ? "has-road-ledger" : ""} ${dragging ? "is-dragging" : ""} ${dragging || zooming ? "is-interacting" : ""}`}>
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
        <div className="map-layer-tools" aria-label="地图信息图层">
          <button className={mapLayer === "overview" ? "active" : ""} aria-pressed={mapLayer === "overview"} onClick={() => setMapLayer("overview")}>通览</button>
          <button className={mapLayer === "roads" ? "active" : ""} aria-label={`驿路图层，${knownRoadIssueCount}处已知异状`} aria-pressed={mapLayer === "roads"} onClick={() => setMapLayer("roads")}><span>驿路</span>{knownRoadIssueCount > 0 && <em aria-hidden="true">{knownRoadIssueCount}</em>}</button>
          <button className={mapLayer === "business" ? "active" : ""} aria-label={`商路图层，本号走过${traveledBusinessRouteCount}段路线`} aria-pressed={mapLayer === "business"} onClick={() => setMapLayer("business")}><span>商路</span>{traveledBusinessRouteCount > 0 && <em aria-hidden="true">{traveledBusinessRouteCount}</em>}</button>
          <button className={mapLayer === "weather" ? "active" : ""} aria-label={`天候图层，${adverseWeatherCount}处恶候`} aria-pressed={mapLayer === "weather"} onClick={() => setMapLayer("weather")}><span>天候</span>{adverseWeatherCount > 0 && <em aria-hidden="true">{adverseWeatherCount}</em>}</button>
        </div>
        <div className="map-zoom-tools">
          <button aria-label="缩小地图" title="缩小" onClick={() => zoomBy(1.22)}>−</button>
          <output aria-label="地图缩放比例">{zoomPercent}%</output>
          <button aria-label="放大地图" title="放大" onClick={() => zoomBy(0.82)}>＋</button>
          <button className="map-reset" onClick={() => selectFocus("realm")}>复位</button>
        </div>
        <div className="map-layer-key" aria-live="polite">
          {mapLayer === "overview" && <span className="layer-key-note"><i>叠</i>图标随缩放合标，点击数字印展开</span>}
          {mapLayer === "roads" && <>
            <span><i className="layer-road official" />官道</span>
            <span><i className="layer-road mountain" />山路</span>
            <span><i className="layer-road river" />水路</span>
            <span><i className="layer-road-grade arterial">干</i>主干</span>
            <span><i className="layer-road-grade local">支</i>支路</span>
          </>}
          {mapLayer === "business" && <>
            <span><i className="layer-business profit">盈</i>近账盈利</span>
            <span><i className="layer-business even">平</i>收支相抵</span>
            <span><i className="layer-business loss">亏</i>近账亏损</span>
            <span><i className="layer-business known">熟</i>走过未结</span>
          </>}
          {mapLayer === "weather" && <>
            <span className={`layer-key-note season-${seasonalAdvisory.season}`} title={seasonalAdvisory.summary}><i>{seasonalAdvisory.seal}</i>{calendarDate.seasonPeriodLabel} · {seasonalAdvisory.title}</span>
            <span className="layer-key-note"><i>候</i>{adverseWeatherCount}处恶候</span>
            {notableWeather.map((weather) => (
              <span key={weather.region.id} className={`weather-${weather.kind}`}><i>{weather.seal}</i>{weather.region.name}</span>
            ))}
          </>}
        </div>
      </div>
      <div className="map-gesture-hint">滚轮缩放 · 按住拖移</div>
      {currentCity && (
        <button className={`map-current-location ${currentWeather ? `weather-${currentWeather.kind}` : ""}`} onClick={focusCurrentCity} title={`定位到${currentCity.name}`}>
          <i>镖</i>
          <span>镖队所在<b>{currentCity.name}</b>{currentWeather && <em>{currentWeather.seal}·{currentWeather.label}</em>}</span>
          <small>点击定位</small>
        </button>
      )}
      {selectedRoute && selectedRouteCondition && selectedRouteWeather && selectedRoadInfluence && selectedRouteOwners && selectedRouteBusiness && (
        <section className={`map-road-ledger road-tone-${selectedRoadInfluence.tone}`} aria-label={`${selectedRoute.name}驿路路簿`}>
          <header>
            <i>{terrainSeal[selectedRoute.terrain]}</i>
            <span><small>{selectedRoutePresentation?.label ?? "驿路"} · {selectedRouteIntelAge <= 2 ? "新报" : selectedRouteIntelAge <= 6 ? `${selectedRouteIntelAge}日前旧报` : "仅有传闻"}</small><b>{selectedRoute.name}</b></span>
            <button aria-label="收起驿路路簿" onClick={() => setSelectedRouteId(null)}>×</button>
          </header>
          <div className="road-ledger-endpoints">
            {[selectedRoute.from, selectedRoute.to].map((cityId, index) => <button key={cityId} onClick={() => focusRouteEndpoint(cityId)}>
              <small>{index === 0 ? "此端" : "彼端"} · {FACTIONS[index === 0 ? selectedRouteOwners.from : selectedRouteOwners.to].short}实控</small>
              <b>{CITIES.find((city) => city.id === cityId)?.name}</b>
            </button>)}
            <i>{selectedRouteOwners.from === selectedRouteOwners.to ? "同境" : "异旗边路"}</i>
          </div>
          <div className="road-ledger-metrics">
            <span><small>基准脚程</small><b>{selectedRoute.days} 日</b></span>
            <span><small>已知路险</small><b>{selectedRouteIntel?.knownDanger ?? selectedRoute.danger}</b></span>
            <span title={`${selectedRouteWeather.label}：${selectedRouteWeatherEffect?.note ?? selectedRouteWeather.description}`}><small>今日天候 · {selectedRouteWeather.seal}</small><b>{selectedRouteWeatherEffect?.dayModifier ? `误程 +${selectedRouteWeatherEffect.dayModifier}日` : "不误程"} · 险+{selectedRouteWeatherEffect?.dangerModifier ?? 0}</b></span>
            <span><small>熟路趟数</small><b>{selectedRouteIntel?.trips ?? 0} 趟</b></span>
          </div>
          <div className={`road-ledger-business business-tone-${selectedRouteBusiness.tone}`}>
            <i>{selectedRouteBusiness.seal}</i>
            <span><small>本号商路 · 最近十二趟账页分摊</small><b>{selectedRouteBusiness.masteryLabel}{selectedRouteBusiness.ledgerTrips ? ` · ${selectedRouteBusiness.ledgerTrips} 趟入账` : ""}</b><p>{selectedRouteBusiness.summary}{selectedRouteBusiness.lastTitle ? ` 最近一笔「${selectedRouteBusiness.lastTitle}」于第 ${selectedRouteBusiness.lastClosedDay} 日收卷。` : ""}</p></span>
            <strong>{selectedRouteBusiness.ledgerTrips ? `${selectedRouteBusiness.allocatedNet >= 0 ? "+" : ""}${selectedRouteBusiness.allocatedNet}` : "—"}<small>分摊净银</small></strong>
          </div>
          <div className="road-ledger-power">
            <i>{selectedRoadInfluence.seal}</i>
            <span><small>{selectedRoadInfluence.power.name} · 匪势 {selectedRoadInfluence.pressure}/100</small><b>{selectedRoadInfluence.label}{selectedRoadInfluence.effectiveUntilDay ? ` · 至第 ${selectedRoadInfluence.effectiveUntilDay} 日` : ""}</b><p>{selectedRoadInfluence.note}</p></span>
          </div>
          <footer>
            <span><b>{selectedRouteCondition.seal}·{selectedRouteCondition.label}</b><small>{selectedRouteCondition.description}{selectedRouteWeatherPressure?.preferredCondition ? ` 当前${selectedRouteWeatherPressure.cause}，若天象延续易成${ROUTE_CONDITION_EFFECTS[selectedRouteWeatherPressure.preferredCondition].label}。` : ""}</small></span>
            <span><b>{selectedRouteActors.length ? `${selectedRouteActors.length} 支行旅在路` : "路面未见行旅"}</b><small>{selectedRoadInfluence.lastOutcome ? `上次处置：${roadOutcomeLabel[selectedRoadInfluence.lastOutcome]} · 第 ${selectedRoadInfluence.lastDay} 日` : "尚无本号处置记录"}</small></span>
          </footer>
        </section>
      )}
      <div className={`map-detail-readout ${hasRemoteCitySelection && !readoutRoute ? "is-city-selection" : ""}`} aria-live="polite">
        <b>{readoutRoute ? readoutRoute.name : hasRemoteCitySelection && selectedCity ? selectedCity.name : mapLayer === "roads" ? "驿路图层" : mapLayer === "business" ? "商路图层" : mapLayer === "weather" ? "天候图层" : mapDetail === "wide" ? "天下总览" : mapDetail === "mid" ? "州府详览" : "驿路近览"}</b>
          <span>{readoutRoute && readoutRouteWeather && readoutRouteCondition
            ? `${roadPresentationById.get(readoutRoute.id)?.label ?? TERRAIN_LABEL[readoutRoute.terrain]} · ${TERRAIN_LABEL[readoutRoute.terrain]} · ${readoutRoute.days}日 · ${readoutRouteCondition.seal}·${readoutRouteCondition.label} · ${readoutRouteWeather.seal}·${readoutRouteWeather.label}`
            : hasRemoteCitySelection && selectedCity && selectedCityFaction && selectedCityCondition
              ? `${selectedCityFaction.short}实控 · ${selectedCityCondition.label} · 东经${selectedCity.lon.toFixed(2)}° 北纬${selectedCity.lat.toFixed(2)}°`
            : `${visibleDetailedCities.size}座城楼${compactCityCount > 0 ? ` · ${compactCityCount}处驿点` : " · 城驿尽显"} · ${landmarkLayout.length}枚路标 · ${borderRouteCount}处边路${captivityMarkers.length ? ` · ${captivityMarkers.length}处失陷` : ""}`}</span>
          {hasRemoteCitySelection && !readoutRoute && <small>已选城驿 · 点按其他城楼可立即切换</small>}
          {mapLayer === "roads" && <small>粗细区分干道、通衢与支路 · 常态只盖干道章，点选道路再显专属路章</small>}
          {mapLayer === "business" && <><small>本号走过 {traveledBusinessRouteCount} 段 · 近账盈利 {profitableBusinessRouteCount} 段 · 总账净银 {businessLedgerNet >= 0 ? "+" : ""}{businessLedgerNet} 两</small><small>线色取自最近十二趟真实账页；点击道路查看熟路与分摊收支</small></>}
          {mapLayer === "weather" && <><small>{calendarDate.fullLabel} · {seasonalAdvisory.title}：{seasonalAdvisory.summary}</small><small>区域锋面与受影响道路同色显影 · 牌面标出强度、余日与行路影响</small></>}
          {cityStackClusters.length > 0 && <small>{cityStackClusters.length}组密集城驿已合标 · 点击数字印放大展开</small>}
          {stackedLandmarkGroups > 0 && <small>{stackedLandmarkGroups}组相邻关渡已合标 · 放大继续展开</small>}
          {stackedActorGroups > 0 && <small>{stackedActorGroups}组同路行旅已合标 · 放大自动展开</small>}
        {selectedWeather && <small className={`weather-${selectedWeather.kind}`}>{selectedCity?.name} · {selectedWeather.seal}·{selectedWeather.label}</small>}
        {mapDetail !== "close" && <small>继续放大展开城池</small>}
      </div>
      {routeCandidates.length > 0 && (
        <section className="map-route-board" aria-label="候选行程地图对比">
          <header><span>行程路签</span><small>时日、路险、天候与旧账同看</small></header>
          <div>
            {routeCandidates.map((candidate, index) => {
              const highlighted = candidate.id === effectivePreviewId;
              const businessCaption = routeCandidateBusinessCaption(candidate);
              return (
                <button
                  key={candidate.id}
                  className={`route-candidate-choice candidate-tone-${index % 3} ${highlighted ? "is-highlighted" : ""}`}
                  aria-pressed={highlighted}
                  onMouseEnter={() => onPreviewRoute?.(candidate.id)}
                  onFocus={() => onPreviewRoute?.(candidate.id)}
                  onClick={() => onPreviewRoute?.(candidate.id)}
                  title={`${candidate.label}：${candidate.days}日，路险${candidate.dangerLabel}，${candidate.weatherLabel ?? "沿途天候未报"}，${candidate.borderSegments ? `跨${candidate.borderSegments}处边关` : "不跨边关"}；${candidate.business ? `${candidate.business.label}，${candidate.business.coverageLabel}，${businessCaption}` : businessCaption}`}
                >
                  <i>{routeCandidateSeal(index)}</i>
                  <span><b>{candidate.label}</b><small>{candidate.days}日 · 路险{candidate.dangerLabel} · {candidate.weatherLabel ?? "天候未报"}</small>{candidate.business && <em className={`route-candidate-business business-${candidate.business.tone}`}><u>{candidate.business.seal}</u>{businessCaption}</em>}</span>
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
            const frontScale = scale * (1 + weather.severity * .065);
            return (
              <g key={weather.region.id} className={`weather-region weather-${weather.kind} weather-severity-${weather.severity}`} transform={`translate(${point.x} ${point.y})`}>
                <g transform={`scale(${frontScale})`}>
                  <path className="weather-front-shadow" d="M-56 2 Q-51 -29 -30 -27 Q-13 -43 8 -30 Q31 -43 43 -20 Q61 -14 59 11 Q47 34 23 29 Q2 42 -16 31 Q-42 39 -56 20 Z" />
                  <path className="weather-front-core" d="M-49 3 Q-44 -22 -26 -20 Q-12 -34 5 -23 Q25 -35 35 -16 Q50 -11 50 8 Q40 25 20 21 Q2 31 -12 23 Q-33 29 -46 15 Z" />
                  <path className="weather-front-ring" d="M-53 1 Q-48 -25 -27 -23 Q-12 -38 6 -26 Q27 -39 38 -18 Q55 -13 54 8 Q43 29 21 24 Q2 36 -13 26 Q-37 34 -51 17 Z" />
                  <path className="weather-front-inner" d="M-42 3 Q-37 -16 -22 -13 Q-12 -25 2 -16 Q17 -25 27 -11 Q39 -8 40 6 Q31 18 17 15 Q4 23 -7 16 Q-24 22 -37 12 Z" />
                  <path className="weather-wash" d="M-46 4 Q-42 -18 -24 -15 Q-15 -31 3 -19 Q19 -31 29 -14 Q45 -13 47 5 Q38 21 19 17 Q5 27 -8 18 Q-29 27 -42 13 Z" />
                  <WeatherAtmosphereTexture kind={weather.kind} />
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
             const borderBadge = routeBadgeById.get(`route-border:${route.id}`);
             const borderX = borderBadge?.markerX ?? split.midpoint.x;
             const borderY = borderBadge?.markerY ?? split.midpoint.y;
             const borderScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .62 : .36;
             return (
               <g key={route.id} className="control-corridor-pair is-border">
                 <path className="control-corridor side-from" d={split.fromPath} stroke={FACTIONS[owners.from].color} />
                 <path className="control-corridor side-to" d={split.toPath} stroke={FACTIONS[owners.to].color} />
                 {borderBadge?.displaced && <path className="route-badge-anchor" d={`M ${split.midpoint.x} ${split.midpoint.y} L ${borderX} ${borderY}`} />}
                 <g className="political-border-seal" transform={`translate(${borderX} ${borderY})`}>
                   <g transform={`scale(${borderScale})`}>
                     <circle className="border-seal-paper" r="6.7" />
                     <path className="border-seal-side side-from" d="M0 -5.5 A5.5 5.5 0 0 0 0 5.5 Z" fill={FACTIONS[owners.from].color} />
                     <path className="border-seal-side side-to" d="M0 -5.5 A5.5 5.5 0 0 1 0 5.5 Z" fill={FACTIONS[owners.to].color} />
                     <circle className="border-seal-frame" r="6.7" />
                     <text y="2.2" textAnchor="middle">界</text>
                     <title>{FACTIONS[owners.from].name}与{FACTIONS[owners.to].name}当前边路 · {route.name}</title>
                   </g>
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
            const deputyActive = deputyRoutes.has(route.id);
            const intelAge = Math.max(0, game.day - (game.routeIntel[route.id]?.surveyedDay ?? -99));
            const intelClass = intelAge <= 2 ? "intel-fresh" : intelAge <= 6 ? "intel-aging" : "intel-rumor";
            const knownCondition = game.routeIntel[route.id]?.knownCondition ?? "clear";
            const conditionEffect = ROUTE_CONDITION_EFFECTS[knownCondition];
             const routeWeather = weatherForRoute(game.seed, game.day, route);
             const borderRoute = routeCrossesPoliticalBorder(game.cities, route);
             const presentation = roadPresentationById.get(route.id)!;
             const business = routeBusinessById[route.id];
             const routeSealScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .7 : .48;
             const deputySealScale = mapDetail === "wide" ? 1.15 : mapDetail === "mid" ? .95 : .72;
             const stateBadge = routeBadgeById.get(`route-state:${route.id}`);
             const deputyBadge = routeBadgeById.get(`route-deputy:${route.id}`);
             const terrainBadge = routeBadgeById.get(`route-kind:${route.id}`);
             return (
               <g
                 key={route.id}
                 className={`route route-${route.terrain} road-grade-${presentation.grade} route-condition-${knownCondition} route-weather-${routeWeather.kind} weather-severity-${routeWeather.severity} road-tone-${roadInfluenceSnapshot(route.id, game.routeStates[route.id], game.day).tone} business-tone-${business.tone} business-mastery-${Math.min(3, business.trips)} ${business.trips > 0 || business.ledgerTrips > 0 ? "is-business-traveled" : ""} ${intelClass} ${active ? "is-active" : ""} ${deputyActive ? "is-deputy-dispatch" : ""} ${hoveredRouteId === route.id ? "is-hovered" : ""} ${selectedRouteId === route.id ? "is-inspected" : ""}`}
                aria-hidden="true"
              >
                <path className="route-hit" d={path} />
                <path className="route-shadow" d={path} />
                <path className="route-casing" d={path} />
                <path className="route-bed" d={path} />
                 <path className="route-line" d={path} stroke={active ? "#e0b85d" : deputyActive ? "#4f8f82" : terrainColor[route.terrain]} />
                 <path className="route-pattern" d={path} />
                 <path className="route-weather-trace" d={path} />
                 {stateBadge?.displaced && <path className="route-badge-anchor" d={`M ${mx} ${my} L ${stateBadge.markerX} ${stateBadge.markerY}`} />}
                 {active && knownCondition === "clear" && stateBadge && <g className={`route-active-seal terrain-${route.terrain}`} transform={`translate(${stateBadge.markerX} ${stateBadge.markerY})`}><g transform={`scale(${routeSealScale})`}><circle r="5.2" /><text y="2" textAnchor="middle">{terrainSeal[route.terrain]}</text></g></g>}
                 {deputyBadge?.displaced && <path className="route-badge-anchor route-deputy-anchor" d={`M ${mx} ${my} L ${deputyBadge.markerX} ${deputyBadge.markerY}`} />}
                 {deputyActive && deputyBadge && <g className="route-deputy-seal" transform={`translate(${deputyBadge.markerX} ${deputyBadge.markerY})`}><g transform={`scale(${deputySealScale})`}><circle r="5.5" /><text y="2" textAnchor="middle">副</text></g></g>}
                 {knownCondition !== "clear" && stateBadge && <g className={`route-condition-seal condition-${knownCondition} ${intelAge > 2 ? "is-stale" : ""}`} transform={`translate(${stateBadge.markerX} ${stateBadge.markerY})`}><g transform={`scale(${routeSealScale})`}><circle r="5" /><text y="2" textAnchor="middle">{conditionEffect.seal}</text></g></g>}
                 {terrainBadge?.displaced && <path className="route-badge-anchor" d={`M ${mx} ${my} L ${terrainBadge.markerX} ${terrainBadge.markerY}`} />}
                 {mapLayer === "roads" && knownCondition === "clear" && !active && !deputyActive && !borderRoute && terrainBadge && (
                   <g className={`route-terrain-seal terrain-${route.terrain}`} transform={`translate(${terrainBadge.markerX} ${terrainBadge.markerY})`} aria-hidden="true">
                     <g transform={`scale(${routeSealScale})`}><circle r="4.2" /><text y="1.7" textAnchor="middle">{terrainSeal[route.terrain]}</text></g>
                   </g>
                 )}
                 <title>{route.name} · {presentation.label} · {TERRAIN_LABEL[route.terrain]} · {route.days}日 · {conditionEffect.label} · {routeWeather.seal}·{routeWeather.label}{deputyActive ? " · 副队短镖在途" : ""} · {business.masteryLabel}{business.ledgerTrips ? ` · 近账分摊${business.allocatedNet >= 0 ? "+" : ""}${business.allocatedNet}两` : ""} · {intelAge <= 2 ? "新报" : intelAge <= 6 ? `${intelAge}日前旧报` : "仅有传闻"}</title>
              </g>
            );
          })}
        </g>

        <g className="route-hit-layer" aria-label="可查阅驿路">
          {ROUTES.map((route) => (
            <path
              key={route.id}
              className="route-hit-target"
              d={routeHitPath(route)}
              role="button"
              tabIndex={0}
              aria-label={`查看${route.name}驿路路簿`}
              onPointerEnter={() => setHoveredRouteId(route.id)}
              onPointerLeave={() => setHoveredRouteId((current) => current === route.id ? null : current)}
              onFocus={() => setHoveredRouteId(route.id)}
              onBlur={() => setHoveredRouteId((current) => current === route.id ? null : current)}
              onClick={(event) => { event.stopPropagation(); inspectRoute(route.id); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inspectRoute(route.id);
                }
              }}
            >
              <title>查看{route.name}驿路路簿</title>
            </path>
          ))}
        </g>

        {captivityMarkers.length > 0 && <g className={`captivity-markers captivity-detail-${mapDetail}`} aria-label="队员失陷道路">
          {captivityMarkers.map((marker) => {
            const scale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .72 : .52;
            const names = marker.members.map((member) => member.name).join("、");
            const captors = [...new Set(marker.members.map((member) => member.captor))].join("、");
            const endpoints = [CITIES.find((city) => city.id === marker.route.from)?.name, CITIES.find((city) => city.id === marker.route.to)?.name].filter(Boolean).join("或");
            const displaced = Math.hypot(marker.x - marker.anchorX, marker.y - marker.anchorY) > 1;
            return <g key={marker.route.id} className="captivity-marker" transform={`translate(${marker.x} ${marker.y})`} role="img" aria-label={`${names}在${marker.route.name}被俘`}>
              {displaced && <path className="captivity-anchor-line" d={`M0 0 L${marker.anchorX - marker.x} ${marker.anchorY - marker.y}`} />}
              <g transform={`scale(${scale})`}>
                <circle className="captivity-marker-halo" r="9" />
                <path className="captivity-marker-paper" d="M-6.7 -7.6 L6.3 -6.3 L7.2 6.7 L-5.8 7.7 Z" />
                <text y="3.2" textAnchor="middle">俘</text>
                {marker.members.length > 1 && <g className="captivity-marker-count" transform="translate(7 -7)"><circle r="4.1" /><text y="1.6" textAnchor="middle">{marker.members.length}</text></g>}
              </g>
              <title>{names} · 被{captors}扣于{marker.route.name} · 可到{endpoints}托行院赎回</title>
            </g>;
          })}
        </g>}

        <g className={`map-route-landmarks landmark-detail-${mapDetail}`} aria-label="沿途关隘、渡口、驿亭与寨市">
          {landmarkLayout.map((layout) => {
            const landmark = landmarksById.get(layout.primaryLandmarkId);
            if (!landmark) return null;
            const route = ROUTES.find((candidate) => candidate.id === landmark.routeId);
            if (!route) return null;
            const members = layout.landmarkIds.map((id) => landmarksById.get(id)).filter((item) => Boolean(item));
            const memberNames = members.map((item) => item!.name).join("、");
            const kind = routeLandmarkKind(landmark.kind);
            const scale = layout.pinned
              ? mapDetail === "wide" ? 1.08 : mapDetail === "mid" ? .78 : .56
              : mapDetail === "wide" ? .94 : mapDetail === "mid" ? .68 : .5;
            const displaced = Math.hypot(layout.x - layout.anchorX, layout.y - layout.anchorY) > 1;
            const showName = layout.pinned;
            return (
              <g
                key={layout.id}
                className={`route-landmark landmark-${landmark.kind} ${layout.pinned ? "is-pinned" : ""} ${layout.landmarkIds.length > 1 ? "is-stack" : ""}`}
                transform={`translate(${layout.x} ${layout.y})`}
                role="img"
                aria-label={`${memberNames}，${kind.label}${layout.landmarkIds.length > 1 ? `，共${layout.landmarkIds.length}处相邻路标` : ""}`}
              >
                {displaced && <path className="landmark-anchor-line" d={`M0 0 L${layout.anchorX - layout.x} ${layout.anchorY - layout.y}`} />}
                <g transform={`scale(${scale})`}><RouteLandmarkGlyph kind={landmark.kind} /></g>
                {layout.landmarkIds.length > 1 && <g className="landmark-stack-count" transform={`translate(${6.6 * scale} ${-6.3 * scale})`}><circle r="3.8" /><text y="1.5" textAnchor="middle">{layout.landmarkIds.length}</text></g>}
                {showName && <text className="landmark-name" y={-8.8 * scale} textAnchor="middle">{landmark.name}</text>}
                <title>{memberNames} · {route.name} · {landmark.description} · 可{landmark.service}{layout.landmarkIds.length > 1 ? ` · 合并显示${layout.landmarkIds.length}处，放大后展开` : ""}</title>
              </g>
            );
          })}
        </g>

        <g className={`weather-system weather-detail-${mapDetail}`} aria-label={`第${game.day}日天下区域天候`}>
          {weatherMarkerLayout.map((layout) => {
            const weather = weatherByRegionId.get(layout.id);
            if (!weather) return null;
            const scale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .72 : .5;
            const anchorDx = layout.x - layout.markerX;
            const anchorDy = layout.y - layout.markerY;
            return (
              <g key={weather.region.id} className={`weather-region weather-${weather.kind} weather-severity-${weather.severity}`} transform={`translate(${layout.markerX} ${layout.markerY})`}>
                {(Math.abs(anchorDx) > 1 || Math.abs(anchorDy) > 1) && <path className="weather-anchor-line" d={`M0 0 L${anchorDx} ${anchorDy}`} />}
                <g transform={`scale(${scale})`}>
                  <path className="weather-cartouche" d="M-28 -12 Q0 -19 28 -12 L31 10 Q0 16 -31 10 Z" />
                  <path className="weather-cartouche-inner" d="M-24 -10 Q0 -15 24 -10 L26 8 Q0 12 -26 8 Z" />
                  <path className="weather-cartouche-band" d="M-28 -12 Q0 -19 28 -12 L29 -7 Q0 -12 -29 -7 Z" />
                  <g className="weather-symbol" transform="translate(-13 -1)"><WeatherGlyph kind={weather.kind} /></g>
                  <text className="weather-token-seal" x="11" y="3.2" textAnchor="middle">{weather.seal}</text>
                  <text className="weather-duration" x="11" y="8.4" textAnchor="middle">至{weather.endsDay}日 · {weather.severity ? `${weather.severity}阶` : "平"}</text>
                  <g className="weather-severity-marks" aria-hidden="true" transform="translate(-7.5 11.3)">
                    {[1, 2, 3, 4].map((level) => <circle key={level} cx={(level - 1) * 5} r="1.05" className={level <= weather.severity ? "is-filled" : ""} />)}
                  </g>
                  <text className="weather-region-label" y="23" textAnchor="middle">{weather.region.name} · {weather.label}</text>
                  <text className="weather-impact-label" y="30" textAnchor="middle">{weatherTravelHint[weather.kind]}</text>
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
              const candidateBadge = routeBadgeById.get(`route-candidate:${candidate.id}`);
              const candidateSealScale = mapDetail === "wide" ? 1 : mapDetail === "mid" ? .78 : .58;
              return (
                <g key={candidate.id} className={`route-candidate candidate-tone-${candidateIndex % 3} ${highlighted ? "is-highlighted" : "is-muted"}`}>
                  {candidate.routeIds.map((routeId) => {
                    const route = ROUTES.find((item) => item.id === routeId);
                    if (!route) return null;
                    const { from, to, mx, my } = routeCurve(route);
                    return <path key={routeId} className="route-candidate-segment" d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}><title>{routeCandidateSeal(candidateIndex)}路 · {candidate.label} · {candidate.days}日 · 路险{candidate.dangerLabel} · {candidate.weatherLabel ?? "天候未报"} · {routeCandidateBusinessCaption(candidate)}</title></path>;
                  })}
                  {anchor && (
                    <>
                      {candidateBadge?.displaced && <path className="route-badge-anchor route-candidate-anchor" d={`M ${anchor.mx} ${anchor.my} L ${candidateBadge.markerX} ${candidateBadge.markerY}`} />}
                      <g className="route-candidate-seal" transform={`translate(${candidateBadge?.markerX ?? anchor.mx} ${candidateBadge?.markerY ?? anchor.my})`} aria-hidden="true">
                        <g transform={`scale(${candidateSealScale})`}>
                          <circle r="7.3" />
                          <text y="2.8" textAnchor="middle">{routeCandidateSeal(candidateIndex)}</text>
                        </g>
                      </g>
                    </>
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
            const rival = actor.kind === "rival" ? rivalBureauByActor(game, actor.id) : null;
            const rivalDetail = rival ? `${rivalRank(rival.reputation).label} · 名望${rival.reputation} · 与本号${rivalRelation(rival.relation).label}` : "";
            const members = layout.actorIds.map((id) => actorsById.get(id)).filter((member) => Boolean(member));
            const actorNames = members.map((member) => member!.name).join("、");
            const displaced = Math.hypot(layout.x - layout.anchorX, layout.y - layout.anchorY) > 1;
            const showActorName = mapDetail === "close" && (actor.kind === "army" || actor.kind === "rival");
            return (
              <g
                key={layout.id}
                className={`world-actor actor-${actor.kind} ${layout.actorIds.length > 1 ? "is-stack" : ""}`}
                transform={`translate(${layout.x} ${layout.y})`}
                role="img"
                aria-label={`${actorNames}，正在附近道路行进${rivalDetail ? `，${rivalDetail}` : ""}${layout.actorIds.length > 1 ? `，共${layout.actorIds.length}队` : ""}`}
                style={{ color: faction.color }}
              >
                {displaced && <path className="actor-anchor-line" d={`M0 0 L${layout.anchorX - layout.x} ${layout.anchorY - layout.y}`} />}
                <g transform={`scale(${actorScale})`}><WorldActorGlyph kind={actor.kind} /></g>
                {layout.actorIds.length > 1 && <g className="actor-stack-count" transform={`translate(${7.4 * actorScale} ${-6.8 * actorScale})`}><circle r="4.3" /><text y="1.8" textAnchor="middle">{layout.actorIds.length}</text></g>}
                {showActorName && <text className="actor-name" y="-6.5" textAnchor="middle">{actor.name}</text>}
                <title>{actorNames} · {route.name} · {effect}{rivalDetail ? ` · ${rivalDetail}` : ""}{layout.actorIds.length > 1 ? ` · 合并显示${layout.actorIds.length}队，放大后展开` : ""}</title>
              </g>
            );
          })}
        </g>

        <g className="city-hit-layer" aria-hidden="true">
          {cityRenderOrder.map((city) => {
            const positioned = positionedCityById.get(city.id);
            if (!game.cities[city.id] || !positioned) return null;
            return (
              <g
                key={city.id}
                className={`city-node-hit-target ${selectedCityId === city.id ? "is-selected" : ""} ${game.currentCityId === city.id ? "is-current" : ""}`}
                data-city-id={city.id}
                transform={`translate(${positioned.x} ${positioned.y})`}
                onClick={handleCityHit}
              >
                <circle className="city-node-hit" r={markerHitRadius(city)} />
              </g>
            );
          })}
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
            const markerLayout = settlementMarkerById.get(`city:${city.id}`);
            const markerX = markerLayout?.markerX ?? city.x;
            const markerY = markerLayout?.markerY ?? city.y;
            const anchorDx = city.x - markerX;
            const anchorDy = city.y - markerY;
            const localWeather = (current || selected) && mapLayer === "weather" ? weatherForCity(game.seed, game.day, city) : null;
            return (
              <g
                key={city.id}
                className={`city-node ${detailedMarker ? "marker-detailed" : "marker-dot"} tier-${city.tier} status-${state.status} ${frontline.visible ? `is-frontline frontline-${frontline.risk}` : ""} ${office ? "has-office" : ""} ${selected ? "is-selected" : ""} ${current ? "is-current" : ""} ${active ? "is-on-route" : ""} ${candidateRole ? `is-candidate-waypoint waypoint-${candidateRole} candidate-tone-${Math.max(0, previewCandidateIndex) % 3}` : ""}`}
                data-city-id={city.id}
                transform={`translate(${markerX} ${markerY})`}
                onClick={(event) => { event.stopPropagation(); onSelectCity(city.id); }}
              >
                {markerLayout?.displaced && <g className="settlement-anchor" aria-hidden="true">
                  <path d={`M0 0 L${anchorDx} ${anchorDy}`} />
                  <circle cx={anchorDx} cy={anchorDy} r="1.45" />
                </g>}
                {localWeather && <circle className={`city-weather-ring weather-${localWeather.kind} severity-${localWeather.severity}`} r={hitRadius + 8} aria-hidden="true" />}
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
                  aria-pressed={selected}
                  aria-label={`${city.name}，${faction.name}，${condition.label}${frontline.visible ? `，战线${frontline.label}` : ""}${stale ? "，情报可能过期" : ""}`}
                  onClick={handleCityHit}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectCity(city.id);
                  }}
                />
                <title>{city.name} · 东经 {city.lon.toFixed(2)}° · 北纬 {city.lat.toFixed(2)}°{frontline.visible ? ` · ${frontline.label} · 守势 ${frontline.defense} / 兵压 ${frontline.pressure}` : ""}</title>
              </g>
            );
          })}
        </g>

        <g className={`city-cluster-layer city-cluster-detail-${mapDetail}`} aria-label="密集城驿合标">
          {cityStackClusters.map((cluster) => {
            const members = cluster.cityIds.map((id) => CITIES.find((city) => city.id === id)).filter((city) => Boolean(city));
            const primary = members.find((city) => city?.id === cluster.primaryCityId)!;
            const faction = FACTIONS[game.cities[primary.id].owner];
            const ownerCounts = members.reduce((counts, city) => {
              const owner = game.cities[city!.id].owner;
              counts.set(owner, (counts.get(owner) ?? 0) + 1);
              return counts;
            }, new Map<FactionId, number>());
            const clusterOwners = [...ownerCounts.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .map(([owner]) => owner)
              .slice(0, 4);
            const ownerNames = clusterOwners.map((owner) => FACTIONS[owner].short).join("、");
            const names = members.map((city) => city!.name).join("、");
            const markerLayout = settlementMarkerById.get(`cluster:${cluster.id}`);
            const markerX = markerLayout?.markerX ?? cluster.x;
            const markerY = markerLayout?.markerY ?? cluster.y;
            const anchorDx = cluster.x - markerX;
            const anchorDy = cluster.y - markerY;
            const callout = cityClusterCalloutPlacement({ x: markerX, y: markerY, radius: cluster.radius }, viewport, mapDetail);
            return (
              <g
                key={cluster.id}
                className="city-cluster-wrap"
                transform={`translate(${markerX} ${markerY})`}
                style={{ color: faction.color }}
              >
                <g
                  className={`city-cluster ${clusterOwners.length > 1 ? "is-mixed-control" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${names}，共${cluster.cityIds.length}处城驿，${ownerNames}实控，点击展开各城`}
                  onClick={(event) => { event.stopPropagation(); expandCityCluster(cluster.cityIds); }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    expandCityCluster(cluster.cityIds);
                  }}
                >
                  <circle className="city-cluster-hit" r={cityClusterHitRadius(cluster.radius, mapDetail)} />
                  {markerLayout?.displaced && <g className="settlement-anchor" aria-hidden="true">
                    <path d={`M0 0 L${anchorDx} ${anchorDy}`} />
                    <circle cx={anchorDx} cy={anchorDy} r="1.45" />
                  </g>}
                  <circle className="city-cluster-halo" r={cluster.radius + 3.2} />
                  <path className="city-cluster-paper" d={`M0 ${-cluster.radius} L${cluster.radius} 0 L0 ${cluster.radius} L${-cluster.radius} 0 Z`} />
                  <circle className="city-cluster-core" r={cluster.radius * .56} />
                  <text y={cluster.radius * .23} textAnchor="middle">{cluster.cityIds.length}</text>
                  <g className="city-cluster-factions" transform={`translate(${-(clusterOwners.length - 1) * 2.1} ${cluster.radius + 3.5})`} aria-hidden="true">
                    {clusterOwners.map((owner, index) => <circle key={owner} cx={index * 4.2} r="1.65" fill={FACTIONS[owner].color} />)}
                  </g>
                  <title>{names} · {ownerNames}实控 · 合并显示 {cluster.cityIds.length} 处 · 点击放大展开</title>
                </g>
                <g className="city-cluster-callout" transform={`translate(${callout.x} ${callout.y}) scale(${callout.scale})`} aria-hidden="true">
                  <rect x="0" y="-14" width={callout.width} height="28" rx="1.5" />
                  <path d="M6 -9 H22" />
                  <text className="city-cluster-callout-name" x="7" y="1">{primary.name}等{cluster.cityIds.length}城</text>
                  <text className="city-cluster-callout-note" x="7" y="9">{ownerNames}实控 · 点按展开</text>
                </g>
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
        <span><i className="legend-landmark">关</i>关渡驿寨</span>
        <span><i className="legend-condition">异</i>路况</span>
        <span><i className="legend-traveler merchant" />商旅</span>
        <span><i className="legend-traveler patrol" />巡骑</span>
        <span><i className="legend-traveler army" />行营</span>
        <span><i className="legend-traveler rival" />同行镖队</span>
        <span><i className="legend-current-city">镖</i>镖队所在</span>
        {deputyRoutes.size > 0 && <span><i className="legend-deputy-route">副</i>副队短镖</span>}
        <span><i className="legend-border-route">界</i>异旗边路</span>
        {captivityMarkers.length > 0 && <span><i className="legend-captivity">俘</i>队员失陷</span>}
        <span><i className="legend-weather">雨</i>区域天候</span>
        <span><i className="legend-stack">2</i>同路合标</span>
        <span><i className="legend-station-dot" />驿城标点</span>
        <span><i className="legend-capital" />都城</span>
      </div>
      <div className="map-era">约公元 1208 年 · 嘉定初</div>
    </div>
  );
}
