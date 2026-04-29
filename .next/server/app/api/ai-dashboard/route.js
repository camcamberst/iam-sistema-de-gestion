"use strict";(()=>{var e={};e.id=2103,e.ids=[2103],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},30400:(e,a,t)=>{t.r(a),t.d(a,{headerHooks:()=>w,originalPathname:()=>A,patchFetch:()=>E,requestAsyncStorage:()=>D,routeModule:()=>h,serverHooks:()=>x,staticGenerationAsyncStorage:()=>v,staticGenerationBailout:()=>S});var o={};t.r(o),t.d(o,{POST:()=>g,dynamic:()=>u});var r=t(95419),n=t(69108),i=t(99678),s=t(78070),c=t(72964),l=t(70973),d=t(31057);let u="force-dynamic",m=(0,c.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),p=new l.$D(process.env.GOOGLE_GEMINI_API_KEY);async function g(e){try{let{userId:a,userRole:t,forceRefresh:o}=await e.json();if(!a)return s.Z.json({success:!1,error:"userId es requerido"},{status:400});if("modelo"!==t)return s.Z.json({success:!1,error:"Solo disponible para modelos"},{status:403});let r=(0,d.iu)("ai-dashboard",{userId:a});if(o)try{d.sJ.invalidate(r)}catch{}let n=await (0,d.DN)(r,async()=>{let e=await f(a);if(!e)throw Error("No se encontraron datos del usuario");return await y(e)},252e5);if(!n)return s.Z.json({success:!1,error:"No se encontraron datos del usuario"},{status:404});return s.Z.json({success:!0,data:n})}catch(e){return console.error("Error en AI Dashboard:",e),s.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}async function f(e){try{let a=new Date().toISOString().split("T")[0],t=new Date(Date.now()-864e5).toISOString().split("T")[0],{data:o}=await m.from("model_values").select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).eq("period_date",a),{data:r}=await m.from("model_values").select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).eq("period_date",t),n=(o||[]).reduce((e,a)=>e+(a.value||0),0),i=(r||[]).reduce((e,a)=>e+(a.value||0),0),s=new Date(Date.now()-6048e5).toISOString().split("T")[0],{data:c}=await m.from("model_values").select(`
        platform_id,
        value,
        period_date,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).gte("period_date",s).order("period_date",{ascending:!0}),{data:l}=await m.from("calculator_configs").select("*").eq("user_id",e).single(),{data:d}=await m.from("modelo_plataformas").select(`
        platform_id,
        status,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).in("status",["entregada","confirmada"]);return{todayEarnings:n-i,todayTotal:n,yesterdayTotal:i,weeklyData:c||[],config:l||{},portfolio:d||[],userId:e}}catch(e){return console.error("Error obteniendo datos de productividad:",e),null}}async function y(e){let a=e.todayEarnings,t=e.weeklyData.reduce((e,a)=>e+(a.value||0),0),o=t/7,r=new Map;e.weeklyData.forEach(e=>{let a=e.calculator_platforms?.name||"Unknown";r.has(a)||r.set(a,{total:0,days:0});let t=r.get(a);t.total+=e.value||0,t.days+=1});let n="N/A",i=0;r.forEach((e,a)=>{let t=e.total/e.days;t>i&&(i=t,n=a)});let s=`
Eres un asistente especializado en an\xe1lisis de rendimiento para modelos de webcam. 
Genera insights \xfatiles y motivadores con un tono casual y amigable, pero profesional.

DATOS DEL MODELO:
- Ganancias del d\xeda: $${a.toFixed(2)} USD (diferencia entre hoy y ayer)
- Total acumulado hoy: $${e.todayTotal.toFixed(2)} USD
- Total acumulado ayer: $${e.yesterdayTotal.toFixed(2)} USD
- Promedio diario (\xfaltima semana): $${o.toFixed(2)} USD
- Total semanal: $${t.toFixed(2)} USD
- Mejor plataforma: ${n}
- Plataformas activas: ${e.portfolio.length}

INSTRUCCIONES:
1. Genera 3 insights espec\xedficos y accionables
2. Proporciona 1 tip del d\xeda motivador
3. Da 3 recomendaciones espec\xedficas
4. Usa un tono casual y amigable, como un mentor experimentado
5. Incluye emojis apropiados
6. S\xe9 espec\xedfico pero motivador
7. Enf\xf3cate en estrategias de mejora y optimizaci\xf3n

Responde en formato JSON:
{
  "insights": [
    {
      "type": "tip|analysis|recommendation|trend",
      "title": "t\xedtulo con emoji",
      "content": "contenido detallado",
      "priority": "high|medium|low",
      "category": "engagement|performance|strategy",
      "actionable": true
    }
  ],
  "dailyTip": "tip motivador del d\xeda",
  "recommendations": ["recomendaci\xf3n 1", "recomendaci\xf3n 2", "recomendaci\xf3n 3"],
  "performanceSummary": {
    "todayEarnings": ${a},
    "weeklyTrend": ${((a-o)/(o||1)*100).toFixed(1)},
    "bestPlatform": "${n}",
    "goalProgress": 75.0
  }
}
`;for(let e of["gemini-3.0-pro","gemini-3-pro-preview","gemini-3.0-flash","gemini-3-flash-preview","gemini-2.5-flash","gemini-2.5-pro","gemini-1.5-flash-latest","gemini-1.5-pro-latest","gemini-1.5-flash","gemini-1.5-pro"])try{console.log(`🤖 [AI-DASHBOARD] Intentando con modelo: ${e}`);let a=p.getGenerativeModel({model:e}),t=await a.generateContent(s),o=(await t.response).text().replace(/```json\n?|\n?```/g,"").trim();try{let a=JSON.parse(o);return console.log(`✅ [AI-DASHBOARD] \xc9xito con modelo: ${e}`),{...a,lastUpdated:new Date().toISOString()}}catch(e){console.error("Error parsing Gemini response:",e);continue}}catch(a){console.warn(`⚠️ [AI-DASHBOARD] Error con modelo ${e}:`,a.message);continue}return console.error("❌ [AI-DASHBOARD] Todos los modelos fallaron, usando fallback"),{insights:[{type:"tip",title:"\uD83D\uDCA1 Tip de Engagement",content:"Interact\xfaa m\xe1s con tu audiencia durante las primeras 30 minutos de tu sesi\xf3n. Los usuarios que reciben atenci\xf3n personalizada tienden a quedarse m\xe1s tiempo.",priority:"high",category:"engagement",actionable:!0},{type:"analysis",title:"\uD83D\uDCCA An\xe1lisis de Rendimiento",content:"Mant\xe9n un registro consistente de tus ingresos para obtener mejores insights. La consistencia es clave para el crecimiento.",priority:"medium",category:"performance",actionable:!0},{type:"recommendation",title:"\uD83C\uDFAF Recomendaci\xf3n Estrat\xe9gica",content:"Diversifica tu contenido con temas de conversaci\xf3n variados. Los usuarios valoran la autenticidad y la variedad.",priority:"medium",category:"strategy",actionable:!0}],dailyTip:"\uD83C\uDF1F Tip del D\xeda: Usa el chat para crear conexiones genuinas. Pregunta sobre sus intereses y comparte experiencias personales apropiadas.",recommendations:["Optimiza tu perfil con tags m\xe1s espec\xedficos","Considera horarios de mayor audiencia","Mant\xe9n consistencia en tu programaci\xf3n"],performanceSummary:{todayEarnings:e.todayEarnings,weeklyTrend:0,bestPlatform:"N/A",goalProgress:0},lastUpdated:new Date().toISOString()}}let h=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/ai-dashboard/route",pathname:"/api/ai-dashboard",filename:"route",bundlePath:"app/api/ai-dashboard/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\navegador\\iam-gestion\\app\\api\\ai-dashboard\\route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:D,staticGenerationAsyncStorage:v,serverHooks:x,headerHooks:w,staticGenerationBailout:S}=h,A="/api/ai-dashboard/route";function E(){return(0,i.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:v})}},31057:(e,a,t)=>{t.d(a,{DN:()=>n,iu:()=>i,sJ:()=>r});class o{get(e){let a=this.cache.get(e);return a?Date.now()>a.expiresAt?(this.cache.delete(e),null):a.data:null}set(e,a,t){let o=Date.now(),r=o+(t||this.defaultTTL);this.cache.set(e,{data:a,timestamp:o,expiresAt:r})}invalidate(e){this.cache.delete(e)}invalidatePattern(e){for(let a of Array.from(this.cache.keys()))e.test(a)&&this.cache.delete(a)}cleanup(){let e=Date.now();for(let[a,t]of Array.from(this.cache.entries()))e>t.expiresAt&&this.cache.delete(a)}clear(){this.cache.clear()}getStats(){return this.cleanup(),{size:this.cache.size,keys:Array.from(this.cache.keys())}}constructor(){this.cache=new Map,this.defaultTTL=6e4}}let r=new o;async function n(e,a,t){let o=r.get(e);if(null!==o)return console.log(`💾 [CACHE] Hit: ${e}`),o;console.log(`🔄 [CACHE] Miss: ${e}`);let n=await a();return r.set(e,n,t),n}function i(e,a){let t=Object.keys(a).sort().map(e=>`${e}:${a[e]}`).join("|");return`${e}|${t}`}setInterval(()=>{r.cleanup()},3e5)}};var a=require("../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),o=a.X(0,[1638,6206,2964,973],()=>t(30400));module.exports=o})();