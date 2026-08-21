# Tasks · 历史/图鉴云端化

## 1. 云端：history action + id 返回

- [x] 1.1 `cloudfunctions/analyze/config.ts`：加 `HISTORY_LIMIT: 20`；`index.ts`：`analyses.add` 捕获 `_id`，`AnalyzeResult` 增加 `id`，成功响应携带
- [x] 1.2 `index.ts`：新增 `action: 'history'` —— `where({ _openid, fallback: false }).orderBy('createdAt','desc').limit(HISTORY_LIMIT)`，返回字段瘦身后的 records（含 createdAt 转毫秒）；查询逻辑收进独立 helper（<50 行）
- [x] 1.3 `tests/analyze-orchestration.test.ts`：mock `where()` 升级多键等值 + `orderBy` 链；新增「history：仅本人 + 排除兜底 + 倒序 + ≤20」与「analyze 响应含 id」用例
- [x] 1.4 `npm run deploy:analyze` 部署（改动落云端才算数）

## 2. 客户端：history-store + 换源

- [x] 2.1 新增 `miniprogram/utils/history-store.ts`：`fetchHistory()`（云端拉取 → 字段映射 → 整表替换 storage `reports`，上限 20）+ `getCachedHistory()`；新增 `tests/history-store.test.ts`（mock wx storage + callFunction：映射/替换/截断）
- [x] 2.2 `analyzing.ts`：本地缓存记录 `_id` 改用云端返回 `id`（缺省回退 `local-` 前缀）
- [x] 2.3 `history.ts`：`onShow` 改「缓存即时渲染 + 后台 fetchHistory 重绘，失败静默」；删除「Phase 2 联调时改读云数据库」欠账注释
- [x] 2.4 `collection.ts`：解锁数据源改 `getCachedHistory()`（算法不动）；删除对应欠账注释

## 3. 回归

- [x] 3.1 `npm run typecheck` 双端零错误；`npm test` 全绿
- [ ] 3.2 真机四路径：新分析→历史即时可见；杀进程重开→历史仍在；断网开历史→缓存可看无报错；兜底后图鉴无新解锁
- [ ] 3.3 若云控制台提示查询需要索引，建复合索引（_openid + fallback + createdAt）
- [ ] 3.4 全部完成后 openspec archive 本 change
