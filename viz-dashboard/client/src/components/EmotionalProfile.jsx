import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { EMOTIONS, EMOTION_COLORS } from '../constants';
import ChartWrapper from './ChartExport';

/**
 * EmotionalProfile — Shows proportional emotion breakdown per character.
 * Two views: Stacked bar (for multi-character comparison) and Radar (for 1-2 characters).
 *
 * Props:
 *   - characterData: full character-data API response
 *   - characters: array of character names to compare (1-5)
 *   - mode: 'bar' | 'radar' (default: 'bar')
 */
export default function EmotionalProfile({ characterData, characters, mode = 'bar' }) {
  // Compute total emotion values per character (absolute values, proportional)
  const profileData = useMemo(() => {
    if (!characterData?.character_chapters || !characters?.length) return [];

    return characters.map((char) => {
      const chapters = characterData.character_chapters[char] || [];
      const totals = {};
      for (const emo of EMOTIONS) {
        totals[emo] = chapters.reduce((sum, ch) => sum + Math.abs(ch[emo] || 0), 0);
      }
      const totalAll = Object.values(totals).reduce((a, b) => a + b, 0) || 1;

      return {
        name: char,
        ...totals,
        total: totalAll,
        // Percentage versions for stacked bar
        ...Object.fromEntries(
          EMOTIONS.map((emo) => [`pct_${emo}`, (totals[emo] / totalAll) * 100])
        ),
      };
    });
  }, [characterData, characters]);

  // Radar data format
  const radarData = useMemo(() => {
    if (!profileData.length) return [];

    return EMOTIONS.map((emo) => {
      const point = { emotion: emo };
      for (const charData of profileData) {
        // Normalize to 0-100 scale relative to this character's max
        const maxVal = Math.max(...EMOTIONS.map((e) => charData[e])) || 1;
        point[charData.name] = (charData[emo] / maxVal) * 100;
      }
      return point;
    });
  }, [profileData]);

  if (!profileData.length) return null;

  const title = characters.length === 1
    ? `Emotional Profile: ${characters[0]}`
    : `Emotional Profile Comparison`;

  if (mode === 'radar') {
    const radarColors = ['#22C55E', '#EF4444', '#3B82F6', '#EAB308', '#A855F7'];
    return (
      <ChartWrapper title={title}>
        <h3 className="text-sm font-semibold text-text-secondary mb-3">{title}</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#2a2a3d" />
            <PolarAngleAxis
              dataKey="emotion"
              tick={{ fontSize: 11, fill: '#8888a0' }}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 9, fill: '#5c5c72' }}
              stroke="#2a2a3d"
            />
            {characters.map((char, idx) => (
              <Radar
                key={char}
                name={char}
                dataKey={char}
                stroke={radarColors[idx]}
                fill={radarColors[idx]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: '#1c1c27',
                border: '1px solid #2a2a3d',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [`${value.toFixed(1)}%`, '']}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // Stacked bar mode (proportional 100% bars)
  return (
    <ChartWrapper title={title}>
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(220, characters.length * 55 + 80)}>
        <BarChart
          data={profileData}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 100 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            tickFormatter={(v) => `${Math.round(v)}%`}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#8888a0' }}
            width={95}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const emo = name.replace('pct_', '');
              return [`${value.toFixed(1)}%`, emo];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => value.replace('pct_', '')}
          />
          {EMOTIONS.map((emo) => (
            <Bar
              key={emo}
              dataKey={`pct_${emo}`}
              stackId="emotions"
              fill={EMOTION_COLORS[emo]}
              name={`pct_${emo}`}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
