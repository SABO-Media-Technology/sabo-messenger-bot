## [2026-06-18] Uyển Nhi DNA + progressive lead capture

### Đã làm
- Wire persona **Uyển Nhi** từ `10-AI-BRAIN/hermes/shared/souls/uyen_nhi.md` → `src/personas/uyen-nhi.js` (distilled, không duplicate prose)
- Page contract per `projectSlug`: goal, persona, lead fields (`src/strategies/page-contracts.js`)
- Progressive lead profile per PSID+page trong session (`src/session/store.js` + `src/leads/extract.js` + `src/leads/flow.js`)
- Router inject persona + lead state vào system prompt; greeting Uyển Nhi layer `greeting-intro`
- Queue lead khi đủ name + contact + need → `messenger_leads.metadata` (name, email, need, …)
- Test: `npm run test:lead-flow` + `npm run test:replies` — **33/33 pass**

### DNA / goals (tóm tắt)
| Page | Persona | Goal |
|------|---------|------|
| SABO M&T (5 page) | Uyển Nhi | Qualify lead chuyển đổi số |
| AI Newbie VN / AI Art | Uyển Nhi | Học AI + qualify DN |
| SABO HUB | Uyển Nhi | Pilot/demo Company OS |
| BĐS VT / Arena / Billiards | generic | Vertical tư vấn + thu lead nhẹ |

### Files changed
- messenger-bot/src/personas/uyen-nhi.js (new)
- messenger-bot/src/strategies/page-contracts.js (new)
- messenger-bot/src/leads/extract.js (new)
- messenger-bot/src/leads/flow.js (new)
- messenger-bot/src/session/store.js
- messenger-bot/src/ai/router.js
- messenger-bot/src/responses/prompts.js
- messenger-bot/src/responses/greeting.js
- messenger-bot/src/leads/queue.js
- messenger-bot/src/ai/intent.js
- messenger-bot/scripts/test-lead-flow.cjs (new)
- messenger-bot/package.json

### Verify
```
npm run test:lead-flow  → All passed (multi-turn AI Newbie VN)
npm run test:replies    → 33/33 pass, greeting-intro có Uyển Nhi
```

### Chưa làm / handoff
- **Render redeploy** cần để production nhận code mới: `npm run deploy:render` hoặc manual deploy từ dashboard
- CEO test Messenger: AI Newbie VN + SABO Media — flow chào → tên → SĐT → nhu cầu → check Telegram notify + `messenger_leads` row `lead_status=qualified`

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
- ~~App Meta Development — webhook không fire cho user không có role~~ → **inbox poller** 45s (2026-06-18)
- Muốn realtime webhook: Meta App **ADMIN** → Roles → thêm Tester, hoặc App Review → Live
- Rotate GitHub PAT + Render API key (đã lộ trong chat session trước)

## [2026-06-18] Fix không reply — inbox poller (Meta Dev mode)

### Root cause
- App Meta `ADMIN` **Development** — webhook Messenger **chỉ gửi** cho user có role Admin/Developer/Tester trên app
- Account nhắn "Uyển Nhi" (PSID `27720694870861622`) **không** có role → tin vào Page inbox, server Render **không nhận** POST /webhook
- Send API vẫn OK trong 24h window (đã verify gửi tay + poller)

### Đã làm
- `src/inbox/poller.js` — mỗi 45s quét inbox 11 page, reply tin user chưa trả (dedup message id)
- Webhook ghi nhớ `message.mid` để không double-reply khi Live mode
- `/health` → `ai.inboxPoller`
- Test local: poller trả 3 backlog (AI Newbie VN + SABO Media + Billiards)

### Files changed
- messenger-bot/src/inbox/poller.js (new)
- messenger-bot/src/webhook.js
- messenger-bot/src/index.js
- messenger-bot/.env.example
- messenger-bot/DEVLOG.md

### Verify sau deploy
```bash
curl https://sabo-messenger-bot.onrender.com/health
# inboxPoller.enabled: true
# Nhắn page → reply trong ~45s
```

## [2026-06-18] Env bootstrap — thêm nguồn 05-TOOLS (Brain SSoT)

### Đã làm
- `env-bootstrap.js` load thêm `05-TOOLS/.env` và `05-TOOLS/fb-messenger-bot/.env` (Brain `Accounts/Social Media.md` trỏ đây)
- Rà toàn monorepo: page token có ở admin/.env, .env.secrets, social-credentials.local.json, fb-messenger-bot PAGES_JSON
- App secret **chỉ** ADMIN `1340824257525630` trong git; Live app `683588114593911` chỉ có ID + FILL_ME trong higgfied-mcp/.env

### Files changed
- messenger-bot/src/config/env-bootstrap.js
- messenger-bot/DEVLOG.md

### Chưa làm / handoff
- ~~Webhooks Live app~~ → **683588114593911** lưu `.env.secrets` + E2E 11/11 OK (2026-06-18)

## [2026-06-18] Migrate webhook → Meta Live app SABO ARENA (683588)

### Đã làm
- Lưu `META_APP_ID=683588114593911` + secret vào `.env.secrets` (ADMIN giữ `META_APP_ADMIN_*`)
- `npm run e2e:meta` production: app webhook OK, **11/11 page subscribe**, 11/11 profile setup
- Push env Render (deploy script)

### Files changed
- D:\0.PROJECTS\.env.secrets
- messenger-bot/DEVLOG.md

### Verify
- Nhắn page bất kỳ từ account thường → reply realtime (webhook Live)
- Có thể `INBOX_POLLER_ENABLED=false` trên Render sau khi confirm

## [2026-06-18] Full auto — Render env + Live webhook production

### Đã làm
- `deploy-render.cjs`: `RENDER_SERVICE_ID`, auto-load `RENDER_API_KEY` từ `.env.secrets`, push `INBOX_POLLER_ENABLED`
- `npm run deploy:render` → deploy `dep-d8ptm3h194ac739mo4n0` **live**
- Render env: `META_APP_ID=683588114593911`, `INBOX_POLLER_ENABLED=false`, 24 vars total
- Production verify: `/health` OK, `inboxPoller.enabled=false`, webhook challenge `auto_ok`
- `npm run e2e:meta` lần 2: **11/11 subscribe**, **11/11 profile**

### Files changed
- messenger-bot/scripts/deploy-render.cjs
- messenger-bot/package.json (`deploy:render`)
- D:\0.PROJECTS\.env.secrets (RENDER_API_KEY, RENDER_SERVICE_ID, META Live)
- messenger-bot/DEVLOG.md

### Test
- Nhắn bất kỳ page SABO trên Messenger → reply vài giây (webhook Live app)

