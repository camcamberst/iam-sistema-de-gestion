import { supabaseAdmin, GROUPS_TABLE } from "../lib/supabaseAdmin";
import { DEFAULT_GROUPS } from "../lib/constants";

async function seedGroups() {
  console.log("🌱 Sembrando catálogo de grupos...");
  
  try {
    // Verificar si ya existen grupos
    const { data: existing, error: checkError } = await supabaseAdmin
      .from(GROUPS_TABLE)
      .select("name")
      .in("name", DEFAULT_GROUPS);
    
    if (checkError) {
      console.error("❌ Error verificando grupos existentes:", checkError);
      return;
    }
    
    const existingNames = (existing || []).map(g => g.name);
    const missingGroups = DEFAULT_GROUPS.filter(name => !existingNames.includes(name));
    
    if (missingGroups.length === 0) {
      console.log("✅ Todos los grupos ya existen");
      return;
    }
    
    // Insertar grupos faltantes
    const groupsToInsert = missingGroups.map(name => ({ name }));
    const { data, error } = await supabaseAdmin
      .from(GROUPS_TABLE)
      .insert(groupsToInsert)
      .select();
    
    if (error) {
      console.error("❌ Error insertando grupos:", error);
      return;
    }
    
    console.log(`✅ Grupos insertados: ${data?.length || 0}`);
    console.log("📋 Grupos disponibles:", DEFAULT_GROUPS.join(", "));
    
  } catch (error) {
    console.error("❌ Error en seed:", error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedGroups().then(() => process.exit(0));
}

export { seedGroups };


