// 🔍 PRUEBA LOCAL: Lógica de fallback de porcentajes
// Ejecutar con: node test_percentage_logic.js

console.log('🔍 PRUEBA DE LÓGICA DE FALLBACK DE PORCENTAJES');
console.log('='.repeat(50));

// Simular diferentes escenarios de datos
const testCases = [
  {
    name: 'Caso 1: group_percentage = 60, percentage_override = null',
    percentage_override: null,
    group_percentage: 60,
    expected: 60
  },
  {
    name: 'Caso 2: group_percentage = 60, percentage_override = undefined',
    percentage_override: undefined,
    group_percentage: 60,
    expected: 60
  },
  {
    name: 'Caso 3: group_percentage = null, percentage_override = null',
    percentage_override: null,
    group_percentage: null,
    expected: 80
  },
  {
    name: 'Caso 4: group_percentage = undefined, percentage_override = undefined',
    percentage_override: undefined,
    group_percentage: undefined,
    expected: 80
  },
  {
    name: 'Caso 5: group_percentage = 60, percentage_override = 70',
    percentage_override: 70,
    group_percentage: 60,
    expected: 70
  },
  {
    name: 'Caso 6: group_percentage = 0, percentage_override = null',
    percentage_override: null,
    group_percentage: 0,
    expected: 0
  },
  {
    name: 'Caso 7: group_percentage = "", percentage_override = null',
    percentage_override: null,
    group_percentage: "",
    expected: 80
  }
];

// Función de fallback actual (copiada de la calculadora)
function calculatePercentage(percentage_override, group_percentage) {
  return percentage_override || group_percentage || 80;
}

// Probar cada caso
testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: percentage_override=${testCase.percentage_override}, group_percentage=${testCase.group_percentage}`);
  
  const result = calculatePercentage(testCase.percentage_override, testCase.group_percentage);
  console.log(`   Resultado: ${result}`);
  console.log(`   Esperado: ${testCase.expected}`);
  console.log(`   ✅ Correcto: ${result === testCase.expected ? 'SÍ' : 'NO'}`);
  
  if (result !== testCase.expected) {
    console.log(`   ❌ ERROR: Se esperaba ${testCase.expected} pero se obtuvo ${result}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('🔍 ANÁLISIS COMPLETADO');
