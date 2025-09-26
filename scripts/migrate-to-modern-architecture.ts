#!/usr/bin/env ts-node
// =====================================================
// 🏠 MIGRACIÓN A ARQUITECTURA MODERNA
// =====================================================
// Script para migrar de arquitectura antigua a moderna
// Eliminando redundancias y duplicaciones
// =====================================================

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhernfrkvwigxdubiozm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =====================================================
// 🧹 FUNCIONES DE MIGRACIÓN
// =====================================================

/**
 * 🗑️ Limpiar tablas antiguas
 */
async function cleanupOldTables(): Promise<void> {
  console.log('🧹 [MIGRATION] Limpiando tablas antiguas...');
  
  try {
    // Eliminar tablas en orden correcto (respetando foreign keys)
    const tablesToDrop = [
      'user_groups',
      'users', 
      'groups'
    ];

    for (const table of tablesToDrop) {
      console.log(`🗑️ Eliminando tabla: ${table}`);
      const { error } = await supabase.rpc('drop_table_if_exists', { table_name: table });
      if (error) {
        console.warn(`⚠️ No se pudo eliminar ${table}:`, error.message);
      }
    }

    console.log('✅ [MIGRATION] Limpieza completada');
  } catch (error) {
    console.error('❌ [MIGRATION] Error en limpieza:', error);
    throw error;
  }
}

/**
 * 🏗️ Crear arquitectura moderna
 */
async function createModernArchitecture(): Promise<void> {
  console.log('🏗️ [MIGRATION] Creando arquitectura moderna...');
  
  try {
    // Leer el archivo SQL de arquitectura moderna
    const sqlPath = path.join(__dirname, '..', 'database_modern_architecture.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Ejecutar SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    if (error) {
      console.error('❌ [MIGRATION] Error ejecutando SQL:', error);
      throw error;
    }

    console.log('✅ [MIGRATION] Arquitectura moderna creada');
  } catch (error) {
    console.error('❌ [MIGRATION] Error creando arquitectura:', error);
    throw error;
  }
}

/**
 * 👤 Crear Super Admin moderno
 */
async function createModernSuperAdmin(): Promise<void> {
  console.log('👤 [MIGRATION] Creando Super Admin moderno...');
  
  try {
    const superAdminEmail = 'admin@iam.com';
    const superAdminPassword = 'admin123';
    const superAdminName = 'Super Administrador';

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true,
      user_metadata: {
        name: superAdminName,
        role: 'super_admin'
      }
    });

    if (authError) {
      console.error('❌ [MIGRATION] Error creando usuario en Auth:', authError);
      throw authError;
    }

    console.log('✅ [MIGRATION] Usuario creado en Auth:', authData.user?.id);

    // 2. Crear perfil en user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user!.id,
        organization_id: '00000000-0000-0000-0000-000000000001', // Organización por defecto
        name: superAdminName,
        role: 'super_admin',
        is_active: true
      });

    if (profileError) {
      console.error('❌ [MIGRATION] Error creando perfil:', profileError);
      throw profileError;
    }

    console.log('✅ [MIGRATION] Perfil creado');

    // 3. Asignar todos los grupos al Super Admin
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id')
      .eq('organization_id', '00000000-0000-0000-0000-000000000001');

    if (groupsError) {
      console.error('❌ [MIGRATION] Error obteniendo grupos:', groupsError);
      throw groupsError;
    }

    if (groups && groups.length > 0) {
      const userGroups = groups.map(group => ({
        user_id: authData.user!.id,
        group_id: group.id,
        is_manager: true // Super Admin es manager de todos los grupos
      }));

      const { error: userGroupsError } = await supabase
        .from('user_groups')
        .insert(userGroups);

      if (userGroupsError) {
        console.error('❌ [MIGRATION] Error asignando grupos:', userGroupsError);
        throw userGroupsError;
      }

      console.log(`✅ [MIGRATION] ${groups.length} grupos asignados al Super Admin`);
    }

    console.log('✅ [MIGRATION] Super Admin creado exitosamente');
    console.log(`📧 Email: ${superAdminEmail}`);
    console.log(`🔑 Password: ${superAdminPassword}`);
    console.log(`👑 Role: super_admin`);
    console.log(`🏢 Organization: AIM Sistema Principal`);

  } catch (error) {
    console.error('❌ [MIGRATION] Error creando Super Admin:', error);
    throw error;
  }
}

