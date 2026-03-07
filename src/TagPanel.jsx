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
    clipWarning,
    selectItem,
    selectedItem,
    removeAutoTag,
    addAutoTag,
    saveTags,
  } = useTaggerStore();
  const { inferenceMode } = useSettingsStore();

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

  return (
    <div className="bg-eagle-elevated border-l border-eagle-border flex flex-col shadow-2xl flex-[3]">
      <div className="flex-1 p-4 overflow-y-auto flex flex-wrap gap-2 pt-6 content-start custom-scrollbar [scrollbar-gutter:stable]">
        <h2 className="w-full text-xl font-bold">Current Tags</h2>
        {selectedItem?.tags.map((tag) => (
          <span
            key={tag}
            className="bg-eagle-btn-bg text-eagle-text px-2 py-1 rounded-lg text-sm border border-eagle-border"
          >
            {tag}
          </span>
        ))}

        {inferenceError && !isGenerating && (
          <div className="w-full bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">
            {inferenceError}
          </div>
        )}
        {clipWarning && !isGenerating && (
          <div className="w-full bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2 text-sm text-yellow-300">
            Library suggestions: {clipWarning}
          </div>
        )}

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-4 text-eagle-text-secondary w-full mt-4">
            <div className="w-8 h-8 border-4 border-eagle-border border-t-eagle-accent rounded-full animate-spin" />
            <span>Generating Tags…</span>
          </div>
        ) : (
          <>
            {clipTags.length > 0 && (
              <>
                <h2 className="w-full text-xl font-bold">
                  {inferenceMode === "llm" ? "Library Matches" : "Library Suggestions"}
                </h2>
                {clipTags.map((tag) => {
                  const alreadySaved = selectedItem?.tags?.includes(tag);
                  const inGenerated = autoTags.includes(tag);
                  if (alreadySaved || inGenerated) return null;
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
              </>
            )}

            <div className="w-full flex items-center justify-between">
              <h2 className="text-xl font-bold">Generated Tags</h2>
              <button
                ref={triggerRef}
                onClick={openPicker}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border text-eagle-text-secondary hover:text-eagle-text transition-colors text-sm leading-none"
                title="Add tag from library"
              >
                +
              </button>
            </div>
            {autoTags.map((tag) => {
              const alreadySaved = selectedItem?.tags?.includes(tag);
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
                    <span
                      onClick={() => removeAutoTag(tag)}
                      className="opacity-50 hover:text-eagle-accent"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="p-4 bg-eagle-panel border-t border-eagle-border flex flex-col gap-3">
        <button
          onClick={() => selectItem(selectedItem)}
          className="bg-eagle-btn-bg py-3 rounded-lg text-sm font-medium hover:bg-eagle-btn-hover"
        >
          Regenerate Tags
        </button>
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
          excludeTags={[...autoTags, ...(selectedItem?.tags ?? [])]}
          style={pickerStyle}
        />
      )}
    </div>
  );
};

export default TagPanel;
