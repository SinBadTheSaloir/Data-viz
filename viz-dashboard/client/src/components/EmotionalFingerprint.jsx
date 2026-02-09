import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { EMOTIONS, EMOTION_COLORS } from '../constants';
import ChartWrapper from './ChartExport';

/**
 * EmotionalFingerprint — 6 emotion lines over time for a single character.
 * Shows anger, fear, hope, resolve, shame, pride across chapters.
 *
 * Props:
 *   - characterData: full character-data API response
 *   - character: character name
 */
export default function EmotionalFingerprint({ characterData, character }) {
  const chartData = useMemo(() => {
    if (!characterData?.character_chapters || !character) return [];

    const chapters = characterData.chapters || [];
    const charChapters = characterData.character_chapters[character] || [];

    const lookup = {};
    for (const d of charChapters) lookup[d.chapter] = d;

    return chapters.map((ch, idx) => {
      const d = lookup[ch];
      const point = {
        chapter: idx + 1,
        chapterLabel: ch.replace(/_/g, ' ').replace(/chapter/i, 'Ch.'),
      };

      if (d && d.appearances > 0) {
        for (const emo of EMOTIONS) {
          point[emo] = d[emo] || 0;
        }
      }

      return point;
    });
  }, [characterData, character]);

  if (!chartData.length) return null;

  const title = `Emotional Fingerprint: ${character}`;

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
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => chartData[v - 1]?.chapterLabel || `Ch. ${v}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          {EMOTIONS.map((emo) => (
            <Line
              key={emo}
              type="monotone"
              dataKey={emo}
              stroke={EMOTION_COLORS[emo]}
              strokeWidth={1.5}
              dot={{ r: 2, fill: EMOTION_COLORS[emo] }}
              connectNulls
              name={emo}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
