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
- ~~Deploy Render~~ ✅ xem entry dưới
- Chốt page ID lệch (HUB, BĐS VT)

## [2026-06-18] Deploy Render production

### Đã làm
- Repo public: https://github.com/longsangsabo2025/sabo-messenger-bot
- Render `srv-d8psv69194ac739luu00` → **https://sabo-messenger-bot.onrender.com**
- 21 env vars (Groq, 11 page tokens, Supabase, Telegram, META)
- Deploy live; `/health` 200; webhook verify `challenge: render_ok`

### Handoff
- Meta Developer: Callback URL `https://sabo-messenger-bot.onrender.com/webhook`, verify `longsang_messenger_bot_2026`
- ~~Một lần: `GET https://sabo-messenger-bot.onrender.com/setup`~~ ✅ 11/11 (xem entry dưới)
- RAG production: set `BRAIN_RAG_ENABLED=true` + `BRAIN_RAG_URL` (VPS public) nếu cần

## [2026-06-18] Fix profile setup + E2E production PASS

### Đã làm
- **Root cause:** Graph API v21+ đã bỏ `greeting` trên `messenger_profile` → `/setup` fail 11/11
- **Fix:** `sender.js` — một POST gộp `get_started` + `persistent_menu` + `ice_breakers` (thay greeting)
- Push `sabo-messenger-bot` commit `7932dbe`, Render redeploy **live**
- `npm run e2e:meta` production:
  - App webhook subscribed ✅
  - 11/11 pages subscribed ✅
  - **11/11 profile setup OK** ✅
  - Reply pipeline Groq+ RAG OK ✅
  - Webhook simulate POST 200 ✅
- Production `/health`: 11 tokens, Groq, leadQueue

### Files changed
- messenger-bot/src/utils/sender.js
- messenger-bot/scripts/e2e-meta-setup.cjs
- messenger-bot/DEVLOG.md

### Verify
```bash
cd D:\0.PROJECTS\messenger-bot
npm run e2e:meta          # exit 0, setup 11/11
npm run test:replies      # 33/33
```

### Chưa làm / handoff (inbox thật)
- **App Meta đang Development** — chỉ user có role Tester/Admin trên app `ADMIN` (1340824257525630) mới nhận auto-reply khi nhắn Page
- CEO/tester: mở Messenger → nhắn **SABO Media & Technology** (hoặc bất kỳ page trong 11) câu "Xin chào, tư vấn làm app"
- Muốn public: App Review → Advanced Access `pages_messaging` → chuyển app **Live**
- Rotate GitHub PAT + Render API key (đã lộ trong chat session trước)

