/* notify.js — TG 通知配置 */

async function saveTG() {
  const token = document.getElementById('tg-token').value.trim();
  const chatId = document.getElementById('tg-chat-id').value.trim();
  const res = await fetch('/admin/api/notify/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' }, body: JSON.stringify({ token, chatId }) });
  if (res.ok) toast('✅ 已保存'); else toast('❌ 保存失败');
}

async function testTG() {
  const res = await fetch('/admin/api/notify/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' } });
  const data = await res.json();
  toast(data.ok ? '✅ 测试消息已发送' : '❌ ' + (data.error || '发送失败'));
}

async function toggleEvent(el) {
  await fetch('/admin/api/notify/event', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' }, body: JSON.stringify({ key: el.dataset.key, enabled: el.checked }) });
}

async function saveAnnouncement() {
  const text = document.getElementById('announcement-text').value.trim();
  await fetch('/admin/api/announcement', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' }, body: JSON.stringify({ text }) });
  showToast(text ? '✅ 公告已更新' : '✅ 公告已清除');
}

async function saveMaxUsers() {
  const max = parseInt(document.getElementById('max-users-input').value) || 0;
  const res = await fetch('/admin/api/max-users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._csrf || '' }, body: JSON.stringify({ max }) });
  if (res.ok) showToast(max > 0 ? '✅ 注册上限已设为 ' + max + ' 人' : '✅ 已取消注册限制');
  else showToast('❌ 保存失败');
}
