const fs = require('fs');
const path = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/anticipos/solicitar/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// The marker
const marker = "// Mostrar pantalla de restricción si no está permitido solicitar anticipo";
const markerIndex = code.indexOf(marker);

if (markerIndex > -1) {
    let beforeRender = code.substring(0, markerIndex);
    
    // Insert new UI String using fs.readFileSync of a text file we define to avoid JS string escaping issues.
}
