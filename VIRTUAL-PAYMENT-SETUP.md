# 虚拟支付（个人主体）接入交接文档

> 官方指引：https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person
> 代码已全部就位，**入口默认关闭**（`miniprogram/config/index.ts` 的 `PAY_ENABLED: false`）。
> 完成下述后台配置并真单验证通过后，才可改为 `true` 提审。

## 一、卖什么

| 项 | 值 |
| --- | --- |
| 道具 ID（productId） | `add_quota_5` |
| 道具名 | 解读加量包·5次 |
| 价格 | 100 分（¥1） |
| 发货内容 | `users.purchased` 永久 +5 次解读额度（不随日期重置） |
| 模式 | `short_series_goods`（道具直购，无代币） |

价格/道具目录的**权威在服务端** `cloudfunctions/pay/config.ts`（`paynotify/config.ts` 为强制同步副本，`tests/pay-config-consistency.test.ts` 守卫两边一致）；改价必须同步改 MP 后台道具管理，三方不一致会被平台拒绝（errCode -15013）。

## 二、代码结构

```
miniprogram/utils/pay.ts        前端：wx.requestVirtualPayment 封装 + 版本闸门（SDK≥2.19.2，iOS 微信≥8.0.68）
miniprogram/pages/index/        购买入口：次数用尽时显示「¥1 加购 5 次」chip（payEnabled && exhausted）
cloudfunctions/pay/             下单 + 查单
  config.ts                     道具目录/集合名/env（0=现网）
  sign.ts                       签名（官方向量单测锁定：tests/pay-sign.test.ts）
  wechat-api.ts                 code2Session / access_token / query_order（Node https，10s 超时）
  deliver.ts                    幂等发货（pay_deliver_log._id = wx_order_id + outTradeNo 反查双保险）
  index.ts                      action=order|query
cloudfunctions/paynotify/       发货/退款推送接收（HTTP 云接入，集成响应）
  xml.ts                        推送 XML 解析（CDATA + 嵌套节点）
  deliver.ts / config.ts        与 pay 包有意复制（云函数包不能跨目录 import），测试守卫同步
  index.ts                      xpay_goods_deliver_notify → 发货；xpay_refund_notify → 回收；成功返回纯文本 '0'
```

### 关键语义

- **发货以平台推送为准**；前端 success 回调不可靠（用户退出即丢），只在支付成功后 fire-and-forget 触发一次 `query` 兜底。
- **幂等**：`pay_deliver_log` 集合 `_id` = wx_order_id（推送场景 MchOrderNo）；另按 outTradeNo 反查（query 兜底场景）。发货中途失败会**回滚锁文档**，让平台重推（≤15 次）可完整重跑。
- **退款**：`xpay_refund_notify` → `users.purchased` 扣减（下限 0）+ 订单标记 refunded。
- **订单表** `orders`：`{_openid, outTradeNo, productId, sku, quantity, amount, status: created|delivered|refunded, wxOrderId, createdAt}`。
- **下单即落库**（created）在返回签名之前，保证任何回调都能对上本地单。

## 三、你需要做的后台配置（代码之外）

### 1. 开通虚拟支付（MP 后台）
mp.weixin.qq.com → 支付与交易 → 虚拟支付 → 开通 → 填个人资料（身份信息、提现账户、支付管理员）→ 审核约 5 分钟 → 扫码签约。
前置条件：个人主体 + 服务类目含「工具」+ 已认证备案。**月支付限额 10 万元。**

### 2. 建道具并发布
虚拟支付 → 道具管理 → 创建：道具 ID `add_quota_5`，价格 100 分，名称「解读加量包·5次」→ **发布**（未发布 → errCode -15010；改价后约 10 分钟生效 → -15014）。

### 3. 记下 3 个密钥，写入两个云函数的环境变量
开通后到 虚拟支付 → 基本配置 拿 OfferID / 现网AppKey；AppSecret 在 开发管理 → 开发设置。

```bash
cp cloudfunctions/pay/config.template.json cloudfunctions/pay/config.json
cp cloudfunctions/paynotify/config.template.json cloudfunctions/paynotify/config.json
# 两个文件都填：OFFER_ID / PAY_APP_KEY / WX_APP_SECRET
npm run deploy:cloud    # 重新部署读取 env
```

`config.json` 已 gitignore；缺任一变量时 pay 云函数返回 `PAY_NOT_CONFIGURED`，前端提示「支付暂未配置完成」。

> **部署故障排查（2026-09-03 实测）**：`cli cloud functions deploy` 连续报
> `getCloudAPISignedHeader failed ret:41002 system error`（`list` 正常、`auto-preview` 正常、重启 IDE 无效）。
> 此为 IDE 侧云 API 签名票据问题，需在开发者工具 GUI 里操作一次：打开项目 → 顶部【工具 → 云开发】
> 看是否有新版云开发/协议弹窗需要同意，或右上角头像 → 退出登录 → 扫码重登，然后重跑 `npm run deploy:cloud`。

