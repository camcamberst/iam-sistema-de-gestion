// Script para debuggear Mi Portafolio
console.log('🔍 Debugging Mi Portafolio...');

// Verificar si la página existe
fetch('/model/portafolio')
  .then(response => {
    console.log('📄 Status de /model/portafolio:', response.status);
    if (response.status === 200) {
      console.log('✅ Página Mi Portafolio existe');
    } else {
      console.log('❌ Página Mi Portafolio no existe o hay error');
    }
  })
  .catch(error => {
    console.log('❌ Error accediendo a Mi Portafolio:', error);
  });

// Verificar si la API existe
fetch('/api/modelo-portafolio?modelId=test')
  .then(response => {
    console.log('🔌 Status de API /api/modelo-portafolio:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('📊 Respuesta de API:', data);
  })
  .catch(error => {
    console.log('❌ Error en API:', error);
  });

console.log('🔍 Verificando menú...');
// Verificar si el menú tiene Mi Portafolio
const menuItems = document.querySelectorAll('[data-menu-item]');
console.log('📋 Elementos del menú encontrados:', menuItems.length);

// Buscar específicamente "Mi Portafolio"
const portafolioLink = document.querySelector('a[href="/model/portafolio"]');
if (portafolioLink) {
  console.log('✅ Enlace "Mi Portafolio" encontrado en el menú');
} else {
  console.log('❌ Enlace "Mi Portafolio" NO encontrado en el menú');
}
