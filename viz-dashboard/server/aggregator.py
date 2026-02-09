"""
Data aggregation layer — reads JSONL files, normalizes characters,
computes summaries, and caches results.
"""

import json
import glob
import os
import math
from collections import defaultdict
from pathlib import Path
from book_config import BOOKS, EMOTIONS, BELIEFS

# Use DATA_ROOT env var if set (production), otherwise default to local path
DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).parent.parent.parent / "data" / "outputs"))


def _resolve_path(path_pattern: str) -> str:
    """Resolve glob patterns in book paths to actual file paths."""
    full_pattern = str(DATA_ROOT / path_pattern)
    matches = glob.glob(full_pattern)
    if not matches:
        raise FileNotFoundError(f"No files found for pattern: {full_pattern}")
    # Return the most recent (last sorted) match
    matches.sort()
    return matches[-1]


def _load_blocks(book_id: str) -> list[dict]:
    """Load all blocks from a book's JSONL file."""
    config = BOOKS[book_id]
    path = _resolve_path(config["path_pattern"])
    blocks = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                blocks.append(json.loads(line))
    return blocks


def _normalize_character_name(name: str, book_id: str) -> str | None:
    """Map a character name to its canonical form, or None if phantom."""
    config = BOOKS[book_id]

    # Filter phantom characters
    if name in config.get("phantom_characters", []):
        return None

    # Check alias mappings
    aliases = config.get("character_aliases", {})
    for canonical, alias_list in aliases.items():
        if name in alias_list:
            return canonical

    # Return original name if no alias found
    return name


def _get_dominant_emotion(emotions: dict) -> str:
    """Return the emotion with the highest absolute value."""
    if not emotions:
        return "resolve"
    best = max(EMOTIONS, key=lambda e: abs(emotions.get(e, 0)))
    return best


def _get_dominant_emotion_positive(emotions: dict) -> str:
    """Return the emotion with the highest positive value."""
    if not emotions:
        return "resolve"
    best = max(EMOTIONS, key=lambda e: emotions.get(e, 0))
    return best


def aggregate_book(book_id: str) -> dict:
    """Compute full aggregation for a single book."""
    config = BOOKS[book_id]
    blocks = _load_blocks(book_id)

    # ── Basic stats ──
    total_blocks = len(blocks)
    total_words = sum(b.get("word_count", 0) for b in blocks)
    dialogue_count = sum(1 for b in blocks if b.get("has_dialogue", False))

    # ── Block types ──
    block_types = defaultdict(int)
    for b in blocks:
        bt = b.get("block_type", {})
        label = bt.get("label", "UNKNOWN") if isinstance(bt, dict) else "UNKNOWN"
        block_types[label] += 1

    # ── Judgment / Mercy totals ──
    judgment_total = 0.0
    mercy_total = 0.0
    for b in blocks:
        j = b.get("judgment", {})
        m = b.get("mercy", {})
        judgment_total += j.get("judgment", 0) if isinstance(j, dict) else (j if isinstance(j, (int, float)) else 0)
        mercy_total += m.get("mercy", 0) if isinstance(m, dict) else (m if isinstance(m, (int, float)) else 0)

    # ── Character emotions (normalized names) ──
    character_emotions = defaultdict(lambda: {e: 0.0 for e in EMOTIONS})
    character_appearances = defaultdict(int)
    character_beliefs = defaultdict(lambda: {b: 0.0 for b in BELIEFS})

    for b in blocks:
        # Momentum
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
            for raw_name, emo_dict in delta.items():
                if not isinstance(emo_dict, dict):
                    continue
                canon = _normalize_character_name(raw_name, book_id)
                if canon is None:
                    continue
                character_appearances[canon] += 1
                for emo in EMOTIONS:
                    character_emotions[canon][emo] += emo_dict.get(emo, 0)

        # Beliefs
        belief = b.get("belief", {})
        if isinstance(belief, dict):
            delta = belief.get("belief_delta", belief)
            for raw_name, bel_dict in delta.items():
                if not isinstance(bel_dict, dict):
                    continue
                canon = _normalize_character_name(raw_name, book_id)
                if canon is None:
                    continue
                for bel in BELIEFS:
                    character_beliefs[canon][bel] += bel_dict.get(bel, 0)

    # ── Events ──
    event_counts = defaultdict(int)
    total_events = 0
    for b in blocks:
        events = b.get("events", {})
        if isinstance(events, dict):
            event_list = events.get("events", [])
        elif isinstance(events, list):
            event_list = events
        else:
            event_list = []
        for ev in event_list:
            if isinstance(ev, dict):
                ptype = ev.get("primary_type", "UNKNOWN")
                event_counts[ptype] += 1
                total_events += 1

    # ── Emotion totals ──
    emotion_totals = {e: 0.0 for e in EMOTIONS}
    for canon, emos in character_emotions.items():
        for e in EMOTIONS:
            emotion_totals[e] += emos[e]

    # ── Top characters ──
    sorted_chars = sorted(character_appearances.items(), key=lambda x: x[1], reverse=True)
    top_characters = []
    for canon, count in sorted_chars[:12]:
        emos = character_emotions[canon]
        bels = character_beliefs[canon]
        top_characters.append({
            "name": canon,
            "appearances": count,
            "emotions": dict(emos),
            "beliefs": dict(bels),
            "dominant_emotion": _get_dominant_emotion_positive(emos),
        })

    # ── Chapters ──
    chapters = sorted(set(b.get("chapter_id", "unknown") for b in blocks))

    return {
        "book_id": book_id,
        "title": config["title"],
        "author": config["author"],
        "culture": config["culture"],
        "protagonist": config["protagonist"],
        "total_blocks": total_blocks,
        "total_words": total_words,
        "total_events": total_events,
        "total_chapters": len(chapters),
        "dialogue_percentage": round(dialogue_count / total_blocks * 100, 1) if total_blocks > 0 else 0,
        "block_types": dict(block_types),
        "judgment_total": round(judgment_total, 2),
        "mercy_total": round(mercy_total, 2),
        "judgment_per_block": round(judgment_total / total_blocks, 4) if total_blocks > 0 else 0,
        "mercy_per_block": round(mercy_total / total_blocks, 4) if total_blocks > 0 else 0,
        "emotion_totals": {k: round(v, 2) for k, v in emotion_totals.items()},
        "event_counts": dict(event_counts),
        "characters": top_characters,
        "chapters": chapters,
    }


