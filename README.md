# OpenDebate｜锋辩

**由成都嘉祥外国语学校成华校区（嘉祥成华）高中生团队开发的 AI 辩论训练平台。**

OpenDebate（锋辩）面向高中辩手与辩论队，尝试通过 AI 对练、分项评分和训练复盘，让个人练习与团队备赛更加便捷。项目由团队成员共同完成，围绕真实的辩论训练需求设计。

> **项目状态**：主要开发与初赛答辩已完成，初赛结果尚待公布。开发团队成员均已进入高三，本仓库主要用于项目展示与技术记录，暂不承诺持续维护、后续功能开发或个性化定制。

## 核心功能

- **六大训练模式**：立论、攻辩小结、自由辩、攻辩训练、防守训练、结辩训练。
- **AI 评分反馈**：围绕不同训练环节，提供针对性的评分与改进建议。
- **团队协作**：成员和管理员角色、训练任务分配及团队数据记录。
- **训练记录与复盘**：保留个人与团队训练记录，便于回顾阶段性表现。
- **AI 助手「林婉」**：协助梳理论证、分析攻防和复盘训练；项目中也探索了任务型助手。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React、Vite |
| 后端 | Node.js、Express |
| AI | DeepSeek API |
| 数据与权限 | Supabase、服务端 JWT |
| 语音 | TTS / ASR 相关接口 |
| 部署 | Render、阿里云 |

以下为项目部署及开发说明。API Key、数据库服务端密钥等敏感信息仅应存放于服务端环境变量，不应提交至公开仓库。

---

## 完整项目目录

```text
ai-debate-coach-mvp/
├─ package.json
├─ package-lock.json
├─ .gitignore
├─ README.md
├─ supabase-auth-1.sql
├─ supabase-team-spaces.sql
├─ supabase-team-admin-roles.sql
├─ supabase-linwan-memory.sql
├─ supabase-team-task-4.sql
├─ supabase-scoring-rubrics.sql
├─ supabase-prematch-prep.sql
├─ supabase-team-preparation-board.sql
├─ supabase-team-preparation-board.rollback.sql
├─ supabase-private-data-rls.sql
├─ client/
│  ├─ package.json
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ public/
│  │  ├─ manifest.json
│  │  └─ icons/
│  └─ src/
│     ├─ App.jsx
│     ├─ main.jsx
│     ├─ styles.css
│     ├─ components/
│     └─ data/
└─ server/
   ├─ package.json
   ├─ .env.example
   └─ src/
      ├─ index.js
      ├─ deepseek.js
      ├─ polishPrompts.js
      ├─ prompts.js
      └─ scoringRubrics.js
```

## 安装依赖命令

```bash
npm install
```

## .env 示例

