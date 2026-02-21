import React from 'react';

interface MascotProps {
  expression?: 'neutral' | 'happy' | 'thinking' | 'excited';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Mascot: React.FC<MascotProps> = ({ expression = 'neutral', className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-40 h-40",
    lg: "w-56 h-56"
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Defs for filters and patterns */}
        <defs>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.3"/>
          </filter>
          <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        {/* Animated Orbit Ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="44" 
          fill="none" 
          stroke="#3B82F6" 
          strokeWidth="1.5" 
          strokeDasharray="8 12"
          opacity="0.4"
          className={`origin-center ${expression === 'thinking' ? 'animate-[spin_2s_linear_infinite]' : 'animate-[spin_12s_linear_infinite]'}`}
        />

        {/* Outer glow pulse */}
        <circle 
          cx="50" 
          cy="50" 
          r="38" 
          fill="#3B82F6"
          opacity="0.1"
          className={expression === 'excited' ? 'animate-ping' : ''}
        />

        {/* Main Body - Rounded Square */}
        <rect 
          x="18" 
          y="18" 
          width="64" 
          height="64" 
          rx="20" 
          fill="#3B82F6"
          filter="url(#softShadow)"
          className="animate-[float-particle_4s_ease-in-out_infinite]"
        />

        {/* Inner highlight */}
        <rect 
          x="22" 
          y="22" 
          width="56" 
          height="30" 
          rx="16" 
          fill="white"
          opacity="0.15"
        />

        {/* Face Container */}
        <g className="animate-[float-particle_4s_ease-in-out_infinite]" style={{ animationDelay: '0.15s' }}>
          {/* Eyes */}
          {expression === 'thinking' ? (
            <>
              {/* Thinking eyes - looking up */}
              <ellipse cx="38" cy="42" rx="5" ry="5" fill="white">
                <animate attributeName="cy" values="42;40;42" dur="1.5s" repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx="62" cy="42" rx="5" ry="5" fill="white">
                <animate attributeName="cy" values="42;40;42" dur="1.5s" repeatCount="indefinite"/>
              </ellipse>
              {/* Thought particle */}
              <circle cx="72" cy="28" r="3" fill="white" opacity="0.6" className="animate-ping"/>
              <circle cx="78" cy="22" r="2" fill="white" opacity="0.4" className="animate-ping" style={{ animationDelay: '0.3s' }}/>
            </>
          ) : expression === 'excited' ? (
            <>
              {/* Excited eyes - starry */}
              <polygon points="38,37 40,43 46,43 41,47 43,53 38,49 33,53 35,47 30,43 36,43" fill="white" className="animate-pulse"/>
              <polygon points="62,37 64,43 70,43 65,47 67,53 62,49 57,53 59,47 54,43 60,43" fill="white" className="animate-pulse" style={{ animationDelay: '0.1s' }}/>
            </>
          ) : expression === 'happy' ? (
            <>
              {/* Happy eyes - curved */}
              <path d="M32 44 Q38 38 44 44" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M56 44 Q62 38 68 44" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
            </>
          ) : (
            <>
              {/* Neutral eyes - blinking */}
              <ellipse cx="38" cy="44" rx="5" ry="5" fill="white">
                <animate attributeName="ry" values="5;1;5" dur="4s" repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx="62" cy="44" rx="5" ry="5" fill="white">
                <animate attributeName="ry" values="5;1;5" dur="4s" repeatCount="indefinite"/>
              </ellipse>
            </>
          )}

          {/* Mouth */}
          {expression === 'happy' || expression === 'excited' ? (
            <path 
              d="M35 58 Q50 70 65 58" 
              stroke="white" 
              strokeWidth="4" 
              fill="none" 
              strokeLinecap="round"
            />
          ) : expression === 'thinking' ? (
            <ellipse cx="50" cy="60" rx="4" ry="3" fill="white" opacity="0.8">
              <animate attributeName="rx" values="4;5;4" dur="2s" repeatCount="indefinite"/>
            </ellipse>
          ) : (
            <path 
              d="M38 58 Q50 62 62 58" 
              stroke="white" 
              strokeWidth="3" 
              fill="none" 
              strokeLinecap="round"
            />
          )}
        </g>
        
        {/* Accent Particles */}
        {expression === 'excited' && (
          <>
            <circle cx="88" cy="20" r="4" fill="#10B981" className="animate-bounce"/>
            <circle cx="12" cy="80" r="3" fill="#F59E0B" className="animate-bounce" style={{ animationDelay: '0.15s' }}/>
            <circle cx="85" cy="75" r="2.5" fill="#EC4899" className="animate-bounce" style={{ animationDelay: '0.3s' }}/>
          </>
        )}

        {/* Floating sparkles for happy */}
        {expression === 'happy' && (
          <>
            <circle cx="82" cy="25" r="2" fill="white" opacity="0.6" className="animate-pulse"/>
            <circle cx="18" cy="75" r="1.5" fill="white" opacity="0.4" className="animate-pulse" style={{ animationDelay: '0.2s' }}/>
          </>
        )}
      </svg>
    </div>
  );
};

export default Mascot;