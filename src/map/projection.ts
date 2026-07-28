import { geoMercator } from "d3-geo";

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 720;

export const chinaProjection = geoMercator()
  .center([104, 34])
  .scale(840)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

export function projectLonLat(lon: number, lat: number): [number, number] {
  const point = chinaProjection([lon, lat]);
  if (!point) return [0, 0];
  return [Number(point[0].toFixed(2)), Number(point[1].toFixed(2))];
}
