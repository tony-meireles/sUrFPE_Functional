(function () {
  const USERS_KEY = 'surfpe.auth.users.v1';
  const SESSION_KEY = 'surfpe.auth.session.v1';
  const NOTICE_KEY = 'surfpe.auth.notice.v1';
  const usage = window.SURFPE_USAGE || null;
  const page = document.body?.dataset.page || '';
  const EMERGENCY_MASTER_IDENTIFIER = 'Master@';
  const EMERGENCY_MASTER_PASSWORD = 'Master@';

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
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Falha ao restaurar usuarios.', error);
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
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

  function validateRegistrationData(data) {
    if (!sanitizeText(data.name)) throw new Error('Informe o nome completo.');
    if (normalizeCpf(data.cpf).length !== 11) throw new Error('Informe um CPF valido com 11 digitos.');
    if (!normalizeEmail(data.email).includes('@')) throw new Error('Informe um email valido.');
    if (!sanitizeText(data.password) || String(data.password).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    if (sanitizeText(data.password) !== sanitizeText(data.passwordConfirm)) throw new Error('A confirmacao da senha nao confere.');
    if (!['student', 'professional'].includes(data.crefType)) throw new Error('Selecione o tipo de registro.');
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

  async function login(identifier, password) {
    if (String(identifier || '').trim() === EMERGENCY_MASTER_IDENTIFIER && String(password || '') === EMERGENCY_MASTER_PASSWORD) {
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
      <span class="nav-user-badge">${escapeHtml(user.name)} · ${escapeHtml(ROLE_LABELS[user.role] || 'Usuario')}</span>
      <button class="ghost-button compact-button" type="button" id="logoutButton">Sair</button>
    `;
    nav.appendChild(utility);

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
    return `
      <div class="form-split">
        <label>
          <span>Nome completo</span>
          <input id="${includeRole ? 'registerName' : 'masterName'}" type="text" required>
        </label>
        <label>
          <span>CPF</span>
          <input id="${includeRole ? 'registerCpf' : 'masterCpf'}" type="text" inputmode="numeric" required>
        </label>
      </div>
      <div class="form-split">
        <label>
          <span>Email</span>
          <input id="${includeRole ? 'registerEmail' : 'masterEmail'}" type="email" required>
        </label>
        <label>
          <span>CREF ou matrícula</span>
          <input id="${includeRole ? 'registerCref' : 'masterCref'}" type="text" placeholder="Profissional ou estudante">
        </label>
      </div>
      <div class="form-split">
        <label>
          <span>Tipo de registro</span>
          <select id="${includeRole ? 'registerCrefType' : 'masterCrefType'}">
            <option value="professional">Profissional</option>
            <option value="student">Estudante</option>
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

  function valueOf(id) {
    return document.getElementById(id)?.value || '';
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
