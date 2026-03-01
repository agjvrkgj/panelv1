const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function restoreDatabaseFromBackup({
  dbModule,
  backupPath,
  backupName,
  dataDir,
  dbPath,
  performBackup,
  requesterIp,
  fsPromises = fs.promises,
  DatabaseCtor = Database,
}) {
  const stagedPath = path.join(dataDir, `panel.restore.${Date.now()}.db`);

  try {
    const preBackup = await performBackup(dbModule.getDb());
    if (!preBackup.ok) {
      return { ok: false, error: '创建恢复前备份失败: ' + (preBackup.error || '') };
    }

    await fsPromises.mkdir(dataDir, { recursive: true });
    await fsPromises.copyFile(backupPath, stagedPath);

    const stagedDb = new DatabaseCtor(stagedPath, { readonly: true });
    const integrity = stagedDb.pragma('integrity_check', { simple: true });
    stagedDb.close();
    if (String(integrity).toLowerCase() !== 'ok') {
      await fsPromises.unlink(stagedPath).catch(() => {});
      return { ok: false, error: `备份完整性校验失败: ${integrity}` };
    }

    try {
      const live = dbModule.getDb();
      live.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    dbModule.closeDb();

    await fsPromises.rename(stagedPath, dbPath);
    await fsPromises.unlink(`${dbPath}-wal`).catch(() => {});
    await fsPromises.unlink(`${dbPath}-shm`).catch(() => {});

    const reopened = dbModule.reopenDb();
    const liveIntegrity = reopened.pragma('integrity_check', { simple: true });
    if (String(liveIntegrity).toLowerCase() !== 'ok') {
      return { ok: false, error: `恢复后数据库完整性异常: ${liveIntegrity}` };
    }

    dbModule.addAuditLog(null, 'backup_restore', `从备份恢复: ${backupName}`, requesterIp);
    return { ok: true, message: '恢复成功，已自动重载数据库连接' };
  } catch (err) {
    try { dbModule.reopenDb(); } catch {}
    await fsPromises.unlink(stagedPath).catch(() => {});
    return { ok: false, error: err.message };
  }
}

module.exports = {
  restoreDatabaseFromBackup,
};
