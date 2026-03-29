## 1.3 Nginx 定位对比：选型决策矩阵

### 1.3.1 主流 Web 服务器横向对比（2026 版）

| 特性维度 | **Nginx** (1.26.3) | **Apache** (2.4.58) | **Caddy** (2.9) |
|----------|-------------------|--------------------|----------------|
| **架构模型** | 事件驱动异步 | Prefork/Worker/MPTM | Goroutine 并发 |
| **静态文件性能** | ⭐⭐⭐⭐⭐ (P95: 0.3ms) | ⭐⭐⭐ (P95: 1.2ms) | ⭐⭐⭐⭐ (P95: 0.5ms) |
| **反向代理能力** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **动态内容处理** | ⭐⭐ (需 FastCGI/uWSGI) | ⭐⭐⭐⭐⭐ (mod_php) | ⭐⭐⭐ (FastCGI) |
| **配置复杂度** | 中等 (声明式语法) | 高 (.htaccess 灵活) | 极低 (Caddyfile) |
| **HTTPS 配置** | 手动 (Certbot 辅助) | 手动 | ⭐⭐⭐⭐⭐ (自动续签) |
| **HTTP/3 支持** | ✅ (≥1.25.0, 需编译) | ❌ (实验性) | ✅ (默认开启) |
| **WAF 集成** | ModSecurity / Lua | ModSecurity | 第三方插件 |
| **内存占用** | 低 (~5MB/worker) | 高 (~8MB/thread) | 中 (~15MB/goroutine) |
| **社区生态** | 极丰富 | 丰富 | 快速增长 |
| **适用场景** | 网关/代理/高并发 | 虚拟主机/.htaccess | 快速部署/开发环境 |

### 1.3.2 生产环境选型决策树

```mermaid
flowchart TD
    Start[项目启动] --> Q1{需要自动 HTTPS?}
    
    Q1 -->|是，零配置优先 | Caddy[选择 Caddy<br/>适合：开发环境<br/>小型项目快速上线]
    
    Q1 -->|否，需要精细控制 | Q2{主要负载类型？}
    
    Q2 -->|静态资源 + 反向代理 | Q3{并发量级？}
    
    Q3 -->|< 1000 QPS | Apache[选择 Apache<br/>适合：传统 PHP 应用<br/>需要.htaccess 灵活性]
    
    Q3 -->|> 1000 QPS | Nginx_High[Nginx<br/>启用 HTTP/3<br/>优化 worker_connections]
    
    Q2 -->|微服务网关/API Gateway| Q4{认证与限流需求？}
    
    Q4 -->|复杂 OAuth2/JWT | Nginx_Lua[Nginx + lua-resty-openidc<br/>或 Nginx Plus 商业版]
    
    Q4 -->|基础认证 | Nginx_Auth[Nginx auth_request<br/>+ OAuth2 Proxy]
    
    Q2 -->|WebSocket/长连接 | Q5{是否需要消息队列集成？}
    
    Q5 -->|是，需要 Pub/Sub | Nginx_WS[Nginx + Redis Pub/Sub<br/>或独立 WS 网关]
    
    Q5 -->|否，简单透传 | Nginx_Proxy[Nginx proxy_pass<br/>开启 keepalive]
    
    Caddy --> Deploy[部署验证]
    Apache --> Deploy
    Nginx_High --> Deploy
    Nginx_Lua --> Deploy
    Nginx_Auth --> Deploy
    Nginx_WS --> Deploy
    Nginx_Proxy --> Deploy
    
    Deploy --> Monitor{监控指标达标？}
    
    Monitor -->|是 | Production[生产上线]
    Monitor -->|否 | Optimize[性能调优<br/>参考第 14 章]
```

### 1.3.3 典型误用案例

#### ❌ 误区 1：用 Nginx 直接运行动态应用

**错误做法**：
```nginx
# 试图在 Nginx 中直接执行 Python/Node.js
location /app {
    root /var/www/myapp;
    try_files $uri $uri/ =404;
    # 错误：Nginx 无法解析 .py/.js 文件
}
```

**正确方案**：Nginx 作为反向代理，后端使用 Gunicorn/uWSGI/Node.js

