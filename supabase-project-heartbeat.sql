-- 手动在目标项目 qxevikxgvuupxzpufkcz 的 SQL Editor 执行。
-- 独立、一次性迁移；不操作任何业务表。若同名表存在则报错并回滚，
-- 不覆盖未知结构或权限。不要用 DROP TABLE 来处理重复执行错误。
begin;

create table public.project_heartbeat (
  id smallint primary key check (id = 1),
  marker text not null check (marker = 'opendebate-heartbeat-v1')
);

insert into public.project_heartbeat (id, marker)
values (1, 'opendebate-heartbeat-v1');

alter table public.project_heartbeat enable row level security;

-- 清除新表继承的默认授权；不更改 schema 或任何业务表的权限。
-- 所有者/数据库管理员仍能维护此表；普通客户端只有 anon 的 SELECT。
revoke all privileges on table public.project_heartbeat
  from public, anon, authenticated, service_role;
grant select on table public.project_heartbeat to anon;

create policy project_heartbeat_anon_read
  on public.project_heartbeat
  for select
  to anon
  using (id = 1);

notify pgrst, 'reload schema';
commit;
