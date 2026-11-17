// Tunable values live here, not inline in components.

export const API_BASE = '/api';

export const MAP_DEFAULT = { center: [36.82, -1.29] as [number, number], zoom: 5 };

export const MAP_COLORS = {
  field: '#16a34a',
  fieldSelected: '#f59e0b',
  draft: '#2563eb',
  plan: '#c026d3',
  home: '#dc2626',
};

export const MAP_BASEMAPS = {
  streets: {
    label: 'Map',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  satellite: {
    label: 'Satellite',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
  },
} as const;
export type BasemapKey = keyof typeof MAP_BASEMAPS;

export const CROPS = [
  'Maize',
  'Wheat',
  'Rice',
  'Sorghum',
  'Beans',
  'Potatoes',
  'Tomatoes',
  'Coffee',
  'Tea',
  'Sugarcane',
  'Cotton',
  'Vegetables',
];
