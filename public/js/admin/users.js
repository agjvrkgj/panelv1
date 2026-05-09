/* users.js — 用户管理相关（setTrafficLimit, setExpiry, saveDefaultTrafficLimit, applyDefaultTrafficLimit） */
/* 注意：loadUsers 定义在 admin-sections.ejs 的 IIFE 中，因为它依赖 EJS 变量 csrfToken */

async function setTrafficLimit(userId, username, currentLimit) {
  const currentTB = currentLimit ? (currentLimit / 1099511627776).toFixed(2) : '0';
  const input = await _prompt('设置 ' + username + ' 的流量限额', { value: currentTB, placeholder: '0 = 无限', hint: '单位：TB，0 = 无限' });
  if (input === null) return;
  const limitTB = parseFloat(input) || 0;
  const limitGB = limitTB * 1024;
  const res = await fetch('/admin/api/users/' + userId + '/traffic-limit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
    body: JSON.stringify({ limit: limitGB })
  });
  if (res.ok) { showToast(limitTB > 0 ? '✅ 已设为 ' + limitTB + ' TB' : '✅ 已设为无限'); setTimeout(() => location.reload(), 500); }
  else showToast('❌ 设置失败');
}

async function setExpiry(userId, username, currentExpiry) {
  const input = await _prompt('设置 ' + username + ' 的到期时间', { value: currentExpiry ? currentExpiry.slice(0, 10) : '', placeholder: 'YYYY-MM-DD（留空=永不过期）', hint: '格式：2025-12-31，留空则永不过期' });
  if (input === null) return;
  const expires_at = input.trim() ? input.trim() + 'T23:59:59Z' : '';
  const res = await fetch('/admin/api/users/' + userId + '/set-expiry', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
    body: JSON.stringify({ expires_at })
  });
  if (res.ok) { showToast(input.trim() ? '✅ 已设为 ' + input.trim() : '✅ 已设为永不过期'); loadUsers(); }
  else showToast('❌ 设置失败');
}

async function saveDefaultTrafficLimit() {
  const limitTB = parseFloat(document.getElementById('default-traffic-limit').value) || 0;
  const limitGB = limitTB * 1024;
  const res = await fetch('/admin/api/default-traffic-limit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
    body: JSON.stringify({ limit: limitGB })
  });
  if (res.ok) showToast(limitTB > 0 ? '✅ 默认限额已设为 ' + limitTB + ' TB' : '✅ 已设为无限');
  else showToast('❌ 保存失败');
}

async function applyDefaultTrafficLimit() {
  if (!await _confirm('将当前默认流量限额覆盖应用到全部用户（包括已手动设置过的）？')) return;
  const res = await fetch('/admin/api/default-traffic-limit/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' } });
  const d = await res.json().catch(() => ({}));
  if (res.ok && d.ok) {
    showToast('✅ 已覆盖应用到 ' + (d.updated || 0) + ' 个用户');
    setTimeout(() => location.reload(), 600);
  } else {
    showToast('❌ 应用失败');
  }
}


async function resetUserPassword(userId, username) {
  const pw = await _prompt('为 ' + username + ' 设置新密码', { value: '', placeholder: '至少 8 位', hint: '设置后请通过安全渠道告知用户' });
  if (pw === null) return;
  if (!pw || pw.length < 8) { showToast('❌ 密码至少 8 位'); return; }
  const res = await fetch('/admin/api/users/' + userId + '/set-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
    body: JSON.stringify({ password: pw })
  });
  const d = await res.json().catch(() => ({}));
  if (res.ok && d.ok) showToast('✅ 密码已重置');
  else showToast('❌ ' + (d.error || '重置失败'));
}

async function deleteUser(userId, username) {
  if (!await _confirm('确定删除用户 ' + username + '？此操作不可恢复，会同时清理其 UUID 映射和白名单记录。')) return;
  const res = await fetch('/admin/api/users/' + userId + '/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
    body: '{}'
  });
  const d = await res.json().catch(() => ({}));
  if (res.ok && d.ok) { showToast('✅ 已删除 ' + username); loadUsers(1); }
  else showToast('❌ ' + (d.error || '删除失败'));
}

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (form && form.id === 'user-create-form') {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      username: (fd.get('username') || '').toString().trim(),
      password: (fd.get('password') || '').toString(),
      trust_level: parseInt(fd.get('trust_level') || '0', 10) || 0,
      is_admin: !!fd.get('is_admin'),
    };
    const res = await fetch('/admin/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) {
      showToast('✅ 用户已创建：' + body.username);
      form.reset();
      if (typeof loadUsers === 'function') loadUsers(1);
    } else {
      showToast('❌ ' + (d.error || '创建失败'));
    }
  }
});
