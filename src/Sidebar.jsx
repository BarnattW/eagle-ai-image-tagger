const tabs = [
  { name: "Auto Tag", id: "auto" },
  { name: "Gallery", id: "gallery" },
  { name: "Plugin Settings", id: "settings" },
];

const Sidebar = ({ activeSection, onTabChange }) => (
  <nav className="bg-eagle-elevated border-r border-eagle-border flex-col py-4 hidden md:flex">
    <h1 className="px-4 text-xl font-bold text-eagle-accent mb-4">
      AI Image Tagger
    </h1>
    <ul className="flex-1 space-y-1">
      {tabs.map(({ name, id }) => (
        <li
          key={id}
          onClick={() => onTabChange(id)}
          className={`px-4 py-2 cursor-pointer transition-colors border-l-4 select-none ${
            activeSection === id
              ? "bg-eagle-btn-bg text-eagle-text border-eagle-accent"
              : "text-eagle-text-secondary border-transparent hover:bg-eagle-btn-hover"
          }`}
        >
          {name}
        </li>
      ))}
    </ul>
  </nav>
);

export default Sidebar;
