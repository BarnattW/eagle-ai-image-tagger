import { useState, useRef } from "react";
import { useSettingsStore } from "../store/settingsStore";
import TagPicker from "./TagPicker";

const DEFAULT_PROMPT =
  `IMPORTANT: Output ONLY valid JSON. NO explanations, NO markdown, NO extra text.` +
  `Analyze this image and generate 15-25 accurate Danbooru-style tags.\n` +
  `Cover all of the following categories that apply:\n` +
  `- Subject: 1girl, 1boy, multiple girls, no humans, animal, etc.\n` +
  `- Art style: anime, manga, realistic, painterly, sketch, chibi, pixel art, etc.\n` +
  `- Character: hair color/length/style, eye color, skin tone, facial expression\n` +
  `- Clothing & accessories: specific garment names, colors, patterns\n` +
  `- Pose & body: standing, sitting, lying, arms up, from behind, close-up, full body, etc.\n` +
  `- Action: looking at viewer, holding, eating, fighting, etc.\n` +
  `- Lighting: soft lighting, backlight, rim light, dramatic shadow, dark, bright, etc.\n` +
  `- Colors: dominant colors, monochrome, colorful, pastel, warm tones, etc.\n` +
  `- Background: simple background, outdoors, indoors, specific location\n` +
  `- Composition: portrait, dutch angle, wide shot, from above, from below\n` +
  `- Mood: happy, sad, serious, romantic, action, peaceful\n` +
  `Be specific and accurate. Only tag what is clearly visible. Do not guess.`;

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
    llmProvider, llmApiKey, llmModel, llmEndpoint, llmPrompt, llmIncludeLibraryTags,
    promptPresets, autoSave, tagBlacklist,
    update,
  } = useSettingsStore();

  const [blacklistInput, setBlacklistInput] = useState("");
  const [showBlacklistPicker, setShowBlacklistPicker] = useState(false);
  const blacklistPickerBtnRef = useRef(null);
  const [blacklistPickerStyle, setBlacklistPickerStyle] = useState({});
  const [newPresetName, setNewPresetName] = useState("");
  const [addingPreset, setAddingPreset] = useState(false);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState("__default__");

  const addToBlacklist = () => {
    const tag = blacklistInput.trim().toLowerCase();
    if (!tag || tagBlacklist.includes(tag)) return;
    update({ tagBlacklist: [...tagBlacklist, tag] });
    setBlacklistInput("");
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const prompt = llmPrompt.trim() || DEFAULT_PROMPT;
    update({ promptPresets: [...promptPresets, { name: newPresetName.trim(), prompt }] });
    setNewPresetName("");
    setAddingPreset(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar [scrollbar-gutter:stable]">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-eagle-text">Plugin Settings</h2>
        <p className="text-eagle-text-secondary mt-1">Configure inference mode and parameters</p>
      </div>

      {/* General */}
      <Section title="General">
        <Field label="Auto-save tags" hint="Automatically save generated tags to Eagle without clicking Save.">
          <Toggle checked={autoSave} onChange={(v) => update({ autoSave: v })} label="Enabled" />
        </Field>
        <Field label="Tag blacklist" hint="Tags in this list are never added, regardless of inference mode.">
          <div className="flex gap-2">
            <input
              type="text"
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addToBlacklist()}
              placeholder="e.g. simple background"
              className="flex-1 bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text placeholder:text-eagle-text-muted focus:outline-none focus:border-eagle-accent transition-colors"
            />
            <button
              onClick={addToBlacklist}
              className="px-3 py-2 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-sm text-eagle-text transition-colors"
            >
              Add
            </button>
            <button
              ref={blacklistPickerBtnRef}
              onClick={() => {
                const rect = blacklistPickerBtnRef.current?.getBoundingClientRect();
                if (rect) setBlacklistPickerStyle({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                setShowBlacklistPicker((v) => !v);
              }}
              title="Pick from library"
              className="px-3 py-2 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-sm text-eagle-text-secondary hover:text-eagle-text transition-colors leading-none"
            >
              ⌖
            </button>
          </div>
          {showBlacklistPicker && (
            <TagPicker
              onSelect={(tag) => {
                const t = tag.toLowerCase();
                if (!tagBlacklist.includes(t)) update({ tagBlacklist: [...tagBlacklist, t] });
                setShowBlacklistPicker(false);
              }}
              onClose={() => setShowBlacklistPicker(false)}
              excludeTags={tagBlacklist}
              style={blacklistPickerStyle}
            />
          )}
          {tagBlacklist.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tagBlacklist.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-eagle-btn-bg border border-eagle-border rounded px-2 py-0.5 text-xs text-eagle-text">
                  {tag}
                  <button
                    onClick={() => update({ tagBlacklist: tagBlacklist.filter((t) => t !== tag) })}
                    className="opacity-50 hover:opacity-100 hover:text-red-400 transition-opacity leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </Section>

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

        <Field label="Prompt" hint="The instruction sent to the LLM with the image.">
          <div className="flex items-center gap-2">
            <select
              value={selectedPresetIdx}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPresetIdx(val);
                if (val === "__default__") {
                  update({ llmPrompt: DEFAULT_PROMPT });
                } else {
                  const idx = parseInt(val);
                  if (!isNaN(idx)) update({ llmPrompt: promptPresets[idx].prompt });
                }
              }}
              className="flex-1 bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text focus:outline-none focus:border-eagle-accent transition-colors"
            >
              <option value="__default__">Default</option>
              {promptPresets.map((p, i) => (
                <option key={i} value={String(i)}>{p.name}</option>
              ))}
            </select>

            {!addingPreset ? (
              <button
                onClick={() => setAddingPreset(true)}
                className="px-3 py-2 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-sm text-eagle-text transition-colors shrink-0"
              >
                Save as preset…
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") savePreset(); if (e.key === "Escape") setAddingPreset(false); }}
                  placeholder="Preset name"
                  className="bg-eagle-btn-bg border border-eagle-accent rounded-lg px-3 py-2 text-sm text-eagle-text focus:outline-none"
                />
                <button onClick={savePreset} className="px-3 py-2 bg-eagle-primary hover:bg-eagle-primary-hover text-white rounded-lg text-sm transition-colors">Save</button>
                <button onClick={() => setAddingPreset(false)} className="px-3 py-2 bg-eagle-btn-bg hover:bg-eagle-btn-hover border border-eagle-border rounded-lg text-sm text-eagle-text transition-colors">Cancel</button>
              </div>
            )}

            {selectedPresetIdx !== "__default__" && !addingPreset && (
              <button
                onClick={() => {
                  const idx = parseInt(selectedPresetIdx);
                  update({ promptPresets: promptPresets.filter((_, j) => j !== idx) });
                  setSelectedPresetIdx("__default__");
                  update({ llmPrompt: DEFAULT_PROMPT });
                }}
                className="px-3 py-2 bg-eagle-btn-bg hover:bg-red-900/40 border border-eagle-border hover:border-red-700/50 rounded-lg text-sm text-eagle-text-muted hover:text-red-400 transition-colors shrink-0"
                title="Delete this preset"
              >
                Delete
              </button>
            )}
          </div>

          <textarea
            value={llmPrompt || DEFAULT_PROMPT}
            onChange={(e) => update({ llmPrompt: e.target.value })}
            rows={6}
            className="bg-eagle-btn-bg border border-eagle-border rounded-lg px-3 py-2 text-sm text-eagle-text focus:outline-none focus:border-eagle-accent transition-colors resize-y font-mono"
          />
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
    </div>
  );
};

export default Settings;
