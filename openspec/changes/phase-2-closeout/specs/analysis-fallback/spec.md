# analysis-fallback 变更

## ADDED Requirements

### Requirement: 兜底结果不消耗每日配额

云端分析进入兜底（模型调用或校验连续失败至重试上限）时，系统 SHALL NOT 增加该用户当日已用次数，SHALL NOT 写入 `users` 集合，返回的 `remaining` SHALL 反映未消耗口径。

#### Scenario: 兜底后配额不变

- **WHEN** 用户当日已用 0 次（剩余 3），本次分析进入兜底
- **THEN** 返回 `remaining: 3`，`users` 集合无任何写入，上传图片仍被删除

#### Scenario: 兜底前已有消耗保持不变

- **WHEN** 用户当日已用 1 次（剩余 2），本次分析进入兜底
- **THEN** 返回 `remaining: 2`，本地配额回写后仍显示已用 1 次

### Requirement: 兜底结果对用户可见

报告页展示兜底报告时 SHALL 渲染横幅，说明本次为通用解读且未扣次数，并提供重拍入口。

#### Scenario: 兜底报告展示横幅

- **WHEN** 分析结果为兜底并进入报告页
- **THEN** 报告页顶部展示「照片没读清，本次未扣次数，重拍一张试试」横幅及重拍按钮，点击重拍跳转拍摄页

### Requirement: 兜底结果不进入本地消费面

兜底报告 SHALL NOT 写入本地 `reports` storage（即不进入历史列表），并因此 SHALL NOT 解锁图鉴类型；云端 `analyses` 集合 SHALL 仍持久化该记录并携带 `fallback: true` 标记。

#### Scenario: 兜底后历史与图鉴无痕

- **WHEN** 本次分析进入兜底且用户离开报告页
- **THEN** 历史列表无本次记录，图鉴解锁集合不变
