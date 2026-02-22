# Rundownly

AI-powered YouTube video summarizer that runs on your desktop. Paste a link, get an instant summary with timestamps — no cloud, no sign-up.

Built with [Tauri 2](https://tauri.app/) + [Next.js](https://nextjs.org/) + [Claude AI](https://www.anthropic.com/).

## Features

- **Runs locally** — YouTube is accessed from your IP. No server, no IP blocks.
- **Secure** — API key stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). Never leaves your machine.
- **Timestamps** — Summaries link back to exact moments in the video.
- **11 languages** — English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, Hindi, Arabic, Assamese.
- **3 summary lengths** — Short, Medium, or Long.
- **Dark mode** — Follows your system theme.
- **Caching** — Re-opening the same video returns the cached summary instantly (24h TTL).
- **Export** — Download summaries as Markdown or copy to clipboard.

## Getting Started

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Anthropic API key](https://console.anthropic.com/settings/keys)

### Install & Run

```bash
git clone https://github.com/rajat-mehra05/rundownly.git
cd rundownly
npm install
npm run tauri:dev
```

The app opens automatically. On first launch, you'll be prompted to enter your Anthropic API key.

### Build for Production

```bash
npm run tauri:build
```

Outputs platform-specific installers (`.dmg`, `.msi`, `.AppImage`) in `src-tauri/target/release/bundle/`.

## How It Works

1. You paste a YouTube URL and pick a summary length + language.
2. The Rust backend fetches the video transcript via YouTube's Innertube API.
3. The transcript is sent to Claude with a tailored prompt.
4. Claude's response streams back in real-time and renders as Markdown with clickable timestamp links.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop framework | Tauri 2 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Rust, reqwest, tokio |
| AI | Claude API (Sonnet 4.5 default) |
| Markdown | react-markdown |
| Storage | tauri-plugin-store (settings), OS keychain (API key) |

## Downloads

Pre-built binaries are available on the [Releases](https://github.com/rajat-mehra05/rundownly/releases) page for macOS (ARM64 & Intel), Windows, and Linux.

## BYOK (Bring Your Own Key)

Rundownly uses the Anthropic API directly — you pay only for what you use. A typical video summary costs less than $0.01. Get your API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).

## Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or documentation improvement — PRs are appreciated.

### Before You PR

- Test locally with `npm run tauri:dev` and verify the feature works end-to-end
- Run the linter: `npm run lint`
- Build successfully: `npm run tauri:build`
- Ensure CI checks pass
- Keep PRs focused — one thing per PR, don't mix unrelated concerns
- Describe **what** changed and **why** in your PR description

### Getting Set Up

```bash
git clone https://github.com/rajat-mehra05/rundownly.git
cd rundownly
npm install
npm run tauri:dev
```

If you find a bug or have a feature request, [open an issue](https://github.com/rajat-mehra05/rundownly/issues) first so we can discuss the approach.

## License

Open source. See [LICENSE](LICENSE) for details.
