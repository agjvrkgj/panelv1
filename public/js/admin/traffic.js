/* traffic.js — 流量统计相关 */

let currentRange = 'today';
let trafficChart = null;

function closeUserDetailModal() {
  const modal = document.getElementById('user-detail-modal');
  if (modal) modal.classList.add('hidden');
}

function _getUserDetailCardStyle() {
  return 'width:min(680px,96vw);max-height:92vh;overflow-y:auto;margin:0 auto;';
}

function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
}

function escHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toSafeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function switchRange(range) {
  currentRange = range;
  document.querySelectorAll('#traffic-range-btns button').forEach(btn => {
    btn.className = btn.dataset.range === range
      ? 'text-[11px] px-2.5 py-1 rounded-lg transition bg-rose-600 text-white'
      : 'text-[11px] px-2.5 py-1 rounded-lg transition glass text-gray-400 hover:text-white';
  });
  if (range === 'date') {
    document.querySelectorAll('#traffic-range-btns button').forEach(btn => {
      btn.className = 'text-[11px] px-2.5 py-1 rounded-lg transition glass text-gray-400 hover:text-white';
    });
  }
  loadTraffic(1);
}

function _buildTrafficRow(cells, classes) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-white/5 hover:bg-white/[0.02]';
  cells.forEach((text, idx) => {
    const td = document.createElement('td');
    td.className = classes[idx];
    td.textContent = text;
    tr.appendChild(td);
  });
  return tr;
}

async function loadTraffic(page) {
  let url;
  if (currentRange === 'date') {
    const date = document.getElementById('traffic-date').value;
    url = '/admin/api/traffic?date=' + date + '&page=' + page;
  } else {
    url = '/admin/api/traffic?range=' + currentRange + '&page=' + page;
  }
  const res = await fetch(url);
  const d = await res.json();
  const body = document.getElementById('traffic-body');
  const offset = (d.page - 1) * 20;
  body.innerHTML = '';
  if (d.rows.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-gray-600 text-xs text-center">该时段暂无流量数据</td></tr>';
  } else {
    d.rows.forEach((u, i) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-white/5 hover:bg-white/[0.02]';
      const safeUserId = toSafeInt(u.id, 0);
      const safeUsername = escHtml(u.username || '-');
      tr.innerHTML = `
        <td class="py-2 px-4 text-[11px] text-gray-500">${offset + i + 1}</td>
        <td class="py-2 px-4 text-xs"><a href="javascript:void(0)" onclick="showUserDetail(${safeUserId})" class="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer">${safeUsername}</a></td>
        <td class="py-2 px-4 text-xs">${fmtBytes(u.total_up)}</td>
        <td class="py-2 px-4 text-xs">${fmtBytes(u.total_down)}</td>
        <td class="py-2 px-4 text-xs font-medium text-rose-400">${fmtBytes(u.total_up + u.total_down)}</td>
      `;
      body.appendChild(tr);
    });
  }
  document.getElementById('traffic-info').textContent = '共 ' + d.total + ' 人';
  const pager = document.getElementById('traffic-pager');
  pager.innerHTML = '';
  for (let i = 1; i <= d.pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = 'text-xs px-2 py-1 rounded ' + (i === d.page ? 'bg-rose-600 text-white' : 'glass text-gray-400 hover:text-white');
    btn.onclick = () => loadTraffic(i);
    pager.appendChild(btn);
  }
  loadNodeTraffic();
}

async function loadNodeTraffic() {
  const rangeParam = currentRange === 'date' ? document.getElementById('traffic-date').value : currentRange;
  const res = await fetch('/admin/api/traffic/nodes?range=' + rangeParam);
  const d = await res.json();
  const body = document.getElementById('node-traffic-body');
  body.innerHTML = '';
  if (d.rows.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-gray-600 text-xs text-center">暂无节点流量数据</td></tr>';
  } else {
    d.rows.forEach((n, i) => {
      body.appendChild(_buildTrafficRow(
        [i + 1, n.name, fmtBytes(n.total_up), fmtBytes(n.total_down), fmtBytes(n.total_up + n.total_down)],
        ['py-2 px-4 text-[11px] text-gray-500', 'py-2 px-4 text-xs text-white', 'py-2 px-4 text-xs', 'py-2 px-4 text-xs', 'py-2 px-4 text-xs font-medium text-rose-400']
      ));
    });
  }
}

