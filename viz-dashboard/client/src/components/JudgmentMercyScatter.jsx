import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { CULTURE_COLORS } from '../constants';

/**
 * Truncate a book title for scatter labels.
 */
function shortTitle(title) {
  if (title.length <= 14) return title;
  return title.slice(0, 12) + '…';
}

/**
 * JudgmentMercyScatter — scatter plot of judgment vs mercy per book.
 */
export default function JudgmentMercyScatter({ books, height = 350 }) {
  const data = useMemo(() => {
    return books.map((b) => ({
      x: b.judgment_per_block,
      y: b.mercy_per_block,
      title: b.title,
      shortTitle: shortTitle(b.title),
      culture: b.culture,
      book_id: b.book_id,
    }));
  }, [books]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary mb-3">
        Judgment vs Mercy
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
          <XAxis
            dataKey="x"
            type="number"
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            label={{ value: 'Judgment / block', position: 'bottom', offset: 10, fill: '#5c5c72', fontSize: 11 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            label={{ value: 'Mercy / block', angle: -90, position: 'left', offset: 10, fill: '#5c5c72', fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="#5c5c72" strokeDasharray="5 5" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              return (
                <div className="bg-bg-card border border-border rounded-lg px-3 py-2">
                  <div className="text-sm font-semibold text-text-primary">{d.title}</div>
                  <div className="text-xs text-text-muted mt-1">
                    <span style={{ color: CULTURE_COLORS[d.culture] }}>{d.culture}</span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    Judgment: {d.x?.toFixed(3)} | Mercy: {d.y?.toFixed(3)}
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={CULTURE_COLORS[entry.culture] || '#888'}
                r={8}
              />
            ))}
            <LabelList
              dataKey="shortTitle"
              position="top"
              offset={12}
              style={{ fontSize: 10, fill: '#8888a0', pointerEvents: 'none' }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant labels */}
      <div className="flex justify-between px-10 -mt-2">
        <span className="text-xs text-text-muted">Low Judgment</span>
        <span className="text-xs text-text-muted">High Judgment</span>
      </div>
    </div>
  );
}
