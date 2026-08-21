# Tasks · Phase 2 收尾

## 1. 云端：兜底不扣配额

- [x] 1.1 `cloudfunctions/analyze/index.ts`：`consume` + `upsertUserQuota` 仅在 `!fallback` 分支执行；兜底路径 `remaining: remainingOf(quota)`（未消耗口径）
- [x] 1.2 确认兜底路径对 `users` 集合零写入（不更新 `lastUsedDate`）；`QUOTA_EXCEEDED` / 异常路径行为不变
- [x] 1.3 `tests/analyze-orchestration.test.ts`：新增「两次校验失败 → 兜底返回 + remaining 未减 + users 零写入 + 图片仍删除」断言；修正受影响的旧断言

## 2. 客户端：fallback 接力 + 横幅

- [x] 2.1 `miniprogram/app.ts`：`GlobalData` 增加 `pendingFallback: boolean`（默认 false）
- [x] 2.2 `analyzing.ts`：`callFunction` 泛型补 `fallback?: boolean`；`fetchReport` 透传；`finish` 中 fallback 时跳过 `saveRecord` 与 `reportId` 设置，置位 `pendingFallback`
- [x] 2.3 `report` 页（ts/wxml/wxss）：`onLoad` 读 `globalData.pendingFallback`（读后清位）；fallback 时 `.head` 上方渲染横幅「照片没读清，本次未扣次数，重拍一张试试」+「重拍一张」按钮 → redirectTo capture；样式用墨色底 + 朱砂细节（提醒级，非错误级）

## 3. 客户端：进度条真实化

- [x] 3.1 `analyzing.ts`：进度缓行封顶 ~90%（每 tick 前进剩余距离的固定比例）；`finish` 触发改为 `Promise.allSettled([reportPromise, minDelay])`，minDelay ≥ 4s；settle 后补完 100% 再跳转
- [x] 3.2 清理：删除 `PROGRESS_TOTAL` 常量与「联调后改为跟随真实回调」的过时注释

## 4. 回归与文档

- [x] 4.1 `npm run typecheck`（或等效 tsc 双端）零错误；`npx jest` 全绿（52 passed / 3 skipped=真实模型 E2E 无 Key 跳过）
- [ ] 4.2 真机/开发者工具三路径回归：成功报告 / 兜底（横幅出现、不进历史、图鉴无新解锁、配额不减）/ 配额用尽（提示 + 回拍摄页）
- [x] 4.3 PLAN.md：勾销 Phase 0「智谱 API Key」（已完成于 a58d33c）与 Phase 2 三项（注明 2026-08-21 完成口径）；CLAUDE.md：GLM-4V-Flash → GLM-4.6V-Flash
- [ ] 4.4 全部完成后 openspec archive 本 change
