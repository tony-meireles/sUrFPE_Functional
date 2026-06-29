create table if not exists exercise_import_batches (
  id bigserial primary key,
  source_filename text not null,
  source_mime_type text,
  source_hash text,
  imported_by text,
  imported_at timestamptz not null default now(),
  workbook_sheet_count integer,
  status text not null default 'completed',
  notes text
);

create table if not exists exercises (
  id bigserial primary key,
  legacy_id integer,
  external_id text,
  movement text not null,
  movement_normalized text not null,
  description text,
  primary_implement text,
  selection_order integer,
  image_path text,
  image_attribution text,
  random_weight numeric(10,4),
  score_upper_body smallint not null default 0,
  score_lower_body smallint not null default 0,
  score_trunk smallint not null default 0,
  score_core smallint not null default 0,
  score_balance smallint not null default 0,
  foundation_popup smallint not null default 0,
  foundation_rowing smallint not null default 0,
  foundation_navigation smallint not null default 0,
  foundation_rail_maneuvers smallint not null default 0,
  source_workbook text,
  source_sheet text,
  source_row integer,
  last_import_batch_id bigint references exercise_import_batches(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_legacy_id_unique unique (legacy_id),
  constraint exercises_external_id_unique unique (external_id),
  constraint exercises_scores_check check (
    score_upper_body between 0 and 5 and
    score_lower_body between 0 and 5 and
    score_trunk between 0 and 5 and
    score_core between 0 and 5 and
    score_balance between 0 and 5
  ),
  constraint exercises_foundations_check check (
    foundation_popup between 0 and 5 and
    foundation_rowing between 0 and 5 and
    foundation_navigation between 0 and 5 and
    foundation_rail_maneuvers between 0 and 5
  )
);

create index if not exists exercises_movement_normalized_idx
  on exercises (movement_normalized);

create table if not exists exercise_implements (
  id bigserial primary key,
  exercise_id bigint not null references exercises(id) on delete cascade,
  implement_code text not null,
  availability smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_implements_unique unique (exercise_id, implement_code),
  constraint exercise_implements_availability_check check (availability between 0 and 5)
);

create table if not exists exercise_valences (
  id bigserial primary key,
  exercise_id bigint not null references exercises(id) on delete cascade,
  valence_code text not null,
  created_at timestamptz not null default now(),
  constraint exercise_valences_unique unique (exercise_id, valence_code)
);

create table if not exists exercise_import_rows (
  id bigserial primary key,
  batch_id bigint not null references exercise_import_batches(id) on delete cascade,
  sheet_name text,
  row_number integer,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  match_strategy text,
  action text,
  status text not null default 'pending',
  error_message text,
  exercise_id bigint references exercises(id),
  created_at timestamptz not null default now()
);

create index if not exists exercise_import_rows_batch_idx
  on exercise_import_rows (batch_id);

create index if not exists exercise_import_rows_status_idx
  on exercise_import_rows (status);

comment on table exercise_import_batches is 'Controle de cada arquivo importado.';
comment on table exercise_import_rows is 'Rastreabilidade por linha da planilha importada.';
comment on table exercises is 'Registro canônico dos exercícios.';
comment on table exercise_implements is 'Disponibilidade do exercício por implemento.';
comment on table exercise_valences is 'Valências esportivas explícitas por exercício.';
