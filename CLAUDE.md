# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**`PLAN.md` is the source of truth** for architecture, milestones, and constraints — read it before starting any work. Current review status (third-round audit against 功能设置规范 §3, rectification checklist, B-line trigger): `COMPLIANCE-AUDIT-2026-09.md`.

Product: WeChat Mini Program **十二人格签** — a "fun personality test" (趣味测试) built as a closed 12-archetype sign-collection. Deliberately positioned as entertainment, NOT fortune-telling. (Renamed from 掌纹测运 on 2026-09-07 after a second review rejection; see Compliance below.)

## Tech Stack (decided, do not change without discussion)

- **Frontend**: Native WeChat Mini Program + TypeScript, in `miniprogram/`
- **Backend**: WeChat Cloud Development (云开发) — cloud functions in `cloudfunctions/`, Node.js 18
- **Draw engine**: LOCAL, no runtime AI. `miniprogram/utils/draw.ts` (seeded mulberry32 → rarity-weighted pick → inverse-consistent scores). The Zhipu GLM-4.6V-Flash vision pipeline in `cloudfunctions/analyze` is DORMANT (kept as dead code, guarded by `tests/e2e-real-model.test.ts`); if ever revived, API key lives ONLY in cloud function env vars
- **Tests**: jest for units (`tests/`), miniprogram-automator for E2E (`e2e/`)

