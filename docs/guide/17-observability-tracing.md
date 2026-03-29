# 第 17 章：eBPF 可观测性与分布式追踪实战

## 学习目标

✅ 理解 eBPF 无侵入监控原理与优势  
✅ 掌握 Cilium Hubble 网络可观测性实战  
✅ 实现 OpenTelemetry 全链路追踪集成  
✅ 构建 Jaeger/Tempo 分布式追踪系统  
✅ 掌握 Prometheus + Grafana 性能基线建立  

---

## 17.1 为什么选择 eBPF？

### 17.1.1 监控技术演进历程

```mermaid
timeline
    title 可观测性技术演进
    2000 : 日志文件<br>(手动分析)
    2005 : APM 工具<br>(代码插桩)
    2010 : StatsD/Datadog<br>(指标采集)
    2015 : Prometheus<br>(云原生监控)
    2020 : OpenTelemetry<br>(统一标准)
    2024 : eBPF<br>(无侵入监控) ⭐
```

### 17.1.2 eBPF vs 传统监控对比

| 维度 | 传统插桩 (Agent) | eBPF 无侵入 | 提升幅度 |
|------|-----------------|------------|---------|
| **部署复杂度** | 需修改代码/重启服务 | 零代码改动 | **100%** |
| **性能开销** | 5-15% CPU | <3% CPU | **5 倍** |
| **覆盖率** | 仅应用层 | 内核 + 应用层 | **全栈** |
| **安全性** | Root 权限风险 | 沙箱验证 | **高** |
| **实时性** | 秒级延迟 | 毫秒级 | **10 倍** |

**核心优势**：
> ✅ **无需重启**：动态加载到内核，不影响业务  
> ✅ **全栈可见**：从 TCP 连接到 HTTP 请求全覆盖  
> ✅ **高性能**：JIT 编译为原生指令，开销极低  

---

## 17.2 eBPF 核心概念与架构

### 17.2.1 eBPF 工作原理

```mermaid
graph TB
    subgraph 用户空间
        App[eBPF 程序源码]
        Compiler[BCC/bpftrace 编译器]
        Loader[加载器]
    end
    
    subgraph 内核空间
        Verifier[eBPF 验证器<br>安全检查]
        JIT[JIT 编译器]
        Hook[内核钩子点<br>kprobe/tracepoint]
        Map[eBPF Map<br>共享数据]
    end
    
    subgraph 数据采集
        Net[网络事件<br>TCP/HTTP/DNS]
        Sys[系统调用<br>exec/open/read]
        Perf[perf_event_buffer]
    end
    
    App --> Compiler --> Loader
    Loader --> Verifier
    Verifier --> JIT
    JIT --> Hook
    Hook --> Map
    Map --> Perf --> App
    
    style Verifier fill:#4CAF50,color:white
    style JIT fill:#2196F3,color:white
```

### 17.2.2 Nginx 监控的 eBPF 钩子点

| 钩子类型 | 挂载点 | 监控内容 | 示例工具 |
|---------|--------|---------|---------|
| **kprobe** | `tcp_sendmsg` | TCP 发送数据包 | tcptrace |
| **kprobe** | `tcp_recvmsg` | TCP 接收数据包 | tcptrace |
| **tracepoint** | `syscalls:sys_enter_openat` | 文件打开事件 | opensnoop |
| **uprobe** | `nginx:handle_request` | Nginx 请求处理 | nginx-tracer |
| **XDP** | `xdp_prog` | 包级别过滤 | XDP 防火墙 |

---

## 17.3 Cilium Hubble 网络可观测性

### 17.3.1 Cilium 架构概览

```mermaid
graph TB
    subgraph Kubernetes Cluster
        Pod1[Pod A<br>Nginx]
        Pod2[Pod B<br>Backend]
        Pod3[Pod C<br>Database]
        
        subgraph Cilium Agent
            EBPF[eBPF 程序<br>网络策略<br>负载均衡]
            Hubble[Hubble Observer<br>流量采集]
        end
        
        subgraph 外部系统
            Relay[Hubble Relay<br>聚合服务]
            UI[Hubble UI<br>可视化]
            Metrics[Prometheus<br>指标存储]
        end
    end
    
    Pod1 -->|HTTP 请求 | Pod2
    Pod2 -->|SQL 查询 | Pod3
    
    Pod1 -.-> EBPF
    Pod2 -.-> EBPF
    Pod3 -.-> EBPF
    
    EBPF --> Hubble
    Hubble --> Relay
    Relay --> UI
    Relay --> Metrics
    
    style EBPF fill:#4CAF50,color:white
    style Hubble fill:#FF9800,color:white
```

