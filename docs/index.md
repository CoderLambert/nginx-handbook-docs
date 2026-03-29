---
layout: home
title: Nginx 实战手册
titleTemplate: 从单机配置到生产级网关落地
hero:
  name: Nginx 实战手册
  text: 生产级网关落地指南
  tagline: 面向运维工程师与全栈开发者的实战手册，涵盖反向代理、负载均衡、HTTPS/TLS、限流熔断、Docker/K8s 容器化部署等生产环境核心场景
  image:
    src: /nginx-logo.svg
    alt: Nginx Logo
  actions:
    - theme: brand
      text: 开始阅读
      link: /guide/01-overview
    - theme: alt
      text: 指令速查
      link: /appendix/directives
    - theme: alt
      text: 配置模板
      link: /appendix/templates
features:
  - icon: 🏗️
    title: 架构原理深入解析
    details: 从事件驱动架构到多进程模型，深入理解 Nginx 高性能背后的设计哲学，配备可视化流程图辅助理解
    link: /guide/01-overview
    linkText: 了解架构设计

  - icon: ⚡
    title: 2026 最新特性
    details: 全面覆盖 HTTP/3 QUIC 生产落地、Gateway API 迁移路径、eBPF 内核级监控等前沿技术
    link: /guide/11-http3-quic
    linkText: 查看新特性

  - icon: 🔐
    title: 安全防护体系
    details: WAF 集成、DDoS 防护、OAuth2 认证、OWASP API Top 10 防护，构建全方位安全防护
    link: /guide/12-rate-limit-ddos
    linkText: 学习安全防护

  - icon: 🔄
    title: 反向代理实战
    details: 从基础反向代理到灰度发布、金丝雀发布，提供完整可运行的配置示例和避坑指南
    link: /guide/05-reverse-proxy
    linkText: 查看代理配置

  - icon: 🐳
    title: 云原生部署
    details: Docker Compose 一键部署、Kubernetes Ingress/Gateway API 完整 YAML 模板、Helm Chart 最佳实践
    link: /guide/15-docker-containerization
    linkText: 容器化部署

  - icon: 📊
    title: 可观测性监控
    details: Prometheus + Grafana 可视化、eBPF 网络追踪、链路追踪集成，实时监控每一毫秒
    link: /guide/17-observability-tracing
    linkText: 搭建监控系统

  - icon: 🎯
    title: 性能调优指南
    details: 从内核参数到连接池优化，从缓存策略到 Gzip 压缩，全方位性能优化实战
    link: /guide/14-performance-tuning
    linkText: 性能优化技巧

  - icon: 🛠️
    title: 故障排查清单
    details: 502/503/504 错误诊断树、SSL 证书链排查、容器网络排查流程，基于真实故障案例
    link: /appendix/checklist
    linkText: 排查清单

  - icon: 📦
    title: 配置模板库
    details: 电商网关、OAuth2 Proxy、限流熔断、Docker Compose、Kubernetes YAML 等开箱即用模板
    link: /appendix/templates
    linkText: 获取模板
---

<div class="home-content">

## 📚 学习路径

```mermaid
journey
    title Nginx 学习路线
    section 基础篇 (1-4 章)
      架构原理：(5)
      安装配置：(5)
      核心概念：(5)
      静态资源：(5)
    section 代理篇 (5-9 章)
      反向代理：(5)
      负载均衡：(5)
      高级代理：(5)
      WebSocket：(5)
      gRPC/HTTP2: (5)
    section 安全篇 (10-14 章)
      HTTPS/TLS: (5)
      HTTP/3 QUIC: (5)
      限流熔断：(5)
      访问控制：(5)
      性能调优：(5)
    section 云原生篇 (15-18 章)
      Docker: (5)
      K8s Ingress: (5)
      可观测性：(5)
      GitOps: (5)
```

## 🎯 贯穿案例：电商系统架构

