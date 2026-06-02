'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader2, Image, Globe2, Eye, EyeOff } from 'lucide-react';
import StandardModal from '@/components/ui/StandardModal';
import { supabase } from '@/lib/supabase';

interface BoostPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  modelName: string;
  modelEmail: string;
  userId: string; // ID del usuario autenticado (admin)
}

type PlatformKey = 'mondo' | 'big7' | 'vxmodels' | 'd2pass' | 'modelka' | 'livecreator' | 'universal';

interface AutoUploadModel {
  id: string;
  nombre: string;
  estado: string;
  fields?: Record<string, any>;
}

// Cache de dashboard-init: 1 sola llamada devuelve modelos, cuentas, prompts, stats
let _dashboardCache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function fetchDashboardInit(forceRefresh = false): Promise<any> {
  if (!forceRefresh && _dashboardCache && Date.now() - _dashboardCache.ts < CACHE_TTL_MS) {
    return _dashboardCache.data;
  }
  const res = await fetch('/api/autoupload/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dashboard-init' })
  });
  let parsed = await res.json();
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.data) parsed = parsed[0];
  _dashboardCache = { data: parsed?.data ?? parsed ?? {}, ts: Date.now() };
  return _dashboardCache.data;
}

function getModelsFromDashboard(dashboard: any): AutoUploadModel[] {
  if (Array.isArray(dashboard?.models)) return dashboard.models;
  if (Array.isArray(dashboard?.data?.models)) return dashboard.data.models;
  return [];
}

