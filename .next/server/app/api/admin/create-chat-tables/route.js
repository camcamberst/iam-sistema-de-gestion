"use strict";(()=>{var a={};a.id=2029,a.ids=[2029],a.modules={30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:a=>{a.exports=require("http")},95687:a=>{a.exports=require("https")},85477:a=>{a.exports=require("punycode")},12781:a=>{a.exports=require("stream")},57310:a=>{a.exports=require("url")},59796:a=>{a.exports=require("zlib")},25735:(a,e,t)=>{t.r(e),t.d(e,{headerHooks:()=>N,originalPathname:()=>O,patchFetch:()=>I,requestAsyncStorage:()=>p,routeModule:()=>T,serverHooks:()=>o,staticGenerationAsyncStorage:()=>d,staticGenerationBailout:()=>R});var s={};t.r(s),t.d(s,{POST:()=>n});var E=t(95419),i=t(69108),r=t(99678),u=t(78070),c=t(72964);let _=process.env.SUPABASE_SERVICE_ROLE_KEY;async function n(a){try{let a=(0,c.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",_),e=`
      -- Crear tabla de conversaciones de chat
      CREATE TABLE IF NOT EXISTS public.chat_conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(participant_1_id, participant_2_id)
      );

      -- Crear tabla de mensajes de chat
      CREATE TABLE IF NOT EXISTS public.chat_messages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
          sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_read BOOLEAN DEFAULT FALSE,
          read_at TIMESTAMP WITH TIME ZONE
      );

      -- Crear tabla de consultas de soporte
      CREATE TABLE IF NOT EXISTS public.chat_support_queries (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          query_type VARCHAR(50) NOT NULL DEFAULT 'general',
          subject VARCHAR(255),
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          response TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crear tabla de estado de usuarios
      CREATE TABLE IF NOT EXISTS public.chat_user_status (
          user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status_message TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crear \xedndices
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_1 ON public.chat_conversations(participant_1_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_2 ON public.chat_conversations(participant_2_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_support_queries_user ON public.chat_support_queries(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_support_queries_status ON public.chat_support_queries(status);
      CREATE INDEX IF NOT EXISTS idx_chat_user_status_online ON public.chat_user_status(is_online);

      -- Funci\xf3n para actualizar updated_at
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Triggers para updated_at
      CREATE TRIGGER update_chat_conversations_updated_at 
          BEFORE UPDATE ON public.chat_conversations 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      CREATE TRIGGER update_chat_support_queries_updated_at 
          BEFORE UPDATE ON public.chat_support_queries 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      CREATE TRIGGER update_chat_user_status_updated_at 
          BEFORE UPDATE ON public.chat_user_status 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      -- Funci\xf3n para actualizar last_message_at
      CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE public.chat_conversations 
          SET last_message_at = NEW.created_at 
          WHERE id = NEW.conversation_id;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Trigger para actualizar last_message_at
      CREATE TRIGGER update_conversation_last_message_trigger
          AFTER INSERT ON public.chat_messages
          FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

      -- Habilitar RLS
      ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_support_queries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_user_status ENABLE ROW LEVEL SECURITY;

      -- Pol\xedticas RLS para chat_conversations
      CREATE POLICY "Users can view their own conversations" ON public.chat_conversations
          FOR SELECT USING (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      CREATE POLICY "Users can create conversations" ON public.chat_conversations
          FOR INSERT WITH CHECK (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      CREATE POLICY "Users can update their own conversations" ON public.chat_conversations
          FOR UPDATE USING (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      -- Pol\xedticas RLS para chat_messages
      CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages
          FOR SELECT USING (
              EXISTS (
                  SELECT 1 FROM public.chat_conversations 
                  WHERE id = conversation_id 
                  AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
              )
          );

      CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages
          FOR INSERT WITH CHECK (
              sender_id = auth.uid() AND
              EXISTS (
                  SELECT 1 FROM public.chat_conversations 
                  WHERE id = conversation_id 
                  AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
              )
          );

      CREATE POLICY "Users can update their own messages" ON public.chat_messages
          FOR UPDATE USING (sender_id = auth.uid());

      -- Pol\xedticas RLS para chat_support_queries
      CREATE POLICY "Users can view their own support queries" ON public.chat_support_queries
          FOR SELECT USING (user_id = auth.uid());

      CREATE POLICY "Users can create support queries" ON public.chat_support_queries
          FOR INSERT WITH CHECK (user_id = auth.uid());

      CREATE POLICY "Users can update their own support queries" ON public.chat_support_queries
          FOR UPDATE USING (user_id = auth.uid());

      -- Pol\xedticas RLS para chat_user_status
      CREATE POLICY "Users can view all user statuses" ON public.chat_user_status
          FOR SELECT USING (true);

      CREATE POLICY "Users can update their own status" ON public.chat_user_status
          FOR ALL USING (user_id = auth.uid());
    `,{data:t,error:s}=await a.rpc("exec_sql",{sql:e});if(s)return console.error("Error creando tablas:",s),u.Z.json({success:!1,error:s.message},{status:500});return u.Z.json({success:!0,message:"Tablas de chat creadas exitosamente"})}catch(a){return console.error("Error en create-chat-tables:",a),u.Z.json({success:!1,error:"Error interno del servidor"},{status:500})}}let T=new E.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/admin/create-chat-tables/route",pathname:"/api/admin/create-chat-tables",filename:"route",bundlePath:"app/api/admin/create-chat-tables/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\admin\\create-chat-tables\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:d,serverHooks:o,headerHooks:N,staticGenerationBailout:R}=T,O="/api/admin/create-chat-tables/route";function I(){return(0,r.patchFetch)({serverHooks:o,staticGenerationAsyncStorage:d})}}};var e=require("../../../../webpack-runtime.js");e.C(a);var t=a=>e(e.s=a),s=e.X(0,[1638,6206,2964],()=>t(25735));module.exports=s})();