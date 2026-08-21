# history-sync 变更

## ADDED Requirements

### Requirement: 云端为历史权威数据源

云函数 SHALL 提供 `history` 查询：仅返回调用者本人（以微信上下文 OPENID 判定，不信任客户端参数）的、`fallback` 为 false 的分析记录，按创建时间倒序，上限 20 条，返回完整文本报告。

#### Scenario: 排除兜底与他人记录

- **WHEN** 集合中存在本人的 fallback 记录、他人的正常记录、本人的正常记录，且用户发起 `history`
- **THEN** 仅返回本人的正常记录，最新在前，条数不超过 20

### Requirement: 分析成功响应携带云端记录 id

`analyze` 成功时响应 SHALL 包含云端 `analyses` 集合自动生成的记录 `id`；客户端本地缓存 SHALL 使用该 id 作为 `_id`（云端未返回时方回退本地前缀）。

#### Scenario: 本地缓存 id 与云端对齐

- **WHEN** 一次成功分析后立即查看历史，再手动触发云端刷新
- **THEN** 两次看到的是同一条记录（id 一致），不出现重复项

### Requirement: 本地存储降级为云端缓存

本地 `reports` storage SHALL 作为云端历史的缓存：每次成功拉取整表替换（上限 20），无独立写入路径；云端拉取失败时 SHALL 静默保留缓存供渲染。

#### Scenario: 断网可看历史

- **WHEN** 设备离线时打开历史页
- **THEN** 页面正常渲染缓存内容，无错误弹窗

#### Scenario: 换机后历史可恢复

- **WHEN** 用户在新设备（或清缓存后）登录并打开历史页
- **THEN** 后台从云端拉回历史记录并渲染

### Requirement: 图鉴解锁与历史同源

图鉴解锁判定 SHALL 读取与历史页相同的云端缓存数据；分类算法保持本地确定性映射不变。

#### Scenario: 兜底分析不解锁图鉴

- **WHEN** 一次分析进入兜底，随后云端历史刷新
- **THEN** 图鉴解锁集合不含兜底报告对应的类型
