# 第 2 章 安装与初始化

## 学习目标
- ✅ 掌握 Nginx 在 Linux/Windows/macOS 三大平台的安装方法
- ✅ 理解源码编译安装流程，能够自定义编译 HTTP/3 (QUIC) 模块
- ✅ 熟悉 Nginx 目录结构与核心配置文件
- ✅ 能够独立完成 Nginx 的启动、停止、重载及状态验证
- ✅ 了解 2025-2026 年最新稳定版特性与选型建议

---

## 场景引入

假设你刚接手一台全新的 Ubuntu 24.04 服务器，需要部署 Nginx 作为公司电商网站的前置网关。摆在你面前的选择有：

1. **apt 一键安装** - 快速但版本可能滞后
2. **官方 apt 源安装** - 版本较新，维护方便
3. **源码编译安装** - 完全定制，支持 HTTP/3 等前沿特性
4. **Docker 容器化部署** - 环境隔离，便于迁移

本章将逐一拆解这四种方式，并重点讲解**如何编译支持 HTTP/3 的 Nginx**，这是 2026 年生产环境的必备技能。

---

## 核心原理

### 2.1 Nginx 版本线与 LTS 策略

```mermaid
timeline
    title Nginx 版本演进路线 (2024-2026)
    section 2024 Q1 : Nginx 1.25.0<br/>HTTP/3 正式合并
    section 2024 Q4 : Nginx 1.26.0<br/>LTS 版本发布
    section 2025 Q2 : Nginx 1.27.0<br/>QUIC 性能优化
    section 2025 Q4 : Nginx 1.28.0<br/>下一个 LTS
    section 2026 Q1 : Nginx 1.29.0<br/>HTTP/3 默认启用
```

**关键结论**：
- **生产环境推荐**：Nginx 1.26.x LTS（稳定，长期支持）
- **HTTP/3 需求**：必须 ≥ 1.25.0（QUIC 协议已合并入主线）
- ** OpenSSL 要求**：≥ 3.5.1（支持 TLS 1.3 与 QUIC 加密套件）

### 2.2 安装包 vs 源码编译对比

| 维度 | apt/yum 包管理 | 源码编译 | Docker 容器 |
|------|--------------|---------|-----------|
| **版本新旧** | 滞后 6-12 个月 | 最新 | 可选 |
| **HTTP/3 支持** | ❌ 通常不支持 | ✅ 完全支持 | ✅ 取决于镜像 |
| **自定义模块** | ❌ 固定模块集 | ✅ 任意组合 | ⚠️ 需重构建镜像 |
| **维护成本** | 低 | 高 | 中 |
| **适用场景** | 开发测试 | 高性能生产环境 | CI/CD、微服务 |

---

## 配置实战

### 2.3 方式一：apt 包管理器快速安装（适合开发环境）

```bash
# Ubuntu/Debian 系
sudo apt update
sudo apt install nginx -y

# 验证安装
nginx -v
# 输出：nginx version: nginx/1.24.0 (Ubuntu)

# 查看安装位置
which nginx
# 输出：/usr/sbin/nginx

# 查看配置文件路径
nginx -V 2>&1 | grep "configure path"
# 输出：--conf-path=/etc/nginx/nginx.conf
```

**启动与管理**：
```bash
# 启动 Nginx
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 查看状态
sudo systemctl status nginx

# 平滑重载配置
sudo nginx -t && sudo nginx -s reload

# 优雅停止（处理完当前请求）
sudo nginx -s quit

# 强制停止
sudo nginx -s stop
```

### 2.4 方式二：官方 apt 源安装（推荐生产环境）

```bash
# 1. 安装必要依赖
sudo apt install curl gnupg2 ca-certificates lsb-release -y

# 2. 添加 Nginx 官方 GPG 密钥
curl https://nginx.org/keys/nginx_signing.key | \
  gpg --dearmor | \
  sudo tee /etc/apt/trusted.gpg.d/nginx.gpg > /dev/null

# 3. 添加官方 apt 源（以 Ubuntu 24.04 noble 为例）
echo "deb https://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" | \
  sudo tee /etc/apt/sources.list.d/nginx.list

# 4. 更新并安装
sudo apt update
sudo apt install nginx -y

# 验证版本（通常为最新稳定版）
nginx -v
# 输出：nginx version: nginx/1.26.3
```

