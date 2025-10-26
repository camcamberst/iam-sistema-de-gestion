"use strict";(()=>{var r={};r.id=6694,r.ids=[6694],r.modules={30517:r=>{r.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:r=>{r.exports=require("http")},95687:r=>{r.exports=require("https")},85477:r=>{r.exports=require("punycode")},12781:r=>{r.exports=require("stream")},57310:r=>{r.exports=require("url")},59796:r=>{r.exports=require("zlib")},27950:(r,e,o)=>{o.r(e),o.d(e,{headerHooks:()=>E,originalPathname:()=>h,patchFetch:()=>f,requestAsyncStorage:()=>d,routeModule:()=>m,serverHooks:()=>g,staticGenerationAsyncStorage:()=>l,staticGenerationBailout:()=>_});var s={};o.r(s),o.d(s,{GET:()=>c,POST:()=>p});var t=o(95419),n=o(69108),u=o(99678),i=o(78070),a=o(72964);async function c(r){try{console.log("\uD83C\uDFE0 [API] Obteniendo rooms...");let r=(0,a.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),{data:e,error:o}=await r.from("group_rooms").select(`
        id,
        room_name,
        group_id,
        is_active,
        groups!inner(
          id,
          name
        )
      `).order("room_name",{ascending:!0});if(o)return console.error("❌ [API] Error obteniendo rooms:",o),i.Z.json({success:!1,error:"Error obteniendo rooms"},{status:500});return console.log("✅ [API] Rooms obtenidos:",e?.length||0),i.Z.json({success:!0,rooms:e||[]})}catch(r){return console.error("❌ [API] Error general:",r),i.Z.json({success:!1,error:"Error interno"},{status:500})}}async function p(r){try{console.log("\uD83C\uDFE0 [API] Creando room...");let{room_name:e,group_id:o}=await r.json();if(!e||!e.trim())return i.Z.json({success:!1,error:"El nombre del room es requerido"},{status:400});if(!o)return i.Z.json({success:!1,error:"El grupo es requerido"},{status:400});let s=(0,a.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),{data:t,error:n}=await s.from("groups").select("id, name").eq("id",o).single();if(n||!t)return i.Z.json({success:!1,error:"El grupo seleccionado no existe"},{status:400});let{data:u,error:c}=await s.from("group_rooms").insert({room_name:e.trim(),group_id:o,is_active:!0}).select(`
        id,
        room_name,
        group_id,
        is_active,
        groups!inner(
          id,
          name
        )
      `).single();if(c){if(console.error("❌ [API] Error creando room:",c),"23505"===c.code)return i.Z.json({success:!1,error:"Ya existe un room con ese nombre en este grupo"},{status:400});return i.Z.json({success:!1,error:"Error creando room"},{status:500})}return console.log("✅ [API] Room creado:",u),i.Z.json({success:!0,room:u})}catch(r){return console.error("❌ [API] Error general:",r),i.Z.json({success:!1,error:"Error interno"},{status:500})}}let m=new t.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/groups/rooms/route",pathname:"/api/groups/rooms",filename:"route",bundlePath:"app/api/groups/rooms/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\groups\\rooms\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:d,staticGenerationAsyncStorage:l,serverHooks:g,headerHooks:E,staticGenerationBailout:_}=m,h="/api/groups/rooms/route";function f(){return(0,u.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:l})}}};var e=require("../../../../webpack-runtime.js");e.C(r);var o=r=>e(e.s=r),s=e.X(0,[1638,6206,2964],()=>o(27950));module.exports=s})();