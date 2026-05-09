# VLESS Panel

**轻量、全能的多节点代理管理面板** — 一站式完成用户管理、节点部署、订阅分发、流量统计与自动化运维。

Node.js + Express + SQLite，开箱即用，无需 MySQL/Redis，单机即可承载数百节点。

---

## 为什么选择 VLESS Panel

| | VLESS Panel | 传统方案 |
|---|---|---|
| 部署复杂度 | SQLite 零配置，npm install 即用 | MySQL + Redis + 多服务编排 |
| 协议支持 | VLESS + Shadowsocks 双协议同机部署 | 通常单协议 |
| 节点管控 | WebSocket Agent 实时通道 + SSH 后备 | 仅 SSH 或 API 轮询 |
| 云平台联动 | AWS EC2/Lightsail 一键创建、换 IP、自动被墙换 IP | 手动操作 |
| 订阅分发 | 自动识别客户端，v2ray/Clash/sing-box 全格式 | 需额外订阅转换 |
| 反滥用 | UA 白名单 + Token 行为风控 + IP 频率限制 | 基本无 |

---

## 核心功能

### 用户体系
- 用户名 + 密码登录（首次访问自动引导创建第一个管理员）
- 用户分级（青铜/白银/管理员）、到期管理、流量配额
- 注册白名单 & 节点访问白名单

### 多协议节点管理
- 支持 VLESS（Reality）、Shadowsocks、双协议同机部署
- IPv4 + IPv6 双栈，一台机器两个节点
- 节点分组/标签、等级门槛控制
- 配置通过 Agent 实时下发，失败自动回退 SSH

### WebSocket Agent 通道
- 每台节点运行轻量 Agent，WebSocket 长连接到面板
- 实时上报：Xray 状态、中国连通性、IPv6 可达性、流量数据、系统负载
- 远程命令执行、批量 Agent 自更新
- 节点异常防抖：连续失败达阈值才判定离线，避免误报
- 被墙自动检测 + AWS 节点自动换 IP

### 智能订阅分发
- 主订阅 `/sub/:token`（VLESS）+ IPv6 订阅 `/sub6/:token`（SS）
- 自动识别客户端 User-Agent，输出对应格式：
  - **v2ray** base64（V2RayN/NG 等）
  - **Clash** YAML（Clash/Mihomo/Stash 等）
  - **sing-box** JSON（SFI/SFA 等）
- 支持 `?type=clash|singbox|v2ray` 强制指定格式
- 订阅二维码一键展示
- 响应头包含 `Subscription-Userinfo`（剩余流量/到期时间）

### 订阅反滥用
- 三级模式：`off`（关闭）/ `observe`（观察记录）/ `enforce`（强制拦截）
- UA 白名单覆盖 27+ 主流客户端
- Token 级行为分析：频率异常、多 IP/UA 切换自动封禁
- 异常行为触发 Telegram 告警

### 流量统计
- 实时在线人数（滑动窗口，2 分钟精度）
- 每用户/每节点流量统计，日聚合 + 趋势图表
- 用户流量配额（单用户 + 全局默认值）
- 流量超标检测 + 自动通知

### AWS 云平台联动
- 多 AWS 账号管理（AK/SK 加密存储）
- EC2 / Lightsail 实例：列表、启停、终止、换 IP
- 一键"创建实例 → 部署节点 → 安装 Agent"全自动流程
- 节点绑定实例，被墙自动换 IP
- 支持 SOCKS5 出口代理（解决国内访问 AWS API 问题）

### 运维与安全
- 完整审计日志，所有关键操作可追溯
- Telegram 事件通知（上线/掉线/被墙/流量超标/换 IP）
- 数据库自动备份 + 一键恢复（含完整性校验）
- CSRF 防护、Helmet 安全头、HSTS
- 会话持久化（重启不丢登录状态）
- 可信反代边界控制

---

## 技术架构

