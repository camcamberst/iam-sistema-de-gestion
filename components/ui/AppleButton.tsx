import React from 'react';

interface AppleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export default function AppleButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false
}: AppleButtonProps) {
  const baseClasses = "w-full font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5";
  
  const sizeClasses = {
    sm: "py-1.5 px-2.5 text-xs rounded-md",
    md: "py-2 px-3 text-sm rounded-lg",
    lg: "py-3 px-4 text-base rounded-xl"
  };
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500",
    secondary: "bg-gradient-to-r from-gray-700 to-slate-800 text-white hover:from-gray-800 hover:to-slate-900 focus:ring-gray-500",
    gray: "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 hover:from-gray-200 hover:to-slate-200 hover:text-gray-900 focus:ring-blue-500 border border-gray-200/50"
  };
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed transform-none hover:shadow-md" : "";
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
}