### 17.3.2 部署 Cilium + Hubble

**步骤 1：安装 Cilium（Helm Chart）**
```yaml
# cilium-values.yaml
cluster:
  name: ecommerce-cluster

ipam:
  mode: kubernetes

kubeProxyReplacement: true

hubble:
  enabled: true
  metrics:
    enable:
      - dns:query
      - icmp
      - tcp:connection
      - http:requests_method_status
      - kafka:produce_fetch
    serviceMonitor:
      enabled: true
  relay:
    enabled: true
    replicas: 2
  ui:
    enabled: true
    replicas: 2

operator:
  replicas: 2
```

**部署命令**：
```bash
# 添加 Helm Chart 仓库
helm repo add cilium https://helm.cilium.io/
helm repo update

# 安装 Cilium
helm install cilium cilium/cilium \
  --namespace kube-system \
  --version 1.15.0 \
  --values cilium-values.yaml

# 验证安装
kubectl get pods -n kube-system -l k8s-app=cilium
kubectl get pods -n kube-system -l k8s-app=hubble-relay
```

### 17.3.3 Hubble CLI 实时监控

**查看服务间流量**：
```bash
# 获取所有 HTTP 请求
hubble observe --follow --protocol http

# 输出示例：
# Mar 29 10:23:45.123  frontend-abc123 -> backend-xyz789   HTTP Request
#   GET http://backend-service:8000/api/users
#   :method: GET
#   :path: /api/users
#   :authority: backend-service
#   user-agent: Mozilla/5.0
#   x-request-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
#   latency: 45.2ms
#   status: 200 OK

# 按命名空间过滤
hubble observe --follow -n default --protocol http

# 查看 DNS 查询
hubble observe --follow --protocol dns

# 查看失败请求（非 2xx）
hubble observe --follow --verdict DROPPED
```

**生成服务依赖图**：
```bash
# 导出流量数据为 Mermaid 格式
hubble observe --last 1000 --output json | \
  jq -r '.source.namespaces[0] + " (" + .source.pod + ") -> " + .destination.namespaces[0] + " (" + .destination.pod + ")"' | \
  sort | uniq -c | sort -rn

# 使用 hubble-ui 可视化
kubectl port-forward -n kube-system svc/hubble-ui 8080:80
# 访问 http://localhost:8080
```

---

### 17.3.4 自定义 eBPF 监控程序

**示例：Nginx 请求延迟追踪**
```c
// nginx-latency.c (BCC 工具)
#include <uapi/linux/ptrace.h>
#include <bcc/helpers.h>

struct event_t {
    u64 timestamp;
    char method[8];
    char uri[256];
    u32 status;
    u64 latency_ns;
};

BPF_PERF_OUTPUT(events);

// uprobe 挂载到 nginx 的 ngx_http_handler 函数
int trace_ngx_http_handler(struct pt_regs *ctx) {
    struct event_t event = {};
    event.timestamp = bpf_ktime_get_ns();
    
    // 提取 HTTP 方法
    bpf_probe_read_str(&event.method, sizeof(event.method),
                       (void *)PT_REGS_PARM1(ctx));
    
    // 提取 URI
    bpf_probe_read_str(&event.uri, sizeof(event.uri),
                       (void *)PT_REGS_PARM2(ctx));
    
    events.perf_submit(ctx, &event, sizeof(event));
    return 0;
}
```

**运行追踪程序**：
```bash
# 编译并运行
sudo python3 nginx-latency.py

# 输出示例：
# TIME       METHOD  URI                    STATUS  LATENCY
# 10:23:45   GET     /api/users             200     45.2ms
# 10:23:46   POST    /api/checkout          201     123.5ms
# 10:23:47   GET     /static/logo.png       200     5.3ms
```

---

## 17.4 OpenTelemetry 全链路追踪

### 17.4.1 OpenTelemetry 架构

