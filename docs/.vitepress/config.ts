import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Nginx 实战手册',
  description: '从单机配置到生产级网关落地（2026 版）',
  cleanUrls: true,
  ignoreDeadLinks: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'zh-CN' }],
  ],
  
  themeConfig: {
    logo: '/nginx-logo.svg',
    
    // 顶部导航
    nav: [
      { text: '首页', link: '/' },
      { text: '基础篇 (1-4)', link: '/guide/01-overview' },
      { text: '反向代理篇 (5-9)', link: '/guide/05-reverse-proxy' },
      { text: '安全与性能 (10-14)', link: '/guide/10-https-tls' },
      { text: '云原生篇 (15-18)', link: '/guide/15-docker-containerization' },
      { text: '附录', link: '/appendix/directives' },
    ],
    
    // 侧边栏配置
    sidebar: {
      '/guide/': [
        {
          text: '📚 第一篇：基础篇',
          collapsed: false,
          items: [
            { text: '1. 概述与架构设计', link: '/guide/01-overview' },
            { text: '2. 安装与初始化', link: '/guide/02-installation' },
            { text: '3. 核心概念', link: '/guide/03-core-concepts' },
            { text: '4. 静态资源服务', link: '/guide/04-static-assets' },
          ],
        },
        {
          text: '🔄 第二篇：反向代理与负载均衡',
          collapsed: false,
          items: [
            { text: '5. 反向代理基石', link: '/guide/05-reverse-proxy' },
            { text: '6. 负载均衡策略', link: '/guide/06-load-balancing' },
            { text: '7. 高级代理配置', link: '/guide/07-advanced-proxy' },
            { text: '8. 长连接支持', link: '/guide/08-websocket-long-connection' },
            { text: '9. gRPC 与 HTTP/2', link: '/guide/09-grpc-http2' },
          ],
        },
        {
          text: '🔐 第三篇：安全与性能',
          collapsed: false,
          items: [
            { text: '10. HTTPS 与现代 TLS', link: '/guide/10-https-tls' },
            { text: '11. HTTP/3 QUIC', link: '/guide/11-http3-quic' },
            { text: '12. 限流与 DDoS 防御', link: '/guide/12-rate-limit-ddos' },
            { text: '13. 访问控制与安全', link: '/guide/13-access-control' },
            { text: '14. 性能调优实战', link: '/guide/14-performance-tuning' },
          ],
        },
        {
          text: '☁️ 第四篇：云原生与高级主题',
          collapsed: false,
          items: [
            { text: '15. Docker 容器化', link: '/guide/15-docker-containerization' },
            { text: '16. K8s Ingress Gateway', link: '/guide/16-k8s-ingress-gateway' },
            { text: '17. 可观测性与追踪', link: '/guide/17-observability-tracing' },
            { text: '18. GitOps 持续部署', link: '/guide/18-gitops-deployment' },
          ],
        },
      ],
      '/appendix/': [
        {
          text: '📎 附录',
          collapsed: false,
          items: [
            { text: 'A. 指令速查表', link: '/appendix/directives' },
            { text: 'B. 配置模板库', link: '/appendix/templates' },
            { text: 'C. 故障排查清单', link: '/appendix/checklist' },
          ],
        },
      ],
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nginx/nginx' },
      { icon: 'discord', link: 'https://discord.gg/nginx' },
    ],
    
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Nginx Handbook Team',
    },
    
    // 搜索配置
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                },
              },
            },
          },
        },
      },
    },
  },
  
  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true,
    },
  },
  
  vite: {
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
    },
  },
})
