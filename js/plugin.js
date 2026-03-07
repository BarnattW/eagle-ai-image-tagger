const path = require("path");

function applyTheme(theme) {
  const t = (theme || "").toUpperCase();
  if (!t || t === "DARK") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
}

eagle.onPluginCreate(async () => {
  const theme = await eagle.app.theme;
  applyTheme(theme);
});

eagle.onThemeChanged((theme) => applyTheme(theme));

eagle.onPluginRun(async () => {
  const items = await eagle.item.getSelected();
  if (window.__autoTagger?.setSelectedItems) {
    window.__autoTagger.setSelectedItems(items);
  } else {
    console.warn("React bridge not ready yet");
  }
});
