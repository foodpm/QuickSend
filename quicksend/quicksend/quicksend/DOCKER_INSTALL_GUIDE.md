# QuickSend Docker 离线安装教程

本教程适用于已安装 Docker 的 NAS（群晖/威联通/绿联等）、Linux 服务器或个人电脑。

---

## 第一步：准备文件

请确保你已经获取了以下两个文件：
1. **镜像包文件**（二选一）：
   - `quicksend_arm64.tar`：适用于 NAS、树莓派、Mac (M1/M2)
   - `quicksend_amd64.tar`：适用于 普通PC、服务器 (Intel/AMD)
2. **启动配置文件**：`docker-compose.yml`

---

## 第二步：上传文件

1. 在你的机器上创建一个文件夹，例如 `quicksend`。
2. 将 **镜像包文件** 和 `docker-compose.yml` 上传到该文件夹中。

---

## 第三步：导入镜像

打开终端（SSH）进入该文件夹，根据你的系统架构执行以下命令之一：

**如果是 NAS / 树莓派 (ARM64)：**
```bash
docker load -i quicksend_arm64.tar
```

**如果是 PC / 服务器 (AMD64)：**
```bash
docker load -i quicksend_amd64.tar
```

> *成功提示：看到 `Loaded image: quicksend:arm64` (或 amd64) 即表示导入成功。*

---

## 第四步：修改配置（可选）

打开 `docker-compose.yml` 文件，确认以下两点：
1. **镜像名称**：
   如果你导入的是 arm64 包，确保 image 写的是 `quicksend:arm64`。
   如果你导入的是 amd64 包，确保 image 写的是 `quicksend:amd64`。
   *(如果不一致，请手动修改 yml 文件里的 image 字段)*

2. **端口**：
   默认端口为 `8000`。如果该端口被占用，请修改 `ports` 部分，例如 `"8080:8000"`。

---

## 第五步：启动服务

在终端中执行：

```bash
docker-compose up -d
```
*(如果提示找不到命令，请尝试 `docker compose up -d`)*

---

## 第六步：访问使用

打开浏览器访问：
`http://你的IP地址:8000`

---

## 常见问题

**Q: 启动失败，提示 "exec format error"？**
A: 你导入的镜像架构和你的机器不匹配。
- NAS 请用 `arm64` 包。
- 普通电脑/服务器 请用 `amd64` 包。

**Q: 提示 "Permission denied"？**
A: 命令前加上 `sudo` 再试一次。
