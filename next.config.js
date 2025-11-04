/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nota: Los límites de body size en Vercel/Next.js App Router son 4.5MB por defecto
  // y no se pueden cambiar fácilmente en la configuración.
  // Hemos ajustado el límite de validación a 4MB para evitar errores 413.
};

module.exports = nextConfig;