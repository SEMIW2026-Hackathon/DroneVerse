import { useCallback, useEffect, useState } from 'react';
import type { Map } from 'maplibre-gl';
import { polygonAreaHa, type FieldInput } from '@droneverse/shared';
import { setDraft, type LngLat } from '../../map/layers';

/** Click-to-add-corners polygon drawing on a MapLibre map. */
export function useDrawing(map: Map | null, active: boolean) {
  const [points, setPoints] = useState<LngLat[]>([]);

  useEffect(() => {
    if (!map || !active) return;
    const onClick = (e: { lngLat: { lng: number; lat: number } }) =>
      setPoints((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]);
    map.on('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
    };
  }, [map, active]);

  useEffect(() => {
    if (map) setDraft(map, active ? points : []);
  }, [map, active, points]);

  useEffect(() => {
    if (!active) setPoints([]);
  }, [active]);

  const undo = useCallback(() => setPoints((p) => p.slice(0, -1)), []);

  const polygon: FieldInput['boundary'] | null =
    points.length >= 3 ? { type: 'Polygon', coordinates: [[...points, points[0]!]] } : null;
  const areaHa = polygon ? polygonAreaHa(polygon) : 0;

  return { points, polygon, areaHa, undo };
}
