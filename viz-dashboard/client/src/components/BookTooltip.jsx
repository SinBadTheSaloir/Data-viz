import { useState } from 'react';
import { CULTURE_COLORS, EMOTION_COLORS } from '../constants';

/**
 * BookTooltip — hover over a book title to see a quick stats popup.
 *
 * Props:
 *   - book: book summary object from API
 *   - children: the element to wrap (label, title, etc.)
 */
export default function BookTooltip({ book, children }) {
  const [show, setShow] = useState(false);

  if (!book) return children;

  const cultureColor = CULTURE_COLORS[book.culture] || '#888';
  const protagonist = book.characters?.[0];
  const hopeFear = (book.emotion_totals?.hope || 0) - (book.emotion_totals?.fear || 0);
  const toneLabel = hopeFear > 5 ? 'Hopeful' : hopeFear < -5 ? 'Dark' : 'Mixed';

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="absolute z-50 bg-bg-card border border-border rounded-xl p-4 shadow-2xl pointer-events-none"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            minWidth: 260,
            maxWidth: 320,
          }}
        >
          {/* Title + culture */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-sm font-semibold text-text-primary leading-tight">{book.title}</div>
              <div className="text-xs text-text-muted">{book.author}</div>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: `${cultureColor}20`,
                color: cultureColor,
                border: `1px solid ${cultureColor}40`,
              }}
            >
              {book.culture}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[
              { label: 'Blocks', value: book.total_blocks },
              { label: 'Chapters', value: book.total_chapters },
              { label: 'Events', value: book.total_events },
              { label: 'Dialogue', value: `${book.dialogue_percentage}%` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xs text-text-muted">{s.label}</div>
                <div className="text-xs font-mono text-text-primary">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Protagonist */}
          {protagonist && (
            <div className="flex items-center gap-1.5 mb-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: EMOTION_COLORS[protagonist.dominant_emotion] }}
              />
              <span className="text-xs text-text-secondary">{protagonist.name}</span>
              <span className="text-xs text-text-muted capitalize">({protagonist.dominant_emotion})</span>
            </div>
          )}

          {/* Emotion mini-bars */}
          <div className="flex gap-0.5 h-2 rounded overflow-hidden mb-2">
            {Object.entries(book.emotion_totals || {}).map(([emo, val]) => {
              const total = Object.values(book.emotion_totals || {}).reduce((a, b) => a + Math.abs(b), 0.01);
              return (
                <div
                  key={emo}
                  style={{
                    width: `${(Math.abs(val) / total) * 100}%`,
                    backgroundColor: EMOTION_COLORS[emo],
                    opacity: 0.7,
                  }}
                />
              );
            })}
          </div>

          {/* Bottom */}
          <div className="flex justify-between text-xs text-text-muted">
            <span>{toneLabel}</span>
            <span className="font-mono">
              J:{book.judgment_per_block?.toFixed(2)} / M:{book.mercy_per_block?.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
