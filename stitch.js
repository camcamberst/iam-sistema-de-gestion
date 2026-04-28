const fs = require('fs');

const pathTsx = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/anticipos/solicitar/page.tsx';
const pathUi = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/ui_block.txt';

let code = fs.readFileSync(pathTsx, 'utf8');
let uiBlock = fs.readFileSync(pathUi, 'utf8');

// The marker
const marker = "// Mostrar pantalla de restricción si no está permitido solicitar anticipo";
const markerIndex = code.indexOf(marker);

if (markerIndex > -1) {
    let beforeRender = code.substring(0, markerIndex);
    
    // Find the end of the form by looking for 'onSubmit={handleSubmit}'
    let formPart = code.substring(markerIndex);
    
    // The original file has `<div className="mt-8 text-center sm:text-left">` inside the form? Wait. No, it's just `<form`.
    // Let's grab the form block:
    let formBlockStart = formPart.indexOf('<GlassCard glow="model" padding="none"');
    if (formBlockStart === -1) {
        // Fallback or early return
        console.log("Could not find Productivity block in form. using fallback.");
        formBlockStart = formPart.indexOf('{/* Resumen de Productividad');
    }
    
    if (formBlockStart > -1) {
        let formContent = formPart.substring(formBlockStart);
        
        // Remove the old closing brackets:
        //            </form>
        //            </div>
        //          </div>
        //        );
        //      }
        formContent = formContent.replace(/<\/div>\s*<\/div>\s*\);\s*}\s*$/, '');
        
        // Inject the form inside our ui_block placeholder
        let finalUi = uiBlock.replace('                <!-- FORM PLACEHOLDER -->', formContent);
        
        let finalCode = beforeRender + finalUi;
        fs.writeFileSync(pathTsx, finalCode);
        console.log("Stitching complete!");
    } else {
        console.log("Could not find the form block inside page.tsx!");
    }
} else {
    console.log("Marker not found!");
}
