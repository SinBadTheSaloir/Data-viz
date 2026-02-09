import { useRef, useEffect, useState } from 'react';
import { EMOTION_COLORS, CULTURE_COLORS } from '../constants';

/**
 * HeartbeatStrip — renders a single horizontal emotion strip for a book or character.
 *
 * Props:
 *   - strip: array of { chapter, dominant, intensity, emotions, present? }
 *   - label: string label to show on left
 *   - culture: culture string for color accent
 *   - height: strip height in px (default 32)
 *   - showTooltip: boolean
 *   - onClick: optional click handler
 */
export default function HeartbeatStrip({
  strip,
  label,
  labelContent,
  culture,
  height = 32,
  showTooltip = true,
  onClick,
  onSegmentClick,
  activeSegmentIdx,
}) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  if (!strip || strip.length === 0) return null;

  // Find max intensity for opacity scaling
  const maxIntensity = Math.max(...strip.map((s) => s.intensity || 0), 0.01);

  function getSegmentColor(segment) {
    if (!segment.present && segment.present !== undefined) {
      return 'rgba(30, 30, 46, 0.5)';
    }
    if (!segment.dominant) {
      return 'rgba(30, 30, 46, 0.5)';
    }
    const base = EMOTION_COLORS[segment.dominant] || '#555';
    // Scale opacity by intensity relative to max
    const opacity = Math.max(0.25, Math.min(1, (segment.intensity / maxIntensity)));
    return hexToRgba(base, opacity);
  }

  function handleMouseMove(e, idx) {
    if (!showTooltip) return;
    const seg = strip[idx];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 10,
      segment: seg,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  return (
    <div
      className="flex items-center gap-3 group"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* Label */}
      <div className="w-40 shrink-0 text-right pr-2">
        {labelContent || (
          <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors truncate block">
            {label}
          </span>
        )}
      </div>

      {/* Culture dot */}
      {culture && (
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: CULTURE_COLORS[culture] }}
        />
      )}

      {/* Strip */}
      <div
        ref={containerRef}
        className="flex-1 flex relative rounded overflow-hidden"
        style={{ height: `${height}px` }}
        onMouseLeave={handleMouseLeave}
      >
        {strip.map((seg, idx) => (
          <div
            key={idx}
            className="relative transition-all duration-150"
            style={{
              flex: 1,
              backgroundColor: getSegmentColor(seg),
              borderRight: idx < strip.length - 1 ? '1px solid rgba(15,15,19,0.5)' : 'none',
              outline: activeSegmentIdx === idx ? '2px solid #e4e4ed' : 'none',
              outlineOffset: '-1px',
              cursor: onSegmentClick ? 'pointer' : undefined,
            }}
            onMouseMove={(e) => handleMouseMove(e, idx)}
            onClick={(e) => {
              if (onSegmentClick) {
                e.stopPropagation();
                onSegmentClick(idx, seg);
              }
            }}
          />
        ))}

        {/* Tooltip */}
        {tooltip && tooltip.segment && (
          <div
            className="absolute z-50 bg-bg-secondary border border-border rounded-lg px-3 py-2 shadow-xl pointer-events-none"
            style={{
              left: Math.min(tooltip.x, containerRef.current?.offsetWidth - 200 || 0),
              bottom: height + 8,
              minWidth: 180,
            }}
          >
            <div className="text-xs text-text-muted mb-1">
              {tooltip.segment.chapter}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(tooltip.segment.emotions || {}).map(([emo, val]) => (
                <div key={emo} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: EMOTION_COLORS[emo] }}
                  />
                  <span className="text-xs text-text-secondary">
                    {emo}
                  </span>
                  <span className="text-xs font-mono text-text-primary">
                    {typeof val === 'number' ? val.toFixed(2) : val}
                  </span>
                </div>
              ))}
            </div>
            {tooltip.segment.judgment !== undefined && (
              <div className="flex gap-3 mt-1 pt-1 border-t border-border">
                <span className="text-xs text-text-muted">
                  J: <span className="text-text-secondary font-mono">{tooltip.segment.judgment?.toFixed(2)}</span>
                </span>
                <span className="text-xs text-text-muted">
                  M: <span className="text-text-secondary font-mono">{tooltip.segment.mercy?.toFixed(2)}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * HeartbeatLegend — shows emotion color legend
 */
export function HeartbeatLegend() {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      {Object.entries(EMOTION_COLORS).map(([emo, color]) => (
        <div key={emo} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-text-secondary capitalize">{emo}</span>
        </div>
      ))}
    </div>
  );
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