```mermaid
graph LR
    subgraph 数据采集层
        App1[Nginx + OTel Module]
        App2[Backend + Auto-Instrumentation]
        App3[Frontend + Web SDK]
    end
    
    subgraph 数据处理层
        Collector[OpenTelemetry Collector<br>接收/处理/导出]
    end
    
    subgraph 数据存储层
        Jaeger[Jaeger<br>分布式追踪]
        Tempo[Tempo<br>轻量级追踪]
        Prometheus[Prometheus<br>指标]
    end
    
    subgraph 可视化层
        Grafana[Grafana<br>Dashboard]
        JaegerUI[Jaeger UI<br>Trace 查询]
    end
    
    App1 --> Collector
    App2 --> Collector
    App3 --> Collector
    
    Collector --> Jaeger
    Collector --> Tempo
    Collector --> Prometheus
    
    Jaeger --> JaegerUI
    Prometheus --> Grafana
    Tempo --> Grafana
    
    style Collector fill:#4CAF50,color:white
    style Jaeger fill:#2196F3,color:white
```

### 17.4.2 Nginx OpenTelemetry 模块集成

**步骤 1：编译带 OTel 模块的 Nginx**
```dockerfile
# Dockerfile
FROM nginx:1.25-alpine AS builder

RUN apk add --no-cache \
    gcc make cmake openssl-dev pcre2-dev zlib-dev \
    libprotobuf-dev protobuf-compiler \
    grpc++-dev

# 克隆 OpenTelemetry 模块
WORKDIR /tmp
RUN git clone https://github.com/open-telemetry/opentelemetry-cpp-contrib.git && \
    cd opentelemetry-cpp-contrib/instrumentation/nginx && \
    mkdir build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j$(nproc) && \
    make install

# 重新编译 Nginx
WORKDIR /tmp/nginx-src
RUN wget https://nginx.org/download/nginx-1.25.3.tar.gz && \
    tar -xzf nginx-1.25.3.tar.gz && \
    cd nginx-1.25.3 && \
    ./configure \
      --add-dynamic-module=/tmp/opentelemetry-cpp-contrib/instrumentation/nginx/src/otel_ngx_module \
      --with-compat && \
    make modules && \
    cp objs/otel_ngx_module.so /etc/nginx/modules/

FROM nginx:1.25-alpine
COPY --from=builder /etc/nginx/modules/otel_ngx_module.so /etc/nginx/modules/
COPY nginx.conf /etc/nginx/nginx.conf
```

**步骤 2：Nginx 配置 OpenTelemetry**
```nginx
# nginx.conf
load_module modules/otel_ngx_module.so;

events {
    worker_connections 1024;
}

http {
    # OpenTelemetry 全局配置
    opentelemetry on;
    opentelemetry_service_name "nginx-ecommerce";
    opentelemetry_exporter_endpoint "http://otel-collector:4317";  # gRPC
    opentelemetry_exporter_interval 5000;  # 5 秒批量发送
    
    # Span 属性配置
    opentelemetry_span_attr request_id $request_id;
    opentelemetry_span_attr user_agent $http_user_agent;
    opentelemetry_span_attr client_ip $remote_addr;
    
    # Trace 采样率（生产环境建议 10-20%）
    opentelemetry_trace_sample_rate 0.1;
    
    server {
        listen 80;
        server_name localhost;
        
        location / {
            # 注入 Trace Context
            opentelemetry_propagate;
            
            proxy_pass http://backend:8000;
            proxy_set_header traceparent $opentelemetry_traceparent;
            proxy_set_header tracestate $opentelemetry_tracestate;
        }
        
        # 健康检查端点（不采样）
        location = /health {
            opentelemetry off;
            return 200 "healthy\n";
        }
    }
}
```

---

### 17.4.3 OpenTelemetry Collector 配置

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  
  # Prometheus 指标抓取
  prometheus:
    config:
      scrape_configs:
        - job_name: 'nginx'
          static_configs:
            - targets: ['nginx:80']
          metrics_path: /metrics
          scrape_interval: 15s

processors:
  batch:
    timeout: 5s
    send_batch_size: 1000
  
  # 尾部采样（减少存储压力）
  tail_sampling:
    policies:
      [
        {
          name: error-policy,
          type: status_code,
          status_code: {status_codes: [ERROR]}
        },
        {
          name: slow-policy,
          type: latency,
          latency: {threshold_ms: 1000}
        },
        {
          name: probabilistic-policy,
          type: probabilistic,
          probabilistic: {sampling_percentage: 10}
        }
      ]
  
  # 资源属性添加
  resource:
    attributes:
      - key: service.namespace
        value: ecommerce-production
        action: insert

