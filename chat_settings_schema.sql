-- Tabla para guardar preferencias de chat por usuario (cross-device)
CREATE TABLE IF NOT EXISTS public.chat_user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'default',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.chat_user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own chat settings"
    ON public.chat_user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat settings"
    ON public.chat_user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat settings"
    ON public.chat_user_settings FOR UPDATE
    USING (auth.uid() = user_id);
