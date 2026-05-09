begin;

drop function if exists ensure_space_tables(text);
drop table if exists metadata cascade;
drop table if exists change_log cascade;

create table metadata (
  tag text primary key,
  rank varchar(10),
  valueType smallint,
  valueText text,
  valueJson jsonb,
  valueBytes bytea,
  valueInt bigint,
  valueBoolean boolean,
  updatedAt timestamptz default now(),
  updatedAtTz varchar(6)
);

create table change_log (
  changeLogId bigserial primary key,
  createdAt timestamptz default now(),
  createdAtTz varchar(6),
  commentText text,
  commentJson jsonb
);

create or replace function ensure_space_tables(space_id text)
returns void
language plpgsql
as $$
declare
  table_prefix text;
begin
  if coalesce(space_id, '') !~ '^[0-9a-z]+$' then
    raise exception 'invalid space_id: %, expected lowercase 0-9a-z', space_id;
  end if;

  table_prefix := format('space_%s', space_id);

  execute format(
    'create table if not exists %I (
      tag text primary key,
      rank varchar(10),
      valueType smallint,
      valueText text,
      valueJson jsonb,
      valueBytes bytea,
      valueInt bigint,
      valueBoolean boolean,
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_metadata'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionId bigint not null,
      valueText text not null,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_text'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint not null,
      versionId bigint not null,
      versionIdPrev bigint,
      valueText text,
      isDataDeleted boolean default false,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      primary key (objectId, versionId)
    )',
    table_prefix || '_object_text_history'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionIdHead bigint not null,
      type integer not null default -1,
      isDeleted boolean default false,
      editType smallint not null default 0,
      changeLogId bigint references change_log(changeLogId),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_text_status'
  );
  execute format(
    'alter table %I add column if not exists type integer not null default -1',
    table_prefix || '_object_text_status'
  );
  execute format(
    'alter table %I add column if not exists editType smallint not null default 0',
    table_prefix || '_object_text_status'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionId bigint not null,
      valueBytes bytea not null,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_bytes'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint not null,
      versionId bigint not null,
      versionIdPrev bigint,
      valueBytes bytea,
      isDataDeleted boolean default false,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      primary key (objectId, versionId)
    )',
    table_prefix || '_object_bytes_history'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionIdHead bigint not null,
      type integer not null default -1,
      isDeleted boolean default false,
      editType smallint not null default 0,
      changeLogId bigint references change_log(changeLogId),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_bytes_status'
  );
  execute format(
    'alter table %I add column if not exists type integer not null default -1',
    table_prefix || '_object_bytes_status'
  );
  execute format(
    'alter table %I add column if not exists editType smallint not null default 0',
    table_prefix || '_object_bytes_status'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionId bigint not null,
      valueJson jsonb not null,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_json'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint not null,
      versionId bigint not null,
      versionIdPrev bigint,
      valueJson jsonb,
      isDataDeleted boolean default false,
      changeLogId bigint references change_log(changeLogId),
      createdAt timestamptz default now(),
      createdAtTz varchar(6),
      primary key (objectId, versionId)
    )',
    table_prefix || '_object_json_history'
  );

  execute format(
    'create table if not exists %I (
      objectId bigint primary key,
      versionIdHead bigint not null,
      type integer not null default -1,
      isDeleted boolean default false,
      editType smallint not null default 0,
      changeLogId bigint references change_log(changeLogId),
      updatedAt timestamptz default now(),
      updatedAtTz varchar(6)
    )',
    table_prefix || '_object_json_status'
  );
  execute format(
    'alter table %I add column if not exists type integer not null default -1',
    table_prefix || '_object_json_status'
  );
  execute format(
    'alter table %I add column if not exists editType smallint not null default 0',
    table_prefix || '_object_json_status'
  );
end;
$$;

commit;
