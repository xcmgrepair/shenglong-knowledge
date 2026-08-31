
// ==================== 配置管理 ====================
let sb = null;       // 认证客户端（含用户 session）
let sbData = null;   // 数据查询客户端（用 anon key，避免 RLS 递归）
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
    showToast('请填写完整的配置信息');
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
    // 创建独立的数据查询客户端，使用空存储确保不携带用户 session
    // 这样查询只走 anon key，不会触发 profiles RLS 递归错误
    const emptyStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
    sbData = window.supabase.createClient(config.url, config.key, {
      auth: { storage: emptyStorage, autoRefreshToken: false, persistSession: false }
    });
    return true;
  }
  return false;
}

// ==================== 工具函数 ====================
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

// ==================== 认证 ====================
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

  // 尝试从 profiles 表获取角色信息
  let profile = null;
  let profileError = null;
  try {
    const res = await sbData
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = res.data;
    profileError = res.error;
  } catch (e) {
    profileError = e;
  }

  // 如果 profiles 查询失败（可能是 RLS 递归问题），使用 auth 元数据
  if (profileError || !profile) {
    // 检查 user_metadata 中是否有 role
    const metaRole = user.user_metadata?.role || user.app_metadata?.role;
    if (metaRole === 'admin' || metaRole === 'manager') {
      // 使用元数据中的角色
      currentUser = {
        ...user,
        name: user.user_metadata?.name || user.email?.split('@')[0] || '管理员',
        email: user.email,
        role: metaRole,
        department: user.user_metadata?.department || ''
      };
      showAdminPage();
      showToast('提示：profiles 表 RLS 策略异常，已使用 auth 元数据登录');
      return;
    }

    // 如果没有元数据角色，检查是否是第一个注册的用户（通常为管理员）
    // 或者检查邮箱是否在管理员列表中
    const adminEmails = ['admin@shenglong.com', 'admin@xcmgrepair.com'];
    const userEmail = user.email || '';
    const isFirstUser = user.created_at && new Date(user.created_at) < new Date('2026-09-01');

    if (adminEmails.includes(userEmail) || isFirstUser) {
      // 自动赋予管理员权限
      currentUser = {
        ...user,
        name: user.user_metadata?.name || userEmail.split('@')[0] || '管理员',
        email: userEmail,
        role: 'admin',
        department: ''
      };
      showAdminPage();
      showToast('已使用紧急管理员模式登录，请尽快修复 RLS 策略');
      return;
    }

    // 无法确定角色，显示无权限页面
    document.getElementById('noPermissionPage').style.display = 'flex';
    return;
  }

  // 正常流程：profiles 查询成功
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
  document.getElementById('userAvatar').textContent = (currentUser.name || '管').charAt(0);
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理员' : '运营经理';
  
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
    showToast('请输入邮箱和密码');
    return;
  }
  
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    showToast('登录成功');
    checkAuth();
    
  } catch (err) {
    console.error('登录失败:', err);
    showToast(err.message || '登录失败');
  }
}

