const express = require('express');
const db = require('../services/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseIntId, isValidHost } = require('../utils/validators');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// 挂载子路由
router.use('/', require('./admin/adminWhitelist'));
router.use('/', require('./admin/adminNodes'));
router.use('/', require('./admin/adminUsers'));
router.use('/', require('./admin/adminAws'));
router.use('/', require('./admin/adminAgents'));
router.use('/', require('./admin/adminSettings'));
router.use('/', require('./admin/adminTraffic'));
router.use('/', require('./admin/adminBackup'));

module.exports = router;
module.exports.parseIntId = parseIntId;
module.exports.isValidHost = isValidHost;
