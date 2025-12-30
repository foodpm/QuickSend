# UGREEN NAS（DH4300 Plus / RK3588C ARM64）导入 QuickSend 指南

## 先决条件
- 已在 NAS 安装并启用容器服务（如 Container Manager/Container Station）
- NAS 可访问互联网（用于拉取 `python:3.11-slim` 和 PyPI 依赖）
- 已将项目目录放到 NAS（包含 `docker-compose.yml`、`Dockerfile`、`requirements.txt`、`.env.example`）

## 准备环境变量
1. 复制环境文件：`cp .env.example .env`
2. 修改 `.env`：
   - `HOST_PORT=5000` 外部访问端口（可改为 8080 等）
   - `PORT=5000` 容器内应用端口
   - `DATA_DIR=/data/quicksend/uploads` 或你的共享目录路径
   - `QUICKSEND_NO_BROWSER=1` 禁用自动打开浏览器

> 提示：`docker-compose.yml` 已设置 `platform: linux/arm64`，适配 RK3588C 架构。

## 通过 NAS UI 导入 Compose（推荐）
1. 打开 NAS 容器管理应用，进入“项目/编排/Stack”功能
2. 新建项目，选择“导入 Compose 文件”或“粘贴 Compose 内容”
3. 选择项目目录中的 `docker-compose.yml`
4. 关联 `.env` 文件（如果 UI 提供该选项）
5. 检查参数：
   - 端口映射：`HOST_PORT:PORT`（默认 `5000:5000`）
   - 卷映射：`${DATA_DIR}:/app/uploads`
   - 平台：`linux/arm64`
6. 点击创建/部署，等待构建与启动完成

## 使用命令行（可选）
- 进入项目目录：`cd /path/to/quicksend`
- 启动：`docker compose up -d`
- 查看状态：`docker compose ps`
- 查看日志：`docker compose logs -f`

## 访问方式
- 本机或局域网：`http://<NAS_IP>:<HOST_PORT>`（例如 `http://192.168.5.2:5000`）
- 内置接口获取容器内信息：`GET /api/ip`

## 常见问题
- **局域网地址显示不正确（如显示 172.x.x.x）**：
  - 这是 Docker 容器内部 IP。通常应用会自动检测浏览器地址并修正显示。
  - 如果仍不正确，可在 Compose 文件中添加环境变量 `HOST_IP` 强制指定 NAS IP：
    ```yaml
    environment:
      - HOST_IP=192.168.x.x
    ```
  - 保存后重新部署：`docker compose up -d`

- 无法构建：
  - 容器服务未安装或未运行；安装并启动后重试
  - NAS 无法访问外网；为 NAS 配置代理或离线导入镜像
- 离线镜像导入：
  - 在其他机器构建并导出：
    - `docker build -t quicksend:latest .`
    - `docker save quicksend:latest -o quicksend.tar`
  - 传到 NAS 后导入：`docker load -i quicksend.tar`
  - 将 Compose 中 `build: .` 改为：`image: quicksend:latest`

## 更新与停止
- 更新代码后重启：`docker compose up -d --build`
- 停止并移除：`docker compose down`

## 目录说明
- `DATA_DIR` 为 NAS 上持久化目录，建议使用共享文件夹，确保读写权限
- 容器内上传目录固定为 `/app/uploads`

