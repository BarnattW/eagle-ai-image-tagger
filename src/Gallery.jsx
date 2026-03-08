import { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext, memo } from "react";
import { useMasonry, usePositioner } from "masonic";
import { useTaggerStore } from "../store/taggerStore";
import { useSettingsStore } from "../store/settingsStore";
import ImagePreview from "./ImagePreview";
import TagPanel from "./TagPanel";
import TagPicker from "./TagPicker";

const GalleryCtx = createContext(null);

// paddingBottom trick gives masonic correct height before the image loads
const AspectBox = ({ ratio, children }) => (
  <div style={{ position: "relative", paddingBottom: `${(1 / ratio) * 100}%` }}>
    <div style={{ position: "absolute", inset: 0 }}>{children}</div>
  </div>
);

const Thumbnail = memo(({ src, fallback, alt, ratio }) => {
  const [currentSrc, setCurrentSrc] = useState(src || fallback);
  const [broken, setBroken] = useState(!src && !fallback);

  if (broken) {
    return (
      <AspectBox ratio={ratio}>
        <div className="w-full h-full bg-eagle-btn-bg border border-eagle-border flex items-center justify-center">
          <svg className="w-6 h-6 text-eagle-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </AspectBox>
    );
  }

  return (
    <AspectBox ratio={ratio}>
      <img
        src={currentSrc}
        alt={alt}
        className="w-full h-full object-cover"
        draggable={false}
        onError={() => {
          if (currentSrc !== fallback && fallback) setCurrentSrc(fallback);
          else setBroken(true);
        }}
      />
    </AspectBox>
  );
});

const CheckIcon = () => (
  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <polyline points="2,6 5,9 10,3" />
  </svg>
);

const GalleryCard = memo(({ data: item }) => {
  const { selectedIds, onItemClick, onCheckboxClick, selectMode } = useContext(GalleryCtx);
  const isSelected = selectedIds.has(item.id);
  const isUntagged = !item.tags || item.tags.length === 0;
  const ratio = item.width && item.height ? item.width / item.height : 1;

  return (
    <div
      data-item-id={item.id}
      onClick={(e) => onItemClick(item, e)}
      title={item.name}
      className={`group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-150 ${
        isSelected ? "border-eagle-accent" : "border-transparent hover:border-eagle-border"
      }`}
    >
      <div className="relative">
        <Thumbnail src={item.thumbnailPath} fallback={item.filePath} alt={item.name} ratio={ratio} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
        {isSelected && <div className="absolute inset-0 bg-eagle-accent/20 pointer-events-none" />}

        {/* Checkbox */}
        <div
          className={`absolute top-1.5 left-1.5 transition-opacity ${
            isSelected || selectMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => { e.stopPropagation(); onCheckboxClick(item); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-eagle-accent border-eagle-accent" : "bg-black/40 border-white/60"
          }`}>
            {isSelected && <CheckIcon />}
          </div>
        </div>

        {isUntagged && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-400 shadow" title="Untagged" />
        )}
      </div>

      <div className="px-1.5 py-1 bg-eagle-panel">
        <p className="text-xs text-eagle-text truncate leading-tight">{item.name}</p>
        {item.width && item.height && (
          <p className="text-xs text-eagle-text-muted">{item.width} × {item.height}</p>
        )}
      </div>
    </div>
  );
});

// Masonry wired to a div's scroll instead of window scroll
const DivMasonry = ({ items, containerRef, columnWidth = 160 }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimer = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);

    const onScroll = () => {
      setScrollTop(el.scrollTop);
      setIsScrolling(true);
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setIsScrolling(false), 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimer.current);
    };
  }, [containerRef]);

  const positioner = usePositioner(
    { width: Math.max(0, size.width - 24), columnWidth, columnGutter: 8 },
    [size.width, columnWidth]
  );

  return useMasonry({
    positioner,
    scrollTop,
    isScrolling,
    height: size.height,
    items,
    render: GalleryCard,
    overscanBy: 5,
    itemKey: (item) => item?.id ?? String(Math.random()),
    style: { padding: 12 },
  });
};

// Pin button for filter section headers
const PinBtn = ({ pinned, onClick }) => (
  <button
    onClick={onClick}
    title={pinned ? "Unpin from top bar" : "Pin to top bar"}
    className={`ml-auto text-xs px-1.5 py-0.5 rounded border transition-colors ${
      pinned
        ? "bg-eagle-accent/20 border-eagle-accent/40 text-eagle-accent"
        : "bg-eagle-btn-bg border-eagle-border text-eagle-text-muted hover:text-eagle-text hover:border-eagle-accent/40"
    }`}
  >
    {pinned ? "Pinned" : "Pin"}
  </button>
);

