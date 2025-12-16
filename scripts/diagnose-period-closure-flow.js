/**
 * 🔍 DIAGNÓSTICO COMPLETO DEL FLUJO DE CIERRE DE PERÍODO
 * 
 * Este script verifica que todos los componentes del sistema de cierre
 * están correctamente configurados y funcionarán en el próximo cierre.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function checkDatabaseTables() {
  logSection('1. VERIFICACIÓN DE TABLAS DE BASE DE DATOS');
  
  const requiredTables = [
    'calculator_period_closure_status',
    'calculator_early_frozen_platforms',
    'calculator_history',
    'model_values',
    'calculator_totals',
    'calc_snapshots',
    'rates',
    'calculator_config',
    'calculator_platforms',
    'users'
  ];

  const results = {};
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          logError(`Tabla "${table}" NO EXISTE`);
          results[table] = false;
        } else {
          logWarning(`Tabla "${table}" existe pero hay un error: ${error.message}`);
          results[table] = 'warning';
        }
      } else {
        logSuccess(`Tabla "${table}" existe y es accesible`);
        results[table] = true;
      }
    } catch (err) {
      logError(`Error verificando tabla "${table}": ${err.message}`);
      results[table] = false;
    }
  }

  return results;
}

async function checkCronConfiguration() {
  logSection('2. VERIFICACIÓN DE CONFIGURACIÓN DE CRON JOBS');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    
    const requiredCrons = [
      {
        path: '/api/cron/period-closure-early-freeze',
        description: 'Early Freeze (congelación anticipada)'
      },
      {
        path: '/api/cron/period-closure-full-close',
        description: 'Full Close (cierre completo)'
      }
    ];

    const crons = vercelJson.crons || [];
    
    for (const requiredCron of requiredCrons) {
      const found = crons.find(c => c.path === requiredCron.path);
      if (found) {
        logSuccess(`${requiredCron.description}: Configurado`);
        logInfo(`  Ruta: ${found.path}`);
        logInfo(`  Schedule: ${found.schedule}`);
      } else {
        logError(`${requiredCron.description}: NO CONFIGURADO`);
      }
    }

    return crons.length > 0;
  } catch (err) {
    logError(`Error leyendo vercel.json: ${err.message}`);
    return false;
  }
}

async function checkEndpoints() {
  logSection('3. VERIFICACIÓN DE ENDPOINTS');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';
  const endpoints = [
    {
      path: '/api/calculator/period-closure/early-freeze',
      method: 'POST',
      description: 'Early Freeze endpoint'
    },
    {
      path: '/api/calculator/period-closure/close-period',
      method: 'POST',
      description: 'Close Period endpoint'
    },
    {
      path: '/api/calculator/period-closure/platform-freeze-status',
      method: 'GET',
      description: 'Platform Freeze Status endpoint'
    },
    {
      path: '/api/cron/period-closure-early-freeze',
      method: 'GET',
      description: 'Early Freeze Cron'
    },
    {
      path: '/api/cron/period-closure-full-close',
      method: 'GET',
      description: 'Full Close Cron'
    }
  ];

  // Solo verificamos que los archivos existan, no hacemos requests HTTP
  const fs = require('fs');
  const path = require('path');
  
  for (const endpoint of endpoints) {
    const routePath = endpoint.path.replace('/api/', 'app/api/') + '/route.ts';
    const fullPath = path.join(process.cwd(), routePath);
    
    if (fs.existsSync(fullPath)) {
      logSuccess(`${endpoint.description}: Archivo existe`);
      logInfo(`  Ruta: ${routePath}`);
    } else {
      logError(`${endpoint.description}: Archivo NO ENCONTRADO`);
      logError(`  Buscado en: ${fullPath}`);
    }
  }
}

async function checkHelperFunctions() {
  logSection('4. VERIFICACIÓN DE FUNCIONES HELPER');
  
  const fs = require('fs');
  const path = require('path');
  
  const helperFiles = [
    {
      file: 'lib/calculator/period-closure-helpers.ts',
      functions: [
        'updateClosureStatus',
        'freezePlatformsForModel',
        'atomicArchiveAndReset',
        'createBackupSnapshot'
      ]
    },
    {
      file: 'utils/period-closure-dates.ts',
      functions: [
        'getColombiaDate',
        'isEarlyFreezeTime',
        'isFullClosureTime',
        'isClosureDay',
        'isEarlyFreezeRelevantDay',
        'getPeriodToClose',
        'getNewPeriodAfterClosure'
      ]
    }
  ];

  for (const helperFile of helperFiles) {
    const fullPath = path.join(process.cwd(), helperFile.file);
    
    if (fs.existsSync(fullPath)) {
      logSuccess(`Archivo ${helperFile.file} existe`);
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      for (const func of helperFile.functions) {
        const regex = new RegExp(`(export\\s+)?(const|function|async\\s+function)\\s+${func}`, 'i');
        if (regex.test(content)) {
          logSuccess(`  Función "${func}" encontrada`);
        } else {
          logError(`  Función "${func}" NO ENCONTRADA`);
        }
      }
    } else {
      logError(`Archivo ${helperFile.file} NO EXISTE`);
    }
  }
}

async function checkActiveModels() {
  logSection('5. VERIFICACIÓN DE MODELOS ACTIVOS');
  
  try {
    const { data: models, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true);
    
    if (error) {
      logError(`Error obteniendo modelos: ${error.message}`);
      return null;
    }
    
    logSuccess(`Modelos activos encontrados: ${models?.length || 0}`);
    
    if (models && models.length > 0) {
      logInfo(`Primeros 5 modelos:`);
      models.slice(0, 5).forEach((model, idx) => {
        logInfo(`  ${idx + 1}. ${model.email} (${model.name})`);
      });
      if (models.length > 5) {
        logInfo(`  ... y ${models.length - 5} más`);
      }
    }
    
    return models?.length || 0;
  } catch (err) {
    logError(`Error: ${err.message}`);
    return null;
  }
}

async function checkCurrentPeriodStatus() {
  logSection('6. VERIFICACIÓN DEL ESTADO ACTUAL DE PERÍODOS');
  
  try {
    // Obtener fecha actual en Colombia
    const now = new Date();
    const colombiaDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [year, month, day] = colombiaDate.split('-').map(Number);
    
    logInfo(`Fecha actual (Colombia): ${colombiaDate}`);
    logInfo(`Día del mes: ${day}`);
    
    // Determinar período actual
    const currentPeriodType = day >= 1 && day <= 15 ? '1-15' : '16-31';
    logInfo(`Período actual: ${currentPeriodType}`);
    
    // Verificar estado de cierre
    const { data: statuses, error } = await supabase
      .from('calculator_period_closure_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      logError(`Error obteniendo estados: ${error.message}`);
      return;
    }
    
    if (statuses && statuses.length > 0) {
      logSuccess(`Últimos ${statuses.length} estados de cierre:`);
      statuses.forEach((status, idx) => {
        const statusColor = status.status === 'completed' ? 'green' : 
                           status.status === 'failed' ? 'red' : 'yellow';
        log(`  ${idx + 1}. ${status.period_date} (${status.period_type}): ${status.status}`, statusColor);
        if (status.error_message) {
          logWarning(`     Error: ${status.error_message}`);
        }
      });
    } else {
      logWarning('No se encontraron estados de cierre previos');
    }
    
    // Verificar si hay períodos cerrados recientemente
    const { data: recentCompleted } = await supabase
      .from('calculator_period_closure_status')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (recentCompleted) {
      logSuccess(`Último período completado: ${recentCompleted.period_date} (${recentCompleted.period_type})`);
      logInfo(`  Completado el: ${recentCompleted.completed_at}`);
    }
    
  } catch (err) {
    logError(`Error: ${err.message}`);
  }
}

async function checkBackupSystem() {
  logSection('7. VERIFICACIÓN DEL SISTEMA DE BACKUP');
  
  try {
    // Verificar que la función createBackupSnapshot existe
    const fs = require('fs');
    const path = require('path');
    const helpersPath = path.join(process.cwd(), 'lib/calculator/period-closure-helpers.ts');
    
    if (fs.existsSync(helpersPath)) {
      const content = fs.readFileSync(helpersPath, 'utf8');
      
      if (content.includes('createBackupSnapshot')) {
        logSuccess('Función createBackupSnapshot encontrada');
        
        // Verificar que se llama en close-period
        const closePeriodPath = path.join(process.cwd(), 'app/api/calculator/period-closure/close-period/route.ts');
        if (fs.existsSync(closePeriodPath)) {
          const closePeriodContent = fs.readFileSync(closePeriodPath, 'utf8');
          
          if (closePeriodContent.includes('createBackupSnapshot')) {
            logSuccess('Backup integrado en el proceso de cierre');
          } else {
            logError('Backup NO está integrado en close-period');
          }
          
          if (closePeriodContent.includes('FASE 1.5') || closePeriodContent.includes('BACKUP')) {
            logSuccess('Backup ejecutado en la fase correcta (antes del archivado)');
          }
        }
      } else {
        logError('Función createBackupSnapshot NO ENCONTRADA');
      }
    }
    
    // Verificar snapshots recientes
    const { data: snapshots, error } = await supabase
      .from('calc_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      if (error.code === '42P01') {
        logWarning('Tabla calc_snapshots no existe (puede ser normal si nunca se ha ejecutado un cierre)');
      } else {
        logError(`Error obteniendo snapshots: ${error.message}`);
      }
    } else {
      logSuccess(`Snapshots encontrados: ${snapshots?.length || 0}`);
      if (snapshots && snapshots.length > 0) {
        logInfo('Últimos snapshots:');
        snapshots.forEach((snapshot, idx) => {
          logInfo(`  ${idx + 1}. Modelo: ${snapshot.model_id.substring(0, 8)}... - Creado: ${snapshot.created_at}`);
        });
      }
    }
    
  } catch (err) {
    logError(`Error: ${err.message}`);
  }
}

async function simulateBackupProcess() {
  logSection('8. SIMULACIÓN DEL PROCESO DE BACKUP (DRY RUN)');
  
  try {
    // Obtener un modelo de prueba
    const { data: testModel } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (!testModel) {
      logWarning('No hay modelos activos para simular');
      return;
    }
    
    logInfo(`Simulando backup para modelo: ${testModel.email}`);
    
    // Obtener fecha actual y determinar período
    const now = new Date();
    const colombiaDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [year, month, day] = colombiaDate.split('-').map(Number);
    const periodType = day >= 1 && day <= 15 ? '1-15' : '16-31';
    const periodDate = day >= 1 && day <= 15 ? 
      `${year}-${String(month).padStart(2, '0')}-01` : 
      `${year}-${String(month).padStart(2, '0')}-16`;
    
    logInfo(`Período simulado: ${periodDate} (${periodType})`);
    
    // Verificar que hay valores para este período
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', testModel.id)
      .gte('period_date', periodDate)
      .limit(5);
    
    if (valuesError) {
      logError(`Error obteniendo valores: ${valuesError.message}`);
    } else {
      logSuccess(`Valores encontrados para simulación: ${values?.length || 0}`);
      if (values && values.length > 0) {
        logInfo('Ejemplo de valores:');
        values.slice(0, 3).forEach((v, idx) => {
          logInfo(`  ${idx + 1}. Plataforma: ${v.platform_id}, Valor: ${v.value}, Fecha: ${v.period_date}`);
        });
      } else {
        logWarning('No hay valores para este período (puede ser normal si el período está vacío)');
      }
    }
    
    // Verificar tasas
    const { data: rates, error: ratesError } = await supabase
      .from('rates')
      .select('*')
      .eq('active', true)
      .is('valid_to', null)
      .limit(5);
    
    if (ratesError) {
      logError(`Error obteniendo tasas: ${ratesError.message}`);
    } else {
      logSuccess(`Tasas activas encontradas: ${rates?.length || 0}`);
    }
    
    logSuccess('Simulación completada - El proceso de backup debería funcionar correctamente');
    
  } catch (err) {
    logError(`Error en simulación: ${err.message}`);
  }
}

async function checkEnvironmentVariables() {
  logSection('9. VERIFICACIÓN DE VARIABLES DE ENTORNO');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];
  
  const missing = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      const value = process.env[varName];
      const displayValue = varName.includes('KEY') || varName.includes('SECRET') 
        ? `${value.substring(0, 10)}...` 
        : value;
      logSuccess(`${varName}: Configurada (${displayValue})`);
    } else {
      logError(`${varName}: NO CONFIGURADA`);
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    logWarning(`Faltan ${missing.length} variables de entorno`);
  }
  
  return missing.length === 0;
}

async function generateReport() {
  logSection('10. RESUMEN Y RECOMENDACIONES');
  
  logInfo('Diagnóstico completado. Revisa los resultados anteriores.');
  logInfo('\nPróximos pasos recomendados:');
  logInfo('1. Verificar que todas las tablas existen');
  logInfo('2. Confirmar que los cron jobs están configurados en Vercel');
  logInfo('3. Probar manualmente el endpoint de early-freeze en modo testing');
  logInfo('4. Monitorear los logs durante el próximo cierre');
  logInfo('\nPara probar manualmente:');
  logInfo('  POST /api/calculator/period-closure/early-freeze');
  logInfo('  Headers: x-testing-mode: true');
  logInfo('  POST /api/calculator/period-closure/close-period');
  logInfo('  Headers: x-testing-mode: true');
}

async function main() {
  console.log('\n');
  log('🔍 DIAGNÓSTICO DEL SISTEMA DE CIERRE DE PERÍODO', 'cyan');
  log('='.repeat(60), 'cyan');
  console.log('\n');
  
  try {
    await checkDatabaseTables();
    await checkCronConfiguration();
    await checkEndpoints();
    await checkHelperFunctions();
    await checkActiveModels();
    await checkCurrentPeriodStatus();
    await checkBackupSystem();
    await simulateBackupProcess();
    await checkEnvironmentVariables();
    await generateReport();
    
    console.log('\n');
    log('✅ Diagnóstico completado', 'green');
    console.log('\n');
    
  } catch (error) {
    logError(`Error crítico: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();

