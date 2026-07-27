# Super 林婉与团队备战审查结论

审查基线：`8b88852 feat: add Super Lin Wan pre-match preparation`

## 现有实现定位

- 前端入口与路由状态：`client/src/App.jsx` 的 `preparation` 功能页签；页面组件为
  `client/src/components/SuperLinWanPrep.jsx`，样式位于 `client/src/styles.css`。
- 后端入口：`server/src/index.js` 的 `/api/prematch/*` 路由、数据访问及权限检查。
- Super 林婉任务 Prompt 与结构化战略状态：`server/src/superLinwan.js`；训练 Prompt
  对备战上下文的承接位于 `server/src/prompts.js`。
- 数据结构：`supabase-prematch-prep.sql` 定义 `prematch_tasks`、
  `prematch_messages`、`prematch_training_links`。
- 个人/团队模式当前通过 `space_type` 与 `team_code` 区分。个人任务满足
  `space_type = 'personal' and team_code is null`；错误的团队 Super 林婉数据满足
  `space_type = 'team' and team_code is not null`。
- 现有团队任务系统位于 `team_tasks` 与 `team_task_assignments`，迁移定义见
  `supabase-team-spaces.sql`、`supabase-team-task-4.sql`，API 位于
  `server/src/index.js` 的 `/api/team/tasks/*`。
- 团队角色复用 `isTeamOwnerRole`、`isTeamManagerRole`、
  `requireActiveMembership`、`requireTeamManager`。队长角色兼容
  `owner/captain/leader`，管理员为 `admin`。

## 能力盘点

- 已支持指定成员和多成员任务，负责人关系存储在 `team_task_assignments`。
- 已有成员级 `assigned/completed` 状态及 `completed_at`，但旧逻辑由训练记录次数
  自动同步，缺少手动完成/撤销 API、`completed_by` 与完成说明。
- 队长/管理员可创建、结束任务，但缺少编辑、删除及代成员完成接口。
- 训练模式、辩题、立场、难度和风格已在 `team_tasks` 中，可直接复用训练入口。
- 现有数据库没有独立的“当前比赛”、团队备战公告，也没有任务分类、任务来源和
  比赛外键。`prematch_tasks` 中的比赛字段属于 Super 林婉私人/错误团队任务，
  不适合作为团队看板数据源。

## 最小改动设计

- 保留 `prematch_tasks` 作为纯个人 Super 林婉数据，并在 API 与数据库约束两层禁止
  团队范围。
- 新增 `team_matches`，每队通过部分唯一索引最多一个 `active` 比赛；公告作为比赛
  下的多行纯文本。
- 原位扩展 `team_tasks`：增加 `match_id`、`task_category`、`task_source`。旧任务
  回填为 `daily_training/training`，不改变原团队训练流程。
- 原位扩展 `team_task_assignments`：增加 `completed_by`、`completion_note`、
  `completed_by_role`、`training_record_id`、`updated_at`，继续使用关系表保存多人
  独立状态；角色快照可稳定区分成员本人、队长和管理员代完成。
- `current_match` 任务只由成员或管理者显式确认完成，训练记录不会自动将它完成；
  旧 `daily_training` 任务继续使用原有训练次数进度。

## 精准清理范围

只清理 `prematch_tasks.space_type = 'team' and team_code is not null` 的任务 ID，以及
通过这些确定任务 ID 关联的 `prematch_messages`、`prematch_training_links`。战略状态
位于这些任务行，推荐/训练结果位于关联行，随目标行一并删除。不会用标题、名称或
模糊文本匹配，也不会触及任何 `space_type = 'personal'` 数据。

2026-07-27 对当前 `server/.env` 指向的 Supabase 项目进行了只读计数：待清理团队任务
1 条、关联消息 1 条、训练关联 0 条；同次审查确认个人任务 1 条、个人消息 3 条。
这些数字是迁移执行前统计，只有 SQL 事务成功提交后才能记为实际删除数量。

## 兼容风险

- 数据库迁移必须先于新版服务部署，否则新增列/表尚不存在。
- 数据清理不可由结构回滚脚本恢复；执行前必须做数据库备份。迁移事务保证失败时
  整体回滚，并通过 `RAISE NOTICE` 输出清理前后数量。
- 项目采用自有 JWT 而非 Supabase Auth JWT，无法安全使用 `auth.uid()` 编写用户级
  RLS。数据库继续对 `anon/authenticated` 全拒绝，所有业务权限在自有 JWT 后端逐次
  校验，不能仅依赖前端按钮。
