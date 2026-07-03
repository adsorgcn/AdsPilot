'use client';

import { useCallback } from 'react';

export function useRipple() {
  const createRipple = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 600ms ease-out;
      pointer-events: none;
      z-index: 0;
    `;

    // Add keyframes if not already added
    if (!document.getElementById('ripple-keyframes')) {
      const style = document.createElement('style');
      style.id = 'ripple-keyframes';
      style.innerHTML = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);

  return createRipple;
}
