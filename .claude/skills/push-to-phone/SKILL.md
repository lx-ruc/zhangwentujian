---
name: push-to-phone
description: 掌纹测运项目：代码修改完成后的标准收尾流程 —— typecheck + jest 验证 → 按需部署云函数 → auto-preview 推真机（免扫码）→ git 提交推送。触发词：「推送」「推送到手机」「真机预览」「推最新」，或项目内任何代码修改完成之后。
---

# push-to-phone — 验证→部署→推真机 标准闭环

本项目（掌纹测运 wx3b8baf398bf449d2）改动后的固定收尾。顺序不可乱：**验证不过不部署、不推送**（曾把漏 import 的包推到真机，运行时 ReferenceError）。

## 流程（严格按序）

### ① 验证（每次必做）

```bash
set -o pipefail && npm run typecheck > /dev/null 2>&1 && echo TS-OK && npx jest 2>&1 | grep 'Tests:'
```

- **必须 `set -o pipefail`**：管道会吃掉 tsc 的退出码——不带它时 typecheck 失败 && 链照样往下走，曾把类型错误提交进仓库
- typecheck 或 jest 失败：先修复再继续，绝不跳过

### ② 云函数部署（仅当改动 `cloudfunctions/**`）

```bash
npm run deploy:cloud
```

- 等价于 build:cloud（TS→JS 编译）+ cloudbase CLI 部署（60s 超时/环境变量随 cloudbaserc.json，**该文件含 Key 不入库**）
- 坑：`cloudfunctions/analyze/*.js` 是编译产物且被 require 优先命中——**改了 .ts 必须重新 build/deploy**，否则 jest 和云端都跑旧代码

### ③ 推真机（免扫码）

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli auto-preview --project /Users/lixin/shouxiang/zhangwentujian
```

- **auto-preview 推到用户已配对的手机**，自动拉起小程序，无需扫码
- 走现有 IDE（http://127.0.0.1:33800），**不要 automator.launch 新实例**（会要求重新登录）
- `preview` 子命令是生成二维码给用户扫——用户已明确偏好 auto-preview，除非用户主动要二维码

### ④ 提交推送

```bash
git add -A && git commit -m "<type>: <中文描述>

Co-Authored-By: Claude <noreply@anthropic.com>" && git push
```

## 三端同步铁律

同一视觉改动必须同步三处，**曾只改 wxss 没改 wxml 导致真机布局错乱而 HTML 预览正常**：

1. `miniprogram/pages/**`（wxml + wxss 一起改）
2. `design/app-preview.html`（HTML 预览版，样式 1:1，px = rpx ÷ 2）
3. 云函数 Prompt（文案类改动时）

## 常用诊断（用户反馈"不生效/有 bug"时）

```bash
# 云端数据库实查（配额/奖励/报告——大部分"分享没加次数"类问题查库即定位）
export PATH="$(npm prefix -g)/bin:$PATH"
cloudbase db nosql execute -e cloud1-d9g41s8gza68b70b8 --command '[{"TableName":"users","CommandType":"QUERY","Command":"{\"find\":\"users\",\"filter\":{},\"limit\":1}"}]' --json

# 云函数配置/状态
cloudbase fn detail analyze -e cloud1-d9g41s8gza68b70b8

# 带真实 openid 的云函数调用测试（模拟器身份，比 invoke 更真实）
node /tmp/bonus-test2.js  # 参考其写法：automator.launch + evaluate(wx.cloud.callFunction)
```

环境 ID：`cloud1-d9g41s8gza68b70b8`（cloudbase CLI 已登录）。

## 平台差异速查

| 项 | iOS | Android |
|---|---|---|
| ··· 菜单「分享到朋友圈」 | ❌ 平台不提供 | ✅ |
| 朋友圈 +3 路径 | 报告页存海报（自动 +3） | 菜单分享 或 存海报 |
| 相关文案 | 用 `isIOS()`（utils/share.ts）隐藏朋友圈指引 | 全量提示 |

## 已知坑备忘

- **批量文本替换必须 assert**：python `s.replace(old,new)` 锚点失配会静默跳过（曾把节点"移除成功、插回失败"直接弄丢 UI）——每个 replace 后 `assert new in s`，改完 grep 确认关键节点仍在
- **容器/基础样式块易被批量重构误删**（.page-report 曾整块丢失致内容贴边）——视觉异常先 grep 根类名是否还存在，别急着调数值
- **配额/奖励字段必须全量写库**：`upsertUserQuota` 漏字段会造成"内存生效、落库丢失"（按钮红→白闪回）
- **跨日重置要清全部计数字段**：漏清 shareCounters 导致旧计数永久占用每日限次（隐藏 5 天的 bug）
- **`import type` 不可用**：自动真机调试管线要求，全量普通 import（dd60948）
- 编译条件/页面路径空值 → `Page "" is not found`：已由显式 `entryPagePath` + `onPageNotFound` 兜底双保险
