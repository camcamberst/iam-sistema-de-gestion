const fs = require('fs');
const path = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/anticipos/solicitar/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Reemplazar router.push al submit del form
code = code.replace(
  /router\.push\('\/model\/anticipos\/solicitudes'\);/g,
  "setActiveTab('historial'); setSuccess(false); loadHistory(user.id);"
);

// 2. Extraer todo el body actual a partir del return de cargar/restricción
// El archivo original usa:
// if (loading) {
// if (!user) {
// return ( <div className="aim-page-bg">

const returnIndex = code.lastIndexOf('return (');
// we'll just rewrite the render block completely

let renderBlock = `
  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-300 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 relative z-10">
      <style jsx>{\`
        /* Dropdown compacto con scrollbar */
        .bank-select {
          max-height: 120px !important;
          overflow-y: auto !important;
        }
        .bank-select::-webkit-scrollbar {
          width: 6px;
        }
        .bank-select::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .bank-select::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .bank-select::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      \`}</style>
        
        <PageHeader
          title="Mis Anticipos"
          subtitle="Solicita o consulta tus anticipos"
          glow="model"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="p-3 sm:p-4 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg max-w-sm">
              <div className="flex items-start sm:items-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300">Política de fechas activa</p>
                  <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-400 mt-0.5">No disponible del 30 al 5 de cada mes</p>
                </div>
              </div>
            </div>
            
            {/* Tabs - Segmented Control */}
            <div className="inline-flex p-1 space-x-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('nueva')}
                className={\`flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 \${activeTab === 'nueva' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'}\`}
              >
                Nueva Solicitud
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={\`flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 \${activeTab === 'historial' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'}\`}
              >
                Mi Historial
              </button>
            </div>
          </div>
        </PageHeader>

        {activeTab === 'nueva' && (
          <div className="animate-fade-in-up">
            {restrictionInfo && !restrictionInfo.allowed ? (
              <GlassCard padding="lg" className="text-center shadow-lg border border-white/10 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-[2rem] max-w-lg mx-auto mt-4 sm:mt-12">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-[0_0_30px_rgba(245,158,11,0.15)] transform -rotate-3">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500/90 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Solicitud No Disponible
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-6 font-medium leading-relaxed">
                  {restrictionInfo.reason}
                </p>
                <div className="bg-white/50 dark:bg-white/[0.04] border border-white/40 dark:border-white/[0.08] backdrop-blur-sm rounded-2xl p-4 sm:p-5 mb-2 transition-all hover:bg-white/60 dark:hover:bg-white/[0.06]">
                  <p className="text-[11px] sm:text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1">
                    Próxima fecha disponible
                  </p>
                  <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                    {restrictionInfo.nextAvailable?.toLocaleDateString('es-CO', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="space-y-4 sm:space-y-6">
`;

// Extrayendo el form bloque original que está después de "if (restrictionInfo"
const parts = code.split('// Mostrar pantalla de restricción');
if(parts.length > 1) {
  let formPart = parts[1];
  let formContentStart = formPart.indexOf('{/* Resumen de Productividad');
  if (formContentStart === -1) {
     formContentStart = formPart.indexOf('<GlassCard');
  }
  
  if (formContentStart > -1) {
    let formContent = formPart.substring(formContentStart);
    // Remover los tags de cierre antiguos
    formContent = formContent.replace(/<\/GlassCard>\s*<\/div>\s*<\/div>\s*\);\s*}\s*$/, '');
    
    // Adjuntar la forma, el cierre y el tab de historial
    renderBlock += formContent;
    renderBlock += \`
              </div>
            )}
          </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && (
          <div className="animate-fade-in-up space-y-4 sm:space-y-6 mt-4">
            <GlassCard padding="none" className="rounded-xl p-3 sm:p-4 overflow-visible relative z-20">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrar por estado:</span>
                <div className="flex-1 sm:flex-initial sm:min-w-[160px] flex items-center gap-2">
                  <AppleDropdown
                    options={[
                      { value: 'pendiente', label: 'Pendientes' },
                      { value: 'aprobado', label: 'Aprobados' },
                      { value: 'rechazado', label: 'Rechazados' },
                      { value: 'realizado', label: 'Realizados' },
                      { value: 'cancelado', label: 'Cancelados' }
                    ]}
                    value={filterStatus}
                    onChange={(v) => setFilterStatus(v as string)}
                    placeholder="Todos"
                    className="w-full text-sm"
                  />
                  {filterStatus !== 'todos' && (
                    <button
                      onClick={() => setFilterStatus('todos')}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Limpiar filtro"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard padding="none" className="rounded-xl overflow-hidden relative z-10">
              {loadingHistory ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
                </div>
              ) : filteredAnticipos.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <div className="text-gray-400 dark:text-gray-500 mb-4">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No hay solicitudes
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No encontramos solicitudes en este estado.
                  </p>
                  <button onClick={() => setActiveTab('nueva')} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 active:scale-95 transition-all text-sm font-medium shadow-md">
                    Crear Solicitud
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredAnticipos.map((anticipo) => (
                    <div key={anticipo.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/20 transition-colors">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <span className={\`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium w-fit \${getStatusColor(anticipo.estado)}\`}>
                            {getStatusText(anticipo.estado)}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {new Date(anticipo.created_at).toLocaleDateString('es-CO', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div className="bg-white/50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-700/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto Transferido</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              \${anticipo.monto_solicitado.toLocaleString('es-CO')} <span className="text-xs font-normal">COP</span>
                            </p>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-700/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Medio de Pago</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              {getPaymentMethodText(anticipo.medio_pago)}
                            </p>
                            {(anticipo.numero_telefono || anticipo.numero_cuenta) && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {anticipo.numero_telefono || anticipo.numero_cuenta}
                              </p>
                            )}
                          </div>
                          <div className="bg-white/50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-700/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estado</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              {anticipo.estado === 'realizado' && anticipo.admin_realizer?.name
                                ? anticipo.admin_realizer.name
                                : anticipo.admin_approver?.name
                                  ? anticipo.admin_approver.name
                                  : anticipo.estado === 'pendiente' ? 'En espera' : '—'}
                            </p>
                          </div>
                        </div>
                        {anticipo.estado === 'pendiente' && (
                          <div className="flex justify-end mt-1">
                            <button
                              onClick={() => handleCancelAnticipo(anticipo.id)}
                              disabled={cancellingId === anticipo.id}
                              className="px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {cancellingId === anticipo.id ? 'Cancelando...' : 'Cancelar solicitud'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
\`;

    const finalCode = parts[0] + renderBlock;
    fs.writeFileSync(path, finalCode);
    console.log("Rewritten page!");
  }
}
