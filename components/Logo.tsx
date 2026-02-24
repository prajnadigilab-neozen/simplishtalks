
import React from 'react';


interface LogoProps {
  className?: string;
  textOnly?: boolean;
}

/**
 * SIMPLISH Talks Logo
 */
const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", textOnly = false }) => {
  if (textOnly) {
    return (
      <span className={`font-black tracking-tighter uppercase transition-colors ${className}`}>
        SIMPLISH
      </span>
    );
  }

  return (
    <div className={`flex items-center justify-center select-none overflow-hidden ${className}`}>
      <img
        src="/logo-new.png"
        alt="SIMPLISH Talks Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default Logo;
