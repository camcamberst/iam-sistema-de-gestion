import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/utils/cropImage';

interface AvatarCropperModalProps {
  imageFile: File | null;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
  isProcessing: boolean;
}

export default function AvatarCropperModal({
  imageFile,
  onClose,
  onCropComplete,
  isProcessing
}: AvatarCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  // Convertimos el file a un string base64 local para leerlo en react-easy-crop
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  React.useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedBlob) {
        onCropComplete(croppedBlob);
      }
    } catch (e) {
      console.error('Error cropping image:', e);
      alert('Error procesando la imagen de perfil.');
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-0 py-4 sm:p-4">
      {/* Backdrop con Blur extremo tipo Apple */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
        onClick={isProcessing ? undefined : onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border-y sm:border border-white/20 dark:border-white/10 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Encuadre de Perfil</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ajusta y acércate para encontrar el tamaño perfecto
          </p>
        </div>

        {/* Contenedor del Cropper: Debe tener altura relativa relativa */}
        <div className="relative w-full h-[300px] mb-6 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-inner">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        {/* Zoom Slider */}
        <div className="flex items-center space-x-4 mb-8 px-2">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
          <input 
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <svg className="w-6 h-6 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 flex items-center justify-center min-w-[120px]"
          >
            {isProcessing ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              "Usar Foto"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
