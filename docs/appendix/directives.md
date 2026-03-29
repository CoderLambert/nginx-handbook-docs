---
title: A. 指令速查表
outline: deep
---

# A. 指令速查表 {#directives-reference}

本附录收录了 Nginx 核心配置指令的快速参考，按功能分类整理。

## A.1 基础指令 {#basic-directives}

### 服务器块指令

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `listen` | `listen <address>:<port>` | `80` | 监听地址和端口 |
| `server_name` | `server_name <name>` | `""` | 虚拟主机域名 |
| `root` | `root <path>` | `/usr/share/nginx/html` | 网站根目录 |
| `index` | `index <file>` | `index.html` | 默认首页文件 |
| `alias` | `alias <path>` | - | 路径别名映射 |
| `try_files` | `try_files <uri> ... <fallback>` | - | 文件存在性检查 |

### 位置匹配指令

```nginx
location = /exact { }      # 精确匹配
location /prefix { }       # 前缀匹配
location ~ \.php$ { }      # 正则匹配（区分大小写）
location ~* \.php$ { }     # 正则匹配（不区分大小写）
location ^~ /static { }    # 优先前缀匹配
```

## A.2 反向代理指令 {#proxy-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `proxy_pass` | `proxy_pass <url>` | - | 代理目标地址 |
| `proxy_set_header` | `proxy_set_header <field> <value>` | - | 设置请求头 |
| `proxy_connect_timeout` | `proxy_connect_timeout <time>` | `60s` | 连接超时时间 |
| `proxy_read_timeout` | `proxy_read_timeout <time>` | `60s` | 读取超时时间 |
| `proxy_send_timeout` | `proxy_send_timeout <time>` | `60s` | 发送超时时间 |
| `proxy_buffering` | `proxy_buffering on\|off` | `on` | 是否启用缓冲 |
| `proxy_cache` | `proxy_cache <zone>` | - | 缓存区域名称 |
| `proxy_cache_valid` | `proxy_cache_valid <code> <time>` | - | 缓存有效期 |

### 常用代理配置模板

```nginx
location /api/ {
    proxy_pass http://backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 30s;
    proxy_read_timeout 60s;
    proxy_send_timeout 30s;
}
```

## A.3 负载均衡指令 {#upstream-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `upstream` | `upstream <name> { }` | - | 定义上游服务器组 |
| `server` | `server <address> [params]` | - | 定义后端服务器 |
| `weight` | `weight=<num>` | `1` | 权重值 |
| `max_fails` | `max_fails=<num>` | `1` | 失败阈值 |
| `fail_timeout` | `fail_timeout=<time>` | `10s` | 失败检测周期 |
| `backup` | `backup` | - | 备份服务器标记 |
| `least_conn` | `least_conn` | - | 最少连接算法 |
| `ip_hash` | `ip_hash` | - | IP 哈希算法 |

### 负载均衡策略示例

```nginx
# 轮询（默认）
upstream backend {
    server backend1:3000;
    server backend2:3000;
}

# 加权轮询
upstream weighted {
    server backend1:3000 weight=3;
    server backend2:3000 weight=1;
}

# 最少连接
upstream least_conn {
    least_conn;
    server backend1:3000;
    server backend2:3000;
}

# IP 哈希
upstream ip_hash {
    ip_hash;
    server backend1:3000;
    server backend2:3000;
}
```

## A.4 HTTPS/TLS 指令 {#https-tls-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `ssl_certificate` | `ssl_certificate <file>` | - | SSL 证书文件 |
| `ssl_certificate_key` | `ssl_certificate_key <file>` | - | SSL 私钥文件 |
| `ssl_protocols` | `ssl_protocols <versions>` | `TLSv1 TLSv1.1 TLSv1.2` | 支持的协议版本 |
| `ssl_ciphers` | `ssl_ciphers <ciphers>` | `DEFAULT` | 加密套件 |
| `ssl_prefer_server_ciphers` | `ssl_prefer_server_ciphers on\|off` | `off` | 优先使用服务器套件 |
| `ssl_session_cache` | `ssl_session_cache <type>` | `none` | 会话缓存类型 |
| `ssl_session_timeout` | `ssl_session_timeout <time>` | `1h` | 会话缓存有效期 |
| `ssl_stapling` | `ssl_stapling on\|off` | `off` | OCSP Stapling |
| `ssl_stapling_verify` | `ssl_stapling_verify on\|off` | `off` | OCSP 响应验证 |

