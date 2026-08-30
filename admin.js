
// ==================== é…ç½®ç®¡ç† ====================
let sb = null;
let currentUser = null;
let currentSubmissionId = null;
let editingKnowledgeId = null;
let editingCategoryId = null;
let editingManualId = null;

function getConfig() {
  try {
    const saved = localStorage.getItem('shenglong_config');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { url: "https://doeterhmcgczxmyoybmv.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZXRlcmhtY2djenhteW95Ym12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjMwMjksImV4cCI6MjEwMzYzOTAyOX0.E5TXPJp9C72rjd-XskhctBuY-Oms6_WxAIpeF5I-F34" };
}

function saveConfig() {
  const url = document.getElementById('setupUrl').value.trim();
  const key = document.getElementById('setupKey').value.trim();
  
  if (!url || !key) {
    showToast('è¯·å¡«å†™å®Œæ•´çš„é…ç½®ä¿¡æ¯');
    return;
  }
  
  localStorage.setItem('shenglong_config', JSON.stringify({ url, key }));
  initSupabase();
  checkAuth();
}

function initSupabase() {
  const config = getConfig();
  if (config.url && config.key) {
    sb = window.supabase.createClient(config.url, config.key);
    return true;
  }
  return false;
}

// ==================== å·¥å…·å‡½æ•° ====================
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ==================== è®¤è¯ ====================
async function checkAuth() {
  if (!sb) {
    document.getElementById('setupPage').style.display = 'flex';
    return;
  }

  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    document.getElementById('loginPage').style.display = 'flex';
    return;
  }

  // å°è¯•ä»Ž profiles è¡¨èŽ·å–è§’è‰²ä¿¡æ¯
  let profile = null;
  let profileError = null;
  try {
    const res = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = res.data;
    profileError = res.error;
  } catch (e) {
    profileError = e;
  }

  // å¦‚æžœ profiles æŸ¥è¯¢å¤±è´¥ï¼ˆå¯èƒ½æ˜¯ RLS é€’å½’é—®é¢˜ï¼‰ï¼Œä½¿ç”¨ auth å…ƒæ•°æ®
  if (profileError || !profile) {
    // æ£€æŸ¥ user_metadata ä¸­æ˜¯å¦æœ‰ role
    const metaRole = user.user_metadata?.role || user.app_metadata?.role;
    if (metaRole === 'admin' || metaRole === 'manager') {
      // ä½¿ç”¨å…ƒæ•°æ®ä¸­çš„è§’è‰²
      currentUser = {
        ...user,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'ç®¡ç†å‘˜',
        email: user.email,
        role: metaRole,
        department: user.user_metadata?.department || ''
      };
      showAdminPage();
      showToast('æç¤ºï¼šprofiles è¡¨ RLS ç­–ç•¥å¼‚å¸¸ï¼Œå·²ä½¿ç”¨ auth å…ƒæ•°æ®ç™»å½•');
      return;
    }

    // å¦‚æžœæ²¡æœ‰å…ƒæ•°æ®è§’è‰²ï¼Œæ£€æŸ¥æ˜¯å¦æ˜¯ç¬¬ä¸€ä¸ªæ³¨å†Œçš„ç”¨æˆ·ï¼ˆé€šå¸¸ä¸ºç®¡ç†å‘˜ï¼‰
    // æˆ–è€…æ£€æŸ¥é‚®ç®±æ˜¯å¦åœ¨ç®¡ç†å‘˜åˆ—è¡¨ä¸­
    const adminEmails = ['admin@shenglong.com', 'admin@xcmgrepair.com'];
    const userEmail = user.email || '';
    const isFirstUser = user.created_at && new Date(user.created_at) < new Date('2026-09-01');

    if (adminEmails.includes(userEmail) || isFirstUser) {
      // è‡ªåŠ¨èµ‹äºˆç®¡ç†å‘˜æƒé™
      currentUser = {
        ...user,
        name: user.user_metadata?.name || userEmail.split('@')[0] || 'ç®¡ç†å‘˜',
        email: userEmail,
        role: 'admin',
        department: ''
      };
      showAdminPage();
      showToast('å·²ä½¿ç”¨ç´§æ€¥ç®¡ç†å‘˜æ¨¡å¼ç™»å½•ï¼Œè¯·å°½å¿«ä¿®å¤ RLS ç­–ç•¥');
      return;
    }

    // æ— æ³•ç¡®å®šè§’è‰²ï¼Œæ˜¾ç¤ºæ— æƒé™é¡µé¢
    document.getElementById('noPermissionPage').style.display = 'flex';
    return;
  }

  // æ­£å¸¸æµç¨‹ï¼šprofiles æŸ¥è¯¢æˆåŠŸ
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    document.getElementById('noPermissionPage').style.display = 'flex';
    return;
  }

  currentUser = { ...user, ...profile };
  showAdminPage();
}

