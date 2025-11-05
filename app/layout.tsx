import type { Metadata } from "next";
import "./globals.css";
import ThemeTransition from "@/components/ThemeTransition";

export const metadata: Metadata = {
  title: "AIM Sistema de Gestión",
  description: "Sistema de gestión de usuarios con roles y grupos - Diseño Apple.com",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', type: 'image/x-icon', sizes: 'any' }
    ],
    apple: [
      { url: '/favicon.png', type: 'image/png', sizes: '180x180' }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <ThemeTransition>
          {children}
        </ThemeTransition>
      </body>
    </html>
  );
}
