import { useEffect, useState, Component } from "react";
import { useTaggerStore } from "../store/taggerStore";
import { useSettingsStore } from "../store/settingsStore";
import ThumbnailScroller from "./ThumbnailScroller";
import ImagePreview from "./ImagePreview";
import TagPanel from "./TagPanel";
import Sidebar from "./Sidebar";
import Settings from "./Settings";
import Gallery from "./Gallery";

function syncSettingsToBridge(state) {
  const modelByProvider = {
    openai: state.llmModelOpenAI,
    anthropic: state.llmModelAnthropic,
    local: state.llmModelLocal,
  };
  window.__autoTaggerInference?.configure?.({
    llmProvider: state.llmProvider,
    llmApiKey: state.llmApiKey,
    llmModel: modelByProvider[state.llmProvider] || "",
    llmEndpoint: state.llmEndpoint,
    llmPrompt: state.llmPrompt,
    llmIncludeLibraryTags: state.llmIncludeLibraryTags,
    llmLibraryPrompt: state.llmLibraryPrompt,
  });
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-eagle-text font-semibold">Something crashed</p>
          <pre className="text-xs text-eagle-text-muted bg-eagle-btn-bg border border-eagle-border rounded-lg p-3 max-w-lg overflow-auto text-left whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 text-sm bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text transition-colors"
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState("auto");
  const { setItems, loadUserTags } = useTaggerStore();

  useEffect(() => {
    if (activeSection !== "auto") return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const { items, selectedItem, selectItem } = useTaggerStore.getState();
      const idx = items.findIndex((x) => x.id === selectedItem?.id);
      const next = e.key === "ArrowRight" ? idx + 1 : idx - 1;
      if (next >= 0 && next < items.length) selectItem(items[next]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSection]);

  useEffect(() => {
    window.__autoTagger = { setSelectedItems: setItems };

    const init = () => loadUserTags();
    if (window.__eagleReady) {
      init();
    } else {
      window.addEventListener("eagle-ready", init, { once: true });
    }

    syncSettingsToBridge(useSettingsStore.getState());
    const unsub = useSettingsStore.subscribe(syncSettingsToBridge);
    return () => {
      delete window.__autoTagger;
      unsub();
      window.removeEventListener("eagle-ready", init);
    };
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-eagle-main text-eagle-text font-sans">
      <Sidebar activeSection={activeSection} onTabChange={setActiveSection} />
      {activeSection === "auto" && <ThumbnailScroller />}

      <main className="flex-1 flex flex-col bg-eagle-main overflow-hidden">
        <ErrorBoundary>
          {activeSection === "auto" && (
            <div className="flex flex-1 overflow-hidden">
              <ImagePreview />
              <TagPanel />
            </div>
          )}
          {activeSection === "gallery" && <Gallery />}
          {activeSection === "settings" && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
