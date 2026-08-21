# Phase 2 收尾：兜底策略落地 + 分析页真实化

## Why

Phase 2 核心链路已打通（云函数完整编排 + 客户端云存储上传 + GLM-4.6V-Flash 真机端到端验证），但盘代码发现一处设计意图未落地、三个产品行为未拍板。2026-08-21 探索会话已全部拍板，本 change 落地这些决策：

1. **静默降级**：云端在兜底时返回 `fallback: true`（`cloudfunctions/analyze/index.ts:108`，注释称「前端可据此提示建议重拍」），但客户端 `analyzing.ts:63` 的返回类型未声明该字段，直接丢弃——用户拿到与己无关的常量模板报告却毫不知情。
2. **兜底扣配额**：`index.ts:102-103` 对兜底结果照样 `consume`——用户花 1/3 当日次数换来写死的通用文案。
3. **兜底污染消费面**：兜底报告照常写入本地 `reports`（`analyzing.ts:108`），进入历史列表，且其固定 `lines: {heart:55, head:55, life:55}` 会确定性解锁同一图鉴类型（`collection.ts:27-35`）——历史占位 + 图鉴假解锁。
4. **进度条失真**：`analyzing.ts:17` 为 8s 固定假动画（注释自认「联调后改为跟随真实回调」），真实链路 8-15s，UI 会在 100% 卡住数秒。

## What Changes

| 决策（已拍板） | 内容 |
|---|---|
| 兜底不扣配额 | 云端仅对非兜底结果消耗配额；兜底时 `users` 集合完全不写入，`remaining` 返回未消耗值。客户端按 `remaining` 反推本地配额（`analyzing.ts:69-73`），自动对齐，零改动 |
| 补横幅 | 客户端接住 `fallback` 字段，经 `globalData.pendingFallback` 传入报告页；报告页顶部展示横幅：「照片没读清，本次未扣次数，重拍一张试试」，附重拍入口 |
| 兜底不进历史/图鉴 | `analyzing` 对兜底结果跳过 `saveRecord` → 本地历史无此记录、图鉴解锁无此来源（级联自动成立）；云端 `analyses` 仍落库（带 `fallback: true`），作为质量观测数据 |
| 进度条真实化 | 进度缓行封顶 ~90%，真实回调完成后补完 100% 再跳报告页；保留最短展示时长（≥4s，维持解读仪式感） |
| 文档对齐 | 勾销 PLAN.md 账目（Phase 0 智谱 Key、Phase 2 三项）；CLAUDE.md 模型名 GLM-4V-Flash → GLM-4.6V-Flash |

## Impact

- **改动**：`cloudfunctions/analyze/index.ts`；`miniprogram/pages/analyzing/`、`miniprogram/pages/report/`（ts/wxml/wxss）、`miniprogram/app.ts`（globalData 加一个字段）；`tests/analyze-orchestration.test.ts`；PLAN.md、CLAUDE.md
- **不动**：`quota.ts` 纯函数（两端）、`validate.ts`、`zhipu.ts`、history/collection 页面（无兜底记录后自动正确）
- **兼容性**：字段缺省即 false，新旧云函数与客户端任意组合均不破坏（旧客户端 + 新云函数：只是少扣配额，无感变好）

## Non-goals

- **历史/图鉴云端化**：云端 `analyses` 集合目前只写不读，历史与图鉴全依赖本地 storage（换机即失）。归属 Phase 3 的 change，`collection.ts:24` 已留注释路标
- **防刷计数器**（连续 N 次兜底后拒绝）：故意传烂图只能刷到固定模板，无收益；免费模型 + 429 退避 + 配额前置检查已兜底。v1 不加，云日志见异常再补
- **兜底报告的分享/海报**：维持现状（可分享，内容为通用模板）
- **report 页无数据时的 `MOCK_REPORT` 兜底链**（`report.ts:51`）：维持现状，分享落地路径另行决策
