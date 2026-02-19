# TextWise

**AI-Powered Text Toolkit** — Capture, listen, summarize, analyze, review, and study any text.

[**Try it live**](https://lewis-ths.github.io/textwise/)

---

## Features

| Feature | Description |
|---|---|
| **Input Text** | Camera capture (OCR), image upload, file upload (.txt, .md), or paste directly |
| **Audiobook** | Text-to-speech with voice selection, speed & pitch controls, play/pause/stop |
| **Summarize** | AI summaries in Brief, Standard, Detailed, or Bullet Point formats |
| **Analyze** | Word count, reading level, read time + AI analysis of themes, tone, structure & more |
| **Review** | Full writing review, grammar check, style & tone, or clarity feedback |
| **Flashcards** | Auto-generate 5–20 interactive flip cards for studying |
| **Translate** | Translate text into 19 languages |
| **Q&A** | Ask questions about your text and get contextual answers |
| **Export** | Download as .txt, .md, .html, or .json (includes all results) |

## Who is it for?

- **Students** — Summarize readings, generate flashcards, check grammar, listen to study material
- **Teachers** — Analyze text complexity, review student writing, create study aids
- **Professionals** — Summarize documents, translate content, extract key points

## Getting Started

### Use Online

Visit [**lewis-ths.github.io/textwise**](https://lewis-ths.github.io/textwise/) — no install required.

### Run Locally

1. Clone the repo:
   ```
   git clone https://github.com/lewis-ths/textwise.git
   ```
2. Open `index.html` in your browser.

That's it — no build tools, no dependencies to install.

### Set Up AI Features

1. Click the **Settings** gear icon in the sidebar
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key and click Save

Your key is stored in your browser's localStorage only — it never leaves your machine except to call the AI API directly.

> **Note:** OCR (camera/image capture) and Audiobook work without an API key.

## Tech Stack

- **HTML / CSS / JavaScript** — No frameworks, no build step
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — Client-side OCR for image text extraction
- **[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)** — Browser-native text-to-speech
- **[Marked](https://github.com/markedjs/marked)** — Markdown rendering for AI responses
- **OpenAI / Anthropic API** — AI-powered summarization, analysis, review, flashcards, translation, and Q&A

## Browser Support

Works in all modern browsers (Chrome, Edge, Firefox, Safari). Camera capture requires HTTPS or localhost.

## License

MIT
