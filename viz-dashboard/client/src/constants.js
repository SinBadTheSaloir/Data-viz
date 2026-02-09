export const CULTURE_COLORS = {
  French: '#3B82F6',
  English: '#22C55E',
  Russian: '#EF4444',
  Japanese: '#A855F7',
  Elizabethan: '#EAB308',
  American: '#F97316',
  'Ancient Greek': '#06B6D4',
  'Ancient Roman': '#8B5CF6',
  'Middle Eastern': '#D946EF',
};

// ── Emotion Colors ──
// Warm = human/emotional, Cool = mental/calculated
// hope: growth green, fear: cold indigo, anger: blood red
// pride: gold crown, shame: muted flushed rose, resolve: steel gray-blue
export const EMOTION_COLORS = {
  hope: '#22C55E',      // growth green — universal positive
  fear: '#4338CA',      // cold deep indigo — dread, dark, bruise-like
  anger: '#DC2626',     // blood red — rage, heat
  pride: '#D97706',     // warm amber-gold — crowns, medals, achievement
  shame: '#9D174D',     // muted rose-brown — flushed, uncomfortable, hidden
  resolve: '#6B7280',   // steel gray — iron will, gritted teeth, metal
};

export const EMOTIONS = ['hope', 'fear', 'anger', 'pride', 'shame', 'resolve'];

export const CULTURE_ORDER = ['English', 'French', 'Russian', 'Japanese', 'Elizabethan', 'American', 'Ancient Greek', 'Ancient Roman', 'Middle Eastern'];

export const BELIEFS = ['providence_conviction', 'instrumental_rationalization', 'suspicion_paranoia', 'identity_stability'];

// ── Belief Colors ──
// providence: soft candlelight gold, rationalization: cold clinical ice
// suspicion: amber warning light, identity: deep grounded earth
export const BELIEF_COLORS = {
  providence_conviction: '#FBBF24',     // soft warm gold — faith, divine light
  instrumental_rationalization: '#67E8F9', // ice blue — cold, clinical, calculating
  suspicion_paranoia: '#F59E0B',        // amber warning — alert, watchful, anxious
  identity_stability: '#78350F',        // deep umber earth — rooted, foundational, core
};

export const BELIEF_LABELS = {
  providence_conviction: 'Providence',
  instrumental_rationalization: 'Rationalization',
  suspicion_paranoia: 'Suspicion',
  identity_stability: 'Identity',
};

// ── Event Type Colors ──
// Each color communicates what the event FEELS like
export const EVENT_TYPE_COLORS = {
  VIOLENCE: '#991B1B',     // deep crimson — blood, finality
  THREAT: '#EA580C',       // hot orange-red — warning siren
  BETRAYAL: '#65A30D',     // poison/bile green — the snake, corruption
  DECEPTION: '#7C3AED',    // smoky violet — masks, shadows, hidden
  AID: '#38BDF8',          // warm sky blue — help, reaching out
  PROMISE: '#E2E8F0',      // clean silver-white — pure intention, vow
  TRANSACTION: '#9CA3AF',  // neutral gray — business, exchange
  SPEECH: '#FACC15',       // warm yellow — lamplight, conversation
  MOVEMENT: '#06B6D4',     // ocean teal — travel, flow, journey
  REVELATION: '#FDE047',   // bright gold flash — truth, lightbulb
  AUTHORITY_ACT: '#7C3AED',// royal purple — ruler, power (same family as deception but context distinguishes)
  ACCUSATION: '#E11D48',   // sharp rose-red — pointed finger
  SUPPORT: '#34D399',      // soft mint green — gentle aid
  PROTECTION: '#3B82F6',   // shield blue — standing guard
  MANIPULATION: '#A21CAF',  // dark magenta — puppet strings
};
