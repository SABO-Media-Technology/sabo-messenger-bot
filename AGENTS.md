# SABO Messenger Bot — Agent instructions

**Đọc trước mọi task:** [docs/MESSENGER_BOT_REFERENCE.md](docs/MESSENGER_BOT_REFERENCE.md)

## Scope

- Repo: `D:\0.PROJECTS\messenger-bot` (git: `longsangsabo2025/sabo-messenger-bot`)
- Production: https://sabo-messenger-bot.onrender.com
- Feature: **11-page Messenger inbox** — lead gen SABO M&T, persona Uyển Nhi, **không** Travis

## Quick rules

1. Không commit secrets — keys từ `.env.secrets`, `admin/.env`, `env-bootstrap.js`
2. Sau ship → append `DEVLOG.md`
3. Verify: `npm run test:replies`, `npm run test:lead-flow`
4. Deploy: `npm run deploy:render` + `npm run e2e:meta -- --production`
5. Uyển Nhi DNA SSoT: `10-AI-BRAIN/hermes/shared/souls/uyen_nhi.md`

## Không thuộc scope

- Travis `:8300`, Hermes gateway, Admin dashboard, EVA panel
- Sửa Brain RAG core trừ khi contract search API đổi
