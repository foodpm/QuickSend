# Supabase 自动部署（GitHub Actions）

本仓库使用 `supabase/migrations` 存放数据库迁移文件，并通过 GitHub Actions 自动推送到 Supabase。

## 需要创建的 GitHub Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret 新增：

- `SUPABASE_ACCESS_TOKEN`：Supabase 账号的 Access Token（Dashboard → Account → Access Tokens 创建）
- `SUPABASE_PROJECT_REF`：Supabase 项目的 Project Ref（项目 Settings 页面可找到）
- `SUPABASE_DB_PASSWORD`：该 Supabase 项目的数据库密码（Database Settings 可重置）

工作流文件： [.github/workflows/supabase-deploy.yml](file:///Users/xiaozhuzidepingguo/Desktop/%E4%BB%8A%E6%97%A5%E6%9C%80%E4%BD%B3/%E4%B8%AA%E4%BA%BA/quick/.github/workflows/supabase-deploy.yml)

## 开源仓库的安全说明

- 不要把 `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、service role key 写进代码或提交到仓库。
- anon key 会在客户端侧可见（被打包进应用或由运行环境提供），它不是“保密凭证”。真正的保护来自 RLS：只允许插入，禁止读取/修改。

## 迁移内容

- 新建 schema：`quicksend_analytics`
- 新建表：`quicksend_analytics.events_raw_v1`（仅用于埋点写入）
- 启用 RLS，仅允许 `anon/authenticated` 进行 `INSERT`

