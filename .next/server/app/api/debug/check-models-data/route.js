"use strict";(()=>{var e={};e.id=7588,e.ids=[7588],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},18998:(e,r,o)=>{o.r(r),o.d(r,{headerHooks:()=>h,originalPathname:()=>v,patchFetch:()=>b,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>g,staticGenerationAsyncStorage:()=>p,staticGenerationBailout:()=>_});var t={};o.r(t),o.d(t,{GET:()=>c});var s=o(95419),a=o(69108),i=o(99678),n=o(78070),d=o(72964);let u=process.env.SUPABASE_SERVICE_ROLE_KEY;async function c(e){try{let e=(0,d.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",u);console.log("\uD83D\uDD0D [DEBUG] Verificando datos de modelos...");let{data:r,error:o}=await e.from("users").select(`
        id,
        name,
        email,
        role,
        is_active,
        organization_id,
        created_at
      `).eq("role","modelo").eq("is_active",!0);if(o)return console.error("Error obteniendo modelos:",o),n.Z.json({success:!1,error:"Error obteniendo modelos",details:o},{status:500});let{data:t,error:s}=await e.from("modelo_assignments").select(`
        model_id,
        group_id,
        room_id,
        jornada,
        is_active
      `).eq("is_active",!0),{data:a,error:i}=await e.from("group_rooms").select(`
        id,
        room_name,
        group_id,
        groups!inner(
          id,
          name
        )
      `);return n.Z.json({success:!0,data:{totalModels:r?.length||0,models:r||[],totalAssignments:t?.length||0,assignments:t||[],totalRooms:a?.length||0,rooms:a||[],errors:{modelsError:o,assignmentsError:s,roomsError:i}}})}catch(e){return console.error("Error en check-models-data:",e),n.Z.json({success:!1,error:"Error interno del servidor",details:e},{status:500})}}let l=new s.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/debug/check-models-data/route",pathname:"/api/debug/check-models-data",filename:"route",bundlePath:"app/api/debug/check-models-data/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\debug\\check-models-data\\route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:g,headerHooks:h,staticGenerationBailout:_}=l,v="/api/debug/check-models-data/route";function b(){return(0,i.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:p})}}};var r=require("../../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),t=r.X(0,[1638,6206,2964],()=>o(18998));module.exports=t})();