exporters:
  # Jaeger (gRPC)
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  
  # Tempo (OTLP)
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true
  
  # Prometheus (通过 pushgateway)
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, tail_sampling, resource]
      exporters: [jaeger, otlp]
    
    metrics:
      receivers: [otlp, prometheus]
      processors: [batch, resource]
      exporters: [prometheusremotewrite]
```

**部署 Collector**：
```bash
kubectl apply -f otel-collector-config.yaml
kubectl apply -f otel-collector-deployment.yaml
```

---

## 17.5 Jaeger 分布式追踪实战

### 17.5.1 部署 Jaeger（生产模式）

```yaml
# jaeger-production.yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: ecommerce-jaeger
  namespace: observability
spec:
  strategy: production
  
  collector:
    image: jaegertracing/jaeger-collector:1.52
    replicas: 3
    resources:
      limits:
        cpu: 2
        memory: 2Gi
    options:
      log-level: info
      collector.queue-size: 2000000
      collector.num-workers: 100
    
  query:
    image: jaegertracing/jaeger-query:1.52
    replicas: 2
    resources:
      limits:
        cpu: 1
        memory: 1Gi
    
  ingester:
    image: jaegertracing/jaeger-ingester:1.52
    replicas: 2
    autoScaleSpec:
      minReplicas: 2
      maxReplicas: 10
    
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
        index-prefix: jaeger-ecommerce
    dependencies:
      enabled: true
      schedule: "55 23 * * *"
    
  sampling:
    options:
      default_strategy:
        type: probabilistic
        param: 0.1  # 10% 采样率
      service_strategies:
        - service: nginx-ecommerce
          type: probabilistic
          param: 0.2  # Nginx 20% 采样
        - service: backend-api
          type: ratelimiting
          param: 100  # 每秒最多 100 traces
```

**部署命令**：
```bash
# 安装 Jaeger Operator
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.52.0/jaeger-operator.yaml

# 创建 Jaeger 实例
kubectl apply -f jaeger-production.yaml

# 验证部署
kubectl get jaegers -n observability
kubectl get pods -n observability -l app.kubernetes.io/name=jaeger
```

### 17.5.2 查看与分析 Trace

**访问 Jaeger UI**：
```bash
kubectl port-forward -n observability svc/ecommerce-jaeger-query 16686:16686
# 访问 http://localhost:16686
```

**典型 Trace 结构**：
```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Nginx as Nginx (Entry Span)
    participant Backend as Backend API
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    
    Client->>Nginx: GET /api/users/123
    Note over Nginx: trace_id: abc123<br>span_id: span-001
    
    Nginx->>Backend: Proxy Request<br>traceparent: abc123-span-001
    Note over Backend: span_id: span-002
    
    Backend->>Redis: GET user:123
    Note over Redis: span_id: span-003
    Redis-->>Backend: HIT (2ms)
    
    Backend->>DB: SELECT * FROM users WHERE id=123
    Note over DB: span_id: span-004
    DB-->>Backend: Result (45ms)
    
    Backend-->>Nginx: Response (200 OK, 52ms)
    Nginx-->>Client: Response (55ms total)
    
    Note over Client,Nginx: Total Duration: 55ms<br>Span Count: 4
```

**Trace 查询技巧**：
```bash
# Jaeger API 查询最近 1 小时的错误 Trace
curl -G http://localhost:16686/api/traces \
  --data-urlencode "service=nginx-ecommerce" \
  --data-urlencode "tags={\"error\":true}" \
  --data-urlencode "minDuration=100ms" \
  --data-urlencode "limit=20"

# 导出 Trace 为 JSON
curl http://localhost:16686/api/traces/abc123def456 | \
  jq '.data[0].spans[] | {operationName, duration, tags}'
