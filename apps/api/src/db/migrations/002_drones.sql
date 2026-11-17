-- Phase 2: drone registry, seeded with the three drones from the concept video.
-- The numbers are PLACEHOLDERS (specs_are_placeholder = true) until real drones are chosen.

create table drones (
  id                   text primary key,
  name                 text not null,
  tagline              text not null,
  type                 text not null check (type in ('survey', 'spray')),
  rotors               int  not null check (rotors in (4, 6, 8)),
  max_flight_min       double precision not null check (max_flight_min > 0),
  top_speed_kmh        double precision not null check (top_speed_kmh > 0),
  camera_mp            double precision not null check (camera_mp > 0),
  sensor               text not null check (sensor in ('rgb', 'multispectral')),
  payload_l            double precision,
  driver               text not null check (driver in ('sim', 'mavlink')),
  specs_are_placeholder boolean not null default true,
  sort_order           int not null default 0
);

insert into drones
  (id, name, tagline, type, rotors, max_flight_min, top_speed_kmh, camera_mp, sensor, driver, sort_order)
values
  ('sparrow-s4', 'Sparrow S4', 'Small plots',     'survey', 4, 28, 54, 20, 'rgb',           'sim', 1),
  ('kestrel-h6', 'Kestrel H6', 'Mid-size farms',  'survey', 6, 38, 62, 24, 'rgb',           'sim', 2),
  ('condor-x8',  'Condor X8',  'Big farms',       'survey', 8, 50, 72, 45, 'multispectral', 'sim', 3);

-- Same lock-down as the other tables: no policies, so Supabase's public API can't read it.
alter table drones enable row level security;
