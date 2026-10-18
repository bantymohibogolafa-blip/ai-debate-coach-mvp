# Supabase 轻量保活操作说明

目标项目：`qxevikxgvuupxzpufkcz`。代码完成不代表已部署：需手动执行 SQL、设置 Secrets，并将工作流合入默认分支后验证。

## 仓库检查与方案边界

- `server/src/index.js` 的 `signAuthToken`/`verifyAuthToken` 使用自建 JWT；`getSupabaseConfig`/`supabaseRequest` 使用后端 service role 访问数据库。
- 业务数据包括用户、训练记录、团队、任务、林婉记忆与备赛记录。`supabase-private-data-rls.sql` 启用相关业务表 RLS 并撤销 anon/authenticated 授权；一些历史 SQL 仍含 `auth.uid()` 策略。仓库文件不能证明生产库已执行了哪些迁移，部署前应核对实际权限，不能直接重跑业务 SQL。
- 本方案只新增 `public.project_heartbeat`，固定一行 `(1, 'opendebate-heartbeat-v1')`。主键与检查约束限制最多一行；anon 只能读取，无写权限；authenticated/service_role 无新表授权。数据库管理员仍可维护。
- publishable key 不是“仅此表专用凭证”：它代表整个项目的 anon 访问权限。安全边界来自实际数据库的 grants 和 RLS。本迁移不会修复或改变其他表权限。
- 工作流不 checkout、不安装依赖、不启动应用、不访问 Render、不调用 DeepSeek/TTS，不需要用户账号、密码、自建 JWT 或高权限密钥。GitHub token 权限为 `permissions: {}`。

## 1. 核对生产库，再手动执行迁移

