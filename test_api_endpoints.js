// Script para probar los endpoints de asignaciones para ambas usuarias

const testAssignments = async () => {
  const baseUrl = 'https://iam-sistema-de-gestion.vercel.app';
  
  const lauraId = 'f0217a65-4ec6-4c9a-b935-758bc2a6831f';
  const elizabethId = 'c8a156fb-1a56-4160-a63d-679c36bda1e7';
  
  console.log('🔍 Probando endpoints de asignaciones...\n');
  
  // Probar Laura Patricia
  console.log('=== LAURA PATRICIA ===');
  try {
    const lauraResponse = await fetch(`${baseUrl}/api/assignments/${lauraId}`);
    const lauraData = await lauraResponse.json();
    console.log('Status:', lauraResponse.status);
    console.log('Response:', JSON.stringify(lauraData, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\n=== ELIZABETH ===');
  try {
    const elizabethResponse = await fetch(`${baseUrl}/api/assignments/${elizabethId}`);
    const elizabethData = await elizabethResponse.json();
    console.log('Status:', elizabethResponse.status);
    console.log('Response:', JSON.stringify(elizabethData, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
};

// Ejecutar si estamos en el navegador
if (typeof window !== 'undefined') {
  testAssignments();
} else {
  console.log('Ejecuta este script en la consola del navegador');
}
