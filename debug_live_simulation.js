// 🔍 DEBUG: Simulación en vivo del problema
// Simular exactamente lo que está pasando en la aplicación

console.log('🔍 DEBUG: Simulación en vivo del problema de porcentajes');
console.log('='.repeat(70));

// Simular el flujo completo: Admin configura 60% → API → Calculadora
const scenarios = [
  {
    name: 'Escenario 1: Admin configura 60% correctamente',
    adminConfig: { groupPercentage: 60 },
    databaseValue: 60,
    apiResponse: { group_percentage: 60 },
    expected: 60
  },
  {
    name: 'Escenario 2: Admin configura 60% pero se guarda como 0',
    adminConfig: { groupPercentage: 60 },
    databaseValue: 0,
    apiResponse: { group_percentage: 0 },
    expected: 80
  },
  {
    name: 'Escenario 3: Admin configura 60% pero se guarda como null',
    adminConfig: { groupPercentage: 60 },
    databaseValue: null,
    apiResponse: { group_percentage: null },
    expected: 80
  },
  {
    name: 'Escenario 4: Admin configura 60% pero se guarda como undefined',
    adminConfig: { groupPercentage: 60 },
    databaseValue: undefined,
    apiResponse: { group_percentage: undefined },
    expected: 80
  }
];

// Función de fallback actual
function calculatePercentage(percentage_override, group_percentage) {
  return percentage_override || group_percentage || 80;
}

// Simular cada escenario
scenarios.forEach((scenario, index) => {
  console.log(`\n${index + 1}. ${scenario.name}`);
  console.log(`   Admin configura: ${scenario.adminConfig.groupPercentage}%`);
  console.log(`   Se guarda en DB como: ${scenario.databaseValue} (${typeof scenario.databaseValue})`);
  console.log(`   API responde con: ${scenario.apiResponse.group_percentage} (${typeof scenario.apiResponse.group_percentage})`);
  
  const result = calculatePercentage(null, scenario.apiResponse.group_percentage);
  console.log(`   Calculadora recibe: ${result}%`);
  console.log(`   Esperado: ${scenario.expected}%`);
  
  if (result === scenario.expected) {
    console.log(`   ✅ CORRECTO`);
  } else {
    console.log(`   ❌ ERROR: Se esperaba ${scenario.expected}% pero se obtuvo ${result}%`);
    console.log(`   🔍 CAUSA: El problema está en el paso de guardado en la base de datos`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('🔍 CONCLUSIÓN: El problema está en el guardado en la base de datos');
console.log('🔍 PRÓXIMO PASO: Verificar qué se está guardando realmente en calculator_config');
console.log('🔍 ACCIÓN: Ejecutar debug_elizabeth_config.sql en Supabase');
