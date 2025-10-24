"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppleDropdown from '@/components/ui/AppleDropdown';
import { supabase } from '@/lib/supabase';

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    role: "modelo", 
    groups: [] as string[],
    room_id: "",
    jornada: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<{id:string; name:string}>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [openGroups, setOpenGroups] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Array<{id: string, room_name: string}>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<{role: string, groups: string[]} | null>(null);

  // Función para determinar si un grupo requiere rooms obligatorios
  const groupRequiresRooms = (groupName: string): boolean => {
    // Solo "Sede MP" requiere rooms obligatorios
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Función para determinar si un grupo requiere jornada obligatoria
  const groupRequiresJornada = (groupName: string): boolean => {
    // Solo "Sede MP" requiere jornada obligatoria
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === form.groups[0])?.name || '';

  useEffect(() => {
    const loadUserAndGroups = async () => {
      try {
        setLoadingGroups(true);
        
        // Cargar usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select(`
                role,
                user_groups(
                  groups!inner(
                    id,
                    name
                  )
                )
              `)
              .eq('id', user.id)
              .single();
            
            if (error) {
              console.error('Error obteniendo datos del usuario:', error);
              // Fallback: usar datos básicos
              setCurrentUser({
                role: 'admin', // Asumir admin por defecto
                groups: []
              });
            } else if (userData) {
              const userGroups = userData.user_groups?.map((ug: any) => ug.groups.id) || [];
              setCurrentUser({
                role: userData.role,
                groups: userGroups
              });
            }
          } catch (err) {
            console.error('Error en consulta de usuario:', err);
            // Fallback: usar datos básicos
            setCurrentUser({
              role: 'admin', // Asumir admin por defecto
              groups: []
            });
          }
        }

        // Cargar grupos
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success) setGroups(data.groups);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadUserAndGroups();
  }, []);

  // Función para cargar rooms por grupo
  const loadRoomsForGroup = async (groupId: string) => {
    if (!groupId) {
      setAvailableRooms([]);
      return;
    }

    setLoadingRooms(true);
    try {
      const response = await fetch(`/api/groups/rooms?groupId=${groupId}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRooms(data.rooms);
      } else {
        console.error('Error loading rooms:', data.error);
        setAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Cargar rooms cuando se selecciona un grupo
  useEffect(() => {
    if (form.groups.length > 0) {
      loadRoomsForGroup(form.groups[0]);
    } else {
      setAvailableRooms([]);
    }
  }, [form.groups]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Preparar datos para la API - cambiar 'groups' por 'group_ids'
      const apiData = {
        ...form,
        group_ids: form.groups, // Mapear groups a group_ids
        groups: undefined // Eliminar el campo groups
      };
      delete apiData.groups; // Limpiar el campo groups
      
      console.log('🔍 [FRONTEND] Enviando datos a la API:', apiData);
      
      const res = await fetch("/api/users", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(apiData) 
      });
      
      const result = await res.json();
      console.log('🔍 [FRONTEND] Respuesta de la API:', result);
      
      if (res.ok && result.success) {
        setSuccess('Usuario creado exitosamente');
        // Limpiar formulario
        setForm({
          name: "",
          email: "",
          password: "",
          role: "modelo",
          groups: [],
          room_id: "",
          jornada: ""
        });
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push("/admin/users");
        }, 2000);
      } else {
        setError(result.error || 'Error creando usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-2xl dark:shadow-blue-900/20 dark:ring-1 dark:ring-blue-400/30">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Crear Usuario</h1>
          </div>
        
        {/* Mensajes de error y éxito */}
        {error && (
          <div className="mb-4 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-700/50 rounded-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-4 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm border border-green-200/50 dark:border-green-700/50 rounded-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-4 h-4 bg-green-500 rounded-sm flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] items-start">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Nombre</label>
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={e=>setForm({...form, name:e.target.value})}
            required
            autoComplete="name"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
          />

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Correo electrónico</label>
          <input
            placeholder="Correo electrónico"
            type="email"
            value={form.email}
            onChange={e=>setForm({...form, email:e.target.value})}
            required
            autoComplete="email"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
          />

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Contraseña</label>
          <div className="relative">
            <input
              placeholder="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e=>setForm({...form, password:e.target.value})}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 pr-14 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v=>!v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              className="absolute right-2 top-2 px-2 py-1 rounded-md text-xs text-white bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600"
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Rol</label>
          <div>
            <AppleDropdown
              options={(() => {
                const allRoles = [
                  { value: 'modelo', label: 'Modelo' },
                  { value: 'admin', label: 'Admin' },
                  { value: 'super_admin', label: 'Super Admin' }
                ];
                
                // Aplicar límites de jerarquía
                if (currentUser?.role === 'admin') {
                  // Admin solo puede crear 'modelo'
                  return allRoles.filter(role => role.value === 'modelo');
                }
                
                // Super admin puede crear todos los roles
                return allRoles;
              })()}
              value={form.role}
              onChange={(value) => setForm({ ...form, role: value as any })}
              placeholder="Selecciona un rol"
              className="text-sm"
            />
          </div>

          <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Grupos</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenGroups(v => !v)}
              className="w-full text-left border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex items-center justify-between text-sm hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
            >
              <span className={form.groups.length ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
                {form.groups.length
                  ? groups.filter(g => form.groups.includes(g.id)).map(g => g.name).join(', ')
                  : (form.role === 'modelo' ? 'Selecciona un grupo' : 'Selecciona uno o varios grupos')}
              </span>
              <svg 
                className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openGroups && (
              <div className="apple-scroll absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {loadingGroups ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Cargando grupos…</div>
                ) : (
                  groups.map((g, index) => {
                    const isSelected = form.groups.includes(g.id);
                    const isSingleRole = form.role === 'modelo';
                    const isDisabled = isSingleRole && form.groups.length > 0 && !isSelected;
                    
                    // Aplicar límites de jerarquía para grupos
                    const canAssignGroup = currentUser?.role === 'super_admin' || 
                      (currentUser?.role === 'admin' && currentUser?.groups.includes(g.id));
                    
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={isDisabled || !canAssignGroup}
                        onClick={() => {
                          if (isSingleRole) {
                            setForm({ ...form, groups: isSelected ? [] : [g.id] });
                            setOpenGroups(false);
                          } else {
                            setForm({
                              ...form,
                              groups: isSelected
                                ? form.groups.filter(id => id !== g.id)
                                : [...form.groups, g.id]
                            });
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 ${
                          index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                        } ${
                          isDisabled || !canAssignGroup 
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                        } ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' : ''
                        }`}
                      >
                        <span>{g.name}</span>
                        {isSelected && (
                          <span className="text-blue-600 dark:text-blue-400 ml-auto">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {form.role === 'modelo' && (
            <>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Room {groupRequiresRooms(selectedGroupName) && <span className="text-red-500">*</span>}</label>
              <div>
                <AppleDropdown
                  options={availableRooms.map(room => ({ value: room.id, label: room.room_name }))}
                  value={form.room_id}
                  onChange={(value) => setForm({ ...form, room_id: value })}
                  placeholder={loadingRooms ? 'Cargando rooms...' : 'Selecciona un room'}
                  disabled={loadingRooms || availableRooms.length === 0}
                  maxHeight="max-h-40"
                />
                {form.groups.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Primero selecciona un grupo</p>
                )}
                {!groupRequiresRooms(selectedGroupName) && selectedGroupName && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Opcional para {selectedGroupName}</p>
                )}
              </div>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 self-center">Jornada {groupRequiresJornada(selectedGroupName) && <span className="text-red-500">*</span>}</label>
              <div>
                <AppleDropdown
                  options={[
                    { value: 'MAÑANA', label: 'Mañana' },
                    { value: 'TARDE', label: 'Tarde' },
                    { value: 'NOCHE', label: 'Noche' }
                  ]}
                  value={form.jornada}
                  onChange={(value) => setForm({ ...form, jornada: value })}
                  placeholder="Selecciona una jornada"
                />
                {!groupRequiresJornada(selectedGroupName) && selectedGroupName && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Opcional para {selectedGroupName}</p>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2 flex gap-3 pt-2">
            <button 
              disabled={submitting} 
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-md"
            >
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </button>
            <button 
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg hover:bg-blue-50/80 dark:hover:bg-gray-700/80 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              Volver
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}