/**
 * CharacterSelector — Dropdown(s) for selecting characters from the book.
 * Supports single or dual character selection for comparison views.
 *
 * Props:
 *   - characters: array of character name strings
 *   - character1: currently selected primary character
 *   - character2: currently selected comparison character (optional)
 *   - onCharacter1Change: callback(name)
 *   - onCharacter2Change: callback(name) — if provided, shows second dropdown
 *   - showSecond: boolean — whether to show the comparison dropdown
 */
export default function CharacterSelector({
  characters,
  character1,
  character2,
  onCharacter1Change,
  onCharacter2Change,
  showSecond = false,
}) {
  if (!characters?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-muted uppercase tracking-wider">Character</label>
        <select
          value={character1 || ''}
          onChange={(e) => onCharacter1Change(e.target.value)}
          className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary
                     focus:outline-none focus:border-culture-english cursor-pointer appearance-none
                     pr-8 bg-no-repeat bg-right"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235c5c72' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundPosition: 'right 8px center',
          }}
        >
          {characters.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {showSecond && onCharacter2Change && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted uppercase tracking-wider">vs</label>
          <select
            value={character2 || ''}
            onChange={(e) => onCharacter2Change(e.target.value || null)}
            className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary
                       focus:outline-none focus:border-culture-english cursor-pointer appearance-none
                       pr-8 bg-no-repeat bg-right"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235c5c72' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="">None</option>
            {characters.filter((n) => n !== character1).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
