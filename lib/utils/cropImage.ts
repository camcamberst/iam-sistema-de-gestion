export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // evita problemas CORS
    image.src = url
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Función que toma una URL de imagen, y las coordenadas / dimensiones de recorte
 * (como las que devuelve react-easy-crop) y retorna el Blob final comprimido.
 */
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // Establecemos que queremos una salida cuadrada de muy buena calidad resolviendo la "pixelation"
  const TARGET_RESOLUTION = 800 // Las salidas serán imágenes de alta fidelidad 800x800px para evitar pixeles si se estiran

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high' // Ultra calidad de escalado (evita la distorsión/pixelaje)

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // Redimensionador de alta calidad
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = TARGET_RESOLUTION
  finalCanvas.height = TARGET_RESOLUTION
  const finalCtx = finalCanvas.getContext('2d')
  if (finalCtx) {
    finalCtx.imageSmoothingEnabled = true
    finalCtx.imageSmoothingQuality = 'high'
    finalCtx.drawImage(
      canvas,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      TARGET_RESOLUTION,
      TARGET_RESOLUTION
    )
  }

  // Extraemos el blob en formato JPG comprimido fuertemente para evitar los 5MB de Supabase,
  // Al ser 800x800 a 85% JPG, su peso garantizado estará en KB.
  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (file) => {
        if(file) resolve(file)
        else reject(new Error('Canvas to Blob failed'))
      },
      'image/jpeg',
      0.85
    )
  })
}
