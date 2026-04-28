const fs = require('fs');
const path = 'C:/Users/camca/OneDrive/Documentos/navegador/iam-gestion/app/admin/model/anticipos/solicitar/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const newText = `</form>
          </GlassCard>
            )}
          </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && (
          <div className="animate-fade-in-up space-y-4 sm:space-y-6 mt-4">
            {/* Filtros Historial */}
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

            {/* Lista Historial */}
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
        )}`;

code = code.replace(/<\/form>\s*<\/GlassCard>/, newText);
fs.writeFileSync(path, code);
console.log("Fix completed");