def compute_heartbeat(book_id: str) -> dict:
    """
    Compute the heartbeat strip data for a book.
    Returns per-chapter dominant emotion and intensity for top characters,
    plus a blended whole-story strip.
    """
    config = BOOKS[book_id]
    blocks = _load_blocks(book_id)

    # Group blocks by chapter
    chapter_blocks = defaultdict(list)
    for b in blocks:
        ch = b.get("chapter_id", "unknown")
        chapter_blocks[ch].append(b)

    chapters = sorted(chapter_blocks.keys())

    # Get top characters by total appearances
    char_counts = defaultdict(int)
    for b in blocks:
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
            for raw_name in delta:
                canon = _normalize_character_name(raw_name, book_id)
                if canon:
                    char_counts[canon] += 1

    top_chars = [name for name, _ in sorted(char_counts.items(), key=lambda x: x[1], reverse=True)[:8]]

    # Per-character per-chapter data
    character_strips = {}
    for char in top_chars:
        strip = []
        for ch in chapters:
            ch_emotions = {e: 0.0 for e in EMOTIONS}
            count = 0
            for b in chapter_blocks[ch]:
                momentum = b.get("momentum", {})
                if isinstance(momentum, dict):
                    delta = momentum.get("momentum_delta", momentum)
                    for raw_name, emo_dict in delta.items():
                        if not isinstance(emo_dict, dict):
                            continue
                        canon = _normalize_character_name(raw_name, book_id)
                        if canon == char:
                            count += 1
                            for e in EMOTIONS:
                                ch_emotions[e] += emo_dict.get(e, 0)

            if count > 0:
                dominant = _get_dominant_emotion_positive(ch_emotions)
                intensity = sum(abs(v) for v in ch_emotions.values())
                strip.append({
                    "chapter": ch,
                    "emotions": {k: round(v, 4) for k, v in ch_emotions.items()},
                    "dominant": dominant,
                    "intensity": round(intensity, 4),
                    "present": True,
                })
            else:
                strip.append({
                    "chapter": ch,
                    "emotions": {e: 0 for e in EMOTIONS},
                    "dominant": None,
                    "intensity": 0,
                    "present": False,
                })

        character_strips[char] = strip

    # Blended whole-story strip (all characters combined per chapter)
    blended_strip = []
    for ch in chapters:
        ch_emotions = {e: 0.0 for e in EMOTIONS}
        for b in chapter_blocks[ch]:
            momentum = b.get("momentum", {})
            if isinstance(momentum, dict):
                delta = momentum.get("momentum_delta", momentum)
                for raw_name, emo_dict in delta.items():
                    if not isinstance(emo_dict, dict):
                        continue
                    canon = _normalize_character_name(raw_name, book_id)
                    if canon is None:
                        continue
                    for e in EMOTIONS:
                        ch_emotions[e] += emo_dict.get(e, 0)

        # Judgment/mercy for this chapter
        ch_judgment = 0.0
        ch_mercy = 0.0
        for b in chapter_blocks[ch]:
            j = b.get("judgment", {})
            m = b.get("mercy", {})
            ch_judgment += j.get("judgment", 0) if isinstance(j, dict) else (j if isinstance(j, (int, float)) else 0)
            ch_mercy += m.get("mercy", 0) if isinstance(m, dict) else (m if isinstance(m, (int, float)) else 0)

        dominant = _get_dominant_emotion_positive(ch_emotions)
        intensity = sum(abs(v) for v in ch_emotions.values())

        blended_strip.append({
            "chapter": ch,
            "emotions": {k: round(v, 4) for k, v in ch_emotions.items()},
            "dominant": dominant,
            "intensity": round(intensity, 4),
            "judgment": round(ch_judgment, 4),
            "mercy": round(ch_mercy, 4),
        })

    return {
        "book_id": book_id,
        "title": config["title"],
        "culture": config["culture"],
        "chapters": chapters,
        "character_strips": character_strips,
        "blended_strip": blended_strip,
        "top_characters": top_chars,
    }


