const { parentPort } = require("worker_threads");
const { runTagger } = require("./inference");

parentPort.on("message", async ({ id, imagePath }) => {
  try {
    const tags = await runTagger(imagePath);
    parentPort.postMessage({ id, tags });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});