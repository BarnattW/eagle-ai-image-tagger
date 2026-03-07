import { useSettingsStore } from "../store/settingsStore";

const DEFAULT_PROMPT =
  `Look at this image and generate 10-20 descriptive tags.\n` +
  `Cover: art style, subject, characters, clothing, colors, mood, and composition.\n` +
  `Use concise Danbooru-style tags where applicable (e.g. "1girl", "blue hair", "smile").`;

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-xs font-semibold uppercase tracking-widest text-eagle-text-secondary mb-3 pb-2 border-b border-eagle-border">
      {title}
    </h3>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-eagle-text">{label}</label>
    {children}
    {hint && <p className="text-xs text-eagle-text-muted">{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = "text" }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors font-mono"
  />
);

const PathInput = ({ value, onChange, placeholder, mode = "file", filters }) => {
  const browse = async () => {
    const props = mode === "folder" ? ["openDirectory"] : ["openFile"];
    const result = await eagle.dialog.showOpenDialog({ properties: props, filters });
    if (!result.canceled && result.filePaths.length > 0) onChange(result.filePaths[0]);
  };
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors font-mono"
      />
      <button
        onClick={browse}
        title={mode === "folder" ? "Pick folder" : "Pick file"}
        className="px-3 py-2 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-eagle-text-secondary hover:text-eagle-text transition-colors text-base leading-none"
      >
        📁
      </button>
    </div>
  );
};

const Slider = ({ value, onChange, min, max, step }) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="flex-1 accent-slider"
    />
    <span className="text-sm font-mono text-eagle-text w-10 text-right">{value.toFixed(2)}</span>
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer w-fit select-none">
    <div className="relative">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <div className={`w-10 h-6 rounded-full border transition-colors ${checked ? "bg-eagle-primary border-eagle-primary" : "bg-eagle-btn-bg border-eagle-border"}`} />
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </div>
    <span className="text-sm text-eagle-text">{label}</span>
  </label>
);

