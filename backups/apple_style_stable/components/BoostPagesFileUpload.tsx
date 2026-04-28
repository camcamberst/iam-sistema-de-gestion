'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Folder, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
}

interface BoostPagesFileUploadProps {
  folderId: string;
  modelId: string;
  userId: string; // ID del usuario autenticado (admin)
  onUploadComplete?: () => void;
}

export default function BoostPagesFileUpload({
  folderId,
  modelId,
  userId,
  onUploadComplete
}: BoostPagesFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'success' | 'error'>>({});
  const [error, setError] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Cargar carpetas del Google Drive
  const loadFolders = useCallback(async () => {
    try {
      setLoadingFolders(true);
      setError('');
      const response = await fetch(`/api/google-drive/folders?folderId=${folderId}&userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setFolders(data.folders || []);
        if (data.folders && data.folders.length > 0 && !selectedFolderId) {
          // Seleccionar la primera carpeta por defecto
          setSelectedFolderId(data.folders[0].id);
        }
      } else {
        if (data.requiresAuth) {
          // Iniciar flujo OAuth
          const authResponse = await fetch(`/api/google-drive/auth?userId=${userId}`);
          const authData = await authResponse.json();
          if (authData.success && authData.authUrl) {
            window.location.href = authData.authUrl;
          } else {
            setError('Error al iniciar autenticación con Google Drive');
          }
        } else if (data.requiresSetup) {
          setError('Google OAuth no está configurado. Por favor, contacta al administrador para configurar la integración con Google Drive.');
        } else {
          setError(data.error || 'Error al cargar carpetas');
        }
      }
    } catch (err: any) {
      setError('Error al cargar carpetas');
      console.error('Error loading folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  }, [folderId, selectedFolderId]);

  // Cargar carpetas cuando se monta el componente
  useEffect(() => {
    if (folderId) {
      loadFolders();
    }
  }, [folderId, loadFolders]);

  // Manejar drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      // Inicializar estados de upload
      files.forEach(file => {
        setUploadStatus(prev => ({ ...prev, [file.name]: 'pending' }));
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      });
    }
  }, []);

  // Manejar selección de archivos
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      files.forEach(file => {
        setUploadStatus(prev => ({ ...prev, [file.name]: 'pending' }));
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      });
    }
  }, []);

  // Eliminar archivo de la lista
  const removeFile = useCallback((fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    setUploadStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  }, []);

  // Subir archivos
  const uploadFiles = useCallback(async () => {
    if (!selectedFolderId) {
      setError('Por favor selecciona una carpeta destino');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Por favor selecciona al menos un archivo');
      return;
    }

    try {
      setUploading(true);
      setError('');

      for (const file of selectedFiles) {
        setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', selectedFolderId);
        formData.append('modelId', modelId);
        formData.append('userId', userId);

        const response = await fetch('/api/google-drive/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } else {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
          if (data.requiresAuth) {
            // Iniciar flujo OAuth
            const authResponse = await fetch(`/api/google-drive/auth?userId=${userId}`);
            const authData = await authResponse.json();
            if (authData.success && authData.authUrl) {
              window.location.href = authData.authUrl;
              return; // Salir de la función, se redirigirá
            } else {
              setError('Error al iniciar autenticación con Google Drive');
            }
          } else if (data.requiresSetup) {
            setError('Google OAuth no está configurado. Por favor, contacta al administrador.');
          } else {
            setError(data.error || `Error al subir ${file.name}`);
          }
        }
      }

      // Llamar callback si todos los archivos se subieron correctamente
      const allSuccess = selectedFiles.every(file => 
        uploadStatus[file.name] === 'success'
      );

      if (allSuccess && onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
          setSelectedFiles([]);
          setUploadStatus({});
          setUploadProgress({});
        }, 2000);
      }
    } catch (err: any) {
      setError('Error al subir archivos');
      console.error('Error uploading files:', err);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, selectedFolderId, modelId, uploadStatus, onUploadComplete]);

  return (
    <div className="space-y-4">
      {/* Selector de carpeta */}
      {loadingFolders ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Cargando carpetas...
          </span>
        </div>
      ) : folders.length > 0 ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selecciona la carpeta destino:
          </label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={uploading}
          >
            {folders.map(folder => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            No se encontraron carpetas. Asegúrate de que el Google Drive tenga carpetas configuradas.
          </p>
        </div>
      )}

      {/* Zona de drag & drop */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-blue-400'}
        `}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {isDragging ? 'Suelta los archivos aquí' : 'Arrastra fotos aquí o haz clic para seleccionar'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Solo archivos de imagen (JPG, PNG, GIF, WebP)
        </p>
      </div>

      {/* Lista de archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Archivos seleccionados ({selectedFiles.length}):
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {uploadStatus[file.name] === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : uploadStatus[file.name] === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : uploadStatus[file.name] === 'uploading' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 flex-shrink-0" />
                  ) : (
                    <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                {uploadStatus[file.name] !== 'uploading' && (
                  <button
                    onClick={() => removeFile(file.name)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón de subir */}
      {selectedFiles.length > 0 && selectedFolderId && (
        <button
          onClick={uploadFiles}
          disabled={uploading || !selectedFolderId}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 font-semibold"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Subiendo archivos...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>Subir {selectedFiles.length} archivo(s)</span>
            </>
          )}
        </button>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

