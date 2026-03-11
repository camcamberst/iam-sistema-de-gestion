'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader2, Image, Globe2 } from 'lucide-react';
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

type PlatformKey = 'mondo' | 'big7' | 'vxmodels' | 'd2pass' | 'modelka' | 'universal';

interface AutoUploadModel {
  id: string;
  nombre: string;
  estado: string;
  fields?: Record<string, any>;
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

        // 2) Obtener listado de modelos desde AutoUpload
        const res = await fetch('/api/autoupload/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list-models' })
        });

        let parsed = await res.json();

        // n8n webhooks envuelven la respuesta en un array: [{ success, data: [...] }]
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.data) {
          parsed = parsed[0];
        }

        const list: AutoUploadModel[] = Array.isArray(parsed?.data) ? parsed.data : [];

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
            setError(
              list.length === 0
                ? 'AutoUpload no devolvió modelos. Verifica que el servicio esté activo.'
                : `No se encontró "${username}" en AutoUpload (${list.length} modelos disponibles). Verifica que el username coincida.`
            );
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
    setSelectedFiles(files);
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

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData?.success) {
          console.error('❌ [BOOST-AUTOUPLOAD] Error subiendo a Supabase:', uploadData);
          setUploadStatus((prev) => ({ ...prev, [key]: 'error' }));
          setError(uploadData?.error || `Error al subir ${file.name}`);
          continue;
        }

        const fileUrl: string = uploadData.url;

        // 2) Enviar a AutoUpload para cada plataforma seleccionada
        let allOk = true;
        for (const platform of platforms) {
          const driveRes = await fetch('/api/autoupload/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl, fileName: file.name, folderId, platform })
          });

          const driveData = await driveRes.json();
          if (!driveRes.ok || driveData?.success === false) {
            console.error(`❌ [BOOST-AUTOUPLOAD] Error enviando a ${platform}:`, driveData);
            allOk = false;
            setError(driveData?.error || `Error al enviar ${file.name} a ${platform}`);
          }
        }

        setUploadStatus((prev) => ({ ...prev, [key]: allOk ? 'success' : 'error' }));
      }

      setSuccess(`Carga enviada a AutoUpload (${platforms.join(', ')}). Las plataformas deberían publicar en unos segundos.`);
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
      <div className="space-y-4">
        {/* Información del modelo */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{modelName}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{modelEmail}</p>
              <p className="mt-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
                Las fotos se enviarán al sistema de AutoUpload usando la carpeta Drive configurada para esta modelo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                <Upload className="w-4 h-4 sm:w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Integración</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 flex items-center justify-end gap-1">
                  <Globe2 className="w-3 h-3" /> AutoUpload
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de carpeta / modelo en AutoUpload */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-xs sm:text-sm">
          {loadingModels ? (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Conectando con AutoUpload y buscando la modelo...</span>
            </div>
          ) : folderId ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Carpeta de AutoUpload encontrada para <strong>{modelName}</strong>.
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-xs">
                Folder ID: {folderId}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4" />
              <span>
                No se encontró &quot;{modelEmail.split('@')[0]}&quot; en AutoUpload o no tiene Google Drive configurado. Revisa que el username coincida.
              </span>
            </div>
          )}
        </div>

        {/* Selección de plataformas (multi-select) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { key: 'universal' as PlatformKey, label: 'Todas (universal)' },
            { key: 'mondo' as PlatformKey, label: 'Mondo' },
            { key: 'big7' as PlatformKey, label: 'Big7' },
            { key: 'vxmodels' as PlatformKey, label: 'VXModels' },
            { key: 'd2pass' as PlatformKey, label: 'D2Pass/DXLive' },
            { key: 'modelka' as PlatformKey, label: 'Modelka' }
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
                className={`px-2 py-1.5 rounded-md border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-900/30 dark:text-purple-100'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-purple-500 border-purple-500 text-white'
                    : 'border-gray-400 dark:border-gray-500'
                }`}>
                  {isSelected && <span className="text-[9px] leading-none">✓</span>}
                </span>
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Zona de selección de archivos */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-900/60 border-gray-300 dark:border-gray-700">
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
            <Upload className="w-10 h-10 mb-3 text-gray-400" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {uploading ? 'Subiendo archivos...' : 'Haz clic para seleccionar fotos'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Formatos soportados: JPG, PNG, GIF, WebP (máx. 8MB por archivo)
            </span>
          </label>
        </div>

        {/* Lista de archivos seleccionados */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <h4 className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100">
              Archivos seleccionados ({selectedFiles.length})
            </h4>
            {selectedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {uploadStatus[file.name] === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : uploadStatus[file.name] === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  ) : uploadStatus[file.name] === 'uploading' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
                  ) : (
                    <Image className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="truncate text-gray-800 dark:text-gray-100">{file.name}</span>
                  <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                {uploadStatus[file.name] !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botón de subir */}
        {selectedFiles.length > 0 && (
          <button
            type="button"
            onClick={uploadFiles}
            disabled={uploading || !folderId || selectedPlatforms.size === 0}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Subiendo archivos...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Enviar {selectedFiles.length} archivo(s) a {selectedPlatforms.has('universal') ? 'todas las plataformas' : `${selectedPlatforms.size} plataforma(s)`}
              </>
            )}
          </button>
        )}

        {/* Mensajes de estado */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {debugInfo && (
          <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-[10px] font-mono text-gray-600 dark:text-gray-400 break-all">
            🔍 {debugInfo}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}
      </div>
    </StandardModal>
  );
}

