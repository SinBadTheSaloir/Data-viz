import { useState, useEffect } from 'react';
import { api } from '../api';
import BookCard from '../components/BookCard';
import HeartbeatStrip, { HeartbeatLegend } from '../components/HeartbeatStrip';
import TrajectoryChart from '../components/TrajectoryChart';
import JudgmentMercyScatter from '../components/JudgmentMercyScatter';
import BookTooltip from '../components/BookTooltip';
import { exportCSV } from '../components/ChartExport';
import { EMOTION_COLORS, CULTURE_COLORS, CULTURE_ORDER } from '../constants';

export default function Dashboard() {
  const [books, setBooks] = useState([]);
  const [heartbeats, setHeartbeats] = useState([]);
  const [trajectories, setTrajectories] = useState([]);
  const [cultureAverages, setCultureAverages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cultureFilter, setCultureFilter] = useState(null);
  const [sortBy, setSortBy] = useState('culture');
  const [showAverages, setShowAverages] = useState(true);
  const [config, setConfig] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getBooks(),
      api.getAllHeartbeats(),
      api.getAllTrajectories(),
      api.getCultureAverages().catch(() => null),
      api.getConfig().catch(() => null),
    ]).then(([b, h, t, ca, cfg]) => {
      setBooks(b);
      setHeartbeats(h);
      setTrajectories(t);
      setCultureAverages(ca);
      // store config for provenance/legend (cfg from /api/config)
      setConfig(cfg);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-text-muted text-lg">Loading narrative data...</div>
      </div>
    );
  }

  // Filter & sort
  let filteredBooks = cultureFilter
    ? books.filter((b) => b.culture === cultureFilter)
    : books;

  if (sortBy === 'culture') {
    filteredBooks = [...filteredBooks].sort(
      (a, b) => CULTURE_ORDER.indexOf(a.culture) - CULTURE_ORDER.indexOf(b.culture)
    );
  } else if (sortBy === 'blocks') {
    filteredBooks = [...filteredBooks].sort((a, b) => b.total_blocks - a.total_blocks);
  } else if (sortBy === 'judgment') {
    filteredBooks = [...filteredBooks].sort((a, b) => b.judgment_per_block - a.judgment_per_block);
  } else if (sortBy === 'hope') {
    filteredBooks = [...filteredBooks].sort(
      (a, b) => (b.emotion_totals?.hope || 0) - (a.emotion_totals?.hope || 0)
    );
  }

  const filteredIds = new Set(filteredBooks.map((b) => b.book_id));
  const filteredHeartbeats = heartbeats.filter((h) => filteredIds.has(h.book_id));
  const filteredTrajectories = trajectories.filter((t) => filteredIds.has(t.book_id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          Library
        </h2>
        <p className="text-text-muted text-sm mt-1">
          {books.length} books across {new Set(books.map((b) => b.culture)).size} cultures
          &mdash; {books.reduce((a, b) => a + b.total_blocks, 0).toLocaleString()} blocks analyzed
        </p>
        {/* Quick actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            className="px-3 py-1 rounded-full text-xs border border-border text-text-secondary hover:text-text-primary"
            onClick={() => {
              exportCSV(filteredBooks, 'books_export.csv');
            }}
          >
            Export CSV
          </button>
          <button
            className="px-3 py-1 rounded-full text-xs border border-border text-text-secondary hover:text-text-primary"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('culture', cultureFilter || '');
              url.searchParams.set('sort', sortBy);
              url.searchParams.set('averages', showAverages ? '1' : '0');
              navigator.clipboard.writeText(url.toString()).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Link copied' : 'Copy permalink'}
          </button>
          <button
            className="px-3 py-1 rounded-full text-xs border border-border text-text-secondary hover:text-text-primary"
            onClick={() => setAboutOpen(true)}
          >
            About data
          </button>
        </div>
      </div>

      {/* Culture legend */}
      <div className="mt-4 flex items-center gap-4">
        {Object.entries(CULTURE_COLORS).map(([c, col]) => (
          <div key={c} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col }} />
            <div className="text-xs text-text-secondary">{c}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted uppercase tracking-wider">Culture:</span>
        <button
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            !cultureFilter
              ? 'bg-text-muted/20 border-text-muted text-text-primary'
              : 'border-border text-text-secondary hover:border-text-muted'
          }`}
          onClick={() => setCultureFilter(null)}
        >
          All
        </button>
        {CULTURE_ORDER.map((c) => (
          <button
            key={c}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              cultureFilter === c
                ? 'border-text-muted text-text-primary'
                : 'border-border text-text-secondary hover:border-text-muted'
            }`}
            style={
              cultureFilter === c
                ? { backgroundColor: `${CULTURE_COLORS[c]}20`, borderColor: `${CULTURE_COLORS[c]}60` }
                : {}
            }
            onClick={() => setCultureFilter(cultureFilter === c ? null : c)}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: CULTURE_COLORS[c] }}
            />
            {c}
          </button>
        ))}

        <span className="text-xs text-text-muted uppercase tracking-wider ml-4">Sort:</span>
        {['culture', 'blocks', 'judgment', 'hope'].map((s) => (
          <button
            key={s}
            className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
              sortBy === s
                ? 'bg-text-muted/20 border-text-muted text-text-primary'
                : 'border-border text-text-secondary hover:border-text-muted'
            }`}
            onClick={() => setSortBy(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ═══ SECTION 1: Heartbeat Overview ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Story Heartbeats</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Dominant emotion per chapter &mdash; color = emotion, brightness = intensity
            </p>
          </div>
          <HeartbeatLegend />
        </div>

        <div className="space-y-2">
          {filteredHeartbeats.map((hb) => {
            const bookData = books.find((b) => b.book_id === hb.book_id);
            return (
              <HeartbeatStrip
                key={hb.book_id}
                strip={hb.blended_strip}
                label={hb.title}
                labelContent={
                  bookData ? (
                    <BookTooltip book={bookData}>
                      <span className="text-sm text-text-secondary hover:text-text-primary transition-colors truncate block text-right cursor-default">
                        {hb.title}
                      </span>
                    </BookTooltip>
                  ) : undefined
                }
                culture={hb.culture}
                height={28}
                onClick={() => window.location.href = `/book/${hb.book_id}`}
              />
            );
          })}
        </div>
      </section>

      {/* ═══ SECTION 2: Trajectory + Scatter side by side ═══ */}
      {cultureAverages && (
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              showAverages
                ? 'bg-text-muted/20 border-text-muted text-text-primary'
                : 'border-border text-text-secondary hover:border-text-muted'
            }`}
            onClick={() => setShowAverages(!showAverages)}
          >
            {showAverages ? 'Hide' : 'Show'} Culture Averages
          </button>
          {showAverages && (
            <span className="text-xs text-text-muted">Dashed lines = culture average trajectory</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <TrajectoryChart
            trajectories={filteredTrajectories}
            cultureAverages={showAverages ? cultureAverages : undefined}
            metric="hope_fear"
            title="Hope - Fear Trajectory"
            height={320}
          />
        </section>
        <section className="bg-bg-secondary border border-border rounded-xl p-6">
          <JudgmentMercyScatter
            books={filteredBooks}
            height={320}
          />
        </section>
      </div>

      {/* ═══ SECTION 3: Mercy-Judgment Trajectory ═══ */}
      <section className="bg-bg-secondary border border-border rounded-xl p-6">
        <TrajectoryChart
          trajectories={filteredTrajectories}
          cultureAverages={showAverages ? cultureAverages : undefined}
          metric="mercy_judgment"
          title="Mercy - Judgment Trajectory"
          height={280}
        />
      </section>

      {/* ═══ SECTION 4: Book Cards Grid ═══ */}
      <section>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Book Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBooks.map((book) => (
            <BookCard key={book.book_id} book={book} />
          ))}
        </div>
      </section>

      {/* About / provenance modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAboutOpen(false)} />
          <div className="relative bg-bg-card border border-border rounded-lg p-6 w-11/12 max-w-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-text-primary">About this data</h4>
                <div className="text-xs text-text-muted">Provenance and metric definitions</div>
              </div>
              <button className="text-sm text-text-secondary" onClick={() => setAboutOpen(false)}>Close</button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-text-secondary mb-2">Emotions</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(EMOTION_COLORS).map(([e, c]) => (
                    <div key={e} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: c }} />
                      <div className="text-xs text-text-secondary capitalize">{e}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-text-secondary mb-2">Data & Metrics</div>
                <div className="text-xs text-text-muted mb-2">Source: API endpoints under <span className="font-mono">/api</span></div>
                <div className="text-xs text-text-secondary mb-1">Key metrics</div>
                <ul className="list-disc list-inside text-xs text-text-muted">
                  <li><strong>Hope - Fear:</strong> aggregated difference of hope and fear scores across progress</li>
                  <li><strong>Mercy - Judgment:</strong> aggregated mercy vs judgment per block</li>
                  <li><strong>Culture averages:</strong> mean trajectory across books in culture</li>
                </ul>
                {config && (
                  <div className="mt-3 text-xs text-text-muted">
                    Config loaded from API. Books: {Object.keys(config.books || {}).length}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
