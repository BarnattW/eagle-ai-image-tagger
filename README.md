# AI Image Tagger
![GitHub release](https://img.shields.io/github/v/release/BarnattW/eagle-ai-image-tagger)

An [Eagle](https://eagle.cool) plugin that automatically tags images using AI. Supports cloud and local LLMs with intelligent library tag matching.

![Gallery view](screenshots/gallery.png)

## Motivations
Eagle.cool is a tool I have used extensively since learning about it for storing reference and other media. The Eagle team have made it very easy to save media in their application, especially with their browser plugin. However, tagging images is not as simple, especially for a new library without tags or extensive libraries with a lot of tags. The purpose of this plugin is to make the process easier by having AI generate tags that fit the user's needs.

## Features

- **LLM tagging** — detailed Danbooru-style tags via OpenAI, Anthropic, or any local OpenAI-compatible server (LM Studio, Ollama, etc.)
- **Library tag matching** — two-pass pipeline: the LLM first generates tags freely from the image, then a second text-only call matches those tags against your Eagle library, surfacing up to 5 relevant tags you've already used
- **Gallery view** — browse all library images with include/exclude tag filters, status/sort filters, pinnable controls, and batch tagging with progress
- **Tag blacklist** — globally exclude tags from all inference results
- **Prompt presets** — save and switch between custom LLM prompts
- **Auto-save** — automatically save generated tags without manual confirmation
- **Tag deduplication** — never re-adds tags already saved to an item
- **Custom tags** — type any tag name in the picker to add it directly, even if it's not in your library

## Screenshots

| Single image view | Settings |
|---|---|
| ![Tag panel](screenshots/tag-panel.png) | ![Settings](screenshots/settings.png) |

## Installation & running

### From source

```bash
# 1. Clone the repo
git clone https://github.com/BarnattW/eagle-ai-image-tagger
cd eagle-ai-image-tagger

# 2. Install dependencies
npm install

# 3. Build the UI
npm run build

# 4. Load in Eagle: Plugins → Developer → Load Unpacked Plugin → select this folder
```

After the initial build you only need to rebuild when you change source files (`npm run build` or `npm run build:watch` for auto-rebuild on save).

### Development workflow

```bash
npm run build:watch   # rebuilds on every file save
```

Reload the plugin in Eagle (right-click plugin → Reload) to pick up changes.

## Setup

### LLM mode

Configure the provider in Settings > LLM.

| Provider | What to set |
|---|---|
| OpenAI | API key, optionally a model name (default: `gpt-4o-mini`) |
| Anthropic | API key, optionally a model name (default: `claude-haiku-4-5`) |
| Local | Endpoint URL (default: `http://localhost:1234/v1`), model name |

**Local vision models I have tested** (via LM Studio):
- Gemma3-4B — fast, slightly less accurate library matching
- Qwen2.5 VL 7B / Qwen3 VL 4B — excellent quality

> Reasoning models (Qwen3, DeepSeek-R1) take longer — their chain-of-thought output consumes context before producing JSON. The plugin strips `<think>` blocks automatically but generation time is higher.

### Library tag matching

When **Include library tags** is enabled, a second LLM call matches the generated tags against your Eagle library and suggests up to 5 matching tags. This uses a local string-matching pre-filter so even large libraries (thousands of tags) don't inflate the prompt.

You can customise the matching instruction in Settings > LLM > Library prompt.

## Usage

### Single image

Open the plugin while images are selected in Eagle. The plugin opens in detail view showing the image, generated tags, and any library suggestions. Click tag chips to add or remove them, then click **Save Tags**.

To add a tag not in your library, click **+** next to "Generated Tags", type the tag name, and press Enter (or click **Create "…"**).

### Gallery

Click **Gallery** in the sidebar to browse all library images. The item count (filtered / total) is shown in the top bar, along with a thumbnail size slider.

**Filtering** — click **Filters** to open the filter panel:
- **Search by name** — filter by filename substring
- **Status** — All / Tagged / Untagged pills
- **Sort** — Default, Name A→Z/Z→A, Fewest/Most tags first
- **Include tags** — type a tag and press Enter, or use the picker (⌖) button. Toggle AND/OR to control whether items must match all included tags or any one of them
- **Exclude tags** — hide items that have any of the specified tags
- **Clear all** — resets every active filter at once

Any filter control can be **pinned** to the top bar for quick access without opening the panel.

**Selecting** — click a card to open it in detail view. To select multiple items:
- Click the checkbox that appears on hover
- Hold Ctrl/Cmd and click for individual toggle
- Shift+click for range selection
- Click **Select** in the top bar to enter persistent select mode (checkboxes always visible)

**Batch tagging** — with items selected click **Tag Selected**. Click **Tag All** to process all currently visible (filtered) items. A progress bar shows current/total with a Cancel button.

### Tag blacklist

In Settings > General, add tags to the blacklist. Blacklisted tags are stripped from all inference results before they are shown or saved.

### Prompt presets

In Settings > LLM, use the prompt dropdown to switch between Default and saved presets. Type a custom prompt, click **Save as preset...** to name and store it. Delete non-default presets with the trash button.