// Reusable status filter pill group — options is [[value, label], ...]
const StatusPills = ({ filterStatus, setFilterStatus, options }) => (
  <div className="flex rounded-lg border border-eagle-border overflow-hidden text-xs">
    {options.map(([val, label]) => (
      <button key={val} onClick={() => setFilterStatus(val)}
        className={`px-3 py-1.5 border-l border-eagle-border first:border-l-0 transition-colors ${
          filterStatus === val ? "bg-eagle-btn-bg text-eagle-text" : "text-eagle-text-secondary hover:bg-eagle-btn-hover"
        }`}>
        {label}
      </button>
    ))}
  </div>
);

// Manages show/style state for a floating TagPicker.
// open(e) reads position from the clicked button's bounding rect.
function useTagPickerPopup() {
  const [show, setShow] = useState(false);
  const [style, setStyle] = useState({});
  const open = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setStyle({ top: rect.bottom + 6, left: rect.left });
    setShow(true);
  };
  return { show, style, open, close: () => setShow(false) };
}

const Gallery = () => {
  const { allItems, loadAllItems, batchProgress, tagItems, cancelTagItems, selectItem, selectedItem } = useTaggerStore();

  // Filter state
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "tagged" | "untagged"
  const [includeTags, setIncludeTags] = useState([]);
  const [includeMode, setIncludeMode] = useState("and"); // "and" | "or"
  const [excludeTags, setExcludeTags] = useState([]);
  const [sortBy, setSortBy] = useState("default");
  const [nameSearch, setNameSearch] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  // pinnedControls persisted in settings store (as array), converted to Set for O(1) lookup
  const { pinnedControls: pinnedArray, update: updateSettings } = useSettingsStore();
  const pinnedControls = useMemo(() => new Set(pinnedArray), [pinnedArray]);

  // One picker instance per filter type — shared between top bar and filter panel trigger buttons
  const includePicker = useTagPickerPopup();
  const excludePicker = useTagPickerPopup();

  const addIncludeTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (t && !includeTags.includes(t)) setIncludeTags((prev) => [...prev, t]);
    setIncludeInput("");
  };
  const addExcludeTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (t && !excludeTags.includes(t)) setExcludeTags((prev) => [...prev, t]);
    setExcludeInput("");
  };

  const togglePin = (name) => {
    updateSettings({
      pinnedControls: pinnedArray.includes(name)
        ? pinnedArray.filter((x) => x !== name)
        : [...pinnedArray, name],
    });
  };

  const clearAllFilters = () => {
    setFilterStatus("all"); setIncludeTags([]); setExcludeTags([]);
    setSortBy("default"); setIncludeMode("and"); setNameSearch("");
  };
  const hasActiveFilters = filterStatus !== "all" || includeTags.length > 0 || excludeTags.length > 0 || sortBy !== "default" || nameSearch.trim() !== "";

  const [columnWidth, setColumnWidth] = useState(160);
  const [debouncedColumnWidth, setDebouncedColumnWidth] = useState(160);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedColumnWidth(columnWidth), 150);
    return () => clearTimeout(t);
  }, [columnWidth]);

  const [viewMode, setViewMode] = useState("grid");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const scrollRef = useRef(null);
  const lastClickedIdxRef = useRef(null);
  const touchStartX = useRef(null);

  const loaded = useRef(false);
  if (!loaded.current) { loaded.current = true; loadAllItems(); }

  const filteredItems = useMemo(() => {
    let items = allItems.filter(Boolean);
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      items = items.filter((x) => x.name?.toLowerCase().includes(q));
    }
    if (filterStatus === "untagged") items = items.filter((x) => !x.tags?.length);
    else if (filterStatus === "tagged") items = items.filter((x) => x.tags?.length > 0);
    if (includeTags.length > 0) {
      items = includeMode === "and"
        ? items.filter((x) => includeTags.every((f) => x.tags?.some((t) => typeof t === "string" && t.toLowerCase().includes(f))))
        : items.filter((x) => includeTags.some((f) => x.tags?.some((t) => typeof t === "string" && t.toLowerCase().includes(f))));
    }
    if (excludeTags.length > 0) {
      items = items.filter((x) => !excludeTags.some((f) => x.tags?.some((t) => typeof t === "string" && t.toLowerCase().includes(f))));
    }
    if (sortBy === "name-asc") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "name-desc") items = [...items].sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === "tags-asc") items = [...items].sort((a, b) => (a.tags?.length ?? 0) - (b.tags?.length ?? 0));
    else if (sortBy === "tags-desc") items = [...items].sort((a, b) => (b.tags?.length ?? 0) - (a.tags?.length ?? 0));
    return items;
  }, [allItems, nameSearch, filterStatus, includeTags, includeMode, excludeTags, sortBy]);

  // Stable key for DivMasonry — changing it forces a remount and clears Masonic's internal WeakMap cache
  const masonryKey = `${filterStatus}|${nameSearch}|${includeTags.join(",")}|${excludeTags.join(",")}|${includeMode}|${sortBy}`;

  const untaggedCount = allItems.filter((x) => !x.tags?.length).length;
  const taggedCount = allItems.filter((x) => x.tags?.length > 0).length;

  const handleItemClick = useCallback((item, e) => {
    if (batchProgress) return;
    const idx = filteredItems.findIndex((x) => x.id === item.id);

    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      e.stopPropagation();
      const [start, end] = [
        Math.min(lastClickedIdxRef.current, idx),
        Math.max(lastClickedIdxRef.current, idx),
      ];
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(filteredItems[i].id);
        return next;
      });
      lastClickedIdxRef.current = idx;
    } else if (selectMode || e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        return next;
      });
      lastClickedIdxRef.current = idx;
    } else {
      selectItem(item);
      setViewMode("detail");
      lastClickedIdxRef.current = null;
    }
  }, [batchProgress, selectItem, selectMode, filteredItems]);

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  };

  const handleTagSelected = () => {
    tagItems(allItems.filter((x) => selectedIds.has(x.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleCheckboxClick = useCallback((item) => {
    if (batchProgress) return;
    const idx = filteredItems.findIndex((x) => x.id === item.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });
    lastClickedIdxRef.current = idx;
  }, [batchProgress, filteredItems]);

  const ctxValue = useMemo(
    () => ({ selectedIds, onItemClick: handleItemClick, onCheckboxClick: handleCheckboxClick, selectMode }),
    [selectedIds, handleItemClick, handleCheckboxClick, selectMode]
  );

  const detailIdx = filteredItems.findIndex((x) => x.id === selectedItem?.id);
  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= filteredItems.length) return;
    selectItem(filteredItems[idx]);
  }, [filteredItems, selectItem]);

  useEffect(() => {
    if (viewMode !== "detail") return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") goTo(detailIdx + 1);
      else if (e.key === "ArrowLeft") goTo(detailIdx - 1);
      else if (e.key === "Escape") setViewMode("grid");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, detailIdx, goTo]);

  if (viewMode === "detail") {
    return (
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 50) goTo(detailIdx + (dx < 0 ? 1 : -1));
          touchStartX.current = null;
        }}
      >
        <div className="px-4 py-2 border-b border-eagle-border bg-eagle-panel flex items-center gap-3">
          <button
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 text-sm text-eagle-text-secondary hover:text-eagle-text transition-colors"
          >
            ← Gallery
          </button>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => goTo(detailIdx - 1)}
              disabled={detailIdx <= 0}
              className="px-2 py-1 text-sm bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-xs text-eagle-text-muted tabular-nums px-1">
              {detailIdx + 1} / {filteredItems.length}
            </span>
            <button
              onClick={() => goTo(detailIdx + 1)}
              disabled={detailIdx >= filteredItems.length - 1}
              className="px-2 py-1 text-sm bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <ImagePreview />
          <TagPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-2 border-b border-eagle-border bg-eagle-panel flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilterPanel((v) => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
            showFilterPanel || hasActiveFilters
              ? "bg-eagle-accent/20 border-eagle-accent/50 text-eagle-text"
              : "bg-eagle-btn-bg hover:bg-eagle-btn-hover border-eagle-border text-eagle-text"
          }`}
        >
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-eagle-accent" />}
        </button>

        <span className="text-xs text-eagle-text-muted">{filteredItems.length} / {allItems.length}</span>

        <input
          type="range" min={100} max={300} step={20}
          value={columnWidth}
          onChange={(e) => setColumnWidth(Number(e.target.value))}
          title={`Thumbnail size: ${columnWidth}px`}
          className="w-20 accent-eagle-accent"
        />

        {/* Pinned filter controls rendered inline in the top bar */}
        {pinnedControls.has("search") && (
          <div className="relative">
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Search name…"
              className="pl-6 pr-5 py-1 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors w-36"
            />
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-eagle-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            {nameSearch && (
              <button onClick={() => setNameSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-eagle-text-muted hover:text-eagle-text leading-none text-xs">×</button>
            )}
          </div>
        )}

        {pinnedControls.has("status") && (
          <StatusPills
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            options={[["all", "All"], ["tagged", "Tagged"], ["untagged", "Untagged"]]}
          />
        )}

        {pinnedControls.has("sort") && (
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="px-2 py-1 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text focus:outline-none focus:border-eagle-accent transition-colors">
            <option value="default">Default order</option>
            <option value="name-asc">Name A→Z</option>
            <option value="name-desc">Name Z→A</option>
            <option value="tags-asc">Fewest tags</option>
            <option value="tags-desc">Most tags</option>
          </select>
        )}

        {pinnedControls.has("include") && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-eagle-text-muted">Include:</span>
            <div className="flex rounded border border-eagle-border overflow-hidden text-xs">
              {["and", "or"].map((m) => (
                <button key={m} onClick={() => setIncludeMode(m)}
                  className={`px-1.5 py-0.5 border-l border-eagle-border first:border-l-0 uppercase transition-colors ${includeMode === m ? "bg-eagle-accent text-white" : "text-eagle-text-secondary hover:bg-eagle-btn-hover"}`}>
                  {m}
                </button>
              ))}
            </div>
            {includeTags.map((f) => (
              <span key={f} className="flex items-center gap-0.5 bg-eagle-accent/20 border border-eagle-accent/40 rounded px-1.5 py-0.5 text-xs text-eagle-text">
                {f}<button onClick={() => setIncludeTags((p) => p.filter((t) => t !== f))} className="opacity-60 hover:opacity-100 leading-none">×</button>
              </span>
            ))}
            <button onClick={includePicker.open}
              className="px-1.5 py-0.5 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded text-eagle-text-secondary hover:text-eagle-text transition-colors text-xs leading-none">+</button>
          </div>
        )}

        {pinnedControls.has("exclude") && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-eagle-text-muted">Exclude:</span>
            {excludeTags.map((f) => (
              <span key={f} className="flex items-center gap-0.5 bg-red-900/20 border border-red-700/30 rounded px-1.5 py-0.5 text-xs text-eagle-text">
                {f}<button onClick={() => setExcludeTags((p) => p.filter((t) => t !== f))} className="opacity-60 hover:opacity-100 leading-none">×</button>
              </span>
            ))}
            <button onClick={excludePicker.open}
              className="px-1.5 py-0.5 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded text-eagle-text-secondary hover:text-eagle-text transition-colors text-xs leading-none">+</button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={toggleSelectMode}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selectMode
                ? "bg-eagle-accent text-white border-eagle-accent"
                : "bg-eagle-btn-bg hover:bg-eagle-btn-hover border-eagle-border text-eagle-text"
            }`}
          >
            {selectMode ? `Selecting (${selectedIds.size})` : "Select"}
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleTagSelected}
              disabled={!!batchProgress}
              className="px-3 py-1.5 text-sm bg-eagle-primary hover:bg-eagle-primary-hover text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Tag Selected ({selectedIds.size})
            </button>
          )}

          <button
            onClick={() => tagItems(filteredItems)}
            disabled={!!batchProgress || filteredItems.length === 0}
            className="px-3 py-1.5 text-sm bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border text-eagle-text rounded-lg transition-colors disabled:opacity-50"
          >
            Tag All
          </button>
        </div>

        {batchProgress && (
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1.5 bg-eagle-btn-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-eagle-accent rounded-full transition-all duration-200"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-eagle-text-secondary tabular-nums">
              {batchProgress.current}/{batchProgress.total}
            </span>
            <button
              onClick={cancelTagItems}
              className="px-2 py-1 text-xs bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border text-eagle-text-secondary hover:text-eagle-text rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div className="px-4 py-3 border-b border-eagle-border bg-eagle-panel flex flex-col gap-3">
          {/* Row 0: Name search */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-eagle-text-muted font-medium">Search by name</span>
              <PinBtn pinned={pinnedControls.has("search")} onClick={() => togglePin("search")} />
            </div>
            <div className="relative w-64">
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Filter by filename…"
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors"
              />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-eagle-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {nameSearch && (
                <button onClick={() => setNameSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-eagle-text-muted hover:text-eagle-text leading-none">×</button>
              )}
            </div>
          </div>

          {/* Row 1: Status + Sort */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-eagle-text-muted font-medium">Status</span>
                <PinBtn pinned={pinnedControls.has("status")} onClick={() => togglePin("status")} />
              </div>
              <StatusPills
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                options={[
                  ["all", `All (${allItems.length})`],
                  ["tagged", `Tagged (${taggedCount})`],
                  ["untagged", `Untagged (${untaggedCount})`],
                ]}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-eagle-text-muted font-medium">Sort</span>
                <PinBtn pinned={pinnedControls.has("sort")} onClick={() => togglePin("sort")} />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1.5 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text focus:outline-none focus:border-eagle-accent transition-colors">
                <option value="default">Default</option>
                <option value="name-asc">Name A→Z</option>
                <option value="name-desc">Name Z→A</option>
                <option value="tags-asc">Fewest tags first</option>
                <option value="tags-desc">Most tags first</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-xs text-eagle-text-muted hover:text-red-400 transition-colors mt-4">
                Clear all
              </button>
            )}
          </div>

          {/* Row 2: Include tags */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-eagle-text-muted font-medium">Include tags</span>
              <div className="flex rounded border border-eagle-border overflow-hidden text-xs">
                {["and", "or"].map((m) => (
                  <button key={m} onClick={() => setIncludeMode(m)}
                    className={`px-2 py-0.5 border-l border-eagle-border first:border-l-0 transition-colors uppercase ${includeMode === m ? "bg-eagle-accent text-white" : "text-eagle-text-secondary hover:bg-eagle-btn-hover"}`}>
                    {m}
                  </button>
                ))}
              </div>
              <PinBtn pinned={pinnedControls.has("include")} onClick={() => togglePin("include")} />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <input type="text" value={includeInput} onChange={(e) => setIncludeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && includeInput.trim()) addIncludeTag(includeInput); }}
                placeholder="Add tag…"
                className="px-2 py-1 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors w-32" />
              <button onClick={includePicker.open}
                className="px-2 py-1 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors text-xs leading-none">⌖</button>
              {includeTags.map((f) => (
                <span key={f} className="flex items-center gap-1 bg-eagle-accent/20 border border-eagle-accent/40 rounded px-2 py-0.5 text-xs text-eagle-text">
                  {f}
                  <button onClick={() => setIncludeTags((p) => p.filter((t) => t !== f))} className="opacity-60 hover:opacity-100 leading-none">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Row 3: Exclude tags */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-eagle-text-muted font-medium">Exclude tags</span>
              <PinBtn pinned={pinnedControls.has("exclude")} onClick={() => togglePin("exclude")} />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <input type="text" value={excludeInput} onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && excludeInput.trim()) addExcludeTag(excludeInput); }}
                placeholder="Add tag…"
                className="px-2 py-1 text-xs bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors w-32" />
              <button onClick={excludePicker.open}
                className="px-2 py-1 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors text-xs leading-none">⌖</button>
              {excludeTags.map((f) => (
                <span key={f} className="flex items-center gap-1 bg-red-900/20 border border-red-700/30 rounded px-2 py-0.5 text-xs text-eagle-text">
                  {f}<button onClick={() => setExcludeTags((p) => p.filter((t) => t !== f))} className="opacity-60 hover:opacity-100 leading-none">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {allItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-eagle-text-muted italic text-sm">
          No items in library
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-eagle-text-muted italic text-sm">
          No items match the current filters
        </div>
      ) : (
        <GalleryCtx.Provider value={ctxValue}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable]">
            {/* key forces Masonic remount when filters change, clearing its internal WeakMap position cache */}
            <DivMasonry key={masonryKey} items={filteredItems} containerRef={scrollRef} columnWidth={debouncedColumnWidth} />
          </div>
        </GalleryCtx.Provider>
      )}

      {includePicker.show && (
        <TagPicker
          multi
          onMultiSelect={(tags) => tags.forEach(addIncludeTag)}
          excludeTags={includeTags}
          onClose={includePicker.close}
          style={includePicker.style}
        />
      )}
      {excludePicker.show && (
        <TagPicker
          multi
          onMultiSelect={(tags) => tags.forEach(addExcludeTag)}
          excludeTags={excludeTags}
          onClose={excludePicker.close}
          style={excludePicker.style}
        />
      )}
    </div>
  );
};

export default Gallery;