/**
 * 🔍 Verificar migración
 */
async function verifyMigration(): Promise<void> {
  console.log('🔍 [MIGRATION] Verificando migración...');
  
  try {
    // Verificar que las tablas modernas existen
    const tables = [
      'organizations',
      'user_profiles', 
      'groups',
      'user_groups',
      'model_profiles',
      'chatter_profiles',
      'products',
      'sales',
      'cash_movements',
      'operating_costs'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ [MIGRATION] Error verificando tabla ${table}:`, error);
        throw error;
      }

      console.log(`✅ [MIGRATION] Tabla ${table} verificada`);
    }

    // Verificar Super Admin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        role,
        organization_id,
        user_groups!inner(
          groups!inner(
            name
          )
        )
      `)
      .eq('role', 'super_admin')
      .single();

    if (superAdminError) {
      console.error('❌ [MIGRATION] Error verificando Super Admin:', superAdminError);
      throw superAdminError;
    }

    if (superAdmin) {
      console.log('✅ [MIGRATION] Super Admin verificado:');
      console.log(`   👤 Nombre: ${superAdmin.name}`);
      console.log(`   👑 Rol: ${superAdmin.role}`);
      console.log(`   🏢 Organización: ${superAdmin.organization_id}`);
      console.log(`   👥 Grupos: ${superAdmin.user_groups.length}`);
    }

    console.log('✅ [MIGRATION] Verificación completada exitosamente');

  } catch (error) {
    console.error('❌ [MIGRATION] Error en verificación:', error);
    throw error;
  }
}

// =====================================================
// 🚀 FUNCIÓN PRINCIPAL DE MIGRACIÓN
// =====================================================

async function migrateToModernArchitecture(): Promise<void> {
  console.log('🏠 [MIGRATION] Iniciando migración a arquitectura moderna...');
  console.log('=====================================================');
  
  try {
    // Paso 1: Limpiar tablas antiguas
    await cleanupOldTables();
    
    // Paso 2: Crear arquitectura moderna
    await createModernArchitecture();
    
    // Paso 3: Crear Super Admin
    await createModernSuperAdmin();
    
    // Paso 4: Verificar migración
    await verifyMigration();
    
    console.log('=====================================================');
    console.log('🎉 [MIGRATION] ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('=====================================================');
    console.log('');
    console.log('✅ Arquitectura moderna implementada');
    console.log('✅ Redundancias eliminadas');
    console.log('✅ Seguridad RLS habilitada');
    console.log('✅ Super Admin creado');
    console.log('✅ Grupos asignados');
    console.log('');
    console.log('🔐 CREDENCIALES DE ACCESO:');
    console.log('   📧 Email: admin@iam.com');
    console.log('   🔑 Password: admin123');
    console.log('   👑 Role: super_admin');
    console.log('');
    console.log('🚀 PRÓXIMO PASO: Probar login moderno');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Error en migración:', error);
    console.log('');
    console.log('🔧 SOLUCIONES POSIBLES:');
    console.log('   1. Verificar variables de entorno');
    console.log('   2. Verificar permisos de Supabase');
    console.log('   3. Verificar conexión a base de datos');
    console.log('   4. Ejecutar migración paso a paso');
    process.exit(1);
  }
}

// =====================================================
// 🎯 EJECUTAR MIGRACIÓN
// =====================================================

if (require.main === module) {
  migrateToModernArchitecture()
    .then(() => {
      console.log('✅ Migración completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}

export { migrateToModernArchitecture };
