# Model Codex

A local-first, Codex-style coding workspace that can route each task to Hugging Face, OpenAI, Anthropic, or Google Gemini models.

## Included

- Codex-inspired task rail, focused chat workspace, activity panel, and responsive mobile shell
- persistent local task history and per-provider model selection
- text/code file attachments as project context
- server-side provider calls with fixed, validated upstream endpoints
- live model discovery from all four providers
- `.env` credentials and session-only credentials entered from the Model tab
- OpenAI Responses API, Anthropic Messages API, Gemini Generate Content API, and Hugging Face’s OpenAI-compatible router

## Run locally

```bash
npm ci
cp .env.example .env
npm run dev
```

Add your Hugging Face token to `.env`:

```bash
HF_TOKEN=hf_your_token_here
```

You can add the other providers at any time:

```bash
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
GOOGLE_API_KEY=your-google-key
```

Restart the local server after editing `.env`. Open `http://localhost:3000`, select the Model tab, refresh the provider’s models if desired, and choose the active model.

## Secret handling

Environment credentials are read only by API routes and the status route returns booleans, never secret values. Keys entered through the UI are kept in `sessionStorage`, sent only to this app’s same-origin API route for the provider request, and cleared when the browser session ends. For a hosted or shared deployment, prefer runtime environment secrets over session keys.

## Scope

This web build reproduces the practical task, chat, context, model-routing, and activity workflows. Arbitrary local shell execution and unrestricted filesystem access are intentionally excluded from the browser build; those require a signed desktop wrapper plus an explicit permissions model.
