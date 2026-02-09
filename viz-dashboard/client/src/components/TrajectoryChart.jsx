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
} from 'recharts';
import { CULTURE_COLORS } from '../constants';

/**
 * TrajectoryChart — shows cumulative hope trajectory for one or more books.
 *
 * Props:
 *   - trajectories: array of { book_id, title, culture, points }
 *   - cultureAverages: optional object { culture: { points: [{ progress, hope_fear, mercy_judgment }] } }
 *   - metric: 'hope_fear' | 'mercy_judgment' | 'cum_hope' | 'cum_fear'
 *   - height: chart height
 */
export default function TrajectoryChart({
  trajectories,
  cultureAverages,
  metric = 'hope_fear',
  height = 300,
  title = 'Story Trajectory',
}) {
  // Normalize all trajectories to 100 points for fair comparison
  const normalizedData = useMemo(() => {
    const POINTS = 100;
    const data = [];

    // Determine which cultures have averages to show
    const avgCultures = cultureAverages ? Object.keys(cultureAverages) : [];

    for (let i = 0; i <= POINTS; i++) {
      const point = { progress: i };
      for (const traj of trajectories) {
        const pts = traj.points;
        if (!pts || pts.length === 0) continue;
        // Find closest point by progress
        const targetProgress = i;
        let closest = pts[0];
        let minDist = Math.abs(pts[0].progress - targetProgress);
        for (const p of pts) {
          const dist = Math.abs(p.progress - targetProgress);
          if (dist < minDist) {
            minDist = dist;
            closest = p;
          }
        }
        point[traj.book_id] = closest[metric] || 0;
      }

      // Add culture averages
      for (const culture of avgCultures) {
        const avgPts = cultureAverages[culture]?.points;
        if (!avgPts || avgPts.length === 0) continue;
        const targetProgress = i;
        let closest = avgPts[0];
        let minDist = Math.abs(avgPts[0].progress - targetProgress);
        for (const p of avgPts) {
          const dist = Math.abs(p.progress - targetProgress);
          if (dist < minDist) {
            minDist = dist;
            closest = p;
          }
        }
        point[`avg_${culture}`] = closest[metric] || 0;
      }

      data.push(point);
    }
    return data;
  }, [trajectories, cultureAverages, metric]);

  const metricLabels = {
    hope_fear: 'Hope - Fear (cumulative)',
    mercy_judgment: 'Mercy - Judgment (cumulative)',
    cum_hope: 'Cumulative Hope',
    cum_fear: 'Cumulative Fear',
  };

  const avgCultures = cultureAverages ? Object.keys(cultureAverages) : [];

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={normalizedData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
          <XAxis
            dataKey="progress"
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            label={{ value: 'Story Progress %', position: 'bottom', offset: 5, fill: '#5c5c72', fontSize: 11 }}
          />
          <YAxis
            stroke="#5c5c72"
            tick={{ fontSize: 11, fill: '#5c5c72' }}
            label={{ value: metricLabels[metric], angle: -90, position: 'left', offset: 5, fill: '#5c5c72', fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="#5c5c72" strokeDasharray="5 5" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c27',
              border: '1px solid #2a2a3d',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `Progress: ${v}%`}
            formatter={(value, name) => {
              if (name.startsWith('avg_')) {
                const culture = name.replace('avg_', '');
                return [value.toFixed(2), `${culture} avg`];
              }
              const traj = trajectories.find((t) => t.book_id === name);
              return [value.toFixed(2), traj?.title || name];
            }}
          />
          {/* Culture average lines (rendered first, behind book lines) */}
          {avgCultures.map((culture) => (
            <Line
              key={`avg_${culture}`}
              type="monotone"
              dataKey={`avg_${culture}`}
              stroke={CULTURE_COLORS[culture] || '#888'}
              strokeWidth={3}
              strokeOpacity={0.25}
              strokeDasharray="8 4"
              dot={false}
              name={`avg_${culture}`}
            />
          ))}
          {/* Individual book lines */}
          {trajectories.map((traj) => (
            <Line
              key={traj.book_id}
              type="monotone"
              dataKey={traj.book_id}
              stroke={CULTURE_COLORS[traj.culture] || '#888'}
              strokeWidth={2}
              dot={false}
              name={traj.book_id}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
