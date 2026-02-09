import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import ChartWrapper from './ChartExport';

/**
 * ConservationChart — Shows emotional conservation hypothesis.
 * Plots net_positive (green), net_negative (red), and total_energy (white) over chapters.
 * If the white line stays flat, emotional energy is conserved in the narrative.
 *
 * Props:
 *   - characterData: full character-data API response
 *   - title: optional override title
 */
export default function ConservationChart({ characterData, title }) {
  const chartData = useMemo(() => {
    if (!characterData?.conservation) return [];

    return characterData.conservation.map((d, idx) => ({
      chapter: idx + 1,
      chapterLabel: d.chapter.replace(/_/g, ' ').replace(/chapter/i, 'Ch.'),
      net_positive: d.net_positive,
      net_negative: d.net_negative,
      total_energy: d.total_energy,
    }));
  }, [characterData]);

  if (!chartData.length) return null;

  // Compute mean of total energy for reference line
  const meanEnergy = useMemo(() => {
    if (!chartData.length) return 0;
    const sum = chartData.reduce((acc, d) => acc + (d.total_energy || 0), 0);
    return sum / chartData.length;
  }, [chartData]);

  const chartTitle = title || `Emotional Conservation`;

  return (
    <ChartWrapper title={chartTitle}>
      <h3 className="text-sm font-semibold text-text-secondary mb-1">{chartTitle}</h3>
      <p className="text-[10px] text-text-muted mb-3">
        If the white line stays flat, emotional energy is conserved &mdash; positive and negative swap but total holds
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
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
          <ReferenceLine
            y={meanEnergy}
            stroke="#ffffff40"
            strokeDasharray="8 4"
            label={{
              value: `Mean: ${meanEnergy.toFixed(2)}`,
              position: 'right',
              fill: '#ffffff60',
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => chartData[v - 1]?.chapterLabel || `Ch. ${v}`}
            formatter={(value, name) => {
              const labels = {
                net_positive: 'Positive Energy',
                net_negative: 'Negative Energy',
                total_energy: 'Total Energy',
              };
              return [typeof value === 'number' ? value.toFixed(3) : value, labels[name] || name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="line"
            formatter={(value) => {
              const labels = {
                net_positive: 'Positive',
                net_negative: 'Negative',
                total_energy: 'Total',
              };
              return labels[value] || value;
            }}
          />

          {/* Positive energy area + line */}
          <Area
            type="monotone"
            dataKey="net_positive"
            fill="#44BB4420"
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="net_positive"
            stroke="#44BB44"
            strokeWidth={2}
            dot={{ r: 2, fill: '#44BB44' }}
            name="net_positive"
          />

          {/* Negative energy area + line */}
          <Area
            type="monotone"
            dataKey="net_negative"
            fill="#FF444420"
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="net_negative"
            stroke="#FF4444"
            strokeWidth={2}
            dot={{ r: 2, fill: '#FF4444' }}
            name="net_negative"
          />

          {/* Total energy line (the conservation indicator) */}
          <Line
            type="monotone"
            dataKey="total_energy"
            stroke="#FFFFFF"
            strokeWidth={3}
            dot={{ r: 3, fill: '#FFFFFF', stroke: '#FFFFFF' }}
            name="total_energy"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
