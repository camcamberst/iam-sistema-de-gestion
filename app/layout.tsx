import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIM Sistema de Gestión",
  description: "Sistema de gestión de usuarios con roles y grupos - Diseño Apple-style",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white antialiased">
        <div className="relative min-h-screen">
          {/* Apple-style Background */}
          <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
          
          {/* Main Content */}
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
