/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nota: Los límites de body size en Vercel/Next.js App Router son 4.5MB por defecto
  // y no se pueden cambiar fácilmente en la configuración.
  // Hemos ajustado el límite de validación a 4MB para evitar errores 413.
  
  // Configuración para evitar problemas con undici (usado por cheerio)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Excluir undici del procesamiento de webpack en el servidor
      config.externals = config.externals || [];
      config.externals.push({
        'undici': 'commonjs undici'
      });
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/model/:path*',
        destination: '/admin/model/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;