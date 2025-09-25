import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IAM Sistema de Gestión",
  description: "Sistema de gestión de usuarios con roles y grupos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
        {children}
      </body>
    </html>
  );
}
