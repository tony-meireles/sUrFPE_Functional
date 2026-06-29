(function () {
  const USERS_KEY = 'surfpe.auth.users.v1';
  const SESSION_KEY = 'surfpe.auth.session.v1';
  const NOTICE_KEY = 'surfpe.auth.notice.v1';
  const usage = window.SURFPE_USAGE || null;
  const page = document.body?.dataset.page || '';
  const EMERGENCY_MASTER_IDENTIFIER = 'Master@';
  const EMERGENCY_MASTER_PASSWORD = 'Master@';
  const IS_LOCAL_ENVIRONMENT = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || window.location.protocol === 'file:';
  const PROFILE_PATCHES = {
    '00558421784': {
      name: 'Tony Meireles dos Santos',
      cpf: '00558421784',
      cref: 'PE-022015',
      crefType: 'professional'
    }
  };

  const ROLE_LABELS = {
    basic: 'Basico',
    advanced: 'Avancado',
    master: 'Master'
  };

  const STATUS_LABELS = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Negado'
  };

  const authApi = {
    ROLE_LABELS,
    STATUS_LABELS,
    getUsers,
    getCurrentUser,
    getCurrentSession,
    logout,
    login,
    registerUser,
    updateOwnProfile,
    createInitialMaster,
    approveUser,
    updateUserRole,
    rejectUser,
    getPendingUsers,
    canManageRepository,
    isMaster,
    isApprovedUser,
    getNotice,
    clearNotice,
    setNotice
  };

  window.SURFPE_AUTH = authApi;

  if (page === 'login') {
    initLoginPage();
  } else {
    guardProtectedPage();
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      const { users, changed } = applyProfilePatches(parsed);
      if (changed) {
        saveUsers(users);
      }
      return users;
    } catch (error) {
      console.warn('Falha ao restaurar usuarios.', error);
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function applyProfilePatches(users) {
    let changed = false;
    const normalizedUsers = users.map((user) => {
      const cpf = normalizeCpf(user?.cpf);
      const patch = PROFILE_PATCHES[cpf];
      if (!patch) return user;
      if (user?.manualProfileUpdateAt) return user;

      const nextUser = {
        ...user,
        name: sanitizeText(user.name || patch.name),
        cpf,
        cref: sanitizeText(user.cref || patch.cref),
        crefType: user.crefType || patch.crefType,
        updatedAt: new Date().toISOString()
      };

      if (
        nextUser.name === user.name
        && nextUser.cpf === user.cpf
        && nextUser.cref === user.cref
        && nextUser.crefType === user.crefType
      ) {
        return user;
      }

      changed = true;
      return nextUser;
    });

    return {
      users: normalizedUsers,
      changed
    };
  }

  function getUsers() {
    return loadUsers();
  }

  function getPendingUsers() {
    return loadUsers().filter((user) => user.status === 'pending');
  }

  function getCurrentSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Falha ao restaurar sessao.', error);
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const session = getCurrentSession();
    if (!session?.userId) return null;
    const user = loadUsers().find((entry) => entry.id === session.userId);
    if (!user || user.status !== 'approved') return null;
    return user;
  }

  function isApprovedUser(user) {
    return Boolean(user && user.status === 'approved');
  }

  function canManageRepository(user) {
    return isApprovedUser(user) && ['advanced', 'master'].includes(user.role);
  }

  function isMaster(user) {
    return isApprovedUser(user) && user.role === 'master';
  }

  function setNotice(message) {
    if (!message) return;
    localStorage.setItem(NOTICE_KEY, String(message));
  }

  function getNotice() {
    return localStorage.getItem(NOTICE_KEY) || '';
  }

  function clearNotice() {
    localStorage.removeItem(NOTICE_KEY);
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeCpf(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function sanitizeText(value) {
    return String(value || '').trim();
  }

  async function hashPassword(password) {
    const normalized = String(password || '');
    if (!normalized) return '';

    if (window.crypto?.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(normalized);
      const buffer = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buffer)).map((item) => item.toString(16).padStart(2, '0')).join('');
    }

    return btoa(unescape(encodeURIComponent(normalized)));
  }

  function validateBaseUserData(data) {
    if (!sanitizeText(data.name)) throw new Error('Informe o nome completo.');
    if (normalizeCpf(data.cpf).length !== 11) throw new Error('Informe um CPF valido com 11 digitos.');
    if (!normalizeEmail(data.email).includes('@')) throw new Error('Informe um email valido.');
    if (!['student', 'professional'].includes(data.crefType)) throw new Error('Selecione o tipo de registro.');
  }

  function validateRegistrationData(data) {
    validateBaseUserData(data);
    if (!sanitizeText(data.password) || String(data.password).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    if (sanitizeText(data.password) !== sanitizeText(data.passwordConfirm)) throw new Error('A confirmacao da senha nao confere.');
  }

  function ensureUniqueUser(users, email, cpf, ignoreUserId) {
    const duplicate = users.find((user) => user.id !== ignoreUserId && (
      normalizeEmail(user.email) === email || normalizeCpf(user.cpf) === cpf
    ));
    if (duplicate) throw new Error('Ja existe um cadastro com este email ou CPF.');
  }

  async function createInitialMaster(data) {
    const users = loadUsers();
    if (users.length > 0) throw new Error('O Master inicial ja foi criado.');
    validateRegistrationData({ ...data, requestedRole: 'master' });

    const passwordHash = await hashPassword(data.password);
    const now = new Date().toISOString();
    const user = {
      id: createId(),
      name: sanitizeText(data.name),
      cpf: normalizeCpf(data.cpf),
      email: normalizeEmail(data.email),
      cref: sanitizeText(data.cref),
      crefType: data.crefType,
      requestedRole: 'master',
      role: 'master',
      status: 'approved',
      passwordHash,
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: 'system'
    };

    saveUsers([user]);
    saveSession({
      userId: user.id,
      loginAt: now
    });
    usage?.trackEvent?.('user_created', { role: 'master', source: 'bootstrap' });
    usage?.trackEvent?.('login', { role: 'master' });
    return user;
  }

  async function registerUser(data) {
    validateRegistrationData(data);

    const users = loadUsers();
    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);
    ensureUniqueUser(users, email, cpf);

    const requestedRole = data.requestedRole === 'advanced' ? 'advanced' : 'basic';
    const now = new Date().toISOString();
    const user = {
      id: createId(),
      name: sanitizeText(data.name),
      cpf,
      email,
      cref: sanitizeText(data.cref),
      crefType: data.crefType,
      requestedRole,
      role: null,
      status: 'pending',
      passwordHash: await hashPassword(data.password),
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null
    };

    users.push(user);
    saveUsers(users);
    usage?.trackEvent?.('user_requested', { requestedRole });
    return user;
  }

  function updateOwnProfile(currentUser, data) {
    if (!isApprovedUser(currentUser)) throw new Error('Sessao invalida para editar cadastro.');

    validateBaseUserData(data);

    const users = loadUsers();
    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);
    ensureUniqueUser(users, email, cpf, currentUser.id);

    const now = new Date().toISOString();
    let updatedUser = null;
    const updatedUsers = users.map((user) => {
      if (user.id !== currentUser.id) return user;

      updatedUser = {
        ...user,
        name: sanitizeText(data.name),
        cpf,
        email,
        cref: sanitizeText(data.cref),
        crefType: data.crefType,
        updatedAt: now,
        manualProfileUpdateAt: now
      };
      return updatedUser;
    });

    if (!updatedUser) throw new Error('Usuario nao encontrado para atualizacao.');

    saveUsers(updatedUsers);
    usage?.trackEvent?.('profile_updated', { role: updatedUser.role || 'unknown' });
    return updatedUser;
  }

  async function login(identifier, password) {
    if (
      IS_LOCAL_ENVIRONMENT
      && String(identifier || '').trim() === EMERGENCY_MASTER_IDENTIFIER
      && String(password || '') === EMERGENCY_MASTER_PASSWORD
    ) {
      return loginWithEmergencyMaster();
    }

    const users = loadUsers();
    const normalizedIdentifier = String(identifier || '').trim();
    const target = users.find((user) => (
      normalizeEmail(user.email) === normalizeEmail(normalizedIdentifier)
      || normalizeCpf(user.cpf) === normalizeCpf(normalizedIdentifier)
    ));

    if (!target) throw new Error('Usuario nao encontrado.');
    if (target.status === 'pending') throw new Error('Seu cadastro ainda esta pendente de aprovacao.');
    if (target.status === 'rejected') throw new Error('Seu cadastro foi negado. Fale com o Master.');

    const passwordHash = await hashPassword(password);
    if (target.passwordHash !== passwordHash) throw new Error('Senha incorreta.');

    const now = new Date().toISOString();
    const updatedUsers = users.map((user) => (
      user.id === target.id
        ? { ...user, lastLoginAt: now, updatedAt: now }
        : user
    ));
    saveUsers(updatedUsers);
    saveSession({
      userId: target.id,
      loginAt: now
    });
    usage?.trackEvent?.('login', { role: target.role || 'pending' });
    return updatedUsers.find((user) => user.id === target.id) || target;
  }

  function loginWithEmergencyMaster() {
    const users = loadUsers();
    const now = new Date().toISOString();
    const emergencyUserId = 'emergency-master';
    const emergencyEmail = 'master@surfpe.local';
    let target = users.find((user) => user.id === emergencyUserId);

    if (!target) {
      target = {
        id: emergencyUserId,
        name: 'Master de Emergencia',
        cpf: '00000000000',
        email: emergencyEmail,
        cref: 'MASTER',
        crefType: 'professional',
        requestedRole: 'master',
        role: 'master',
        status: 'approved',
        passwordHash: '',
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
        approvedBy: 'system',
        lastLoginAt: now
      };
      saveUsers([...users, target]);
    } else {
      target = {
        ...target,
        role: 'master',
        status: 'approved',
        updatedAt: now,
        approvedAt: target.approvedAt || now,
        approvedBy: target.approvedBy || 'system',
        lastLoginAt: now
      };
      saveUsers(users.map((user) => (user.id === emergencyUserId ? target : user)));
    }

    saveSession({
      userId: emergencyUserId,
      loginAt: now
    });
    usage?.trackEvent?.('login', { role: 'master', source: 'emergency-code' });
    return target;
  }

  function logout() {
    clearSession();
    window.location.href = 'login.html';
  }

  function approveUser(userId, role, masterUser) {
    if (!isMaster(masterUser)) throw new Error('Apenas o Master pode aprovar usuarios.');
    const targetRole = ['basic', 'advanced', 'master'].includes(role) ? role : 'basic';
    const users = loadUsers();
    const now = new Date().toISOString();
    const updated = users.map((user) => (
      user.id === userId
        ? {
            ...user,
            role: targetRole,
            status: 'approved',
            updatedAt: now,
            approvedAt: now,
            approvedBy: masterUser.id
          }
        : user
    ));
    saveUsers(updated);
    usage?.trackEvent?.('user_approved', { role: targetRole });
  }

  function updateUserRole(userId, role, masterUser) {
    if (!isMaster(masterUser)) throw new Error('Apenas o Master pode alterar niveis.');
    const targetRole = ['basic', 'advanced', 'master'].includes(role) ? role : 'basic';
    const users = loadUsers();
    const now = new Date().toISOString();
    const updated = users.map((user) => (
      user.id === userId
        ? {
            ...user,
            role: targetRole,
            status: 'approved',
            updatedAt: now
          }
        : user
    ));
    saveUsers(updated);
    usage?.trackEvent?.('user_role_updated', { role: targetRole });
  }

  function rejectUser(userId, masterUser) {
    if (!isMaster(masterUser)) throw new Error('Apenas o Master pode negar usuarios.');
    const users = loadUsers();
    const now = new Date().toISOString();
    const updated = users.map((user) => (
      user.id === userId
        ? {
            ...user,
            status: 'rejected',
            updatedAt: now
          }
        : user
    ));
    saveUsers(updated);
    usage?.trackEvent?.('user_rejected', {});
  }

  function createId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get('next') || 'index.html';
  }

  function guardProtectedPage() {
    const users = loadUsers();
    if (!users.length) {
      window.location.href = 'login.html?setup=master';
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      const next = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search || ''}`;
      window.location.href = `login.html?next=${encodeURIComponent(next)}`;
      return;
    }

    if (page === 'repository' && !canManageRepository(user)) {
      setNotice('Seu perfil atual nao tem permissao para editar o repositorio.');
      window.location.href = 'index.html';
      return;
    }

    if (page === 'users' && !isMaster(user)) {
      setNotice('A gestao de usuarios esta disponivel apenas para o perfil Master.');
      window.location.href = 'analytics.html';
      return;
    }

    enhanceNavigation(user);
  }

  function enhanceNavigation(user) {
    const nav = document.querySelector('.top-nav');
    if (!nav) return;

    if (!canManageRepository(user)) {
      const repositoryLink = nav.querySelector('a[href="repositorio.html"]');
      if (repositoryLink) repositoryLink.remove();
    }

    if (!isMaster(user)) {
      const usersLink = nav.querySelector('a[href="users.html"]');
      if (usersLink) usersLink.remove();
    }

    if (nav.querySelector('.nav-utility')) return;

    const utility = document.createElement('div');
    utility.className = 'nav-utility';
    utility.innerHTML = `
      <div class="nav-user-badge">
        <span class="nav-user-label">${escapeHtml(user.name)} · ${escapeHtml(ROLE_LABELS[user.role] || 'Usuario')}</span>
        <button class="text-button nav-user-action" type="button" id="editProfileButton">Editar cadastro</button>
      </div>
      <button class="ghost-button compact-button" type="button" id="logoutButton">Sair</button>
    `;
    nav.appendChild(utility);

    ensureProfileEditor();
    utility.querySelector('#editProfileButton')?.addEventListener('click', openProfileEditor);
    utility.querySelector('#logoutButton')?.addEventListener('click', logout);
  }

  function initLoginPage() {
    const app = document.getElementById('authApp');
    if (!app) return;

    const currentUser = getCurrentUser();
    if (currentUser) {
      window.location.href = getRedirectTarget();
      return;
    }

    const users = loadUsers();
    const params = new URLSearchParams(window.location.search);
    const setupMaster = params.get('setup') === 'master' || users.length === 0;
    const notice = getNotice();
    if (notice) {
      clearNotice();
    }

    app.innerHTML = `
      <section class="auth-shell">
        <div class="auth-panel auth-panel-brand">
          <p class="eyebrow">Funcional Surfe</p>
          <h1>${setupMaster ? 'Criar Master' : 'Entrar no sistema'}</h1>
          <p class="hero-text">${setupMaster
            ? 'O primeiro acesso cria o Master responsável por aprovar os demais usuários.'
            : 'Entre com email ou CPF. Novos cadastros ficam pendentes até liberação do Master.'}</p>
          <div class="hero-brand">
            <img src="assets/branding/logo-surfpe-tech.png" alt="Logo sUrFPE Tech">
          </div>
          ${notice ? `<p class="auth-notice">${escapeHtml(notice)}</p>` : ''}
        </div>
        <div class="auth-panel auth-panel-form">
          ${setupMaster ? renderMasterBootstrap() : renderAuthTabs()}
        </div>
      </section>
    `;

    bindLoginPageEvents(setupMaster);
  }

  function renderMasterBootstrap() {
    return `
      <div class="auth-card">
        <div class="panel-header compact">
          <div>
            <p class="panel-title">Master inicial</p>
            <span class="panel-subtitle">Esse usuário nasce aprovado e passa a administrar permissões.</span>
          </div>
        </div>
        <form class="editor-form" id="masterBootstrapForm">
          ${renderUserFields({ includeRole: false })}
          <div class="form-split">
            <label>
              <span>Senha</span>
              <input id="masterPassword" type="password" minlength="6" required>
            </label>
            <label>
              <span>Confirmar senha</span>
              <input id="masterPasswordConfirm" type="password" minlength="6" required>
            </label>
          </div>
          <button class="primary-button" type="submit">Criar Master</button>
          <p class="auth-feedback" id="authFeedback"></p>
        </form>
      </div>
    `;
  }

  function renderAuthTabs() {
    return `
      <div class="auth-tabs">
        <button class="chip is-active" type="button" data-auth-tab="login">Entrar</button>
        <button class="chip" type="button" data-auth-tab="register">Solicitar acesso</button>
      </div>
      <div class="auth-card" data-auth-panel="login">
        <form class="editor-form" id="loginForm">
          <label>
            <span>Email ou CPF</span>
            <input id="loginIdentifier" type="text" required>
          </label>
          <label>
            <span>Senha</span>
            <input id="loginPassword" type="password" minlength="6" required>
          </label>
          <button class="primary-button" type="submit">Entrar</button>
        </form>
      </div>
      <div class="auth-card" data-auth-panel="register" hidden>
        <form class="editor-form" id="registerForm">
          ${renderUserFields({ includeRole: true })}
          <div class="form-split">
            <label>
              <span>Senha</span>
              <input id="registerPassword" type="password" minlength="6" required>
            </label>
            <label>
              <span>Confirmar senha</span>
              <input id="registerPasswordConfirm" type="password" minlength="6" required>
            </label>
          </div>
          <button class="primary-button" type="submit">Enviar para aprovação</button>
        </form>
      </div>
      <p class="auth-feedback" id="authFeedback"></p>
    `;
  }

  function renderUserFields(options) {
    const includeRole = Boolean(options?.includeRole);
    const prefix = options?.prefix || (includeRole ? 'register' : 'master');
    const values = options?.values || {};
    return `
      <div class="form-split">
        <label>
          <span>Nome completo</span>
          <input id="${prefix}Name" type="text" value="${escapeHtml(values.name || '')}" required>
        </label>
        <label>
          <span>CPF</span>
          <input id="${prefix}Cpf" type="text" inputmode="numeric" value="${escapeHtml(values.cpf || '')}" required>
        </label>
      </div>
      <div class="form-split">
        <label>
          <span>Email</span>
          <input id="${prefix}Email" type="email" value="${escapeHtml(values.email || '')}" required>
        </label>
        <label>
          <span>CREF ou matrícula</span>
          <input id="${prefix}Cref" type="text" value="${escapeHtml(values.cref || '')}" placeholder="Profissional ou estudante">
        </label>
      </div>
      <div class="form-split">
        <label>
          <span>Tipo de registro</span>
          <select id="${prefix}CrefType">
            <option value="professional"${String(values.crefType || 'professional') === 'professional' ? ' selected' : ''}>Profissional</option>
            <option value="student"${String(values.crefType || '') === 'student' ? ' selected' : ''}>Estudante</option>
          </select>
        </label>
        ${includeRole ? `
          <label>
            <span>Nivel solicitado</span>
            <select id="registerRequestedRole">
              <option value="basic">Basico</option>
              <option value="advanced">Avancado</option>
            </select>
          </label>
        ` : '<div></div>'}
      </div>
    `;
  }

  function bindLoginPageEvents(setupMaster) {
    const feedback = document.getElementById('authFeedback');

    if (setupMaster) {
      document.getElementById('masterBootstrapForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setFeedback(feedback, '');
        try {
          await createInitialMaster({
            name: valueOf('masterName'),
            cpf: valueOf('masterCpf'),
            email: valueOf('masterEmail'),
            cref: valueOf('masterCref'),
            crefType: valueOf('masterCrefType'),
            password: valueOf('masterPassword'),
            passwordConfirm: valueOf('masterPasswordConfirm')
          });
          window.location.href = getRedirectTarget();
        } catch (error) {
          setFeedback(feedback, error.message || 'Nao foi possivel criar o Master.');
        }
      });
      return;
    }

    const tabs = [...document.querySelectorAll('[data-auth-tab]')];
    const panels = [...document.querySelectorAll('[data-auth-panel]')];
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
        panels.forEach((panel) => {
          panel.hidden = panel.getAttribute('data-auth-panel') !== tab.getAttribute('data-auth-tab');
        });
        setFeedback(feedback, '');
      });
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(feedback, '');
      try {
        await login(valueOf('loginIdentifier'), valueOf('loginPassword'));
        window.location.href = getRedirectTarget();
      } catch (error) {
        setFeedback(feedback, error.message || 'Nao foi possivel entrar.');
      }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(feedback, '');
      try {
        await registerUser({
          name: valueOf('registerName'),
          cpf: valueOf('registerCpf'),
          email: valueOf('registerEmail'),
          cref: valueOf('registerCref'),
          crefType: valueOf('registerCrefType'),
          requestedRole: valueOf('registerRequestedRole'),
          password: valueOf('registerPassword'),
          passwordConfirm: valueOf('registerPasswordConfirm')
        });
        setFeedback(feedback, 'Solicitacao enviada. Aguarde a liberacao do Master.');
        event.target.reset();
      } catch (error) {
        setFeedback(feedback, error.message || 'Nao foi possivel enviar o cadastro.');
      }
    });

  }

  function ensureProfileEditor() {
    if (document.getElementById('profileEditorModal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'profileEditorModal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="profileEditorTitle">
        <div class="panel-header compact">
          <div>
            <p class="panel-title" id="profileEditorTitle">Editar cadastro</p>
            <span class="panel-subtitle">Atualize seus dados de identificação e registro profissional.</span>
          </div>
          <button class="ghost-button compact-button" type="button" data-close-profile-editor>Fechar</button>
        </div>
        <form class="editor-form" id="profileEditorForm">
          ${renderUserFields({ prefix: 'profileEdit', values: getCurrentUser() || {} })}
          <div class="hero-actions">
            <button class="primary-button" type="submit">Salvar cadastro</button>
            <button class="ghost-button" type="button" data-close-profile-editor>Cancelar</button>
          </div>
          <p class="auth-feedback" id="profileEditorFeedback"></p>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeProfileEditor();
    });

    modal.querySelectorAll('[data-close-profile-editor]').forEach((button) => {
      button.addEventListener('click', closeProfileEditor);
    });

    modal.querySelector('#profileEditorForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const feedback = document.getElementById('profileEditorFeedback');
      setFeedback(feedback, '');

      try {
        const updatedUser = updateOwnProfile(getCurrentUser(), {
          name: valueOf('profileEditName'),
          cpf: valueOf('profileEditCpf'),
          email: valueOf('profileEditEmail'),
          cref: valueOf('profileEditCref'),
          crefType: valueOf('profileEditCrefType')
        });
        syncProfileEditorForm(updatedUser);
        refreshNavigationBadge(updatedUser);
        setFeedback(feedback, 'Cadastro atualizado com sucesso. Recarregando...');
        window.setTimeout(() => window.location.reload(), 450);
      } catch (error) {
        setFeedback(feedback, error.message || 'Nao foi possivel atualizar o cadastro.');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        closeProfileEditor();
      }
    });
  }

  function openProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    const user = getCurrentUser();
    if (!modal || !user) return;

    syncProfileEditorForm(user);
    setFeedback(document.getElementById('profileEditorFeedback'), '');
    modal.hidden = false;
  }

  function closeProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    if (!modal) return;
    modal.hidden = true;
  }

  function syncProfileEditorForm(user) {
    if (!user) return;
    setValue('profileEditName', user.name);
    setValue('profileEditCpf', user.cpf);
    setValue('profileEditEmail', user.email);
    setValue('profileEditCref', user.cref);
    setValue('profileEditCrefType', user.crefType || 'professional');
  }

  function refreshNavigationBadge(user) {
    const badge = document.querySelector('.nav-user-label');
    if (!badge || !user) return;
    badge.textContent = `${user.name} · ${ROLE_LABELS[user.role] || 'Usuario'}`;
  }

  function valueOf(id) {
    return document.getElementById(id)?.value || '';
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value || '';
  }

  function setFeedback(element, message) {
    if (!element) return;
    element.textContent = message || '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