Commands: `npm run typecheck` (both ends), `npm test` (jest units), `npm run deploy:cloud` (compile TS → upload analyze, pay, paynotify via CloudBase CLI; first use needs `tcb login --flow device`; IDE CLI's cloud deploy is broken with ret:41002), `npm run e2e` / `e2e:full` (automator smoke / real-chain). Real-model unit E2E (dormant-path guard): `ZHIPU_API_KEY=xxx npx jest tests/e2e-real-model.test.ts` (auto-skips without key).

## Architecture

Data flow (2026-09-07 pivot): `index` (icon-only CTA) → `capture` (`wx.chooseMedia`, photo stays on device) → `analyzing` (local `drawReport` ~2.2s → cloud fn `analyze` action `draw`: quota check → `validateReport` shape+banned-term check → typeId whitelist → persist text-only report to `analyses` with `modelVersion:'local-draw-1'` → consume quota) → `report` (renders ALL body copy from `data/report-content.ts` via `REPORT_CONTENT[type.id]`).

Key decisions that span multiple files:

- **Photos never leave the phone**: capture keeps the image only as a local preview in `globalData.pendingImage`; nothing is ever uploaded. DB stores text reports only. Never add code that uploads or persists photos.
- **Daily quota** (3/day per openid) enforced server-side in the cloud `draw` action, mirrored client-side in `miniprogram/utils/quota.ts` (optimistic consume + rollback on failure) — keep both pure functions with unit tests.
- **Client-reported draw results are untrusted**: the cloud `draw` action re-validates the client's report JSON via `validate.ts` (schema + banned terms) and whitelists `typeId` against the 12-type set before persisting. Tampering can only pollute the attacker's own history.
- **Sign collection (core viral asset)**: 12 archetypes in `miniprogram/data/palm-types.ts` (No.01-12, rarity, tagline, compat). Draw = LOCAL weighted random (`utils/draw.ts`, weights from rarity); `utils/classify.ts` maps scores back to type and is inverse-consistent with draw (test-locked). Full per-type copy lives in `miniprogram/data/report-content.ts` (`REPORT_CONTENT`, closed set). There is NO runtime AI anywhere in the live path.
- **Share system**: all copy in `utils/share.ts` (hooks: type name + rarity). Canvas poster in `utils/poster.ts` (paper/ink/cinnabar style, seal-char watermark; disclaimer required on poster).
- **Local data loop (until Phase 2)**: reports persist to storage `reports` (max 20), quota in storage `quota`; `demoReport()` in `utils/draw.ts` is the report-page fallback when opened with no record.
- **Virtual payment (implemented 2026-08-24, gated OFF)**: master switch `PAY_ENABLED` in `miniprogram/config/index.ts` (default false — paid quota on compliance-sensitive content must not ship until review strategy settles; see VIRTUAL-PAYMENT-SETUP.md §5). SKU `add_quota_5` ¥1 → +5 permanent quota (`users.purchased`, never date-reset). Cloud fns: `pay` (order/query; server is price+productId authority, signs with OFFER_ID/PAY_APP_KEY/WX_APP_SECRET env vars from gitignored config.json) and `paynotify` (delivery/refund XML push via HTTP 云接入 with 集成响应, acks plain-text '0'). Idempotency: `pay_deliver_log` `_id`=wx_order_id + outTradeNo reverse-check, lock rolled back on partial failure. pay/paynotify config+deliver are intentional duplicates (separate packages can't cross-import) — sync both, enforced by `tests/pay-config-consistency.test.ts`; official signature vectors locked in `tests/pay-sign.test.ts`. Console setup steps + 13-item 官方检查清单对照: VIRTUAL-PAYMENT-SETUP.md.
- **Dormant AI pipeline**: `cloudfunctions/analyze/prompt.ts` + the `analyze` action are kept but unused; treat any change to them as a product decision (see compliance rules).
- **Visual design (sign-collection restyle 2026-09-07)**: 宣纸/墨/朱砂「签纸图鉴」风 — `design/preview.html` (design spec, 5 plates) and `design/app-preview.html` (pixel-mirror of the built pages, 1rpx=0.5px) are the sources of truth. No image assets: all seals/signs are wxml/wxss/Canvas. Legacy hand SVG paths in `design/hand-paths.json` are unused by the app.

## Compliance Rules (critical — project-killing if violated)

WeChat bans 算命/占卜/看相 content as 封建迷信. Two review rejections so far (2026-08-24: 算命内容 + 深度合成/个人主体; 2026-09: customer service pointed at the homepage CTA 「拍摄手掌·开始测试」 and demanded full removal). Response (2026-09-07 decisions): keep the photo flow but make the CTA icon-only, scrub ALL palm vocabulary from every visible surface, rename to 十二人格签, and retire runtime AI entirely (local random draw; photo never uploaded — this also kills the 深度合成 ground).

1. **Banned vocabulary** — single source of truth is `tests/copy-ban.test.ts` (`BANNED_TERMS`, synced with `cloudfunctions/analyze/validate.ts`): 算命 占卜 手相 面相 大师 运势 运气 好运 转运 旺 命运 吉 凶 灾 祸 求签 签文 解签 测运 + palm set 手掌 掌纹 掌心 巴掌 手纹 **and single char 掌 with zero exceptions** (鼓掌 was rewritten to 叫好, not allowlisted). The scanner sweeps every user-visible string in `miniprogram/**` + both design HTMLs; identifiers/comments/`{{bindings}}`/import paths are out of scope. UI copy must never claim AI 生成/读取/分析. 「签」 is fine as a noun (人格签/抽签); banned sign-verbs are 求签/解签 — use 抽取/解锁.
2. **Banned content** in reports: lifespan/death predictions, health diagnoses, absolute claims (必定/命中注定), disaster statements — enforced by prompt (dormant) and validate.ts filter (live).
3. **Required disclaimer** on index, report page, and share poster: 趣味测试，仅供娱乐，不构成任何科学依据或决策建议.
4. Reports use hedged phrasing only: 倾向于/可能/仅供参考.
5. **B-line contingency (documented, not implemented)**: if a future rejection still targets the photo flow itself, delete `capture`/`analyzing` and replace with a standalone draw page (no camera). Trigger: reviewer rejects on the shape of the flow (拍手照→性格报告) after this surface-clean version.

When writing any user-facing string, report template, or prompt text — apply these rules proactively.

## Conventions

- **No `import type` / inline `{ type X }` modifiers in miniprogram TS** — the 自动真机调试 pipeline's Babel preset is older than TS 3.8/4.5 and fails to parse them (simulator compiles fine, so this only shows up on device). Use plain `import { X }` for types; tsc elides them anyway. `export type X = ...` alias declarations are fine.
- Error handling at every layer; user-friendly messages client-side, detailed logging in cloud functions
- Pure, immutable functions for logic in `utils/` and cloud function helpers (no in-place mutation)
- Chinese for all user-facing copy; code identifiers and comments in English
- Files < 800 lines, functions < 50 lines

## Standard Closeout Flow

After any code change in this repo, follow `.claude/skills/push-to-phone/SKILL.md`:
verify (typecheck + jest, with `set -o pipefail`) → deploy cloud fn if `cloudfunctions/**` changed (`npm run deploy:cloud`) → `cli auto-preview` to the user's phone (no QR scan, reuse existing IDE) → commit & push. Trigger words: 推送 / 推送到手机 / 真机预览.
