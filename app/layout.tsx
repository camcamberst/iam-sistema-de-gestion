import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIM Sistema de Gestión",
  description: "Sistema de gestión de usuarios con roles y grupos - Diseño Apple.com",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' }
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
        {children}
      </body>
    </html>
  );
}
