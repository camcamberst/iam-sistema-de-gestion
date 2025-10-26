"use strict";(()=>{var e={};e.id=3688,e.ids=[3688],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},79582:(e,a,r)=>{r.r(a),r.d(a,{headerHooks:()=>T,originalPathname:()=>_,patchFetch:()=>N,requestAsyncStorage:()=>l,routeModule:()=>u,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p,staticGenerationBailout:()=>A});var i={};r.r(i),r.d(i,{POST:()=>E});var n=r(95419),s=r(69108),t=r(99678),d=r(78070);let o=(0,r(72964).createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function E(e){try{console.log("\uD83D\uDE80 [SETUP-DAILY-EARNINGS] Iniciando configuraci\xf3n...");let e=`
-- Crear tabla para almacenar ganancias diarias
CREATE TABLE IF NOT EXISTS daily_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings_date DATE NOT NULL DEFAULT CURRENT_DATE,
  earnings_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, earnings_date)
);

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_daily_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_earnings_updated_at
  BEFORE UPDATE ON daily_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_earnings_updated_at();

-- Habilitar RLS
ALTER TABLE daily_earnings ENABLE ROW LEVEL SECURITY;

-- Pol\xedtica para modelos (solo pueden ver sus propios datos)
CREATE POLICY "Models can view own daily earnings" ON daily_earnings
  FOR SELECT USING (auth.uid() = model_id);

-- Pol\xedtica para admins (pueden ver todos los datos)
CREATE POLICY "Admins can view all daily earnings" ON daily_earnings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Pol\xedtica para insertar/actualizar (solo admins y el propio modelo)
CREATE POLICY "Users can insert/update own daily earnings" ON daily_earnings
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Users can update own daily earnings" ON daily_earnings
  FOR UPDATE USING (auth.uid() = model_id);
    `,{data:a,error:r}=await o.rpc("exec_sql",{sql:e});if(r)return console.error("❌ [SETUP-DAILY-EARNINGS] Error:",r),d.Z.json({success:!1,error:r.message},{status:500});return console.log("✅ [SETUP-DAILY-EARNINGS] Tabla daily_earnings creada exitosamente"),d.Z.json({success:!0,message:"Tabla daily_earnings creada exitosamente",details:{table:"daily_earnings",columns:["id (UUID, PK)","model_id (UUID, FK)","earnings_date (DATE)","earnings_amount (DECIMAL)","created_at, updated_at (TIMESTAMP)"],constraints:["UNIQUE(model_id, earnings_date)"],rls:"Habilitado con pol\xedticas para modelos y admins"}})}catch(e){return console.error("❌ [SETUP-DAILY-EARNINGS] Error:",e),d.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}let u=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/admin/setup-daily-earnings/route",pathname:"/api/admin/setup-daily-earnings",filename:"route",bundlePath:"app/api/admin/setup-daily-earnings/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\admin\\setup-daily-earnings\\route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:c,headerHooks:T,staticGenerationBailout:A}=u,_="/api/admin/setup-daily-earnings/route";function N(){return(0,t.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}}};var a=require("../../../../webpack-runtime.js");a.C(e);var r=e=>a(a.s=e),i=a.X(0,[1638,6206,2964],()=>r(79582));module.exports=i})();