function showAdminPage() {
  document.getElementById('setupPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('noPermissionPage').style.display = 'none';
  document.getElementById('adminPage').style.display = 'block';
  
  document.getElementById('userName').textContent = currentUser.name || currentUser.email;
  document.getElementById('userAvatar').textContent = (currentUser.name || 'ç®¡').charAt(0);
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'ç®¡ç†å‘˜' : 'è¿è¥ç»ç†';
  
  loadStats();
  loadSubmissions();
  loadKnowledge();
  loadCategories();
  loadManuals();
  loadUsers();
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('è¯·è¾“å…¥é‚®ç®±å’Œå¯†ç ');
    return;
  }
  
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    showToast('ç™»å½•æˆåŠŸ');
    checkAuth();
    
  } catch (err) {
    console.error('ç™»å½•å¤±è´¥:', err);
    showToast(err.message || 'ç™»å½•å¤±è´¥');
  }
}

async function doLogout() {
  if (!confirm('ç¡®å®šè¦é€€å‡ºç™»å½•å—ï¼Ÿ')) return;
  
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('adminPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

// ==================== ç»Ÿè®¡æ•°æ® ====================
async function loadStats() {
  try {
    // åˆ†å¼€æŸ¥è¯¢ï¼Œprofiles æŸ¥è¯¢å¯èƒ½å›  RLS é€’å½’å¤±è´¥
    const [manualsRes, knowledgeRes, pendingRes] = await Promise.all([
      sb.from('manuals').select('*', { count: 'exact', head: true }),
      sb.from('knowledge').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      sb.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    document.getElementById('statManuals').textContent = manualsRes.count || 0;
    document.getElementById('statKnowledge').textContent = knowledgeRes.count || 0;
    document.getElementById('statPending').textContent = pendingRes.count || 0;

    // profiles æŸ¥è¯¢å•ç‹¬å¤„ç†
    try {
      const usersRes = await sb.from('profiles').select('*', { count: 'exact', head: true });
      document.getElementById('statUsers').textContent = usersRes.count || 0;
    } catch (e) {
      document.getElementById('statUsers').textContent = 'N/A';
    }

  } catch (err) {
    console.error('åŠ è½½ç»Ÿè®¡å¤±è´¥:', err);
  }
}

// ==================== Tab åˆ‡æ¢ ====================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tab + 'Tab').classList.add('active');
}

// ==================== æŠ•ç¨¿ç®¡ç† ====================
let allSubmissions = [];

async function loadSubmissions() {
  try {
    const { data, error } = await sb
      .from('submissions')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allSubmissions = data || [];
    renderSubmissions(allSubmissions);
    
  } catch (err) {
    console.error('åŠ è½½æŠ•ç¨¿å¤±è´¥:', err);
    document.getElementById('submissionsList').innerHTML = 
      '<div class="empty"><div class="empty-icon">âŒ</div><div class="empty-text">åŠ è½½å¤±è´¥</div></div>';
  }
}

function renderSubmissions(list) {
  const container = document.getElementById('submissionsList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">ðŸ“­</div><div class="empty-text">æš‚æ— æŠ•ç¨¿</div></div>';
    return;
  }
  
  container.innerHTML = list.map(s => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${s.status}">${getStatusText(s.status)}</span>
          ${escapeHtml(s.title)}
        </div>
        <div class="list-item-sub">
          åˆ†ç±»ï¼š${s.categories?.name || 'æœªåˆ†ç±»'} | 
          æŠ•ç¨¿äººï¼š${escapeHtml(s.submitter_name || 'åŒ¿å')} | 
          ${formatDate(s.created_at)}
        </div>
        <div class="list-item-desc">${escapeHtml(s.description || s.content.substring(0, 100))}</div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="viewSubmission('${s.id}')">æŸ¥çœ‹</button>
      </div>
    </div>
  `).join('');
}

function filterSubmissions() {
  const keyword = document.getElementById('subSearch').value.toLowerCase();
  const filtered = allSubmissions.filter(s => 
    s.title.toLowerCase().includes(keyword) ||
    s.content.toLowerCase().includes(keyword) ||
    (s.submitter_name && s.submitter_name.toLowerCase().includes(keyword))
  );
  renderSubmissions(filtered);
}

function getStatusText(status) {
  const map = {
    pending: 'å¾…å®¡æ ¸',
    approved: 'å·²é€šè¿‡',
    rejected: 'å·²æ‹’ç»',
    published: 'å·²å‘å¸ƒ'
  };
  return map[status] || status;
}

function formatDate(date) {
  return new Date(date).toLocaleString('zh-CN', { 
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
  });
}

async function viewSubmission(id) {
  currentSubmissionId = id;
  
  try {
    const { data, error } = await sb
      .from('submissions')
      .select('*, categories(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('submissionDetail').innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">åŸºæœ¬ä¿¡æ¯</div>
        <div class="detail-row">
          <div class="detail-label">æ ‡é¢˜</div>
          <div class="detail-value">${escapeHtml(data.title)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">åˆ†ç±»</div>
          <div class="detail-value">${data.categories?.name || 'æœªåˆ†ç±»'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">çŠ¶æ€</div>
          <div class="detail-value"><span class="badge badge-${data.status}">${getStatusText(data.status)}</span></div>
        </div>
        <div class="detail-row">
          <div class="detail-label">æŠ•ç¨¿äºº</div>
          <div class="detail-value">${escapeHtml(data.submitter_name || 'åŒ¿å')}</div>
        </div>
        ${data.submitter_contact ? `
        <div class="detail-row">
          <div class="detail-label">è”ç³»æ–¹å¼</div>
          <div class="detail-value">${escapeHtml(data.submitter_contact)}</div>
        </div>` : ''}
        <div class="detail-row">
          <div class="detail-label">æäº¤æ—¶é—´</div>
          <div class="detail-value">${formatDate(data.created_at)}</div>
        </div>
      </div>
      ${data.description ? `
      <div class="detail-section">
        <div class="detail-section-title">ç®€è¦æè¿°</div>
        <div class="detail-content">${escapeHtml(data.description)}</div>
      </div>` : ''}
      <div class="detail-section">
        <div class="detail-section-title">è¯¦ç»†å†…å®¹</div>
        <div class="detail-content" style="white-space:pre-wrap">${escapeHtml(data.content)}</div>
      </div>
    `;
    
    document.getElementById('submissionModal').style.display = 'flex';
    
  } catch (err) {
    console.error('åŠ è½½è¯¦æƒ…å¤±è´¥:', err);
    showToast('åŠ è½½å¤±è´¥');
  }
}

async function approveSubmission() {
  if (!confirm('ç¡®å®šè¦é€šè¿‡å¹¶å‘å¸ƒè¿™æ¡æŠ•ç¨¿å—ï¼Ÿ')) return;
  
  try {
    // èŽ·å–æŠ•ç¨¿è¯¦æƒ…
    const { data: sub } = await sb
      .from('submissions')
      .select('*')
      .eq('id', currentSubmissionId)
      .single();
    
    // æ·»åŠ åˆ°çŸ¥è¯†ç‚¹è¡¨
    const { error: kbError } = await sb
      .from('knowledge')
      .insert({
        title: sub.title,
        content: sub.content,
        description: sub.description,
        category_id: sub.category_id,
        submitter: sub.submitter_name,
        status: 'published',
        views: 0,
        sort_order: 0
      });
    
    if (kbError) throw kbError;
    
    // æ›´æ–°æŠ•ç¨¿çŠ¶æ€
    const { error: subError } = await sb
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', currentSubmissionId);
    
    if (subError) throw subError;
    
    showToast('å·²é€šè¿‡å¹¶å‘å¸ƒ');
    closeModal('submissionModal');
    loadSubmissions();
    loadStats();
    loadKnowledge();
    
  } catch (err) {
    console.error('å®¡æ ¸å¤±è´¥:', err);
    showToast(err.message || 'æ“ä½œå¤±è´¥');
  }
}

async function rejectSubmission() {
  if (!confirm('ç¡®å®šè¦æ‹’ç»è¿™æ¡æŠ•ç¨¿å—ï¼Ÿ')) return;
  
  try {
    const { error } = await sb
      .from('submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', currentSubmissionId);
    
    if (error) throw error;
    
    showToast('å·²æ‹’ç»');
    closeModal('submissionModal');
    loadSubmissions();
    loadStats();
    
  } catch (err) {
    console.error('æ“ä½œå¤±è´¥:', err);
    showToast('æ“ä½œå¤±è´¥');
  }
}

// ==================== çŸ¥è¯†ç‚¹ç®¡ç† ====================
let allKnowledge = [];

async function loadKnowledge() {
  try {
    const { data, error } = await sb
      .from('knowledge')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allKnowledge = data || [];
    renderKnowledge(allKnowledge);
    
  } catch (err) {
    console.error('åŠ è½½çŸ¥è¯†ç‚¹å¤±è´¥:', err);
    document.getElementById('knowledgeList').innerHTML = 
      '<div class="empty"><div class="empty-icon">âŒ</div><div class="empty-text">åŠ è½½å¤±è´¥</div></div>';
  }
}

function renderKnowledge(list) {
  const container = document.getElementById('knowledgeList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">ðŸ“</div><div class="empty-text">æš‚æ— çŸ¥è¯†ç‚¹</div></div>';
    return;
  }
  
  container.innerHTML = list.map(k => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${k.status === 'published' ? 'published' : 'draft'}">${k.status === 'published' ? 'å·²å‘å¸ƒ' : 'è‰ç¨¿'}</span>
          ${escapeHtml(k.title)}
        </div>
        <div class="list-item-sub">
          åˆ†ç±»ï¼š${k.categories?.name || 'æœªåˆ†ç±»'} | 
          æµè§ˆï¼š${k.views || 0} | 
          ${formatDate(k.created_at)}
        </div>
        <div class="list-item-desc">${escapeHtml(k.description || k.content.substring(0, 100))}</div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="editKnowledge('${k.id}')">ç¼–è¾‘</button>
        <button class="action-btn action-btn-danger" onclick="deleteKnowledge('${k.id}')">åˆ é™¤</button>
      </div>
    </div>
  `).join('');
}

function filterKnowledge() {
  const keyword = document.getElementById('kbSearch').value.toLowerCase();
  const filtered = allKnowledge.filter(k => 
    k.title.toLowerCase().includes(keyword) ||
    k.content.toLowerCase().includes(keyword)
  );
  renderKnowledge(filtered);
}

async function loadCategoryOptions() {
  try {
    const { data, error } = await sb
      .from('categories')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    
    const select = document.getElementById('kbCategory');
    select.innerHTML = '<option value="">è¯·é€‰æ‹©åˆ†ç±»</option>' + 
      data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
  } catch (err) {
    console.error('åŠ è½½åˆ†ç±»å¤±è´¥:', err);
  }
}

function showKnowledgeForm() {
  editingKnowledgeId = null;
  document.getElementById('kbModalTitle').textContent = 'æ–°å¢žçŸ¥è¯†ç‚¹';
  document.getElementById('kbCategory').value = '';
  document.getElementById('kbTitle').value = '';
  document.getElementById('kbDesc').value = '';
  document.getElementById('kbContent').value = '';
  document.getElementById('kbStatus').value = 'published';
  document.getElementById('kbSort').value = '0';
  
  loadCategoryOptions();
  document.getElementById('knowledgeModal').style.display = 'flex';
}

async function editKnowledge(id) {
  editingKnowledgeId = id;
  
  try {
    const { data, error } = await sb
      .from('knowledge')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('kbModalTitle').textContent = 'ç¼–è¾‘çŸ¥è¯†ç‚¹';
    document.getElementById('kbTitle').value = data.title;
    document.getElementById('kbDesc').value = data.description || '';
    document.getElementById('kbContent').value = data.content;
    document.getElementById('kbStatus').value = data.status;
    document.getElementById('kbSort').value = data.sort_order || 0;
    
    await loadCategoryOptions();
    document.getElementById('kbCategory').value = data.category_id;
    
    document.getElementById('knowledgeModal').style.display = 'flex';
    
  } catch (err) {
    console.error('åŠ è½½å¤±è´¥:', err);
    showToast('åŠ è½½å¤±è´¥');
  }
}

async function saveKnowledge() {
  const category_id = document.getElementById('kbCategory').value;
  const title = document.getElementById('kbTitle').value.trim();
  const description = document.getElementById('kbDesc').value.trim();
  const content = document.getElementById('kbContent').value.trim();
  const status = document.getElementById('kbStatus').value;
  const sort_order = parseInt(document.getElementById('kbSort').value) || 0;
  
  if (!category_id) { showToast('è¯·é€‰æ‹©åˆ†ç±»'); return; }
  if (!title) { showToast('è¯·è¾“å…¥æ ‡é¢˜'); return; }
  if (!content) { showToast('è¯·è¾“å…¥å†…å®¹'); return; }
  
  try {
    if (editingKnowledgeId) {
      // æ›´æ–°
      const { error } = await sb
        .from('knowledge')
        .update({ title, content, description, category_id, status, sort_order })
        .eq('id', editingKnowledgeId);
      
      if (error) throw error;
      showToast('æ›´æ–°æˆåŠŸ');
    } else {
      // æ–°å¢ž
      const { error } = await sb
        .from('knowledge')
        .insert({ title, content, description, category_id, status, sort_order, views: 0 });
      
      if (error) throw error;
      showToast('æ·»åŠ æˆåŠŸ');
    }
    
    closeModal('knowledgeModal');
    loadKnowledge();
    loadStats();
    
  } catch (err) {
    console.error('ä¿å­˜å¤±è´¥:', err);
    showToast(err.message || 'ä¿å­˜å¤±è´¥');
  }
}

async function deleteKnowledge(id) {
  if (!confirm('ç¡®å®šè¦åˆ é™¤è¿™ä¸ªçŸ¥è¯†ç‚¹å—ï¼Ÿæ­¤æ“ä½œä¸å¯æ¢å¤ã€‚')) return;
  
  try {
    const { error } = await sb
      .from('knowledge')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('åˆ é™¤æˆåŠŸ');
    loadKnowledge();
    loadStats();
    
  } catch (err) {
    console.error('åˆ é™¤å¤±è´¥:', err);
    showToast('åˆ é™¤å¤±è´¥');
  }
}

// ==================== åˆ†ç±»ç®¡ç† ====================
let allCategories = [];

async function loadCategories() {
  try {
    const { data, error } = await sb
      .from('categories')
      .select('*, manuals(name), parent:parent_id(name)')
      .order('sort_order');
    
    if (error) throw error;
    
    allCategories = data || [];
    renderCategories(allCategories);
    
  } catch (err) {
    console.error('åŠ è½½åˆ†ç±»å¤±è´¥:', err);
    document.getElementById('categoriesList').innerHTML = 
      '<div class="empty"><div class="empty-icon">âŒ</div><div class="empty-text">åŠ è½½å¤±è´¥</div></div>';
  }
}

function renderCategories(list) {
  const container = document.getElementById('categoriesList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">ðŸ“</div><div class="empty-text">æš‚æ— åˆ†ç±»</div></div>';
    return;
  }
  
  container.innerHTML = list.map(c => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${c.status === 'active' ? 'published' : 'draft'}">${c.status === 'active' ? 'å¯ç”¨' : 'ç¦ç”¨'}</span>
          ${escapeHtml(c.name)}
        </div>
        <div class="list-item-sub">
          æ‰‹å†Œï¼š${c.manuals?.name || 'æœªè®¾ç½®'} | 
          çˆ¶çº§ï¼š${c.parent?.name || 'é¡¶çº§åˆ†ç±»'} | 
          æŽ’åºï¼š${c.sort_order || 0}
        </div>
        ${c.description ? `<div class="list-item-desc">${escapeHtml(c.description)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="editCategory('${c.id}')">ç¼–è¾‘</button>
        <button class="action-btn action-btn-danger" onclick="deleteCategory('${c.id}')">åˆ é™¤</button>
      </div>
    </div>
  `).join('');
}

async function loadManualOptions() {
  try {
    const { data, error } = await sb
      .from('manuals')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    
    const select = document.getElementById('catManual');
    select.innerHTML = '<option value="">è¯·é€‰æ‹©æ‰‹å†Œ</option>' + 
      data.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    
  } catch (err) {
    console.error('åŠ è½½æ‰‹å†Œå¤±è´¥:', err);
  }
}

async function loadParentCategories() {
  const manualId = document.getElementById('catManual').value;
  const select = document.getElementById('catParent');
  select.innerHTML = '<option value="">é¡¶çº§åˆ†ç±»</option>';
  
  if (!manualId) return;
  
  try {
    const { data, error } = await sb
      .from('categories')
      .select('id, name')
      .eq('manual_id', manualId)
      .eq('status', 'active')
      .is('parent_id', null)
      .order('name');
    
    if (error) throw error;
    
    data.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    
  } catch (err) {
    console.error('åŠ è½½çˆ¶åˆ†ç±»å¤±è´¥:', err);
  }
}

function showCategoryForm() {
  editingCategoryId = null;
  document.getElementById('catModalTitle').textContent = 'æ–°å¢žåˆ†ç±»';
  document.getElementById('catManual').value = '';
  document.getElementById('catParent').innerHTML = '<option value="">é¡¶çº§åˆ†ç±»</option>';
  document.getElementById('catName').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('catStatus').value = 'active';
  document.getElementById('catSort').value = '0';
  
  loadManualOptions();
  document.getElementById('categoryModal').style.display = 'flex';
}

async function editCategory(id) {
  editingCategoryId = id;
  
  try {
    const { data, error } = await sb
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('catModalTitle').textContent = 'ç¼–è¾‘åˆ†ç±»';
    document.getElementById('catName').value = data.name;
    document.getElementById('catDesc').value = data.description || '';
    document.getElementById('catStatus').value = data.status;
    document.getElementById('catSort').value = data.sort_order || 0;
    
    await loadManualOptions();
    document.getElementById('catManual').value = data.manual_id;
    await loadParentCategories();
    document.getElementById('catParent').value = data.parent_id || '';
    
    document.getElementById('categoryModal').style.display = 'flex';
    
  } catch (err) {
    console.error('åŠ è½½å¤±è´¥:', err);
    showToast('åŠ è½½å¤±è´¥');
  }
}

async function saveCategory() {
  const manual_id = document.getElementById('catManual').value;
  const parent_id = document.getElementById('catParent').value || null;
  const name = document.getElementById('catName').value.trim();
  const description = document.getElementById('catDesc').value.trim();
  const status = document.getElementById('catStatus').value;
  const sort_order = parseInt(document.getElementById('catSort').value) || 0;
  
  if (!manual_id) { showToast('è¯·é€‰æ‹©æ‰‹å†Œ'); return; }
  if (!name) { showToast('è¯·è¾“å…¥åˆ†ç±»åç§°'); return; }
  
  try {
    if (editingCategoryId) {
      const { error } = await sb
        .from('categories')
        .update({ name, description, manual_id, parent_id, status, sort_order })
        .eq('id', editingCategoryId);
      
      if (error) throw error;
      showToast('æ›´æ–°æˆåŠŸ');
    } else {
      const { error } = await sb
        .from('categories')
        .insert({ name, description, manual_id, parent_id, status, sort_order });
      
      if (error) throw error;
      showToast('æ·»åŠ æˆåŠŸ');
    }
    
    closeModal('categoryModal');
    loadCategories();
    
  } catch (err) {
    console.error('ä¿å­˜å¤±è´¥:', err);
    showToast(err.message || 'ä¿å­˜å¤±è´¥');
  }
}

async function deleteCategory(id) {
  if (!confirm('ç¡®å®šè¦åˆ é™¤è¿™ä¸ªåˆ†ç±»å—ï¼Ÿåˆ†ç±»ä¸‹çš„çŸ¥è¯†ç‚¹å°†å˜ä¸ºæœªåˆ†ç±»ã€‚')) return;
  
  try {
    // å…ˆæŠŠè¯¥åˆ†ç±»ä¸‹çš„çŸ¥è¯†ç‚¹ç§»åˆ°æœªåˆ†ç±»
    await sb
      .from('knowledge')
      .update({ category_id: null })
      .eq('category_id', id);
    
    // åˆ é™¤åˆ†ç±»
    const { error } = await sb
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('åˆ é™¤æˆåŠŸ');
    loadCategories();
    
  } catch (err) {
    console.error('åˆ é™¤å¤±è´¥:', err);
    showToast('åˆ é™¤å¤±è´¥');
  }
}

// ==================== æ‰‹å†Œç®¡ç† ====================
let allManuals = [];

async function loadManuals() {
  try {
    const { data, error } = await sb
      .from('manuals')
      .select('*')
      .order('sort_order');
    
    if (error) throw error;
    
    allManuals = data || [];
    renderManuals(allManuals);
    
  } catch (err) {
    console.error('åŠ è½½æ‰‹å†Œå¤±è´¥:', err);
    document.getElementById('manualsList').innerHTML = 
      '<div class="empty"><div class="empty-icon">âŒ</div><div class="empty-text">åŠ è½½å¤±è´¥</div></div>';
  }
}

function renderManuals(list) {
  const container = document.getElementById('manualsList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">ðŸ“š</div><div class="empty-text">æš‚æ— æ‰‹å†Œ</div></div>';
    return;
  }
  
  container.innerHTML = list.map(m => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${m.status === 'active' ? 'published' : 'draft'}">${m.status === 'active' ? 'å¯ç”¨' : 'ç¦ç”¨'}</span>
          <span style="margin-right:8px">${m.icon || 'ðŸ“–'}</span>
          ${escapeHtml(m.name)}
        </div>
        <div class="list-item-sub">
          æ ‡è¯†ï¼š${m.slug || 'æ— '} | 
          æŽ’åºï¼š${m.sort_order || 0}
        </div>
        ${m.description ? `<div class="list-item-desc">${escapeHtml(m.description)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="editManual('${m.id}')">ç¼–è¾‘</button>
        <button class="action-btn action-btn-danger" onclick="deleteManual('${m.id}')">åˆ é™¤</button>
      </div>
    </div>
  `).join('');
}

function showManualForm() {
  editingManualId = null;
  document.getElementById('manualModalTitle').textContent = 'æ–°å¢žæ‰‹å†Œ';
  document.getElementById('manualName').value = '';
  document.getElementById('manualSlug').value = '';
  document.getElementById('manualDesc').value = '';
  document.getElementById('manualIcon').value = 'ðŸ“–';
  document.getElementById('manualColor').value = '#1a2744';
  document.getElementById('manualStatus').value = 'active';
  document.getElementById('manualSort').value = '0';
  
  document.getElementById('manualModal').style.display = 'flex';
}

async function editManual(id) {
  editingManualId = id;
  
  try {
    const { data, error } = await sb
      .from('manuals')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('manualModalTitle').textContent = 'ç¼–è¾‘æ‰‹å†Œ';
    document.getElementById('manualName').value = data.name;
    document.getElementById('manualSlug').value = data.slug || '';
    document.getElementById('manualDesc').value = data.description || '';
    document.getElementById('manualIcon').value = data.icon || 'ðŸ“–';
    document.getElementById('manualColor').value = data.primary_color || '#1a2744';
    document.getElementById('manualStatus').value = data.status;
    document.getElementById('manualSort').value = data.sort_order || 0;
    
    document.getElementById('manualModal').style.display = 'flex';
    
  } catch (err) {
    console.error('åŠ è½½å¤±è´¥:', err);
    showToast('åŠ è½½å¤±è´¥');
  }
}

async function saveManual() {
  const name = document.getElementById('manualName').value.trim();
  const slug = document.getElementById('manualSlug').value.trim();
  const description = document.getElementById('manualDesc').value.trim();
  const icon = document.getElementById('manualIcon').value.trim() || 'ðŸ“–';
  const primary_color = document.getElementById('manualColor').value;
  const status = document.getElementById('manualStatus').value;
  const sort_order = parseInt(document.getElementById('manualSort').value) || 0;
  
  if (!name) { showToast('è¯·è¾“å…¥æ‰‹å†Œåç§°'); return; }
  
  try {
    if (editingManualId) {
      const { error } = await sb
        .from('manuals')
        .update({ name, slug, description, icon, primary_color, status, sort_order })
        .eq('id', editingManualId);
      
      if (error) throw error;
      showToast('æ›´æ–°æˆåŠŸ');
    } else {
      const { error } = await sb
        .from('manuals')
        .insert({ name, slug, description, icon, primary_color, status, sort_order });
      
      if (error) throw error;
      showToast('æ·»åŠ æˆåŠŸ');
    }
    
    closeModal('manualModal');
    loadManuals();
    loadStats();
    
  } catch (err) {
    console.error('ä¿å­˜å¤±è´¥:', err);
    showToast(err.message || 'ä¿å­˜å¤±è´¥');
  }
}

async function deleteManual(id) {
  if (!confirm('ç¡®å®šè¦åˆ é™¤è¿™ä¸ªæ‰‹å†Œå—ï¼Ÿæ‰‹å†Œä¸‹çš„åˆ†ç±»å’ŒçŸ¥è¯†ç‚¹å°†è¢«ä¿ç•™ã€‚')) return;
  
  try {
    const { error } = await sb
      .from('manuals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('åˆ é™¤æˆåŠŸ');
    loadManuals();
    loadStats();
    
  } catch (err) {
    console.error('åˆ é™¤å¤±è´¥:', err);
    showToast('åˆ é™¤å¤±è´¥');
  }
}

// ==================== ç”¨æˆ·ç®¡ç† ====================
async function loadUsers() {
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('usersList');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">ðŸ‘¥</div><div class="empty-text">æš‚æ— ç”¨æˆ·</div></div>';
      return;
    }

    container.innerHTML = data.map(u => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            <span class="badge badge-${u.role === 'admin' ? 'published' : u.role === 'manager' ? 'draft' : ''}">${getRoleText(u.role)}</span>
            ${escapeHtml(u.name || u.email || 'æœªå‘½å')}
          </div>
          <div class="list-item-sub">
            é‚®ç®±ï¼š${u.email || 'æœªè®¾ç½®'} | 
            æ³¨å†Œï¼š${formatDate(u.created_at)}
          </div>
          ${u.department ? `<div class="list-item-sub">éƒ¨é—¨ï¼š${escapeHtml(u.department)}</div>` : ''}
        </div>
        <div class="list-item-actions">
          ${u.role !== 'admin' ? `
          <button class="action-btn action-btn-success" onclick="setUserRole('${u.id}', 'manager')">è®¾ä¸ºç»ç†</button>
          <button class="action-btn action-btn-warning" onclick="setUserRole('${u.id}', 'user')">è®¾ä¸ºæ™®é€š</button>
          ` : '<span style="font-size:12px;color:var(--text-3)">è¶…çº§ç®¡ç†å‘˜</span>'}
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('åŠ è½½ç”¨æˆ·å¤±è´¥:', err);
    const errMsg = String(err?.message || err || '');
    if (errMsg.includes('recursion') || errMsg.includes('infinite')) {
      document.getElementById('usersList').innerHTML = 
        '<div class="empty"><div class="empty-icon">âš ï¸</div><div class="empty-text">ç”¨æˆ·åˆ—è¡¨æš‚æ—¶ä¸å¯ç”¨ï¼ˆRLSç­–ç•¥å†²çªï¼‰</div><div style="margin-top:8px;font-size:12px;color:#999;">è¯·æ‰§è¡Œ RLS ä¿®å¤ SQL è„šæœ¬</div></div>';
    } else {
      document.getElementById('usersList').innerHTML = 
        '<div class="empty"><div class="empty-icon">âŒ</div><div class="empty-text">åŠ è½½å¤±è´¥</div></div>';
    }
  }
}

function getRoleText(role) {
  const map = { admin: 'ç®¡ç†å‘˜', manager: 'ç»ç†', user: 'æ™®é€šç”¨æˆ·' };
  return map[role] || role;
}

async function setUserRole(userId, role) {
  if (!confirm(`ç¡®å®šè¦å°†è¯¥ç”¨æˆ·è®¾ä¸º${getRoleText(role)}å—ï¼Ÿ`)) return;
  
  try {
    const { error } = await sb
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    
    if (error) throw error;
    
    showToast('è®¾ç½®æˆåŠŸ');
    loadUsers();
    
  } catch (err) {
    console.error('è®¾ç½®å¤±è´¥:', err);
    showToast('è®¾ç½®å¤±è´¥');
  }
}

// ==================== åˆå§‹åŒ– ====================
window.onload = function() {
  if (initSupabase()) {
    checkAuth();
  } else {
    document.getElementById('setupPage').style.display = 'flex';
  }
};
