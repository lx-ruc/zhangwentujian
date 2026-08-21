# Design · 历史/图鉴云端化

## 数据流（改后）

```
                    云端（权威）                          本地（缓存）
        ┌─────────────────────────────┐        ┌──────────────────────────┐
        │ analyses 集合                │        │ storage: reports (≤20)   │
        │  · 真实分析（fallback:false）│        │  · 整表替换式缓存        │
        │  · 兜底记录（fallback:true） │──✗──▶  │  （兜底永不进入）         │
        └──────────┬──────────────────┘        └───────────┬──────────────┘
                   │ action=history                        │ getCachedHistory()
                   │ fallback=false · 倒序 · ≤20           │ （即时渲染，0 延迟）
                   └───────────────▶ history-store ────────┤
                                    fetchHistory()         │
                                    拉取→整表替换缓存→重绘  ▼
                                     ↑              history 页 / collection 页
        analyze 成功 → 响应带真实 id ─┘（缓存预热，id 对齐）  （图鉴解锁同源）
```

## 关键机制

### 1. 为什么复用 `analyze` 函数而不新建 `history` 函数

数据同属 `analyses` 集合，鉴权同源（`getWXContext().OPENID`）；个人项目函数数量即冷启动成本与部署负担。代价是 index.ts 变长——通过把 history 查询收进独立 helper（<50 行）控制。

### 2. 查询与鉴权

```ts
// action: 'history'
const res = await analyses
  .where({ _openid: OPENID, fallback: false })   // 多键等值：仅本人 + 排除兜底
  .orderBy('createdAt', 'desc')                   // 最新在前
  .limit(CONFIG.HISTORY_LIMIT)                    // 20，与本地缓存上限一致
  .get();
```

openid 取自微信上下文而非客户端参数——伪造无效。返回前字段瘦身：`_id/hand/result/modelVersion/createdAt`（毫秒），不透出 `_openid`、`fallback` 等内部字段。

### 3. id 对齐：analyze 响应补 `id`

```ts
const added = await analyses.add({ data: record });   // _id 不再丢弃
// 响应 data 增加字段：id（客户端本地缓存的 _id 改用它；缺省回退 local- 前缀）
```

好处：历史页点击复看（`reportId` → storage 查找）在「刚分析完」与「云端刷新后」两种缓存状态下都能命中同一条记录。

### 4. 缓存策略：整表替换，不做合并

- `fetchHistory()` 成功 → `wx.setStorageSync('reports', 云端列表)` **整体覆盖**
- 为什么不合并：合并需要 id 去重 + 时间序修复，复杂度换不来收益——云端是权威且完整（自真实分析上线起全部落库），替换即收敛
- 本地旧 `local-` id 记录：首次成功拉取后自然消失，无需迁移

### 5. 页面读法：先缓存后刷新

```ts
onShow() {
  this.render(getCachedHistory());        // 立即上屏
  fetchHistory()                          // 后台拉云端
    .then((list) => this.render(list))    // 成功：整表重绘
    .catch(() => { /* 失败静默：缓存已在屏上，无需打扰 */ });
}
```

history 与 collection 共用此模式。不做时间窗/节流——`history` action 是一次索引查询，量级毫秒，个人项目不值得加缓存失效逻辑。

### 6. 图鉴解锁：换源不换算法

`collection.ts` 仅把 `wx.getStorageSync('reports')` 换成 `getCachedHistory()`；`classifyPalmType` 本地确定性分类保持不变（模型不参与、结果可复现——这是图鉴可信传播的前提）。因云端已排除 fallback，兜底报告的固定 55/55/55 不再可能混入解锁来源（此前靠「不落本地」保证，现在双保险）。

### 7. 测试口径

- **云端**（analyze-orchestration.test.ts）：mock 的 `where()` 升级为多键等值 + `orderBy()` 链式排序；新增用例：混入他人记录与 fallback 记录 → 断言仅本人非兜底、倒序、≤20；analyze 成功响应含 `id`
- **客户端**（history-store.test.ts，新增）：mock `wx` storage 与 `callFunction`——拉取映射（createdAt ISO → ms）、整表替换、上限截断
- **真机**：新分析 → 历史即时可见；杀进程重开 → 历史仍在（云端拉回）；断网 → 缓存可看；图鉴不因兜底解锁
