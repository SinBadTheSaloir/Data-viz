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
import { BELIEFS, BELIEF_COLORS, BELIEF_LABELS } from '../constants';
import ChartWrapper from './ChartExport';

/**
 * BeliefTracker — 4 belief dimension lines over time for a single character.
 * Shows providence_conviction, instrumental_rationalization, suspicion_paranoia, identity_stability.
 *
 * Props:
 *   - characterData: full character-data API response
 *   - character: character name
 */
export default function BeliefTracker({ characterData, character }) {
  const chartData = useMemo(() => {
    if (!characterData?.character_beliefs || !character) return [];

    const chapters = characterData.chapters || [];
    const beliefChapters = characterData.character_beliefs[character] || [];

    const lookup = {};
    for (const d of beliefChapters) lookup[d.chapter] = d;

    return chapters.map((ch, idx) => {
      const d = lookup[ch];
      const point = {
        chapter: idx + 1,
        chapterLabel: ch.replace(/_/g, ' ').replace(/chapter/i, 'Ch.'),
      };

      if (d) {
        for (const bel of BELIEFS) {
          point[bel] = d[bel] || 0;
        }
      }

      return point;
    });
  }, [characterData, character]);

  if (!chartData.length) return null;

  const title = `Belief Systems: ${character}`;

  return (
    <ChartWrapper title={title}>
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
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
            formatter={(value, name) => [
              typeof value === 'number' ? value.toFixed(3) : value,
              BELIEF_LABELS[name] || name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => BELIEF_LABELS[value] || value}
          />
          {BELIEFS.map((bel) => (
            <Line
              key={bel}
              type="monotone"
              dataKey={bel}
              stroke={BELIEF_COLORS[bel]}
              strokeWidth={1.5}
              dot={{ r: 2, fill: BELIEF_COLORS[bel] }}
              connectNulls
              name={bel}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
