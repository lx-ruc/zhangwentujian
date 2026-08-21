# 历史/图鉴云端化：analyses 集合读路径 + 本地缓存降级

## Why

Phase 2 收尾时定位的架构缺口：云端 `analyses` 集合**只写不读**，历史页与图鉴页全部依赖本地 storage（`history.ts:22`、`collection.ts:25`）。后果：

1. **换机/清缓存 = 历史与图鉴收集进度全灭**——图鉴是产品最重的传播/复访机制，却压在最易失的存储上
2. 两处代码各自欠着迁移承诺注释（`history.ts:21`「Phase 2 联调时改读云数据库」、`collection.ts:24`「Phase 2 后同逻辑读云端」）
3. 本地 `reports` 与云端 `analyses` 是双份真相，id 各自为政（`local-时间戳` vs 云端自动 id），从未对齐

## What Changes

| 决策 | 内容 |
|---|---|
| 云端加 `history` action | 复用 `analyze` 云函数（不新建函数）：按 `_openid = 调用者 AND fallback = false` 查询，`createdAt` 倒序，上限 20 条，返回完整文本报告。**fallback 记录天然排除**——云端留它作质量观测，消费面永远不见 |
| 云端返回记录 id | `analyze` 成功时把 `analyses.add` 产出的真实 `_id` 随响应返回，客户端本地缓存改用真实 id——双份真相从此 id 对齐 |
| 本地 storage 降级为缓存 | 新增 `utils/history-store.ts`：`fetchHistory()`（云端拉取 → **整表替换** storage `reports`，上限 20）+ `getCachedHistory()`。不再有独立的本地写入路径（analyzing 的即时写入改用云端 id，作为缓存预热） |
| 页面读法：缓存即时渲染 + 后台刷新 | history / collection 的 `onShow` 先渲染缓存（0 延迟），再后台 `fetchHistory()` 成功后重绘；**失败静默保留缓存**（断网也能看历史） |
| 图鉴解锁数据源切换 | collection 从「读 storage」改为「读 history-store 同一份缓存」，解锁算法（本地确定性分类）不变 |

## Impact

- **改动**：`cloudfunctions/analyze/`（index.ts 加 action、config.ts 加常量）、`miniprogram/utils/history-store.ts`（新增）、`analyzing.ts`（改用云端 id）、`history.ts` / `collection.ts`（数据源切换）、`tests/`（云函数 mock 扩展 + history action 用例 + history-store 单测）
- **不动**：report 页按 id 复看路径（storage 保留所以照常工作）、图鉴分类算法、quota 体系、UI 布局
- **数据兼容**：旧缓存里的 `local-` id 记录在首次成功云端拉取后被整表替换自然消失；云端自真实分析上线起就是超集，无迁移脚本需求

## Non-goals

- 分页 / 无限加载（上限 20 与现行为一致；历史页 UI 不改版）
- 增量同步 / 离线写队列（无写入场景，历史是只读消费面）
- 记录删除、云端收藏
- 配额跨设备恢复——`quota` action 本就按 openid 云端查询（`index.ts:65`），配额天然跨设备，无需处理；本地展示镜像在首次云端查询后自动纠正
- 复合索引（`_openid + fallback + createdAt`）——上线后若云控制台提示查询需索引，建一个即可，属运维动作
