"use strict";(()=>{var e={};e.id=5779,e.ids=[5779],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},97667:(e,a,o)=>{o.r(a),o.d(a,{headerHooks:()=>h,originalPathname:()=>v,patchFetch:()=>_,requestAsyncStorage:()=>f,routeModule:()=>g,serverHooks:()=>x,staticGenerationAsyncStorage:()=>E,staticGenerationBailout:()=>y});var r={};o.r(r),o.d(r,{POST:()=>p});var t=o(95419),n=o(69108),s=o(99678),i=o(78070),l=o(72964),d=o(70973);let m=(0,l.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),c=new d.$D(process.env.GOOGLE_GEMINI_API_KEY);async function p(e){try{let{modelId:a,analysisType:o="comprehensive"}=await e.json();if(!a)return i.Z.json({success:!1,error:"modelId es requerido"},{status:400});let{data:r,error:t}=await m.from("calculator_history").select(`
        platform_id,
        value,
        usd_bruto,
        usd_modelo,
        cop_modelo,
        period_date,
        period_type
      `).eq("model_id",a).order("period_date",{ascending:!0}).order("period_type",{ascending:!0}),{data:n}=await m.from("calculator_platforms").select("id, name");if(t)return console.error("Error obteniendo datos de calculadora:",t),i.Z.json({success:!1,error:"Error al obtener datos hist\xf3ricos"},{status:500});if(!r||0===r.length)return i.Z.json({success:!0,data:{analysis:"No hay suficientes datos hist\xf3ricos para generar un an\xe1lisis. Contin\xfaa trabajando para obtener insights valiosos.",recommendations:["Mant\xe9n un registro consistente de tus ingresos","Diversifica tus plataformas para maximizar ganancias","Establece objetivos claros y medibles"],trends:[],summary:{totalPeriods:0,totalEarnings:0,avgPeriodEarnings:0,bestPlatform:null,growthRate:0}}});let s=new Map,l=new Map,d=0,c=0,p=new Map;n?.forEach(e=>{p.set(e.id,e.name)}),r.forEach(e=>{let a=`${e.period_date}-${e.period_type}`,o=p.get(e.platform_id);if(!o)return;s.has(o)||s.set(o,{name:o,code:e.platform_id,totalEarnings:0,totalPeriods:0,avgEarnings:0,maxEarnings:0,minEarnings:1/0,periods:new Set});let r=s.get(o);r.totalEarnings+=e.usd_modelo||0,r.periods.add(a),r.maxEarnings=Math.max(r.maxEarnings,e.usd_modelo||0),r.minEarnings=Math.min(r.minEarnings,e.usd_modelo||0),!l.has(a)&&(l.set(a,{period_date:e.period_date,period_type:e.period_type,totalEarnings:0,platformCount:0}),c++);let t=l.get(a);t.totalEarnings+=e.usd_modelo||0,t.platformCount+=1,d+=e.usd_modelo||0}),s.forEach(e=>{e.totalPeriods=e.periods.size,e.avgEarnings=e.totalPeriods>0?e.totalEarnings/e.totalPeriods:0,e.minEarnings===1/0&&(e.minEarnings=0),e.periods=Array.from(e.periods)});let g=null,f=0;s.forEach(e=>{e.avgEarnings>f&&(f=e.avgEarnings,g=e)});let E=Array.from(l.values()),x=0;if(E.length>=2){let e=E[0].totalEarnings,a=E[E.length-1].totalEarnings;x=e>0?(a-e)/e*100:0}let h={totalEarnings:d,totalPeriods:c,avgPeriodEarnings:c>0?d/c:0,bestPlatform:g,growthRate:x,platformStats:Array.from(s.values()),periodEarnings:Array.from(l.values())},{analysis:y,recommendations:v,trends:_}=await u(h);return i.Z.json({success:!0,data:{analysis:y,recommendations:v,trends:_,summary:{totalPeriods:c,totalEarnings:d,avgPeriodEarnings:c>0?d/c:0,bestPlatform:g?.name||null,growthRate:Math.round(100*x)/100},platformStats:Array.from(s.values()),lastUpdated:new Date().toISOString()}})}catch(e){return console.error("Error en an\xe1lisis de portafolio:",e),i.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}async function u(e){let a=`
Eres un asistente especializado en an\xe1lisis de rendimiento para modelos de webcam. 
Analiza los siguientes datos y proporciona insights valiosos con un tono casual y amigable, pero profesional.

DATOS DEL MODELO:
- Ganancias totales: $${e.totalEarnings.toFixed(2)} USD
- Per\xedodos analizados: ${e.totalPeriods} per\xedodos quincenales
- Promedio por per\xedodo: $${e.avgPeriodEarnings.toFixed(2)} USD
- Tasa de crecimiento: ${e.growthRate>0?"+":""}${e.growthRate.toFixed(1)}%
- Mejor plataforma: ${e.bestPlatform?.name||"N/A"}

PLATAFORMAS:
${e.platformStats.map(e=>`- ${e.name}: $${e.totalEarnings.toFixed(2)} total, $${e.avgEarnings.toFixed(2)} promedio por per\xedodo`).join("\n")}

PER\xcdODOS:
${e.periodEarnings.map(e=>`- ${e.period_date} (${e.period_type}): $${e.totalEarnings.toFixed(2)}`).join("\n")}

INSTRUCCIONES:
1. Genera un an\xe1lisis detallado del rendimiento
2. Proporciona 3-5 recomendaciones espec\xedficas y accionables
3. Identifica 2-3 tendencias importantes
4. Usa un tono casual y amigable, como si fueras un mentor experimentado
5. Incluye emojis apropiados
6. S\xe9 espec\xedfico pero no menciones datos exactos de ganancias en el an\xe1lisis
7. Enf\xf3cate en estrategias de mejora y optimizaci\xf3n

Responde en formato JSON:
{
  "analysis": "an\xe1lisis detallado aqu\xed",
  "recommendations": ["recomendaci\xf3n 1", "recomendaci\xf3n 2", ...],
  "trends": [
    {
      "type": "tipo de tendencia",
      "label": "etiqueta",
      "value": "valor",
      "change": "cambio",
      "trend": "up/down/stable"
    }
  ]
}
`;for(let e of["gemini-3.0-pro","gemini-3-pro-preview","gemini-3.0-flash","gemini-3-flash-preview","gemini-2.5-flash","gemini-2.5-pro","gemini-1.5-flash-latest","gemini-1.5-pro-latest","gemini-1.5-flash","gemini-1.5-pro"])try{console.log(`🤖 [PORTFOLIO-ANALYTICS] Intentando con modelo: ${e}`);let o=c.getGenerativeModel({model:e}),r=await o.generateContent(a),t=(await r.response).text().replace(/```json\n?|\n?```/g,"").trim();try{let a=JSON.parse(t);return console.log(`✅ [PORTFOLIO-ANALYTICS] \xc9xito con modelo: ${e}`),{analysis:a.analysis||"An\xe1lisis no disponible",recommendations:a.recommendations||[],trends:a.trends||[]}}catch(e){console.error("Error parsing Gemini response:",e);continue}}catch(a){console.warn(`⚠️ [PORTFOLIO-ANALYTICS] Error con modelo ${e}:`,a.message);continue}return console.error("❌ [PORTFOLIO-ANALYTICS] Todos los modelos fallaron, usando fallback"),{analysis:"An\xe1lisis no disponible temporalmente",recommendations:["Mant\xe9n un registro consistente de tus ingresos","Diversifica tus plataformas para maximizar ganancias","Establece objetivos claros y medibles"],trends:[]}}let g=new t.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/modelo-portafolio/analytics/route",pathname:"/api/modelo-portafolio/analytics",filename:"route",bundlePath:"app/api/modelo-portafolio/analytics/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\modelo-portafolio\\analytics\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:f,staticGenerationAsyncStorage:E,serverHooks:x,headerHooks:h,staticGenerationBailout:y}=g,v="/api/modelo-portafolio/analytics/route";function _(){return(0,s.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:E})}}};var a=require("../../../../webpack-runtime.js");a.C(e);var o=e=>a(a.s=e),r=a.X(0,[1638,6206,2964,973],()=>o(97667));module.exports=r})();