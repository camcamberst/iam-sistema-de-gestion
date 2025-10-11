// =====================================================
// 🔧 CORREGIR LÓGICA DE SUPERFOON EN CALCULADORA
// =====================================================
// Problema: Superfoon no aplica 100% para la modelo
// Problema: Superfoon debe ser EUR, no USD
// =====================================================

// ARCHIVOS A CORREGIR:
// 1. components/AdminModelCalculator.tsx
// 2. app/api/calculator/mi-calculadora-real/route.ts
// 3. app/admin/calculator/view-model/page.tsx
// 4. app/model/calculator/page.tsx

// CAMBIOS REQUERIDOS:

// 1. EN LA SECCIÓN EUR (agregar superfoon):
/*
if (p.currency === 'EUR') {
  if (p.id === 'big7') {
    usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
  } else if (p.id === 'mondo') {
    usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
  } else if (p.id === 'superfoon') {
    usdModelo = p.value * (rates?.eur_usd || 1.01); // EUR a USD directo
  } else {
    usdModelo = p.value * (rates?.eur_usd || 1.01);
  }
}
*/

// 2. EN LA SECCIÓN USD (remover superfoon):
/*
} else if (p.currency === 'USD') {
  if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
    usdModelo = p.value * 0.75;
  } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
    usdModelo = p.value * 0.05;
  } else if (p.id === 'dxlive') {
    usdModelo = p.value * 0.60;
  } else if (p.id === 'secretfriends') {
    usdModelo = p.value * 0.5;
  } else {
    usdModelo = p.value;
  }
}
*/

// 3. DESPUÉS DEL CÁLCULO (agregar lógica especial para superfoon):
/*
// SUPERFOON: Aplicar 100% para la modelo (especial)
if (p.id === 'superfoon') {
  return sum + usdModelo; // 100% directo, sin porcentaje
}

return sum + (usdModelo * p.percentage / 100);
*/

console.log('✅ Instrucciones para corregir Superfoon creadas');
