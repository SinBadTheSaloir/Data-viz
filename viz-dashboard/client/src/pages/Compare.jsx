import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../api';
import HeartbeatStrip, { HeartbeatLegend } from '../components/HeartbeatStrip';
import TrajectoryChart from '../components/TrajectoryChart';
import { CULTURE_COLORS, EMOTION_COLORS, EMOTIONS, CULTURE_ORDER } from '../constants';

export default function Compare() {
  const [books, setBooks] = useState([]);
  const [heartbeats, setHeartbeats] = useState([]);
  const [trajectories, setTrajectories] = useState([]);
  const [cultures, setCultures] = useState({});
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getBooks(),
      api.getAllHeartbeats(),
      api.getAllTrajectories(),
      api.getCultures(),
    ]).then(([b, h, t, c]) => {
      setBooks(b);
      setHeartbeats(h);
      setTrajectories(t);
      setCultures(c);
      // Pre-select first 3
      setSelected(b.slice(0, 3).map((x) => x.book_id));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-text-muted text-lg">Loading comparison data...</div>
      </div>
    );
  }

  function toggleBook(bookId) {
    setSelected((prev) =>
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : prev.length < 5
        ? [...prev, bookId]
        : prev
    );
  }

  const selectedBooks = books.filter((b) => selected.includes(b.book_id));
  const selectedHbs = heartbeats.filter((h) => selected.includes(h.book_id));
  const selectedTrajs = trajectories.filter((t) => selected.includes(t.book_id));

  // ── Culture radar data ──
  const radarData = EMOTIONS.map((emo) => {
    const point = { emotion: emo };
    for (const [culture, data] of Object.entries(cultures)) {
      point[culture] = data.emotions_per_100?.[emo] || 0;
    }
    return point;
  });

  // ── Event comparison data ──
  const allEventTypes = new Set();
  selectedBooks.forEach((b) => {
    Object.keys(b.event_counts || {}).forEach((t) => allEventTypes.add(t));
  });

  const eventCompareData = [...allEventTypes].sort().map((type) => {
    const point = { type };
    selectedBooks.forEach((b) => {
      // Normalize per 100 blocks
      const count = b.event_counts?.[type] || 0;
      point[b.book_id] = Number(((count / b.total_blocks) * 100).toFixed(1));
    });
    return point;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Compare Books</h2>
        <p className="text-text-muted text-sm mt-1">
          Select up to 5 books to compare side by side
        </p>
      </div>

      {/* Book selector */}
      <div className="flex flex-wrap gap-2">
        {books.map((b) => {
          const isSelected = selected.includes(b.book_id);
          const color = CULTURE_COLORS[b.culture];
          return (
            <button
              key={b.book_id}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                isSelected
                  ? 'text-text-primary'
                  : 'border-border text-text-muted hover:border-text-muted'
              }`}
              style={
                isSelected
                  ? { backgroundColor: `${color}20`, borderColor: `${color}60`, color }
                  : {}
              }
              onClick={() => toggleBook(b.book_id)}
            >
              {b.title}
            </button>
          );
        })}
      </div>

      {/* ═══ Heartbeat comparison ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Heartbeat Comparison</h3>
          <HeartbeatLegend />
        </div>
        <div className="space-y-2">
          {selectedHbs.map((hb) => (
            <HeartbeatStrip
              key={hb.book_id}
              strip={hb.blended_strip}
              label={hb.title}
              culture={hb.culture}
              height={32}
            />
          ))}
        </div>
      </section>

      {/* ═══ Trajectory comparison ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <TrajectoryChart
            trajectories={selectedTrajs}
            metric="hope_fear"
            title="Hope - Fear Trajectory"
            height={300}
          />
        </section>
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <TrajectoryChart
            trajectories={selectedTrajs}
            metric="mercy_judgment"
            title="Mercy - Judgment Trajectory"
            height={300}
          />
        </section>
      </div>

      {/* ═══ Cultural Fingerprint Radar ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Cultural Emotional Fingerprint
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Average emotional weight per 100 blocks, grouped by culture
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#2a2a3d" />
            <PolarAngleAxis
              dataKey="emotion"
              tick={{ fontSize: 12, fill: '#8888a0' }}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 10, fill: '#5c5c72' }}
              axisLine={false}
            />
            {CULTURE_ORDER.map((culture) => (
              <Radar
                key={culture}
                name={culture}
                dataKey={culture}
                stroke={CULTURE_COLORS[culture]}
                fill={CULTURE_COLORS[culture]}
                fillOpacity={0.1}
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
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#8888a0' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </section>

      {/* ═══ Event type comparison ═══ */}
      {selectedBooks.length > 0 && (
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Event Distribution Comparison
          </h3>
          <p className="text-xs text-text-muted mb-4">Events per 100 blocks</p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={eventCompareData}
              margin={{ top: 5, right: 20, bottom: 60, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis
                dataKey="type"
                stroke="#5c5c72"
                tick={{ fontSize: 10, fill: '#5c5c72', angle: -45, textAnchor: 'end' }}
                height={60}
              />
              <YAxis stroke="#5c5c72" tick={{ fontSize: 11, fill: '#5c5c72' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1c1c27',
                  border: '1px solid #2a2a3d',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedBooks.map((b) => (
                <Bar
                  key={b.book_id}
                  dataKey={b.book_id}
                  name={b.title}
                  fill={CULTURE_COLORS[b.culture]}
                  fillOpacity={0.8}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ═══ Stats Table ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6 overflow-x-auto">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Key Metrics Comparison
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-text-muted font-normal">Book</th>
              <th className="text-right py-2 text-text-muted font-normal">Blocks</th>
              <th className="text-right py-2 text-text-muted font-normal">Events</th>
              <th className="text-right py-2 text-text-muted font-normal">Dialogue</th>
              <th className="text-right py-2 text-text-muted font-normal">Judgment</th>
              <th className="text-right py-2 text-text-muted font-normal">Mercy</th>
              {EMOTIONS.map((e) => (
                <th key={e} className="text-right py-2 font-normal capitalize" style={{ color: EMOTION_COLORS[e] }}>
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedBooks.map((b) => (
              <tr key={b.book_id} className="border-b border-border/50 hover:bg-bg-hover">
                <td className="py-2 text-text-primary">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: CULTURE_COLORS[b.culture] }}
                  />
                  {b.title}
                </td>
                <td className="text-right py-2 font-mono text-text-secondary">{b.total_blocks}</td>
                <td className="text-right py-2 font-mono text-text-secondary">{b.total_events}</td>
                <td className="text-right py-2 font-mono text-text-secondary">{b.dialogue_percentage}%</td>
                <td className="text-right py-2 font-mono text-text-secondary">{b.judgment_per_block?.toFixed(3)}</td>
                <td className="text-right py-2 font-mono text-text-secondary">{b.mercy_per_block?.toFixed(3)}</td>
                {EMOTIONS.map((e) => (
                  <td key={e} className="text-right py-2 font-mono text-text-secondary">
                    {(b.emotion_totals?.[e] || 0).toFixed(1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
