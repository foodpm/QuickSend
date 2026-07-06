# QuickSend Docker 版配置说明（离线 tar + Compose）

本文档面向 NAS（群晖/威联通/绿联等）、Linux 服务器或个人电脑的离线部署场景：通过 GitHub Releases 下载镜像 `.tar`，在本地 `docker load` 导入后，用 `docker compose` 启动。

## 你需要准备的文件

- 镜像包：`quicksend-image-vX.Y.Z.tar`
- 启动文件：`docker-compose.yml`

建议目录结构：

```
quicksend/
  quicksend-image-vX.Y.Z.tar
  docker-compose.yml
  data/
  uploads/
```

## 第一步：导入镜像

在镜像 tar 所在目录执行：

```bash
docker load -i quicksend-image-vX.Y.Z.tar
```

导入成功后会输出类似：

```text
Loaded image: quicksend:local
```

要点：

- `.tar` 文件名不会决定镜像名/标签，真正的镜像名以 `Loaded image:` 这行输出为准。
- 如果你忘了加载出来的名字，也可以用 `docker images` 查看本地镜像列表。

## 第二步：配置 docker-compose.yml

下面是一份推荐的离线部署模板（重点：镜像名、端口、卷挂载）：

```yaml
version: '3.8'
services:
  quicksend:
    image: quicksend:v1.0.11   # 改成 docker load 输出的那个
    container_name: quicksend
    ports:
      - "${HOST_PORT:-8000}:8000"
    environment:
      - HEADLESS=1
      - PORT=8000
      - QUICKSEND_NO_BROWSER=1
    volumes:
      - ./uploads:/app/uploads
      - ./data:/app/QuickSend
    restart: unless-stopped
```

### 1) image（最容易出错）

- `image:` 必须与你 `docker load` 的输出保持一致。
- 如果 `Loaded image:` 不是 `quicksend:local`，请二选一：
  - 直接把 `docker-compose.yml` 的 `image:` 改成 `Loaded image:` 的实际名字
  - 或者给镜像重新打标签后再用 `quicksend:local`：

```bash
docker tag <Loaded image 的实际名字> quicksend:local
```

### 2) ports（宿主机端口 vs 容器端口）

- `"${HOST_PORT:-8000}:8000"`：左边是宿主机端口（可改），右边是容器端口（保持 8000）。
- `environment: PORT=8000`：应用在容器内监听的端口，通常应与容器端口保持一致（也就是 8000）。

如果 8000 被占用，仅修改宿主机端口即可，例如：

```yaml
ports:
  - "8080:8000"
```

### 3) volumes（数据持久化）

推荐挂载：

- `./uploads` → `/app/uploads`：上传文件目录
- `./data` → `/app/QuickSend`：配置/元数据/用户/会话/日志等

说明：

- 当前 Docker 镜像以 `python app.py` 方式运行（非 PyInstaller 打包态），应用数据默认落在 `/app/QuickSend`。
- 你可能会在一些旧配置里看到 `/root/.local/share/QuickSend` 的挂载写法，那对应的是“打包态运行”时的默认路径；与当前 Docker 镜像启动方式不一致，不推荐用于本离线部署模板。

### 4) environment（常用环境变量）

- `HEADLESS=1`：以纯服务模式运行（Docker 场景必需）
- `PORT=8000`：服务监听端口（容器内）
- `HOST_IP` / `LAN_IP`：可选，手动指定对外展示的局域网 IP（在多网卡/VPN 场景可能有帮助）
- `SOFFICE_PATH`：可选，指定 LibreOffice `soffice` 路径（用于 Office 在线预览转换；容器未内置时无需配置）

## 第三步：启动服务

在 `docker-compose.yml` 所在目录执行：

```bash
docker compose up -d
```

如你的环境仍使用旧命令：

```bash
docker-compose up -d
```

## 第四步：访问

浏览器访问：

- `http://<你的设备IP>:8000`
- 若修改了宿主机端口，则对应改成 `http://<你的设备IP>:<HOST_PORT>`

## 升级流程（离线）

1. 下载新版本镜像 tar（例如 `quicksend-image-vX.Y.Z.tar`）
2. 导入覆盖本地镜像：`docker load -i quicksend-image-vX.Y.Z.tar`
3. 重新拉起服务：`docker compose up -d`

如需确保容器使用新镜像重建，可执行：

```bash
docker compose up -d --force-recreate
```

## 常见问题

### 1) 报错：exec format error

镜像架构与设备不匹配（例如在 ARM 机器上导入了 AMD64 镜像）。请确认你下载的是对应设备架构的镜像包。

### 2) 报错：找不到镜像 / pull access denied

`docker-compose.yml` 的 `image:` 与 `docker load` 实际导入的镜像名不一致。以 `Loaded image:` 输出为准修改 `image:`，或使用 `docker tag` 重新打标签。

### 3) 端口占用

修改宿主机端口映射，例如把 `8000:8000` 改成 `8080:8000`。

### 4) Permission denied

在 Linux/NAS 上尝试加 `sudo` 执行相关命令，或检查数据目录（`data/`、`uploads/`）权限。 
