-- ==========================================
-- SCRIPT: TABLAS DE PRIVACIDAD DEL CHAT
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Tabla de Bloqueos (chat_blocks)
CREATE TABLE IF NOT EXISTS public.chat_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Habilitar RLS
ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuarios pueden ver sus propios bloqueos" 
ON public.chat_blocks FOR SELECT 
USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Usuarios pueden gestionar sus bloqueos" 
ON public.chat_blocks FOR ALL 
USING (auth.uid() = blocker_id);

-- 2. Tabla de Silenciados (chat_mutes)
CREATE TABLE IF NOT EXISTS public.chat_mutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    muted_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(muter_id, muted_id)
);

-- Habilitar RLS
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuarios pueden ver a quién silenciaron" 
ON public.chat_mutes FOR SELECT 
USING (auth.uid() = muter_id);

CREATE POLICY "Usuarios pueden gestionar sus silencios" 
ON public.chat_mutes FOR ALL 
USING (auth.uid() = muter_id);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocker ON public.chat_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocked ON public.chat_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_chat_mutes_muter ON public.chat_mutes(muter_id);