### 2.5 方式三：源码编译安装 HTTP/3 版本（核心技能）

这是本章节的重中之重，适用于需要 **HTTP/3 (QUIC)** 支持的生产环境。

#### 步骤 1：安装编译依赖

```bash
sudo apt update
sudo apt install build-essential libssl-dev zlib1g-dev \
  libpcre2-dev libgd-dev libgeoip-dev libxslt1-dev \
  libatomic1-dev git wget -y
```

#### 步骤 2：下载 Nginx 源码与 OpenSSL 3.5.1+

```bash
cd /usr/local/src

# 下载 Nginx 最新稳定版
wget https://nginx.org/download/nginx-1.26.3.tar.gz
tar xzf nginx-1.26.3.tar.gz
cd nginx-1.26.3

# 下载 OpenSSL 3.5.1（支持 QUIC）
wget https://www.openssl.org/source/openssl-3.5.1.tar.gz
tar xzf openssl-3.5.1.tar.gz
```

#### 步骤 3：配置编译参数

```bash
./configure \
  --prefix=/etc/nginx \
  --sbin-path=/usr/sbin/nginx \
  --modules-path=/usr/lib/nginx/modules \
  --conf-path=/etc/nginx/nginx.conf \
  --error-log-path=/var/log/nginx/error.log \
  --http-log-path=/var/log/nginx/access.log \
  --pid-path=/run/nginx.pid \
  --lock-path=/run/nginx.lock \
  --user=www-data \
  --group=www-data \
  --build=Ubuntu \
  --with-http_ssl_module \
  --with-http_v2_module \
  --with-http_v3_module \
  --with-quic=../openssl-3.5.1 \
  --with-http_realip_module \
  --with-http_addition_module \
  --with-http_sub_module \
  --with-http_dav_module \
  --with-http_flv_module \
  --with-http_mp4_module \
  --with-http_gunzip_module \
  --with-http_gzip_static_module \
  --with-http_random_index_module \
  --with-http_auth_request_module \
  --with-http_xslt_module=dynamic \
  --with-http_image_filter_module=dynamic \
  --with-http_geoip_module=dynamic \
  --with-http_perl_module=dynamic \
  --with-stream=dynamic \
  --with-stream_ssl_module \
  --with-stream_realip_module \
  --with-stream_geoip_module=dynamic \
  --with-mail=dynamic \
  --with-mail_ssl_module \
  --add-dynamic-module=/usr/src/nginx-module-headers-more \
  --with-compat \
  --with-file-aio \
  --with-threads \
  --with-ld-opt="-Wl,--as-needed -Wl,-z,relro -Wl,-z,now -pie" \
  --with-cc-opt="-g -O2 -ffile-prefix-map=$(pwd)=. -fstack-protector-strong -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2 -fPIC"
```

**关键参数解析**：
- `--with-http_v3_module`：启用 HTTP/3 支持
- `--with-quic=../openssl-3.5.1`：指定 OpenSSL 源码路径（必须 3.5.1+）
- `--with-http_ssl_module`：HTTPS 必选
- `--with-stream=dynamic`：TCP/UDP 流模块（动态加载）

#### 步骤 4：编译与安装

```bash
# 查看 CPU 核心数，加速编译
nproc

# 并行编译（根据核心数调整 -j 参数）
make -j$(nproc)

# 安装
sudo make install

# 验证安装
nginx -v
# 输出：nginx version: nginx/1.26.3 (Ubuntu)

# 验证 HTTP/3 支持
nginx -V 2>&1 | grep "http_v3"
# 应包含：--with-http_v3_module
```

#### 步骤 5：配置 systemd 服务

