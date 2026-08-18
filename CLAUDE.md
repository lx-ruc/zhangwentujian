# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Greenfield project (no code yet). **`PLAN.md` is the source of truth** for architecture, milestones, and constraints — read it before starting any work.

Product: WeChat Mini Program for AI palm-line "fun personality analysis" (趣味测试). Deliberately positioned as entertainment, NOT fortune-telling.

## Tech Stack (decided, do not change without discussion)

- **Frontend**: Native WeChat Mini Program + TypeScript, in `miniprogram/`
- **Backend**: WeChat Cloud Development (云开发) — cloud functions in `cloudfunctions/`, Node.js 18
- **AI**: Zhipu GLM-4V-Flash (free vision model). API key lives ONLY in cloud function env vars, never in miniprogram code
- **Tests**: jest for units (`tests/`), miniprogram-automator for E2E (`e2e/`)

No build/lint/test commands exist yet — scaffold them in Phase 1 and document the actual commands here when they exist.

## Architecture

Data flow: `wx.chooseMedia` → `wx.cloud.uploadFile` → cloud function `analyze` (quota check → fetch image → base64 → Zhipu API → JSON schema validation with 1 retry → persist text-only report to `analyses` collection → delete uploaded image).

Key decisions that span multiple files:

- **Images are ephemeral**: palm photos are deleted from cloud storage immediately after analysis. DB stores text reports only. Never add code that persists photos.
- **Daily quota** (3/day per openid) enforced in cloud function `quota.ts`, mirrored client-side in `miniprogram/utils/quota.ts` — keep both pure functions with unit tests.
- **Model output is untrusted**: `cloudfunctions/analyze/validate.ts` must schema-validate the LLM's JSON and keyword-filter banned terms before persistence. On failure: retry once, then serve fallback copy — never a blank screen.
- **Palm-type collection (core viral asset)**: 12 archetypes in `miniprogram/data/palm-types.ts` (No.01-12, rarity, tagline, compat). Classification is a LOCAL deterministic pure function (`utils/classify.ts`: dominant line × style) — the model NEVER classifies; it only produces line scores + descriptions. Type set is closed and test-locked.
- **Share system**: all copy in `utils/share.ts` (hooks: type name + rarity). Canvas poster in `utils/poster.ts` (paper/ink/cinnabar style; disclaimer required on poster).
- **Local data loop (until Phase 2)**: reports persist to storage `reports` (max 20), quota in storage `quota`; `utils/mock-report.ts` is the fallback when cloud fn is undeployed.
- **Prompt lives in `cloudfunctions/analyze/prompt.ts`** as a constant; changes to it are product decisions (see compliance rules below).
- **Visual design (finalized 2026-08-17)**: 宣纸/墨/朱砂「图鉴」风 — `design/preview.html` is the source of truth for all 5 screens. Palm-line SVG paths + product↔traditional naming map (情感线/思维线/活力线) live in `design/hand-paths.json`. Product name: 掌纹测运.

## Compliance Rules (critical — project-killing if violated)

WeChat bans 算命/占卜/看相 content as 封建迷信. All user-facing copy and generated content must follow:

1. **Banned vocabulary** in names, titles, UI copy: 手相、算命、占卜、大师、运势、命运、风水、吉凶 (and equivalents in share cards/posters). Product name is 「掌纹测运」 (WeChat name-check passed 2026-08-17) — the ONLY place 「运」 may appear; generated content and UI copy must additionally filter 运气、好运、转运、旺 (enforced in validate.ts). Fallback name if rejected at review: 掌纹性格测试.
2. **Banned content** in reports (enforced via prompt + validate.ts filter): lifespan/death predictions, health diagnoses, absolute claims (必定/命中注定), disaster/凶险 statements
3. **Required disclaimer** on index, report page, and share poster: content is 趣味解读, 仅供娱乐
4. Reports use hedged phrasing only: 倾向于/可能/仅供参考

When writing any user-facing string, report template, or prompt text — apply these rules proactively.

## Conventions

- Error handling at every layer; user-friendly messages client-side, detailed logging in cloud functions
- Pure, immutable functions for logic in `utils/` and cloud function helpers (no in-place mutation)
- Chinese for all user-facing copy; code identifiers and comments in English
- Files < 800 lines, functions < 50 lines
