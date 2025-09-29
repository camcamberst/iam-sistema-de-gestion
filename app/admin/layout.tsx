"use client";

import { ReactNode, useState } from "react";
import AppleSidebar from "../../components/AppleSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Apple-style Header */}
      <header className="apple-glass-dark border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center apple-shadow-medium">
              <span className="text-white font-bold text-xl">AIM</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold apple-text-gradient">
                Sistema de Gestión
              </h1>
              <p className="text-white/60 text-sm">Panel Administrativo</p>
            </div>
          </div>

          {/* Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="apple-button-secondary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Menú</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="apple-fade-in">
          {children}
        </div>
      </main>

      {/* Apple Sidebar */}
      <AppleSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
    </div>
  );
}