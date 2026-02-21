import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const TOOLTIP_MAX_W = 180;
const MARGIN = 8;

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowLeft: '50%', above: true });
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const calcPosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const above = rect.top > 48;

    const idealLeft = rect.left + rect.width / 2 - TOOLTIP_MAX_W / 2;
    const clampedLeft = Math.min(
      Math.max(idealLeft, MARGIN),
      window.innerWidth - TOOLTIP_MAX_W - MARGIN
    );
    const triggerCenterX = rect.left + rect.width / 2;
    const arrowLeft = `${Math.min(Math.max(triggerCenterX - clampedLeft, 12), TOOLTIP_MAX_W - 12)}px`;

    setPos({
      top: above ? rect.top - 8 : rect.bottom + 8,
      left: clampedLeft,
      arrowLeft,
      above,
    });
  };

  const tooltipContent = isVisible ? (
    <span
      className="fixed px-2.5 py-1.5 text-[11px] font-medium text-white bg-slate-800 rounded-md shadow-lg text-center pointer-events-none"
      style={{
        top: pos.top,
        left: pos.left,
        width: 'max-content',
        maxWidth: TOOLTIP_MAX_W,
        transform: pos.above ? 'translateY(-100%)' : 'translateY(0)',
        zIndex: 9999,
      }}
    >
      {content}
      {pos.above
        ? <span className="absolute top-full border-4 border-transparent border-t-slate-800" style={{ left: pos.arrowLeft, transform: 'translateX(-50%)' }} />
        : <span className="absolute bottom-full border-4 border-transparent border-b-slate-800" style={{ left: pos.arrowLeft, transform: 'translateX(-50%)' }} />
      }
    </span>
  ) : null;

  return (
    <span
      ref={wrapperRef}
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => { calcPosition(); setIsVisible(true); }}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </span>
  );
};

export default Tooltip;