本手册通过一个完整的电商系统案例，串联所有知识点：

```mermaid
flowchart TB
    User[👤 用户请求] --> CLB[☁️ 云负载均衡]
    CLB --> NginxCluster[Nginx 网关集群]

    subgraph Gateway["🚪 网关层"]
        NginxCluster --> Static[📦 静态资源]
        NginxCluster --> API[🔌 API 代理]
        NginxCluster --> WS[📡 WebSocket]
    end

    subgraph Microservices["微服务层"]
        API --> Product[🛒 商品服务 ×3]
        API --> Order[📋 订单服务 ×3]
        API --> Payment[💳 支付服务 ×2]
        WS --> Push[🔔 实时推送]
    end

    subgraph Data["数据层"]
        Product --> Redis[(🔴 Redis)]
        Order --> MySQL[(🐬 MySQL)]
        Payment --> PG[(🐘 PostgreSQL)]
    end
```

## 📖 内容概览

| 篇章 | 章节 | 核心主题 | 预计时长 |
|------|------|----------|----------|
| 📘 第一篇 | 1-4 章 | 架构原理、安装配置、核心概念、静态资源 | 4-6 小时 |
| 📗 第二篇 | 5-9 章 | 反向代理、负载均衡、高级路由、长连接 | 6-8 小时 |
| 📙 第三篇 | 10-14 章 | HTTPS、HTTP/3、限流、安全、性能调优 | 8-10 小时 |
| 📕 第四篇 | 15-18 章 | Docker、K8s、监控、GitOps 持续部署 | 6-8 小时 |
| 📎 附录 | A-C | 指令速查、配置模板、故障排查清单 | 随时查阅 |

## 🔥 2026 版更新亮点

::: info

**HTTP/3 QUIC 生产落地**
- Nginx ≥1.25.0 原生支持配置详解
- 0-RTT 优化与重放攻击防护
- 高丢包环境下性能对比实测

:::

::: tip

**Kubernetes Ingress 重大变更**
- ingress-nginx EOL 预警与迁移路径
- Gateway API 完整配置示例
- Traefik v3 / Cilium 替代方案对比

:::

::: warning

**eBPF 内核级监控**
- Cilium + Hubble 网络可观测性
- <5% CPU 开销的性能优势
- Grafana Dashboard 可视化

:::

## 🚀 快速开始

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-org/nginx-handbook.git
cd nginx-handbook

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

### Docker 一键运行

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

## 📬 加入社区

- 📧 问题反馈：[GitHub Issues](https://github.com/your-org/nginx-handbook/issues)
- 💬 技术讨论：[Discord 频道](https://discord.gg/nginx)
- 🐦 官方 Twitter：[@NginxHandbook](https://twitter.com/nginxhandbook)

---

<div align="center">

**准备好开始了吗？**

[开始阅读第一章](/guide/01-overview){.vp-button .vp-button-brand .vp-button-large}

[查看配置模板](/appendix/templates){.vp-button .vp-button-alt .vp-button-large}

</div>

</div>

<style>
.home-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px;
}

.home-content h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-top: 48px;
  margin-bottom: 24px;
  text-align: center;
}

.home-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 32px;
}

.home-content .mermaid {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;
  margin: 24px 0;
}

.home-content table {
  width: 100%;
  font-size: 0.95rem;
}

.home-content .vp-button-large {
  padding: 12px 32px;
  font-size: 1.1rem;
  margin: 8px;
}

.home-content > div[align="center"] {
  margin-top: 64px;
  padding-top: 48px;
  border-top: 1px solid var(--vp-c-divider);
}

@media (max-width: 768px) {
  .home-content {
    padding: 24px 16px;
  }

  .home-content h2 {
    font-size: 1.5rem;
  }

  .home-content .vp-button-large {
    padding: 10px 24px;
    font-size: 1rem;
    display: block;
    margin: 8px auto;
    max-width: 280px;
  }
}
</style>
