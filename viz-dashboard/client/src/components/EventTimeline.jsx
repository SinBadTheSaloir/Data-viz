import { useMemo, useState } from 'react';
import { EVENT_TYPE_COLORS } from '../constants';

/**
 * EventTimeline — Strip chart showing all events as colored dots.
 * Y-axis = event type, X-axis = chapter position.
 * Hover for event details (actor, target, description).
 *
 * Props:
 *   - characterData: full character-data API response
 *   - highlightCharacter: optional character name to highlight events involving them
 */
export default function EventTimeline({ characterData, highlightCharacter }) {
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { events, eventTypes, maxChapter, maxBlockInChapter } = useMemo(() => {
    if (!characterData?.events) return { events: [], eventTypes: [], maxChapter: 0, maxBlockInChapter: {} };

    const evts = characterData.events;
    const types = characterData.event_types || [];
    const maxCh = Math.max(...evts.map(e => e.chapter_num), 0);

    // Find max block per chapter for sub-chapter positioning
    const maxBlk = {};
    for (const e of evts) {
      maxBlk[e.chapter_num] = Math.max(maxBlk[e.chapter_num] || 0, e.block_num);
    }

    return { events: evts, eventTypes: types, maxChapter: maxCh, maxBlockInChapter: maxBlk };
  }, [characterData]);

  if (!events.length) return null;

  // Sort event types for consistent Y ordering (most dramatic first)
  const sortOrder = [
    'VIOLENCE', 'THREAT', 'BETRAYAL', 'DECEPTION', 'MANIPULATION',
    'ACCUSATION', 'AID', 'PROMISE', 'SUPPORT', 'PROTECTION',
    'TRANSACTION', 'SPEECH', 'MOVEMENT', 'REVELATION', 'AUTHORITY_ACT',
  ];

  const sortedTypes = [...eventTypes].sort((a, b) => {
    const ai = sortOrder.indexOf(a);
    const bi = sortOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const ROW_HEIGHT = 28;
  const LEFT_MARGIN = 140;
  const TOP_MARGIN = 20;
  const RIGHT_MARGIN = 20;
  const CHART_WIDTH = 900;
  const CHART_HEIGHT = sortedTypes.length * ROW_HEIGHT + TOP_MARGIN + 30;
  const PLOT_WIDTH = CHART_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;

  const getX = (evt) => {
    const maxBlk = maxBlockInChapter[evt.chapter_num] || 1;
    const subPos = maxBlk > 0 ? evt.block_num / maxBlk : 0.5;
    return LEFT_MARGIN + ((evt.chapter_num - 1 + subPos) / maxChapter) * PLOT_WIDTH;
  };

  const getY = (evt) => {
    const idx = sortedTypes.indexOf(evt.event_type);
    return TOP_MARGIN + (idx >= 0 ? idx : sortedTypes.length) * ROW_HEIGHT + ROW_HEIGHT / 2;
  };

  const involvesCharacter = (evt) => {
    if (!highlightCharacter) return true;
    const lc = highlightCharacter.toLowerCase();
    return (evt.actor || '').toLowerCase().includes(lc) ||
           (evt.target || '').toLowerCase().includes(lc);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary mb-1">Event Timeline</h3>
      <p className="text-[10px] text-text-muted mb-3">
        Every narrative event as a dot &mdash; hover for details
        {highlightCharacter && (
          <span className="ml-2 text-text-primary">(highlighting: {highlightCharacter})</span>
        )}
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="block w-full"
          style={{ minWidth: 600, maxWidth: CHART_WIDTH }}
          preserveAspectRatio="xMinYMin meet"
        >
          {/* Background */}
          <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill="transparent" />

          {/* Row backgrounds (alternating) */}
          {sortedTypes.map((type, idx) => (
            <rect
              key={type}
              x={LEFT_MARGIN}
              y={TOP_MARGIN + idx * ROW_HEIGHT}
              width={PLOT_WIDTH}
              height={ROW_HEIGHT}
              fill={idx % 2 === 0 ? '#ffffff04' : 'transparent'}
            />
          ))}

          {/* Y-axis labels */}
          {sortedTypes.map((type, idx) => (
            <text
              key={type}
              x={LEFT_MARGIN - 8}
              y={TOP_MARGIN + idx * ROW_HEIGHT + ROW_HEIGHT / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={EVENT_TYPE_COLORS[type] || '#888'}
              fontSize={10}
              fontFamily="monospace"
            >
              {type}
            </text>
          ))}

          {/* Chapter grid lines */}
          {Array.from({ length: maxChapter }, (_, i) => (
            <line
              key={i}
              x1={LEFT_MARGIN + (i / maxChapter) * PLOT_WIDTH}
              y1={TOP_MARGIN}
              x2={LEFT_MARGIN + (i / maxChapter) * PLOT_WIDTH}
              y2={CHART_HEIGHT - 20}
              stroke="#ffffff10"
              strokeWidth={0.5}
            />
          ))}

          {/* Chapter labels */}
          {Array.from({ length: Math.min(maxChapter, 30) }, (_, i) => {
            // Only label every Nth chapter if many chapters
            const step = maxChapter > 20 ? Math.ceil(maxChapter / 15) : 1;
            if (i % step !== 0) return null;
            return (
              <text
                key={i}
                x={LEFT_MARGIN + ((i + 0.5) / maxChapter) * PLOT_WIDTH}
                y={CHART_HEIGHT - 5}
                textAnchor="middle"
                fill="#5c5c72"
                fontSize={9}
              >
                {i + 1}
              </text>
            );
          })}

          {/* Event dots */}
          {events.map((evt, idx) => {
            const involved = involvesCharacter(evt);
            return (
              <circle
                key={idx}
                cx={getX(evt)}
                cy={getY(evt)}
                r={involved ? 4 : 3}
                fill={EVENT_TYPE_COLORS[evt.event_type] || '#888'}
                opacity={involved ? 0.85 : 0.15}
                className="cursor-pointer transition-opacity"
                onMouseEnter={(e) => {
                  setHoveredEvent(evt);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setHoveredEvent(null)}
              />
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-bg-card border border-border rounded-lg p-3 shadow-xl max-w-xs pointer-events-none"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: EVENT_TYPE_COLORS[hoveredEvent.event_type] || '#888' }}
            />
            <span className="text-xs font-semibold text-text-primary">{hoveredEvent.event_type}</span>
          </div>
          <div className="text-xs text-text-secondary">
            <span className="font-medium">{hoveredEvent.actor || '?'}</span>
            {hoveredEvent.target && (
              <>
                {' '}&rarr;{' '}
                <span className="font-medium">{hoveredEvent.target}</span>
              </>
            )}
          </div>
          {hoveredEvent.description && (
            <div className="text-[10px] text-text-muted mt-1 line-clamp-3">
              {hoveredEvent.description}
            </div>
          )}
          <div className="text-[10px] text-text-muted mt-1">
            Ch. {hoveredEvent.chapter_num}
          </div>
        </div>
      )}
    </div>
  );
}
