import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map } from 'maplibre-gl';
import type { Field } from '@droneverse/shared';
import { MAP_BASEMAPS, type BasemapKey } from '../../lib/config';
import { addFieldLayers, createMap, fitToFields, setBasemap, setFields } from '../../map/layers';

interface Props {
  fields: Field[];
  selectedId: string | null;
  onMapReady: (map: Map) => void;
  onSelect: (id: string | null) => void;
  /** While drawing, clicks add corners instead of selecting fields. */
  drawing: boolean;
}

export function FieldMap({ fields, selectedId, onMapReady, onSelect, drawing }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const [ready, setReady] = useState(false);
  const [basemap, setBasemapKey] = useState<BasemapKey>('satellite');
  const fitted = useRef(false);

  // The map is created once.
  useEffect(() => {
    if (!container.current) return;
    const map = createMap(container.current);
    mapRef.current = map;
    map.on('load', () => {
      addFieldLayers(map);
      setReady(true);
      onMapReadyRef.current(map);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setFields(map, fields, selectedId);
    if (!fitted.current && fields.length > 0) {
      fitToFields(map, fields);
      fitted.current = true;
    }
  }, [fields, selectedId, ready]);

  useEffect(() => {
    if (mapRef.current && ready) setBasemap(mapRef.current, basemap);
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || drawing) return;
    const onClick = (e: { point: { x: number; y: number } }) => {
      const hit = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['fields-fill'] })[0];
      onSelect((hit?.properties?.id as string | undefined) ?? null);
    };
    map.on('click', onClick);
    return () => void map.off('click', onClick);
  }, [ready, drawing, onSelect]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <div className="absolute bottom-6 left-3 flex overflow-hidden rounded-full bg-white text-sm shadow">
        {(Object.keys(MAP_BASEMAPS) as BasemapKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setBasemapKey(k)}
            className={`px-3 py-1.5 ${basemap === k ? 'bg-emerald-600 text-white' : 'text-gray-700'}`}
          >
            {MAP_BASEMAPS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
