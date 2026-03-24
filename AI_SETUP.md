# AI Setup (Free Local Mode)

This project now supports **local Ollama AI** and uses it by default.

## Why this mode
- No paid cloud API required.
- No per-request billing quota.
- Runs on your machine (speed depends on your hardware).

## 1) Install Ollama
- Download and install from: https://ollama.com/download

## 2) Pull a model
Run:

```bash
ollama pull llama3.2
```

You can choose another model if you want (for example `qwen2.5:3b`).

## 3) Configure backend env
Create/update `Backend/.env` using `Backend/.env.example`.

Required AI values:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
AI_TIMEOUT_MS=60000
```

## 4) Start backend
From `Backend/`:

```bash
npm run dev
```

## 5) Use AI Assistant page
- Open the app and go to `/assistant`.
- Ask your query and receive AI responses.

---

## Optional: switch back to OpenAI
If needed, set:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```
