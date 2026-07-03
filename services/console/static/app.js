(() => {
  const $ = (s) => document.querySelector(s);
  const tokenKey = 'gm_admin_id_token';
  const tokenInput = $('#tokenInput');
  const saveTokenBtn = $('#saveTokenBtn');
  const loadUsersBtn = $('#loadUsersBtn');
  const usersWrap = $('#usersWrap');
  const q = $('#q');
  const role = $('#role');
  const limit = $('#limit');
  const uidTokens = $('#uidTokens');
  const amountTokens = $('#amountTokens');
  const addTokensBtn = $('#addTokensBtn');
  const tokensResult = $('#tokensResult');
  const envBadge = $('#envBadge');
  const unreadCountEl = document.getElementById('unreadCount');
  const notifWrap = document.getElementById('notifWrap');
  const refreshNotificationsBtn = document.getElementById('refreshNotificationsBtn');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const loadBillingCfgBtn = document.getElementById('loadBillingCfgBtn');
  const billingCfg = document.getElementById('billingCfg');
  const billingCfgTbl = document.getElementById('billingCfgTbl');
  // Billing tx detail controls
  const txId = document.getElementById('txId');
  const txLoadBtn = document.getElementById('txLoadBtn');
  const txDetail = document.getElementById('txDetail');
  // Billing my transactions
  const myTxLoadBtn = document.getElementById('myTxLoadBtn');
  const myTxList = document.getElementById('myTxList');
  const myTxDetail = document.getElementById('myTxDetail');
  const myTxExportBtn = document.getElementById('myTxExportBtn');
  // Exec summary widgets (首页卡片)
  const execRateEl = document.getElementById('execRate');
  const execDLEl = document.getElementById('execDL');
  const execLightRate = document.getElementById('execLightRate');
  const execLightDL = document.getElementById('execLightDL');
  const execUpdated = document.getElementById('execUpdated');
  const execRefreshBtn = document.getElementById('execRefreshBtn');
  // Keyword expansion controls
  const kwSeedDomain = document.getElementById('kwSeedDomain');
  const kwSeedKeywords = document.getElementById('kwSeedKeywords');
  const kwCountry = document.getElementById('kwCountry');
  const kwLimit = document.getElementById('kwLimit');
  const kwMinScore = document.getElementById('kwMinScore');
  const kwExpandBtn = document.getElementById('kwExpandBtn');
  const kwResult = document.getElementById('kwResult');
  // Similarity controls
  const simSeedDomain = document.getElementById('simSeedDomain');
  const simCountry = document.getElementById('simCountry');
  const simCandidates = document.getElementById('simCandidates');
  const simComputeBtn = document.getElementById('simComputeBtn');
  const simResult = document.getElementById('simResult');
  const simMinScore = document.getElementById('simMinScore');
  const simOverlapOnly = document.getElementById('simOverlapOnly');
  const simExportCsvBtn = document.getElementById('simExportCsvBtn');
  const simGenPlanBtn = document.getElementById('simGenPlanBtn');
  const simSubmitPlanBtn = document.getElementById('simSubmitPlanBtn');
  const simSaveOppBtn = document.getElementById('simSaveOppBtn');
  const simToggleAdvancedBtn = document.getElementById('simToggleAdvancedBtn');
  const simAdvanced = document.getElementById('simAdvanced');
  const simMsg = document.getElementById('simMsg');
  const simPlanType = document.getElementById('simPlanType');
  const simTopN = document.getElementById('simTopN');
  const simCpcPercent = document.getElementById('simCpcPercent');
  let lastSimilarity = [];
  // Combo discovery controls
  const comboSeedDomain = document.getElementById('comboSeedDomain');
  const comboCountry = document.getElementById('comboCountry');
  const comboSeedKeywords = document.getElementById('comboSeedKeywords');
  const comboCandidates = document.getElementById('comboCandidates');
  const comboRunBtn = document.getElementById('comboRunBtn');
  const comboResult = document.getElementById('comboResult');
  const comboExportCsvBtn = document.getElementById('comboExportCsvBtn');
  const comboExportJsonBtn = document.getElementById('comboExportJsonBtn');
  const comboSaveBtn = document.getElementById('comboSaveBtn');
  let lastCombo = { kw: null, sim: null };

  // Bulk action report controls
  const baOpId = document.getElementById('baOpId');
  const baKind = document.getElementById('baKind');
  const baLoadBtn = document.getElementById('baLoadBtn');
  const baReport = document.getElementById('baReport');
  // Bulk Audits list controls
  const baListOpId = document.getElementById('baListOpId');
  const baListKind = document.getElementById('baListKind');
  const baListLoadBtn = document.getElementById('baListLoadBtn');
  const baListExportBtn = document.getElementById('baListExportBtn');
  const baList = document.getElementById('baList');

  // Init
  const saved = localStorage.getItem(tokenKey) || '';
  tokenInput.value = saved;
  envBadge.textContent = location.host.includes('-preview') ? 'preview' : (location.host.includes('dev') ? 'dev' : 'prod');

  saveTokenBtn.onclick = () => {
    localStorage.setItem(tokenKey, tokenInput.value.trim());
    alert('已保存 Token 到本地，仅用于管理页调用');
    tryReconnectSSE();
    // 刷新首页执行概览
    if (typeof loadExecSummary === 'function') { loadExecSummary().catch(()=>{}); }
  };

  // Simple busy wrapper (KISS) to avoid duplicate submissions and provide quick feedback
  function withBusy(btn, fn) {
    if (!btn) return Promise.resolve().then(fn);
    if (btn.dataset.busy === '1') return Promise.resolve();
    btn.dataset.busy = '1';
    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = prev + '…';
    return Promise.resolve()
      .then(fn)
      .catch(err => alert(err && err.message ? err.message : String(err)))
      .finally(() => { btn.dataset.busy=''; btn.disabled=false; btn.textContent = prev; });
  }

  // --- Exec summary helpers ---
  function setDot(el, color) { if (el) el.style.background = color; }
  function colorByRate(rate) { if (rate >= 0.98) return '#16a34a'; if (rate >= 0.95) return '#f59e0b'; return '#dc2626'; }
  function colorByDL(n) { if (n === 0) return '#16a34a'; if (n <= 10) return '#f59e0b'; return '#dc2626'; }

  async function loadExecSummary() {
    if (!execRateEl || !execDLEl) return;
    try {
      const j = await apiGet('/api/v1/console/adscenter/executions/summary?days=7');
      const rate = Number(j.successRate || 0);
      const dlp = Number(j.deadlettersPending || 0);
      const dlf = Number(j.deadlettersFailed || 0);
      const dl = dlp + dlf;
      execRateEl.textContent = (rate * 100).toFixed(2) + '%';
      execDLEl.textContent = String(dl);
      setDot(execLightRate, colorByRate(rate));
      setDot(execLightDL, colorByDL(dl));
      if (execUpdated) execUpdated.textContent = '（更新于 ' + new Date(j.updatedAt || Date.now()).toLocaleString() + '）';
    } catch (e) {
      execRateEl.textContent = '--';
      execDLEl.textContent = '--';
      setDot(execLightRate, '#9ca3af');
      setDot(execLightDL, '#9ca3af');
      if (execUpdated) execUpdated.textContent = '（加载失败）';
    }
  }

  function authHeaders() {
    const t = (localStorage.getItem(tokenKey) || '').trim();
    const h = { 'Content-Type': 'application/json' };
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function apiGet(path) {
    const resp = await fetch(path, { headers: authHeaders() });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>'');
      throw new Error(`GET ${path} ${resp.status}: ${text}`);
    }
    return resp.json();
  }
  async function apiPost(path, body) {
    const resp = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body||{}) });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>'');
      throw new Error(`POST ${path} ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  function renderUsers(data) {
    const items = data.items || [];
    if (!items.length) { usersWrap.innerHTML = '<div class="muted">暂无数据</div>'; return; }
    const rows = items.map(u => `<tr>
      <td>${u.id}</td><td>${u.email||''}</td><td>${u.name||''}</td><td>${u.role||''}</td><td>${new Date(u.createdAt).toLocaleString()}</td>
      <td>
        <button data-act="tokens" data-id="${u.id}">查看Tokens</button>
        <button data-act="subs" data-id="${u.id}">订阅</button>
        <button data-act="role-admin" data-id="${u.id}">设为ADMIN</button>
        <button data-act="role-user" data-id="${u.id}">设为USER</button>
      </td>
    </tr>`).join('');
    usersWrap.innerHTML = `<table><thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
    usersWrap.querySelectorAll('button[data-act]')
      .forEach(btn => btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        try {
          if (act === 'tokens') {
            const j = await apiGet(`/api/v1/console/users/${id}/tokens`);
            alert(`用户 ${id}\n余额: ${j.balance}\n最近交易: ${j.items?.length||0}`);
            uidTokens.value = id;
      } else if (act === 'subs') {
        const j = await apiGet(`/api/v1/console/users/${id}/subscription`);
        alert(`用户 ${id}\n套餐: ${j.planName}\n状态: ${j.status}\n到期: ${new Date(j.currentPeriodEnd).toLocaleString()}`);
        const np = prompt('输入新套餐（free | pro | max），留空沿用当前：', (j.planName||'').toLowerCase());
        const planRaw = (np||'').trim().toLowerCase();
        const plan = planRaw || ((j.planName||'').toLowerCase());
        if (!['free','pro','max'].includes(plan)) { alert('无效套餐：仅支持 free/pro/max'); return; }
        const ns = prompt('输入新状态（active | paused），留空保持不变：', (j.status||'').toLowerCase());
        const status = (ns||'').trim().toLowerCase();
        const body = status ? { planName: plan, status } : { planName: plan };
        const resp = await fetch(`/api/v1/console/users/${id}/subscription`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
        if (!resp.ok) { const t = await resp.text().catch(()=>'' ); throw new Error(`更新失败 ${resp.status}: ${t}`); }
        alert('订阅已更新');
      } else if (act === 'role-admin' || act === 'role-user') {
            const role = act === 'role-admin' ? 'ADMIN' : 'USER';
            if (!confirm(`确认将用户 ${id} 角色改为 ${role} ？`)) return;
            const resp = await fetch(`/api/v1/console/users/${id}/role`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ role }) });
            if (!resp.ok) throw new Error(`PUT role ${resp.status}`);
            alert('角色已更新');
            loadUsersBtn.click();
          }
        } catch (err) {
          alert(err.message);
        }
      }));
  }

  loadUsersBtn.onclick = async () => {
    try {
      const params = new URLSearchParams();
      if (q.value.trim()) params.set('q', q.value.trim());
      if (role.value.trim()) params.set('role', role.value.trim());
      const n = parseInt(limit.value, 10); if (n>0) params.set('limit', String(n));
      const data = await apiGet(`/api/v1/console/users?${params.toString()}`);
      renderUsers(data);
    } catch (err) {
      usersWrap.innerHTML = `<div class="muted">${err.message}</div>`;
    }
  };

  addTokensBtn.onclick = async () => {
    const id = uidTokens.value.trim();
    const amt = parseInt(amountTokens.value, 10);
    if (!id || !(amt>0)) { alert('请输入用户ID与数量(>0)'); return; }
    try {
      const j = await apiPost(`/api/v1/console/users/${id}/tokens`, { amount: amt });
      tokensResult.textContent = JSON.stringify(j);
      alert('变更成功');
    } catch (err) {
      alert(err.message);
    }
  };

  // Notifications list
  async function loadRecentNotifications() {
    try {
      const j = await apiGet('/api/v1/notifications/recent?limit=20');
      const items = j.items || j || [];
      if (!items.length) { notifWrap.innerHTML = '<div class="muted">无通知</div>'; return; }
      const rows = items.map(n => `<div>
        <strong>[${n.severity||'info'}]</strong> ${n.summary||n.title||''}
        <span class="muted">(${new Date(n.createdAt||n.time||Date.now()).toLocaleString()})</span>
      </div>`).join('');
      notifWrap.innerHTML = rows;
      notifWrap.setAttribute('data-latest-id', String(items[0]?.id || items[items.length-1]?.id || ''));
    } catch (e) { notifWrap.innerHTML = `<div class="muted">${e.message}</div>`; }
  }
  refreshNotificationsBtn.onclick = loadRecentNotifications;
  markAllReadBtn.onclick = async () => {
    const lastId = notifWrap.getAttribute('data-latest-id') || '';
    if (!lastId) { alert('当前列表无可标记的通知'); return; }
    try {
      await apiPost('/api/v1/notifications/read', { lastId });
      await pollUnreadOnce();
      alert('已标记为已读');
    } catch (e) { alert(e.message); }
  };

  async function pollUnreadOnce() {
    try {
      const j = await apiGet('/api/v1/notifications/unread-count');
      const c = (j && (j.count ?? j.unread ?? 0)) || 0;
      unreadCountEl.textContent = String(c);
      setUnreadBadge(c);
    } catch (e) {
      // ignore
    }
  }
  function setUnreadBadge(n) {
    const env = envBadge.textContent.replace(/\s*•.*$/, '');
    envBadge.textContent = `${env} • 未读 ${n}`;
  }

  // SSE via fetch streaming (Authorization header supported)
  let sseAbort = null;
  async function connectSSE() {
    try {
      if (sseAbort) { sseAbort.abort(); }
      const ac = new AbortController(); sseAbort = ac;
      const resp = await fetch('/api/v1/notifications/stream', { headers: authHeaders(), signal: ac.signal });
      if (!resp.ok || !resp.body) { throw new Error('SSE连接失败'); }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const evt = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const lines = evt.split('\n');
          let type = 'message', data = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) type = ln.slice(6).trim();
            else if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (type === 'unread') {
            try { const j = JSON.parse(data||'{}'); const c = j.count||0; unreadCountEl.textContent = String(c); setUnreadBadge(c); } catch {}
          }
        }
      }
    } catch (e) {
      // fallback to polling
      await pollUnreadOnce();
      setTimeout(connectSSE, 5000);
    }
  }
  function tryReconnectSSE() { setTimeout(connectSSE, 300); }

  // Billing config
  loadBillingCfgBtn.onclick = async () => {
    if (billingCfgTbl) billingCfgTbl.innerHTML = '';
    billingCfg.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/billing/config');
      billingCfg.textContent = JSON.stringify(j, null, 2);
      // render structured
      if (billingCfgTbl) {
        const pricing = j.pricing || {};
        const limits = j.limits || {};
        let html = '';
        const keys = Object.keys(pricing);
        if (keys.length) {
          html += '<div><strong>Pricing</strong></div>';
          html += '<table><thead><tr><th>Action</th><th>Tokens</th></tr></thead><tbody>' +
            keys.sort().map(k=>`<tr><td>${k}</td><td>${pricing[k]}</td></tr>`).join('') + '</tbody></table>';
        }
        const lkeys = Object.keys(limits);
        if (lkeys.length) {
          html += '<div class="row" style="margin-top:6px"><strong>Limits</strong></div>';
          html += '<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>' +
            lkeys.sort().map(k=>`<tr><td>${k}</td><td>${limits[k]}</td></tr>`).join('') + '</tbody></table>';
        }
        if (!html) html = '<div class="muted">无结构化配置</div>';
        billingCfgTbl.innerHTML = html;
      }
    }
    catch (e) { billingCfg.textContent = e.message; }
  };

  // initial
  pollUnreadOnce();
  loadRecentNotifications();
  tryReconnectSSE();

  // Billing tx detail
  if (txLoadBtn) {
    txLoadBtn.onclick = async () => {
      const id = (txId && txId.value || '').trim();
      if (!id) { if (txDetail) txDetail.textContent = '请输入交易ID'; return; }
      if (txDetail) txDetail.textContent = '查询中...';
      try {
        const j = await apiGet(`/api/v1/billing/tokens/transactions/${encodeURIComponent(id)}`);
        if (txDetail) txDetail.textContent = JSON.stringify(j, null, 2);
      } catch (e) { if (txDetail) txDetail.textContent = e.message; }
    };
  }

  // My last 50 transactions
  async function myTxLoad() {
    if (!myTxList) return;
    myTxList.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/billing/tokens/transactions');
      const items = j || [];
      if (!items.length) { myTxList.textContent = '暂无交易'; if (myTxDetail) myTxDetail.textContent=''; return; }
      myTxList.innerHTML = '<table><thead><tr><th>ID</th><th>Type</th><th>Amount</th><th>Description</th><th>Created</th><th>Actions</th></tr></thead><tbody>'+
        items.map(t=>`<tr><td>${t.id}</td><td>${t.type}</td><td>${t.amount}</td><td>${t.description||''}</td><td>${t.createdAt?new Date(t.createdAt).toLocaleString():''}</td><td><button data-tx-id="${t.id}">详情</button></td></tr>`).join('')+
        '</tbody></table>';
      myTxList.querySelectorAll('button[data-tx-id]').forEach(btn=>{
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-tx-id');
          try { const d = await apiGet(`/api/v1/billing/tokens/transactions/${id}`); if (myTxDetail) myTxDetail.textContent = JSON.stringify(d, null, 2); }
          catch (e) { if (myTxDetail) myTxDetail.textContent = e.message; }
        });
      });
    } catch (e) { myTxList.textContent = e.message; if (myTxDetail) myTxDetail.textContent=''; }
  }
  if (myTxLoadBtn) myTxLoadBtn.onclick = myTxLoad;
  if (myTxExportBtn) {
    myTxExportBtn.onclick = async () => {
      try {
        const items = await apiGet('/api/v1/billing/tokens/transactions');
        let csv = 'id,type,amount,balanceBefore,balanceAfter,source,description,createdAt\n';
        (items||[]).forEach(t=>{
          const line = [t.id, t.type, t.amount, t.balanceBefore, t.balanceAfter, t.source||'', t.description||'', t.createdAt||'']
            .map(v=>JSON.stringify(v??'')).join(',');
          csv += line + '\n';
        });
        downloadFile('my-transactions.csv', 'text/csv', csv);
      } catch (e) { alert(e.message); }
    };
  }

  // Token 汇总
  const tokenStatsBtn = document.getElementById('tokenStatsBtn');
  const tokenStats = document.getElementById('tokenStats');
  const dashLoadBtn = document.getElementById('dashLoadBtn');
  const dashStats = document.getElementById('dashStats');
  tokenStatsBtn.onclick = async () => {
    try {
      const j = await apiGet('/api/v1/console/tokens/stats');
      tokenStats.textContent = `用户数: ${j.users}, Token总量: ${j.totalTokens}`;
    } catch (err) {
      tokenStats.textContent = err.message;
    }
  };

  // Admin dashboard stats
  async function loadDashboard() {
    if (!dashStats) return;
    dashStats.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/console/stats');
      const c = j.counters || {};
      const lines = [
        `用户数: ${c.users}`,
        `Offer数: ${c.offers}`,
        `激活订阅: ${c.subscriptionsActive}`,
        `Token总量: ${c.tokensTotal}`,
        `近24h通知: ${c.notifications24h}`,
        `Siterank分析数: ${c.siterankAnalyses}`,
        `Batchopen任务数: ${c.batchopenTasks}`,
        `事件总数: ${c.events}`,
        `更新时间: ${j.updatedAt||''}`
      ].join('\n');
      dashStats.innerHTML = `<pre style="white-space:pre-wrap">${lines}</pre>`;
    } catch (e) {
      dashStats.textContent = e.message;
    }
  }
  if (dashLoadBtn) dashLoadBtn.onclick = loadDashboard;
  // Exec summary init + auto polling
  if (execRefreshBtn) execRefreshBtn.onclick = () => loadExecSummary();
  if (execRateEl && execDLEl) { loadExecSummary(); setInterval(loadExecSummary, 30000); }

  // Keyword expansion (rule-based)
  if (kwExpandBtn) {
    kwExpandBtn.onclick = async () => {
      kwResult.textContent = '生成中...';
      try {
        const seeds = (kwSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const body = {
          seedDomain: kwSeedDomain.value.trim(),
          seedKeywords: seeds,
          country: kwCountry.value.trim(),
          limit: parseInt(kwLimit.value||'10', 10) || 10,
          minScore: parseFloat(kwMinScore.value||'0') || 0
        };
        const j = await apiPost('/api/v1/adscenter/keywords/expand', body);
        const items = j.items || [];
        if (!items.length) { kwResult.textContent = '无结果'; return; }
        kwResult.innerHTML = '<ol>' + items.map(it=>`<li>${it.keyword} <span class="muted">(${(it.score||0).toFixed(1)}${it.reason?(' - '+it.reason):''})</span></li>`).join('') + '</ol>';
      } catch (e) { kwResult.textContent = e.message; }
    };
  }

  // Similarity compute
  if (simComputeBtn) {
    simComputeBtn.onclick = async () => {
      simResult.textContent = '计算中...';
      try {
        const seed = (simSeedDomain.value||'').trim();
        const country = (simCountry.value||'').trim();
        const cands = (simCandidates.value||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean);
        if (!seed || !cands.length) { simResult.textContent = '请填写种子域名与至少一个候选域名'; return; }
        const body = { seedDomain: seed, candidates: cands };
        if (country) body.country = country;
        const j = await apiPost('/api/v1/siterank/similar', body);
        let items = (j.items || j || []);
        const minScore = parseFloat((simMinScore && simMinScore.value)||'');
        if (!Number.isNaN(minScore)) { items = items.filter(it => (it.score||0) >= minScore); }
        if (simOverlapOnly && simOverlapOnly.checked) {
          items = items.filter(it => {
            try { const d = it.factors && (it.factors.countryDetail || it.factors.CountryDetail); const ol = d && (d.overlap || d.Overlap); return (ol||[]).length > 0; } catch { return false; }
          });
        }
        lastSimilarity = items;
        if (!items.length) { simResult.textContent = '无结果'; return; }
        simResult.innerHTML = '<table><thead><tr><th>Domain</th><th>Score</th><th>Reason</th><th>Overlap</th><th>Factors</th></tr></thead><tbody>' +
          items.map(it => {
            const reason = (it.factors && (it.factors.reason || it.factors.Reason)) || '';
            const overlaps = (()=>{ try { const d = it.factors && (it.factors.countryDetail || it.factors.CountryDetail); const ol = d && (d.overlap || d.Overlap); return (ol||[]).join(','); } catch { return ''; } })();
            const ftxt = it.factors ? JSON.stringify(it.factors) : '';
            return `<tr><td>${it.domain}</td><td>${(it.score||0).toFixed(1)}</td><td>${reason||'<span class="muted">-</span>'}</td><td>${overlaps||'<span class="muted">-</span>'}</td><td><pre class="muted" style="white-space:pre-wrap">${ftxt}</pre></td></tr>`;
          }).join('') +
          '</tbody></table>';
      } catch (e) { simResult.textContent = e.message; }
    };
  }
  if (simExportCsvBtn) {
    simExportCsvBtn.onclick = () => {
      const items = lastSimilarity || [];
      if (!items.length) { alert('暂无可导出的相似度结果'); return; }
      let csv = 'domain,score,reason,overlap\n';
      items.forEach(it => {
        const reason = (it.factors && (it.factors.reason || it.factors.Reason)) || '';
        let overlaps = '';
        try { const d = it.factors && (it.factors.countryDetail || it.factors.CountryDetail); const ol = d && (d.overlap || d.Overlap); overlaps = (ol||[]).join('|'); } catch {}
        const line = [it.domain, (it.score||0), reason, overlaps].map(v=>JSON.stringify(v??'')).join(',');
        csv += line + '\n';
      });
      downloadFile('similarity.csv', 'text/csv', csv);
    };
  }

  if (simGenPlanBtn) {
    simGenPlanBtn.onclick = () => withBusy(simGenPlanBtn, async () => {
      try {
        const seed = (simSeedDomain.value||'').trim();
        const country = (simCountry.value||'').trim();
        if (!seed) { alert('请先填写种子域名'); return; }
        if (!lastSimilarity || !lastSimilarity.length) { alert('请先计算相似度结果'); return; }
        // Build a minimal plan: ROTATE_LINK per domain (top 10)
        const n = Math.max(1, Math.min(50, parseInt((simTopN && simTopN.value)||'10', 10) || 10));
        const top = lastSimilarity.slice(0, n);
        const type = (simPlanType && simPlanType.value) || 'ROTATE_LINK';
        const pct = parseFloat((simCpcPercent && simCpcPercent.value)||'10');
        const normPct = (Number.isNaN(pct) ? 10 : Math.max(-90, Math.min(500, pct)));
        const mkAction = (it) => {
          if (type === 'ADJUST_CPC') {
            return { type: 'ADJUST_CPC', params: { percent: normPct }, filter: { domain: it.domain } };
          }
          return { type: 'ROTATE_LINK', params: { targetDomain: it.domain, seed: seed, country: country, source: 'similar' } };
        };
        const actions = top.map(mkAction);
        const plan = { validateOnly: true, seedDomain: seed, country, actions };
        const h = authHeaders(); h['X-Idempotency-Key'] = `sim-validate-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const resp = await fetch('/api/v1/adscenter/bulk-actions/validate', { method: 'POST', headers: h, body: JSON.stringify(plan) });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`validate failed ${resp.status}: ${txt}`);
        if (simMsg) simMsg.textContent = '计划校验成功';
        try { const j = JSON.parse(txt); simResult.textContent = JSON.stringify(j, null, 2); } catch { simResult.textContent = txt; }
      } catch (e) { throw e; }
    });
  }

  if (simSubmitPlanBtn) {
    simSubmitPlanBtn.onclick = () => withBusy(simSubmitPlanBtn, async () => {
      try {
        const seed = (simSeedDomain.value||'').trim();
        const country = (simCountry.value||'').trim();
        if (!seed) { alert('请先填写种子域名'); return; }
        if (!lastSimilarity || !lastSimilarity.length) { alert('请先计算相似度结果'); return; }
        const n = Math.max(1, Math.min(50, parseInt((simTopN && simTopN.value)||'10', 10) || 10));
        const top = lastSimilarity.slice(0, n);
        const type = (simPlanType && simPlanType.value) || 'ROTATE_LINK';
        const pct = parseFloat((simCpcPercent && simCpcPercent.value)||'10');
        const normPct = (Number.isNaN(pct) ? 10 : Math.max(-90, Math.min(500, pct)));
        const mkAction = (it) => {
          if (type === 'ADJUST_CPC') {
            return { type: 'ADJUST_CPC', params: { percent: normPct }, filter: { domain: it.domain } };
          }
          return { type: 'ROTATE_LINK', params: { targetDomain: it.domain, seed: seed, country: country, source: 'similar' } };
        };
        const actions = top.map(mkAction);
        const plan = { validateOnly: false, seedDomain: seed, country, actions };
        const h = authHeaders(); h['X-Idempotency-Key'] = `sim-submit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const resp = await fetch('/api/v1/adscenter/bulk-actions', { method: 'POST', headers: h, body: JSON.stringify(plan) });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`submit failed ${resp.status}: ${txt}`);
        let id = '';
        try { const j = JSON.parse(txt); id = j.operationId || ''; } catch {}
        if (!id) { if (simMsg) simMsg.textContent = '提交成功（未返回 operationId）'; return; }
        if (simMsg) simMsg.textContent = `已入队，Operation ID=${id}`;
        // Pre-fill report/audits views and jump to audits (before snapshot)
        const baOp = document.getElementById('baOpId'); if (baOp) baOp.value = id;
        const baListOp = document.getElementById('baListOpId'); if (baListOp) baListOp.value = id;
        const baListKind = document.getElementById('baListKind'); if (baListKind) baListKind.value = 'before';
        const loadBtn = document.getElementById('baListLoadBtn'); if (loadBtn) loadBtn.click();
        const el = document.getElementById('baList'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const pollBtn = document.getElementById('baPollBtn'); if (pollBtn) pollBtn.click();
      } catch (e) { throw e; }
    });
  }

  if (simSaveOppBtn) {
    simSaveOppBtn.onclick = () => withBusy(simSaveOppBtn, async () => {
      try {
        const seed = (simSeedDomain.value||'').trim();
        const country = (simCountry.value||'').trim();
        if (!seed) { alert('请先填写种子域名'); return; }
        if (!lastSimilarity || !lastSimilarity.length) { alert('请先计算相似度结果'); return; }
        const top = lastSimilarity.slice(0, Math.max(1, Math.min(50, parseInt((simTopN && simTopN.value)||'10', 10) || 10)));
        const topDomains = top.map(it => ({ domain: it.domain, score: it.score||0, reason: (it.factors && (it.factors.reason || it.factors.Reason)) || '' }));
        const body = { seedDomain: seed, country, topDomains };
        const h = authHeaders(); h['X-Idempotency-Key'] = `sim-opp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const resp = await fetch('/api/v1/recommend/opportunities', { method: 'POST', headers: h, body: JSON.stringify(body) });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`save opportunity failed ${resp.status}: ${txt}`);
        let id = '';
        try { const j = JSON.parse(txt); id = String(j.id||''); } catch {}
        if (simMsg) simMsg.textContent = `机会已保存，ID=${id||'n/a'}`;
      } catch (e) { throw e; }
    });
  }

  // Combo discovery: run keyword expand + similarity and render a simple report
  if (comboRunBtn) {
    comboRunBtn.onclick = async () => {
      comboResult.textContent = '生成中...';
      try {
        const seed = (comboSeedDomain.value||'').trim();
        const country = (comboCountry.value||'').trim();
        const seeds = (comboSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const cands = (comboCandidates.value||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean);
        if (!seed) { comboResult.textContent = '请填写种子域名'; return; }
        // 1) keyword expand
        const bodyKW = { seedDomain: seed, seedKeywords: seeds, country, limit: 20 };
        const kw = await apiPost('/api/v1/adscenter/keywords/expand', bodyKW);
        // 2) similarity (optional if cands present)
        let sim = { items: [] };
        if (cands.length) {
          const bodySim = { seedDomain: seed, candidates: cands };
          if (country) bodySim.country = country;
          sim = await apiPost('/api/v1/siterank/similar', bodySim);
        }
        lastCombo = { kw, sim };
        const kwList = (kw.items||[]).slice(0,10).map(it=>`<li>${it.keyword} <span class="muted">(${(it.score||0).toFixed(1)})</span></li>`).join('');
        const simList = (sim.items||[]).slice(0,10).map(it=>{
          const reason = (it.factors && (it.factors.reason || it.factors.Reason)) || '';
          return `<tr><td>${it.domain}</td><td>${(it.score||0).toFixed(1)}</td><td>${reason||'<span class="muted">-</span>'}</td></tr>`;
        }).join('');
        comboResult.innerHTML = `
          <div class="row"><strong>关键词建议（Top 10）</strong></div>
          <ol>${kwList||'<li class="muted">无</li>'}</ol>
          <div class="row" style="margin-top:8px"><strong>相似域名（Top 10）</strong></div>
          <table><thead><tr><th>Domain</th><th>Score</th><th>Reason</th></tr></thead><tbody>${simList||'<tr><td colspan=3 class="muted">无</td></tr>'}</tbody></table>
        `;
      } catch (e) {
        comboResult.textContent = e.message;
      }
    };
  }

  // Combo export helpers
  function downloadFile(name, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  if (comboExportJsonBtn) {
    comboExportJsonBtn.onclick = () => {
      const obj = { keywords: lastCombo.kw?.items||[], similar: lastCombo.sim?.items||[] };
      downloadFile('discovery.json', 'application/json', JSON.stringify(obj, null, 2));
    };
  }
  if (comboExportCsvBtn) {
    comboExportCsvBtn.onclick = () => {
      const kw = lastCombo.kw?.items||[]; const sim = lastCombo.sim?.items||[];
      let csv = 'type,value,score,reason\n';
      kw.forEach(it=>{ csv += `keyword,${JSON.stringify(it.keyword)},${it.score||0},\n`; });
      sim.forEach(it=>{ const reason = (it.factors && (it.factors.reason || it.factors.Reason)) || ''; csv += `domain,${JSON.stringify(it.domain)},${it.score||0},${JSON.stringify(reason)}\n`; });
      downloadFile('discovery.csv', 'text/csv', csv);
    };
  }

  // Advanced toggle (KISS: 默认隐藏复杂选项)
  if (simToggleAdvancedBtn && simAdvanced) {
    simToggleAdvancedBtn.onclick = () => {
      const show = simAdvanced.style.display === 'none';
      simAdvanced.style.display = show ? '' : 'none';
      simToggleAdvancedBtn.textContent = show ? '隐藏高级设置' : '高级设置';
    };
  }

  if (comboSaveBtn) {
    comboSaveBtn.onclick = async () => {
      if (!lastCombo.kw && !lastCombo.sim) { alert('请先生成组合报告'); return; }
      try {
        const seed = (comboSeedDomain.value||'').trim();
        const country = (comboCountry.value||'').trim();
        const seeds = (comboSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const topKeywords = (lastCombo.kw?.items||[]).map(it=>({ keyword: it.keyword, score: it.score||0, reason: it.reason||'' }));
        const topDomains = (lastCombo.sim?.items||[]).map(it=>({ domain: it.domain, score: it.score||0 }));
        const body = { seedDomain: seed, country, seedKeywords: seeds, topKeywords, topDomains };
        const resp = await apiPost('/api/v1/recommend/opportunities', body);
        alert('保存成功，ID=' + (resp.id||''));
      } catch (e) { alert(e.message); }
    };
  }

  // Notification rules management
  const nrLoadBtn = document.getElementById('nrLoadBtn');
  const nrList = document.getElementById('nrList');
  const nrEventType = document.getElementById('nrEventType');
  const nrChannel = document.getElementById('nrChannel');
  const nrEnabled = document.getElementById('nrEnabled');
  const nrUpsertBtn = document.getElementById('nrUpsertBtn');
  const nrMsg = document.getElementById('nrMsg');
  // System overview controls
  const sysCheckBtn = document.getElementById('sysCheckBtn');
  const sysStatus = document.getElementById('sysStatus');
  // Opportunities controls
  const oppsLoadBtn = document.getElementById('oppsLoadBtn');
  const oppsList = document.getElementById('oppsList');
  const oppsDetail = document.getElementById('oppsDetail');
  const oppPlanValidateBtn = document.getElementById('oppPlanValidateBtn');
  const oppPlanSubmitBtn = document.getElementById('oppPlanSubmitBtn');
  let lastOppDetail = null; let lastOppId = '';
  async function nrLoad() {
    if (!nrList) return;
    nrMsg.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/notifications/rules');
      const items = j.items || j || [];
      if (!items.length) { nrList.textContent = '无规则'; nrMsg.textContent = ''; return; }
      nrList.innerHTML = '<table><thead><tr><th>Event</th><th>Channel</th><th>Enabled</th><th>Created</th><th>Updated</th></tr></thead><tbody>' +
        items.map(r=>`<tr><td>${r.event_type||r.eventType||''}</td><td>${r.channel||''}</td><td>${r.enabled?'✅':'❌'}</td><td>${r.created_at||''}</td><td>${r.updated_at||''}</td></tr>`).join('') + '</tbody></table>';
      nrMsg.textContent = '';
    } catch (e) { nrMsg.textContent = e.message; }
  }
  if (nrLoadBtn) nrLoadBtn.onclick = nrLoad;
  if (nrUpsertBtn) nrUpsertBtn.onclick = async () => {
    nrMsg.textContent = '保存中...';
    try {
      const body = { eventType: (nrEventType.value||'').trim(), channel: (nrChannel.value||'').trim(), enabled: !!nrEnabled.checked };
      if (!body.eventType || !body.channel) { nrMsg.textContent = '请填写事件类型和渠道'; return; }
      await apiPost('/api/v1/notifications/rules', body);
      nrMsg.textContent = '保存成功';
      await nrLoad();
    } catch (e) { nrMsg.textContent = e.message; }
  };

  // System health check
  if (sysCheckBtn) {
    sysCheckBtn.onclick = async () => {
      sysStatus.textContent = '检查中...';
      const lines = [];
      async function ping(name, path, auth=false) {
        try {
          const opt = auth? { headers: authHeaders() } : {};
          const resp = await fetch(path, opt);
          lines.push(`${name}: ${resp.status}`);
        } catch (e) {
          lines.push(`${name}: ERROR ${e.message}`);
        }
      }
      await ping('Gateway /readyz', '/readyz');
      await ping('Adscenter health', '/api/health/adscenter');
      await ping('Console health', '/api/health/console');
      // Authenticated checks (optional)
      await ping('Billing config (auth)', '/api/v1/billing/config', true);
      sysStatus.innerHTML = '<pre style="white-space:pre-wrap">'+lines.join('\n')+'</pre>';
    };
  }

  // Opportunities list & detail
  async function oppsLoad() {
    if (!oppsList) return;
    oppsList.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/recommend/opportunities');
      const items = j.items || j || [];
      if (!items.length) { oppsList.textContent = '暂无机会'; if (oppsDetail) oppsDetail.textContent = ''; return; }
      oppsList.innerHTML = '<table><thead><tr><th>ID</th><th>Seed</th><th>Country</th><th>Created</th><th>Actions</th></tr></thead><tbody>'+
        items.map(it=>`<tr><td>${it.id}</td><td>${it.seedDomain||''}</td><td>${it.country||''}</td><td>${it.createdAt?new Date(it.createdAt).toLocaleString():''}</td><td><button data-opp-id="${it.id}">查看</button></td></tr>`).join('')+
        '</tbody></table>';
      oppsList.querySelectorAll('button[data-opp-id]').forEach(btn=>{
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-opp-id');
          try { const d = await apiGet(`/api/v1/recommend/opportunities/${id}`); if (oppsDetail) oppsDetail.textContent = JSON.stringify(d, null, 2); }
          catch (e) { if (oppsDetail) oppsDetail.textContent = e.message; }
          try { const d = await apiGet(`/api/v1/recommend/opportunities/${id}`); lastOppDetail = d; lastOppId = String(id); } catch { lastOppDetail = null; lastOppId = ''; }
        });
      });
    } catch (e) { oppsList.textContent = e.message; if (oppsDetail) oppsDetail.textContent=''; }
  }
  if (oppsLoadBtn) oppsLoadBtn.onclick = oppsLoad;

  function buildActionsFromOpportunity(opp) {
    const typeSel = document.getElementById('simPlanType');
    const topNSel = document.getElementById('simTopN');
    const cpcSel = document.getElementById('simCpcPercent');
    const type = (typeSel && typeSel.value) || 'ROTATE_LINK';
    const n = Math.max(1, Math.min(50, parseInt((topNSel && topNSel.value)||'10', 10) || 10));
    const pct = parseFloat((cpcSel && cpcSel.value)||'10');
    const normPct = (Number.isNaN(pct) ? 10 : Math.max(-90, Math.min(500, pct)));
    const domains = Array.isArray(opp.topDomains) ? opp.topDomains : [];
    const top = domains.slice(0, n);
    const seed = opp.seedDomain || '';
    const country = opp.country || '';
    const actions = top.map(it => {
      const domain = (it && (it.domain || it.Domain)) || '';
      if (type === 'ADJUST_CPC') {
        return { type: 'ADJUST_CPC', params: { percent: normPct }, filter: { domain } };
      }
      return { type: 'ROTATE_LINK', params: { targetDomain: domain, seed, country, source: 'opportunity' } };
    });
    return { actions, seed, country };
  }

  async function validatePlanFromOpportunity() {
    if (!lastOppDetail) { alert('请先从列表加载一个机会详情'); return; }
    const { actions, seed, country } = buildActionsFromOpportunity(lastOppDetail);
    const plan = { validateOnly: true, seedDomain: seed, country, actions };
    const h = authHeaders(); h['X-Idempotency-Key'] = `opp-validate-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const resp = await fetch('/api/v1/adscenter/bulk-actions/validate', { method: 'POST', headers: h, body: JSON.stringify(plan) });
    const txt = await resp.text(); if (!resp.ok) throw new Error(`validate failed ${resp.status}: ${txt}`);
    try { const j = JSON.parse(txt); oppsDetail.textContent = JSON.stringify(j, null, 2); } catch { oppsDetail.textContent = txt; }
    alert('计划校验成功');
  }
  async function submitPlanFromOpportunity() {
    if (!lastOppDetail) { alert('请先从列表加载一个机会详情'); return; }
    const { actions, seed, country } = buildActionsFromOpportunity(lastOppDetail);
    const plan = { validateOnly: false, seedDomain: seed, country, actions };
    const h = authHeaders(); h['X-Idempotency-Key'] = `opp-submit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const resp = await fetch('/api/v1/adscenter/bulk-actions', { method: 'POST', headers: h, body: JSON.stringify(plan) });
    const txt = await resp.text(); if (!resp.ok) throw new Error(`submit failed ${resp.status}: ${txt}`);
    let id = ''; try { const j = JSON.parse(txt); id = j.operationId || ''; } catch {}
    alert(`已入队，Operation ID=${id||'n/a'}`);
    // Jump to audits
    const baOp = document.getElementById('baOpId'); if (baOp) baOp.value = id;
    const baListOp = document.getElementById('baListOpId'); if (baListOp) baListOp.value = id;
    const baListKindSel = document.getElementById('baListKind'); if (baListKindSel) baListKindSel.value = 'before';
    const loadBtn = document.getElementById('baListLoadBtn'); if (loadBtn) loadBtn.click();
    const el = document.getElementById('baList'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const pollBtn = document.getElementById('baPollBtn'); if (pollBtn) pollBtn.click();
  }
  if (oppPlanValidateBtn) oppPlanValidateBtn.onclick = () => withBusy(oppPlanValidateBtn, () => validatePlanFromOpportunity());
  if (oppPlanSubmitBtn) oppPlanSubmitBtn.onclick = () => withBusy(oppPlanSubmitBtn, () => submitPlanFromOpportunity());

  // Bulk Action report loader
  if (baLoadBtn) {
    baLoadBtn.onclick = async () => {
      const id = (baOpId && baOpId.value || '').trim();
      const kind = (baKind && baKind.value || '').trim();
      if (!id) { if (baReport) baReport.textContent = '请输入 Operation ID'; return; }
      if (baReport) baReport.textContent = '加载中...';
      try {
        const url = `/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/report` + (kind?`?kind=${encodeURIComponent(kind)}`:'');
        const j = await apiGet(url);
        const items = j.items || j || [];
        if (!items.length) { if (baReport) baReport.textContent = '无数据'; return; }
        // Build summary
        const summary = (function summarize(list){
          let planned = 0, executed = 0, errors = 0;
          const typeDist = {};
          const samples = [];
          for (const it of list) {
            const kind = it.kind || '';
            let snap = {};
            try { snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{}); } catch {}
            if (kind === 'rollback') {
              if (snap && Array.isArray(snap.actions)) planned += snap.actions.length;
            } else if (kind === 'rollback_exec') {
              const st = (snap.status||'').toLowerCase();
              if (st === 'ok') executed++; else errors++;
              const t = snap.action && snap.action.type || '';
              if (t) typeDist[t] = (typeDist[t]||0)+1;
              if (samples.length < 3) samples.push(snap.action||snap);
            }
          }
          const total = executed + errors;
          const successRate = total ? ((executed/total)*100).toFixed(1)+'%' : 'n/a';
          return { planned, executed, errors, total, successRate, typeDist, samples };
        })(items);
        const header = `Summary\n- planned: ${summary.planned}\n- executed: ${summary.executed}\n- errors: ${summary.errors}\n- success: ${summary.successRate}\n- dist: ${JSON.stringify(summary.typeDist)}\n\nItems:`;
        if (baReport) baReport.textContent = header + '\n' + JSON.stringify(items, null, 2);
      } catch (e) {
        if (baReport) baReport.textContent = e.message;
      }
    };
  }

  // Quick jump from report to audits list
  const baJumpAfterBtn = document.getElementById('baJumpAfterBtn');
  const baJumpRollbackExecBtn = document.getElementById('baJumpRollbackExecBtn');
  const baPollBtn = document.getElementById('baPollBtn');
  const baStopPollBtn = document.getElementById('baStopPollBtn');
  const baStatus = document.getElementById('baStatus');
  let baPollTimer = null;
  const baLoadPlanBtn = document.getElementById('baLoadPlanBtn');
  const baExportAfterBtn = document.getElementById('baExportAfterBtn');
  const baExportExecCsvBtn = document.getElementById('baExportExecCsvBtn');
  const baExportPlanBtn = document.getElementById('baExportPlanBtn');
  const baExportBundleBtn = document.getElementById('baExportBundleBtn');
  let lastAfterItems = [];
  let lastExecItems = [];
  let lastPlan = null;
  function jumpToAudits(kind) {
    if (!baListOpId || !baListKind) return;
    const id = (baOpId && baOpId.value || '').trim();
    if (!id) { alert('请先在报告卡片输入 Operation ID 并加载'); return; }
    baListOpId.value = id;
    baListKind.value = kind || '';
    if (baListLoadBtn) baListLoadBtn.click();
    const el = document.getElementById('baList');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (baJumpAfterBtn) baJumpAfterBtn.onclick = () => jumpToAudits('after');
  if (baJumpRollbackExecBtn) baJumpRollbackExecBtn.onclick = () => jumpToAudits('rollback_exec');

  async function pollBulkOnce() {
    const id = (baOpId && baOpId.value || '').trim();
    if (!id) { if (baStatus) baStatus.textContent = '请输入 Operation ID'; return; }
    try {
      const j = await apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}`);
      const st = (j && j.status) || 'unknown';
      if (baStatus) baStatus.textContent = `状态: ${st}${j.updatedAt?(' | 更新时间: '+new Date(j.updatedAt).toLocaleString()):''}`;
      if (st === 'completed' || st === 'rolled_back') {
        // auto load after/exec reports and synthesize summary
        try {
          const [afterRep, execRep] = await Promise.all([
            apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/report?kind=after`).catch(()=>({items:[]})),
            apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/report?kind=rollback_exec`).catch(()=>({items:[]})),
          ]);
          const afterItems = afterRep.items || afterRep || [];
          const execItems = execRep.items || execRep || [];
          lastAfterItems = afterItems; lastExecItems = execItems;
          // summarize exec items
          let executed = 0, errors = 0; const typeDist = {};
          execItems.forEach(it => {
            try {
              const snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{});
              const st = (snap.status||'').toLowerCase(); if (st === 'ok') executed++; else errors++;
              const t = snap.action && snap.action.type || ''; if (t) typeDist[t] = (typeDist[t]||0)+1;
            } catch {}
          });
          const total = executed + errors; const successRate = total? ((executed/total)*100).toFixed(1)+'%':'n/a';
          const header = `After 报告 (items=${afterItems.length})\nExec 汇总: executed=${executed} errors=${errors} success=${successRate} dist=${JSON.stringify(typeDist)}`;
          if (baReport) baReport.textContent = header + '\n' + JSON.stringify(afterItems, null, 2);
        } catch {}
        if (baPollTimer) { clearInterval(baPollTimer); baPollTimer = null; }
      }
    } catch (e) {
      if (baStatus) baStatus.textContent = `轮询失败: ${e.message}`;
    }
  }
  if (baPollBtn) baPollBtn.onclick = () => {
    if (baPollTimer) clearInterval(baPollTimer);
    pollBulkOnce();
    baPollTimer = setInterval(pollBulkOnce, 3000);
  };
  if (baStopPollBtn) baStopPollBtn.onclick = () => { if (baPollTimer) { clearInterval(baPollTimer); baPollTimer = null; if (baStatus) baStatus.textContent = '已停止轮询'; } };

  if (baLoadPlanBtn) baLoadPlanBtn.onclick = async () => {
    const id = (baOpId && baOpId.value || '').trim(); if (!id) { alert('请输入 Operation ID'); return; }
    try {
      const plan = await apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/plan`);
      lastPlan = plan;
      if (baReport) baReport.textContent = 'Plan:\n' + JSON.stringify(plan, null, 2);
    } catch (e) { alert(e.message); }
  };

  if (baExportAfterBtn) baExportAfterBtn.onclick = () => {
    if (!lastAfterItems || !lastAfterItems.length) { alert('暂无 After 报告可导出'); return; }
    downloadFile('bulk-after.json', 'application/json', JSON.stringify(lastAfterItems, null, 2));
  };
  if (baExportExecCsvBtn) baExportExecCsvBtn.onclick = () => {
    const items = lastExecItems || [];
    if (!items.length) { alert('暂无 Exec 记录可导出'); return; }
    let csv = 'when,type,status\n';
    items.forEach(it => {
      let t = '', st = '', when = it.createdAt || '';
      try { const snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{}); t = snap.action && snap.action.type || ''; st = snap.status || ''; } catch {}
      const line = [when, t, st].map(v=>JSON.stringify(v??'')).join(',');
      csv += line + '\n';
    });
    downloadFile('bulk-exec.csv', 'text/csv', csv);
  };
  if (baExportPlanBtn) baExportPlanBtn.onclick = () => {
    if (!lastPlan) { alert('请先查看 Plan'); return; }
    downloadFile('bulk-plan.json', 'application/json', JSON.stringify(lastPlan, null, 2));
  };

  if (baExportBundleBtn) baExportBundleBtn.onclick = async () => {
    const id = (baOpId && baOpId.value || '').trim(); if (!id) { alert('请输入 Operation ID'); return; }
    try {
      // Fetch latest status/plan/after/exec best-effort
      const [op, plan, afterRep, execRep] = await Promise.all([
        apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}`).catch(()=>({})),
        apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/plan`).catch(()=>null),
        apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/report?kind=after`).catch(()=>({items:[]})),
        apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/report?kind=rollback_exec`).catch(()=>({items:[]})),
      ]);
      const afterItems = (afterRep && (afterRep.items||afterRep)) || [];
      const execItems = (execRep && (execRep.items||execRep)) || [];
      // summarize exec
      let executed = 0, errors = 0; const typeDist = {};
      execItems.forEach(it => {
        try { const snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{}); const st=(snap.status||'').toLowerCase(); if (st==='ok') executed++; else errors++; const t = snap.action && snap.action.type || ''; if (t) typeDist[t]=(typeDist[t]||0)+1; } catch {}
      });
      const total = executed + errors; const successRate = total? ((executed/total)*100).toFixed(1)+'%':'n/a';
      const bundle = {
        operationId: id,
        status: op.status || 'unknown',
        updatedAt: op.updatedAt || null,
        summary: { executed, errors, successRate, typeDist },
        plan: plan || lastPlan,
        after: afterItems,
        exec: execItems,
      };
      downloadFile(`bulk-report-${id}.json`, 'application/json', JSON.stringify(bundle, null, 2));
    } catch (e) { alert(e.message); }
  };

  // Bulk audits list
  let lastAudits = [];
  async function loadAuditsList() {
    if (!baList) return;
    const id = (baListOpId && baListOpId.value || '').trim();
    const kind = (baListKind && baListKind.value || '').trim();
    if (!id) { baList.textContent = '请输入 Operation ID'; return; }
    baList.textContent = '加载中...';
    try {
      const j = await apiGet(`/api/v1/adscenter/bulk-actions/${encodeURIComponent(id)}/audits`);
      const items = j.items || j || [];
      lastAudits = items;
      const filtered = kind ? items.filter(it => (it.kind||'') === kind) : items;
      if (!filtered.length) { baList.textContent = '无数据'; return; }
      const rows = filtered.map(it => {
        let summary = '';
        try {
          const snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{});
          if (it.kind === 'other') {
            summary = (snap.type || '') + (snap.actionIndex!==undefined?` #${snap.actionIndex}`:'');
          } else if (it.kind === 'before') {
            const ac = Array.isArray(snap.actions) ? snap.actions.length : 0;
            summary = `plan actions=${ac}`;
          } else if (it.kind === 'after') {
            summary = snap.summary && snap.summary.status ? `status=${snap.summary.status}` : '';
          } else if (it.kind === 'rollback' || it.kind === 'rollback_exec') {
            summary = snap.status ? `status=${snap.status}` : '';
          }
        } catch {}
        const when = it.createdAt ? new Date(it.createdAt).toLocaleString() : '';
        return `<tr><td>${it.kind}</td><td>${when}</td><td>${summary||'-'}</td></tr>`;
      }).join('');
      baList.innerHTML = '<table><thead><tr><th>Kind</th><th>Time</th><th>Summary</th></tr></thead><tbody>'+rows+'</tbody></table>';
    } catch (e) {
      baList.textContent = e.message;
    }
  }
  if (baListLoadBtn) baListLoadBtn.onclick = loadAuditsList;
  if (baListExportBtn) {
    baListExportBtn.onclick = () => {
      const s = JSON.stringify(lastAudits||[], null, 2);
      downloadFile('bulk-audits.json', 'application/json', s);
    };
  }
  const baListExportCsvBtn = document.getElementById('baListExportCsvBtn');
  if (baListExportCsvBtn) {
    baListExportCsvBtn.onclick = () => {
      const items = lastAudits || [];
      if (!items.length) { alert('暂无可导出的审计记录'); return; }
      let csv = 'kind,createdAt,summary\n';
      const toSummary = (it) => {
        try {
          const snap = typeof it.snapshot === 'string' ? JSON.parse(it.snapshot) : (it.snapshot||{});
          if (it.kind === 'other') { return (snap.type||'') + (snap.actionIndex!==undefined?` #${snap.actionIndex}`:''); }
          if (it.kind === 'before') { const ac = Array.isArray(snap.actions)?snap.actions.length:0; return `plan actions=${ac}`; }
          if (it.kind === 'after') { return snap.summary && snap.summary.status ? `status=${snap.summary.status}` : ''; }
          if (it.kind === 'rollback' || it.kind === 'rollback_exec') { return snap.status ? `status=${snap.status}` : ''; }
        } catch {}
        return '';
      };
      items.forEach(it => {
        const line = [it.kind||'', (it.createdAt||''), toSummary(it)].map(v=>JSON.stringify(v??'' )).join(',');
        csv += line + '\n';
      });
      downloadFile('bulk-audits.csv', 'text/csv', csv);
    };
  }
})();