export default function BoostPagesModal({
  isOpen,
  onClose,
  modelId: _modelId,
  modelName,
  modelEmail,
  userId: _userId
}: BoostPagesModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [autoModels, setAutoModels] = useState<AutoUploadModel[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformKey>>(new Set(['universal']));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'success' | 'error'>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [platformAccounts, setPlatformAccounts] = useState<Record<string, { nickname: string; password: string }>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Cargar sesión y modelos de AutoUpload cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingModels(true);
        setError('');
        setSuccess('');

        // 1) Obtener sesión para subir imágenes y obtener URL pública
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) {
            setError('No se pudo obtener la sesión actual. Vuelve a iniciar sesión para usar Boost.');
          }
          return;
        }
        if (!cancelled) setToken(session.access_token);

        // 2) Obtener datos desde dashboard-init (cacheado 5 min — 1 llamada = todo)
        const dashboard = await fetchDashboardInit();
        const list = getModelsFromDashboard(dashboard);

        if (!cancelled) {
          setAutoModels(list);

          const username = (modelEmail.split('@')[0] || '').toLowerCase().trim();

          // Diagnóstico visible: mostrar qué modelos devolvió AutoUpload
          const modelNames = list.map((m: any) =>
            m.nombre || m.name || m.fields?.['Nombre de Modelo'] || JSON.stringify(m).slice(0, 80)
          );
          setDebugInfo(`Buscando: "${username}" | AutoUpload devolvió ${list.length} modelo(s): [${modelNames.join(', ')}]`);

          // Buscar en múltiples campos posibles
          const findByField = (fieldName: string, value: string) =>
            list.find((m: any) => String(m[fieldName] || '').toLowerCase().trim() === value);

          // También buscar dentro de fields['Nombre de Modelo']
          const findByNestedField = (fieldName: string, value: string) =>
            list.find((m: any) => String(m.fields?.[fieldName] || '').toLowerCase().trim() === value);

          let match =
            findByField('nombre', username) ||
            findByNestedField('Nombre de Modelo', username) ||
            findByField('name', username) ||
            findByField('username', username) ||
            findByField('user', username);

          // Fallback: buscar por nombre completo
          if (!match) {
            const normalizedName = modelName.toLowerCase().trim();
            match =
              findByField('nombre', normalizedName) ||
              findByNestedField('Nombre de Modelo', normalizedName) ||
              findByField('name', normalizedName);
          }

          // Búsqueda en TODOS los valores string de fields
          if (!match) {
            match = list.find((m: any) => {
              const fields = m.fields || {};
              return Object.values(fields).some(
                (v: any) => typeof v === 'string' && v.toLowerCase().trim() === username
              );
            });
          }

          // Búsqueda parcial como último recurso
          if (!match) {
            match = list.find((m: any) => {
              const allValues = [
                m.nombre, m.name, m.username, m.user,
                m.fields?.['Nombre de Modelo']
              ].filter(Boolean).map((v: any) => String(v).toLowerCase());
              return allValues.some(v => v.includes(username) || username.includes(v));
            });
          }

          const driveId = match
            ? (match as any)?.fields?.['Google Drive Folder ID'] ??
              (match as any)?.fields?.['Google drive Folder ID'] ??
              (match as any)?.fields?.['google_drive_folder_id'] ??
              (match as any)?.['Google Drive Folder ID'] ??
              (match as any)?.folderId ??
              (match as any)?.folder_id
            : null;

          if (match && driveId) {
            setFolderId(String(driveId));
            setDebugInfo('');
          } else if (match && !driveId) {
            setFolderId(null);
            setError(`Se encontró "${username}" en AutoUpload pero no tiene Google Drive Folder ID configurado.`);
          } else {
            setFolderId(null);
            if (list.length === 0) {
              setError('AutoUpload no devolvió modelos. Verifica que el servicio esté activo.');
            }
          }
        }
      } catch (e: any) {
        console.error('❌ [BOOST-AUTOUPLOAD] Error cargando modelos:', e);
        if (!cancelled) {
          setError('Error al conectar con AutoUpload. Intenta de nuevo en unos minutos.');
        }
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, modelEmail, modelName]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('image/'));
    setSelectedFiles((prev) => [...prev, ...files]);
    setUploadStatus({});
    setError('');
    setSuccess('');
  };

  const removeFile = (name: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
    setUploadStatus((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const createModelInAutoUpload = useCallback(async () => {
    const username = (modelEmail.split('@')[0] || '').toLowerCase().trim();
    if (!username) return;

    const accounts = Object.entries(platformAccounts)
      .filter(([, v]) => v.nickname.trim() && v.password.trim())
      .map(([platform, v]) => ({ platform, nickname: v.nickname.trim(), password: v.password.trim() }));

    if (accounts.length === 0) {
      setError('Agrega al menos una plataforma con sus credenciales.');
      return;
    }

    try {
      setCreating(true);
      setError('');

      const res = await fetch('/api/autoupload/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-model-drive',
          data: { nombre: username, accounts }
        })
      });

      let data = await res.json();
      if (Array.isArray(data) && data.length > 0) data = data[0];

      if (!res.ok || data?.success === false) {
        setError(data?.error || data?.message || 'Error al crear la modelo en AutoUpload.');
        return;
      }

      setShowCreateForm(false);
      setPlatformAccounts({});

      // Usar folderId del response de creación si está disponible
      const createdFolderId = data?.folderId || data?.data?.folderId || data?.data?.fields?.['Google Drive Folder ID'];
      if (createdFolderId) {
        setFolderId(String(createdFolderId));
        setError('');
        setSuccess(`Modelo "${username}" creada y conectada. Ya puedes subir fotos.`);
      } else {
        // Solo si el response no incluye folderId, recargar (forzando refresh del cache)
        const dashReload = await fetchDashboardInit(true);
        const list = getModelsFromDashboard(dashReload);
        setAutoModels(list);
        const match = list.find((m: any) => String(m.nombre || '').toLowerCase().trim() === username);
        const driveId =
          match?.fields?.['Google Drive Folder ID'] ??
          (match as any)?.fields?.['Google drive Folder ID'] ??
          (match as any)?.folderId;
        if (match && driveId) {
          setFolderId(String(driveId));
          setError('');
          setSuccess(`Modelo "${username}" creada y conectada. Ya puedes subir fotos.`);
        } else {
          setSuccess(`Modelo "${username}" creada en AutoUpload con ${accounts.length} plataforma(s). Puede tomar unos segundos en aparecer la carpeta.`);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Error al crear la modelo en AutoUpload.');
    } finally {
      setCreating(false);
    }
  }, [modelEmail, platformAccounts]);

  const uploadFiles = useCallback(async () => {
    if (!token) {
      setError('No se pudo obtener la sesión actual. Cierra y vuelve a abrir el Boost.');
      return;
    }
    if (!folderId) {
      setError('No hay carpeta configurada en AutoUpload para esta modelo.');
      return;
    }
    if (selectedFiles.length === 0) return;
    if (selectedPlatforms.size === 0) {
      setError('Selecciona al menos una plataforma.');
      return;
    }

    const platforms = Array.from(selectedPlatforms);

    try {
      setUploading(true);
      setError('');
      setSuccess('');
      let hasErrors = false;

      for (const file of selectedFiles) {
        const key = file.name;
        setUploadStatus((prev) => ({ ...prev, [key]: 'uploading' }));

        // 1) Subir a Supabase para obtener URL pública
        const fd = new FormData();
        fd.append('file', file);

        const uploadRes = await fetch('/api/boost/upload-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });

        let uploadData: any;
        try {
          uploadData = await uploadRes.json();
        } catch {
          setUploadStatus((prev) => ({ ...prev, [key]: 'error' }));
          hasErrors = true;
          setError(uploadRes.status === 413
            ? `${file.name} excede el tamaño máximo permitido (8 MB).`
            : `Error del servidor al subir ${file.name} (HTTP ${uploadRes.status}).`);
          continue;
        }
        if (!uploadRes.ok || !uploadData?.success) {
          setUploadStatus((prev) => ({ ...prev, [key]: 'error' }));
          hasErrors = true;
          setError(uploadData?.error || `Error al subir ${file.name}`);
          continue;
        }

        const fileUrl: string = uploadData.url;

        // 2) Enviar a AutoUpload para todas las plataformas en paralelo
        const driveResults = await Promise.allSettled(
          platforms.map(platform =>
            fetch('/api/autoupload/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileUrl, fileName: file.name, folderId, platform })
            }).then(async r => {
              let d: any;
              try { d = await r.json(); } catch { d = null; }
              return { platform, ok: d?.success !== false, error: d?.error };
            })
          )
        );
        let allOk = true;
        for (const result of driveResults) {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
            allOk = false;
            const errMsg = result.status === 'fulfilled' ? result.value.error : 'Error de red';
            const plat = result.status === 'fulfilled' ? result.value.platform : '?';
            setError(errMsg || `Error al enviar ${file.name} a ${plat}`);
          }
        }

        setUploadStatus((prev) => ({ ...prev, [key]: allOk ? 'success' : 'error' }));
        if (!allOk) hasErrors = true;
      }

      if (!hasErrors) {
        setError('');
        setSuccess(`Carga enviada a AutoUpload (${platforms.join(', ')}). Las plataformas deberían publicar en unos segundos.`);
      }
    } catch (err: any) {
      console.error('❌ [BOOST-AUTOUPLOAD] Error general al subir archivos:', err);
      setError(err?.message || 'Error inesperado al subir archivos');
    } finally {
      setUploading(false);
    }
  }, [token, folderId, selectedFiles, selectedPlatforms]);

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Boost AutoUpload"
      maxWidthClass="max-w-3xl"
      paddingClass="p-6"
    >
      <div className="space-y-5">
        {/* Información del modelo */}
        <div className="relative overflow-hidden bg-white/5 dark:bg-white/[0.02] backdrop-blur-md rounded-2xl p-5 border border-white/10 dark:border-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          {/* Sutil glow de fondo de tarjeta */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-wide">{modelName}</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Modelo activa
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{modelEmail}</p>
              <p className="text-[11px] sm:text-xs text-gray-400/90 dark:text-gray-400 leading-relaxed pt-1">
                Las fotos se enviarán al sistema de AutoUpload usando la carpeta Drive configurada para esta modelo.
              </p>
            </div>
            
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold hidden sm:inline">Integración</span>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 dark:bg-white/[0.04] text-gray-200 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <Globe2 className="w-3.5 h-3.5 text-cyan-400" /> 
                  AutoUpload
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de carpeta / modelo en AutoUpload */}
        <div className="rounded-2xl border border-white/10 dark:border-white/[0.05] bg-white/5 dark:bg-white/[0.02] p-4 text-xs sm:text-sm backdrop-blur-md shadow-sm">
          {loadingModels ? (
            <div className="flex items-center gap-3 text-gray-400 dark:text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="font-medium tracking-wide">Conectando con AutoUpload y buscando la modelo...</span>
            </div>
          ) : folderId ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]" />
                <span className="font-medium">
                  Carpeta de AutoUpload encontrada para <strong className="text-white font-semibold">{modelName}</strong>.
                </span>
              </div>
              <span className="hidden md:inline-block text-[10px] tracking-wider text-gray-500 font-mono bg-black/25 px-2 py-0.5 rounded border border-white/5 max-w-xs truncate">
                ID: {folderId}
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-rose-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span className="font-medium">
                    No se encontró &quot;{modelEmail.split('@')[0]}&quot; en AutoUpload.
                  </span>
                </div>
                {!showCreateForm && (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-purple-500/20 whitespace-nowrap"
                  >
                    Crear en AutoUpload
                  </button>
                )}
              </div>

              {showCreateForm && (
                <CreateModelForm
                  username={modelEmail.split('@')[0]}
                  platformAccounts={platformAccounts}
                  setPlatformAccounts={setPlatformAccounts}
                  showPasswords={showPasswords}
                  setShowPasswords={setShowPasswords}
                  creating={creating}
                  onCancel={() => { setShowCreateForm(false); setPlatformAccounts({}); setShowPasswords({}); }}
                  onCreate={createModelInAutoUpload}
                  error={error}
                />
              )}
            </div>
          )}
        </div>

        {/* Selección de plataformas (multi-select en chips de píldora) */}
        <div className="flex flex-wrap gap-2 text-xs py-1 justify-center sm:justify-start">
          {[
            { key: 'universal' as PlatformKey, label: 'Todas (universal)' },
            { key: 'mondo' as PlatformKey, label: 'Mondo' },
            { key: 'big7' as PlatformKey, label: 'Big7' },
            { key: 'vxmodels' as PlatformKey, label: 'VXModels' },
            { key: 'd2pass' as PlatformKey, label: 'D2Pass / DXLive' },
            { key: 'modelka' as PlatformKey, label: 'Modelka' },
            { key: 'livecreator' as PlatformKey, label: 'LiveCreator' }
          ].map((p) => {
            const isSelected = selectedPlatforms.has(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setSelectedPlatforms((prev) => {
                    const next = new Set(prev);
                    if (p.key === 'universal') {
                      // "Todas" es exclusiva: si la activan, desmarcar las demás
                      return isSelected ? new Set() : new Set(['universal']);
                    }
                    // Si seleccionan una individual, quitar "universal"
                    next.delete('universal');
                    if (next.has(p.key)) {
                      next.delete(p.key);
                    } else {
                      next.add(p.key);
                    }
                    return next;
                  });
                }}
                className={`px-4 py-1.5 rounded-full border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border-cyan-500/40 text-white shadow-[0_0_15px_rgba(34,211,238,0.15)] scale-102'
                    : 'bg-white/5 dark:bg-white/[0.02] border-white/10 dark:border-white/[0.05] text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                )}
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Zona de selección / drag & drop */}
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
            dragging
              ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
              : 'border-white/10 dark:border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02]'
          }`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragging(false);
            if (uploading) return;
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
            if (files.length > 0) setSelectedFiles((prev) => [...prev, ...files]);
          }}
        >
          <input
            id="boost-files-input"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <label
            htmlFor="boost-files-input"
            className={`flex flex-col items-center cursor-pointer ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div className="relative mb-4">
              <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-500 to-fuchsia-500 rounded-full blur-md opacity-25 transition-all duration-500 scale-110 ${dragging ? 'opacity-50 scale-125' : ''}`} />
              <div className="w-12 h-12 bg-white/5 dark:bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center shadow-lg relative z-10">
                <Upload className={`w-5 h-5 transition-colors duration-300 ${dragging ? 'text-cyan-400' : 'text-gray-400'}`} />
              </div>
            </div>
            <span className="text-sm font-semibold tracking-wide text-gray-800 dark:text-gray-100">
              {uploading ? 'Subiendo archivos...' : dragging ? 'Suelta las imágenes aquí' : 'Arrastra imágenes aquí o haz clic para seleccionar'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              Formatos soportados: JPG, PNG, GIF, WebP (máx. 8MB por archivo)
            </span>
          </label>
        </div>

        {/* Lista de archivos seleccionados */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 tracking-wide pl-1">
              Archivos seleccionados ({selectedFiles.length})
            </h4>
            <div className="space-y-1.5">
              {selectedFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 dark:bg-white/[0.02] border border-white/5 text-xs transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {uploadStatus[file.name] === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : uploadStatus[file.name] === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    ) : uploadStatus[file.name] === 'uploading' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />
                    ) : (
                      <Image className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="truncate font-medium text-gray-800 dark:text-gray-200">{file.name}</span>
                    <span className="ml-2 text-[10px] text-gray-500 font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {uploadStatus[file.name] !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => removeFile(file.name)}
                      className="ml-2 text-gray-400 hover:text-rose-500 text-lg leading-none transition-colors px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón de subir */}
        {selectedFiles.length > 0 && (
          <button
            type="button"
            onClick={uploadFiles}
            disabled={uploading || !folderId || selectedPlatforms.size === 0}
            className="w-full h-9 rounded-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 dark:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-lg hover:shadow-fuchsia-500/30 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-cyan-600 disabled:hover:to-fuchsia-600 disabled:shadow-none"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Subiendo archivos...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Enviar {selectedFiles.length} {selectedFiles.length === 1 ? 'archivo' : 'archivos'} a {selectedPlatforms.has('universal') ? 'todas las plataformas' : `${selectedPlatforms.size} ${selectedPlatforms.size === 1 ? 'plataforma' : 'plataformas'}`}
              </>
            )}
          </button>
        )}

        {/* Mensajes de estado */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200/30 dark:border-red-800/30 bg-red-50/5 dark:bg-red-950/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{error}</span>
          </div>
        )}



        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200/30 dark:border-emerald-800/30 bg-emerald-50/5 dark:bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{success}</span>
          </div>
        )}
      </div>
    </StandardModal>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  mondo: 'Mondo',
  big7: 'Big7',
  vxmodels: 'VXModels',
  d2pass: 'D2Pass / DXLive',
  modelka: 'Modelka',
  livecreator: 'LiveCreator'
};

