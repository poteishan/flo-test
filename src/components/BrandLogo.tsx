import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  size = 'md', 
  showText = true,
  className = '' 
}) => {
  const mainLogoHeights: Record<string, string> = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-11',
    xl: 'h-14',
  };

  const iconSizes: Record<string, string> = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      {showText ? (
        <img 
          src="/FLO-LOGO.png" 
          alt="FLO" 
          className={`${mainLogoHeights[size] || mainLogoHeights.md} w-auto object-contain transition-transform duration-200 hover:scale-105`}
        />
      ) : (
        <img 
          src="/FLO-LOGO-512x512.png" 
          alt="FLO" 
          className={`${iconSizes[size] || iconSizes.md} object-contain transition-transform duration-200 hover:scale-105`}
        />
      )}
    </div>
  );
};