复制 `server/.env.example` 为 `server/.env`：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_THINKING=disabled
DEEPSEEK_TIMEOUT_MS=120000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_TIMEOUT_MS=30000
SUPABASE_TRAINING_TABLE=training_records
SUPABASE_TEAMS_TABLE=teams
SUPABASE_TEAM_MEMBERS_TABLE=team_members
SUPABASE_TEAM_TASKS_TABLE=team_tasks
SUPABASE_TEAM_TASK_ASSIGNMENTS_TABLE=team_task_assignments
SUPABASE_APP_USERS_TABLE=app_users
SUPABASE_LINWAN_MESSAGES_TABLE=linwan_messages
SUPABASE_LINWAN_PROFILE_TABLE=linwan_user_profile
SUPABASE_PREMATCH_TASKS_TABLE=prematch_tasks
SUPABASE_PREMATCH_MESSAGES_TABLE=prematch_messages
SUPABASE_PREMATCH_TRAINING_LINKS_TABLE=prematch_training_links
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN=30d
ALIYUN_NLS_APPKEY=your-aliyun-nls-appkey
ALIYUN_NLS_TOKEN=
ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_NLS_URL=https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr
ALIYUN_NLS_TOKEN_URL=http://nls-meta.cn-shanghai.aliyuncs.com/
XIAOMI_TTS_API_KEY=your-xiaomi-tts-api-key
XIAOMI_TTS_API_URL=https://api.xiaomimimo.com/v1
XIAOMI_TTS_MODEL=mimo-v2.5-tts
XIAOMI_TTS_VOICE=冰糖
XIAOMI_TTS_FORMAT=pcm16
XIAOMI_TTS_FIRST_CHUNK_TIMEOUT_MS=20000
XIAOMI_TTS_IDLE_TIMEOUT_MS=20000
XIAOMI_TTS_TOTAL_TIMEOUT_MS=300000
PORT=3001
```

`SUPABASE_SERVICE_ROLE_KEY` 只放在 `server/.env` 或线上后端环境变量中，不要放到前端代码、Vite 环境变量或公开仓库。

## Supabase 建表 SQL

在 Supabase SQL Editor 中按顺序执行仓库根目录中的 SQL 文件：

```text
supabase-team-spaces.sql
supabase-team-admin-roles.sql
supabase-auth-1.sql
supabase-linwan-memory.sql
supabase-linwan-history-profile.sql
supabase-team-task-4.sql
supabase-scoring-rubrics.sql
supabase-prematch-prep.sql
supabase-team-preparation-board.sql
supabase-private-data-rls.sql
```

这些迁移会创建或更新当前后端默认使用的 `teams`、`team_members`、`team_matches`、`training_records`、`app_users`、`team_tasks`、`team_task_assignments`、`linwan_messages`、`linwan_user_profile`、`prematch_tasks`、`prematch_messages`、`prematch_training_links` 和保留兼容的 `linwan_memory`。`supabase-linwan-history-profile.sql` 会为林婉消息增加 `context_manifest` 并创建“我的林婉”设置表；旧 `linwan_memory` 数据不会迁移，新聊天逻辑也不再读取或更新它。`supabase-prematch-prep.sql` 创建个人赛前任务、任务消息和训练结果关联表。`supabase-team-preparation-board.sql` 新增团队当前比赛、原位扩展团队任务，并在事务内精准清理旧的团队 Super 林婉任务；首次执行前必须备份数据库，控制台会输出清理前后统计。最后执行 `supabase-private-data-rls.sql`，禁止浏览器端使用 anon/authenticated 角色直接读取私有表。如果你已经建过旧版 `debate_training_records`，可以保留旧表；当前代码默认使用 `training_records`。后端使用自有 JWT 逐次校验团队成员与角色，service role key 只放在服务端，前端不会接触 Supabase key。

## P1-1 评分保存绑定迁移（合并与部署前必做）

本分支将复盘与保存绑定：`POST /api/debate/review` 返回短期有效、服务端签名的 `reviewReceipt` 和唯一 `reviewId`，`POST /api/training-records` 仅接受能校验身份、空间、任务、配置和已完成对话的凭证。保存时重新结算签名维度和封顶规则，不信任客户端申报的分数。数据库按 `review_id` 唯一索引防止重复计入。

**上线顺序：先在当前 Supabase SQL Editor 执行根目录的 `supabase-review-receipt-binding.sql`，再部署此分支的前后端。** 未部署新前端或没有完成数据库迁移时，不要切换正式后端；旧版客户端提交的记录会被拒绝保存，但可重新生成复盘。现有历史记录的 `review_id` 为 NULL，不会被删除。此修复不包含 P1-2～P1-5 或防守模式的评分稳定性重校准。

验证命令：

```bash
npm test
npm run build
```

重复使用同一 `reviewReceipt` 应返回原记录而不是写入第二条；缺少或伪造凭证、改变辩题/消息/身份、空维度自报高分均不得新增训练成绩。部署前请在测试环境核实团队任务记录与个人赛前备战结果回流。

防守逐轮评分另由 `/api/debate/respond` 签发绑定身份、训练配置和回答前缀的凭证，有效期 24 小时；后续轮次和最终复盘只使用验证后的逐轮评分。缺少逐轮凭证的旧版防守会话需要刷新后重新开始，不能通过保守补分绕过校验。复盘保存凭证有效期 1 小时、上限 200,000 字符，JWT 仅签名、不加密；不要将其写入日志或 URL。客户端在当前页面保留失败保存的原凭证并提供重试，刷新页面会丢失待保存状态；过期后需重新生成复盘。

这套绑定保证保存的数值来自服务端评分结果，不证明客户端提交的会话实际发生，也不保证模型判断客观正确。匿名身份仍依赖原有 localUserId，本轮不改变游客身份机制。部署核查和回滚清单见 [P1-1 独立审查记录](docs/p1-1-independent-review-20260924.md)。

## 本地运行步骤

1. 安装依赖：

```bash
npm install
```

2. 创建后端环境变量文件：

```bash
cp server/.env.example server/.env
```

Windows PowerShell 可使用：

```powershell
Copy-Item server/.env.example server/.env
```

3. 把 `server/.env` 中的 `DEEPSEEK_API_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 和 `JWT_SECRET` 改成自己的值。

4. 在 Supabase 创建项目，并按顺序执行上面的 SQL 文件。

5. 同时启动前后端：

```bash
npm run dev
```

如果 Windows PowerShell 提示 `npm.ps1 cannot be loaded`，改用：

```powershell
npm.cmd run dev
```

6. 打开前端页面：

```text
http://localhost:5173
```

后端默认运行在：

```text
http://localhost:3001
```

## Render 部署配置

Build Command:

```bash
npm install && npm run build
```

Start Command:

```bash
npm start
```