### 现代 TLS 配置推荐

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # 仅支持 TLS 1.2 和 1.3
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 现代加密套件
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    # 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}
```

## A.5 限流与安全指令 {#rate-limit-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `limit_req_zone` | `limit_req_zone <key> zone=<name>:<size> rate=<rate>` | - | 定义限流区域 |
| `limit_req` | `limit_req zone=<name> [burst=<n>]` | - | 应用限流规则 |
| `limit_conn_zone` | `limit_conn_zone <key> zone=<name>:<size>` | - | 定义连接数限制区域 |
| `limit_conn` | `limit_conn zone=<name> <number>` | - | 应用连接数限制 |
| `allow` | `allow <address>` | - | 允许访问的 IP |
| `deny` | `deny <address>` | - | 拒绝访问的 IP |
| `auth_basic` | `auth_basic <realm>` | - | 启用基本认证 |
| `auth_basic_user_file` | `auth_basic_user_file <file>` | - | 认证用户文件 |

### 限流配置示例

```nginx
# 定义限流区域（基于 IP，每秒 10 个请求）
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    
    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_conn conn_limit 10;
        }
    }
}
```

## A.6 性能优化指令 {#performance-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `worker_processes` | `worker_processes <num>\|auto` | `1` | 工作进程数 |
| `worker_connections` | `worker_connections <number>` | `1024` | 每个进程最大连接数 |
| `multi_accept` | `multi_accept on\|off` | `off` | 一次性接受所有连接 |
| `sendfile` | `sendfile on\|off` | `off` | 启用零拷贝传输 |
| `tcp_nopush` | `tcp_nopush on\|off` | `off` | TCP 包推送优化 |
| `tcp_nodelay` | `tcp_nodelay on\|off` | `off` | 禁用 Nagle 算法 |
| `keepalive_timeout` | `keepalive_timeout <time>` | `75s` | 长连接超时 |
| `gzip` | `gzip on\|off` | `off` | 启用 Gzip 压缩 |
| `gzip_types` | `gzip_types <types>` | `text/html` | 压缩 MIME 类型 |
| `open_file_cache` | `open_file_cache <max>[inactive=<time>]` | - | 文件描述符缓存 |

### 高性能配置模板

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 65535;
    multi_accept on;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
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
               application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    
    # 文件缓存
    open_file_cache max=65536 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

## A.7 HTTP/3 QUIC 指令 {#http3-quic-directives}

| 指令 | 语法 | 默认值 | 说明 |
|------|------|--------|------|
| `listen` (QUIC) | `listen <port> quic` | - | 启用 QUIC 监听 |
| `http3` | `http3 on\|off` | `off` | 启用 HTTP/3 协议 |
| `quic_gso` | `quic_gso on\|off` | `on` | 启用 UDP GSO |
| `ssl_early_data` | `ssl_early_data on\|off` | `off` | 0-RTT 早期数据 |

### HTTP/3 配置示例

```nginx
server {
    listen 443 ssl http2;
    listen 443 quic;
    
    http3 on;
    quic_gso on;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # 添加 Alt-Svc 响应头
    add_header Alt-Svc 'h3=":443"; ma=86400';
}
```

## A.8 Docker 与 K8s 相关指令 {#container-directives}

### Docker Compose 中的 Nginx 配置要点

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./conf.d:/etc/nginx/conf.d:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs:/var/log/nginx
    restart: unless-stopped
```

### K8s Ingress 注解参考

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /$1
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api/(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: api-service
            port:
              number: 3000
```

## A.9 完整指令字母序索引 {#alphabetical-index}

以下是按字母顺序排列的核心指令索引（部分）：

**A**: `access_log`, `add_header`, `alias`, `allow`, `auth_basic`  
**B**: `backlog`, `buffer_size`  
**C**: `client_body_buffer_size`, `client_max_body_size`, `client_to_client_timeout`  
**D**: `daemon`, `default_type`, `deny`  
**E**: `error_log`, `error_page`  
**F**: `fastcgi_pass`, `fastcgi_param`  
**G**: `geo`, `geoip_country`, `gzip`, `gzip_types`  
**H**: `http2`, `http3`  
**I**: `if`, `include`, `index`, `ip_hash`  
**K**: `keepalive`, `keepalive_requests`, `keepalive_timeout`  
**L**: `limit_conn`, `limit_rate`, `limit_req`, `listen`, `location`, `log_format`  
**M**: `map`, `merge_slashes`, `multi_accept`  
**N**: `open_file_cache`  
**P**: `proxy_pass`, `proxy_set_header`, `proxy_cache`  
**Q**: `quic_gso`  
**R**: `rate_limit`, `read_ahead`, `real_ip_header`, `return`, `rewrite`  
**S**: `sendfile`, `send_timeout`, `server`, `server_name`, `ssl_*`  
**T**: `tcp_nodelay`, `tcp_nopush`, `try_files`  
**U**: `upstream`, `use`  
**V**: `variables_hash_max_size`  
**W**: `worker_connections`, `worker_processes`  

---

::: tip 提示
- 本速查表仅包含常用指令，完整指令列表请参考 [官方文档](https://nginx.org/en/docs/)
- 生产环境使用前务必在测试环境充分验证
- 指令可用性取决于 Nginx 版本和编译模块
:::
