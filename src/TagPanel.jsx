import { useState, useRef } from "react";
import { useTaggerStore } from "../store/taggerStore";
import { useSettingsStore } from "../store/settingsStore";
import TagPicker from "./TagPicker";

const TagPanel = () => {
  const {
    autoTags,
    clipTags,
    isGenerating,
    inferenceError,
    generateItem,
    selectedItem,
    removeAutoTag,
    removeItemTag,
    addAutoTag,
    saveTags,
    clearItemTags,
    tagVersion, // eslint-disable-line no-unused-vars — consumed only to force re-render on tag changes
  } = useTaggerStore();

  const generateOnSelect = useSettingsStore((s) => s.generateOnSelect);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerStyle, setPickerStyle] = useState({});
  const [saveState, setSaveState] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const triggerRef = useRef(null);

  const openPicker = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPickerStyle({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setShowPicker(true);
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await saveTags();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const saveLabel = { idle: "Save Tags", saving: "Saving…", saved: "Saved!", error: "Failed" }[saveState];
  const saveCls = saveState === "saved"
    ? "bg-green-600 hover:bg-green-600 text-white"
    : saveState === "error"
    ? "bg-red-600 hover:bg-red-600 text-white"
    : "bg-eagle-primary hover:bg-eagle-primary-hover text-white";

  const currentTags = selectedItem?.tags ?? [];

  return (
    <div className="bg-eagle-elevated border-l border-eagle-border flex flex-col shadow-2xl flex-[3] overflow-hidden">

      {/* Current Tags — fixed header + scrollable tag list */}
      <div className="flex flex-col border-b border-eagle-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-xl font-bold text-eagle-text">Current Tags</h2>
          {currentTags.length > 0 && (
            <span className="text-xs text-eagle-text-muted tabular-nums">{currentTags.length}</span>
          )}
        </div>
        {currentTags.length > 0 ? (
          <div className="px-4 pb-3 overflow-y-auto max-h-40 custom-scrollbar [scrollbar-gutter:stable] flex flex-wrap gap-2 content-start">
            {currentTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-eagle-btn-bg text-eagle-text px-2 py-1 rounded-lg text-sm border border-eagle-border"
              >
                {tag}
                <button
                  onClick={() => removeItemTag(tag)}
                  className="opacity-40 hover:opacity-100 hover:text-eagle-accent leading-none transition-opacity"
                  title="Remove tag"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="px-4 pb-3 text-sm text-eagle-text-muted italic">No saved tags</p>
        )}
      </div>

      {/* Generated Tags + Library Matches — takes remaining space, scrollable */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar [scrollbar-gutter:stable]">
        {inferenceError && !isGenerating && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">
            {inferenceError}
          </div>
        )}

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-4 text-eagle-text-secondary flex-1">
            <div className="w-8 h-8 border-4 border-eagle-border border-t-eagle-accent rounded-full animate-spin" />
            <span>Generating Tags…</span>
          </div>
        ) : (
          <>
            {clipTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-eagle-text">Library Matches</h2>
                <div className="flex flex-wrap gap-2">
                  {clipTags.map((tag) => {
                    const tagLower = tag.toLowerCase();
                    if (currentTags.some((t) => t.toLowerCase() === tagLower) || autoTags.some((t) => t.toLowerCase() === tagLower)) return null;
                    return (
                      <button
                        key={tag}
                        onClick={() => addAutoTag(tag)}
                        className="bg-eagle-btn-bg hover:bg-eagle-btn-hover text-eagle-text px-2 py-1 rounded-lg text-sm transition-all border border-eagle-accent/50"
                        title="Add to generated tags"
                      >
                        + {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-eagle-text">Generated Tags</h2>
                <button
                  ref={triggerRef}
                  onClick={openPicker}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border text-eagle-text-secondary hover:text-eagle-text transition-colors text-sm leading-none"
                  title="Add tag from library"
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoTags.map((tag) => {
                  const alreadySaved = currentTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      className={`px-2 py-1 rounded-lg text-sm transition-all border ${
                        alreadySaved
                          ? "bg-eagle-btn-bg border-eagle-border text-eagle-text-muted opacity-60"
                          : "bg-eagle-btn-bg hover:bg-eagle-btn-hover text-eagle-text border-eagle-border"
                      }`}
                      title={alreadySaved ? "Already saved" : undefined}
                    >
                      {tag}{" "}
                      {!alreadySaved && (
                        <span onClick={() => removeAutoTag(tag)} className="opacity-50 hover:text-eagle-accent">
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 bg-eagle-panel border-t border-eagle-border flex flex-col gap-3">
        <div className="flex gap-2">
          <button
            onClick={generateItem}
            className="flex-1 bg-eagle-btn-bg py-3 rounded-lg text-sm font-medium hover:bg-eagle-btn-hover"
          >
            {generateOnSelect ? "Regenerate" : "Generate"}
          </button>
          <button
            onClick={() => { if (confirm("Clear all tags from this item?")) clearItemTags(); }}
            disabled={currentTags.length === 0}
            className="flex-1 bg-eagle-btn-bg py-3 rounded-lg text-sm font-medium hover:bg-red-900/40 hover:text-red-400 border border-transparent hover:border-red-700/50 transition-colors disabled:opacity-40"
          >
            Clear Tags
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saveState === "saving" || autoTags.length === 0}
          className={`py-4 rounded-lg font-bold transition-colors disabled:opacity-50 ${saveCls}`}
        >
          {saveLabel}
        </button>
      </div>

      {showPicker && (
        <TagPicker
          onSelect={addAutoTag}
          onClose={() => setShowPicker(false)}
          excludeTags={[...autoTags, ...currentTags]}
          style={pickerStyle}
        />
      )}
    </div>
  );
};

export default TagPanel;
