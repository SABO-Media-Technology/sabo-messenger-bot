## [2026-06-18] Messenger Bot v2 — AI inbox 11 pages (không Travis)

### Đã làm
- Map 11 page → `projectSlug`, `replyStrategy`, tier T0/T1/T2 (`src/pages.js`)
- AI pipeline: template → Groq/OpenAI mini → Brain RAG → fallback (`src/ai/`)
- System prompts per project từ MARKETING_AGENT spirit (`src/responses/prompts.js`)
- Multi-turn session in-memory (`src/session/store.js`)
- Async lead queue → Supabase `leads` + Telegram notify (`src/leads/queue.js`)
- Handlers dùng `generateReply()` thay text cứng
- `/health` báo LLM/RAG/leadQueue status
- `sql/001_messenger_threads.sql` optional persistence
- README + `.env.example` cập nhật

### Files changed
- messenger-bot/src/pages.js
- messenger-bot/src/index.js
- messenger-bot/src/handlers/message.js
- messenger-bot/src/handlers/welcome.js
- messenger-bot/src/ai/router.js
- messenger-bot/src/ai/llm.js
- messenger-bot/src/ai/rag.js
- messenger-bot/src/ai/templates.js
- messenger-bot/src/ai/intent.js
- messenger-bot/src/session/store.js
- messenger-bot/src/leads/queue.js
- messenger-bot/src/responses/prompts.js
- messenger-bot/.env.example
- messenger-bot/README.md
- messenger-bot/sql/001_messenger_threads.sql

### Verify
- `node -e "require('./src/ai/router')"` OK
- Server `:3099` — `/health` có block `ai`, `strategies`
- Webhook verify OK

## [2026-06-18] Env bootstrap + quality test 11 pages (Groq thật)

### Đã làm
- `src/config/env-bootstrap.js` — load GROQ/Supabase/Telegram/META từ monorepo `.env`, map admin page tokens, fetch 5 token thiếu qua Graph `/me/accounts`
- `scripts/test-replies.cjs` — test 11 page × 3 câu (greeting/pricing/lead), scoring chất lượng
- `npm run test:replies` — **33/33 pass** với Groq `llama-3.3-70b-versatile` + Brain RAG snippets
- Fix TLS Windows: `node --use-system-ca` trong start/dev/test scripts
- Lead queue chuyển sang bảng `messenger_leads` (`sql/002_messenger_leads.sql`)
- Fix duplicate handoff suffix SABO Billiards T2
- `LEAD_QUEUE_DRY_RUN=1` trong test script (không spam Telegram)

### Kết quả test chất lượng (2026-06-18)
| Layer | Khi nào |
|-------|---------|
| `sabo-mt+rag` | 5 page SABO M&T — greeting có ngữ cảnh thiết kế/web/app |
| `rag-mini` | HUB, AI Art, BĐS VT, Arena, AI Newbie — prompt đúng vertical |
| `human-handoff` | SABO Billiards VT — không lặp chữ ký |
| `template` | Hỏi giá + lead intent — CTA hotline 0798893333 |

### Files changed
- messenger-bot/src/config/env-bootstrap.js (new)
- messenger-bot/scripts/test-replies.cjs (new)
- messenger-bot/sql/002_messenger_leads.sql (new)
- messenger-bot/src/leads/queue.js
- messenger-bot/src/ai/router.js
- messenger-bot/package.json
- messenger-bot/.env.example

## [2026-06-18] Chạy thật: migration + lead + server bootstrap

### Đã làm
- `npm run db:migrate` — tạo `messenger_leads` trên Supabase shared `diexsbzqwsbpilsymnfb` (qua DATABASE_URL)
- Fix `env-bootstrap`: ghép đúng URL/key shared (tránh lẫn `hoaprkc` từ travis/admin)
- `npm run test:lead` — insert OK (`leadId` trong DB), Telegram notify OK (bỏ Markdown gây 400)
- Server `:3105` — `/health`: 11 tokens, Groq, RAG, leadQueue = true
- Scripts: `db:migrate`, `test:lead`

### Verify
```
npm run db:migrate     → OK messenger_leads
npm run test:replies   → 33/33 pass
npm run test:lead      → stored: true + Telegram
curl :3105/health     → tokensConfigured: 11, llm: groq
```

### Chưa làm / handoff
- Deploy Render + webhook Facebook subscribe (cần URL public)
- `GET /setup` trên production một lần
- Chốt page ID lệch (HUB, BĐS VT)