```bash
sudo tee /etc/systemd/system/nginx.service > /dev/null << 'EOF'
[Unit]
Description=A high performance web server and a reverse proxy server
Documentation=man:nginx(8)
After=network.target

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStartPre=/usr/sbin/nginx -t -q -g 'daemon on; master_process on;'
ExecStart=/usr/sbin/nginx -g 'daemon on; master_process on;'
ExecStop=/usr/sbin/nginx -g 'quit:wait_for_single_requests=true'
ExecReload=/bin/kill -s HUP $MAINPID
TimeoutStopSec=5
KillMode=mixed
KillSignal=SIGQUIT

[Install]
WantedBy=multi-user.target
EOF

# 重新加载 systemd 配置
sudo systemctl daemon-reload
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.6 方式四：Docker 容器化部署

```bash
# 拉取官方镜像（支持 HTTP/3）
docker pull nginx:1.26-alpine

# 运行容器
docker run -d \
  --name nginx-web \
  -p 80:80 \
  -p 443:443 \
  -p 443:443/udp \
  -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d:ro \
  -v /var/log/nginx:/var/log/nginx \
  --restart unless-stopped \
  nginx:1.26-alpine

# 验证容器状态
docker ps | grep nginx

# 查看日志
docker logs -f nginx-web
```

---

## 完整示例文件

### 2.7 Nginx 目录结构总览

```bash
# 查看完整目录结构
tree -L 3 /etc/nginx/
```

```
/etc/nginx/
├── nginx.conf           # 主配置文件
├── conf.d/              # 附加配置目录（推荐用法）
│   ├── default.conf     # 默认虚拟主机
│   └── example.com.conf # 自定义站点
├── modules-available/   # 可用模块目录
│   ├── mod-http-image-filter.conf
│   └── mod-http-geoip.conf
├── modules-enabled/     # 已启用模块（符号链接）
│   ├── mod-http-image-filter.conf -> ../modules-available/...
│   └── mod-http-geoip.conf -> ../modules-available/...
├── sites-available/     # 站点配置（Debian/Ubuntu 特有）
├── sites-enabled/       # 已启用站点（符号链接）
├── snippets/            # 配置片段（可复用）
│   ├── fastcgi-php.conf
│   └── snakeoil.conf
├── ssl/                 # SSL 证书目录（建议创建）
│   ├── example.com.crt
│   └── example.com.key
└── templates/           # 配置模板（可选）
```

### 2.8 最小可用 nginx.conf 示例

```nginx
# /etc/nginx/nginx.conf
user www-data;
worker_processes auto;  # 自动匹配 CPU 核心数
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;  # 单进程最大连接数
    use epoll;                # Linux 推荐
    multi_accept on;          # 一次接受多个连接
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式定义
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 性能优化基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # 包含额外配置
    include /etc/nginx/conf.d/*.conf;
}
```

---

## 常见错误与排查

### 2.9 安装阶段常见问题

#### 问题 1：端口冲突导致启动失败

```bash
# 错误信息
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)

# 排查步骤
# 1. 查看 80 端口占用
sudo ss -tlnp | grep :80
# 或
sudo netstat -tlnp | grep :80

# 2. 常见冲突源：Apache、另一个 Nginx 实例

# 解决方案
# 方案 A：停止冲突服务
sudo systemctl stop apache2
sudo systemctl disable apache2

# 方案 B：修改 Nginx 监听端口
# 编辑 /etc/nginx/sites-enabled/default
# 将 listen 80; 改为 listen 8080;
```

#### 问题 2：PID 文件不存在

```bash
# 错误信息
nginx: [emerg] open() "/run/nginx.pid" failed (2: No such file or directory)

# 原因：/run 目录重启后被清空

# 解决方案
sudo mkdir -p /run/nginx
sudo chown www-data:www-data /run/nginx
sudo nginx -t && sudo nginx
```

#### 问题 3：编译时找不到 OpenSSL

```bash
# 错误信息
./configure: error: SSL modules require the OpenSSL library.

# 解决方案
# 确保 OpenSSL 源码解压在与 Nginx 同级目录
ls -la /usr/local/src/
# 应包含：nginx-1.26.3/ 和 openssl-3.5.1/

# 检查 configure 参数路径
--with-http_ssl_module \
--with-quic=../openssl-3.5.1  # 相对路径要正确
```

#### 问题 4：HTTP/3 未生效

```bash
# 验证是否编译了 HTTP/3 模块
nginx -V 2>&1 | grep http_v3
# 无输出说明未编译成功

# 检查 OpenSSL 版本
openssl version
# 必须 ≥ OpenSSL 3.5.1

# 检查配置是否启用 QUIC
# nginx.conf 中必须有：
# listen 443 quic reuseport;
# add_header Alt-Svc "h3=\":443\"; ma=86400";
```

---

## 性能与安全建议

### 2.10 安装后立即执行的安全加固

```bash
# 1. 隐藏 Nginx 版本号
# 在 nginx.conf 的 http 块中添加
server_tokens off;

# 2. 限制请求体大小（防止大文件上传攻击）
client_max_body_size 10M;

# 3. 限制请求头大小
large_client_header_buffers 4 16k;

# 4. 限制超时时间（防止慢速连接攻击）
client_body_timeout 10;
client_header_timeout 10;
keepalive_timeout 15;
send_timeout 10;

# 5. 只允许特定 HTTP 方法
# 在 server 或 location 块中
if ($request_method !~ ^(GET|HEAD|POST)$ ) {
    return 405;
}
```

### 2.11 性能基准测试

```bash
# 安装 Apache Bench
sudo apt install apache2-utils -y

# 压测命令（发送 1000 个请求，并发 100）
ab -n 1000 -c 100 http://localhost/

# 关键指标解读
# Requests per second: 每秒请求数（越高越好）
# Time per request: 单个请求耗时（越低越好）
```

---

## 练习题

### 练习 1：编译支持 HTTP/3 的 Nginx
在一台干净的 Ubuntu 24.04 虚拟机上，从源码编译安装 Nginx 1.26.3，要求：
- 启用 HTTP/3 (QUIC) 模块
- 启用 Gzip 静态压缩
- 启用 stream 模块（TCP 负载均衡）
- 验证编译结果并提交 `nginx -V` 输出截图

### 练习 2：多版本共存配置
在同一台服务器上实现：
- 系统包管理的 Nginx 1.24（开发环境用）
- 手动编译的 Nginx 1.26.3（生产环境用）
- 通过 `/usr/sbin/nginx-prod` 访问生产版本
- 两个版本监听不同端口，互不干扰

### 练习 3：Docker 化部署脚本
编写一个 Bash 脚本 `deploy-nginx-docker.sh`，实现：
- 自动检测并安装 Docker
- 拉取最新版 Nginx Alpine 镜像
- 挂载本地配置目录
- 开放 80/443/443 UDP 端口
- 设置容器自动重启
- 输出容器状态验证信息

---

## 本章小结

✅ **核心要点回顾**：
1. **生产环境首选**：官方 apt 源安装（平衡便利性与版本新旧）
2. **HTTP/3 必需**：源码编译 + OpenSSL 3.5.1+
3. **目录结构**：掌握 `/etc/nginx/` 下各子目录用途
4. **服务管理**：熟练使用 `systemctl` 与 `nginx -s reload`
5. **安全基线**：安装后立即隐藏版本号、限制请求大小

🎯 **下一章预告**：
第 3 章将深入 **核心概念**，彻底搞懂 `server`、`location`、`upstream` 的配置逻辑与继承关系，这是写出高效 Nginx 配置的基础。

📚 **参考资源**：
- [Nginx 官方下载页](https://nginx.org/en/download.html)
- [OpenSSL 源码仓库](https://www.openssl.org/source/)
- [Nginx 编译参数文档](https://nginx.org/en/docs/configure.html)
- [HTTP/3 规范 RFC 9114](https://datatracker.ietf.org/doc/html/rfc9114)
