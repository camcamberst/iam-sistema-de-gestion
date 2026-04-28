import React from 'react';

interface AppleCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'gradient';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export default function AppleCard({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  onClick
}: AppleCardProps) {
  const baseClasses = "relative backdrop-blur-sm border border-white/20 shadow-md";
  
  const variantClasses = {
    default: "bg-white/80 rounded-lg",
    glass: "bg-white/70 rounded-xl",
    gradient: "bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-lg border-blue-200/30"
  };
  
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8"
  };
  
  const clickableClasses = onClick ? "cursor-pointer hover:shadow-lg transition-shadow duration-300" : "";
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${clickableClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