def compute_trajectory(book_id: str) -> dict:
    """
    Compute the 3D story path data: cumulative hope-fear and mercy-judgment
    over normalized story progress.
    """
    config = BOOKS[book_id]
    blocks = _load_blocks(book_id)
    protagonist_aliases = set(config.get("protagonist_aliases", []))

    points = []
    cum_hope = 0.0
    cum_fear = 0.0
    cum_judgment = 0.0
    cum_mercy = 0.0

    for i, b in enumerate(blocks):
        # Protagonist emotions
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
            for raw_name, emo_dict in delta.items():
                if not isinstance(emo_dict, dict):
                    continue
                if raw_name in protagonist_aliases:
                    cum_hope += emo_dict.get("hope", 0)
                    cum_fear += emo_dict.get("fear", 0)

        # Judgment/mercy
        j = b.get("judgment", {})
        m = b.get("mercy", {})
        cum_judgment += j.get("judgment", 0) if isinstance(j, dict) else (j if isinstance(j, (int, float)) else 0)
        cum_mercy += m.get("mercy", 0) if isinstance(m, dict) else (m if isinstance(m, (int, float)) else 0)

        progress = round(i / max(len(blocks) - 1, 1) * 100, 2)

        points.append({
            "block_index": i,
            "progress": progress,
            "chapter": b.get("chapter_id", "unknown"),
            "hope_fear": round(cum_hope - cum_fear, 4),
            "mercy_judgment": round(cum_mercy - cum_judgment, 4),
            "cum_hope": round(cum_hope, 4),
            "cum_fear": round(cum_fear, 4),
            "cum_judgment": round(cum_judgment, 4),
            "cum_mercy": round(cum_mercy, 4),
        })

    return {
        "book_id": book_id,
        "title": config["title"],
        "culture": config["culture"],
        "protagonist": config["protagonist"],
        "points": points,
    }


def compute_all_summaries() -> list[dict]:
    """Compute summary data for all books."""
    summaries = []
    for book_id in BOOKS:
        try:
            summary = aggregate_book(book_id)
            summaries.append(summary)
        except Exception as e:
            print(f"Error processing {book_id}: {e}")
    return summaries


def compute_culture_averages() -> dict:
    """
    Compute average trajectories per culture, normalized to 100 progress points.
    Returns { culture: { points: [{ progress, hope_fear, mercy_judgment }] } }
    """
    culture_trajs = defaultdict(list)
    for book_id in BOOKS:
        try:
            traj = compute_trajectory(book_id)
            culture = traj["culture"]
            culture_trajs[culture].append(traj["points"])
        except Exception as e:
            print(f"Error computing trajectory for {book_id}: {e}")

    result = {}
    POINTS = 101  # 0..100
    for culture, all_points in culture_trajs.items():
        avg_points = []
        for i in range(POINTS):
            target = i
            hope_fear_vals = []
            mercy_judgment_vals = []
            for pts in all_points:
                if not pts:
                    continue
                closest = min(pts, key=lambda p: abs(p["progress"] - target))
                hope_fear_vals.append(closest.get("hope_fear", 0))
                mercy_judgment_vals.append(closest.get("mercy_judgment", 0))

            if hope_fear_vals:
                avg_points.append({
                    "progress": i,
                    "hope_fear": round(sum(hope_fear_vals) / len(hope_fear_vals), 4),
                    "mercy_judgment": round(sum(mercy_judgment_vals) / len(mercy_judgment_vals), 4),
                })

        result[culture] = {
            "culture": culture,
            "points": avg_points,
            "book_count": len(all_points),
        }

    return result


