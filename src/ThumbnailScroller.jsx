import { useTaggerStore } from "../store/taggerStore";

const ThumbnailScroller = () => {
  const { items, selectedItem, selectItem } = useTaggerStore();

  return (
<div className="w-24 bg-eagle-panel border-r border-eagle-border overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar [scrollbar-gutter:stable]">
      {items.map((item) => {
        const isActive = selectedItem?.id === item.id;
        return (
          <img
            key={item.id}
            src={item.thumbnailPath}
            onClick={() => selectItem(item)}
            className={`w-full aspect-square object-cover rounded-lg shadow-md cursor-pointer select-none transition-all duration-200 border-2 ${
              isActive
                ? "border-eagle-accent opacity-100"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
            title={item.name}
          />
        );
      })}
    </div>
  );
};

export default ThumbnailScroller;
