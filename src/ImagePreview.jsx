import { useTaggerStore } from "../store/taggerStore";

const ImagePreview = () => {
  const selectedItem = useTaggerStore((state) => state.selectedItem);

  return (
    <div className="flex flex-col p-2 overflow-hidden flex-[5] ">
      <div className="mb-4">
        <h2 className="text-3xl font-bold mb-2 text-eagle-text">Auto Tag</h2>
        <p className="text-eagle-text-secondary">
          Preview & edit generated tags
        </p>
      </div>

      <div className="flex-1 bg-eagle-preview rounded-xl border border-eagle-border flex items-center justify-center p-2 relative overflow-hidden shadow-inner">
        {selectedItem ? (
          <img
            src={selectedItem.filePath}
            className="max-h-full max-w-full rounded-lg shadow-2xl z-10 object-contain transition-transform duration-300"
            alt="Preview"
          />
        ) : (
          <div className="text-eagle-text-muted italic flex flex-col items-center gap-2">
            <span>No image selected</span>
          </div>
        )}

        {/* Dynamic theme glow */}
        <div 
          className="absolute inset-0 opacity-[0.08] blur-[120px] bg-eagle-accent pointer-events-none" 
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default ImagePreview;