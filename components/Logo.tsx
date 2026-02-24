
import React from 'react';


interface LogoProps {
  className?: string;
  textOnly?: boolean;
  symbolOnly?: boolean;
}

/**
 * SIMPLISH Talks Logo
 */
const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", textOnly = false, symbolOnly = false }) => {
  if (symbolOnly) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <img
          src="/logo-new.png"
          alt="SIMPLISH Symbol"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  if (textOnly) {
    return (
      <div className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}>
        <span className="font-black tracking-tighter uppercase">SIMPLISH</span>
        <span className="font-script italic text-orange-500 normal-case tracking-normal">Talks</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src="/logo-new.png"
        alt="SIMPLISH Symbol"
        className="aspect-square object-contain mb-4 md:mb-6 drop-shadow-2xl h-1/2"
      />
      <div className="flex items-baseline gap-2 md:gap-4 text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.4)] whitespace-nowrap">
        <span className="font-black tracking-tighter uppercase text-3xl md:text-6xl lg:text-7xl">
          SIMPLISH
        </span>
        <span className="font-script italic text-amber-400 normal-case tracking-normal text-4xl md:text-7xl lg:text-8xl -ml-1 md:-ml-2">
          Talks
        </span>
      </div>
    </div>
  );
};

export default Logo;
