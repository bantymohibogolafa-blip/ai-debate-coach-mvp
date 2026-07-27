# 赛前备战与 Super 林婉

## 功能边界

“赛前备战”是独立产品板块，不属于六类正式训练、日常林婉或训练复盘。Super 林婉复用现有林婉基础人格与用户对林婉的设置，但只读取当前备战任务的上下文，并以分析战场、共同修订战略和安排训练为职责。正式评分、完整训练和训练记录仍由原训练/复盘链路负责。

## 数据与调用链

```text
当前登录用户
  ├─ linwan_user_profile（只读复用现有林婉定义）
  ├─ training_records → 服务端五维能力画像摘要
  └─ prematch_tasks（按 owner/team membership 鉴权）
       ├─ prematch_messages（只按当前 task_id 读取最近消息）
       └─ prematch_training_links（只保存结构化训练结果摘要）
```

一次 Super 林婉调用按以下顺序组装上下文：

1. 现有日常林婉系统消息中的基础人格；
2. Super 林婉固定任务规则与边界；
3. 服务端权威能力画像摘要；没有样本时明确标记数据不足，不生成虚构分数；
4. 当前任务、战略快照、已确认/否定/待验证内容和关联训练摘要；
5. 当前任务最近 24 条消息。

日常 `linwan_messages` 不会被该链路查询。数据库返回的任务消息和训练关联会在送入模型前再次校验 `task_id`，避免错误查询或脏数据造成串线。任务更新使用 `version` 乐观锁，防止不同设备互相覆盖。

## 训练闭环

推荐训练只允许映射到现有六类模式：

- `constructive`
- `attack`
- `defense`
- `free_debate`
- `summary`
- `closing`

跳转时前端在原训练参数之外携带来源任务 ID、训练目标、战略摘要和重点验证问题。它们只作为本轮训练的补充背景，不改变原模式回合、评分或复盘规则。训练记录保存成功后，后端校验用户、空间、团队、辩题和立场均与来源任务一致，再写入结构化关联；完整训练聊天不会注入 Super 林婉上下文。

## 权限

- 个人任务只能由 `owner_user_id` 对应用户访问。
- 团队任务每次访问都重新校验当前有效成员资格。
- 团队创建、编辑、归档和删除仅允许创建者或现有团队管理员；有效成员可以参与任务对话。
- Supabase 使用服务端 service role；浏览器端 anon/authenticated 对三个备战表均无权限。
- 日志只记录匿名指纹、操作类型和错误类别，不记录辩题或完整对话。

## 部署

先在 Supabase SQL Editor 执行：

```text
supabase-prematch-prep.sql
supabase-private-data-rls.sql
```

三个新增表名环境变量均有默认值，只有自定义表名时才需要在线上显式配置：

```env
SUPABASE_PREMATCH_TASKS_TABLE=prematch_tasks
SUPABASE_PREMATCH_MESSAGES_TABLE=prematch_messages
SUPABASE_PREMATCH_TRAINING_LINKS_TABLE=prematch_training_links
```

然后安装、测试、构建并启动：

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd start
```
