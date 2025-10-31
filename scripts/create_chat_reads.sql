-- Crea tabla de lecturas de mensajes (double check)
-- Un registro por (message_id, user_id) cuando el usuario ha visto el mensaje

create table if not exists public.chat_message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  unique (message_id, user_id)
);

-- Índices para acelerar consultas
create index if not exists idx_chat_message_reads_user_message on public.chat_message_reads(user_id, message_id);
create index if not exists idx_chat_message_reads_message on public.chat_message_reads(message_id);

-- RLS opcional (asumiendo RLS habilitado)
-- enable row level security on public.chat_message_reads;
-- create policy chat_message_reads_user_can_see on public.chat_message_reads
--   for select using (auth.uid() = user_id);
-- create policy chat_message_reads_user_can_insert on public.chat_message_reads
--   for insert with check (auth.uid() = user_id);