async function loadTrafficChart() {
  try {
    const res = await fetch('/admin/api/traffic/trend?days=30');
    const data = await res.json();
    const ctx = document.getElementById('traffic-chart');
    if (!ctx) return;
    if (trafficChart) trafficChart.destroy();
    const labels = data.map(d => d.date.slice(5));
    const toGB = v => +(v / 1073741824).toFixed(2);
    trafficChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '上传 (GB)', data: data.map(d => toGB(d.total_up)), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
          { label: '下载 (GB)', data: data.map(d => toGB(d.total_down)), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3, pointRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => v + ' GB' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  } catch (e) { console.error('chart error', e); }
}

// 初始加载节点流量
document.addEventListener('DOMContentLoaded', () => loadNodeTraffic());
if (location.hash === '#traffic') setTimeout(loadTrafficChart, 200);

// 用户详情弹窗
async function showUserDetail(userId) {
  // 创建或复用弹窗
  let modal = document.getElementById('user-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'user-detail-modal';
    modal.className = 'fixed inset-0 z-50 hidden overflow-y-auto bg-black/60 backdrop-blur-sm p-3';
    modal.onclick = (e) => { if (e.target === modal) closeUserDetailModal(); };
    document.body.appendChild(modal);
  }
  modal.classList.add('flex', 'justify-center', 'items-center');
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="glass rounded-2xl p-6 mx-auto" style="${_getUserDetailCardStyle()}"><p class="text-gray-400 text-sm text-center">⏳ 加载中...</p></div>`;

  try {
    const res = await fetch('/admin/api/users/' + userId + '/detail');
    const d = await res.json();
    if (d.error) { modal.innerHTML = `<div class="glass rounded-2xl p-6 mx-auto" style="${_getUserDetailCardStyle()}"><p class="text-red-400">${escHtml(d.error)}</p><div class="pt-4 text-right"><button onclick="closeUserDetailModal()" class="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white">关闭</button></div></div>`; return; }

    const u = d.info;
    const safeUsername = escHtml(u.username || '');
    const safeCreatedAt = escHtml(u.created_at_display || u.created_at || '未知');
    const safeLastLogin = escHtml(u.last_login_display || u.last_login || '未知');
    const safeExpiresAt = escHtml(u.expires_at_display || u.expires_at || '');
    const safeUserId = toSafeInt(u.id, 0);
    const safeTrustLevel = toSafeInt(u.trust_level, 0);
    const levelColors = ['text-gray-400','text-blue-400','text-green-400','text-purple-400','text-amber-400'];
    const badges = [];
    if (u.is_admin) badges.push('<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px]">管理员</span>');
    if (u.is_blocked) badges.push('<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px]">🚫 封禁</span>');
    if (u.is_frozen) badges.push('<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">❄️ 冻结</span>');

    const ipsHtml = d.subAccess.ips.length > 0
      ? d.subAccess.ips.map(ip => `<div class="flex justify-between text-xs py-1 border-b border-white/5"><span class="text-gray-300">${escHtml(ip.ip || '')}</span><span class="text-gray-500">${toSafeInt(ip.count, 0)}次 · ${escHtml(ip.last_access_display || ip.last_access || '')}</span></div>`).join('')
      : '<p class="text-gray-600 text-xs">24h内无拉取记录</p>';

    const uasHtml = d.subAccess.uas.length > 0
      ? d.subAccess.uas.map(ua => {
        const rawUa = ua.ua || '';
        const safeUa = escHtml(rawUa);
        return `<div class="flex justify-between text-xs py-1 border-b border-white/5"><span class="text-gray-300 truncate mr-2" title="${safeUa}">${safeUa || '(空)'}</span><span class="text-gray-500 shrink-0">${toSafeInt(ua.count, 0)}次</span></div>`;
      }).join('')
      : '<p class="text-gray-600 text-xs">无UA记录</p>';

    const timelineHtml = d.subAccess.timeline.length > 0
      ? d.subAccess.timeline.slice(0, 10).map(t => `<div class="text-[11px] py-1 border-b border-white/5 text-gray-400"><span class="text-gray-500">${escHtml(t.time_display || t.time || '')}</span> · ${escHtml(t.ip || '')} · <span class="text-gray-600 truncate">${escHtml((t.ua || '').slice(0, 40))}</span></div>`).join('')
      : '<p class="text-gray-600 text-xs">无记录</p>';

    modal.innerHTML = `
      <div class="glass rounded-2xl p-4 space-y-4 mx-auto" style="${_getUserDetailCardStyle()}">
        <div class="sticky top-0 z-10 -mx-4 px-4 py-2 mb-1 bg-[#1a1520]/95 backdrop-blur-sm border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 class="text-white font-semibold">${safeUsername}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[11px] ${levelColors[Math.min(safeTrustLevel,4)]}">Lv.${safeTrustLevel}</span>
              ${badges.join(' ')}
            </div>
          </div>
          <button onclick="closeUserDetailModal()" class="text-gray-500 hover:text-white text-lg px-2 py-1" aria-label="关闭详情弹窗">✕</button>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="glass rounded-xl p-3"><p class="text-gray-500 text-[10px]">今日流量</p><p class="text-white font-medium">${fmtBytes(d.todayTraffic.up + d.todayTraffic.down)}</p><p class="text-gray-500 text-[10px]">↑${fmtBytes(d.todayTraffic.up)} ↓${fmtBytes(d.todayTraffic.down)}</p></div>
          <div class="glass rounded-xl p-3"><p class="text-gray-500 text-[10px]">累计流量</p><p class="text-white font-medium">${fmtBytes(d.totalTraffic.up + d.totalTraffic.down)}</p><p class="text-gray-500 text-[10px]">↑${fmtBytes(d.totalTraffic.up)} ↓${fmtBytes(d.totalTraffic.down)}</p></div>
        </div>

        <div class="text-[11px] text-gray-500 space-y-1">
          <div>注册: ${safeCreatedAt} · 最后活跃: ${safeLastLogin}</div>
          ${u.expires_at ? '<div>到期: ' + safeExpiresAt + '</div>' : ''}
          ${u.traffic_limit ? '<div>流量限额: ' + fmtBytes(u.traffic_limit) + '/天</div>' : ''}
        </div>

        <div>
          <h4 class="text-gray-400 text-xs font-medium mb-2">📡 订阅拉取 IP（24h）</h4>
          <div class="glass rounded-xl p-3 max-h-32 overflow-y-auto">${ipsHtml}</div>
        </div>

        <div>
          <h4 class="text-gray-400 text-xs font-medium mb-2">🔍 User-Agent（24h）</h4>
          <div class="glass rounded-xl p-3 max-h-32 overflow-y-auto">${uasHtml}</div>
        </div>

        <div>
          <h4 class="text-gray-400 text-xs font-medium mb-2">⏱ 最近拉取记录</h4>
          <div class="glass rounded-xl p-3 max-h-40 overflow-y-auto">${timelineHtml}</div>
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          <button onclick="fetch('/admin/api/users/${safeUserId}/toggle-block',{method:'POST',headers:{'X-CSRF-Token':_csrf,'Accept':'application/json'}}).then(r=>r.json()).then(d=>{if(d.ok){showToast(d.message);showUserDetail(${safeUserId})}})" class="text-xs px-3 py-1.5 rounded-lg ${u.is_blocked ? 'bg-emerald-600/40 text-emerald-300' : 'bg-red-500/20 text-red-400'} hover:opacity-80 transition">${u.is_blocked ? '✅ 解封' : '🚫 封禁'}</button>
          <button onclick="fetch('/admin/api/users/${safeUserId}/reset-token',{method:'POST',headers:{'X-CSRF-Token':_csrf,'Accept':'application/json'}}).then(r=>r.json()).then(d=>{if(d.ok)showToast('订阅已重置')})" class="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:opacity-80 transition">🔄 重置订阅</button>
          <button onclick="closeUserDetailModal()" class="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white transition ml-auto">关闭</button>
        </div>
      </div>
    `;
  } catch (e) {
    modal.innerHTML = `<div class="glass rounded-2xl p-6 mx-auto" style="${_getUserDetailCardStyle()}"><p class="text-red-400 text-sm">加载失败: ${escHtml(e.message || '未知错误')}</p><div class="pt-4 text-right"><button onclick="closeUserDetailModal()" class="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white">关闭</button></div></div>`;
  }
}
