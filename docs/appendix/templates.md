---
title: B. 配置模板库
outline: deep
---

# B. 配置模板库 {#configuration-templates}

本附录收录了生产环境中常用的 Nginx 配置模板，可直接复用或根据实际需求调整。

## B.1 基础网站配置 {#basic-website}

### 静态网站通用配置

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    root /var/www/example.com/html;
    index index.html index.htm;
    
    # 自动跳转 HTTPS（可选）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;
    root /var/www/example.com/html;
    index index.html index.htm;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(css|js|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json 
               application/javascript application/xml+rss application/rss+xml 
               font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    
    # 默认位置
    location / {
        try_files $uri $uri/ =404;
    }
    
    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

## B.2 反向代理配置 {#reverse-proxy}

### 单后端服务代理

```nginx
upstream backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 日志格式
    access_log /var/log/nginx/api_access.log;
    error_log /var/log/nginx/api_error.log;
    
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        # 传递客户端信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # 连接优化
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # 健康检查端点（不记录日志）
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 多服务路径分发

```nginx
# API 服务
upstream api_backend {
    server api-server:3000;
}

# Web 前端服务
upstream web_backend {
    server web-server:3001;
}

# 认证服务
upstream auth_backend {
    server auth-server:3002;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;
    
    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    
    # API 接口
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 认证端点
    location /auth/ {
        proxy_pass http://auth_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 前端应用
    location / {
        proxy_pass http://web_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 静态资源直接由 Nginx 处理
    location /static/ {
        alias /var/www/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## B.3 负载均衡配置 {#load-balancing}

### 加权轮询 + 健康检查

```nginx
upstream ecommerce_api {
    least_conn;
    
    server 192.168.1.10:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:3000 weight=2 max_fails=3 fail_timeout=30s;
    server 192.168.1.12:3000 weight=1 max_fails=3 fail_timeout=30s backup;
    
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.ecommerce.local;
    
    ssl_certificate /etc/nginx/ssl/ecommerce.crt;
    ssl_certificate_key /etc/nginx/ssl/ecommerce.key;
    
    location / {
        proxy_pass http://ecommerce_api;
        proxy_http_version 1.1;
        
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 失败重试
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
    }
}
```

### IP 哈希会话保持

```nginx
upstream sticky_backend {
    ip_hash;
    
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
    server 192.168.1.12:3000;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;
    
    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    
    location / {
        proxy_pass http://sticky_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## B.4 Docker Compose 集成配置 {#docker-compose}

### 电商系统多服务架构（完整版）

```nginx
# nginx.conf
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
    
    # 限流区域定义
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
    
    # 包含子配置文件
    include /etc/nginx/conf.d/*.conf;
}
```

```nginx
# conf.d/ecommerce.conf
# 上游服务定义
upstream frontend_service {
    server frontend:3000;
}

upstream product_service {
    server product-api:3001;
    server product-api-2:3001 backup;
}

upstream order_service {
    server order-api:3002;
}

upstream user_service {
    server user-api:3003;
}

upstream cart_service {
    server cart-api:3004;
}

server {
    listen 80;
    server_name localhost;
    
    # HTTP 跳转 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name localhost;
    
    # SSL 证书（自签名或 Let's Encrypt）
    ssl_certificate /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    
    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 前端应用
    location / {
        proxy_pass http://frontend_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # 商品服务
    location /api/products/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://product_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 订单服务
    location /api/orders/ {
        limit_req zone=api_limit burst=15 nodelay;
        proxy_pass http://order_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 用户服务
    location /api/users/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://user_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 购物车服务
    location /api/cart/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://cart_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: ecommerce-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - frontend
      - product-api
      - order-api
      - user-api
      - cart-api
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  frontend:
    build: ./frontend
    container_name: ecommerce-frontend
    expose:
      - "3000"
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  product-api:
    build: ./services/product
    container_name: ecommerce-product-api
    expose:
      - "3001"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  order-api:
    build: ./services/order
    container_name: ecommerce-order-api
    expose:
      - "3002"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  user-api:
    build: ./services/user
    container_name: ecommerce-user-api
    expose:
      - "3003"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  cart-api:
    build: ./services/cart
    container_name: ecommerce-cart-api
    expose:
      - "3004"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    restart: unless-stopped
    networks:
      - ecommerce-network
  
  postgres:
    image: postgres:15-alpine
    container_name: ecommerce-db
    environment:
      POSTGRES_USER: ecommerce
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: ecommerce
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ecommerce-network
  
  redis:
    image: redis:7-alpine
    container_name: ecommerce-redis
    volumes:
      - redis_data:/data
    networks:
      - ecommerce-network

volumes:
  postgres_data:
  redis_data:

networks:
  ecommerce-network:
    driver: bridge
```

## B.5 K8s Ingress 配置 {#kubernetes-ingress}

### 生产级 Ingress 配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecommerce-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /$1
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/enable-access-log: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - ecommerce.example.com
    secretName: ecommerce-tls
  rules:
  - host: ecommerce.example.com
    http:
      paths:
      - path: /api/products/(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: product-service
            port:
              number: 3001
      - path: /api/orders/(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: order-service
            port:
              number: 3002
      - path: /api/users/(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: user-service
            port:
              number: 3003
      - path: /api/cart/(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: cart-service
            port:
              number: 3004
      - path: /(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
```

## B.6 安全加固配置 {#security-hardening}

### 高安全性配置模板

```nginx
server {
    listen 443 ssl http2;
    server_name secure.example.com;
    
    # 强化的 SSL/TLS 配置
    ssl_certificate /etc/letsencrypt/live/secure.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/secure.example.com/privkey.pem;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # 仅支持 TLS 1.3（最严格）
    ssl_protocols TLSv1.3;
    ssl_ciphers 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
    
    # DH 参数
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;
    
    # 完整的安全响应头
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    
    # 限制请求方法和大小
    if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$) {
        return 405;
    }
    
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;
    
    # 隐藏 Nginx 版本
    server_tokens off;
    
    # 限制 IP 访问（按需启用）
    # allow 192.168.1.0/24;
    # allow 10.0.0.0/8;
    # deny all;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name secure.example.com;
    return 301 https://$server_name$request_uri;
}
```

## B.7 HTTP/3 QUIC 配置 {#http3-quic-config}

### 下一代协议配置

```nginx
server {
    listen 443 ssl http2;
    listen 443 quic;
    server_name http3.example.com;
    
    ssl_certificate /etc/letsencrypt/live/http3.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/http3.example.com/privkey.pem;
    
    # 启用 HTTP/3
    http3 on;
    quic_gso on;
    
    # TLS 1.3 必需
    ssl_protocols TLSv1.3;
    
    # 添加 Alt-Svc 头
    add_header Alt-Svc 'h3=":443"; ma=86400';
    
    # 其他标准配置
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## B.8 性能监控配置 {#monitoring-config}

### 开启状态监控

```nginx
# 在 http 块中添加
http {
    # ... 其他配置 ...
    
    # 状态监控端点
    server {
        listen 8080;
        server_name localhost;
        
        location /nginx_status {
            stub_status on;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            allow 192.168.0.0/16;
            deny all;
        }
        
        location /nginx_metrics {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            deny all;
        }
    }
}
```

### Prometheus 导出器配置

```nginx
# 使用 nginx-prometheus-exporter 时的配置
server {
    listen 9113;
    server_name localhost;
    
    location /metrics {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow prometheus-server;
        deny all;
    }
}
```

---

::: tip 使用说明
1. 所有模板需根据实际环境调整 IP、域名、路径等参数
2. 生产环境部署前务必在测试环境验证
3. SSL 证书建议使用 Let's Encrypt 或其他可信 CA
4. 定期更新 TLS 配置以符合最新安全标准
:::