function CreateModelForm({
  username,
  platformAccounts,
  setPlatformAccounts,
  showPasswords,
  setShowPasswords,
  creating,
  onCancel,
  onCreate,
  error
}: {
  username: string;
  platformAccounts: Record<string, { nickname: string; password: string }>;
  setPlatformAccounts: React.Dispatch<React.SetStateAction<Record<string, { nickname: string; password: string }>>>;
  showPasswords: Record<string, boolean>;
  setShowPasswords: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  creating: boolean;
  onCancel: () => void;
  onCreate: () => void;
  error: string;
}) {
  const platforms = ['mondo', 'big7', 'vxmodels', 'd2pass', 'modelka', 'livecreator'] as const;
  const filledCount = platforms.filter(p => {
    const a = platformAccounts[p];
    return a?.nickname?.trim() && a?.password?.trim();
  }).length;

  return (
    <div
      className="mt-2 rounded-2xl border border-white/10 dark:border-white/[0.05] bg-white/5 dark:bg-white/[0.01] backdrop-blur-md p-5 space-y-4 shadow-lg relative overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.stopPropagation();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-purple-400 dark:text-purple-300">
            Registrar &quot;{username}&quot; en AutoUpload
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Completa solo las plataformas donde la modelo tiene cuenta activa.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          Cancelar
        </button>
      </div>

      {/* Tabla horizontal en escritorio */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="text-xs font-semibold text-gray-400 pb-2 pr-3 w-28">Plataforma</th>
              <th className="text-xs font-semibold text-gray-400 pb-2 px-2">Usuario / Email</th>
              <th className="text-xs font-semibold text-gray-400 pb-2 pl-2">Contraseña</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {platforms.map((p) => {
              const acc = platformAccounts[p] || { nickname: '', password: '' };
              const isActive = !!(acc.nickname || acc.password);
              const pwVisible = showPasswords[p] ?? false;

              return (
                <tr key={p} className={`transition-colors ${isActive ? 'bg-purple-500/5' : ''}`}>
                  <td className="py-2.5 pr-3">
                    <span className={`text-xs font-semibold ${isActive ? 'text-purple-400' : 'text-gray-400'}`}>
                      {PLATFORM_LABELS[p]}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <input
                      type={p === 'livecreator' ? "email" : "text"}
                      placeholder={p === 'livecreator' ? "Email" : "Usuario"}
                      value={acc.nickname}
                      onChange={(e) => setPlatformAccounts((prev) => ({ ...prev, [p]: { ...acc, nickname: e.target.value } }))}
                      autoComplete="new-password"
                      className="w-full text-xs px-3 h-8 rounded-xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/25 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                    />
                  </td>
                  <td className="py-2.5 pl-2">
                    <div className="relative">
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        placeholder="Contraseña"
                        value={acc.password}
                        onChange={(e) => setPlatformAccounts((prev) => ({ ...prev, [p]: { ...acc, password: e.target.value } }))}
                        autoComplete="new-password"
                        className="w-full text-xs px-3 h-8 pr-9 rounded-xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/25 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPasswords((prev) => ({ ...prev, [p]: !pwVisible }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                      >
                        {pwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">
          {filledCount === 0 ? 'Sin plataformas configuradas' : `${filledCount} plataforma(s) lista(s)`}
        </span>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating || filledCount === 0}
          className="h-9 px-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-purple-500/20 hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creando...</>
          ) : (
            <>Crear modelo en AutoUpload</>
          )}
        </button>
      </div>
    </div>
  );
}