### 4. 部署 paynotify 的 HTTP 云接入
云开发控制台 → 云函数 → paynotify → **云接入/HTTP 访问**开启：
- 鉴权方式选「免鉴权」（平台推送不带微信登录态）
- **打开「集成响应」**（返回 `{statusCode, body}` 结构必需）
- 打开「消息推送」方式为 HTTP 后，把生成的 URL 填到 MP 后台 虚拟支付 → 基本配置 → 发货推送配置
- 也可用开发者工具 Skills 的「消息推送接收」自动完成部署配置

推送到达 → 发货 → 返回纯文本 `0`；返回非 0 平台会重试（≤15 次）。

### 5. 建数据库集合
云开发控制台 → 数据库，建两个集合（权限「仅创建者可读写」即可，读写都走云函数）：
- `orders`
- `pay_deliver_log`

`users` 集合已存在（analyze 在用）。

### 6. iOS 支付（可选，收费 12% vs 安卓 1%）
虚拟支付 → 基础配置 → 配置小程序简称（Apple 侧 display name）→ 开通苹果 IAP 支付。
不开 IAP 则 iOS 端 `canUseVirtualPayment()` 仍可能放行但平台拒绝——建议在 MP 后台不开 IAP 时同步把前端 iOS 分支隐藏入口（当前 `canUseVirtualPayment` 已含 iOS 微信版本≥8.0.68 校验；IAP 未开通时平台返回错误，会走统一失败提示）。

## 四、上线与验证

1. 全部后台项完成后：`miniprogram/config/index.ts` → `PAY_ENABLED: true`，重新上传体验版。
2. **小额真单验证**（¥1 自付）：
   - Android 微信内：首页用完 3 次 → 点「¥1 加购 5 次」→ 支付 → toast「已到账 5 次」→ 再测 1 次解读确认额度可用；
   - 查云开发数据库：`orders` 该单 status=delivered、`pay_deliver_log` 有对应 wxOrderId 文档、`users.purchased`=5；
   - 查 MP 后台 虚拟支付 → 交易订单：金额、状态与本地一致；
   - `query_order` 兜底口径：status 2/3/4 视为已支付（触发补发货）、5/8 已退款、6 已关闭。若实测字段与 `wechat-api.ts` 的容错解析不符（官方文档未给出完整响应示例），以真单返回为准调整。
3. 退款自测：MP 后台交易订单里退这笔 ¥1 → 收到 `xpay_refund_notify` → `users.purchased` 应回到 0。
4. 结算认知：Android T+3、费率 1%；iOS 约 45-60 天、费率 12%；180 天内退款退手续费。提现在 虚拟支付 → 账户余额。

## 五、合规红线（本项目特有）

⚠ 本小程序 2026-08-24 曾因「算命内容 + 深度合成（个人主体未开放）」被拒。虚拟支付叠加付费解锁解读，**属于审核高危组合**：
- 「付费测算」在拒绝理由 ① 的原句里被点名（付费取名）。上线付费前，报告页内容必须已是合规版（无 运势/吉凶/命运 等词，已做）；建议等「去 AI 化抽签方案」（已规划未实施）落地后再开 `PAY_ENABLED`，或先以纯免费版过审后再单独提审付费能力。
- 支付成功文案已避开「解锁运势」类措辞，用「加量包/次数」中性词。
- 道具名不可含 banned 词（「解读加量包」已检查）。

## 六、部署前检查清单（官方 13 项逐条对照）

| # | 官方检查项 | 状态 |
| --- | --- | --- |
| 1 | 开放条件：个人主体 + 身份证 + 类目「工具」+ 认证备案 | ⏳ 后台确认（类目需含工具，当前主体为个人） |
| 2 | 已告知月支付限额 10 万元 | ✅ 本文档 + 总结报告已告知 |
| 3 | MP 后台虚拟支付已开通 | ⏳ 用户操作（三.1） |
| 4 | 已拿到 AppID / OfferID / 现网AppKey | ⏳ 用户操作（三.3，AppID 已知 wx3b8baf398bf449d2） |
| 5 | iOS 支付：已配置小程序简称 | ⏳ 用户操作（三.6，可选） |
| 6 | 消息推送接收已部署 | ✅ 代码就绪（paynotify 集成响应）；⏳ 云接入开启动作（三.4） |
| 7 | 后台已配发货推送 URL + 一笔测试支付 | ⏳ 用户操作 + 真单验证（四.2） |
| 8 | 验签逻辑与官方示例核对一致 | ✅ tests/pay-sign.test.ts 官方 assert 向量通过 |
| 9 | 发货推送幂等（wx_order_id 去重） | ✅ deliver.ts 双键幂等 + 回滚，单测覆盖 |
| 10 | 前端 wx.requestVirtualPayment 打通 | ✅ 代码就绪（PAY_ENABLED=false 待开闸后真机验证） |
| 11 | 兜底查单 query_order 就绪 | ✅ pay action=query + 支付后自动补查 |
| 12 | 已说明退款规则/结算周期/费率 | ✅ 四.4 + 总结报告 |
| 13 | 上线后小额真单全链路一致 | ⏳ 开闸后执行（四.2 步骤已列） |

（✅ = 代码/文档侧完成并可机器验证；⏳ = 需要你在 MP/云开发后台操作或真单验证）
