// 🔍 DEBUG: Verificar si group_percentage está llegando como 0
// Ejecutar con: node debug_zero_percentage.js

console.log('🔍 DEBUG: Verificar si group_percentage está llegando como 0');
console.log('='.repeat(60));

// Simular diferentes valores que podrían estar llegando desde la API
const apiResponses = [
  {
    name: 'API Response 1: group_percentage = 60',
    data: { group_percentage: 60, percentage_override: null },
    expected: 60
  },
  {
    name: 'API Response 2: group_percentage = 0',
    data: { group_percentage: 0, percentage_override: null },
    expected: 0
  },
  {
    name: 'API Response 3: group_percentage = "60"',
    data: { group_percentage: "60", percentage_override: null },
    expected: 60
  },
  {
    name: 'API Response 4: group_percentage = "0"',
    data: { group_percentage: "0", percentage_override: null },
    expected: 0
  },
  {
    name: 'API Response 5: group_percentage = null',
    data: { group_percentage: null, percentage_override: null },
    expected: 80
  },
  {
    name: 'API Response 6: group_percentage = undefined',
    data: { group_percentage: undefined, percentage_override: null },
    expected: 80
  }
];

// Función de fallback actual
function calculatePercentage(percentage_override, group_percentage) {
  return percentage_override || group_percentage || 80;
}

// Probar cada respuesta de API
apiResponses.forEach((response, index) => {
  console.log(`\n${index + 1}. ${response.name}`);
  console.log(`   API Data:`, response.data);
  
  const result = calculatePercentage(response.data.percentage_override, response.data.group_percentage);
  console.log(`   Resultado: ${result}`);
  console.log(`   Esperado: ${response.expected}`);
  console.log(`   ✅ Correcto: ${result === response.expected ? 'SÍ' : 'NO'}`);
  
  if (result !== response.expected) {
    console.log(`   ❌ ERROR: Se esperaba ${response.expected} pero se obtuvo ${result}`);
    console.log(`   🔍 ANÁLISIS: ${response.data.group_percentage} es ${typeof response.data.group_percentage}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('🔍 CONCLUSIÓN: Si group_percentage está llegando como 0, el fallback se activa incorrectamente');
console.log('🔍 SOLUCIÓN: Verificar qué está enviando realmente la API');