环境变量：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_THINKING=disabled
DEEPSEEK_TIMEOUT_MS=120000
NODE_ENV=production
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_TIMEOUT_MS=30000
SUPABASE_TRAINING_TABLE=training_records
SUPABASE_TEAMS_TABLE=teams
SUPABASE_TEAM_MEMBERS_TABLE=team_members
SUPABASE_TEAM_TASKS_TABLE=team_tasks
SUPABASE_TEAM_TASK_ASSIGNMENTS_TABLE=team_task_assignments
SUPABASE_TEAM_MATCHES_TABLE=team_matches
SUPABASE_TEAM_MATCHES_TABLE=team_matches
SUPABASE_APP_USERS_TABLE=app_users
SUPABASE_LINWAN_MESSAGES_TABLE=linwan_messages
SUPABASE_LINWAN_PROFILE_TABLE=linwan_user_profile
SUPABASE_PREMATCH_TASKS_TABLE=prematch_tasks
SUPABASE_PREMATCH_MESSAGES_TABLE=prematch_messages
SUPABASE_PREMATCH_TRAINING_LINKS_TABLE=prematch_training_links
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN=30d
ALIYUN_NLS_APPKEY=your-aliyun-nls-appkey
ALIYUN_NLS_TOKEN=
ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_NLS_URL=https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr
ALIYUN_NLS_TOKEN_URL=http://nls-meta.cn-shanghai.aliyuncs.com/
XIAOMI_TTS_API_KEY=your-xiaomi-tts-api-key
XIAOMI_TTS_API_URL=https://api.xiaomimimo.com/v1
XIAOMI_TTS_MODEL=mimo-v2.5-tts
XIAOMI_TTS_VOICE=冰糖
XIAOMI_TTS_FORMAT=pcm16
XIAOMI_TTS_FIRST_CHUNK_TIMEOUT_MS=20000
XIAOMI_TTS_IDLE_TIMEOUT_MS=20000
XIAOMI_TTS_TOTAL_TIMEOUT_MS=300000
```

不要把真实的 `server/.env` 上传到公开仓库。线上环境变量应在 Render 后台配置。

## 常见报错解决办法

### 1. 前端提示“请求失败”

检查后端是否启动，终端中应看到：

```text
Server running on http://localhost:3001
```

本地开发时，前端通过 `client/vite.config.js` 把 `/api` 代理到 `http://localhost:3001`。

### 2. 后端提示 `Missing DEEPSEEK_API_KEY`

说明没有创建 `server/.env`，或者 `.env` 中没有填写 `DEEPSEEK_API_KEY`。Render 上则需要在 Environment 页面添加该变量。

### 3. DeepSeek 返回 401 / 403

API Key 错误、失效或账号权限不足。请重新生成 Key，并确认填在后端环境变量中。

### 4. 后端提示 Supabase 表结构尚未更新

确认已经按顺序执行 `supabase-team-spaces.sql`、`supabase-team-admin-roles.sql`、`supabase-auth-1.sql`、`supabase-linwan-memory.sql`、`supabase-linwan-history-profile.sql`、`supabase-team-task-4.sql`、`supabase-scoring-rubrics.sql`、`supabase-prematch-prep.sql`、`supabase-team-preparation-board.sql` 和 `supabase-private-data-rls.sql`。

### 5. 林婉语音提示“语音服务暂未配置”

检查 Render 或 `server/.env` 是否已经配置 `XIAOMI_TTS_API_KEY`。林婉流式语音固定使用 `mimo-v2.5-tts`、内置音色 `冰糖` 和 `pcm16`；部署环境中的 `XIAOMI_TTS_MODEL`、`XIAOMI_TTS_VOICE`、`XIAOMI_TTS_FORMAT` 应与上面的示例一致。`XIAOMI_TTS_API_URL` 推荐填写小米控制台给出的 OpenAI 兼容 `BASE_URL`：`https://api.xiaomimimo.com/v1`，流式接口会调用 `/chat/completions`。

阿里云 Nginx 需要为 `/api/linwan/tts/stream` 单独设置 `proxy_buffering off`、`proxy_request_buffering off`、`proxy_cache off`、`gzip off`，并将 `proxy_read_timeout` 和 `proxy_send_timeout` 设为 `300s`；不要覆盖其他 `/api` 代理配置。Render 不需要 Nginx 改动，但不能在该 SSE 路由前增加会压缩或整段缓冲 `text/event-stream` 的中间件。

### 6. DeepSeek 返回 429

请求过于频繁或额度不足。稍后重试，或检查 DeepSeek 控制台额度。

### 7. 端口被占用

后端端口可在 `server/.env` 中修改：

```env
PORT=3002
```

如果修改后端端口，也要同步修改 `client/vite.config.js` 的代理目标。

### 8. Node 版本过低

建议使用 Node.js 18 或以上版本，因为后端使用内置 `fetch` 调用 DeepSeek API。

### 9. Render 免费实例首次访问很慢

Render 免费实例闲置后会休眠，第一次打开可能需要等待几十秒。看到服务恢复后再次刷新即可。
