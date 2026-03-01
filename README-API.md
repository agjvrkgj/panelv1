# VLESS Panel API Reference

本文档基于当前代码实现整理（`src/routes`），用于联调与二次开发。

## 约定

- 管理接口统一前缀：`/admin/api`
- 管理接口默认需要已登录管理员会话
- JSON `POST/PUT/DELETE` 默认会经过 CSRF Origin 校验
- 失败响应一般为：`{ error: string }` 或 `{ ok: false, error: string }`

## 1. Health

### `GET /healthz`

返回服务存活与数据库可用性。

成功示例：

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-02-27T21:00:00.000Z"
}
```

## 2. Auth

### `GET /auth/login`

登录页。

### `GET /auth/nodeloc`

跳转 NodeLoc OAuth 授权。

### `GET /auth/callback?state=...&code=...`

OAuth 回调，state 校验失败会重定向回登录页并附 error。

### `GET /auth/logout`

退出登录。

### `POST /auth/temp-login`

临时登录通道（需环境变量启用）。

请求体：

```json
{ "token": "..." }
```

或 Header：`x-temp-login-token: ...`

## 3. Panel

### `GET /`

用户面板。

### `GET /sub/:token`

VLESS 订阅。可选：`?type=clash|singbox|v2ray`

### `GET /sub6/:token`

IPv6 SS 订阅。可选：`?type=clash|singbox|v2ray`

### `GET /sub-qr`

当前用户订阅二维码（PNG）。

### `GET /sub6-qr`

当前用户 IPv6 订阅二维码（PNG）。

### `GET /online-count`

在线统计摘要。

示例：

```json
{ "online": 12, "nodes": 4 }
```

### `GET /api/stats`

当前用户实时统计。

### `GET /api/traffic-detail?days=30`

当前用户流量明细与趋势，`days` 最大 90。

### `GET /api/peach-status`

运维状态摘要（事件、巡检、节点可用率等）。

## 4. Admin API

所有路由都挂载在 `/admin/api`。

### 4.1 Whitelist

### `POST /admin/api/whitelist/add`

表单字段：`username`

### `POST /admin/api/whitelist/remove`

表单字段：`nodeloc_id`

### `POST /admin/api/register-whitelist/add`

表单字段：`username`

### `POST /admin/api/register-whitelist/remove`

表单字段：`username`

### 4.2 Nodes

### `POST /admin/api/nodes/deploy-smart`

表单字段：

- `host` `ssh_port` `ssh_user` `ssh_password`
- `enable_vless=on` / `enable_ss=on`
- `ss_method`
- `socks5_host` `socks5_port` `socks5_user` `socks5_pass`

### `POST /admin/api/nodes/deploy`

VLESS 部署（基础入口）。

### `POST /admin/api/nodes/deploy-ss`

SS 节点部署。

### `POST /admin/api/nodes/deploy-dual`

双协议部署。

### `POST /admin/api/nodes/manual`

手动添加节点（SS/IPv6 场景）。

字段：`name host port protocol ip_version region ss_method ss_password`

### `POST /admin/api/nodes/:id/delete`

删除节点，优先走 Agent 停服务，失败回退 SSH。

### `POST /admin/api/nodes/:id/update-host`

字段：`host`

### `POST /admin/api/nodes/:id/update-level`

字段：`level`（0-4）

### `POST /admin/api/nodes/:id/update-group`

字段：`group_name tags`

### `POST /admin/api/nodes/:id/update-ss`

字段：`protocol ip_version ss_method ss_password`

### `POST /admin/api/nodes/:id/restart-xray`

通过 Agent 重启 Xray。

### `POST /admin/api/health-check`

触发一次 Agent 健康检查。

### `POST /admin/api/rotate`

触发手动轮换。

### 4.3 Users

### `GET /admin/api/users?page=1&search=&sortBy=total_traffic&sortDir=DESC`

用户分页列表。

### `GET /admin/api/users/:id/detail`

用户综合详情（基础信息、流量、订阅访问时间线）。

### `POST /admin/api/users/:id/toggle-block`

切换封禁状态。

### `POST /admin/api/users/:id/reset-token`

重置订阅 token。

### `POST /admin/api/users/:id/traffic-limit`

JSON：`{ "limit": 100 }`（GB）

### `POST /admin/api/default-traffic-limit`

JSON：`{ "limit": 100 }`（GB）

### `POST /admin/api/default-traffic-limit/apply`

把默认配额应用到所有用户。

### `POST /admin/api/users/:id/set-expiry`

JSON：`{ "expires_at": "YYYY-MM-DD HH:mm:ss" }` 或 `null`

### 4.4 Traffic

### `GET /admin/api/traffic?page=1&range=today`

`range` 支持：`today|7d|30d|all|YYYY-MM-DD`

### `GET /admin/api/traffic/nodes?range=today`

节点维度流量排行。

### `GET /admin/api/traffic/trend?days=30`

趋势图数据，`days` 最大 90。

### 4.5 Settings / Logs / Ops

### `GET /admin/api/logs?page=1&type=all`

日志分页。`type`：`all|system|operation`

### `POST /admin/api/logs/clear`

清空日志。

### `POST /admin/api/notify/config`

JSON：`{ "token": "...", "chatId": "..." }`

### `POST /admin/api/notify/test`

发送测试通知。

### `POST /admin/api/notify/event`

JSON：`{ "key": "tg_on_xxx", "enabled": true }`

### `POST /admin/api/announcement`

JSON：`{ "text": "..." }`

### `POST /admin/api/max-users`

JSON：`{ "max": 100 }`

### `GET /admin/api/sub-access/:userId?hours=24`

订阅访问 IP 列表。

### `GET /admin/api/sub-stats?hours=24&page=1&sort=count&high=0`

订阅统计分页。

### `GET /admin/api/sub-stats/:userId/detail?hours=24`

单用户订阅行为详情。

### `GET /admin/api/diary?page=1`

运营日记分页。

### `GET /admin/api/ops-config`

读取 AI 运维配置。

### `POST /admin/api/ops-config`

更新 AI 运维配置（允许字段见 `adminSettings.js`）。

### `GET /admin/api/ops-dashboard`

运维看板摘要。

### `GET /admin/api/ops-events?limit=30`

运维事件流（合并 audit 与 diagnosis）。

### `GET /admin/api/ops-diagnoses?limit=20`

诊断记录。

### 4.6 AWS

### `GET /admin/api/aws/config`

账号配置列表。

### `POST /admin/api/aws/config`

JSON：`{ name, accessKey, secretKey, socks5Url? }`

### `PUT /admin/api/aws/config/:id`

JSON：`{ name?, socks5Url? }`

### `DELETE /admin/api/aws/config/:id`

删除账号。

### `POST /admin/api/aws/socks-test`

JSON：`{ socks5Url }`

### `GET /admin/api/aws/instances?type=ec2|lightsail&region=&accountId=`

按账号列实例。

### `GET /admin/api/aws/all-instances?force=1`

跨账号聚合实例列表（带缓存）。

### `POST /admin/api/nodes/:id/aws-bind`

JSON：`{ aws_instance_id, aws_type, aws_region, aws_account_id }`

### `POST /admin/api/nodes/:id/swap-ip`

已绑定节点换 IP。

### `POST /admin/api/aws/start`

JSON：`{ instanceId, type, region, accountId }`

### `POST /admin/api/aws/stop`

JSON：`{ instanceId, type, region, accountId }`

### `POST /admin/api/aws/terminate`

JSON：`{ instanceId, type, region, accountId }`

### `POST /admin/api/aws/swap-ip`

JSON：`{ instanceId, type, region, accountId }`

### `POST /admin/api/aws/launch-and-deploy`

JSON：`{ accountId, region, type, spec, sshPassword }`

### 4.7 Agents

### `GET /admin/api/agents`

在线 Agent 列表。

### `POST /admin/api/agents/:nodeId/command`

JSON：`{ type: "...", ... }`

### `POST /admin/api/agents/update-all`

批量下发 `self_update`。

### `POST /admin/api/agent-token/regenerate`

重置全局与节点 Agent Token。

### 4.8 Backup

### `GET /admin/api/backups`

备份列表。

### `POST /admin/api/backups/create`

创建备份。

### `GET /admin/api/backups/download/:name`

下载备份。

### `POST /admin/api/backups/restore`

JSON：`{ "name": "panel-xxxx.db" }`

## 5. Agent Download

### `GET /api/agent/download`

Header：`Authorization: Bearer <token>`

支持全局 `agent_token` 或节点独立 `agent_token`。

## 6. 错误码与鉴权提示

常见状态：

- `302`：未登录重定向 `/auth/login`
- `400`：参数错误
- `403`：权限不足、CSRF 失败、订阅拒绝
- `404`：资源不存在
- `429`：限流或风控封禁
- `500`：服务内部错误

