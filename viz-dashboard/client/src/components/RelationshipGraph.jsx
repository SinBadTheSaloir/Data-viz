import { useState, useRef, useEffect, useMemo } from 'react';
import { EMOTION_COLORS } from '../constants';

/*
 * ─── colour map for relationship types ───
 */
const REL_COLORS = {
  allies: '#22C55E',
  uneasy_allies: '#86EFAC',
  spiral_couple: '#F59E0B',
  mirror: '#EAB308',
  enemies: '#EF4444',
  rivals: '#F97316',
  nemesis: '#DC2626',
  complex: '#8B5CF6',
  neutral: '#6B7280',
};

const REL_LABELS = {
  allies: 'Allies',
  uneasy_allies: 'Uneasy Allies',
  spiral_couple: 'Spiral Couple',
  mirror: 'Mirror Pair',
  enemies: 'Enemies',
  rivals: 'Rivals',
  nemesis: 'Nemesis',
  complex: 'Complex',
  neutral: 'Neutral',
};

/* Hostile relationship types — these push nodes APART */
const HOSTILE_TYPES = new Set(['enemies', 'rivals', 'nemesis']);
/* Friendly types — pull nodes TOGETHER */
const FRIENDLY_TYPES = new Set(['allies', 'uneasy_allies', 'spiral_couple', 'mirror']);

const ROLE_COLORS = {
  protagonist: '#3B82F6',
  antagonist: '#EF4444',
  ally: '#22C55E',
  supporting: '#8888A0',
};

const PATTERN_ICONS = {
  convergent: '↗↗',
  divergent: '↗↙',
  inversion: '⟲',
  independent: '∥',
  insufficient_data: '—',
};

/*
 * ─── cluster-aware, sentiment-driven force layout ───
 * Enemies & rivals are pushed apart.  Allies are pulled together.
 * Members of the same cluster gravitate towards a shared centroid.
 */