def compute_culture_comparison() -> dict:
    """Aggregate data by culture for comparison."""
    culture_data = defaultdict(lambda: {
        "books": [],
        "emotion_totals": {e: 0.0 for e in EMOTIONS},
        "judgment_total": 0.0,
        "mercy_total": 0.0,
        "total_blocks": 0,
        "event_counts": defaultdict(int),
        "belief_totals": {b: 0.0 for b in BELIEFS},
    })

    for book_id in BOOKS:
        try:
            summary = aggregate_book(book_id)
            culture = summary["culture"]
            cd = culture_data[culture]
            cd["books"].append(summary["title"])
            cd["total_blocks"] += summary["total_blocks"]
            cd["judgment_total"] += summary["judgment_total"]
            cd["mercy_total"] += summary["mercy_total"]

            for e in EMOTIONS:
                cd["emotion_totals"][e] += summary["emotion_totals"].get(e, 0)

            for evt, count in summary["event_counts"].items():
                cd["event_counts"][evt] += count

            # Aggregate beliefs from characters
            for char in summary["characters"]:
                for b in BELIEFS:
                    cd["belief_totals"][b] += char["beliefs"].get(b, 0)

        except Exception as e:
            print(f"Error processing {book_id}: {e}")

    # Normalize per 100 blocks
    result = {}
    for culture, cd in culture_data.items():
        blocks = cd["total_blocks"]
        result[culture] = {
            "culture": culture,
            "books": cd["books"],
            "total_blocks": blocks,
            "judgment_per_100": round(cd["judgment_total"] / blocks * 100, 2) if blocks else 0,
            "mercy_per_100": round(cd["mercy_total"] / blocks * 100, 2) if blocks else 0,
            "emotions_per_100": {
                e: round(cd["emotion_totals"][e] / blocks * 100, 2) if blocks else 0
                for e in EMOTIONS
            },
            "event_counts": dict(cd["event_counts"]),
            "belief_per_100": {
                b: round(cd["belief_totals"][b] / blocks * 100, 2) if blocks else 0
                for b in BELIEFS
            },
        }

    return result


# ══════════════════════════════════════════════════════════════════════════════
# Relationship Cluster Detection
# ══════════════════════════════════════════════════════════════════════════════

HELP_TYPES = {"AID", "PROMISE", "SUPPORT", "PROTECTION", "REVELATION"}
HARM_TYPES = {"DECEPTION", "BETRAYAL", "THREAT", "VIOLENCE", "ACCUSATION", "MANIPULATION"}


def _co_appearance_blocks(blocks: list[dict], book_id: str) -> dict:
    """
    Build a map of (charA, charB) → list of block_ids where both appear
    in the same block's momentum_delta.
    """
    pair_blocks = defaultdict(list)
    for b in blocks:
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
        else:
            continue

        chars_in_block = set()
        for raw_name in delta:
            if not isinstance(delta[raw_name], dict):
                continue
            canon = _normalize_character_name(raw_name, book_id)
            if canon:
                chars_in_block.add(canon)

        chars_sorted = sorted(chars_in_block)
        for i in range(len(chars_sorted)):
            for j in range(i + 1, len(chars_sorted)):
                pair_blocks[(chars_sorted[i], chars_sorted[j])].append(
                    b.get("block_id", "")
                )

    return dict(pair_blocks)


def _emotional_correlation(blocks: list[dict], char_a: str, char_b: str,
                           book_id: str) -> dict:
    """
    Track how two characters' emotions move relative to each other over time.
    Returns convergence/divergence pattern and key emotional stats.
    """
    a_vectors = []
    b_vectors = []

    for b in blocks:
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
        else:
            continue

        a_emos = None
        b_emos = None
        for raw_name, emo_dict in delta.items():
            if not isinstance(emo_dict, dict):
                continue
            canon = _normalize_character_name(raw_name, book_id)
            if canon == char_a:
                a_emos = emo_dict
            elif canon == char_b:
                b_emos = emo_dict

        if a_emos and b_emos:
            a_vectors.append(a_emos)
            b_vectors.append(b_emos)

    if len(a_vectors) < 2:
        return {"pattern": "insufficient_data", "shared_blocks": len(a_vectors)}

    # Compute per-emotion correlation across shared blocks
    correlations = {}
    for emo in EMOTIONS:
        a_vals = [v.get(emo, 0) for v in a_vectors]
        b_vals = [v.get(emo, 0) for v in b_vectors]
        correlations[emo] = _pearson(a_vals, b_vals)

    avg_corr = sum(correlations.values()) / len(correlations)

    # Detect inversion pattern: first half vs second half correlation shift
    mid = len(a_vectors) // 2
    if mid >= 2:
        first_half_corrs = []
        second_half_corrs = []
        for emo in EMOTIONS:
            a1 = [v.get(emo, 0) for v in a_vectors[:mid]]
            b1 = [v.get(emo, 0) for v in b_vectors[:mid]]
            a2 = [v.get(emo, 0) for v in a_vectors[mid:]]
            b2 = [v.get(emo, 0) for v in b_vectors[mid:]]
            first_half_corrs.append(_pearson(a1, b1))
            second_half_corrs.append(_pearson(a2, b2))
        first_avg = sum(first_half_corrs) / len(first_half_corrs)
        second_avg = sum(second_half_corrs) / len(second_half_corrs)
        inversion_score = first_avg - second_avg
    else:
        inversion_score = 0.0

    # Classify pattern
    if abs(inversion_score) > 0.4:
        pattern = "inversion"  # They swap roles
    elif avg_corr > 0.3:
        pattern = "convergent"  # They move together
    elif avg_corr < -0.3:
        pattern = "divergent"  # They move opposite
    else:
        pattern = "independent"

    # Key emotional moments: find the block with maximum emotional divergence
    max_divergence_idx = 0
    max_divergence_val = 0
    for i in range(len(a_vectors)):
        div = sum(abs(a_vectors[i].get(e, 0) - b_vectors[i].get(e, 0)) for e in EMOTIONS)
        if div > max_divergence_val:
            max_divergence_val = div
            max_divergence_idx = i

    return {
        "pattern": pattern,
        "shared_blocks": len(a_vectors),
        "avg_correlation": round(avg_corr, 3),
        "inversion_score": round(inversion_score, 3),
        "emotion_correlations": {k: round(v, 3) for k, v in correlations.items()},
        "peak_divergence_block": max_divergence_idx,
    }


