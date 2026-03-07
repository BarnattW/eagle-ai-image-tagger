import { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext, memo } from "react";
import { useMasonry, usePositioner } from "masonic";
import { useTaggerStore } from "../store/taggerStore";
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
const DivMasonry = ({ items, containerRef }) => {
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
    { width: Math.max(0, size.width - 24), columnWidth: 160, columnGutter: 8 },
    [size.width]
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

const Gallery = () => {
  const { allItems, loadAllItems, batchProgress, tagItems, cancelTagItems, selectItem } = useTaggerStore();
  const [filter, setFilter] = useState("all");
  const [tagFilters, setTagFilters] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const tagPickerBtnRef = useRef(null);
  const [tagPickerStyle, setTagPickerStyle] = useState({});

  const addTagFilter = (tag) => {
    const t = tag.trim().toLowerCase();
    if (t && !tagFilters.includes(t)) setTagFilters((prev) => [...prev, t]);
    setTagInput("");
  };
  const [viewMode, setViewMode] = useState("grid");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const scrollRef = useRef(null);
  const lastClickedIdxRef = useRef(null);

  const loaded = useRef(false);
  if (!loaded.current) { loaded.current = true; loadAllItems(); }

  const filteredItems = useMemo(() => {
    let items = (filter === "untagged"
      ? allItems.filter((x) => x && (!x.tags || x.tags.length === 0))
      : allItems.filter(Boolean));
    if (tagFilters.length > 0) {
      items = items.filter((x) =>
        tagFilters.every((f) => x.tags?.some((t) => t.toLowerCase().includes(f)))
      );
    }
    return items;
  }, [allItems, filter, tagFilters]);

  const untaggedCount = allItems.filter((x) => !x.tags || x.tags.length === 0).length;

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

  const ctxValue = { selectedIds, onItemClick: handleItemClick, onCheckboxClick: handleCheckboxClick, selectMode };

  if (viewMode === "detail") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-eagle-border bg-eagle-panel flex items-center gap-3">
          <button
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 text-sm text-eagle-text-secondary hover:text-eagle-text transition-colors"
          >
            ← Gallery
          </button>
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
      <div className="px-4 py-2 border-b border-eagle-border bg-eagle-panel flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-eagle-border overflow-hidden text-sm">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 transition-colors ${
              filter === "all" ? "bg-eagle-btn-bg text-eagle-text" : "text-eagle-text-secondary hover:bg-eagle-btn-hover"
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            onClick={() => setFilter("untagged")}
            className={`px-3 py-1.5 border-l border-eagle-border transition-colors ${
              filter === "untagged" ? "bg-eagle-btn-bg text-eagle-text" : "text-eagle-text-secondary hover:bg-eagle-btn-hover"
            }`}
          >
            Untagged ({untaggedCount})
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) addTagFilter(tagInput); }}
            placeholder="Filter by tag…"
            className="px-3 py-1.5 text-sm bg-eagle-btn-bg border border-eagle-border rounded-lg text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors w-36"
          />
          <button
            ref={tagPickerBtnRef}
            onClick={() => {
              const rect = tagPickerBtnRef.current?.getBoundingClientRect();
              if (rect) setTagPickerStyle({ top: rect.bottom + 6, left: rect.left });
              setShowTagPicker((v) => !v);
            }}
            title="Pick tag from library"
            className="px-2 py-1.5 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors text-sm leading-none"
          >
            ⌖
          </button>
          {tagFilters.map((f) => (
            <span key={f} className="flex items-center gap-1 bg-eagle-accent/20 border border-eagle-accent/40 rounded px-2 py-0.5 text-xs text-eagle-text">
              {f}
              <button onClick={() => setTagFilters((prev) => prev.filter((t) => t !== f))} className="opacity-60 hover:opacity-100 leading-none">×</button>
            </span>
          ))}
          {tagFilters.length > 0 && (
            <button onClick={() => setTagFilters([])} className="text-xs text-eagle-text-muted hover:text-eagle-text transition-colors" title="Clear all filters">Clear</button>
          )}
        </div>

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
          Tag All {filter === "untagged" ? "Untagged" : ""}
        </button>

        {batchProgress && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-32 h-1.5 bg-eagle-btn-bg rounded-full overflow-hidden">
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

      {/* Grid */}
      {allItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-eagle-text-muted italic text-sm">
          No items in library
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-eagle-text-muted italic text-sm">
          All images are tagged
        </div>
      ) : (
        <GalleryCtx.Provider value={ctxValue}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar [scrollbar-gutter:stable]">
            <DivMasonry items={filteredItems} containerRef={scrollRef} />
          </div>
        </GalleryCtx.Provider>
      )}

      {showTagPicker && (
        <TagPicker
          onSelect={(tag) => { addTagFilter(tag); setShowTagPicker(false); }}
          excludeTags={tagFilters}
          onClose={() => setShowTagPicker(false)}
          style={tagPickerStyle}
        />
      )}
    </div>
  );
};

export default Gallery;
