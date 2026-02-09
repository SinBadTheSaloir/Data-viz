import { useNavigate } from 'react-router-dom';
import { CULTURE_COLORS, EMOTION_COLORS } from '../constants';

/**
 * BookCard — compact card showing book overview stats.
 */
export default function BookCard({ book }) {
  const navigate = useNavigate();

  const cultureColor = CULTURE_COLORS[book.culture] || '#888';
  const protagonist = book.characters?.[0];
  const dominantEmo = protagonist?.dominant_emotion || 'resolve';

  // Determine story tone
  const hopeFear = (book.emotion_totals?.hope || 0) - (book.emotion_totals?.fear || 0);
  const toneLabel = hopeFear > 5 ? 'Hopeful' : hopeFear < -5 ? 'Dark' : 'Mixed';
  const toneColor = hopeFear > 5 ? '#22C55E' : hopeFear < -5 ? '#A855F7' : '#EAB308';

  // Mercy indicator
  const mercySign = book.mercy_per_block > 0 ? '+' : '';

  return (
    <div
      className="bg-bg-card border border-border rounded-xl p-5 cursor-pointer
                 hover:border-text-muted hover:bg-bg-hover transition-all duration-200
                 flex flex-col gap-3"
      onClick={() => navigate(`/book/${book.book_id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary m-0 leading-tight">
            {book.title}
          </h3>
          <p className="text-xs text-text-muted m-0 mt-0.5">{book.author}</p>
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

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-text-secondary">
        <div>
          <span className="text-text-muted">Blocks</span>{' '}
          <span className="font-mono">{book.total_blocks}</span>
        </div>
        <div>
          <span className="text-text-muted">Events</span>{' '}
          <span className="font-mono">{book.total_events}</span>
        </div>
        <div>
          <span className="text-text-muted">Dialogue</span>{' '}
          <span className="font-mono">{book.dialogue_percentage}%</span>
        </div>
      </div>

      {/* Protagonist */}
      {protagonist && (
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: EMOTION_COLORS[dominantEmo] }}
          />
          <span className="text-sm text-text-secondary">
            {protagonist.name}
          </span>
          <span className="text-xs text-text-muted capitalize">
            ({dominantEmo})
          </span>
        </div>
      )}

      {/* Emotion mini-bars */}
      <div className="flex gap-0.5 h-3 rounded overflow-hidden">
        {Object.entries(book.emotion_totals || {}).map(([emo, val]) => {
          const total = Object.values(book.emotion_totals || {}).reduce((a, b) => a + Math.abs(b), 0.01);
          const width = (Math.abs(val) / total) * 100;
          return (
            <div
              key={emo}
              style={{
                width: `${width}%`,
                backgroundColor: EMOTION_COLORS[emo],
                opacity: val < 0 ? 0.3 : 0.7,
              }}
            />
          );
        })}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: toneColor }} />
          <span className="text-xs text-text-muted">{toneLabel}</span>
        </div>
        <div className="text-xs font-mono text-text-muted">
          J:{book.judgment_per_block?.toFixed(2)} / M:{mercySign}{book.mercy_per_block?.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
