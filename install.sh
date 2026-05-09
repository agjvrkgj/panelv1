#!/bin/bash
set -e

echo "🍑 小姨子的诱惑 - 一键部署"
echo "=========================="

# 检测系统
if ! command -v apt &> /dev/null; then
  echo "❌ 仅支持 Debian/Ubuntu"; exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
apt update -qq
apt install -y -qq curl git nginx certbot python3-certbot-nginx

# 安装 Node.js 22
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  echo "📦 安装 Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y -qq nodejs
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# 克隆项目
INSTALL_DIR="/opt/vless-panel"
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 更新代码..."
  cd $INSTALL_DIR && git pull
else
  echo "📁 克隆项目..."
  git clone https://github.com/wuzeliangv/panel.git $INSTALL_DIR
  cd $INSTALL_DIR
fi

# 安装依赖
echo "📦 安装 npm 依赖..."
npm install --production

# 配置
if [ ! -f .env ]; then
  echo ""
  echo "⚙️  配置面板"
  read -p "域名 (如 vip.example.com): " DOMAIN

  SESSION_SECRET=$(openssl rand -hex 32)

  cat > .env << EOF
PORT=3000
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET
PANEL_DOMAIN=$DOMAIN
EOF
  echo "✅ 配置已保存"
else
  DOMAIN=$(grep PANEL_DOMAIN .env | sed 's/.*=//')
  if [ -z "$DOMAIN" ]; then
    read -p "域名 (如 vip.example.com): " DOMAIN
    echo "PANEL_DOMAIN=$DOMAIN" >> .env
  fi
  echo "✅ 使用现有配置，域名: $DOMAIN"
fi

# 创建数据目录
mkdir -p data/logs

# Nginx 配置
echo "🌐 配置 Nginx..."
cat > /etc/nginx/sites-available/vless-panel << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vless-panel /etc/nginx/sites-enabled/

# SSL 证书
if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  echo "🔐 申请 SSL 证书..."
  certbot certonly --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "⚠️  证书申请失败，请确保域名已解析到本机 IP"
    echo "   手动申请: certbot certonly --nginx -d $DOMAIN"
  }
fi

nginx -t && systemctl reload nginx

# 启动服务
echo "🚀 启动面板..."
pm2 delete vless-panel 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "✅ 部署完成！"
echo "=========================="
echo "🌐 面板地址: https://$DOMAIN"
echo "📁 安装目录: $INSTALL_DIR"
echo "📋 查看日志: pm2 logs vless-panel"
echo ""
echo "⚠️  首次访问 https://$DOMAIN 会引导创建第一个管理员账号"
echo "    后续用户由管理员在后台「用户」页面创建"