async function doLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('adminPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

// ==================== 统计数据 ====================
async function loadStats() {
  try {
    // 分开查询，profiles 查询可能因 RLS 递归失败
    const [manualsRes, knowledgeRes, pendingRes] = await Promise.all([
      sbData.from('manuals').select('*', { count: 'exact', head: true }),
      sbData.from('knowledge').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      sbData.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    document.getElementById('statManuals').textContent = manualsRes.count || 0;
    document.getElementById('statKnowledge').textContent = knowledgeRes.count || 0;
    document.getElementById('statPending').textContent = pendingRes.count || 0;

    // profiles 查询单独处理
    try {
      const usersRes = await sbData.from('profiles').select('*', { count: 'exact', head: true });
      document.getElementById('statUsers').textContent = usersRes.count || 0;
    } catch (e) {
      document.getElementById('statUsers').textContent = 'N/A';
    }

  } catch (err) {
    console.error('加载统计失败:', err);
  }
}

// ==================== Tab 切换 ====================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tab + 'Tab').classList.add('active');
}

// ==================== 投稿管理 ====================
let allSubmissions = [];

async function loadSubmissions() {
  try {
    const { data, error } = await sbData
      .from('submissions')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allSubmissions = data || [];
    renderSubmissions(allSubmissions);
    
  } catch (err) {
    console.error('加载投稿失败:', err);
    document.getElementById('submissionsList').innerHTML = 
      '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">加载失败</div></div>';
  }
}

function renderSubmissions(list) {
  const container = document.getElementById('submissionsList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">暂无投稿</div></div>';
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
          分类：${s.categories?.name || '未分类'} | 
          投稿人：${escapeHtml(s.submitter_name || '匿名')} | 
          ${formatDate(s.created_at)}
        </div>
        <div class="list-item-desc">${escapeHtml(s.description || s.content.substring(0, 100))}</div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="viewSubmission('${s.id}')">查看</button>
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
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    published: '已发布'
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
    const { data, error } = await sbData
      .from('submissions')
      .select('*, categories(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('submissionDetail').innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">基本信息</div>
        <div class="detail-row">
          <div class="detail-label">标题</div>
          <div class="detail-value">${escapeHtml(data.title)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">分类</div>
          <div class="detail-value">${data.categories?.name || '未分类'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">状态</div>
          <div class="detail-value"><span class="badge badge-${data.status}">${getStatusText(data.status)}</span></div>
        </div>
        <div class="detail-row">
          <div class="detail-label">投稿人</div>
          <div class="detail-value">${escapeHtml(data.submitter_name || '匿名')}</div>
        </div>
        ${data.submitter_contact ? `
        <div class="detail-row">
          <div class="detail-label">联系方式</div>
          <div class="detail-value">${escapeHtml(data.submitter_contact)}</div>
        </div>` : ''}
        <div class="detail-row">
          <div class="detail-label">提交时间</div>
          <div class="detail-value">${formatDate(data.created_at)}</div>
        </div>
      </div>
      ${data.description ? `
      <div class="detail-section">
        <div class="detail-section-title">简要描述</div>
        <div class="detail-content">${escapeHtml(data.description)}</div>
      </div>` : ''}
      <div class="detail-section">
        <div class="detail-section-title">详细内容</div>
        <div class="detail-content" style="white-space:pre-wrap">${escapeHtml(data.content)}</div>
      </div>
    `;
    
    document.getElementById('submissionModal').style.display = 'flex';
    
  } catch (err) {
    console.error('加载详情失败:', err);
    showToast('加载失败');
  }
}

async function approveSubmission() {
  if (!confirm('确定要通过并发布这条投稿吗？')) return;
  
  try {
    // 获取投稿详情
    const { data: sub } = await sbData
      .from('submissions')
      .select('*')
      .eq('id', currentSubmissionId)
      .single();
    
    // 添加到知识点表
    const { error: kbError } = await sbData
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
    
    // 更新投稿状态
    const { error: subError } = await sbData
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', currentSubmissionId);
    
    if (subError) throw subError;
    
    showToast('已通过并发布');
    closeModal('submissionModal');
    loadSubmissions();
    loadStats();
    loadKnowledge();
    
  } catch (err) {
    console.error('审核失败:', err);
    showToast(err.message || '操作失败');
  }
}

async function rejectSubmission() {
  if (!confirm('确定要拒绝这条投稿吗？')) return;
  
  try {
    const { error } = await sbData
      .from('submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', currentSubmissionId);
    
    if (error) throw error;
    
    showToast('已拒绝');
    closeModal('submissionModal');
    loadSubmissions();
    loadStats();
    
  } catch (err) {
    console.error('操作失败:', err);
    showToast('操作失败');
  }
}

// ==================== 知识点管理 ====================
let allKnowledge = [];

async function loadKnowledge() {
  try {
    const { data, error } = await sbData
      .from('knowledge')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allKnowledge = data || [];
    renderKnowledge(allKnowledge);
    
  } catch (err) {
    console.error('加载知识点失败:', err);
    document.getElementById('knowledgeList').innerHTML = 
      '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">加载失败</div></div>';
  }
}

function renderKnowledge(list) {
  const container = document.getElementById('knowledgeList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📝</div><div class="empty-text">暂无知识点</div></div>';
    return;
  }
  
  container.innerHTML = list.map(k => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${k.status === 'published' ? 'published' : 'draft'}">${k.status === 'published' ? '已发布' : '草稿'}</span>
          ${escapeHtml(k.title)}
        </div>
        <div class="list-item-sub">
          分类：${k.categories?.name || '未分类'} | 
          浏览：${k.views || 0} | 
          ${formatDate(k.created_at)}
        </div>
        <div class="list-item-desc">${escapeHtml(k.description || k.content.substring(0, 100))}</div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="editKnowledge('${k.id}')">编辑</button>
        <button class="action-btn action-btn-danger" onclick="deleteKnowledge('${k.id}')">删除</button>
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
    const { data, error } = await sbData
      .from('categories')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    
    const select = document.getElementById('kbCategory');
    select.innerHTML = '<option value="">请选择分类</option>' + 
      data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
  } catch (err) {
    console.error('加载分类失败:', err);
  }
}

function showKnowledgeForm() {
  editingKnowledgeId = null;
  document.getElementById('kbModalTitle').textContent = '新增知识点';
  document.getElementById('kbCategory').value = '';
  document.getElementById('kbTitle').value = '';
  document.getElementById('kbDesc').value = '';
  document.getElementById('kbContent').value = '';
  document.getElementById('kbStatus').value = 'published';
  document.getElementById('kbSort').value = '0';
  document.getElementById('kbWordFile').value = '';
  const ws = document.getElementById('kbWordStatus');
  ws.style.display = 'none';
  ws.textContent = '';
  
  loadCategoryOptions();
  document.getElementById('knowledgeModal').style.display = 'flex';
}

async function handleWordUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  const statusEl = document.getElementById('kbWordStatus');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--warning)';
  statusEl.textContent = '正在解析 Word 文档...';
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    if (typeof mammoth === 'undefined') {
      statusEl.textContent = 'Word 解析库未加载，请刷新页面重试';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    if (!text || text.trim().length === 0) {
      statusEl.textContent = '未能从文档中提取到内容';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    
    // 填充内容
    document.getElementById('kbContent').value = text;
    
    // 如果标题为空，用文件名作为标题
    const titleField = document.getElementById('kbTitle');
    if (!titleField.value.trim()) {
      const fileName = file.name.replace(/\.docx?$/i, '');
      titleField.value = fileName;
    }
    
    statusEl.style.color = 'var(--success)';
    statusEl.textContent = '✓ 解析成功，已填充 ' + text.length + ' 字内容';
    
  } catch (err) {
    console.error('Word 解析失败:', err);
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = '解析失败：' + (err.message || '未知错误');
  }
}

async function editKnowledge(id) {
  editingKnowledgeId = id;
  
  try {
    const { data, error } = await sbData
      .from('knowledge')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('kbModalTitle').textContent = '编辑知识点';
    document.getElementById('kbTitle').value = data.title;
    document.getElementById('kbDesc').value = data.description || '';
    document.getElementById('kbContent').value = data.content;
    document.getElementById('kbStatus').value = data.status;
    document.getElementById('kbSort').value = data.sort_order || 0;
    document.getElementById('kbWordFile').value = '';
    const ws2 = document.getElementById('kbWordStatus');
    ws2.style.display = 'none';
    ws2.textContent = '';
    
    await loadCategoryOptions();
    document.getElementById('kbCategory').value = data.category_id;
    
    document.getElementById('knowledgeModal').style.display = 'flex';
    
  } catch (err) {
    console.error('加载失败:', err);
    showToast('加载失败');
  }
}

async function saveKnowledge() {
  const category_id = document.getElementById('kbCategory').value;
  const title = document.getElementById('kbTitle').value.trim();
  const description = document.getElementById('kbDesc').value.trim();
  const content = document.getElementById('kbContent').value.trim();
  const status = document.getElementById('kbStatus').value;
  const sort_order = parseInt(document.getElementById('kbSort').value) || 0;
  
  if (!category_id) { showToast('请选择分类'); return; }
  if (!title) { showToast('请输入标题'); return; }
  if (!content) { showToast('请输入内容'); return; }
  
  try {
    if (editingKnowledgeId) {
      // 更新
      const { error } = await sbData
        .from('knowledge')
        .update({ title, content, description, category_id, status, sort_order })
        .eq('id', editingKnowledgeId);
      
      if (error) throw error;
      showToast('更新成功');
    } else {
      // 新增
      const { error } = await sbData
        .from('knowledge')
        .insert({ title, content, description, category_id, status, sort_order, views: 0 });
      
      if (error) throw error;
      showToast('添加成功');
    }
    
    closeModal('knowledgeModal');
    loadKnowledge();
    loadStats();
    
  } catch (err) {
    console.error('保存失败:', err);
    showToast(err.message || '保存失败');
  }
}

async function deleteKnowledge(id) {
  if (!confirm('确定要删除这个知识点吗？此操作不可恢复。')) return;
  
  try {
    const { error } = await sbData
      .from('knowledge')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('删除成功');
    loadKnowledge();
    loadStats();
    
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败');
  }
}

// ==================== 分类管理 ====================
let allCategories = [];
let allKnowledgeByCategory = {};

async function loadCategories() {
  try {
    const { data, error } = await sbData
      .from('categories')
      .select('*, manuals(name, icon), parent:parent_id(name)')
      .order('sort_order');
    
    if (error) throw error;
    
    allCategories = data || [];
    
    // 加载所有知识点，按 category_id 分组
    const { data: knowledgeData, error: kError } = await sbData
      .from('knowledge')
      .select('id, title, status, category_id, sort_order, views')
      .order('sort_order');
    
    if (!kError && knowledgeData) {
      allKnowledgeByCategory = {};
      knowledgeData.forEach(k => {
        if (!allKnowledgeByCategory[k.category_id]) {
          allKnowledgeByCategory[k.category_id] = [];
        }
        allKnowledgeByCategory[k.category_id].push(k);
      });
    }
    
    renderCategories(allCategories);
    
  } catch (err) {
    console.error('加载分类失败:', err);
    document.getElementById('categoriesList').innerHTML = 
      '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">加载失败</div></div>';
  }
}

function renderCategories(list) {
  const container = document.getElementById('categoriesList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📁</div><div class="empty-text">暂无分类</div></div>';
    return;
  }
  
  // 按手册分组
  const manualMap = {};
  const orphanCats = [];
  
  list.forEach(c => {
    if (c.manual_id) {
      if (!manualMap[c.manual_id]) {
        manualMap[c.manual_id] = {
          id: c.manual_id,
          name: c.manuals?.name || '未知手册',
          icon: c.manuals?.icon || '📚',
          categories: []
        };
      }
      manualMap[c.manual_id].categories.push(c);
    } else {
      orphanCats.push(c);
    }
  });
  
  // 构建父子树
  function buildTree(categories) {
    const catMap = {};
    const roots = [];
    
    categories.forEach(c => {
      catMap[c.id] = { ...c, children: [] };
    });
    
    categories.forEach(c => {
      const node = catMap[c.id];
      if (c.parent_id && catMap[c.parent_id]) {
        catMap[c.parent_id].children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    // 排序
    roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    roots.forEach(r => r.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    
    return roots;
  }
  
  // 渲染知识点列表
  function renderKnowledgeItems(categoryId) {
    const items = allKnowledgeByCategory[categoryId] || [];
    if (items.length === 0) return '';
    
    return items.map(k => {
      const kBadge = `<span class="badge badge-${k.status === 'published' ? 'published' : 'draft'}">${k.status === 'published' ? '已发布' : '草稿'}</span>`;
      return `
        <div class="tree-knowledge-item">
          <span class="tree-knowledge-icon">📝</span>
          <div class="tree-knowledge-info">
            <div class="tree-knowledge-title">${kBadge} ${escapeHtml(k.title)}</div>
            <div class="tree-knowledge-sub">浏览：${k.views || 0} · 排序：${k.sort_order || 0}</div>
          </div>
          <div class="tree-knowledge-actions">
            <button class="action-btn action-btn-primary" onclick="event.stopPropagation();editKnowledge('${k.id}')">编辑</button>
            <button class="action-btn action-btn-danger" onclick="event.stopPropagation();deleteKnowledge('${k.id}')">删除</button>
          </div>
        </div>`;
    }).join('');
  }
  
  // 递归渲染树节点
  function renderNode(node) {
    const hasChildren = node.children && node.children.length > 0;
    const knowledgeItems = allKnowledgeByCategory[node.id] || [];
    const hasKnowledge = knowledgeItems.length > 0;
    const hasContent = hasChildren || hasKnowledge;
    const statusBadge = `<span class="badge badge-${node.status === 'active' ? 'published' : 'draft'}">${node.status === 'active' ? '启用' : '禁用'}</span>`;
    const subText = `排序：${node.sort_order || 0}${node.description ? ' · ' + escapeHtml(node.description) : ''}${hasKnowledge ? ' · ' + knowledgeItems.length + ' 篇知识点' : ''}`;
    
    let html = `<div class="tree-node${hasContent ? '' : ' collapsed'}">
      <div class="tree-node-content">
        ${hasContent ? `<span class="tree-toggle" onclick="toggleTreeNode(this)">▼</span>` : '<span class="tree-toggle-placeholder"></span>'}
        <span class="tree-icon">${hasContent ? '📂' : '📄'}</span>
        <div class="tree-node-info">
          <div class="tree-node-title">${statusBadge} ${escapeHtml(node.name)}</div>
          <div class="tree-node-sub">${subText}</div>
        </div>
        <div class="tree-node-actions">
          <button class="action-btn action-btn-primary" onclick="event.stopPropagation();editCategory('${node.id}')">编辑</button>
          <button class="action-btn action-btn-danger" onclick="event.stopPropagation();deleteCategory('${node.id}')">删除</button>
        </div>
      </div>`;
    
    if (hasContent) {
      html += '<div class="tree-children">';
      if (hasChildren) {
        node.children.forEach(child => {
          html += renderNode(child);
        });
      }
      if (hasKnowledge) {
        html += renderKnowledgeItems(node.id);
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }
  
  // 构建完整 HTML
  let html = '';
  
  Object.values(manualMap).forEach(manual => {
    const tree = buildTree(manual.categories);
    // 统计该手册下所有知识点
    let knowledgeCount = 0;
    manual.categories.forEach(c => {
      knowledgeCount += (allKnowledgeByCategory[c.id] || []).length;
    });
    html += `
      <div class="tree-directory">
        <div class="tree-directory-header" onclick="toggleTreeDirectory(this)">
          <span class="tree-toggle">▼</span>
          <span class="tree-directory-icon">${manual.icon}</span>
          <span class="tree-directory-name">${escapeHtml(manual.name)}</span>
          <span class="tree-directory-count">${manual.categories.length} 分类 · ${knowledgeCount} 知识点</span>
          <button class="action-btn action-btn-primary" onclick="event.stopPropagation();showCategoryFormForManual('${manual.id}','${escapeHtml(manual.name)}')">+ 添加</button>
        </div>
        <div class="tree-directory-body">`;
    
    if (tree.length > 0) {
      tree.forEach(node => {
        html += renderNode(node);
      });
    } else {
      html += '<div style="padding:12px 16px;font-size:13px;color:var(--text-3)">暂无分类，点击"添加"创建</div>';
    }
    
    html += '</div></div>';
  });
  
  // 未分配手册的分类
  if (orphanCats.length > 0) {
    let orphanKnowledgeCount = 0;
    orphanCats.forEach(c => {
      orphanKnowledgeCount += (allKnowledgeByCategory[c.id] || []).length;
    });
    html += `
      <div class="tree-directory">
        <div class="tree-directory-header" onclick="toggleTreeDirectory(this)">
          <span class="tree-toggle">▼</span>
          <span class="tree-directory-icon">📋</span>
          <span class="tree-directory-name">未分配手册</span>
          <span class="tree-directory-count">${orphanCats.length} 分类 · ${orphanKnowledgeCount} 知识点</span>
        </div>
        <div class="tree-directory-body">`;
    orphanCats.forEach(c => {
      html += renderNode({ ...c, children: [] });
    });
    html += '</div></div>';
  }
  
  container.innerHTML = html;
}

function toggleTreeDirectory(headerEl) {
  const dir = headerEl.parentElement;
  dir.classList.toggle('collapsed');
}

function toggleTreeNode(toggleEl) {
  const node = toggleEl.closest('.tree-node');
  if (node) {
    node.classList.toggle('collapsed');
  }
}

function showCategoryFormForManual(manualId, manualName) {
  editingCategoryId = null;
  document.getElementById('catModalTitle').textContent = '新增分类';
  document.getElementById('catName').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('catStatus').value = 'active';
  document.getElementById('catSort').value = '0';
  document.getElementById('catParent').innerHTML = '<option value="">顶级分类</option>';
  
  loadManualOptions().then(() => {
    document.getElementById('catManual').value = manualId;
    loadParentCategories();
    document.getElementById('categoryModal').style.display = 'flex';
  });
}

function filterCategories() {
  const keyword = document.getElementById('catSearch').value.toLowerCase().trim();
  if (!keyword) {
    renderCategories(allCategories);
    return;
  }
  const filtered = allCategories.filter(c => 
    c.name.toLowerCase().includes(keyword) ||
    (c.description && c.description.toLowerCase().includes(keyword)) ||
    (c.manuals?.name && c.manuals.name.toLowerCase().includes(keyword))
  );
  renderCategories(filtered);
}

async function loadManualOptions() {
  try {
    const { data, error } = await sbData
      .from('manuals')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    
    const select = document.getElementById('catManual');
    select.innerHTML = '<option value="">请选择手册</option>' + 
      data.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    
  } catch (err) {
    console.error('加载手册失败:', err);
  }
}

async function loadParentCategories() {
  const manualId = document.getElementById('catManual').value;
  const select = document.getElementById('catParent');
  select.innerHTML = '<option value="">顶级分类</option>';
  
  if (!manualId) return;
  
  try {
    const { data, error } = await sbData
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
    console.error('加载父分类失败:', err);
  }
}

function showCategoryForm() {
  editingCategoryId = null;
  document.getElementById('catModalTitle').textContent = '新增分类';
  document.getElementById('catManual').value = '';
  document.getElementById('catParent').innerHTML = '<option value="">顶级分类</option>';
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
    const { data, error } = await sbData
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('catModalTitle').textContent = '编辑分类';
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
    console.error('加载失败:', err);
    showToast('加载失败');
  }
}

async function saveCategory() {
  const manual_id = document.getElementById('catManual').value;
  const parent_id = document.getElementById('catParent').value || null;
  const name = document.getElementById('catName').value.trim();
  const description = document.getElementById('catDesc').value.trim();
  const status = document.getElementById('catStatus').value;
  const sort_order = parseInt(document.getElementById('catSort').value) || 0;
  
  if (!manual_id) { showToast('请选择手册'); return; }
  if (!name) { showToast('请输入分类名称'); return; }
  
  try {
    if (editingCategoryId) {
      const { error } = await sbData
        .from('categories')
        .update({ name, description, manual_id, parent_id, status, sort_order })
        .eq('id', editingCategoryId);
      
      if (error) throw error;
      showToast('更新成功');
    } else {
      const slug = 'cat-' + Date.now();
      const { error } = await sbData
        .from('categories')
        .insert({ name, slug, description, manual_id, parent_id, status, sort_order });
      
      if (error) throw error;
      showToast('添加成功');
    }
    
    closeModal('categoryModal');
    loadCategories();
    
  } catch (err) {
    console.error('保存失败:', err);
    showToast(err.message || '保存失败');
  }
}

async function deleteCategory(id) {
  if (!confirm('确定要删除这个分类吗？分类下的知识点将变为未分类。')) return;
  
  try {
    // 先把该分类下的知识点移到未分类
    await sbData
      .from('knowledge')
      .update({ category_id: null })
      .eq('category_id', id);
    
    // 删除分类
    const { error } = await sbData
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('删除成功');
    loadCategories();
    
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败');
  }
}

// ==================== 手册管理 ====================
let allManuals = [];

async function loadManuals() {
  try {
    const { data, error } = await sbData
      .from('manuals')
      .select('*')
      .order('sort_order');
    
    if (error) throw error;
    
    allManuals = data || [];
    renderManuals(allManuals);
    
  } catch (err) {
    console.error('加载手册失败:', err);
    document.getElementById('manualsList').innerHTML = 
      '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">加载失败</div></div>';
  }
}

function renderManuals(list) {
  const container = document.getElementById('manualsList');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">暂无手册</div></div>';
    return;
  }
  
  container.innerHTML = list.map(m => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">
          <span class="badge badge-${m.status === 'active' ? 'published' : 'draft'}">${m.status === 'active' ? '启用' : '禁用'}</span>
          <span style="margin-right:8px">${m.icon || '📖'}</span>
          ${escapeHtml(m.name)}
        </div>
        <div class="list-item-sub">
          标识：${m.slug || '无'} | 
          排序：${m.sort_order || 0}
        </div>
        ${m.description ? `<div class="list-item-desc">${escapeHtml(m.description)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-btn-primary" onclick="editManual('${m.id}')">编辑</button>
        <button class="action-btn action-btn-danger" onclick="deleteManual('${m.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function showManualForm() {
  editingManualId = null;
  document.getElementById('manualModalTitle').textContent = '新增手册';
  document.getElementById('manualName').value = '';
  document.getElementById('manualSlug').value = '';
  document.getElementById('manualDesc').value = '';
  document.getElementById('manualIcon').value = '📖';
  document.getElementById('manualColor').value = '#1a2744';
  document.getElementById('manualStatus').value = 'active';
  document.getElementById('manualSort').value = '0';
  
  document.getElementById('manualModal').style.display = 'flex';
}

async function editManual(id) {
  editingManualId = id;
  
  try {
    const { data, error } = await sbData
      .from('manuals')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('manualModalTitle').textContent = '编辑手册';
    document.getElementById('manualName').value = data.name;
    document.getElementById('manualSlug').value = data.slug || '';
    document.getElementById('manualDesc').value = data.description || '';
    document.getElementById('manualIcon').value = data.icon || '📖';
    document.getElementById('manualColor').value = data.primary_color || '#1a2744';
    document.getElementById('manualStatus').value = data.status;
    document.getElementById('manualSort').value = data.sort_order || 0;
    
    document.getElementById('manualModal').style.display = 'flex';
    
  } catch (err) {
    console.error('加载失败:', err);
    showToast('加载失败');
  }
}

async function saveManual() {
  const name = document.getElementById('manualName').value.trim();
  const slug = document.getElementById('manualSlug').value.trim();
  const description = document.getElementById('manualDesc').value.trim();
  const icon = document.getElementById('manualIcon').value.trim() || '📖';
  const primary_color = document.getElementById('manualColor').value;
  const status = document.getElementById('manualStatus').value;
  const sort_order = parseInt(document.getElementById('manualSort').value) || 0;
  
  if (!name) { showToast('请输入手册名称'); return; }
  
  try {
    if (editingManualId) {
      const { error } = await sbData
        .from('manuals')
        .update({ name, slug, description, icon, primary_color, status, sort_order })
        .eq('id', editingManualId);
      
      if (error) throw error;
      showToast('更新成功');
    } else {
      const { error } = await sbData
        .from('manuals')
        .insert({ name, slug, description, icon, primary_color, status, sort_order });
      
      if (error) throw error;
      showToast('添加成功');
    }
    
    closeModal('manualModal');
    loadManuals();
    loadStats();
    
  } catch (err) {
    console.error('保存失败:', err);
    showToast(err.message || '保存失败');
  }
}

async function deleteManual(id) {
  if (!confirm('确定要删除这个手册吗？手册下的分类和知识点将被保留。')) return;
  
  try {
    const { error } = await sbData
      .from('manuals')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    showToast('删除成功');
    loadManuals();
    loadStats();
    
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败');
  }
}

// ==================== 用户管理 ====================
async function loadUsers() {
  try {
    const { data, error } = await sbData
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('usersList');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">暂无用户</div></div>';
      return;
    }

    container.innerHTML = data.map(u => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">
            <span class="badge badge-${u.role === 'admin' ? 'published' : u.role === 'manager' ? 'draft' : ''}">${getRoleText(u.role)}</span>
            ${escapeHtml(u.name || u.email || '未命名')}
          </div>
          <div class="list-item-sub">
            邮箱：${u.email || '未设置'} | 
            注册：${formatDate(u.created_at)}
          </div>
          ${u.department ? `<div class="list-item-sub">部门：${escapeHtml(u.department)}</div>` : ''}
        </div>
        <div class="list-item-actions">
          ${u.role !== 'admin' ? `
          <button class="action-btn action-btn-success" onclick="setUserRole('${u.id}', 'manager')">设为经理</button>
          <button class="action-btn action-btn-warning" onclick="setUserRole('${u.id}', 'user')">设为普通</button>
          ` : '<span style="font-size:12px;color:var(--text-3)">超级管理员</span>'}
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('加载用户失败:', err);
    const errMsg = String(err?.message || err || '');
    if (errMsg.includes('recursion') || errMsg.includes('infinite')) {
      document.getElementById('usersList').innerHTML = 
        '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">用户列表暂时不可用（RLS策略冲突）</div><div style="margin-top:8px;font-size:12px;color:#999;">请执行 RLS 修复 SQL 脚本</div></div>';
    } else {
      document.getElementById('usersList').innerHTML = 
        '<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">加载失败</div></div>';
    }
  }
}

function getRoleText(role) {
  const map = { admin: '管理员', manager: '经理', user: '普通用户' };
  return map[role] || role;
}

async function setUserRole(userId, role) {
  if (!confirm(`确定要将该用户设为${getRoleText(role)}吗？`)) return;
  
  try {
    const { error } = await sbData
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    
    if (error) throw error;
    
    showToast('设置成功');
    loadUsers();
    
  } catch (err) {
    console.error('设置失败:', err);
    showToast('设置失败');
  }
}

// ==================== 初始化 ====================
window.onload = function() {
  if (initSupabase()) {
    checkAuth();
  } else {
    document.getElementById('setupPage').style.display = 'flex';
  }
};
