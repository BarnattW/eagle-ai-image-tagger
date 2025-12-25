import { useTaggerStore } from "../store/taggerStore";

const TagPanel = () => {
  const {
    autoTags,
    isGenerating,
    selectItem,
    selectedItem,
    removeAutoTag,
    saveTags,
  } = useTaggerStore();

  const toggleTagMenu = () => {
    return;
  };

  console.log(selectedItem);

  return (
    <div className="bg-eagle-elevated border-l border-eagle-border flex flex-col shadow-2xl flex-[3] ">
      <div className="flex-1 p-4 overflow-y-auto flex flex-wrap gap-2 pt-6 content-start custom-scrollbar [scrollbar-gutter:stable]">
        <h2 className="text-xl font-bold">Current Tags</h2>
        {selectedItem?.tags.map((tag) => (
          <button
            key={tag}
            onClick={toggleTagMenu()}
            className="bg-eagle-btn-bg hover:bg-eagle-btn-hover text-eagle-text px-2 py-1 rounded-lg text-sm transition-all border border-eagle-border"
          >
            {tag} <span className="opacity-50 hover:text-eagle-accent">×</span>
          </button>
        ))}

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-4 text-eagle-text-secondary">
            <div className="border-4 border-eagle-border border-t-eagle-accent rounded-full animate-spin" />
            <span>Generating Tags...</span>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold">Generated Tags</h2>
            {autoTags.map((tag) => (
              <button
                key={tag}
                onClick={toggleTagMenu()}
                className="bg-eagle-btn-bg hover:bg-eagle-btn-hover text-eagle-text px-2 py-1 rounded-lg text-sm transition-all border border-eagle-border"
              >
                {tag}{" "}
                <span
                  onClick={() => removeAutoTag(tag)}
                  className="opacity-50 hover:text-eagle-accent"
                >
                  x
                </span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="p-4 bg-eagle-panel border-t border-eagle-border flex flex-col gap-3">
        <button
          onClick={() => selectItem(selectedItem)}
          className="bg-eagle-btn-bg py-3 rounded-lg text-sm font-medium hover:bg-eagle-btn-hover "
        >
          Regenerate Tags
        </button>
        <button
          onClick={() => saveTags(selectedItem)}
          className="bg-eagle-primary hover:bg-eagle-primary-hover text-white py-4 rounded-lg font-bold"
        >
          Save tags
        </button>
      </div>
    </div>
  );
};

export default TagPanel;
