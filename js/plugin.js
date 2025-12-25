const path = require("path");

eagle.onPluginCreate(async (plugin) => {
  console.log("eagle.onPluginCreate");
  console.log(plugin);
});

eagle.onPluginRun(async () => {
  console.log("eagle.onPluginRun");

  const theme = await eagle.app.theme;
  if (theme) document.documentElement.setAttribute("data-theme", theme.toUpperCase());
  const items = await eagle.item.getSelected();

  // Call into React
  if (window.__autoTagger?.setSelectedItems) {
    window.__autoTagger.setSelectedItems(items);
  } else {
    console.warn("React bridge not ready yet");
  }
});