```

---

## 17.6 Grafana Tempo 轻量级替代方案

### 17.6.1 Tempo 优势与适用场景

| 特性 | Jaeger | Grafana Tempo | 适用场景 |
|------|--------|---------------|---------|
| **存储后端** | Elasticsearch | S3/GCS/本地文件 | Tempo 更简单 |
| **查询性能** | 中等 | 优秀（列式存储） | Tempo 更快 |
| **资源占用** | 高（多组件） | 低（单二进制） | Tempo 更轻量 |
| **Grafana 集成** | 插件 | 原生集成 | Tempo 体验更好 |
| **学习曲线** | 陡峭 | 平缓 | Tempo 更易用 |

**推荐**：中小规模选 Tempo，大规模选 Jaeger+ES

### 17.6.2 Tempo 快速部署

```yaml
# tempo-values.yaml (Helm)
tempo:
  image:
    repository: grafana/tempo
    tag: 2.3.1
  
  storage:
    trace:
      backend: s3
      s3:
        bucket: ecommerce-traces
        endpoint: s3.amazonaws.com
        region: us-east-1
        access_key_id: ${AWS_ACCESS_KEY_ID}
        secret_access_key: ${AWS_SECRET_ACCESS_KEY}
  
  retention:
    retention: 72h  # 保留 3 天
  
  distributor:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
  
  querier:
    max_concurrent_queries: 20
    query_timeout: 30s
```

**部署命令**：
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install tempo grafana/tempo \
  --namespace observability \
  --create-namespace \
  --values tempo-values.yaml
```

---

## 17.7 Prometheus + Grafana 性能基线

### 17.7.1 Nginx 指标暴露配置

```nginx
# 启用 stub_status 模块
server {
    listen 80;
    server_name localhost;
    
    # 监控端点（内网访问）
    location = /nginx_status {
        stub_status on;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        deny all;
    }
    
    # Prometheus 指标端点（需 nginx-prometheus-exporter）
    location = /metrics {
        stub_status on;
        allow 10.0.0.0/8;
        deny all;
    }
}
```

### 17.7.2 关键性能指标（KPI）

| 指标名称 | PromQL 查询 | 告警阈值 | 说明 |
|---------|------------|---------|------|
| **请求速率** | `rate(nginx_requests_total[1m])` | >10k/s | 每秒请求数 |
| **活跃连接** | `nginx_connections_active` | >50k | 当前连接数 |
| **错误率** | `rate(nginx_requests_total{status=~"5.."}[5m])` | >1% | 5xx 错误比例 |
| **响应延迟 P99** | `histogram_quantile(0.99, rate(nginx_request_duration_seconds_bucket[5m]))` | >500ms | 99% 分位延迟 |
| **上游健康度** | `nginx_upstream_server_state` | state!=1 | 后端服务状态 |
| **缓存命中率** | `rate(nginx_cache_hits_total[5m]) / rate(nginx_cache_requests_total[5m])` | <80% | 缓存效率 |

### 17.7.3 Grafana Dashboard 模板

**导入现成 Dashboard**：
```bash
# Nginx Dashboard (ID: 12708)
curl https://grafana.com/api/dashboards/12708/revisions/1/download | \
  jq '.dashboard' > nginx-dashboard.json

# 通过 Grafana API 导入
curl -X POST http://admin:password@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @nginx-dashboard.json
```

**自定义告警规则**：
```yaml
# alerting-rules.yaml
groups:
  - name: nginx-alerts
    interval: 30s
    rules:
      # 高错误率告警
      - alert: NginxHighErrorRate
        expr: |
          sum(rate(nginx_requests_total{status=~"5.."}[5m])) 
          / sum(rate(nginx_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Nginx 错误率过高 (>1%)"
          description: "当前错误率：{{ $value | humanizePercentage }}"
      
      # 高延迟告警
      - alert: NginxHighLatency
        expr: |
          histogram_quantile(0.99, 
            rate(nginx_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Nginx P99 延迟过高 (>500ms)"
          description: "P99 延迟：{{ $value | humanizeDuration }}"
      
      # 上游服务不可用
      - alert: NginxUpstreamDown
        expr: nginx_upstream_server_state != 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "上游服务器 {{ $labels.upstream }} 不可用"
```

---

## 17.8 常见错误排查

### 17.8.1 eBPF 程序加载失败

**问题**：`Permission denied` 或 `Verifier error`

```bash
# 诊断步骤
# 1. 检查内核版本（需 >= 4.14）
uname -r

# 2. 检查 BPF LSM 是否启用
cat /sys/kernel/security/lsm | grep bpf

# 3. 查看内核日志
dmesg | grep -i bpf

# 解决方案
# 启用 BPF（需要 root）
echo 1 > /proc/sys/kernel/bpf_restrictions
```