def _pearson(xs: list[float], ys: list[float]) -> float:
    """Simple Pearson correlation coefficient."""
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx * dy == 0:
        return 0.0
    return num / (dx * dy)


def _classify_relationship(help_count: int, harm_count: int,
                           pattern: str) -> str:
    """Classify the relationship type for edge labelling."""
    net = help_count - harm_count
    total = help_count + harm_count
    if total == 0:
        return "neutral"
    ratio = net / total

    if pattern == "inversion":
        if ratio > 0.2:
            return "spiral_couple"   # Start allies, dynamics flip
        elif ratio < -0.2:
            return "nemesis"
        else:
            return "mirror"          # Trade places

    if ratio > 0.5:
        return "allies"
    elif ratio > 0.1:
        return "uneasy_allies"
    elif ratio < -0.5:
        return "enemies"
    elif ratio < -0.1:
        return "rivals"
    else:
        return "complex"


def _generate_edge_label(rel_type: str, char_a: str, char_b: str,
                         help_count: int, harm_count: int,
                         correlation: dict) -> str:
    """Auto-generate a descriptive edge label."""
    pattern = correlation.get("pattern", "independent")
    inv = correlation.get("inversion_score", 0)

    labels = {
        "spiral_couple": f"Bonded spiral — they pull each other into escalation",
        "mirror": f"Mirror pair — they trade roles as the story progresses",
        "nemesis": f"Nemesis — mutual destruction through opposition",
        "allies": f"Alliance — {help_count} acts of aid bind them",
        "uneasy_allies": f"Uneasy alliance — help ({help_count}) mixed with harm ({harm_count})",
        "enemies": f"Enemies — {harm_count} hostile acts define this relationship",
        "rivals": f"Rivals — competitive tension with {harm_count} conflicts",
        "complex": f"Complex — neither ally nor enemy ({help_count} aid, {harm_count} harm)",
        "neutral": f"Parallel paths — present together but rarely interacting directly",
    }

    return labels.get(rel_type, f"Relationship between {char_a} and {char_b}")


