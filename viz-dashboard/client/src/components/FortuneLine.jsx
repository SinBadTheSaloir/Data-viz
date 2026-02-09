import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import ChartWrapper from './ChartExport';

/**
 * FortuneLine — Character fortune over time (net_positive vs net_negative per chapter).
 * Supports 1 or 2 characters overlaid for comparison.
 *
 * Props:
 *   - characterData: full character-data API response
 *   - character1: primary character name
 *   - character2: optional second character for comparison
 *   - title: chart title
 */
export default function FortuneLine({ characterData, character1, character2, title }) {
  const chartData = useMemo(() => {
    if (!characterData?.character_chapters || !character1) return [];

    const chapters = characterData.chapters || [];
    const c1Data = characterData.character_chapters[character1] || [];

    // Build lookup for quick chapter access
    const c1Map = {};
    for (const d of c1Data) c1Map[d.chapter] = d;

    let c2Map = {};
    if (character2 && characterData.character_chapters[character2]) {
      for (const d of characterData.character_chapters[character2]) {
        c2Map[d.chapter] = d;
      }
    }

    return chapters.map((ch, idx) => {
      const point = {
        chapter: idx + 1,
        chapterLabel: ch.replace(/_/g, ' ').replace(/chapter/i, 'Ch.'),
      };

      const c1 = c1Map[ch];
      if (c1 && c1.appearances > 0) {
        point[`${character1}_pos`] = c1.net_positive;
        point[`${character1}_neg`] = c1.net_negative;
      }

      if (character2) {
        const c2 = c2Map[ch];
        if (c2 && c2.appearances > 0) {
          point[`${character2}_pos`] = c2.net_positive;
          point[`${character2}_neg`] = c2.net_negative;
        }
      }

      return point;
    });
  }, [characterData, character1, character2]);

  if (!chartData.length) return null;

  const chartTitle = title || (character2
    ? `Fortune: ${character1} vs ${character2}`
    : `Fortune: ${character1}`);

  return (
    <ChartWrapper title={chartTitle}>
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{chartTitle}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
          <XAxis
            dataKey="chapter"
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            label={{ value: 'Chapter', position: 'bottom', offset: 5, fill: '#5c5c72', fontSize: 11 }}
          />
          <YAxis
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
          />
          <ReferenceLine y={0} stroke="#5c5c72" strokeDasharray="5 5" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => chartData[v - 1]?.chapterLabel || `Ch. ${v}`}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="line" />

          {/* Character 1 lines */}
          <Line
            type="monotone"
            dataKey={`${character1}_pos`}
            stroke="#44BB44"
            strokeWidth={2}
            dot={{ r: 3, fill: '#44BB44' }}
            connectNulls
            name={`${character1} Positive`}
          />
          <Line
            type="monotone"
            dataKey={`${character1}_neg`}
            stroke="#FF4444"
            strokeWidth={2}
            dot={{ r: 3, fill: '#FF4444' }}
            connectNulls
            name={`${character1} Negative`}
          />

          {/* Character 2 lines (dashed) */}
          {character2 && (
            <>
              <Line
                type="monotone"
                dataKey={`${character2}_pos`}
                stroke="#88DD88"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: '#88DD88' }}
                connectNulls
                name={`${character2} Positive`}
              />
              <Line
                type="monotone"
                dataKey={`${character2}_neg`}
                stroke="#FF8888"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: '#FF8888' }}
                connectNulls
                name={`${character2} Negative`}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
