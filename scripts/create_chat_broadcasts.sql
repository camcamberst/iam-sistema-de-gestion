-- Tablas para difusión de mensajes (broadcast)

create table if not exists chat_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references users(id) on delete cascade,
  scope_type text not null check (scope_type in ('roles','groups','users')),
  scope_values jsonb not null,
  title text null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_broadcast_targets (
  broadcast_id uuid not null references chat_broadcasts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  delivered_at timestamptz null,
  read_at timestamptz null,
  primary key (broadcast_id, user_id)
);

-- Columnas adicionales en chat_messages para etiquetar difusión
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name='chat_messages' and column_name='is_broadcast'
  ) then
    alter table chat_messages add column is_broadcast boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns 
    where table_name='chat_messages' and column_name='broadcast_id'
  ) then
    alter table chat_messages add column broadcast_id uuid null references chat_broadcasts(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.columns 
    where table_name='chat_messages' and column_name='no_reply'
  ) then
    alter table chat_messages add column no_reply boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns 
    where table_name='chat_messages' and column_name='metadata'
  ) then
    alter table chat_messages add column metadata jsonb null;
  end if;
end $$;


