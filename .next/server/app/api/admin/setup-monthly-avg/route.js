"use strict";(()=>{var e={};e.id=4910,e.ids=[4910],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},61283:(e,o,a)=>{a.r(o),a.d(o,{headerHooks:()=>d,originalPathname:()=>h,patchFetch:()=>D,requestAsyncStorage:()=>m,routeModule:()=>i,serverHooks:()=>g,staticGenerationAsyncStorage:()=>E,staticGenerationBailout:()=>p});var t={};a.r(t),a.d(t,{GET:()=>_,POST:()=>u});var s=a(95419),n=a(69108),r=a(99678),c=a(78070);let l=(0,a(72964).createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function u(e){try{console.log("\uD83D\uDD04 [SETUP-MONTHLY-AVG] Iniciando configuraci\xf3n de promedio mensual...");let e=[];console.log("\uD83D\uDCDD Paso 1: Agregando columna monthly_connection_avg...");let{error:o}=await l.rpc("exec_sql",{sql_query:`
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS monthly_connection_avg DECIMAL(5,2) DEFAULT 0.00;
      `});o?(console.error("❌ Error en paso 1:",o),e.push({step:1,success:!1,error:o.message})):(console.log("✅ Columna monthly_connection_avg agregada"),e.push({step:1,success:!0,message:"Columna monthly_connection_avg agregada"})),console.log("\uD83D\uDCDD Paso 2: Agregando columna last_avg_calculation_date...");let{error:a}=await l.rpc("exec_sql",{sql_query:`
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS last_avg_calculation_date DATE DEFAULT NULL;
      `});a?(console.error("❌ Error en paso 2:",a),e.push({step:2,success:!1,error:a.message})):(console.log("✅ Columna last_avg_calculation_date agregada"),e.push({step:2,success:!0,message:"Columna last_avg_calculation_date agregada"})),console.log("\uD83D\uDCDD Paso 3: Agregando columna last_avg_month...");let{error:t}=await l.rpc("exec_sql",{sql_query:`
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS last_avg_month VARCHAR(7) DEFAULT NULL;
      `});t?(console.error("❌ Error en paso 3:",t),e.push({step:3,success:!1,error:t.message})):(console.log("✅ Columna last_avg_month agregada"),e.push({step:3,success:!0,message:"Columna last_avg_month agregada"})),console.log("\uD83D\uDCDD Paso 4: Creando funci\xf3n update_monthly_connection_avg...");let{error:s}=await l.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION update_monthly_connection_avg(p_model_id UUID)
        RETURNS DECIMAL(5,2) AS $$
        DECLARE
            current_month VARCHAR(7);
            current_date_str DATE;
            days_in_month INTEGER;
            days_with_activity INTEGER;
            monthly_avg DECIMAL(5,2);
        BEGIN
            current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
            current_date_str := CURRENT_DATE;
            
            days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', CURRENT_DATE) + INTERVAL '1 MONTH - 1 DAY'));
            
            SELECT COUNT(DISTINCT period_date) INTO days_with_activity
            FROM calculator_history 
            WHERE model_id = p_model_id 
            AND DATE_TRUNC('MONTH', period_date::DATE) = DATE_TRUNC('MONTH', CURRENT_DATE);
            
            monthly_avg := CASE 
                WHEN days_in_month > 0 THEN ROUND((days_with_activity::DECIMAL / 26) * 100, 2)
                ELSE 0
            END;
            
            UPDATE public.users 
            SET 
                monthly_connection_avg = monthly_avg,
                last_avg_calculation_date = current_date_str,
                last_avg_month = current_month
            WHERE id = p_model_id;
            
            RETURN monthly_avg;
        END;
        $$ LANGUAGE plpgsql;
      `});s?(console.error("❌ Error en paso 4:",s),e.push({step:4,success:!1,error:s.message})):(console.log("✅ Funci\xf3n update_monthly_connection_avg creada"),e.push({step:4,success:!0,message:"Funci\xf3n update_monthly_connection_avg creada"})),console.log("\uD83D\uDCDD Paso 5: Creando funci\xf3n get_monthly_connection_avg...");let{error:n}=await l.rpc("exec_sql",{sql_query:`
        CREATE OR REPLACE FUNCTION get_monthly_connection_avg(p_model_id UUID)
        RETURNS DECIMAL(5,2) AS $$
        DECLARE
            current_month VARCHAR(7);
            last_calculated_month VARCHAR(7);
            monthly_avg DECIMAL(5,2);
        BEGIN
            current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
            
            SELECT last_avg_month INTO last_calculated_month
            FROM public.users 
            WHERE id = p_model_id;
            
            IF last_calculated_month IS NULL OR last_calculated_month != current_month THEN
                monthly_avg := update_monthly_connection_avg(p_model_id);
            ELSE
                SELECT monthly_connection_avg INTO monthly_avg
                FROM public.users 
                WHERE id = p_model_id;
            END IF;
            
            RETURN COALESCE(monthly_avg, 0);
        END;
        $$ LANGUAGE plpgsql;
      `});n?(console.error("❌ Error en paso 5:",n),e.push({step:5,success:!1,error:n.message})):(console.log("✅ Funci\xf3n get_monthly_connection_avg creada"),e.push({step:5,success:!0,message:"Funci\xf3n get_monthly_connection_avg creada"})),console.log("\uD83D\uDD0D Verificando estructura...");let{data:r,error:u}=await l.rpc("exec_sql",{sql_query:`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
        ORDER BY column_name;
      `});u?(console.error("❌ Error verificando:",u),e.push({step:"verification",success:!1,error:u.message})):(console.log("✅ Verificaci\xf3n completada"),e.push({step:"verification",success:!0,message:"Verificaci\xf3n completada",columns:r}));let _=e.filter(e=>e.success).length,i=e.length;return console.log(`🎉 \xa1Configuraci\xf3n completada! ${_}/${i} pasos exitosos`),c.Z.json({success:_===i,message:`Configuraci\xf3n de promedio mensual completada: ${_}/${i} pasos exitosos`,results:e,columns:r||null})}catch(e){return console.error("❌ [SETUP-MONTHLY-AVG] Error general:",e),c.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}async function _(e){try{let{data:e,error:o}=await l.rpc("exec_sql",{sql_query:`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
        ORDER BY column_name;
      `});if(o)return c.Z.json({success:!1,error:"Error al verificar configuraci\xf3n"},{status:500});let a=e&&3===e.length;return c.Z.json({success:!0,isConfigured:a,columns:e||[],message:a?"Promedio mensual ya est\xe1 configurado":"Promedio mensual no est\xe1 configurado"})}catch(e){return c.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}let i=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/admin/setup-monthly-avg/route",pathname:"/api/admin/setup-monthly-avg",filename:"route",bundlePath:"app/api/admin/setup-monthly-avg/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\admin\\setup-monthly-avg\\route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:m,staticGenerationAsyncStorage:E,serverHooks:g,headerHooks:d,staticGenerationBailout:p}=i,h="/api/admin/setup-monthly-avg/route";function D(){return(0,r.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:E})}}};var o=require("../../../../webpack-runtime.js");o.C(e);var a=e=>o(o.s=e),t=o.X(0,[1638,6206,2964],()=>a(61283));module.exports=t})();