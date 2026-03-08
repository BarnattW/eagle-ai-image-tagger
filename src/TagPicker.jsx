import { useState, useEffect, useRef, useMemo } from "react";
import { useTaggerStore } from "../store/taggerStore";

const SearchIcon = () => (
  <svg className="w-3.5 h-3.5 text-eagle-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
);

// multi=true: stay open, checkboxes, Apply button that calls onMultiSelect([...tags])
// multi=false (default): close on click, calls onSelect(tag)
const TagPicker = ({ onSelect, onMultiSelect, onClose, excludeTags = [], style, multi = false }) => {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(new Set());
  const userTags = useTaggerStore((state) => state.userTags);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const excludeSet = useMemo(
    () => new Set(excludeTags.map((t) => t.toLowerCase())),
    [excludeTags]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return userTags.filter((tag) => {
      const name = typeof tag === "string" ? tag : tag.name;
      return !excludeSet.has(name.toLowerCase()) && name.toLowerCase().includes(q);
    });
  }, [userTags, excludeSet, search]);

  const recent = filtered.slice(0, 12);
  const others = filtered.slice(12);

  const handleClick = (name) => {
    if (!multi) {
      onSelect(name);
      return;
    }
    setPending((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const applyPending = () => {
    if (pending.size > 0) onMultiSelect?.([...pending]);
    onClose();
  };

  const renderGroup = (tags) => (
    <div className="grid grid-cols-2 gap-0.5">
      {tags.map((tag) => {
        const name = typeof tag === "string" ? tag : tag.name;
        const count = typeof tag === "object" && tag.count != null ? tag.count : null;
        const color = typeof tag === "object" && tag.color ? tag.color : null;
        const isSelected = multi && pending.has(name);
        return (
          <button
            key={name}
            onClick={() => handleClick(name)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors min-w-0 group ${
              isSelected ? "bg-eagle-accent/20" : "hover:bg-eagle-btn-hover"
            }`}
          >
            {multi ? (
              <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? "bg-eagle-accent border-eagle-accent" : "border-eagle-border"
              }`}>
                {isSelected && (
                  <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </span>
            ) : (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color || "var(--accent)" }}
              />
            )}
            <span className="text-xs text-eagle-text truncate flex-1">{name}</span>
            {count != null && (
              <span className="text-xs text-eagle-text-muted flex-shrink-0">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={multi ? applyPending : onClose} />
      <div
        className="fixed z-50 w-72 bg-eagle-elevated border border-eagle-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={style}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-eagle-border">
          <SearchIcon />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm text-eagle-text placeholder:text-eagle-text-muted outline-none"
          />
          {multi && pending.size > 0 && (
            <span className="text-xs text-eagle-accent font-medium tabular-nums">{pending.size} selected</span>
          )}
        </div>

        <div className="overflow-y-auto max-h-64 custom-scrollbar [scrollbar-gutter:stable]">
          {filtered.length === 0 ? (
            <p className="text-center text-eagle-text-muted text-xs py-6">
              {userTags.length === 0 ? "No tags in library" : "No matching tags"}
            </p>
          ) : (
            <div className="p-1.5 flex flex-col gap-2">
              {recent.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs text-eagle-text-muted font-medium">
                    Recently ({recent.length})
                  </p>
                  {renderGroup(recent)}
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs text-eagle-text-muted font-medium">
                    Others ({others.length})
                  </p>
                  {renderGroup(others)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-eagle-border px-3 py-1.5 flex items-center gap-2 text-xs select-none">
          {multi ? (
            <>
              <button onClick={onClose} className="text-eagle-text-muted hover:text-eagle-text transition-colors">
                Cancel
              </button>
              <button
                onClick={applyPending}
                disabled={pending.size === 0}
                className="ml-auto px-3 py-1 bg-eagle-accent text-white rounded-md disabled:opacity-40 transition-colors hover:opacity-90"
              >
                Apply{pending.size > 0 ? ` (${pending.size})` : ""}
              </button>
            </>
          ) : (
            <span className="text-eagle-text-muted">Click to add tag</span>
          )}
        </div>
      </div>
    </>
  );
};

export default TagPicker;
