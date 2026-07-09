
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
          src="/simplish_logo_final1.png"
          alt="SIMPLISH Symbol"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  if (textOnly) {
    return (
      <div className={`flex flex-row items-baseline gap-1.5 whitespace-nowrap ${className}`}>
        <span className="font-black tracking-tighter uppercase">SIMPLISH</span>
        <span className="font-script italic text-orange-500 normal-case tracking-normal relative -top-[1.5px]">Talks</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src="/simplish_logo_final1.png"
        alt="SIMPLISH Symbol"
        className="w-16 h-16 md:w-24 md:h-24 object-contain mb-2 drop-shadow-2xl"
      />
      <div className="flex flex-row items-baseline gap-1.5 text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] whitespace-nowrap">
        <span className="font-black tracking-tighter uppercase text-base md:text-xl">
          SIMPLISH
        </span>
        <span className="font-script italic text-amber-400 normal-case tracking-normal text-lg md:text-2xl -ml-0.5">
          Talks
        </span>
      </div>
    </div>
  );
};

export default Logo;