def compute_relationships(book_id: str) -> dict:
    """
    Detect character relationship clusters: pairs, factions, triangles.
    Returns nodes (characters) and edges (relationships) with metadata.
    """
    config = BOOKS[book_id]
    blocks = _load_blocks(book_id)

    # ── Step 1: Build character appearances + total emotions ──
    char_appearances = defaultdict(int)
    char_emotions_total = defaultdict(lambda: {e: 0.0 for e in EMOTIONS})
    char_beliefs_total = defaultdict(lambda: {b: 0.0 for b in BELIEFS})

    for b in blocks:
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
            for raw_name, emo_dict in delta.items():
                if not isinstance(emo_dict, dict):
                    continue
                canon = _normalize_character_name(raw_name, book_id)
                if canon is None:
                    continue
                char_appearances[canon] += 1
                for emo in EMOTIONS:
                    char_emotions_total[canon][emo] += emo_dict.get(emo, 0)

        belief = b.get("belief", {})
        if isinstance(belief, dict):
            bdelta = belief.get("belief_delta", belief)
            for raw_name, bel_dict in bdelta.items():
                if not isinstance(bel_dict, dict):
                    continue
                canon = _normalize_character_name(raw_name, book_id)
                if canon is None:
                    continue
                for bel in BELIEFS:
                    char_beliefs_total[canon][bel] += bel_dict.get(bel, 0)

    # Top characters by appearances (limit to meaningful cast)
    sorted_chars = sorted(char_appearances.items(), key=lambda x: x[1], reverse=True)
    top_chars = [name for name, count in sorted_chars if count >= 3][:12]

    if len(top_chars) < 2:
        return {
            "book_id": book_id,
            "title": config["title"],
            "nodes": [],
            "edges": [],
            "clusters": [],
        }

    # ── Step 2: Build event-based interaction counts ──
    pair_help = defaultdict(int)
    pair_harm = defaultdict(int)
    pair_events = defaultdict(list)

    for b in blocks:
        events = b.get("events", {})
        if isinstance(events, dict):
            event_list = events.get("events", [])
        elif isinstance(events, list):
            event_list = events
        else:
            event_list = []

        for ev in event_list:
            if not isinstance(ev, dict):
                continue
            actor_raw = ev.get("actor", "")
            target_raw = ev.get("target", "")
            if not actor_raw or not target_raw:
                continue

            actor = _normalize_character_name(actor_raw, book_id)
            target = _normalize_character_name(target_raw, book_id)
            if not actor or not target or actor == target:
                continue
            if actor not in top_chars or target not in top_chars:
                continue

            pair_key = tuple(sorted([actor, target]))
            ptype = ev.get("primary_type", "SPEECH")

            if ptype in HELP_TYPES:
                pair_help[pair_key] += 1
            elif ptype in HARM_TYPES:
                pair_harm[pair_key] += 1

            pair_events[pair_key].append({
                "actor": actor,
                "target": target,
                "type": ptype,
                "tags": ev.get("secondary_tags", []),
                "description": ev.get("description", ""),
                "block_id": b.get("block_id", ""),
                "chapter": b.get("chapter_id", ""),
            })

    # ── Step 3: Co-appearance analysis ──
    co_blocks = _co_appearance_blocks(blocks, book_id)

    # ── Step 4: Build edges with emotional correlation ──
    edges = []
    for pair_key in set(list(pair_events.keys()) + list(co_blocks.keys())):
        a, b_char = pair_key
        if a not in top_chars or b_char not in top_chars:
            continue

        help_c = pair_help.get(pair_key, 0)
        harm_c = pair_harm.get(pair_key, 0)
        total_interactions = help_c + harm_c
        co_count = len(co_blocks.get(pair_key, []))

        # Skip very weak connections
        if total_interactions < 2 and co_count < 3:
            continue

        # Emotional correlation analysis
        corr = _emotional_correlation(blocks, a, b_char, book_id)
        rel_type = _classify_relationship(help_c, harm_c, corr.get("pattern", "independent"))
        label = _generate_edge_label(rel_type, a, b_char, help_c, harm_c, corr)

        # Compute weight (importance of relationship)
        weight = total_interactions + co_count * 0.3

        # Get key events (most significant moments)
        all_evts = pair_events.get(pair_key, [])
        key_events = [e for e in all_evts if e["type"] in HARM_TYPES | HELP_TYPES][:5]
        if not key_events:
            key_events = all_evts[:3]

        edges.append({
            "source": a,
            "target": b_char,
            "relationship_type": rel_type,
            "label": label,
            "help_count": help_c,
            "harm_count": harm_c,
            "total_interactions": total_interactions,
            "co_appearances": co_count,
            "weight": round(weight, 2),
            "emotional_pattern": corr.get("pattern", "independent"),
            "avg_correlation": corr.get("avg_correlation", 0),
            "inversion_score": corr.get("inversion_score", 0),
            "emotion_correlations": corr.get("emotion_correlations", {}),
            "key_events": key_events,
        })

    # Sort edges by weight to surface most important relationships
    edges.sort(key=lambda e: e["weight"], reverse=True)

    # ── Step 5: Build nodes ──
    nodes = []
    for char in top_chars:
        emos = char_emotions_total.get(char, {e: 0 for e in EMOTIONS})
        bels = char_beliefs_total.get(char, {b: 0 for b in BELIEFS})
        dominant = _get_dominant_emotion_positive(emos)

        # Compute character's "role" based on their edges
        total_help_given = 0
        total_harm_given = 0
        for e in edges:
            if e["source"] == char or e["target"] == char:
                total_help_given += e["help_count"]
                total_harm_given += e["harm_count"]

        if total_harm_given > total_help_given * 2:
            role = "antagonist"
        elif total_help_given > total_harm_given * 2:
            role = "ally"
        elif char == config.get("protagonist"):
            role = "protagonist"
        else:
            role = "supporting"

        # Emotional arc summary: early vs late emotions
        early_emos = {e: 0.0 for e in EMOTIONS}
        late_emos = {e: 0.0 for e in EMOTIONS}
        mid_block = len(blocks) // 2
        for i, block in enumerate(blocks):
            momentum = block.get("momentum", {})
            if isinstance(momentum, dict):
                delta = momentum.get("momentum_delta", momentum)
                for raw_name, emo_dict in delta.items():
                    if not isinstance(emo_dict, dict):
                        continue
                    canon = _normalize_character_name(raw_name, book_id)
                    if canon == char:
                        target_dict = early_emos if i < mid_block else late_emos
                        for emo in EMOTIONS:
                            target_dict[emo] += emo_dict.get(emo, 0)

        early_dominant = _get_dominant_emotion_positive(early_emos)
        late_dominant = _get_dominant_emotion_positive(late_emos)
        arc_shift = early_dominant != late_dominant

        nodes.append({
            "id": char,
            "name": char,
            "appearances": char_appearances.get(char, 0),
            "role": role,
            "dominant_emotion": dominant,
            "emotions": {k: round(v, 2) for k, v in emos.items()},
            "beliefs": {k: round(v, 2) for k, v in bels.items()},
            "early_dominant": early_dominant,
            "late_dominant": late_dominant,
            "arc_shift": arc_shift,
        })

    # ── Step 6: Detect clusters (factions / groups) ──
    clusters = _detect_clusters(nodes, edges)

    return {
        "book_id": book_id,
        "title": config["title"],
        "protagonist": config.get("protagonist", ""),
        "nodes": nodes,
        "edges": edges,
        "clusters": clusters,
    }


