-- Phase 1: users, sessions, farms, fields (PostGIS).
-- Requires the postgis extension to be enabled already.

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  role          text not null default 'owner'
                  check (role in ('owner', 'manager', 'operator', 'viewer')),
  created_at    timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on sessions (user_id);

create table farms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index farms_owner_id_idx on farms (owner_id);

create table fields (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references farms(id) on delete cascade,
  name       text not null,
  crop       text not null,
  boundary   geometry(Polygon, 4326) not null check (ST_IsValid(boundary)),
  area_ha    double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fields_farm_id_idx on fields (farm_id);
create index fields_boundary_gix on fields using gist (boundary);

-- Supabase exposes the public schema through its REST API. Turn on row level
-- security with no policies so that API is locked out; the Droneverse API
-- connects directly as the database owner, which bypasses RLS.
alter table users    enable row level security;
alter table sessions enable row level security;
alter table farms    enable row level security;
alter table fields   enable row level security;
