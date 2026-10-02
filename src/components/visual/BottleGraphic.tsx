import React from 'react';
import { BottleStatus } from '../../types';

interface Props {
  fillPercent: number; // 0 to 100
  status: BottleStatus;
  category?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BottleGraphic: React.FC<Props> = ({
  fillPercent,
  status,
  category = 'Solvents',
  size = 'md',
  className = '',
}) => {
  const clampedFill = Math.min(100, Math.max(0, fillPercent));

  // Determine liquid color based on status or chemical category
  let liquidColor = '#0284c7'; // default cyan-600
  let liquidBg = '#e0f2fe';

  if (status === 'EXPIRED') {
    liquidColor = '#e11d48'; // rose-600
    liquidBg = '#ffe4e6';
  } else if (status === 'LOW' || clampedFill <= 20) {
    liquidColor = '#d97706'; // amber-600
    liquidBg = '#fef3c7';
  } else if (category.includes('Acid')) {
    liquidColor = '#ea580c'; // orange-600
    liquidBg = '#ffedd5';
  } else if (category.includes('Base')) {
    liquidColor = '#4f46e5'; // indigo-600
    liquidBg = '#e0e7ff';
  } else if (category.includes('Standard')) {
    liquidColor = '#059669'; // emerald-600
    liquidBg = '#d1fae5';
  } else if (category.includes('Reagent')) {
    liquidColor = '#7c3aed'; // violet-600
    liquidBg = '#ede9fe';
  }

  // Dimensions
  const dimensions = {
    sm: { width: 36, height: 48, capW: 14, capH: 6, neckW: 10, neckH: 8, bodyW: 30, bodyH: 34 },
    md: { width: 50, height: 68, capW: 20, capH: 8, neckW: 14, neckH: 10, bodyW: 42, bodyH: 48 },
    lg: { width: 72, height: 96, capW: 28, capH: 10, neckW: 20, neckH: 14, bodyW: 60, bodyH: 70 },
  }[size];

  const fillHeight = (clampedFill / 100) * dimensions.bodyH;
  const liquidY = dimensions.height - fillHeight - 2;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-xs"
      >
        <defs>
          {/* Gradient for liquid */}
          <linearGradient id={`liquidGrad-${clampedFill}-${liquidColor}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={liquidColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={liquidColor} stopOpacity="0.95" />
          </linearGradient>

          {/* Clip path for bottle body interior */}
          <clipPath id={`bottleClip-${size}`}>
            <rect
              x={(dimensions.width - dimensions.bodyW) / 2 + 1.5}
              y={dimensions.capH + dimensions.neckH}
              width={dimensions.bodyW - 3}
              height={dimensions.bodyH - 2}
              rx="4"
            />
          </clipPath>
        </defs>

        {/* Liquid layer inside body */}
        <g clipPath={`url(#bottleClip-${size})`}>
          {/* Bottle empty glass background */}
          <rect
            x={(dimensions.width - dimensions.bodyW) / 2}
            y={dimensions.capH + dimensions.neckH}
            width={dimensions.bodyW}
            height={dimensions.bodyH}
            fill={liquidBg}
            fillOpacity="0.4"
          />

          {/* Actual liquid level */}
          {clampedFill > 0 && (
            <rect
              x={(dimensions.width - dimensions.bodyW) / 2}
              y={liquidY}
              width={dimensions.bodyW}
              height={fillHeight + 4}
              fill={`url(#liquidGrad-${clampedFill}-${liquidColor})`}
              className="transition-all duration-500 ease-out"
            />
          )}

          {/* Meniscus wave curve line */}
          {clampedFill > 0 && clampedFill < 98 && (
            <path
              d={`M ${(dimensions.width - dimensions.bodyW) / 2} ${liquidY} Q ${dimensions.width / 2} ${
                liquidY - 1.5
              } ${(dimensions.width + dimensions.bodyW) / 2} ${liquidY}`}
              stroke="white"
              strokeWidth="1"
              strokeOpacity="0.6"
              fill="none"
            />
          )}

          {/* Graduated markings (ticks) on the glass */}
          {[0.25, 0.5, 0.75].map((fraction, i) => {
            const tickY = dimensions.height - fraction * dimensions.bodyH - 2;
            const x1 = (dimensions.width - dimensions.bodyW) / 2 + 3;
            const x2 = x1 + (i === 1 ? 7 : 4);
            return (
              <line
                key={i}
                x1={x1}
                y1={tickY}
                x2={x2}
                y2={tickY}
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
            );
          })}
        </g>

        {/* Glass Bottle Outline */}
        {/* Neck */}
        <rect
          x={(dimensions.width - dimensions.neckW) / 2}
          y={dimensions.capH}
          width={dimensions.neckW}
          height={dimensions.neckH + 2}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {/* Body Outline */}
        <rect
          x={(dimensions.width - dimensions.bodyW) / 2}
          y={dimensions.capH + dimensions.neckH}
          width={dimensions.bodyW}
          height={dimensions.bodyH}
          rx="5"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
        />

        {/* Cap (Nắp chai) */}
        <rect
          x={(dimensions.width - dimensions.capW) / 2}
          y="1"
          width={dimensions.capW}
          height={dimensions.capH}
          rx="2"
          fill="#334155"
          stroke="#1e293b"
          strokeWidth="1"
        />
        {/* Cap ridges */}
        <line
          x1={dimensions.width / 2 - 3}
          y1="2"
          x2={dimensions.width / 2 - 3}
          y2={dimensions.capH}
          stroke="#475569"
          strokeWidth="1"
        />
        <line
          x1={dimensions.width / 2 + 3}
          y1="2"
          x2={dimensions.width / 2 + 3}
          y2={dimensions.capH}
          stroke="#475569"
          strokeWidth="1"
        />

        {/* Subtle glass reflection highlight */}
        <line
          x1={(dimensions.width + dimensions.bodyW) / 2 - 4}
          y1={dimensions.capH + dimensions.neckH + 6}
          x2={(dimensions.width + dimensions.bodyW) / 2 - 4}
          y2={dimensions.height - 8}
          stroke="white"
          strokeWidth="1.5"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
