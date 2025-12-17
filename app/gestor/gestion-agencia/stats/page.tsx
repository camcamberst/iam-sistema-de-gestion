"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Model {
  id: string;
  name: string;
  email: string;
  clave?: string;
}

interface Platform {
  id: string;
  name: string;
  currency: string;
}

interface Group {
  id: string;
  name: string;
}

interface IngresoRegistro {
  model_id: string;
  platform_id: string;
  periodo_type: '1-15' | '16-31';
  valor_p1?: number;
  valor_p2?: number;
}

export default function GestorStatsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<{
    year: number;
    month: number;
  }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [registros, setRegistros] = useState<Record<string, Record<string, IngresoRegistro>>>({});
  const [editingCell, setEditingCell] = useState<{
    modelId: string;
    platformId: string;
    periodType: '1-15' | '16-31';
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [generatingSheet, setGeneratingSheet] = useState(false);
  const [sheetExists, setSheetExists] = useState<boolean | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadData();
    }
  }, [selectedPeriod, selectedGroup]);

  const loadGroups = async () => {
    try {
      // Cargar grupos/sedes disponibles
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (groupsData) {
        setGroups(groupsData as Group[]);
        // Seleccionar el primer grupo por defecto si hay grupos disponibles
        if (groupsData.length > 0 && !selectedGroup) {
          setSelectedGroup(groupsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  };

  const loadData = async () => {
    if (!selectedGroup) {
      setModels([]);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 [GESTOR STATS] Cargando datos para grupo:', selectedGroup);
      
      // Obtener los IDs de usuarios que pertenecen al grupo seleccionado
      const { data: userGroupsData, error: userGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', selectedGroup);

      if (userGroupsError) {
        console.error('❌ [GESTOR STATS] Error obteniendo user_groups:', userGroupsError);
        alert('Error al cargar usuarios del grupo: ' + userGroupsError.message);
        setModels([]);
        setLoading(false);
        return;
      }

      console.log('📊 [GESTOR STATS] Usuarios en el grupo:', userGroupsData?.length || 0);

      if (!userGroupsData || userGroupsData.length === 0) {
        console.log('⚠️ [GESTOR STATS] No hay usuarios en el grupo seleccionado');
        setModels([]);
        setLoading(false);
        return;
      }

      const userIds = userGroupsData.map(ug => ug.user_id);
      console.log('👥 [GESTOR STATS] IDs de usuarios encontrados:', userIds.length);
      console.log('👥 [GESTOR STATS] IDs específicos:', userIds);

      // Primero verificar qué usuarios hay y sus roles
      const { data: allUsersInGroup, error: allUsersError } = await supabase
        .from('users')
        .select('id, name, email, role, is_active')
        .in('id', userIds);

      if (allUsersError) {
        console.error('❌ [GESTOR STATS] Error obteniendo todos los usuarios:', allUsersError);
      } else {
        console.log('👥 [GESTOR STATS] Todos los usuarios del grupo:', allUsersInGroup);
        console.log('👥 [GESTOR STATS] Usuarios por rol:', 
          allUsersInGroup?.reduce((acc: any, u: any) => {
            acc[u.role] = (acc[u.role] || 0) + 1;
            return acc;
          }, {})
        );
        console.log('👥 [GESTOR STATS] Usuarios activos:', allUsersInGroup?.filter((u: any) => u.is_active).length);
        console.log('👥 [GESTOR STATS] Usuarios con rol modelo:', allUsersInGroup?.filter((u: any) => u.role === 'modelo').length);
      }

      // Cargar solo usuarios con rol 'modelo' que pertenecen al grupo
      const { data: modelsData, error: modelsError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'modelo')
        .eq('is_active', true)
        .in('id', userIds)
        .order('name');

      if (modelsError) {
        console.error('❌ [GESTOR STATS] Error obteniendo modelos:', modelsError);
        alert('Error al cargar modelos: ' + modelsError.message);
        setModels([]);
        setLoading(false);
        return;
      }

      console.log('✅ [GESTOR STATS] Modelos encontrados:', modelsData?.length || 0);

      if (modelsData) {
        setModels(modelsData as Model[]);
      } else {
        setModels([]);
      }

      // Cargar plataformas
      const { data: platformsData, error: platformsError } = await supabase
        .from('calculator_platforms')
        .select('id, name, currency')
        .eq('active', true)
        .order('name');

      if (platformsError) {
        console.error('❌ [GESTOR STATS] Error obteniendo plataformas:', platformsError);
      } else {
        console.log('📱 [GESTOR STATS] Plataformas cargadas:', platformsData?.length || 0);
      }

      if (platformsData) {
        setPlatforms(platformsData as Platform[]);
      }

      // Cargar registros existentes del gestor desde gestor_stats_values
      // Cargar ambos períodos (P1 y P2) del mes seleccionado
      const periodDateP1 = `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-01`;
      const periodDateP2 = `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-16`;
      
      const { data: registrosData, error: registrosError } = await supabase
        .from('gestor_stats_values')
        .select('*')
        .eq('group_id', selectedGroup)
        .in('period_date', [periodDateP1, periodDateP2])
        .in('period_type', ['1-15', '16-31']);

      if (registrosError) {
        console.error('❌ [GESTOR STATS] Error obteniendo registros:', registrosError);
      } else {
        console.log('📝 [GESTOR STATS] Registros encontrados:', registrosData?.length || 0);
      }

      if (registrosData) {
        // Organizar registros por modelo y plataforma
        const registrosMap: Record<string, Record<string, IngresoRegistro>> = {};
        registrosData.forEach((reg: any) => {
          const key = `${reg.model_id}_${reg.platform_id}`;
          if (!registrosMap[key]) {
            registrosMap[key] = {};
          }
          registrosMap[key][reg.period_type] = {
            model_id: reg.model_id,
            platform_id: reg.platform_id,
            periodo_type: reg.period_type,
            valor_p1: reg.period_type === '1-15' ? parseFloat(reg.value) : undefined,
            valor_p2: reg.period_type === '16-31' ? parseFloat(reg.value) : undefined
          };
        });
        setRegistros(registrosMap);
        setSheetExists(registrosData.length > 0);
      } else {
        setSheetExists(false);
      }

      // Verificar si existe la planilla para este mes
      const { data: sheetCheck } = await supabase
        .from('gestor_stats_values')
        .select('id')
        .eq('group_id', selectedGroup)
        .in('period_date', [periodDateP1, periodDateP2])
        .limit(1)
        .single();
      
      setSheetExists(sheetCheck !== null);

    } catch (error) {
      console.error('Error cargando datos:', error);
      setSheetExists(null);
    } finally {
      setLoading(false);
    }
  };

  const generateSheet = async () => {
    if (!selectedGroup) {
      alert('Por favor selecciona un grupo primero');
      return;
    }

    try {
      setGeneratingSheet(true);
      const response = await fetch('/api/gestor/stats/generate-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: selectedPeriod.year,
          month: selectedPeriod.month,
          groupId: selectedGroup
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error generando planilla');
      }

      alert(`Planilla generada exitosamente. ${result.recordsCreated || 0} registros creados.`);
      // Recargar datos después de un pequeño delay para asegurar que la BD se actualizó
      setTimeout(async () => {
        await loadData();
      }, 500);
    } catch (error: any) {
      console.error('Error generando planilla:', error);
      alert('Error generando planilla: ' + error.message);
    } finally {
      setGeneratingSheet(false);
    }
  };

  const handleCellClick = (modelId: string, platformId: string, periodType: '1-15' | '16-31') => {
    const key = `${modelId}_${platformId}`;
    const currentValue = registros[key]?.[periodType]?.valor_p1 || registros[key]?.[periodType]?.valor_p2 || '';
    setEditingCell({ modelId, platformId, periodType });
    setEditValue(currentValue.toString());
  };

  const handleCellSave = async () => {
    if (!editingCell || !selectedGroup) return;

    const { modelId, platformId, periodType } = editingCell;
    const key = `${modelId}_${platformId}`;
    const value = parseFloat(editValue) || 0;

    // Determinar periodDate según el período
    const periodDate = periodType === '1-15' 
      ? `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-01`
      : `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-16`;

    try {
      // Guardar en la base de datos
      const response = await fetch('/api/gestor/stats/save-value', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          platformId,
          periodDate,
          periodType,
          value,
          groupId: selectedGroup
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error guardando valor');
      }

      // Actualizar estado local solo si se guardó correctamente
      setRegistros(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          [periodType]: {
            model_id: modelId,
            platform_id: platformId,
            periodo_type: periodType,
            ...(periodType === '1-15' ? { valor_p1: value } : { valor_p2: value })
          }
        }
      }));

      setEditingCell(null);
      setEditValue('');
    } catch (error: any) {
      console.error('❌ [GESTOR STATS] Error guardando valor:', error);
      alert('Error guardando valor: ' + error.message);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const formatCurrency = (value: number, currency: string) => {
    if (!value || value === 0) return '-';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getCellValue = (modelId: string, platformId: string, periodType: '1-15' | '16-31') => {
    const key = `${modelId}_${platformId}`;
    const registro = registros[key]?.[periodType];
    if (periodType === '1-15') {
      return registro?.valor_p1 || '';
    } else {
      return registro?.valor_p2 || '';
    }
  };

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-gray-400 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Stats - Registro de Ingresos
                  </h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Registra los ingresos exactos de cada modelo al finalizar el período
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sede/Grupo
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]"
              >
                <option value="">Seleccionar sede/grupo</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Año
              </label>
              <select
                value={selectedPeriod.year}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mes
              </label>
              <select
                value={selectedPeriod.month}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {months.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              {sheetExists === false && (
                <button
                  onClick={generateSheet}
                  disabled={generatingSheet}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {generatingSheet ? 'Generando...' : 'Generar Planilla'}
                </button>
              )}
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Recargar Datos
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Exportar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla Consolidada */}
        {!selectedGroup ? (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Por favor selecciona una sede/grupo para ver la planilla
            </p>
          </div>
        ) : models.length === 0 ? (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              No hay modelos asignados a esta sede/grupo
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verifica que haya modelos activos asignados al grupo &quot;{groups.find(g => g.id === selectedGroup)?.name || 'seleccionado'}&quot;
            </p>
          </div>
        ) : platforms.length === 0 ? (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              No hay plataformas activas en el sistema
            </p>
          </div>
        ) : (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-b-2 border-gray-300 dark:border-gray-500">
                <tr>
                  {/* Columnas fijas */}
                  <th className="sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-2 py-1 text-xs text-left font-semibold text-gray-700 dark:text-white border-r-2 border-gray-300 dark:border-gray-500 w-[100px] whitespace-nowrap">
                    Clave
                  </th>
                  <th className="sticky left-[100px] z-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-2 py-1 text-xs text-left font-semibold text-gray-700 dark:text-white border-r-2 border-gray-300 dark:border-gray-500 w-[150px] whitespace-nowrap">
                    Usuario
                  </th>
                  
                  {/* Columnas dinámicas por plataforma */}
                  {platforms.map(platform => (
                    <th
                      key={platform.id}
                      className="px-2 py-1 text-xs text-center font-semibold text-gray-700 dark:text-white border-r border-gray-200 dark:border-gray-600 min-w-[120px]"
                      colSpan={2}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">{platform.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{platform.currency}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {/* Sub-header para P1 y P2 */}
                  <th className="sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-2 py-1 border-r-2 border-gray-300 dark:border-gray-500 w-[100px]"></th>
                  <th className="sticky left-[100px] z-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-2 py-1 border-r-2 border-gray-300 dark:border-gray-500 w-[150px]"></th>
                  {platforms.map(platform => (
                    <React.Fragment key={platform.id}>
                      <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                        P1
                      </th>
                      <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                        P2
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {models.map((model) => (
                  <tr
                    key={model.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Columnas fijas */}
                    <td className="sticky left-0 z-20 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-900 dark:text-white border-r-2 border-gray-300 dark:border-gray-500 w-[100px] whitespace-nowrap">
                      {model.clave || model.name}
                    </td>
                    <td className="sticky left-[100px] z-20 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 border-r-2 border-gray-300 dark:border-gray-500 w-[150px] whitespace-nowrap">
                      {model.email?.split('@')[0] || model.email}
                    </td>

                    {/* Celdas por plataforma */}
                    {platforms.map(platform => (
                      <React.Fragment key={platform.id}>
                        {/* P1 */}
                        <td
                          className="px-2 py-1 text-xs text-center border-r border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-nowrap"
                          onClick={() => handleCellClick(model.id, platform.id, '1-15')}
                        >
                          {editingCell?.modelId === model.id &&
                          editingCell?.platformId === platform.id &&
                          editingCell?.periodType === '1-15' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave();
                                  if (e.key === 'Escape') handleCellCancel();
                                }}
                                className="w-full px-1 py-0.5 text-xs border rounded text-gray-900 dark:text-white dark:bg-gray-700"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300 text-xs">
                              {getCellValue(model.id, platform.id, '1-15') || '-'}
                            </span>
                          )}
                        </td>
                        {/* P2 */}
                        <td
                          className="px-2 py-1 text-xs text-center border-r border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-nowrap"
                          onClick={() => handleCellClick(model.id, platform.id, '16-31')}
                        >
                          {editingCell?.modelId === model.id &&
                          editingCell?.platformId === platform.id &&
                          editingCell?.periodType === '16-31' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave();
                                  if (e.key === 'Escape') handleCellCancel();
                                }}
                                className="w-full px-1 py-0.5 text-xs border rounded text-gray-900 dark:text-white dark:bg-gray-700"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300 text-xs">
                              {getCellValue(model.id, platform.id, '16-31') || '-'}
                            </span>
                          )}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Instrucciones:</strong> Haz clic en cualquier celda para ingresar o editar valores. 
            Los datos se guardan automáticamente al hacer clic fuera de la celda o presionar Enter. 
            Después de guardar, los administradores serán notificados para realizar la auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}

