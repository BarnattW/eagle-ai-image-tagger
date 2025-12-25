import { useEffect, useState } from "react";
import { useTaggerStore } from "../store/taggerStore";
import ThumbnailScroller from "./ThumbnailScroller";
import ImagePreview from "./ImagePreview";
import TagPanel from "./TagPanel";
import Sidebar from "./Sidebar"


export default function App() {
  const [activeSection, setActiveSection] = useState("auto");
  const { setItems, setUserTags } = useTaggerStore();

  useEffect(() => {
    // Eagle initialization
    window.__autoTagger = { setSelectedItems: setItems };
    // eagle.tag.get().then(res => setUserTags(res?.map(t => t.name) || []));
    
    return () => delete window.__autoTagger;
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-eagle-main text-eagle-text font-sans">
      <Sidebar activeSection={activeSection} onTabChange={setActiveSection} />
      <ThumbnailScroller />
      
      <main className="flex-1 flex flex-col bg-eagle-main">
        {activeSection === "auto" && (
          <div className="flex flex-1 overflow-hidden">
             <ImagePreview />
             <TagPanel />
          </div>
        )}
      </main>
    </div>
  );
}