const Settings = () => {
  const {
    inferenceMode,
    modelPath, tagsPath, thresholdGeneral, thresholdCharacter, topN,
    clipEnabled, clipModelDir, clipThreshold, clipTopN,
    llmProvider, llmApiKey, llmModel, llmEndpoint, llmPrompt, llmIncludeLibraryTags,
    update,
  } = useSettingsStore();

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar [scrollbar-gutter:stable]">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-eagle-text">Plugin Settings</h2>
        <p className="text-eagle-text-secondary mt-1">Configure inference mode and parameters</p>
      </div>

      {/* Mode toggle */}
      <Section title="Inference Mode">
        <div className="flex gap-2 p-1 bg-eagle-btn-bg rounded-lg w-fit border border-eagle-border">
          {["local", "llm"].map((mode) => (
            <button
              key={mode}
              onClick={() => update({ inferenceMode: mode })}
              className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inferenceMode === mode
                  ? "bg-eagle-primary text-white"
                  : "text-eagle-text-secondary hover:text-eagle-text"
              }`}
            >
              {mode === "local" ? "Local (WD14)" : "LLM"}
            </button>
          ))}
        </div>
        <p className="text-xs text-eagle-text-muted">
          {inferenceMode === "local"
            ? "Runs WD14 locally — fast, offline, Danbooru-style tags. Optionally use CLIP to match your library."
            : "Sends images to an LLM API — flexible tags and library matching in one call. Requires an API key."}
        </p>
      </Section>

      {inferenceMode === "local" && (
        <>
          <Section title="Model Files">
            <Field label="Model file (.onnx)" hint="Absolute path to your WD tagger ONNX model file.">
              <PathInput value={modelPath} onChange={(v) => update({ modelPath: v })} placeholder="/path/to/model.onnx" filters={[{ name: "ONNX Model", extensions: ["onnx"] }]} />
            </Field>
            <Field label="Tags file (.csv)" hint="Absolute path to the selected_tags.csv that matches your model.">
              <PathInput value={tagsPath} onChange={(v) => update({ tagsPath: v })} placeholder="/path/to/selected_tags.csv" filters={[{ name: "CSV", extensions: ["csv"] }]} />
            </Field>
            <div className="bg-eagle-panel border border-eagle-border rounded-lg p-3 text-xs text-eagle-text-secondary leading-relaxed">
              Download the WD SwinV2 Tagger v3 model from HuggingFace:
              <br />
              <span className="font-mono text-eagle-accent break-all select-all">
                https://huggingface.co/SmilingWolf/wd-swinv2-tagger-v3
              </span>
              <br />
              Download <span className="font-mono">model.onnx</span> and{" "}
              <span className="font-mono">selected_tags.csv</span>, then set the paths above.
              If left empty, the plugin looks for both files in its own{" "}
              <span className="font-mono">inference/</span> folder.
            </div>
          </Section>

          <Section title="Inference">
            <Field label="General tag threshold" hint="Tags with confidence below this are excluded. Lower = more tags.">
              <Slider value={thresholdGeneral} onChange={(v) => update({ thresholdGeneral: v })} min={0.1} max={1.0} step={0.05} />
            </Field>
            <Field label="Character tag threshold" hint="Higher threshold keeps character tags stricter.">
              <Slider value={thresholdCharacter} onChange={(v) => update({ thresholdCharacter: v })} min={0.1} max={1.0} step={0.05} />
            </Field>
            <Field label="Max general tags" hint="Maximum number of general tags returned per image (1–50).">
              <input
                type="number"
                min={1} max={50} value={topN}
                onChange={(e) => update({ topN: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                className="bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text w-24 focus:outline-none focus:border-eagle-accent transition-colors"
              />
            </Field>
          </Section>

          <Section title="Library Suggestions (CLIP)">
            <Field
              label="Enable CLIP suggestions"
              hint="Semantically matches your Eagle library tags against the image using CLIP. Requires model files below."
            >
              <Toggle checked={clipEnabled} onChange={(v) => update({ clipEnabled: v })} label="Enabled" />
            </Field>

            {clipEnabled && (
              <>
                <Field
                  label="CLIP model directory"
                  hint="Folder containing vision_model.onnx (or quantized), text_model.onnx, and tokenizer.json from Xenova/clip-vit-base-patch32 on HuggingFace."
                >
                  <PathInput value={clipModelDir} onChange={(v) => update({ clipModelDir: v })} placeholder="/path/to/clip-model-dir" mode="folder" />
                </Field>
                <div className="bg-eagle-panel border border-eagle-border rounded-lg p-3 text-xs text-eagle-text-secondary leading-relaxed">
                  Download from HuggingFace:
                  <br />
                  <span className="font-mono text-eagle-accent break-all select-all">
                    https://huggingface.co/Xenova/clip-vit-base-patch32
                  </span>
                  <br />
                  From the <span className="font-mono">onnx/</span> folder, download{" "}
                  <span className="font-mono">vision_model_quantized.onnx</span> and{" "}
                  <span className="font-mono">text_model_quantized.onnx</span> (~75 MB each).
                  Also download <span className="font-mono">tokenizer.json</span> from the repo root.
                  Place all three in one folder and set the path above.
                  Falls back to string matching if the directory is empty.
                </div>
                <Field label="Similarity threshold" hint="Minimum CLIP score to surface a tag. Lower = more suggestions.">
                  <Slider value={clipThreshold} onChange={(v) => update({ clipThreshold: v })} min={0.05} max={0.5} step={0.05} />
                </Field>
                <Field label="Max suggestions" hint="Maximum library tags to suggest per image (1–30).">
                  <input
                    type="number"
                    min={1} max={30} value={clipTopN}
                    onChange={(e) => update({ clipTopN: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)) })}
                    className="bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text w-24 focus:outline-none focus:border-eagle-accent transition-colors"
                  />
                </Field>
              </>
            )}
          </Section>
        </>
      )}

      {inferenceMode === "llm" && (
        <Section title="LLM Settings">
          <Field label="Provider">
            <div className="flex gap-2 p-1 bg-eagle-btn-bg rounded-lg w-fit border border-eagle-border">
              {[["openai", "OpenAI"], ["anthropic", "Anthropic"], ["local", "Local"]].map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => update({ llmProvider: p })}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    llmProvider === p
                      ? "bg-eagle-primary text-white"
                      : "text-eagle-text-secondary hover:text-eagle-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {llmProvider === "local" ? (
            <Field
              label="Endpoint"
              hint="Base URL of your local model server. LM Studio and Ollama both expose an OpenAI-compatible API."
            >
              <TextInput
                value={llmEndpoint}
                onChange={(v) => update({ llmEndpoint: v })}
                placeholder="http://localhost:1234/v1"
              />
            </Field>
          ) : (
            <Field
              label="API key"
              hint={
                llmProvider === "openai"
                  ? "Your OpenAI API key (sk-…). Stored locally in plugin settings."
                  : "Your Anthropic API key (sk-ant-…). Stored locally in plugin settings."
              }
            >
              <TextInput
                type="password"
                value={llmApiKey}
                onChange={(v) => update({ llmApiKey: v })}
                placeholder={llmProvider === "openai" ? "sk-..." : "sk-ant-..."}
              />
            </Field>
          )}

          <Field
            label="Model"
            hint={
              llmProvider === "local"
                ? "Model name as shown in LM Studio / Ollama (e.g. llava, qwen2-vl). Must support vision."
                : llmProvider === "openai"
                ? "Leave blank to use gpt-4o-mini. Other options: gpt-4o"
                : "Leave blank to use claude-haiku-4-5-20251001. Other options: claude-sonnet-4-6"
            }
          >
            <TextInput
              value={llmModel}
              onChange={(v) => update({ llmModel: v })}
              placeholder={
                llmProvider === "local"
                  ? "llava"
                  : llmProvider === "openai"
                  ? "gpt-4o-mini"
                  : "claude-haiku-4-5-20251001"
              }
            />
          </Field>

          <Field label="Prompt" hint="The instruction sent to the LLM. Leave blank to use the default.">
            <textarea
              value={llmPrompt}
              onChange={(e) => update({ llmPrompt: e.target.value })}
              placeholder={DEFAULT_PROMPT}
              rows={5}
              className="bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors resize-y font-mono"
            />
            {llmPrompt && (
              <button
                onClick={() => update({ llmPrompt: "" })}
                className="text-xs text-eagle-text-muted hover:text-eagle-text w-fit"
              >
                Reset to default
              </button>
            )}
          </Field>

          <Field
            label="Include library tags"
            hint="Sends your Eagle tag library to the LLM so it can match existing tags alongside generating new ones."
          >
            <Toggle
              checked={llmIncludeLibraryTags}
              onChange={(v) => update({ llmIncludeLibraryTags: v })}
              label="Enabled"
            />
          </Field>
        </Section>
      )}
    </div>
  );
};

export default Settings;
