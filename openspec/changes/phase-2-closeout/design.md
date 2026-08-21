# Design · Phase 2 收尾

## 决策后的完整链路

```
                     ┌─ 成功：报告落库 ──→ consume + upsert users ─┐
模型 + 校验（重试1次）┤                                              ├→ 删图 → 返回
                     └─ 兜底：模板落库（fallback:true）             ─┤
                        · users 完全不写入（不扣配额）                │
                        · remaining = remainingOf(quota) 未消耗口径   │
                                                                       ▼
                                              analyzing.ts 接住 { report, remaining, fallback }
                                                                       │
                                              ┌────────────────────────┴───────────────┐
                                              │ fallback=true                          │ fallback=false
                                              ▼                                        ▼
                                   跳过 saveRecord（不进                     saveRecord（进历史、
                                   历史/不解锁图鉴）                          可解锁图鉴）
                                   pendingFallback=true                     pendingFallback=false
                                              └────────────────┬───────────────┘
                                                               ▼
                                              report 页：fallback 时顶部横幅
                                              「照片没读清，本次未扣次数，重拍一张试试」
```

## 关键机制说明

### 1. 兜底不扣配额 —— 云端是唯一改动点

`index.ts` 中把 `consume` + `upsertUserQuota` 挪进 `!fallback` 分支。`remaining` 的计算：

- 成功路径：`remaining: DAILY_QUOTA - next.dailyCount`（现状不变）
- 兜底路径：`remainingOf(quota)`——即按**未消耗**的 quota 对象取值（`quota.lastUsedDate !== today` 时自然返回满额 3）

**客户端零改动即自动对齐**：`analyzing.ts:69-73` 由 `remaining` 反推 `dailyCount` 写回本地，云端不扣则本地不扣。这是当初「配额以云端 remaining 为准回写」设计的红利，本 change 直接受益。

不更新 `lastUsedDate`：兜底不产生任何 users 集合写入，语义最干净（「这次尝试不计入」），也避免给未来防刷计数器留下歧义数据。

### 2. fallback 字段的三段接力

```
云端信封字段 → analyzing（callFunction 泛型补 fallback?: boolean）
            → globalData.pendingFallback（app.ts 加一个 boolean，默认 false）
            → report.onLoad 读取并清位（与 pendingReport 同生命周期，一次性）
```

报告页 data 加 `isFallback`，wxml 在 `.head` 上方渲染横幅。样式沿用朱砂边框提醒级别（横幅是提醒不是错误，用墨色+朱砂点缀，避免大面积红）。横幅带「重拍一张」按钮 → `redirectTo /pages/capture/capture`。

### 3. 不进消费面 = 跳过一处写入，级联成立

本地消费面（历史列表 `history.ts:22`、图鉴解锁 `collection.ts:25`）都遍历 storage 的 `reports`——兜底记录不写入，两处自然看不到它。无需改这两个页面。

云端 `analyses` 保留兜底落库（`fallback: true` 已有字段）：这是唯一的兜底率观测数据源（Phase 4 埋点前的质量监控依赖云函数日志 + 该集合），删掉就瞎了。

### 4. 进度条真实化 —— Promise 驱动 + 最短展示

```
旧：progress = elapsed / 8000，到 100% 触发 finish（UI 在 100% 卡 0-7s）
新：progress 缓行逼近 90% 封顶（如每 400ms 前进剩余距离的 8%）
    finish 触发 = Promise.allSettled([reportPromise, minDelay(≥4s)])
    promise settle 后 progress 补完 100%，短暂停顿再跳转
```

保留最短展示时长的理由：真实回调若 3s 内返回，直接跳报告页会显得「廉价」——解读类产品的仪式感是感知价值的一部分，8-15s 的等待本身是体验设计的素材（趣味知识轮播已在承载这件事）。

### 5. 兼容性矩阵

| 组合 | 行为 |
|---|---|
| 新云函数 + 新客户端 | 完整目标行为 |
| 新云函数 + 旧客户端 | 兜底不扣（remaining 变小幅度不变），无横幅——无感变好，无破坏 |
| 旧云函数 + 新客户端 | `fallback` 字段缺省 `undefined` → falsy → 走正常路径——安全退化 |

无需强制同步发版，但建议同批提交审核。

### 6. 测试口径

- `tests/analyze-orchestration.test.ts` 补场景：两次校验失败 → 返回兜底、`remaining` 未减、`users` 集合零写入、图片仍删除
- 现有「兜底照扣配额」相关断言（若有）同步修正
- 客户端 `analyzing` 的 fallback 分支逻辑薄（一个 if + 一个字段传递），靠真机三路径回归覆盖：成功 / 兜底（横幅+不进历史）/ 配额用尽
