import { useState, useEffect, useRef } from "react";
import { useTaggerStore } from "../store/taggerStore";

const SearchIcon = () => (
  <svg className="w-3.5 h-3.5 text-eagle-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
);

const TagPicker = ({ onSelect, onClose, excludeTags = [], style }) => {
  const [search, setSearch] = useState("");
  const userTags = useTaggerStore((state) => state.userTags);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const excludeSet = new Set(excludeTags.map((t) => t.toLowerCase()));

  const filtered = userTags.filter((tag) => {
    const name = typeof tag === "string" ? tag : tag.name;
    return (
      !excludeSet.has(name.toLowerCase()) &&
      name.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Group into recently used (first 12) and others, mirroring Eagle's UI
  const recent = filtered.slice(0, 12);
  const others = filtered.slice(12);

  const renderGroup = (tags) => (
    <div className="grid grid-cols-2 gap-0.5">
      {tags.map((tag) => {
        const name = typeof tag === "string" ? tag : tag.name;
        const count = typeof tag === "object" && tag.count != null ? tag.count : null;
        const color = typeof tag === "object" && tag.color ? tag.color : null;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-eagle-btn-hover text-left transition-colors min-w-0 group"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color || "var(--accent)" }}
            />
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Picker panel */}
      <div
        className="fixed z-50 w-72 bg-eagle-elevated border border-eagle-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={style}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-eagle-border">
          <SearchIcon />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm text-eagle-text placeholder:text-eagle-text-muted outline-none"
          />
        </div>

        {/* Tag list */}
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

        {/* Footer keyboard hints */}
        <div className="border-t border-eagle-border px-3 py-1.5 flex items-center gap-4 text-eagle-text-muted text-xs select-none">
        </div>
      </div>
    </>
  );
};

export default TagPicker;
