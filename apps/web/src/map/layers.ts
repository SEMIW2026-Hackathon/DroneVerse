import * as maplibregl from 'maplibre-gl';
// MapLibre 6 runs GeoJSON sources in a web worker file that sits next to the library.
// Bundlers move the library but not that file, so without this the worker 404s and
// every overlay (fields, drawing, flight path) silently fails to render.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { GeoJSONSource, Map, StyleSpecification } from 'maplibre-gl';
import type { Field } from '@droneverse/shared';
import { MAP_BASEMAPS, MAP_COLORS, MAP_DEFAULT, type BasemapKey } from '../lib/config';

maplibregl.setWorkerUrl(workerUrl);

export type LngLat = [number, number];

const empty = { type: 'FeatureCollection' as const, features: [] };

function buildStyle(): StyleSpecification {
  const keys = Object.keys(MAP_BASEMAPS) as BasemapKey[];
  return {
    version: 8,
    sources: Object.fromEntries(
      keys.map((k) => [
        k,
        {
          type: 'raster' as const,
          tiles: [...MAP_BASEMAPS[k].tiles],
          tileSize: 256,
          maxzoom: MAP_BASEMAPS[k].maxzoom,
          attribution: MAP_BASEMAPS[k].attribution,
        },
      ]),
    ),
    layers: keys.map((k) => ({
      id: `basemap-${k}`,
      type: 'raster' as const,
      source: k,
      layout: { visibility: k === 'satellite' ? ('visible' as const) : ('none' as const) },
    })),
  };
}

export function createMap(container: HTMLElement): Map {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(),
    center: MAP_DEFAULT.center,
    zoom: MAP_DEFAULT.zoom,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(
    new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
    'top-right',
  );
  return map;
}

export function setBasemap(map: Map, active: BasemapKey) {
  for (const k of Object.keys(MAP_BASEMAPS)) {
    map.setLayoutProperty(`basemap-${k}`, 'visibility', k === active ? 'visible' : 'none');
  }
}

/** Fields and the in-progress drawing, as GeoJSON sources with their layers. */
export function addFieldLayers(map: Map) {
  map.addSource('fields', { type: 'geojson', data: empty });
  map.addSource('draft', { type: 'geojson', data: empty });
  const colour = ['case', ['get', 'selected'], MAP_COLORS.fieldSelected, MAP_COLORS.field];

  map.addLayer({
    id: 'fields-fill',
    type: 'fill',
    source: 'fields',
    paint: { 'fill-color': colour as never, 'fill-opacity': 0.3 },
  });
  map.addLayer({
    id: 'fields-line',
    type: 'line',
    source: 'fields',
    paint: { 'line-color': colour as never, 'line-width': 2 },
  });
  map.addLayer({
    id: 'draft-fill',
    type: 'fill',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': MAP_COLORS.draft, 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'draft-line',
    type: 'line',
    source: 'draft',
    filter: ['!=', ['geometry-type'], 'Point'],
    paint: { 'line-color': MAP_COLORS.draft, 'line-width': 2, 'line-dasharray': [2, 1] },
  });
  map.addLayer({
    id: 'draft-points',
    type: 'circle',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': '#fff',
      'circle-stroke-color': MAP_COLORS.draft,
      'circle-stroke-width': 2,
    },
  });
}

export function setFields(map: Map, fields: Field[], selectedIds: string[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: fields.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      properties: { id: f.id, selected: selectedIds.includes(f.id) },
      geometry: f.boundary,
    })),
  };
  (map.getSource('fields') as GeoJSONSource | undefined)?.setData(data as never);
}

export function setDraft(map: Map, points: LngLat[]) {
  const features: unknown[] = points.map((p) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: p },
  }));
  if (points.length >= 3) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
    });
  } else if (points.length === 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points },
    });
  }
  (map.getSource('draft') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features,
  } as never);
}

export function fitToFields(map: Map, fields: Field[]) {
  const bounds = new maplibregl.LngLatBounds();
  for (const f of fields) {
    for (const [lon, lat] of f.boundary.coordinates[0] ?? []) {
      bounds.extend([lon as number, lat as number]);
    }
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 0 });
}

/** Planned flight path, its waypoints and the launch point. */
export function addPlanLayers(map: Map) {
  map.addSource('plan', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'plan-line',
    type: 'line',
    source: 'plan',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': MAP_COLORS.plan, 'line-width': 2.5 },
  });
  map.addLayer({
    id: 'plan-waypoints',
    type: 'circle',
    source: 'plan',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['get', 'home']]],
    paint: {
      'circle-radius': 3,
      'circle-color': '#fff',
      'circle-stroke-color': MAP_COLORS.plan,
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'plan-home',
    type: 'circle',
    source: 'plan',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['get', 'home']],
    paint: {
      'circle-radius': 8,
      'circle-color': MAP_COLORS.home,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
}

export function setPlan(map: Map, path: LngLat[], home: LngLat | null) {
  const features: unknown[] = [];
  if (path.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: path },
    });
  }
  for (const p of path) {
    features.push({
      type: 'Feature',
      properties: { home: false },
      geometry: { type: 'Point', coordinates: p },
    });
  }
  if (home) {
    features.push({
      type: 'Feature',
      properties: { home: true },
      geometry: { type: 'Point', coordinates: home },
    });
  }
  (map.getSource('plan') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features,
  } as never);
}
