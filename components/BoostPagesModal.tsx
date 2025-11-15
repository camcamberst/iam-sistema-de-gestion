'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Folder, Settings, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import StandardModal from '@/components/ui/StandardModal';

interface BoostPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  modelName: string;
  modelEmail: string;
}

interface GoogleDriveConfig {
  folderUrl: string | null;
  folderId: string | null;
}

export default function BoostPagesModal({
  isOpen,
  onClose,
  modelId,
  modelName,
  modelEmail
}: BoostPagesModalProps) {
  const [config, setConfig] = useState<GoogleDriveConfig>({ folderUrl: null, folderId: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newFolderUrl, setNewFolderUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Extraer folder ID de la URL de Google Drive
  const extractFolderId = (url: string): string | null => {
    try {
      // Formato: https://drive.google.com/drive/folders/FOLDER_ID
      const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Cargar configuración del Google Drive
  useEffect(() => {
    if (isOpen && modelId) {
      loadConfig();
    }
  }, [isOpen, modelId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/models/google-drive-config?modelId=${modelId}`);
      const data = await response.json();

      if (data.success) {
        setConfig({
          folderUrl: data.folderUrl || null,
          folderId: data.folderId || null
        });
        setNewFolderUrl(data.folderUrl || '');
      } else {
        setError(data.error || 'Error al cargar configuración');
      }
    } catch (err: any) {
      setError('Error al cargar configuración');
      console.error('Error loading Google Drive config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!newFolderUrl.trim()) {
      setError('Por favor ingresa una URL válida de Google Drive');
      return;
    }

    const folderId = extractFolderId(newFolderUrl);
    if (!folderId) {
      setError('URL inválida. Debe ser un enlace de carpeta de Google Drive (formato: https://drive.google.com/drive/folders/...)');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/models/google-drive-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          folderUrl: newFolderUrl.trim(),
          folderId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConfig({
          folderUrl: newFolderUrl.trim(),
          folderId
        });
        setEditing(false);
        setSuccess('Configuración guardada correctamente');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Error al guardar configuración');
      }
    } catch (err: any) {
      setError('Error al guardar configuración');
      console.error('Error saving Google Drive config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNewFolderUrl(config.folderUrl || '');
    setEditing(false);
    setError('');
  };

  const iframeUrl = config.folderId 
    ? `https://drive.google.com/embeddedfolderview?id=${config.folderId}#grid`
    : null;

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Boost Pages"
      maxWidthClass="max-w-4xl"
      paddingClass="p-6"
    >
      <div className="space-y-4">
        {/* Información del modelo */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{modelName}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{modelEmail}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Configuración de Google Drive */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Configuración de Google Drive</h4>
            </div>
            {!editing && config.folderUrl && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Editar
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Cargando configuración...</p>
            </div>
          ) : editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL de la carpeta de Google Drive
                </label>
                <input
                  type="text"
                  value={newFolderUrl}
                  onChange={(e) => setNewFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Ingresa el enlace completo de la carpeta de Google Drive donde se encuentran las carpetas de cada plataforma
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : config.folderUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Configurado correctamente</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{config.folderUrl}</p>
              </div>
              <a
                href={config.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en Google Drive
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No hay configuración de Google Drive para esta modelo
                </p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Configurar Google Drive
              </button>
            </div>
          )}
        </div>

        {/* Acceso a Google Drive */}
        {config.folderId && !editing && (
          <div className="space-y-4">
            {/* Advertencia importante */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    ⚠️ Importante: Arrastrar fotos no funciona en la vista previa
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Por restricciones de seguridad del navegador, el arrastre de archivos no funciona dentro del iframe. 
                    Debes abrir el Google Drive en una nueva pestaña usando el botón de abajo para poder arrastrar las fotos.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón principal para abrir Google Drive */}
            <a
              href={config.folderUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 text-base font-semibold"
            >
              <Upload className="w-5 h-5" />
              <span>Abrir Google Drive en nueva pestaña</span>
              <ExternalLink className="w-5 h-5" />
            </a>

            {/* Vista previa opcional (solo para visualización) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Vista previa (solo lectura)</h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">No se pueden arrastrar archivos aquí</span>
              </div>
              <div className="relative bg-gray-100 dark:bg-gray-900" style={{ height: '400px' }}>
                <iframe
                  src={iframeUrl || ''}
                  className="w-full h-full border-0 opacity-75"
                  title="Google Drive Folder Preview"
                  allow="autoplay"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg px-4 py-2 shadow-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Usa el botón de arriba para abrir y arrastrar archivos
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                📋 Instrucciones paso a paso:
              </p>
              <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Haz clic en el botón "Abrir Google Drive en nueva pestaña"</li>
                <li>En la nueva pestaña, arrastra las fotos desde tu computadora</li>
                <li>Suelta las fotos en la carpeta correspondiente a cada plataforma</li>
                <li>Tu aplicación externa detectará automáticamente los cambios y subirá las fotos</li>
              </ol>
            </div>
          </div>
        )}

        {/* Mensaje cuando no hay configuración */}
        {!config.folderId && !editing && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Configuración requerida
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  Para usar Boost Pages, primero debes configurar el enlace de Google Drive de esta modelo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}

