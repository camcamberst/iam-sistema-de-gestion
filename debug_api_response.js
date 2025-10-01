// 🔍 DEBUG: Verificar respuesta de API config-v2
// Simular diferentes respuestas de la API

console.log('🔍 DEBUG: Simular respuestas de API config-v2');
console.log('='.repeat(60));

// Simular diferentes respuestas de la API
const apiResponses = [
  {
    name: 'Respuesta API 1: group_percentage = 60',
    response: {
      success: true,
      config: {
        platforms: [{
          id: 'dx-live',
          name: 'DX Live',
          group_percentage: 60,
          percentage_override: null
        }]
      }
    }
  },
  {
    name: 'Respuesta API 2: group_percentage = 0',
    response: {
      success: true,
      config: {
        platforms: [{
          id: 'dx-live',
          name: 'DX Live',
          group_percentage: 0,
          percentage_override: null
        }]
      }
    }
  },
  {
    name: 'Respuesta API 3: group_percentage = null',
    response: {
      success: true,
      config: {
        platforms: [{
          id: 'dx-live',
          name: 'DX Live',
          group_percentage: null,
          percentage_override: null
        }]
      }
    }
  },
  {
    name: 'Respuesta API 4: group_percentage = undefined',
    response: {
      success: true,
      config: {
        platforms: [{
          id: 'dx-live',
          name: 'DX Live',
          percentage_override: null
        }]
      }
    }
  }
];

// Función de fallback actual
function calculatePercentage(percentage_override, group_percentage) {
  return percentage_override || group_percentage || 80;
}

// Probar cada respuesta de API
apiResponses.forEach((apiResponse, index) => {
  console.log(`\n${index + 1}. ${apiResponse.name}`);
  console.log(`   API Response:`, JSON.stringify(apiResponse.response, null, 2));
  
  const platform = apiResponse.response.config.platforms[0];
  const result = calculatePercentage(platform.percentage_override, platform.group_percentage);
  
  console.log(`   Platform data:`, {
    percentage_override: platform.percentage_override,
    group_percentage: platform.group_percentage,
    group_percentage_type: typeof platform.group_percentage
  });
  
  console.log(`   Resultado final: ${result}`);
  
  if (result === 80) {
    console.log(`   ⚠️  PROBLEMA: Se está usando el fallback 80%`);
  } else if (result === 60) {
    console.log(`   ✅ CORRECTO: Se está usando 60%`);
  } else {
    console.log(`   🔍 OTRO: Se está usando ${result}%`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('🔍 CONCLUSIÓN: El problema está en qué está enviando la API');
console.log('🔍 PRÓXIMO PASO: Verificar logs de la API en el navegador');