def compute_character_data(book_id: str) -> dict:
    """
    Compute per-character per-chapter emotional, belief, conservation,
    and event data for the character-level dashboard charts.

    Returns a single dict with:
      - character_chapters: per-char per-chapter emotions (averaged per block)
      - character_beliefs: per-char per-chapter belief deltas (summed)
      - conservation: per-chapter energy totals across ALL characters
      - events: full event timeline with position data
      - event_types: unique event types present
      - characters: top 12 characters by appearances
      - chapters: sorted chapter list
    """
    config = BOOKS[book_id]
    blocks = _load_blocks(book_id)

    POSITIVE_EMOTIONS = {"hope", "pride", "resolve"}
    NEGATIVE_EMOTIONS = {"anger", "fear", "shame"}

    # ── Group blocks by chapter ──
    chapter_blocks = defaultdict(list)
    for b in blocks:
        ch = b.get("chapter_id", "unknown")
        chapter_blocks[ch].append(b)

    chapters = sorted(chapter_blocks.keys())

    # ── Count total appearances per character (across all blocks) ──
    char_total_appearances = defaultdict(int)
    for b in blocks:
        momentum = b.get("momentum", {})
        if isinstance(momentum, dict):
            delta = momentum.get("momentum_delta", momentum)
            for raw_name, emo_dict in delta.items():
                if not isinstance(emo_dict, dict):
                    continue
                canon = _normalize_character_name(raw_name, book_id)
                if canon is None:
                    continue
                char_total_appearances[canon] += 1

    # Top 12 characters by total appearances, sorted descending
    sorted_chars = sorted(
        char_total_appearances.items(), key=lambda x: x[1], reverse=True
    )
    top_chars = [name for name, _ in sorted_chars[:12]]

    # ── Per-character per-chapter emotions (averaged) ──
    # Structure: char -> chapter -> { emotion sums, count }
    char_ch_emo_accum = defaultdict(lambda: defaultdict(lambda: {
        "sums": {e: 0.0 for e in EMOTIONS},
        "count": 0,
    }))

    for ch in chapters:
        for b in chapter_blocks[ch]:
            momentum = b.get("momentum", {})
            if isinstance(momentum, dict):
                delta = momentum.get("momentum_delta", momentum)
                for raw_name, emo_dict in delta.items():
                    if not isinstance(emo_dict, dict):
                        continue
                    canon = _normalize_character_name(raw_name, book_id)
                    if canon is None or canon not in top_chars:
                        continue
                    accum = char_ch_emo_accum[canon][ch]
                    accum["count"] += 1
                    for e in EMOTIONS:
                        accum["sums"][e] += emo_dict.get(e, 0)

    # Build character_chapters output (averaged emotions per chapter)
    character_chapters = {}
    for char in top_chars:
        char_strip = []
        for ch in chapters:
            accum = char_ch_emo_accum[char][ch]
            count = accum["count"]
            if count > 0:
                avg_emos = {e: round(accum["sums"][e] / count, 4) for e in EMOTIONS}
            else:
                avg_emos = {e: 0.0 for e in EMOTIONS}

            net_positive = round(sum(avg_emos[e] for e in POSITIVE_EMOTIONS), 4)
            net_negative = round(-sum(abs(avg_emos[e]) for e in NEGATIVE_EMOTIONS), 4)

            char_strip.append({
                "chapter": ch,
                "net_positive": net_positive,
                "net_negative": net_negative,
                **avg_emos,
                "appearances": count,
            })
        character_chapters[char] = char_strip

    # ── Per-character per-chapter beliefs (summed deltas) ──
    char_ch_bel_accum = defaultdict(lambda: defaultdict(lambda: {
        b: 0.0 for b in BELIEFS
    }))

    for ch in chapters:
        for b in chapter_blocks[ch]:
            belief = b.get("belief", {})
            if isinstance(belief, dict):
                bdelta = belief.get("belief_delta", belief)
                for raw_name, bel_dict in bdelta.items():
                    if not isinstance(bel_dict, dict):
                        continue
                    canon = _normalize_character_name(raw_name, book_id)
                    if canon is None or canon not in top_chars:
                        continue
                    for bel in BELIEFS:
                        char_ch_bel_accum[canon][ch][bel] += bel_dict.get(bel, 0)

    character_beliefs = {}
    for char in top_chars:
        char_bel_strip = []
        for ch in chapters:
            bel_vals = char_ch_bel_accum[char][ch]
            char_bel_strip.append({
                "chapter": ch,
                **{b: round(bel_vals[b], 4) for b in BELIEFS},
            })
        character_beliefs[char] = char_bel_strip

    # ── Conservation data: per-chapter aggregated across ALL characters ──
    conservation = []
    for ch in chapters:
        ch_net_positive = 0.0
        ch_net_negative = 0.0

        for b in chapter_blocks[ch]:
            momentum = b.get("momentum", {})
            if isinstance(momentum, dict):
                delta = momentum.get("momentum_delta", momentum)
                for raw_name, emo_dict in delta.items():
                    if not isinstance(emo_dict, dict):
                        continue
                    canon = _normalize_character_name(raw_name, book_id)
                    if canon is None:
                        continue
                    for e in POSITIVE_EMOTIONS:
                        ch_net_positive += emo_dict.get(e, 0)
                    for e in NEGATIVE_EMOTIONS:
                        ch_net_negative -= abs(emo_dict.get(e, 0))

        total_energy = round(ch_net_positive + ch_net_negative, 4)
        conservation.append({
            "chapter": ch,
            "net_positive": round(ch_net_positive, 4),
            "net_negative": round(ch_net_negative, 4),
            "total_energy": total_energy,
        })

    # ── Events timeline: all events with position data ──
    events_list = []
    event_types_set = set()

    # Build chapter -> numeric index map
    chapter_num_map = {ch: idx + 1 for idx, ch in enumerate(chapters)}

    for ch in chapters:
        for block_idx, b in enumerate(chapter_blocks[ch]):
            events = b.get("events", {})
            if isinstance(events, dict):
                event_items = events.get("events", [])
            elif isinstance(events, list):
                event_items = events
            else:
                event_items = []

            for ev in event_items:
                if not isinstance(ev, dict):
                    continue

                ptype = ev.get("primary_type", "UNKNOWN")
                event_types_set.add(ptype)

                actor_raw = ev.get("actor", "")
                target_raw = ev.get("target", "")
                actor = _normalize_character_name(actor_raw, book_id) if actor_raw else actor_raw
                target = _normalize_character_name(target_raw, book_id) if target_raw else target_raw

                events_list.append({
                    "chapter": ch,
                    "chapter_num": chapter_num_map[ch],
                    "block_num": block_idx,
                    "event_type": ptype,
                    "actor": actor or "",
                    "target": target or "",
                    "description": ev.get("description", ""),
                })

    return {
        "book_id": book_id,
        "title": config["title"],
        "culture": config["culture"],
        "characters": top_chars,
        "chapters": chapters,
        "character_chapters": character_chapters,
        "character_beliefs": character_beliefs,
        "conservation": conservation,
        "events": events_list,
        "event_types": sorted(event_types_set),
    }


