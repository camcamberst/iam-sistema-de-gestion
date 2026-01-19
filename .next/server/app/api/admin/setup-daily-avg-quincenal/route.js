"use strict";(()=>{var a={};a.id=3469,a.ids=[3469],a.modules={30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:a=>{a.exports=require("http")},95687:a=>{a.exports=require("https")},85477:a=>{a.exports=require("punycode")},12781:a=>{a.exports=require("stream")},57310:a=>{a.exports=require("url")},59796:a=>{a.exports=require("zlib")},22551:(a,e,t)=>{t.r(e),t.d(e,{headerHooks:()=>T,originalPathname:()=>N,patchFetch:()=>R,requestAsyncStorage:()=>E,routeModule:()=>u,serverHooks:()=>p,staticGenerationAsyncStorage:()=>d,staticGenerationBailout:()=>m});var r={};t.r(r),t.d(r,{GET:()=>c,POST:()=>l});var s=t(95419),o=t(69108),n=t(99678),_=t(78070);let i=(0,t(72964).createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function l(a){try{console.log("\uD83D\uDD04 [SETUP-DAILY-AVG-QUINCENAL] Iniciando configuraci\xf3n...");let a=[];console.log("\uD83D\uDCDD Paso 1: Creando tabla platform_quincenal_stats...");let{error:e}=await i.rpc("exec_sql",{sql_query:`
        CREATE TABLE IF NOT EXISTS platform_quincenal_stats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          platform_id VARCHAR(50) NOT NULL,
          quincena VARCHAR(7) NOT NULL,
          daily_avg_usd DECIMAL(8,2) NOT NULL DEFAULT 0.00,
          total_days INTEGER NOT NULL DEFAULT 0,
          total_usd_modelo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(model_id, platform_id, quincena)
        );
      `});e?(console.error("❌ Error en paso 1:",e),a.push({step:1,success:!1,error:e.message})):(console.log("✅ Tabla platform_quincenal_stats creada"),a.push({step:1,success:!0,message:"Tabla platform_quincenal_stats creada"})),console.log("\uD83D\uDCDD Paso 2: Creando \xedndices...");let{error:t}=await i.rpc("exec_sql",{sql_query:`
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_model_id ON platform_quincenal_stats(model_id);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_platform_id ON platform_quincenal_stats(platform_id);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_quincena ON platform_quincenal_stats(quincena);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_created_at ON platform_quincenal_stats(created_at);
      `});t?(console.error("❌ Error en paso 2:",t),a.push({step:2,success:!1,error:t.message})):(console.log("✅ \xcdndices creados"),a.push({step:2,success:!0,message:"\xcdndices creados"})),console.log("\uD83D\uDCDD Paso 3: Creando trigger...");let{error:r}=await i.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION update_platform_quincenal_stats_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_update_platform_quincenal_stats_updated_at ON platform_quincenal_stats;
        CREATE TRIGGER trigger_update_platform_quincenal_stats_updated_at
          BEFORE UPDATE ON platform_quincenal_stats
          FOR EACH ROW
          EXECUTE FUNCTION update_platform_quincenal_stats_updated_at();
      `});r?(console.error("❌ Error en paso 3:",r),a.push({step:3,success:!1,error:r.message})):(console.log("✅ Trigger creado"),a.push({step:3,success:!0,message:"Trigger creado"})),console.log("\uD83D\uDCDD Paso 4: Creando funci\xf3n calculate_quincenal_stats...");let{error:s}=await i.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION calculate_quincenal_stats(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincena VARCHAR(7)
        )
        RETURNS TABLE(
          daily_avg DECIMAL(8,2),
          total_days INTEGER,
          total_usd DECIMAL(10,2)
        ) AS $$
        DECLARE
          period_start_date DATE;
          period_end_date DATE;
          year_part INTEGER;
          month_part INTEGER;
          quincena_part INTEGER;
        BEGIN
          year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
          month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
          quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
          
          IF quincena_part = 1 THEN
            period_start_date := DATE(year_part, month_part, 1);
            period_end_date := DATE(year_part, month_part, 15);
          ELSE
            period_start_date := DATE(year_part, month_part, 16);
            period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
          END IF;
          
          RETURN QUERY
          SELECT 
            CASE 
              WHEN COUNT(DISTINCT ch.period_date) > 0 
              THEN ROUND(SUM(ch.usd_modelo) / COUNT(DISTINCT ch.period_date), 2)
              ELSE 0.00
            END as daily_avg,
            COUNT(DISTINCT ch.period_date)::INTEGER as total_days,
            COALESCE(SUM(ch.usd_modelo), 0.00) as total_usd
          FROM calculator_history ch
          WHERE ch.model_id = p_model_id
            AND ch.platform_id = p_platform_id
            AND ch.period_date::DATE >= period_start_date
            AND ch.period_date::DATE <= period_end_date;
        END;
        $$ LANGUAGE plpgsql;
      `});s?(console.error("❌ Error en paso 4:",s),a.push({step:4,success:!1,error:s.message})):(console.log("✅ Funci\xf3n calculate_quincenal_stats creada"),a.push({step:4,success:!0,message:"Funci\xf3n calculate_quincenal_stats creada"})),console.log("\uD83D\uDCDD Paso 5: Creando funci\xf3n update_quincenal_stats...");let{error:o}=await i.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION update_quincenal_stats(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincena VARCHAR(7)
        )
        RETURNS VOID AS $$
        DECLARE
          stats_record RECORD;
          period_start_date DATE;
          period_end_date DATE;
          year_part INTEGER;
          month_part INTEGER;
          quincena_part INTEGER;
        BEGIN
          year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
          month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
          quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
          
          IF quincena_part = 1 THEN
            period_start_date := DATE(year_part, month_part, 1);
            period_end_date := DATE(year_part, month_part, 15);
          ELSE
            period_start_date := DATE(year_part, month_part, 16);
            period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
          END IF;
          
          SELECT * INTO stats_record
          FROM calculate_quincenal_stats(p_model_id, p_platform_id, p_quincena);
          
          INSERT INTO platform_quincenal_stats (
            model_id, platform_id, quincena, daily_avg_usd, 
            total_days, total_usd_modelo, period_start, period_end
          ) VALUES (
            p_model_id, p_platform_id, p_quincena, stats_record.daily_avg,
            stats_record.total_days, stats_record.total_usd, period_start_date, period_end_date
          )
          ON CONFLICT (model_id, platform_id, quincena)
          DO UPDATE SET
            daily_avg_usd = EXCLUDED.daily_avg_usd,
            total_days = EXCLUDED.total_days,
            total_usd_modelo = EXCLUDED.total_usd_modelo,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            updated_at = NOW();
        END;
        $$ LANGUAGE plpgsql;
      `});o?(console.error("❌ Error en paso 5:",o),a.push({step:5,success:!1,error:o.message})):(console.log("✅ Funci\xf3n update_quincenal_stats creada"),a.push({step:5,success:!0,message:"Funci\xf3n update_quincenal_stats creada"})),console.log("\uD83D\uDCDD Paso 6: Creando funci\xf3n get_moving_average_daily_avg...");let{error:n}=await i.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION get_moving_average_daily_avg(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincenas_back INTEGER DEFAULT 4
        )
        RETURNS TABLE(
          current_avg DECIMAL(8,2),
          previous_avg DECIMAL(8,2),
          trend VARCHAR(1),
          quincenas_count INTEGER
        ) AS $$
        DECLARE
          current_avg_val DECIMAL(8,2);
          previous_avg_val DECIMAL(8,2);
          trend_char VARCHAR(1);
          count_val INTEGER;
          available_quincenas INTEGER;
        BEGIN
          -- Contar quincenas disponibles
          SELECT COUNT(*) INTO available_quincenas
          FROM platform_quincenal_stats
          WHERE model_id = p_model_id
            AND platform_id = p_platform_id;
          
          -- Si no hay datos, retornar 0
          IF available_quincenas = 0 THEN
            RETURN QUERY SELECT 0.00, 0.00, '=', 0;
            RETURN;
          END IF;
          
          -- Determinar cu\xe1ntas quincenas usar (progresivo)
          DECLARE
            quincenas_to_use INTEGER;
          BEGIN
            IF available_quincenas >= 4 THEN
              quincenas_to_use := 4; -- Promedio m\xf3vil de 4 quincenas
            ELSE
              quincenas_to_use := available_quincenas; -- Todas las disponibles
            END IF;
            
            -- Obtener promedio de las quincenas disponibles
            SELECT 
              ROUND(AVG(daily_avg_usd), 2),
              quincenas_to_use
            INTO current_avg_val, count_val
            FROM platform_quincenal_stats
            WHERE model_id = p_model_id
              AND platform_id = p_platform_id
            ORDER BY quincena DESC
            LIMIT quincenas_to_use;
            
            -- Para tendencia, comparar con el per\xedodo anterior
            IF available_quincenas >= 2 THEN
              -- Si hay 2+ quincenas, comparar con la quincena anterior
              SELECT ROUND(AVG(daily_avg_usd), 2)
              INTO previous_avg_val
              FROM platform_quincenal_stats
              WHERE model_id = p_model_id
                AND platform_id = p_platform_id
              ORDER BY quincena DESC
              OFFSET 1
              LIMIT 1;
            ELSE
              -- Si solo hay 1 quincena, no hay tendencia
              previous_avg_val := NULL;
            END IF;
            
            -- Determinar tendencia
            IF previous_avg_val IS NULL THEN
              trend_char := '=';
            ELSIF current_avg_val > previous_avg_val THEN
              trend_char := '↑';
            ELSIF current_avg_val < previous_avg_val THEN
              trend_char := '↓';
            ELSE
              trend_char := '=';
            END IF;
            
            RETURN QUERY SELECT 
              COALESCE(current_avg_val, 0.00),
              COALESCE(previous_avg_val, 0.00),
              trend_char,
              count_val;
          END;
        END;
        $$ LANGUAGE plpgsql;
      `});n?(console.error("❌ Error en paso 6:",n),a.push({step:6,success:!1,error:n.message})):(console.log("✅ Funci\xf3n get_moving_average_daily_avg creada"),a.push({step:6,success:!0,message:"Funci\xf3n get_moving_average_daily_avg creada"})),console.log("\uD83D\uDCDD Paso 7: Configurando RLS...");let{error:l}=await i.rpc("exec_sql",{sql_query:`
        ALTER TABLE platform_quincenal_stats ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Models can view own quincenal stats" ON platform_quincenal_stats;
        CREATE POLICY "Models can view own quincenal stats" ON platform_quincenal_stats
          FOR SELECT USING (auth.uid() = model_id);
        
        DROP POLICY IF EXISTS "Admins can manage quincenal stats" ON platform_quincenal_stats;
        CREATE POLICY "Admins can manage quincenal stats" ON platform_quincenal_stats
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.users 
              WHERE id = auth.uid() 
              AND role IN ('admin', 'super_admin')
            )
          );
      `});l?(console.error("❌ Error en paso 7:",l),a.push({step:7,success:!1,error:l.message})):(console.log("✅ RLS configurado"),a.push({step:7,success:!0,message:"RLS configurado"})),console.log("\uD83D\uDD0D Verificando estructura...");let{data:c,error:u}=await i.rpc("exec_sql",{sql_query:`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'platform_quincenal_stats'
        ORDER BY ordinal_position;
      `});u?(console.error("❌ Error verificando:",u),a.push({step:"verification",success:!1,error:u.message})):(console.log("✅ Verificaci\xf3n completada"),a.push({step:"verification",success:!0,message:"Verificaci\xf3n completada",columns:c}));let E=a.filter(a=>a.success).length,d=a.length;return console.log(`🎉 \xa1Configuraci\xf3n completada! ${E}/${d} pasos exitosos`),_.Z.json({success:E===d,message:`Configuraci\xf3n de promedio diario quincenal completada: ${E}/${d} pasos exitosos`,results:a,columns:c||null})}catch(a){return console.error("❌ [SETUP-DAILY-AVG-QUINCENAL] Error general:",a),_.Z.json({success:!1,error:a.message||"Error interno del servidor"},{status:500})}}async function c(a){try{let{data:a,error:e}=await i.rpc("exec_sql",{sql_query:`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'platform_quincenal_stats'
        ORDER BY ordinal_position;
      `});if(e)return _.Z.json({success:!1,error:"Error al verificar configuraci\xf3n"},{status:500});let t=a&&a.length>0;return _.Z.json({success:!0,isConfigured:t,columns:a||[],message:t?"Promedio diario quincenal ya est\xe1 configurado":"Promedio diario quincenal no est\xe1 configurado"})}catch(a){return _.Z.json({success:!1,error:a.message||"Error interno del servidor"},{status:500})}}let u=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/admin/setup-daily-avg-quincenal/route",pathname:"/api/admin/setup-daily-avg-quincenal",filename:"route",bundlePath:"app/api/admin/setup-daily-avg-quincenal/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\admin\\setup-daily-avg-quincenal\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:E,staticGenerationAsyncStorage:d,serverHooks:p,headerHooks:T,staticGenerationBailout:m}=u,N="/api/admin/setup-daily-avg-quincenal/route";function R(){return(0,n.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:d})}}};var e=require("../../../../webpack-runtime.js");e.C(a);var t=a=>e(e.s=a),r=e.X(0,[1638,6206,2964],()=>t(22551));module.exports=r})();