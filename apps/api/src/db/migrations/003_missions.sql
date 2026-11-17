create table missions (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references users(id) on delete cascade,
  drone_id              text not null,
  drone                 jsonb not null,
  waypoints             jsonb not null,
  speed_kmh             double precision not null,
  altitude_m            double precision not null,
  home                  jsonb not null,
  wind_kmh              double precision not null,
  required_battery_pct  double precision not null,
  created_at            timestamptz not null default now()
);
create index missions_owner_id_idx on missions (owner_id);

alter table missions enable row level security;