def _detect_clusters(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Simple cluster detection: group characters into factions based on
    strong ally/enemy patterns. Uses a greedy approach.
    """
    if not edges:
        return []

    # Build adjacency with sentiment
    adj = defaultdict(dict)
    for e in edges:
        sentiment = e["help_count"] - e["harm_count"]
        adj[e["source"]][e["target"]] = sentiment
        adj[e["target"]][e["source"]] = sentiment

    # Greedy clustering: start with strongest ally pairs, grow outward
    assigned = {}
    clusters = []
    cluster_id = 0

    # Sort edges by absolute help (strongest bonds first)
    ally_edges = sorted(
        [e for e in edges if e["help_count"] > e["harm_count"]],
        key=lambda e: e["help_count"],
        reverse=True,
    )

    for e in ally_edges:
        s, t = e["source"], e["target"]
        if s in assigned and t in assigned:
            continue  # Both already placed
        elif s in assigned:
            # Try to add t to s's cluster
            cid = assigned[s]
            cluster_members = [n for n, c in assigned.items() if c == cid]
            # Check t is not enemy to most members
            friends = sum(1 for m in cluster_members if adj.get(t, {}).get(m, 0) >= 0)
            if friends >= len(cluster_members) * 0.5:
                assigned[t] = cid
        elif t in assigned:
            cid = assigned[t]
            cluster_members = [n for n, c in assigned.items() if c == cid]
            friends = sum(1 for m in cluster_members if adj.get(s, {}).get(m, 0) >= 0)
            if friends >= len(cluster_members) * 0.5:
                assigned[s] = cid
        else:
            # New cluster
            assigned[s] = cluster_id
            assigned[t] = cluster_id
            cluster_id += 1

    # Group into cluster objects
    cluster_map = defaultdict(list)
    for char, cid in assigned.items():
        cluster_map[cid].append(char)

    for cid, members in cluster_map.items():
        if len(members) < 2:
            continue

        # Determine cluster vibe
        internal_help = 0
        internal_harm = 0
        for e in edges:
            if e["source"] in members and e["target"] in members:
                internal_help += e["help_count"]
                internal_harm += e["harm_count"]

        if internal_harm > internal_help:
            vibe = "toxic"
        elif internal_help > internal_harm * 3:
            vibe = "tight_knit"
        else:
            vibe = "mixed"

        clusters.append({
            "cluster_id": cid,
            "members": members,
            "size": len(members),
            "vibe": vibe,
            "internal_help": internal_help,
            "internal_harm": internal_harm,
        })

    clusters.sort(key=lambda c: c["size"], reverse=True)
    return clusters
