
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
    <div className={`flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <clipPath id="circleClip">
            <circle cx="256" cy="256" r="240" />
          </clipPath>

          <radialGradient id="doorLight" cx="256" cy="300" r="200" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFBEB" />
            <stop offset="0.6" stopColor="#FEF3C7" />
            <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>

          <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Thick Navy Outer Ring */}
        <circle cx="256" cy="256" r="248" stroke="#0F172A" strokeWidth="16" fill="none" />

        {/* Main Content Area */}
        <g clipPath="url(#circleClip)">
          {/* Stone Wall Background */}
          <rect x="0" y="0" width="512" height="512" fill="#94A3B8" />

          {/* Stone Blocks Grid */}
          <path d="M0 100h512M0 220h512M0 340h512M0 460h512M150 0v100M400 0v100M280 100v120M120 220v120M380 220v120M250 340v120"
            stroke="#64748B" strokeWidth="2" opacity="0.5" />

          {/* Door Frame */}
          <path d="M150 512V180c0-20 15-35 35-35h142c20 0 35 15 35 35v332" fill="#475569" stroke="#1E293B" strokeWidth="4" />

          {/* Door Opening - Light */}
          <rect x="185" y="180" width="142" height="332" fill="white" />
          <path d="M256 160 L185 180 V512 H327 V180 Z" fill="url(#doorLight)" />

          {/* Left Door Leaf (Open) */}
          <path d="M185 180L140 210V512H185Z" fill="#78350F" stroke="#451A03" strokeWidth="1" />

          {/* Right Door Leaf (Open) */}
          <path d="M327 180L372 210V512H327Z" fill="#78350F" stroke="#451A03" strokeWidth="1" />

          {/* Light Glow on Floor */}
          <ellipse cx="256" cy="512" rx="120" ry="40" fill="#FFFBEB" opacity="0.8" />
        </g>

        {/* Branding Text Overlay */}
        <g transform="translate(256, 256)">
          {/* Soft White Backlight for Text */}
          <rect x="-180" y="-60" width="360" height="120" fill="white" opacity="0.3" filter="url(#textGlow)" />

          {/* SIMPLISH Text */}
          <text
            x="-15"
            y="12"
            textAnchor="end"
            fontFamily="Inter, sans-serif"
            fontWeight="900"
            fontSize="62"
            fill="#0F172A"
            style={{ letterSpacing: '-0.05em' }}
          >
            SIMPLISH
          </text>

          {/* Talks Text */}
          <text
            x="-5"
            y="12"
            textAnchor="start"
            fontFamily="'Dancing Script', cursive"
            fontWeight="700"
            fontSize="72"
            fill="#F59E0B"
          >
            Talks
          </text>

          {/* Tagline */}
          <text
            x="0"
            y="68"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            fontSize="20"
            fill="#0F172A"
          >
            English is a door, not a wall.
          </text>
        </g>
      </svg>
    </div>
  );
};

export default Logo;