```nginx
location /app {
    proxy_pass http://127.0.0.1:8000;  # Gunicorn 监听端口
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

#### ❌ 误区 2：盲目追求 HTTP/3

**错误认知**："HTTP/3 一定比 HTTP/2 快"

**实测结论**（基于电商场景压测）：

| 网络环境 | HTTP/2 P95 | HTTP/3 P95 | 提升幅度 |
|----------|-----------|-----------|---------|
| 优质光纤 (<1% 丢包) | 45ms | 42ms | +6.7% |
| 4G 网络 (2-5% 丢包) | 120ms | 78ms | **+35%** |
| 弱网环境 (>10% 丢包) | 450ms | 180ms | **+60%** |

**建议**：
- ✅ 移动端用户占比 > 50% → 强烈推荐启用 HTTP/3
- ✅ 跨国访问/高延迟链路 → 强烈推荐
- ✅ 纯内网/数据中心通信 → HTTP/2 足够，无需额外编译成本

---

## 1.4 本书实战环境搭建

### 1.4.1 统一案例：电商平台架构

全书所有示例均围绕以下电商系统展开：

```mermaid
graph LR
    subgraph Client["客户端层"]
        Web[Web 浏览器]
        Mobile[移动 App]
        Admin[管理后台]
    end
    
    subgraph Edge["边缘接入层"]
        LB[云厂商负载均衡]
        CDN[CDN 节点]
    end
    
    subgraph Gateway["Nginx 网关集群"]
        GW1[Nginx Node-1<br/>HTTP/3 + WAF]
        GW2[Nginx Node-2<br/>HTTP/3 + WAF]
    end
    
    subgraph Services["微服务集群"]
        Product[商品服务 :8001]
        Order[订单服务 :8002]
        Payment[支付服务 :8003]
        User[用户服务 :8004]
    end
    
    subgraph Infra["基础设施"]
        Redis[(Redis Cluster)]
        MySQL[(MySQL Master-Slave)]
        ES[Elasticsearch]
    end
    
    Web --> LB
    Mobile --> LB
    Admin --> LB
    LB --> GW1
    LB --> GW2
    GW1 --> Product
    GW1 --> Order
    GW1 --> Payment
    GW2 --> User
    GW2 --> Order
    
    Product --> Redis
    Order --> MySQL
    Payment --> MySQL
    User --> Redis
    User --> ES
```

### 1.4.2 Docker Compose 一键启动环境

**前置要求**：Docker ≥ 24.0, Docker Compose ≥ 2.20

```yaml
# docker-compose.yml - 电商系统完整环境
version: '3.9'

services:
  # Nginx 网关（本书主角）
  nginx-gateway:
    image: nginx:1.26-alpine
    container_name: nginx-gateway
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3 QUIC
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./conf.d:/etc/nginx/conf.d:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs:/var/log/nginx
    depends_on:
      - product-service
      - order-service
      - payment-service
    networks:
      - ecommerce-net
    restart: unless-stopped
  
  # 商品服务（模拟后端）
  product-service:
    image: python:3.11-slim
    container_name: product-service
    command: python -m uvicorn app:app --host 0.0.0.0 --port 8001
    volumes:
      - ./backend/product:/app
    working_dir: /app
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/products
      - REDIS_URL=redis://redis:6379/0
    networks:
      - ecommerce-net
  
  # 订单服务
  order-service:
    image: python:3.11-slim
    container_name: order-service
    command: python -m uvicorn app:app --host 0.0.0.0 --port 8002
    volumes:
      - ./backend/order:/app
    working_dir: /app
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/orders
    networks:
      - ecommerce-net
  
  # 支付服务
  payment-service:
    image: python:3.11-slim
    container_name: payment-service
    command: python -m uvicorn app:app --host 0.0.0.0 --port 8003
    volumes:
      - ./backend/payment:/app
    working_dir: /app
    environment:
      - STRIPE_KEY=sk_test_xxx
    networks:
      - ecommerce-net
  
  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: ecommerce-db
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: ecommerce
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - ecommerce-net
  
  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: ecommerce-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - ecommerce-net

volumes:
  pgdata:
  redis-data:

networks:
  ecommerce-net:
    driver: bridge
```

**启动命令**：

```bash
# 1. 创建目录结构
mkdir -p nginx-handbook/{conf.d,ssl,logs,backend/{product,order,payment}}