function computeLayout(nodes, edges, clusters, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Build cluster membership lookup
  const clusterOf = {};
  (clusters || []).forEach((cl) => {
    cl.members.forEach((m) => { clusterOf[m] = cl.cluster_id; });
  });

  // Assign cluster centroids spread across the canvas — use full width
  const numClusters = (clusters || []).length;
  const clusterCentroids = {};
  if (numClusters === 1) {
    // Single cluster: center it
    clusterCentroids[(clusters || [])[0].cluster_id] = { x: cx, y: cy };
  } else if (numClusters === 2) {
    // Two clusters: place left and right for maximum separation
    clusterCentroids[(clusters || [])[0].cluster_id] = { x: width * 0.28, y: cy };
    clusterCentroids[(clusters || [])[1].cluster_id] = { x: width * 0.72, y: cy };
  } else {
    // 3+ clusters: ring layout with generous spread
    const spreadX = width * 0.3;
    const spreadY = height * 0.28;
    (clusters || []).forEach((cl, i) => {
      const angle = (2 * Math.PI * i) / numClusters - Math.PI / 2;
      clusterCentroids[cl.cluster_id] = {
        x: cx + spreadX * Math.cos(angle),
        y: cy + spreadY * Math.sin(angle),
      };
    });
  }

  // Un-clustered nodes go to a neutral zone (between clusters or at center)
  const unclusteredCenter = { x: cx, y: cy };

  // Initialise positions: cluster members near their centroid, others around center
  const positions = {};
  nodes.forEach((n, i) => {
    const cId = clusterOf[n.id];
    const home = cId !== undefined ? clusterCentroids[cId] : unclusteredCenter;
    // Small jitter so identical start positions don't collapse
    const jitterAngle = (2 * Math.PI * i) / nodes.length;
    const jitterR = 30 + Math.random() * 40;
    positions[n.id] = {
      x: home.x + jitterR * Math.cos(jitterAngle),
      y: home.y + jitterR * Math.sin(jitterAngle),
      vx: 0,
      vy: 0,
    };
  });

  // Precompute edge sentiment map
  const edgeSentiment = {};
  edges.forEach((e) => {
    const key = `${e.source}|${e.target}`;
    const keyRev = `${e.target}|${e.source}`;
    const sentiment = HOSTILE_TYPES.has(e.relationship_type) ? -1
      : FRIENDLY_TYPES.has(e.relationship_type) ? 1 : 0;
    edgeSentiment[key] = { weight: e.weight || 1, sentiment };
    edgeSentiment[keyRev] = { weight: e.weight || 1, sentiment };
  });

  // Dynamic repulsion based on node count — scale with canvas area
  const area = width * height;
  const repulseK = 1500 + nodes.length * 400 + area * 0.002;
  const hostileRepulseK = 6000;     // Strong push for hostile edges
  const attractK = 0.009;            // Pull for friendly edges
  const clusterGravity = 0.04;       // Pull towards own cluster centroid
  const centerGravity = 0.005;       // Mild pull to overall center (less = more spread)
  const damping = 0.82;
  const iterations = 150;
  const minNodeDist = 80;            // Minimum distance between any two nodes

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations; // cooling factor

    // ── 1. Repulsion between ALL node pairs ──
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        // Base Coulomb repulsion
        let force = repulseK / (dist * dist);
        // Extra repulsion if hostile edge exists between them
        const eKey = `${nodes[i].id}|${nodes[j].id}`;
        if (edgeSentiment[eKey] && edgeSentiment[eKey].sentiment < 0) {
          force += hostileRepulseK / (dist * dist) * edgeSentiment[eKey].weight;
        }
        // Different clusters? push harder
        const ci = clusterOf[nodes[i].id];
        const cj = clusterOf[nodes[j].id];
        if (ci !== undefined && cj !== undefined && ci !== cj) {
          force *= 1.8;
        }
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // ── 2. Attraction/repulsion along edges ──
    edges.forEach((e) => {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

      if (HOSTILE_TYPES.has(e.relationship_type)) {
        // Hostile: push apart — ideal distance scales with canvas
        const idealDist = Math.min(width, height) * 0.45 + (e.weight || 1) * 5;
        if (dist < idealDist) {
          const push = (idealDist - dist) * 0.025 * alpha;
          const fx = (dx / dist) * push;
          const fy = (dy / dist) * push;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      } else if (FRIENDLY_TYPES.has(e.relationship_type)) {
        // Friendly: spring attraction — ideal dist ~90-120px
        const idealDist = 90 + 30 / Math.sqrt(e.weight || 1);
        const force = (dist - idealDist) * attractK * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      } else {
        // Neutral/complex: very mild spring, moderate distance
        const idealDist = 150;
        const force = (dist - idealDist) * attractK * 0.3 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    });

    // ── 3. Cluster gravity — pull towards own cluster centroid ──
    nodes.forEach((n) => {
      const p = positions[n.id];
      const cId = clusterOf[n.id];
      if (cId !== undefined && clusterCentroids[cId]) {
        const c = clusterCentroids[cId];
        p.vx += (c.x - p.x) * clusterGravity * alpha;
        p.vy += (c.y - p.y) * clusterGravity * alpha;
      }
    });

    // ── 4. Center gravity (keeps the graph from drifting away) ──
    nodes.forEach((n) => {
      const p = positions[n.id];
      p.vx += (cx - p.x) * centerGravity * alpha;
      p.vy += (cy - p.y) * centerGravity * alpha;
    });

    // ── 5. Apply velocities with damping ──
    nodes.forEach((n) => {
      const p = positions[n.id];
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx;
      p.y += p.vy;
    });

    // ── 6. Collision: enforce minimum distance between all nodes ──
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minNodeDist && dist > 0) {
          const overlap = (minNodeDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  // Clamp to bounds with padding
  const pad = 60;
  nodes.forEach((n) => {
    const p = positions[n.id];
    p.x = Math.max(pad, Math.min(width - pad, p.x));
    p.y = Math.max(pad, Math.min(height - pad, p.y));
  });

  return positions;
}

/*
 * ─── curved edge path generator ───
 * Friendly edges = straight lines.  Hostile = curved arcs so they stand out.
 * When multiple edges overlap, each gets a slightly different curve.
 */
function edgePath(from, to, curveAmount = 0) {
  if (curveAmount === 0) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  // Perpendicular offset for the control point
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular direction
  const px = -dy / len;
  const py = dx / len;
  const cpx = mx + px * curveAmount;
  const cpy = my + py * curveAmount;
  return `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`;
}

/* Midpoint of the edge (accounting for curve) */
function edgeMidpoint(from, to, curveAmount = 0) {
  if (curveAmount === 0) {
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  // Quadratic bezier midpoint at t=0.5
  return {
    x: mx + px * curveAmount * 0.5,
    y: my + py * curveAmount * 0.5,
  };
}


/*
 * ─── main component ───
 */
export default function RelationshipGraph({ data }) {
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 620 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: Math.max(520, Math.min(720, entry.contentRect.width * 0.65)),
      });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { nodes = [], edges = [], clusters = [] } = data || {};

  const positions = useMemo(
    () => computeLayout(nodes, edges, clusters, dimensions.width, dimensions.height),
    [nodes, edges, clusters, dimensions.width, dimensions.height],
  );

  if (!nodes.length) {
    return (
      <div className="text-center text-text-muted py-12">
        No relationship data available for this book.
      </div>
    );
  }

  // Scale node size by appearances
  const maxApp = Math.max(...nodes.map((n) => n.appearances), 1);

  const handleEdgeClick = (e) => {
    setSelectedEdge(selectedEdge === e ? null : e);
    setSelectedNode(null);
  };

  const handleNodeClick = (n) => {
    setSelectedNode(selectedNode?.id === n.id ? null : n);
    setSelectedEdge(null);
  };

  // Find edges connected to the hovered/selected node for highlighting
  const highlightedEdges = new Set();
  const activeNodeId = hoveredNode || selectedNode?.id;
  if (activeNodeId) {
    edges.forEach((e, i) => {
      if (e.source === activeNodeId || e.target === activeNodeId) {
        highlightedEdges.add(i);
      }
    });
  }

  // Pre-compute curve amounts — alternate hostile edges so labels don't stack
  const edgeCurves = useMemo(() => {
    // Track how many edges share a node to alternate curve direction
    const nodeEdgeIdx = {};
    return edges.map((e, i) => {
      const isHostile = HOSTILE_TYPES.has(e.relationship_type);
      if (!isHostile) return 0; // friendly & neutral = straight lines

      // Alternate curve direction per edge index for visual variety
      const sign = i % 2 === 0 ? 1 : -1;
      const baseCurve = 30 + (i % 3) * 12; // 30, 42, 54 — staggered
      return baseCurve * sign;
    });
  }, [edges]);

  return (
    <div className="space-y-4">
      {/* ── Graph canvas ── */}
      <div ref={containerRef} className="relative w-full">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="bg-bg-primary rounded-lg border border-border"
        >
          {/* SVG defs for edge markers and glows */}
          <defs>
            {/* Glow filter for hostile edges */}
            <filter id="hostile-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Glow for active/selected nodes */}
            <filter id="node-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Cluster backgrounds — pill-shaped hulls */}
          {clusters.map((cl) => {
            const memberPos = cl.members
              .map((m) => positions[m])
              .filter(Boolean);
            if (memberPos.length < 2) return null;
            const clCx = memberPos.reduce((s, p) => s + p.x, 0) / memberPos.length;
            const clCy = memberPos.reduce((s, p) => s + p.y, 0) / memberPos.length;
            const maxR = Math.max(
              ...memberPos.map((p) =>
                Math.sqrt((p.x - clCx) ** 2 + (p.y - clCy) ** 2),
              ),
            );
            const vibeColors = {
              toxic: { fill: '#EF444408', stroke: '#EF444425' },
              tight_knit: { fill: '#22C55E06', stroke: '#22C55E20' },
              mixed: { fill: '#8B5CF606', stroke: '#8B5CF620' },
            };
            const vc = vibeColors[cl.vibe] || vibeColors.mixed;
            return (
              <g key={cl.cluster_id}>
                <circle
                  cx={clCx}
                  cy={clCy}
                  r={maxR + 50}
                  fill={vc.fill}
                  stroke={vc.stroke}
                  strokeWidth={1.5}
                  strokeDasharray="8 5"
                />
                {/* Cluster label */}
                <text
                  x={clCx}
                  y={clCy - maxR - 55}
                  textAnchor="middle"
                  fill={cl.vibe === 'toxic' ? '#EF444450' : cl.vibe === 'tight_knit' ? '#22C55E40' : '#8B5CF640'}
                  fontSize={10}
                  fontWeight={600}
                  letterSpacing="0.08em"
                >
                  {cl.vibe === 'tight_knit' ? '— ALLIANCE —' : cl.vibe === 'toxic' ? '— HOSTILE —' : '— FACTION —'}
                </text>
              </g>
            );
          })}

          {/* Edges */}
          {edges.map((e, i) => {
            const from = positions[e.source];
            const to = positions[e.target];
            if (!from || !to) return null;

            const isHostile = HOSTILE_TYPES.has(e.relationship_type);
            const color = REL_COLORS[e.relationship_type] || '#6B7280';
            const isActive = highlightedEdges.has(i);
            const isSelected = selectedEdge === e;
            const dimmed = activeNodeId && !isActive;
            const strokeW = isSelected ? 3.5 : isHostile
              ? Math.min(1.5 + e.weight * 0.12, 3.5)
              : Math.min(1.5 + e.weight * 0.15, 4);

            const curve = edgeCurves[i] || 0;
            const d = edgePath(from, to, curve);
            const mid = edgeMidpoint(from, to, curve);

            return (
              <g
                key={i}
                onClick={() => handleEdgeClick(e)}
                style={{ cursor: 'pointer' }}
                opacity={dimmed ? 0.12 : 1}
              >
                {/* Visible edge path */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeOpacity={isSelected ? 1 : isHostile ? 0.7 : 0.5}
                  strokeDasharray={isHostile ? '6 3' : 'none'}
                  filter={isHostile && (isActive || isSelected) ? 'url(#hostile-glow)' : undefined}
                />
                {/* Invisible wider hit target */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                />
                {/* Relationship type badge */}
                {(isActive || isSelected || !activeNodeId) && (e.weight > 3 || isHostile) && (
                  <>
                    <rect
                      x={mid.x - 30}
                      y={mid.y - 16}
                      width={60}
                      height={14}
                      rx={3}
                      fill="#13131Dcc"
                      stroke={`${color}40`}
                      strokeWidth={0.5}
                    />
                    <text
                      x={mid.x}
                      y={mid.y - 6}
                      textAnchor="middle"
                      fill={color}
                      fontSize={8}
                      fontWeight={600}
                    >
                      {REL_LABELS[e.relationship_type] || e.relationship_type}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const pos = positions[n.id];
            if (!pos) return null;
            const r = 16 + (n.appearances / maxApp) * 20;
            const roleColor = ROLE_COLORS[n.role] || '#8888A0';
            const emotionColor = EMOTION_COLORS[n.dominant_emotion] || '#8888A0';
            const isActive = activeNodeId === n.id;
            const connectedToActive = activeNodeId
              ? edges.some(
                  (e) =>
                    (e.source === activeNodeId && e.target === n.id) ||
                    (e.target === activeNodeId && e.source === n.id),
                )
              : false;

            return (
              <g
                key={n.id}
                onClick={() => handleNodeClick(n)}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
                opacity={activeNodeId && !isActive && !connectedToActive ? 0.25 : 1}
              >
                {/* Glow ring when active */}
                {isActive && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill="none"
                    stroke={roleColor}
                    strokeWidth={2}
                    opacity={0.4}
                    filter="url(#node-glow)"
                  />
                )}
                {/* Outer ring = role */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 3}
                  fill="none"
                  stroke={roleColor}
                  strokeWidth={isActive ? 3 : 2}
                  opacity={0.8}
                />
                {/* Inner fill = dominant emotion */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={`${emotionColor}25`}
                  stroke={emotionColor}
                  strokeWidth={1.5}
                />
                {/* Character initial inside the circle */}
                <text
                  x={pos.x}
                  y={pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={emotionColor}
                  fontSize={r * 0.7}
                  fontWeight={700}
                  opacity={0.6}
                >
                  {n.name.charAt(0)}
                </text>
                {/* Arc shift indicator */}
                {n.arc_shift && (
                  <g>
                    <circle
                      cx={pos.x + r - 2}
                      cy={pos.y - r + 2}
                      r={6}
                      fill={EMOTION_COLORS[n.late_dominant] || '#F59E0B'}
                      stroke="#13131D"
                      strokeWidth={1.5}
                    />
                    <text
                      x={pos.x + r - 2}
                      y={pos.y - r + 2.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#13131D"
                      fontSize={7}
                      fontWeight={800}
                    >
                      ↻
                    </text>
                  </g>
                )}
                {/* Name label with background */}
                <rect
                  x={pos.x - n.name.length * 3.2}
                  y={pos.y + r + 6}
                  width={n.name.length * 6.4}
                  height={14}
                  rx={3}
                  fill="#13131Dcc"
                />
                <text
                  x={pos.x}
                  y={pos.y + r + 16}
                  textAnchor="middle"
                  fill="#D8D8E8"
                  fontSize={11}
                  fontWeight={600}
                >
                  {n.name}
                </text>
                {/* Role below name */}
                <text
                  x={pos.x}
                  y={pos.y + r + 27}
                  textAnchor="middle"
                  fill={roleColor}
                  fontSize={8}
                  fontWeight={500}
                  opacity={0.7}
                >
                  {n.role}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-2 bg-bg-card rounded-lg border border-border">
        <span className="text-xs text-text-muted font-semibold">Relationships:</span>
        {Object.entries(REL_COLORS).map(([type, color]) => {
          const isHostile = HOSTILE_TYPES.has(type);
          return (
            <div key={type} className="flex items-center gap-1.5">
              <svg width={20} height={6}>
                <line
                  x1={0} y1={3} x2={20} y2={3}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={isHostile ? '4 2' : 'none'}
                />
              </svg>
              <span className="text-[10px] text-text-muted capitalize">
                {REL_LABELS[type]}
              </span>
            </div>
          );
        })}
        <span className="text-[10px] text-text-muted italic ml-2">
          Dashed = hostile · Solid = allied/neutral
        </span>
      </div>

      {/* ── Selected edge detail card ── */}
      {selectedEdge && (
        <EdgeCard edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
      )}

      {/* ── Selected node detail card ── */}
      {selectedNode && (
        <NodeCard
          node={selectedNode}
          edges={edges}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* ── Cluster cards ── */}
      {clusters.length > 0 && (
        <div>
          <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">
            Detected Factions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusters.map((cl) => (
              <ClusterCard key={cl.cluster_id} cluster={cl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/*
 * ─── edge detail card ───
 */
function EdgeCard({ edge, onClose }) {
  const color = REL_COLORS[edge.relationship_type] || '#6B7280';

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color,
                border: `1px solid ${color}40`,
              }}
            >
              {REL_LABELS[edge.relationship_type]}
            </span>
            <span className="text-xs text-text-muted">
              {PATTERN_ICONS[edge.emotional_pattern]} {edge.emotional_pattern}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-text-primary">
            {edge.source} &harr; {edge.target}
          </h4>
        </div>
        <button
          className="text-xs text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Edge description */}
      <p className="text-xs text-text-secondary italic">{edge.label}</p>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Stat label="Aid acts" value={edge.help_count} color="#22C55E" />
        <Stat label="Harm acts" value={edge.harm_count} color="#EF4444" />
        <Stat label="Co-appearances" value={edge.co_appearances} />
        <Stat label="Correlation" value={edge.avg_correlation?.toFixed(2)} />
        <Stat label="Inversion" value={edge.inversion_score?.toFixed(2)} />
      </div>

      {/* Emotion correlations */}
      {edge.emotion_correlations && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Emotion-by-emotion correlation
          </div>
          <div className="flex gap-2">
            {Object.entries(edge.emotion_correlations).map(([emo, val]) => (
              <div key={emo} className="text-center">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: val > 0
                      ? `rgba(34,197,94,${Math.abs(val) * 0.4})`
                      : `rgba(239,68,68,${Math.abs(val) * 0.4})`,
                    color: val > 0 ? '#22C55E' : '#EF4444',
                  }}
                >
                  {val.toFixed(1)}
                </div>
                <div className="text-[9px] text-text-muted mt-0.5 capitalize">{emo}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key events */}
      {edge.key_events?.length > 0 && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Key Moments
          </div>
          <div className="space-y-1">
            {edge.key_events.map((ev, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-text-secondary"
              >
                <span
                  className="text-[9px] font-mono px-1 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: HARM_SET.has(ev.type) ? '#EF444420' : '#22C55E20',
                    color: HARM_SET.has(ev.type) ? '#EF4444' : '#22C55E',
                  }}
                >
                  {ev.type}
                </span>
                <span className="line-clamp-1">{ev.description}</span>
                <span className="text-text-muted text-[9px] shrink-0 font-mono">
                  {ev.chapter?.replace('chapter_', 'ch')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const HARM_SET = new Set([
  'DECEPTION',
  'BETRAYAL',
  'THREAT',
  'VIOLENCE',
  'ACCUSATION',
  'MANIPULATION',
]);


/*
 * ─── node detail card ───
 */
function NodeCard({ node, edges, onClose }) {
  const roleColor = ROLE_COLORS[node.role] || '#8888A0';

  // Find all edges involving this character
  const myEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );
  myEdges.sort((a, b) => b.weight - a.weight);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
              style={{
                backgroundColor: `${roleColor}20`,
                color: roleColor,
                border: `1px solid ${roleColor}40`,
              }}
            >
              {node.role}
            </span>
            {node.arc_shift && (
              <span className="text-[10px] text-text-muted">
                Arc shift: {node.early_dominant} → {node.late_dominant}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-text-primary">{node.name}</h4>
        </div>
        <button
          className="text-xs text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Emotion bars */}
      <div className="space-y-1">
        {Object.entries(node.emotions || {})
          .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
          .map(([emo, val]) => {
            const maxVal = Math.max(
              ...Object.values(node.emotions).map(Math.abs),
              1,
            );
            const pct = (Math.abs(val) / maxVal) * 100;
            return (
              <div key={emo} className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted capitalize w-12 text-right">
                  {emo}
                </span>
                <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: EMOTION_COLORS[emo],
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-muted w-10 text-right">
                  {val.toFixed(1)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Relationships list */}
      {myEdges.length > 0 && (
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Relationships ({myEdges.length})
          </div>
          <div className="space-y-1">
            {myEdges.map((e, i) => {
              const other = e.source === node.id ? e.target : e.source;
              const color = REL_COLORS[e.relationship_type] || '#6B7280';
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-text-primary font-medium">{other}</span>
                  <span className="text-text-muted">—</span>
                  <span style={{ color }} className="capitalize text-[10px]">
                    {REL_LABELS[e.relationship_type]}
                  </span>
                  <span className="text-text-muted text-[9px] ml-auto font-mono">
                    {PATTERN_ICONS[e.emotional_pattern]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/*
 * ─── cluster card ───
 */
function ClusterCard({ cluster }) {
  const vibeColor =
    cluster.vibe === 'toxic'
      ? '#EF4444'
      : cluster.vibe === 'tight_knit'
        ? '#22C55E'
        : '#8B5CF6';

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: vibeColor }}
        />
        <span className="text-xs font-semibold text-text-primary capitalize">
          {cluster.vibe === 'tight_knit' ? 'Tight-knit' : cluster.vibe} faction
        </span>
        <span className="text-[10px] text-text-muted ml-auto">
          {cluster.size} members
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {cluster.members.map((m) => (
          <span
            key={m}
            className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary border border-border"
          >
            {m}
          </span>
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-text-muted">
        <span>
          Aid:{' '}
          <span className="text-green-400 font-mono">
            {cluster.internal_help}
          </span>
        </span>
        <span>
          Harm:{' '}
          <span className="text-red-400 font-mono">
            {cluster.internal_harm}
          </span>
        </span>
      </div>
    </div>
  );
}


/*
 * ─── tiny stat helper ───
 */
function Stat({ label, value, color }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-text-muted">{label}:</span>
      <span
        className="text-xs font-mono font-semibold"
        style={color ? { color } : { color: '#C8C8D8' }}
      >
        {value}
      </span>
    </div>
  );
}