```
用户浏览器 ──→ Nginx ──→ Express (Node.js)
                              │
                   ┌──────────┼──────────┐
                   │          │          │
                SQLite    EJS 模板   WebSocket
               (数据库)   (前端渲染)  Agent 服务
                                        │
                              ┌─────────┼─────────┐
                              │         │         │
                           节点 A    节点 B    节点 C ...
                          (Agent)   (Agent)   (Agent)
                           Xray      Xray      Xray
```

- **后端**：Node.js + Express
- **数据库**：SQLite（better-sqlite3，WAL 模式）
- **前端**：EJS + Tailwind CSS
- **节点通信**：WebSocket Agent + SSH 后备
- **云接口**：AWS SDK v3（EC2 / Lightsail）

---

## 快速开始

### 环境要求

- Node.js >= 20（推荐 22）
- Linux（推荐 Ubuntu / Debian）
- Nginx（反向代理）

### 安装部署

```bash
# 克隆项目
git clone https://github.com/obaggcom/panelv2.git
cd panelv2

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置 SESSION_SECRET 等必填项

# PM2 启动
pm2 start ecosystem.config.js
pm2 logs vless-panel
```

### 一键安装脚本

```bash
bash install.sh
```

自动安装 Node.js、Nginx、PM2 并生成基础配置。

### 必填环境变量

| 变量 | 说明 |
|------|------|
| `SESSION_SECRET` | 会话加密密钥（随机强密码） |

更多配置项参见 `.env.example`。

---

## 管理后台

后台入口 `/admin`。首次访问 `/auth/login` 会引导创建第一个管理员账号，后续用户由管理员在后台「用户」页面创建。

| 模块 | 功能 |
|------|------|
| **节点管理** | 部署/删除节点、更新 IP、Agent 状态监控、配置下发 |
| **用户管理** | 搜索/排序、封禁/解封、重置 Token、流量配额、到期管理 |
| **流量统计** | 用户排行、节点维度、趋势图表、自定义时间范围 |
| **白名单** | 注册白名单、节点访问白名单 |
| **AWS 管理** | 多账号、实例操作、一键部署、自动换 IP |
| **Agent** | 在线状态、远程命令、批量更新 |
| **备份恢复** | 自动备份、手动备份、一键恢复 |
| **系统设置** | Telegram 通知、订阅风控、全局配置 |

---

## 订阅客户端支持

已在 UA 白名单中的客户端（enforce 模式下可正常拉取订阅）：

| 平台 | 支持的客户端 |
|------|-------------|
| **跨平台** | Clash, Clash Meta, Mihomo, Clash Verge, Clash Verge Rev, FlClash, sing-box, Hiddify, Karing, Nekoray |
| **Windows** | Clash for Windows, V2RayN, Qv2ray |
| **macOS** | V2RayU, Stash |
| **iOS** | Shadowrocket, Quantumult, Quantumult X, Stash, Loon, Surfboard |
| **Android** | V2RayNG, SFA (sing-box), NekoBox |
| **Linux** | Nekoray, SFI (sing-box) |

---

## 定时任务

| 时间（Asia/Shanghai） | 任务 |
|----------------------|------|
| 02:00 | 自动备份数据库 |
| 03:00 | 自动轮换端口/UUID + 分级 Token 重置 |
| 04:00 | 冻结不活跃/到期用户 + 同步节点配置 |
| 04:30 | 清理 90 天前审计日志 |

---

## 项目结构

```
panelv2/
├── src/
│   ├── app.js              # 应用入口
│   ├── middleware/          # 认证、CSRF、限流
│   ├── routes/             # 路由（auth/panel/admin）
│   ├── services/           # 业务逻辑（数据库/健康检查/AWS/通知）
│   └── utils/              # 工具函数
├── node-agent/             # 节点 Agent（部署到每台节点）
├── views/                  # EJS 模板
├── public/                 # 静态资源
├── test/                   # 测试
├── data/                   # SQLite 数据库 & 日志
├── backups/                # 自动备份
└── ecosystem.config.js     # PM2 配置
```

---

## 相关文档

- [API 接口参考](./README-API.md)
- [管理后台指南](./ADMIN-GUIDE.md)
- [Node Agent 部署](./node-agent/README.md)
- [更新日志](./CHANGELOG.md)

---

## License

MIT
