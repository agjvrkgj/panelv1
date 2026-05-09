# Changelog

## Unreleased

### 💥 Breaking
- 移除 NodeLoc OAuth 一键登录，改为**用户名 + 密码**登录方式
- `users` 表：新增 `password_hash` 列；`nodeloc_id` 放宽为可空（保留历史数据）
- `whitelist` 表：从基于 `nodeloc_id` 迁移为基于 `user_id`（带 `ON DELETE CASCADE`）
- 移除依赖 `passport`、`passport-oauth2`
- 移除环境变量 `NODELOC_URL / NODELOC_CLIENT_ID / NODELOC_CLIENT_SECRET / NODELOC_REDIRECT_URI`
- 老路由下线：`GET /auth/nodeloc`、`GET /auth/callback`
- 管理 API `POST /admin/api/whitelist/remove` 表单字段由 `nodeloc_id` 改为 `user_id`

### ✨ Added
- 新路由 `POST /auth/login`、`GET/POST /auth/register`（首次运行创建首个管理员）
- 新管理 API：`POST /admin/api/users/create`、`POST /admin/api/users/:id/set-password`、`POST /admin/api/users/:id/delete`
- 后台「用户」页：创建用户表单、修改密码、删除用户入口
- `src/utils/password.js`：基于 Node 原生 `crypto.scrypt` 的密码哈希与验证

### 🔧 Migration
- 启动时 DB 迁移会自动：添加 `users.password_hash` 列、把 `nodeloc_id` 放宽为可空、把 `whitelist` 表从 `nodeloc_id` 改为 `user_id`（原 OAuth 用户通过 `nodeloc_id → users.id` JOIN 完成迁移）
- 升级后第一次访问 `/auth/login` 会因所有历史账号都没有 `password_hash` 而需要"首次运行"流程；请提前手动给任一管理员写入 `password_hash`，或在空库下直接走首次注册流程

---

## v1.14.0 - 2026-02-27 (Phase 3 基线)

### ✨ Added
- 后台管理 Tab 增强可访问性：`role=tablist/tab/tabpanel`、`aria-*` 状态联动
- 键盘导航支持：`← / → / Home / End` 快速切换后台标签页

### ⚡ Improved
- 移除登录页与全局 head 的 Google Fonts 外链请求，提升中国大陆访问稳定性与首屏加载
- 升级页文案改为会员等级表达：青铜会员 / 白银会员（去掉论坛地址与旧等级措辞）

### 🧩 Notes
- 版本标签历史与实际功能进度已重新对齐：当前作为 Phase 3 起始里程碑
- 建议后续按小版本（`v1.14.x`）持续发布收尾优化

---

## 历史版本（摘要）
- v1.13.0：字体优化 + 在线人数修复
- v1.12.0：蜜桃酱前台展示
- v1.11.0：Telegram 登录
- v1.10.0：移动端表格卡片化
- v1.9.0：后台代码拆分 + Tab 优化
- v1.8.0：CDN 本地化 + favicon