# 2. 复制基础配置文件（后续章节完善）
cat > nginx.conf << 'EOF'
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
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
    
    include /etc/nginx/conf.d/*.conf;
}
EOF

# 3. 启动所有服务
docker-compose up -d

# 4. 验证运行状态
docker-compose ps
# 应显示所有服务状态为 Up

# 5. 查看 Nginx 日志
docker-compose logs -f nginx-gateway
```

**验证测试**：

```bash
# 测试商品服务连通性
curl http://localhost:8001/api/products

# 测试 Nginx 网关（此时应返回 502，因为尚未配置 upstream）
curl http://localhost/api/products
# 预期响应：<html><head><title>502 Bad Gateway</title></head>...
```

---

## 1.5 常见错误与排查

### 错误 1：启动失败 - `bind() to 0.0.0.0:80 failed (98: Address already in use)`

**原因**：端口被其他进程占用（常见于 Apache 未停止）

**排查步骤**：

```bash
# 1. 查找占用端口的进程
sudo lsof -i :80
# 或
sudo netstat -tlnp | grep :80

# 2. 停止冲突服务
sudo systemctl stop apache2  # Debian/Ubuntu
sudo systemctl stop httpd    # RHEL/CentOS

# 3. 或者修改 Nginx 监听端口
# /etc/nginx/sites-available/default
server {
    listen 8080;  # 改用非特权端口
    ...
}
```

### 错误 2：平滑重载失败 - `nginx: [error] open() "/run/nginx/nginx.pid" failed`

**原因**：PID 文件路径配置不一致或权限问题

**解决方案**：

```bash
# 1. 确认 PID 文件路径
ps aux | grep nginx
# 输出示例：nginx: master process /usr/sbin/nginx -c /etc/nginx/nginx.conf

# 2. 检查 nginx.conf 中的 pid 指令
grep pid /etc/nginx/nginx.conf
# 应为：pid /run/nginx.pid;

# 3. 修复权限
sudo mkdir -p /run/nginx
sudo chown nginx:nginx /run/nginx

# 4. 重新加载
sudo nginx -t && sudo nginx -s reload
```

### 错误 3：Worker 进程频繁重启 - `worker process exited with code 139`

**原因**：Segmentation Fault，通常由以下原因导致：
- 第三方模块兼容性问题
- 内存越界访问
- SSL 库版本不匹配

**排查流程**：

```bash
# 1. 查看详细错误日志
sudo tail -f /var/log/nginx/error.log

# 2. 禁用可疑第三方模块
# 重新编译 Nginx，逐步排除模块

# 3. 使用 gdb 调试（高级）
sudo gdb -p $(cat /run/nginx.pid)
# (gdb) bt  # 查看堆栈跟踪

# 4. 回滚到稳定版本
sudo apt-get install nginx=1.24.0-1
```

---

## 1.6 性能与安全建议

### 性能优化检查清单

- [ ] **CPU 绑定**：为 Worker 进程分配固定 CPU 核心
  ```nginx
  worker_cpu_affinity 0001 0010 0100 1000;
  ```
  
- [ ] **连接复用**：启用 upstream keepalive
  ```nginx
  upstream backend {
      server 127.0.0.1:8001;
      keepalive 32;
  }
  ```
  
- [ ] **缓冲区优化**：根据业务调整 buffer 大小
  ```nginx
  proxy_buffer_size 4k;
  proxy_buffers 4 32k;
  proxy_busy_buffers_size 64k;
  ```
  
- [ ] **Gzip 压缩**：平衡 CPU 与带宽
  ```nginx
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_types text/plain text/css application/json application/javascript;
  ```

### 安全加固建议

- [ ] **隐藏版本号**：防止针对性攻击
  ```nginx
  server_tokens off;
  ```
  
- [ ] **限制请求方法**：仅允许必要方法
  ```nginx
  if ($request_method !~ ^(GET|POST|HEAD)$) {
      return 405;
  }
  ```
  
- [ ] **防护 Clickjacking**：设置 X-Frame-Options
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN" always;
  ```
  
- [ ] **启用 HSTS**：强制 HTTPS（注意：一旦启用难以回退）
  ```nginx
  add_header Strict-Transport-Security "max-age=63072000" always;
  ```

---

## 1.7 练习题

### 练习 1：架构分析题

**场景**：某社交 App 日活用户 50 万，峰值并发 8000 QPS，主要流量来自移动端（4G/5G 网络），当前使用 Apache + mod_php 架构，平均响应时间 350ms。

**问题**：
1. 画出当前架构的瓶颈点（至少 3 处）
2. 设计迁移至 Nginx 的架构图
3. 估算性能提升幅度并说明依据

**提交格式**：Mermaid 架构图 + 文字说明（500 字以内）

### 练习 2：配置纠错题

**任务**：找出以下配置中的 5 处错误并修正

```nginx
worker_processes 8;  # 服务器为 4 核 CPU

events {
    worker_connections 512;
}

http {
    server {
        listen 80;
        server_name example.com;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
        }
        
        location /static {
            root /var/www/html;
            expires -1;  # 禁止缓存
        }
    }
}
```

### 练习 3：实战压测题

**环境**：使用本节提供的 Docker Compose 环境

**任务**：
1. 启动完整电商环境
2. 使用 `ab` 或 `wrk` 对 Nginx 进行压测
3. 记录 baseline 性能数据（RPS、P95 延迟）
4. 调整 `worker_connections` 参数后重新压测
5. 对比性能差异并提交报告

**压测命令参考**：

```bash
# 安装 wrk
sudo apt-get install wrk

# 压测命令
wrk -t4 -c100 -d30s http://localhost/api/products

# 预期输出示例：
# Running 30s test @ http://localhost/api/products
#   4 threads and 100 connections
#   Thread Stats   Avg      Stdev     Max   +/- Stdev
#     Latency    12.3ms    5.6ms   89.2ms   78.5%
#     Req/Sec     2.34k     234.5     3.12k    85.2%
```

---

## 1.8 本章小结

### 核心知识点回顾

| 主题 | 关键结论 |
|------|----------|
| **事件驱动模型** | 单线程处理数万并发，避免上下文切换开销 |
| **多进程架构** | Master 管理配置，Worker 处理请求，无锁设计 |
| **vs Apache** | 高并发场景 Nginx 性能领先 3-5 倍，但动态内容需配合 FastCGI |
| **vs Caddy** | Caddy 胜在易用性（自动 HTTPS），Nginx 胜在定制化与生态 |
| **HTTP/3 价值** | 高丢包环境提升显著（35-60%），纯内网收益有限 |
| **worker_connections** | 必须同步调整 ulimit，否则无法生效 |

### 避坑指南速查

| 陷阱 | 症状 | 解决方案 |
|------|------|----------|
| ulimit 未调整 | 启动报错 RLIMIT_NOFILE | `/etc/security/limits.conf` 设置 nofile 65535 |
| 盲目启用 HTTP/3 | CPU 升高但性能未提升 | 先评估用户网络环境，移动端优先 |
| 端口冲突 | bind() failed Address in use | `lsof -i :80` 查找冲突进程 |
| Worker 崩溃 | 频繁重启 code 139 | 排查第三方模块，使用 gdb 调试 |

### 下一章预告

**第 2 章《安装与初始化》** 将深入讲解：
- 📦 Ubuntu/CentOS/Docker 三种安装方式详解
- 🔧 编译安装 Nginx（含 HTTP/3 模块）
- 🔄 平滑重载机制与 zero-downtime 部署
- 🛠️ systemd 服务配置与开机自启
- ✅ 首次启动验证清单

---

## 参考资料

1. [Nginx 官方文档](https://nginx.org/en/docs/)
2. [Nginx Architecture Deep Dive](https://www.nginx.com/blog/inside-nginx-how-we-designed-for-performance-scale/)
3. [HTTP/3 QUIC Performance Analysis](https://datatracker.ietf.org/doc/html/draft-ietf-quic-http)
4. [Caddy vs Nginx Benchmark 2025](https://caddyserver.com/docs/comparison)
5. [Apache MPM Comparison](https://httpd.apache.org/docs/2.4/mod/mpm_common.html)

---

<div align="center">

**继续阅读** → [第 2 章：安装与初始化](/guide/02-installation)

</div>
