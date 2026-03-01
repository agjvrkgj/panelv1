# Node Agent

轻量级节点代理，通过 WebSocket 长连接与面板通信。

## 安装

```bash
./install.sh <server_url> <token> <node_id>
```

## 配置

配置文件: `/etc/vless-agent/config.json`

```json
{
  "server": "wss://panel.example.com/ws/agent",
  "token": "your-token",
  "nodeId": 1,
  "insecureTls": false,
  "execWhitelist": ["my-custom-script"],
  "execWhitelistEnabled": true
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AGENT_SERVER` | 面板 WebSocket 地址 | — |
| `AGENT_TOKEN` | 认证 token | — |
| `AGENT_NODE_ID` | 节点 ID | — |
| `AGENT_INSECURE_TLS` | 设为 `true` 跳过 TLS 证书校验（⚠️ 仅调试用） | `false` |
| `AGENT_EXEC_WHITELIST` | 追加 exec 白名单，逗号分隔 | — |
| `AGENT_EXEC_WHITELIST_DISABLED` | 设为 `true` 关闭白名单限制 | `false` |

### TLS 校验

默认严格校验服务端 TLS 证书。如使用自签证书，可临时设置：

```bash
AGENT_INSECURE_TLS=true node agent.js
```

或在 config.json 中设置 `"insecureTls": true`。

> ⚠️ 禁用 TLS 校验存在中间人攻击风险，仅限开发/调试环境使用。

### exec 命令白名单

Agent 默认启用 exec 命令白名单，仅允许以下前缀的命令：

- `systemctl restart/stop/start/status xray`
- `xray api`
- `df`、`free`、`uptime`、`ps`、`ls`、`top -bn1`
- `ip addr`、`ip route`、`ping`、`curl`、`wget`
- `cat /usr/local/etc/xray/config.json`

通过 config 追加自定义白名单：

```json
{
  "execWhitelist": ["my-script", "docker ps"]
}
```

通过环境变量追加：

```bash
AGENT_EXEC_WHITELIST="my-script,docker ps" node agent.js
```

设置 `"execWhitelistEnabled": false` 或 `AGENT_EXEC_WHITELIST_DISABLED=true` 可关闭白名单（不推荐）。
