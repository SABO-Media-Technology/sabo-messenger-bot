# Messenger Bot — Multi-Page AI Inbox (11 SABO Pages)

Webhook server xử lý **Facebook Messenger inbox** cho 11 page — map vào dự án empire, AI reply **không qua Travis**.

## Kiến trúc reply (3 tầng)

```
Messenger POST /webhook
  → Layer 0: keyword template (hotline, giá, cảm ơn…)
  → Layer 1: Groq / OpenAI mini + system prompt theo project
  → Layer 1+: Brain RAG prefetch (optional :3012)
  → Fallback: greeting text cứng
  → Async: Supabase leads + Telegram → sales_concierge
```

| Strategy | Pages | Backend |
|----------|-------|---------|
| `sabo-mt` | Design, Web, Agency, APP, SABO M&T | SABO M&T sales prompt |
| `rag-mini` | HUB, AI Newbie, AI Art, BĐS VT, App Billiards | Project prompt + Brain RAG |
| `human-handoff` | SABO Billiards VT (T2) | LLM ngắn + queue CEO |

**Không gọi:** Travis `:8300`, Hermes gateway, `social_facebook` worker (outbound only).

## Quick Start

```bash
cd D:\0.PROJECTS\messenger-bot
npm install
cp .env.example .env
# GROQ_API_KEY + PAGE_ACCESS_TOKEN_* + VERIFY_TOKEN
npm start
```

## Env

| Var | Mục đích |
|-----|----------|
| `GROQ_API_KEY` hoặc `OPENAI_API_KEY` | LLM sync reply |
| `BRAIN_RAG_URL` | Brain RAG `:3012` (optional) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Ghi `leads` async |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` | Notify hot lead |
| `PAGE_ACCESS_TOKEN_*` | 11 page tokens |

## Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/health` | Status + AI config |
| GET | `/webhook` | Facebook verify |
| POST | `/webhook` | Messenger events |
| GET | `/setup` | Get Started + Greeting + Menu |

## Page → Project map

| Page | Project | Tier |
|------|---------|------|
| SABO Design/Web/Agency/APP/M&T | `sabo-mt` | T0 |
| SABO HUB | `sabohub` | T1 |
| AI Newbie VN / AI Art | `ainewbie` / `ai-art` | T1 |
| BĐS Vũng Tàu | `vungtau` | T1 |
| App Billiards | `sabo-arena` | T0 |
| SABO Billiards VT | `sabo-billiards` | T2 handoff |

## Sửa giọng / prompt

`src/responses/prompts.js` — per `projectSlug`. Greeting/menu: `src/responses/greeting.js`.

## Deploy Render

1. Web Service — `node src/index.js`
2. Env: tokens + `GROQ_API_KEY` + Supabase + Telegram
3. `GET /setup` một lần sau deploy
4. Facebook webhook → `/webhook`, subscribe `messages` + `messaging_postbacks`

## Verify

```bash
curl http://localhost:3000/health
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=longsang_messenger_bot_2026&hub.challenge=123"
```

## Cấu trúc

```
src/
├── index.js
├── webhook.js
├── pages.js              # 11 pages + projectSlug + strategy
├── ai/
│   ├── router.js         # Reply pipeline
│   ├── llm.js            # Groq/OpenAI direct
│   ├── rag.js            # Brain RAG
│   ├── templates.js      # Layer 0
│   └── intent.js         # Lead detection
├── session/store.js      # In-memory multi-turn
├── leads/queue.js        # Supabase + Telegram async
├── handlers/
├── responses/
└── utils/
```
