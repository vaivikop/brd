import React from 'react';

// --- Hero Icons ---

export const HeroChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="text-orange-500" />
    <circle cx="8" cy="10" r="1" className="fill-orange-500 animate-[blink_1s_infinite_0ms]" />
    <circle cx="12" cy="10" r="1" className="fill-orange-500 animate-[blink_1s_infinite_200ms]" />
    <circle cx="16" cy="10" r="1" className="fill-orange-500 animate-[blink_1s_infinite_400ms]" />
  </svg>
);

export const HeroProcessingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" className="text-blue-100" />
    <path d="M12 2a10 10 0 0 1 10 10" className="text-blue-600 animate-spin" style={{ animationDuration: '3s' }} />
    <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" className="text-blue-500 animate-pulse" />
  </svg>
);

export const HeroDocIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="text-emerald-200" />
    <path d="M14 2v6h6" className="text-emerald-300" />
    <path d="M16 13l-4 4l-2-2" className="text-emerald-600 animate-draw" strokeDasharray="20" strokeDashoffset="20" />
  </svg>
);

// --- Process Flow Icons ---

export const AnimDashboard: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" className="text-blue-200" />
    <line x1="3" y1="9" x2="21" y2="9" className="text-blue-100" />
    <rect x="7" y="12" width="2" height="6" className="fill-blue-500 animate-grow-1 origin-bottom" />
    <rect x="11" y="11" width="2" height="7" className="fill-blue-500 animate-grow-2 origin-bottom" />
    <rect x="15" y="13" width="2" height="5" className="fill-blue-500 animate-grow-1 origin-bottom" style={{ animationDelay: '0.5s' }} />
  </svg>
);

export const AnimData: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" className="text-indigo-300" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" className="text-indigo-300" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" className="text-indigo-200" />
    <circle cx="18" cy="15" r="2" className="fill-indigo-500 animate-float" />
    <circle cx="6" cy="10" r="1.5" className="fill-indigo-500 animate-float" style={{ animationDelay: '1s' }} />
  </svg>
);

export const AnimTarget: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" className="text-violet-200" />
    <circle cx="12" cy="12" r="6" className="text-violet-300" />
    <circle cx="12" cy="12" r="2" className="fill-violet-600 animate-pulse-ring" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" className="text-violet-400" />
  </svg>
);

export const AnimInsights: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <path d="M9 18h6" className="text-purple-300" />
    <path d="M10 22h4" className="text-purple-300" />
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" className="text-purple-600" />
    <path d="M12 6v2" className="text-yellow-400 animate-[blink_2s_infinite]" />
    <path d="M12 2v0" className="stroke-purple-200" />
  </svg>
);

export const AnimDocGen: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" className="text-fuchsia-200" />
    <line x1="8" y1="6" x2="16" y2="6" className="text-fuchsia-400" />
    <line x1="8" y1="10" x2="16" y2="10" className="text-fuchsia-400 animate-[blink_2s_infinite_0ms]" />
    <line x1="8" y1="14" x2="13" y2="14" className="text-fuchsia-400 animate-[blink_2s_infinite_500ms]" />
    <line x1="8" y1="18" x2="10" y2="18" className="text-fuchsia-600 animate-pulse" />
  </svg>
);

export const AnimEditing: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" className="text-pink-200" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" className="text-pink-500 animate-[float-particle_2s_ease-in-out_infinite]" />
    <path d="M15 5l3 3" className="text-pink-300" />
  </svg>
);

export const AnimGraph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <circle cx="6" cy="6" r="3" className="text-rose-400 animate-pulse" />
    <circle cx="6" cy="18" r="3" className="text-rose-400" />
    <circle cx="18" cy="12" r="3" className="text-rose-600 animate-pulse" style={{ animationDelay: '1s' }} />
    <line x1="8.5" y1="7.5" x2="15.5" y2="10.5" className="text-rose-200 animate-flow-line" />
    <line x1="8.5" y1="16.5" x2="15.5" y2="13.5" className="text-rose-200" />
  </svg>
);

export const AnimReview: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" className="text-orange-500 animate-draw" strokeDasharray="20" strokeDashoffset="20" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" className="text-orange-200" />
    <rect x="8" y="10" width="8" height="8" className="stroke-orange-500 opacity-0 animate-[pulse_1s_ease-out_forwards_1s]" />
  </svg>
);