### 17.8.2 Trace 上下文丢失

**问题**：后端服务无法接收到 traceparent

```nginx
# 确保 Nginx 正确传递 Trace Context
location /api/ {
    opentelemetry_propagate;
    
    proxy_pass http://backend;
    proxy_set_header traceparent $opentelemetry_traceparent;
    proxy_set_header tracestate $opentelemetry_tracestate;
    
    # 调试：记录 Trace ID 到日志
    log_format trace_format '$request_id $opentelemetry_traceparent';
    access_log /var/log/nginx/trace.log trace_format;
}
```

**后端验证（Python 示例）**：
```python
from opentelemetry import trace

@app.get("/api/users")
def get_users(request: Request):
    tracer = trace.get_tracer(__name__)
    
    # 从请求头提取 Trace Context
    traceparent = request.headers.get("traceparent")
    if traceparent:
        ctx = extract({"traceparent": traceparent})
        span = tracer.start_span("get_users", context=ctx)
    else:
        span = tracer.start_span("get_users")
    
    with span:
        # 业务逻辑
        return {"users": [...]}
```

---

## 17.9 生产检查清单

### ✅ 部署前验证

- [ ] eBPF 内核支持已启用（`CONFIG_BPF_EVENTS=y`）
- [ ] Cilium Hubble 正常运行且能采集流量
- [ ] OpenTelemetry Collector 接收器监听正常
- [ ] Jaeger/Tempo 存储后端可用
- [ ] Prometheus 抓取任务配置正确
- [ ] Grafana 数据源连接成功

### ✅ 安全加固

- [ ] eBPF 程序经过验证器检查（无危险操作）
- [ ] Trace 数据脱敏（移除敏感信息如密码）
- [ ] 采样率合理配置（避免存储爆炸）
- [ ] 访问控制（仅内网访问监控端点）
- [ ] TLS 加密传输（Collector → Backend）

### ✅ 性能优化

- [ ] Batch Processor 批量大小调优（1000-5000 spans）
- [ ] Tail Sampling 策略配置（仅保留错误/慢请求）
- [ ] 存储保留策略（7-30 天滚动删除）
- [ ] 索引优化（Elasticsearch ILM 生命周期）
- [ ] 资源限制（CPU/Memory Quota）

---

## 17.10 本章小结

### ✅ 核心知识点回顾

1. **eBPF 原理**：内核态沙箱程序，无侵入监控系统调用与网络事件
2. **Cilium Hubble**：基于 eBPF 的网络可观测性，自动生成服务依赖图
3. **OpenTelemetry**：统一 Trace/Metrics/Logs 采集标准，厂商中立
4. **Jaeger vs Tempo**：大规模选 Jaeger+ES，轻量级选 Tempo+S3
5. **性能基线**：请求速率、错误率、延迟 P99、缓存命中率

### 📊 技术选型矩阵

| 需求规模 | 推荐方案 | 预计成本 |
|---------|---------|---------|
| **开发测试** | Tempo + Grafana | $50/月 (S3 存储) |
| **中小生产** | Jaeger (内存) | $200/月 |
| **大规模** | Jaeger + ES 集群 | $1000+/月 |
| **企业级** | Commercial APM (Datadog/New Relic) | $5000+/月 |

### 📝 实战练习

**练习 1：编写 eBPF 监控脚本**
```bash
# 任务：追踪 Nginx Worker 进程的系统调用
# 提示：使用 bpftrace 的 syscall:enter_* tracepoint
```

**练习 2：配置慢请求告警**
```yaml
# 要求：P99 延迟 >1s 持续 5 分钟触发告警
# 提示：使用 histogram_quantile + Prometheus AlertManager
```

**练习 3：跨服务 Trace 关联**
```python
# 任务：在 Flask 应用中提取并延续 Nginx 传递的 Trace Context
# 提示：使用 opentelemetry.propagate.extract()
```

---

## 下一章预告

**第 18 章：GitOps 持续部署实战**
- 🚀 GitHub Actions/GitLab CI 自动化流水线
- 🔄 ArgoCD GitOps 部署模式
- 🎯 蓝绿发布 vs 金丝雀发布策略
- 🛡️ 回滚机制与应急预案
