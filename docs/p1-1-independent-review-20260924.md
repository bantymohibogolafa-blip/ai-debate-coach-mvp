# P1-1 独立审查与部署交接（2026-09-24）

## 状态与证据

- 仓库：bantymohibogolafa-blip/ai-debate-coach-mvp。
- 重新 fetch 后 main：`2e1c137e1f5dac21b68891e0109a8ab1dfb69527`。
- PR #19 再次读取仍为 OPEN、Draft、未合并；远端 head 为 `9a8aad64b3211a44b328788ea82312f63c43dbc5`。
- [原 GitHub Actions](https://github.com/bantymohibogolafa-blip/ai-debate-coach-mvp/actions/runs/35985569488) 确认 success，对应上述远端 head，不能当作本轮新增修改的 CI 结果。
- 原目录 D:/项目 存在用户未提交内容，未改动。本轮在 D:/项目-p1-1-review 的 `fix/p1-1-review-bound-records` 分支工作。
- 本轮代码修补提交 `0710e9ffeed841fd6339f980f643582efecb5c19` 已推送原修复分支，PR 仍 Draft；对应 [新 CI 36006172439](https://github.com/bantymohibogolafa-blip/ai-debate-coach-mvp/actions/runs/36006172439) 已成功。不合并 main、不触发生产部署。用户后续截图确认最新正式服务跟踪 main。
- 用户最新截图：正式服务为 `ai-debate-coach-mvp1`，服务 ID `srv-d841573tqb8s73et2o9g`，网址 https://ai-debate-coach-mvp1.onrender.com，Live commit `2e1c137`，2026-09-22 最近部署由 Auto-Deploy 触发。先前提供的无 1 网址不是这张截图所指的最新服务。

## 审查结论与修补

1. 原 PR 封堵了直接向保存接口提交维度或空维度总分的路径。保存先验 HS256、issuer、audience、有效期、身份及配置，再从签名结果结算。认证 JWT 无法作为复盘凭证使用；复盘凭证没有认证 token 所需的 sub。
2. **阻断问题：防守逐轮评分来源仍不可信。** 原 PR 将客户端的 defenseRoundStates 直接用于 45% 逐轮权重与封顶，再给最终结果签名。现由 respond 对模型生成的逐轮结果签名，并绑定身份、配置、来源任务和截至该回答的会话摘要；后续 respond/review 验签后才使用分数。单独的 answer 必须等于会话末尾的实际回答。删除、伪造、跨回答使用凭证均被拒绝。评分权重与模型提示词未改。
3. **恢复问题：原客户端丢弃保存凭证。** 现在保留原调用上下文和凭证，提供重试保存按钮、禁止保存期间开始另一场训练，并显示服务端错误。410 提供重新生成复盘入口。待保存状态仅在内存中，刷新会丢失。
4. 只把 PostgreSQL `23505` 的 409 当作可能重放，再按 review_id 查原记录并校验归属；其他冲突不能伪装成功。唯一索引负责并发原子性。数据库缺少 review_id 时直接失败，避免触发旧结构兼容写入。
5. 过期或无效的登录 token 在相关写入路径不再静默降级为游客。真正无 token 的个人训练仍支持。游客 localUserId 不是强认证，本轮没有重新设计游客身份。
6. 名家风格的难度在保存端也归一到 city，避免团队任务配置与签发时不一致；文本模式保持 novice 数据库兼容值。
7. 签发端也检查 200,000 字符上限，避免先返回一份验证端必拒绝的大凭证。签名 JWT 含会话和复盘，内容可解码，不是加密；不应记录到日志、URL 或分析平台。服务端现有 JWT_SECRET 至少 24 字符，前后端同步发布时保持密钥不变。

## 信任与幂等边界

- 服务端评分来自模型调用及后端结算；客户端会话内容仍可自行构造，签名不证明真实训练发生，也不防模型被内容误导。
- 同一凭证、同一身份和配置、有效期内的重复请求返回同一记录。新生成复盘会签发不同 review_id；本轮没有增加服务端会话存储或限制同一内容重新复盘。
- 凭证过期后保存返回 410。即便曾经保存成功，也不保证过期重放返回旧记录；重新复盘前应先检查历史记录，避免把已成功但丢失响应的训练再次计入。
- 重试仍重新检查团队成员、任务关闭状态和当前配置。任务关闭或权限改变时可能拒绝重试，但不会多写成绩。
- 团队任务按当前数据库任务/比赛配置和指派校验；current_match 的手动完成语义保留。
- 个人备战回流继续校验任务所有权、空间、辩题和立场；回流分数来自记录。自由文本训练目标、弱点和建议仍属于低信任说明字段，不能当作独立验证的事实。
- 历史读取路径不要求 review_id；旧行 NULL 不删除、不重算。

## 验证结果（分层记录）

| 类别 | 结果 | 边界 |
| --- | --- | --- |
| 原远端 CI | Success：217 服务端、75 客户端，Vite build 成功 | 只针对 9a8aad6；本轮修改尚未运行 GitHub CI |
| 本轮本地自动化 | 226/226 服务端、75/75 客户端；Vite build 成功；git diff --check 通过 | Windows，Node 24.14.1 / npm 11.11.0 |
| 本轮代码 CI | 0710e9f 的 push 与 pull_request 两次运行均 Success，npm test / npm run build 成功 | GitHub Actions，Ubuntu / Node 20；run 36006166806 与 36006172439 |
| 模拟 API 回归 | 六模式游客/登录复盘与保存、三轮真实 respond 路由签发到复盘保存、防守评分一致、缺失/伪造/错用途/过期凭证、篡改维度/回答/身份/任务/配置、并发重复、数据库提交后丢失响应、团队任务授权及关联、个人备战回流、历史/能力画像读取通过 | DeepSeek 与 Supabase 采用测试 mock；不是实际模型或实际 PostgreSQL 事务测试 |
| 先前网址公开只读 | 无 1 的 mvp.onrender.com：/health 正常；首页 HTTP 200，加载 /assets/index-BGz0wMZw.js，不含 reviewReceipt | 此结果仅适用于先前网址；用户随后以截图确认最新入口是 mvp1.onrender.com |
| 最新生产截图 | mvp1 服务跟踪 main，Live 为 2e1c137，最近由 Auto-Deploy 部署 | 来自用户截图；不是助手读取控制台的结果。当前开关和构建命令未显示 |
| 最新入口公开只读 | mvp1.onrender.com 的 /health 正常，首页 HTTP 200，加载 /assets/index-BGz0wMZw.js | 健康检查已实测；生产写入流程未执行 |
| 真实线上验收 | 未执行 | 未生成付费模型调用、写入正式测试成绩、读取私人历史或检查 Render 日志 |
| 浏览器 UI | 连接重试及 reset 后仍 nodeRepl.fetch request failed | 未查看 Render 控制台，未做真实 UI 点击验证 |

## 数据库

用户报告正式 Supabase 已执行根目录 supabase-review-receipt-binding.sql 的三条语句，并查询确认 review_id 为 nullable uuid 和唯一索引存在。迁移文本与当前代码匹配，本轮不需要新表、新列或删除任何数据。

未直连正式 Supabase 独立验证。部署前确认服务实际使用 `SUPABASE_TRAINING_TABLE=training_records`（或未设置，使用默认值）及正确的 Supabase 项目。只核对配置，不提供 service role key / JWT_SECRET 的值。不要重复执行其他历史迁移或回滚此新增列和索引。

## Render 部署前待核查

用户截图已确认服务名称/ID、仓库、main 分支与 Live 2e1c137，最近部署由 Auto-Deploy 触发。其余实际控制台信息仍待提供，README 命令只是预期，不能当作实测：

- 当前 Auto-Deploy 开关（最近触发方式不等于当前开关状态）。
- Events 当前 Live 部署 ID。截图显示上一版本 35bdb34 有 Rollback 入口；新发布前应将当前 2e1c137 记作回滚目标。
- Build Command、Start Command、Root Directory 和 Node 版本。
- 是否同一个服务提供 client/dist 与 API，是否还有独立 Static Site/CDN/PWA 缓存。
- 确認使用的训练表和 Supabase 项目；仅确认 JWT_SECRET 已配置且保持不变，不抄录密钥。

新代码 CI 已通过；在上述部署配置确认及用户明确批准前，不建议合并 PR #19。最终合并时仍须核对实际 PR head 及其 CI。

## 发布顺序（尚未执行）

1. 已根据截图核实最新生产跟踪 main，修补已推送独立修复分支。
2. 已确认代码提交与新 GitHub Actions 匹配且通过；条件允许时仍应在独立测试环境演练。
3. 记录具体回滚部署 ID，选低流量时段，明确旧客户端兼容影响，再向用户请求针对明确 commit 的合并/生产部署确认。
4. 获得确认后按实际 Render 配置合并或手动部署目标 commit，前后端同版本。Auto-Deploy 开启时合并本身可能立即触发部署。
5. 发布后以专用测试账号/任务执行验收，并分别记录模型、数据库和真实 UI 结果。

旧前端缺少必要身份和凭证，新后端会拒绝复盘或保存；旧防守会话没有逐轮凭证，需刷新后重新开始。普通模式可在新客户端重新生成复盘。旧后端仍信任客户端评分，即使新版前端上线也不能单独实现安全修复。提前完成在途训练，并在发布后刷新页面。

## 回滚方案（尚未执行）

- 目标必须是上线前记录的实际成功部署 ID / Commit，不能猜测为本地 main。
- 若核心训练、保存、历史读取出现回归，经用户确认，在 Render Events 对该成功版本执行 Rollback；若有独立 Static Site，同步回退匹配的前端并验证缓存。
- 保留 review_id 列和唯一索引，保留新旧记录；不执行降级 SQL、不换密钥、不清理历史。
- 回滚旧代码会重新暴露 P1-1，所以只用于恢复服务；后续仍需发布修复。
- Render 控制台回滚会自动关闭 Auto-Deploy；回滚后核实此状态，不自行重新开启。参考 [Render Rollbacks](https://render.com/docs/rollbacks)。
- 核查 /health、个人训练/历史、团队任务和日志，记录实际回滚 commit 与时间。

## 正式验收清单（全部待执行）

- 六模式开始、提交、生成复盘、保存；防守最终分数与历史一致。
- 游客、登录个人、团队任务及个人赛前备战结果回流。
- 同凭证重复提交仅一条；缺少/伪造/改身份/更换会话无新增成绩；篡改客户端评分不能写入伪造分数。
- 保存失败使用原凭证重试；过期恢复；确认旧缓存/旧会话提示。
- 旧历史、能力画像、团队统计可读取，Render 日志无新增异常。
