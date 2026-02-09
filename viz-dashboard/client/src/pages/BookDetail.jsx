import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api';
import HeartbeatStrip, { HeartbeatLegend } from '../components/HeartbeatStrip';
import TrajectoryChart from '../components/TrajectoryChart';
import RelationshipGraph from '../components/RelationshipGraph';
import ChartWrapper, { exportCSV } from '../components/ChartExport';
import FortuneLine from '../components/FortuneLine';
import EmotionalFingerprint from '../components/EmotionalFingerprint';
import BeliefTracker from '../components/BeliefTracker';
import ConservationChart from '../components/ConservationChart';
import EventTimeline from '../components/EventTimeline';
import EmotionalProfile from '../components/EmotionalProfile';
import CharacterSelector from '../components/CharacterSelector';
import { CULTURE_COLORS, EMOTION_COLORS, EMOTIONS } from '../constants';

const EVENT_COLORS = [
  '#3B82F6', '#22C55E', '#EF4444', '#A855F7', '#EAB308',
  '#14B8A6', '#F97316', '#EC4899', '#6366F1', '#84CC16',
  '#06B6D4', '#F43F5E',
];

export default function BookDetail() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [heartbeat, setHeartbeat] = useState(null);
  const [trajectory, setTrajectory] = useState(null);
  const [relationships, setRelationships] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [characterDataLoading, setCharacterDataLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(null);

  // Character selection state
  const [character1, setCharacter1] = useState(null);
  const [character2, setCharacter2] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [profileMode, setProfileMode] = useState('bar'); // 'bar' or 'radar'

  useEffect(() => {
    // Core data must load; relationships + characterData are optional (graceful fallback)
    Promise.all([
      api.getBook(bookId),
      api.getHeartbeat(bookId),
      api.getTrajectory(bookId),
    ]).then(([b, h, t]) => {
      setBook(b);
      setHeartbeat(h);
      setTrajectory(t);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });

    // Relationships loaded separately so a failure doesn't block the page
    api.getRelationships(bookId)
      .then(r => setRelationships(r))
      .catch(() => setRelationships(null));

    // Character data loaded separately for the new dashboard charts
    setCharacterDataLoading(true);
    api.getCharacterData(bookId)
      .then(cd => {
        setCharacterData(cd);
        setCharacterDataLoading(false);
        // Auto-select protagonist or first character
        if (cd?.characters?.length > 0) {
          setCharacter1(cd.characters[0]);
          if (cd.characters.length > 1) {
            setCharacter2(null); // Don't auto-select second
          }
        }
      })
      .catch(err => {
        console.error('Character data load failed:', err);
        setCharacterData(null);
        setCharacterDataLoading(false);
      });
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-text-muted text-lg">Loading book data...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center text-text-muted py-20">
        Book not found.{' '}
        <button className="text-culture-english underline" onClick={() => navigate('/')}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const cultureColor = CULTURE_COLORS[book.culture] || '#888';

  // Character emotion data for bar chart
  const charEmotionData = (book.characters || []).slice(0, 8).map((c) => ({
    name: c.name,
    appearances: c.appearances,
    ...c.emotions,
  }));

  // Event distribution for pie chart
  const eventData = Object.entries(book.event_counts || {})
    .map(([type, count]) => ({ name: type, value: count }))
    .sort((a, b) => b.value - a.value);

  // Block type data
  const blockTypeData = Object.entries(book.block_types || {}).map(([type, count]) => ({
    name: type,
    value: count,
    percentage: ((count / book.total_blocks) * 100).toFixed(1),
  }));

  // Characters for profile comparison (top 5)
  const profileCharacters = characterData?.characters?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      {/* Back button + Header */}
      <div>
        <button
          className="text-text-muted text-sm hover:text-text-primary transition-colors mb-3 cursor-pointer
                     bg-bg-secondary border border-border rounded-lg px-3 py-1.5 hover:bg-bg-card"
          onClick={() => navigate('/')}
        >
          &larr; Library
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-text-primary m-0">{book.title}</h2>
            <p className="text-text-secondary mt-1 m-0">{book.author}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="text-xs text-text-muted hover:text-text-primary bg-bg-secondary border border-border
                         rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
              onClick={() => {
                const rows = (book.characters || []).map((c) => ({
                  name: c.name,
                  appearances: c.appearances,
                  dominant_emotion: c.dominant_emotion,
                  ...c.emotions,
                }));
                exportCSV(rows, `${book.book_id}_characters.csv`);
              }}
            >
              Export CSV
            </button>
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${cultureColor}20`,
              color: cultureColor,
              border: `1px solid ${cultureColor}40`,
            }}
          >
            {book.culture}
          </span>
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3 mt-4">
          {[
            { label: 'Blocks', value: book.total_blocks },
            { label: 'Chapters', value: book.total_chapters },
            { label: 'Words', value: book.total_words?.toLocaleString() },
            { label: 'Events', value: book.total_events },
            { label: 'Characters', value: book.characters?.length },
            { label: 'Dialogue', value: `${book.dialogue_percentage}%` },
            { label: 'Judgment', value: book.judgment_per_block?.toFixed(3) },
            { label: 'Mercy', value: book.mercy_per_block?.toFixed(3) },
            {
              label: 'Top Emotion',
              value: (() => {
                const best = EMOTIONS.reduce((a, b) =>
                  Math.abs(book.emotion_totals?.[a] || 0) >= Math.abs(book.emotion_totals?.[b] || 0) ? a : b
                );
                return best;
              })(),
              color: (() => {
                const best = EMOTIONS.reduce((a, b) =>
                  Math.abs(book.emotion_totals?.[a] || 0) >= Math.abs(book.emotion_totals?.[b] || 0) ? a : b
                );
                return EMOTION_COLORS[best];
              })(),
            },
            {
              label: 'Top Event',
              value: (() => {
                const entries = Object.entries(book.event_counts || {});
                if (entries.length === 0) return '—';
                return entries.sort((a, b) => b[1] - a[1])[0][0];
              })(),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-bg-secondary border border-border rounded-lg px-3 py-2.5 text-center"
            >
              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">{stat.label}</div>
              <div
                className="text-base font-mono text-text-primary capitalize truncate"
                style={stat.color ? { color: stat.color } : {}}
                title={String(stat.value)}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Chapter extremes callouts ═══ */}
      {heartbeat?.blended_strip && heartbeat.blended_strip.length > 0 && (() => {
        const strip = heartbeat.blended_strip;
        const mostHopeful = strip.reduce((best, ch) =>
          (ch.emotions?.hope || 0) > (best.emotions?.hope || 0) ? ch : best
        , strip[0]);
        const darkest = strip.reduce((best, ch) =>
          (ch.emotions?.fear || 0) > (best.emotions?.fear || 0) ? ch : best
        , strip[0]);
        const mostIntense = strip.reduce((best, ch) =>
          (ch.intensity || 0) > (best.intensity || 0) ? ch : best
        , strip[0]);

        const formatChapter = (ch) => ch?.chapter?.replace(/_/g, ' ').replace(/chapter/i, 'Ch.') || '—';

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-secondary border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: EMOTION_COLORS.hope }} />
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Most Hopeful Chapter</div>
                <div className="text-sm font-semibold text-text-primary capitalize">{formatChapter(mostHopeful)}</div>
                <div className="text-xs text-text-muted font-mono mt-0.5">Hope: {(mostHopeful.emotions?.hope || 0).toFixed(2)}</div>
              </div>
            </div>
            <div className="bg-bg-secondary border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: EMOTION_COLORS.fear }} />
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Darkest Chapter</div>
                <div className="text-sm font-semibold text-text-primary capitalize">{formatChapter(darkest)}</div>
                <div className="text-xs text-text-muted font-mono mt-0.5">Fear: {(darkest.emotions?.fear || 0).toFixed(2)}</div>
              </div>
            </div>
            <div className="bg-bg-secondary border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: '#EAB308' }} />
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Most Intense Chapter</div>
                <div className="text-sm font-semibold text-text-primary capitalize">{formatChapter(mostIntense)}</div>
                <div className="text-xs text-text-muted font-mono mt-0.5">Intensity: {(mostIntense.intensity || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ SECTION 1: Character Heartbeats ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Character Heartbeats</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Emotional trajectory per character across chapters &mdash; gaps show absence
            </p>
          </div>
          <HeartbeatLegend />
        </div>

        {/* Blended strip first */}
        <div className="mb-3 pb-3 border-b border-border">
          <HeartbeatStrip
            strip={heartbeat?.blended_strip}
            label="Whole Story"
            culture={book.culture}
            height={36}
            onSegmentClick={(idx, seg) => {
              setSelectedChapter(seg);
              setSelectedChapterIdx(selectedChapterIdx === idx ? null : idx);
              if (selectedChapterIdx === idx) setSelectedChapter(null);
            }}
            activeSegmentIdx={selectedChapterIdx}
          />
        </div>

        {/* Chapter detail panel */}
        {selectedChapter && (
          <div className="mb-3 p-4 bg-bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-text-primary">
                {selectedChapter.chapter?.replace(/_/g, ' ').replace(/chapter/i, 'Chapter')}
              </h4>
              <button
                className="text-xs text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
                onClick={() => { setSelectedChapter(null); setSelectedChapterIdx(null); }}
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
              {Object.entries(selectedChapter.emotions || {})
                .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a))
                .map(([emo, val]) => (
                <div key={emo} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTION_COLORS[emo] }} />
                  <span className="text-xs text-text-secondary capitalize">{emo}</span>
                  <span className="text-xs font-mono text-text-primary">
                    {typeof val === 'number' ? val.toFixed(2) : val}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-text-muted">
              <span>Dominant: <span className="text-text-secondary capitalize" style={{ color: EMOTION_COLORS[selectedChapter.dominant] }}>{selectedChapter.dominant}</span></span>
              <span>Intensity: <span className="text-text-secondary font-mono">{selectedChapter.intensity?.toFixed(2)}</span></span>
              {selectedChapter.judgment !== undefined && (
                <>
                  <span>Judgment: <span className="text-text-secondary font-mono">{selectedChapter.judgment?.toFixed(2)}</span></span>
                  <span>Mercy: <span className="text-text-secondary font-mono">{selectedChapter.mercy?.toFixed(2)}</span></span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Per-character strips */}
        <div className="space-y-1.5">
          {(heartbeat?.top_characters || []).map((charName) => (
            <HeartbeatStrip
              key={charName}
              strip={heartbeat?.character_strips?.[charName]}
              label={charName}
              height={26}
            />
          ))}
        </div>
      </section>

      {/* ═══ SECTION 2: Story Trajectory ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        {trajectory && (
          <TrajectoryChart
            trajectories={[trajectory]}
            metric="hope_fear"
            title={`${book.protagonist}'s Hope - Fear Trajectory`}
            height={300}
          />
        )}
      </section>

      {/* ═══ SECTION 2.5: Relationship Graph ═══ */}
      {relationships && relationships.nodes?.length > 0 && (
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-text-primary">
              Character Relationships
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Pairs, factions &amp; emotional dynamics &mdash; click nodes or edges for details
            </p>
          </div>

          {/* Summary stats strip */}
          <div className="flex flex-wrap gap-3 mb-4">
            {(() => {
              const spirals = relationships.edges.filter(e => e.relationship_type === 'spiral_couple' || e.relationship_type === 'mirror').length;
              const allies = relationships.edges.filter(e => e.relationship_type === 'allies' || e.relationship_type === 'uneasy_allies').length;
              const enemies = relationships.edges.filter(e => e.relationship_type === 'enemies' || e.relationship_type === 'rivals' || e.relationship_type === 'nemesis').length;
              const inversions = relationships.edges.filter(e => e.emotional_pattern === 'inversion').length;
              const arcShifts = relationships.nodes.filter(n => n.arc_shift).length;

              return [
                { label: 'Relationships', value: relationships.edges.length, color: '#8B5CF6' },
                { label: 'Alliances', value: allies, color: '#22C55E' },
                { label: 'Conflicts', value: enemies, color: '#EF4444' },
                { label: 'Spiral/Mirror', value: spirals, color: '#F59E0B' },
                { label: 'Inversions', value: inversions, color: '#06B6D4' },
                { label: 'Arc Shifts', value: arcShifts, color: '#EC4899' },
                { label: 'Factions', value: relationships.clusters.length, color: '#A855F7' },
              ].map(s => (
                <div key={s.label} className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-center min-w-[80px]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">{s.label}</div>
                  <div className="text-base font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ));
            })()}
          </div>

          <RelationshipGraph data={relationships} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ═══ NEW DASHBOARD: Character Deep Dive ═══ */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Loading state for character data */}
      {characterDataLoading && !characterData && (
        <section className="bg-bg-secondary border border-border rounded-xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted text-sm">Loading character analysis...</span>
          </div>
        </section>
      )}

      {characterData && (
        <>
          {/* Section divider */}
          <div className="border-t border-border pt-2">
            <h2 className="text-xl font-bold text-text-primary">Character Deep Dive</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Per-character emotional, belief, and event analysis across chapters
            </p>
          </div>

          {/* Character Selector Bar */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <CharacterSelector
              characters={characterData.characters || []}
              character1={character1}
              character2={character2}
              onCharacter1Change={setCharacter1}
              onCharacter2Change={setCharacter2}
              showSecond={showComparison}
            />
            <div className="flex items-center gap-3">
              <button
                className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  showComparison
                    ? 'bg-culture-english/20 border-culture-english/40 text-culture-english'
                    : 'bg-transparent border-border text-text-muted hover:text-text-primary'
                }`}
                onClick={() => {
                  setShowComparison(!showComparison);
                  if (!showComparison && characterData.characters?.length > 1) {
                    // Auto-select second character
                    const second = characterData.characters.find(c => c !== character1);
                    setCharacter2(second || null);
                  } else {
                    setCharacter2(null);
                  }
                }}
              >
                {showComparison ? 'Single Character' : 'Compare Two'}
              </button>
              <button
                className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  profileMode === 'radar'
                    ? 'bg-culture-english/20 border-culture-english/40 text-culture-english'
                    : 'bg-transparent border-border text-text-muted hover:text-text-primary'
                }`}
                onClick={() => setProfileMode(profileMode === 'bar' ? 'radar' : 'bar')}
              >
                {profileMode === 'radar' ? 'Bar View' : 'Radar View'}
              </button>
            </div>
          </div>

          {/* ═══ Fortune Line (net positive/negative over time) ═══ */}
          <section className="bg-bg-secondary border border-border rounded-xl p-6">
            <FortuneLine
              characterData={characterData}
              character1={character1}
              character2={showComparison ? character2 : null}
              title={showComparison && character2
                ? `Fortune: ${character1} vs ${character2}`
                : `Fortune: ${character1}`}
            />
          </section>

          {/* ═══ Emotional Fingerprint + Belief Tracker side by side ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-bg-secondary border border-border rounded-xl p-6">
              <EmotionalFingerprint
                characterData={characterData}
                character={character1}
              />
            </section>

            <section className="bg-bg-secondary border border-border rounded-xl p-6">
              <BeliefTracker
                characterData={characterData}
                character={character1}
              />
            </section>
          </div>

          {/* ═══ Second character's Fingerprint + Beliefs (if comparing) ═══ */}
          {showComparison && character2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-bg-secondary border border-border rounded-xl p-6">
                <EmotionalFingerprint
                  characterData={characterData}
                  character={character2}
                />
              </section>

              <section className="bg-bg-secondary border border-border rounded-xl p-6">
                <BeliefTracker
                  characterData={characterData}
                  character={character2}
                />
              </section>
            </div>
          )}

          {/* ═══ Emotional Profile (stacked bar or radar) ═══ */}
          <section className="bg-bg-secondary border border-border rounded-xl p-6">
            <EmotionalProfile
              characterData={characterData}
              characters={
                showComparison && character2
                  ? [character1, character2]
                  : profileCharacters
              }
              mode={profileMode}
            />
          </section>

          {/* ═══ Conservation Chart ═══ */}
          <section className="bg-bg-secondary border border-border rounded-xl p-6">
            <ConservationChart
              characterData={characterData}
              title={`Emotional Conservation — ${book.title}`}
            />
          </section>

          {/* ═══ Event Timeline Strip ═══ */}
          <section className="bg-bg-secondary border border-border rounded-xl p-6">
            <EventTimeline
              characterData={characterData}
              highlightCharacter={character1}
            />
          </section>
        </>
      )}

      {/* ═══ SECTION 3: Character Emotions + Events side by side ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Character emotions bar chart */}
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
         <ChartWrapper title={`${book.title} - Character Emotional Profiles`}>
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            Character Emotional Profiles
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={charEmotionData}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis type="number" stroke="#5c5c72" tick={{ fontSize: 11, fill: '#5c5c72' }} />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#5c5c72"
                tick={{ fontSize: 11, fill: '#8888a0' }}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1c1c27',
                  border: '1px solid #2a2a3d',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#8888a0', paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {EMOTIONS.map((emo) => (
                <Bar
                  key={emo}
                  dataKey={emo}
                  stackId="emotions"
                  fill={EMOTION_COLORS[emo]}
                  name={emo}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
         </ChartWrapper>
        </section>

        {/* Event distribution pie chart */}
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
         <ChartWrapper title={`${book.title} - Event Distribution`}>
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            Event Distribution ({book.total_events} total)
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={eventData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={60}
                paddingAngle={2}
                label={({ name, percent }) =>
                  percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={{ stroke: '#5c5c72' }}
              >
                {eventData.map((_, idx) => (
                  <Cell key={idx} fill={EVENT_COLORS[idx % EVENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1c1c27',
                  border: '1px solid #2a2a3d',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
         </ChartWrapper>
        </section>
      </div>

      {/* ═══ SECTION 4: Block type + Emotion totals ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Block types */}
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-secondary mb-4">
            Narrative Structure
          </h3>
          <div className="space-y-3">
            {blockTypeData.map((bt) => (
              <div key={bt.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">{bt.name}</span>
                  <span className="text-text-muted font-mono">{bt.value} ({bt.percentage}%)</span>
                </div>
                <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${bt.percentage}%`,
                      backgroundColor: bt.name === 'ACTION' ? '#3B82F6' : bt.name === 'NARRATOR' ? '#A855F7' : '#14B8A6',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Emotion totals */}
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-secondary mb-4">
            Total Emotional Weight
          </h3>
          <div className="space-y-3">
            {EMOTIONS.map((emo) => {
              const val = book.emotion_totals?.[emo] || 0;
              const maxVal = Math.max(...Object.values(book.emotion_totals || {}), 1);
              const pct = (Math.abs(val) / maxVal) * 100;
              return (
                <div key={emo}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary capitalize">{emo}</span>
                    <span className="text-text-muted font-mono">{val.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: EMOTION_COLORS[emo],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
