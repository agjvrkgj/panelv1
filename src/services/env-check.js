/**
 * 启动时 .env 环境变量校验
 * 缺少必要变量时明确报错并退出
 */
const logger = require('./logger');

const REQUIRED_VARS = [
  'SESSION_SECRET',
  'NODELOC_URL',
  'NODELOC_CLIENT_ID',
  'NODELOC_CLIENT_SECRET',
  'NODELOC_REDIRECT_URI',
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.fatal({ missing }, '缺少必要环境变量，请检查 .env 文件');
    process.exit(1);
  }
  // 警告使用默认值的变量
  if (process.env.SESSION_SECRET === 'dev-secret-change-me' || process.env.SESSION_SECRET === 'change-me-to-random-string') {
    logger.warn('SESSION_SECRET 使用了默认值，请更换为安全的随机字符串');
  }
}

module.exports = { validateEnv };