1. 打开 [Supabase 项目](https://supabase.com/dashboard/project/qxevikxgvuupxzpufkcz)，确认 Project ID。若项目已暂停，先在控制台恢复；定时请求无法自动恢复暂停项目。
2. 在 SQL Editor 新建查询。先只读核对业务表的 RLS、客户端权限和策略（保留结果供人工检查；不要粘贴业务数据到日志）：

   ```sql
   select c.relname, c.relrowsecurity,
          has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
          has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE') as anon_write,
          has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
   order by c.relname;

   select tablename, policyname, roles, cmd, qual, with_check
   from pg_policies where schemaname = 'public'
   order by tablename, policyname;
   ```

   若业务表与预期“后端专用访问”不符，先排查实际权限，不要以保活任务名义调整业务策略。此检查不是完整数据库安全审计（例如视图、函数和列授权仍需按需检查）。
3. 阅读并执行根目录的 [`supabase-project-heartbeat.sql`](../supabase-project-heartbeat.sql) 全部内容。它用事务保证建表、初始化、RLS 与授权一同成功或回滚，不涉及业务表。它是一次性迁移：重复执行会报同名表已存在，不会覆盖原表。
4. 在 SQL Editor 用 anon 身份验证读取及写权限（末尾回滚，无数据写入）：

   ```sql
   begin;
   set local role anon;
   select id, marker from public.project_heartbeat;
   select has_table_privilege(current_user, 'public.project_heartbeat', 'INSERT') as can_insert,
          has_table_privilege(current_user, 'public.project_heartbeat', 'UPDATE') as can_update,
          has_table_privilege(current_user, 'public.project_heartbeat', 'DELETE') as can_delete,
          has_table_privilege(current_user, 'public.project_heartbeat', 'TRUNCATE') as can_truncate;
   rollback;
   ```

   应返回固定一行，四项写权限均为 `false`。确保 Data API 已启用且 `public` 为 exposed schema；不要为此开放业务表或关闭 RLS。若迁移报错，先检查错误原因，不要删除同名表或放宽业务权限。

## 2. 找到 publishable key

在目标项目的 **Settings → API Keys** 或 **Connect** 中找到 Publishable key（`sb_publishable_...`）。如果尚未创建，可在 API Keys 页面创建；不要禁用或轮换业务正在使用的旧密钥。

不要选择 `service_role`、`sb_secret_...`、JWT secret、数据库密码或用户登录密码。工作流会拒绝非 `sb_publishable_...` 格式。publishable key 通过 `apikey` 请求头发送，不放入 `Authorization: Bearer`。

## 3. 设置 GitHub Actions Secrets

在 [仓库](https://github.com/bantymohibogolafa-blip/ai-debate-coach-mvp) 的 **Settings → Secrets and variables → Actions → New repository secret** 设置：

| Secret 名称 | 值 |
| --- | --- |
| `SUPABASE_HEARTBEAT_URL` | `https://qxevikxgvuupxzpufkcz.supabase.co` |
| `SUPABASE_HEARTBEAT_PUBLISHABLE_KEY` | 上一步目标项目的 `sb_publishable_...` |

URL 被工作流严格限制为上述目标项目，避免误连或把 key 发往其他地址。不要把密钥写进 YAML、SQL、PR 或日志。

## 4. 启用及首次测试

1. 将新增文件合入仓库**默认分支（当前 main）**。仅存在于功能分支时，不会开始定时运行。
2. 在仓库 **Actions → Supabase heartbeat → Run workflow**，选择默认分支并运行。如果禁用了 Actions 或该工作流，先启用。
3. 打开运行结果，确认绿色成功及摘要 `SUCCESS HTTP 200; verified one database row`。这表示请求读取并验证了数据库固定记录；空数组、错误内容、只有 HTTP 200 都不算成功。
4. 当前实现每次运行只尝试一个 GET；不重试、不跟随重定向，socket 超时 20 秒，整个 job 上限 2 分钟。响应上限 4096 字节，不记录返回体、凭证或异常原文。记录 UTC 执行时间、成功/失败及耗时，失败退出码为 1；job 超时由 Actions 标为失败。

| 结果 | 处理 |
| --- | --- |
| 配置检查失败 | 核对两个 Secrets 的名称、URL 和 key 类型；不会发送请求 |
| HTTP 401 | 检查 key 是否属于目标项目、已撤销或填写错误 |
| HTTP 403 | 检查新表授权、anon 角色、RLS 和 Data API 配置 |
| HTTP 404 | 检查表是否创建、public schema 是否暴露及 schema cache；不要修改业务表 |
| HTTP 540 | 检查控制台项目状态及 Supabase 故障/限制信息；必要时手动恢复 |
| 其他非 200（包括重定向）或网络/TLS/超时 | 明确失败，核对项目状态及服务状态后再手动测试 |
| HTTP 200 但结果不符 | 检查是否空表、RLS 过滤、记录内容错误或响应格式错误；不会虚报成功 |

## 5. 定时检查与限制

- 两条独立 UTC cron：`17 1 * * *`、`41 13 * * *`，对应北京时间每天 **09:17、21:41**。正常成功运行每天两次数据库读取；手动触发会增加一次。由 GitHub 执行，不依赖个人电脑开机。
- 在 Actions 的工作流历史中检查 `schedule` 运行及绿色状态，点开摘要查看真实执行时间。首次上线应等两个计划时段后核验；GitHub 调度可能延迟或丢弃任务，不保证准点或每日必达。
- 公共仓库连续 **60 天没有仓库活动**，GitHub 可能自动停用定时工作流。不要假定每天运行 Actions 就能重置该期限；停用后需在 Actions 页面重新启用并检查后续计划。
- 此机制仅降低闲置风险，**不承诺 Supabase 一定不会暂停**，也不替代数据库备份，不保持 Render 后端常驻或保证整站可用。运行仍受 GitHub/Supabase 配额和政策限制；不配置任何付费 AI 接口。

## 6. 停止或删除

- 暂停：Actions → Supabase heartbeat → 右上角菜单 → **Disable workflow**。正在执行的任务可单独取消。
- 永久停止：删除 `.github/workflows/supabase-heartbeat.yml` 并合入默认分支；删除两个专用 Secrets。不要删除业务使用的其他 Secrets，也不要撤销共享的 publishable key。
- 可保留空闲的新表；若确认不再需要，在 SQL Editor **单独手动**执行 `drop table public.project_heartbeat;`。不要使用 `CASCADE`，不要删除业务表。此删除不由工作流自动执行。

参考：[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)、[GitHub schedule 事件及限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
