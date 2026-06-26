(function () {
  const repository = window.EXERCISE_REPOSITORY || { exercises: [] };
  const STORAGE_KEY = 'surfpe.exerciseRepository.v1';
  const SESSION_STORAGE_KEY = 'surfpe.trainingSessions.v1';
  const LOGO_PATH = 'assets/branding/logo-surfpe-tech.png';
  const usage = window.SURFPE_USAGE || null;
  const auth = window.SURFPE_AUTH || null;
  const currentPage = document.body?.dataset.page || 'dashboard';
  const currentUser = auth?.getCurrentUser?.() || null;

  const exercises = loadExercises();
  let sessions = loadSessions();
  const filters = {
    search: '',
    dateFrom: '',
    dateTo: '',
    durationMin: '',
    durationMax: ''
  };

  const elements = {
    dashboardSessions: document.getElementById('dashboardSessions'),
    dashboardExerciseAverage: document.getElementById('dashboardExerciseAverage'),
    dashboardTotal: document.getElementById('dashboardTotal'),
    dashboardStats: document.getElementById('dashboardStats'),
    createdTrainings: document.getElementById('createdTrainings'),
    trainingSearch: document.getElementById('trainingSearch'),
    trainingDateFrom: document.getElementById('trainingDateFrom'),
    trainingDateTo: document.getElementById('trainingDateTo'),
    trainingDurationMin: document.getElementById('trainingDurationMin'),
    trainingDurationMax: document.getElementById('trainingDurationMax'),
    trainingFilterSummary: document.getElementById('trainingFilterSummary'),
    trainingFiltersReset: document.getElementById('trainingFiltersReset'),
    userManagementPanel: document.getElementById('userManagementPanel'),
    userManagementContent: document.getElementById('userManagementContent')
  };

  const stats = {
    sessions: sessions.length,
    total: exercises.length,
    implements: [...new Set(exercises.map((item) => item.implement).filter(Boolean))].length,
    upperBody: exercises.filter((item) => Number(item.scores?.upperBody || 0) > 0).length,
    lowerBody: exercises.filter((item) => Number(item.scores?.lowerBody || 0) > 0).length,
    trunk: exercises.filter((item) => Number(item.scores?.trunk || 0) > 0).length,
    core: exercises.filter((item) => Number(item.scores?.core || 0) > 0).length,
    balance: exercises.filter((item) => Number(item.scores?.balance || 0) > 0).length,
    popup: exercises.filter((item) => Number(item.foundations?.popup || 0) > 0).length,
    rowing: exercises.filter((item) => Number(item.foundations?.rowing || 0) > 0).length,
    navigation: exercises.filter((item) => Number(item.foundations?.navigation || 0) > 0).length,
    railManeuvers: exercises.filter((item) => Number(item.foundations?.railManeuvers || 0) > 0).length,
    kettlebell: exercises.filter((item) => Number(item.implementsAvailable?.kettlebell || 0) > 0).length,
    dumbbell: exercises.filter((item) => Number(item.implementsAvailable?.dumbbell || 0) > 0).length,
    elasticBand: exercises.filter((item) => Number(item.implementsAvailable?.elasticBand || 0) > 0).length,
    swissBall: exercises.filter((item) => Number(item.implementsAvailable?.swissBall || 0) > 0).length
  };

  bindFilters();
  usage?.trackAccess?.(currentPage);
  renderDashboard();

  function loadExercises() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(repository.exercises || []);
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Falha ao restaurar base editada.', error);
      return structuredClone(repository.exercises || []);
    }
  }

  function loadSessions() {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Falha ao restaurar treinos criados.', error);
      return [];
    }
  }

  function bindFilters() {
    [
      'trainingSearch',
      'trainingDateFrom',
      'trainingDateTo',
      'trainingDurationMin',
      'trainingDurationMax'
    ].forEach((key) => {
      const element = elements[key];
      if (!element) return;
      element.addEventListener('input', updateFiltersFromForm);
      element.addEventListener('change', updateFiltersFromForm);
    });

    elements.trainingFiltersReset?.addEventListener('click', () => {
      filters.search = '';
      filters.dateFrom = '';
      filters.dateTo = '';
      filters.durationMin = '';
      filters.durationMax = '';
      syncFilterForm();
      renderCreatedTrainings();
    });
  }

  function updateFiltersFromForm() {
    filters.search = elements.trainingSearch?.value.trim().toLowerCase() || '';
    filters.dateFrom = elements.trainingDateFrom?.value || '';
    filters.dateTo = elements.trainingDateTo?.value || '';
    filters.durationMin = elements.trainingDurationMin?.value || '';
    filters.durationMax = elements.trainingDurationMax?.value || '';
    renderCreatedTrainings();
  }

  function syncFilterForm() {
    if (elements.trainingSearch) elements.trainingSearch.value = '';
    if (elements.trainingDateFrom) elements.trainingDateFrom.value = '';
    if (elements.trainingDateTo) elements.trainingDateTo.value = '';
    if (elements.trainingDurationMin) elements.trainingDurationMin.value = '';
    if (elements.trainingDurationMax) elements.trainingDurationMax.value = '';
  }

  function renderDashboard() {
    const sessionExerciseAverage = getSessionExerciseAverage();
    if (elements.dashboardSessions) elements.dashboardSessions.textContent = String(sessions.length);
    if (elements.dashboardExerciseAverage) elements.dashboardExerciseAverage.textContent = sessionExerciseAverage.toFixed(1);
    if (elements.dashboardTotal) elements.dashboardTotal.textContent = String(stats.total);
    if (elements.dashboardStats) elements.dashboardStats.innerHTML = renderAnalytics();
    if (elements.createdTrainings) renderCreatedTrainings();
    if (elements.userManagementPanel) renderUserManagement();
  }

  function renderCreatedTrainings() {
    if (!elements.createdTrainings) return;
    const filteredSessions = applyTrainingFilters(sessions);
    if (elements.trainingFilterSummary) {
      elements.trainingFilterSummary.textContent = buildFilterSummary(filteredSessions.length, sessions.length);
    }

    if (!filteredSessions.length) {
      elements.createdTrainings.innerHTML = '<div class="empty-state">Nenhum treino encontrado com os filtros atuais.</div>';
      return;
    }

    elements.createdTrainings.innerHTML = filteredSessions
      .map((session) => {
        const emphasis = deriveSessionEmphasis(session);
        const body = (emphasis.highlights || []).filter((item) => Number(item.total || 0) > 0).slice(0, 2);
        const foundations = (emphasis.foundationHighlights || []).filter((item) => Number(item.total || 0) > 0).slice(0, 2);
        const implements = (emphasis.implementHighlights || []).filter((item) => Number(item.total || 0) > 0).slice(0, 3);
        const modeLabel = session.mode === 'rot' ? 'ROT' : 'Intervalado';
        const thumbnailsHtml = buildSessionThumbnails(session);

        return `
          <article class="training-card">
            <div class="training-card-main">
              <div class="training-card-top">
                <div class="training-card-head">
                  <strong>${escapeHtml(session.name || 'Treino sem nome')}</strong>
                  <p>${formatDateTime(session.createdAt)}</p>
                </div>
                <div class="training-card-pills">
                  <span class="pill">${modeLabel}</span>
                  <span class="pill">${Number(session.exercises?.length || 0)} exercicios</span>
                  <span class="pill">${formatMinutes(session.totalMinutes || 0)}</span>
                </div>
              </div>
              <div class="training-card-grid">
                <div class="training-card-block is-program">
                  <span class="training-card-label">Programacao</span>
                  <p>${escapeHtml(buildSessionConfigLine(session))}</p>
                </div>
                ${thumbnailsHtml ? `
                  <div class="training-card-block is-gallery">
                    <span class="training-card-label">Exercicios da serie</span>
                    <div class="training-card-thumbnails">${thumbnailsHtml}</div>
                  </div>
                ` : ''}
                <div class="training-card-block">
                  <span class="training-card-label">Foco corporal</span>
                  <p>${escapeHtml(body.map((item) => `${item.label} ${Math.round(item.percentage || 0)}%`).join(', ') || 'Sem destaque')}</p>
                </div>
                <div class="training-card-block">
                  <span class="training-card-label">Fundamentos</span>
                  <p>${escapeHtml(foundations.map((item) => `${item.label} ${Math.round(item.percentage || 0)}%`).join(', ') || 'Sem destaque')}</p>
                </div>
                <div class="training-card-block">
                  <span class="training-card-label">Implementos</span>
                  <p>${escapeHtml(implements.map((item) => `${item.label} ${Math.round(item.percentage || 0)}%`).join(', ') || 'Sem destaque')}</p>
                </div>
              </div>
            </div>
            <div class="training-card-actions">
              <div class="training-card-action-stack">
                <a class="icon-button training-card-open" href="prescricao.html?session=${encodeURIComponent(session.id)}" aria-label="Abrir treino" title="Abrir treino">📋</a>
                <button class="icon-button" type="button" data-export-session-pdf="${escapeHtml(session.id)}" aria-label="Exportar PDF" title="Exportar PDF">PDF</button>
              </div>
              <button class="icon-button subtle-danger training-card-delete" type="button" data-delete-session="${escapeHtml(session.id)}" aria-label="Excluir treino" title="Excluir treino">🗑</button>
            </div>
          </article>
        `;
      })
      .join('');

    bindTrainingActions();
  }

  function applyTrainingFilters(items) {
    const durationMin = parseNumber(filters.durationMin);
    const durationMax = parseNumber(filters.durationMax);
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

    return items.filter((session) => {
      const createdAt = session.createdAt ? new Date(session.createdAt) : null;
      const normalizedName = String(session.name || '').toLowerCase();
      const totalMinutes = Number(session.totalMinutes || 0);
      if (filters.search && !normalizedName.includes(filters.search)) return false;
      if (dateFrom && (!createdAt || createdAt < dateFrom)) return false;
      if (dateTo && (!createdAt || createdAt > dateTo)) return false;
      if (durationMin !== null && totalMinutes < durationMin) return false;
      if (durationMax !== null && totalMinutes > durationMax) return false;
      return true;
    });
  }

  function deriveSessionEmphasis(session) {
    return session.emphasis || { highlights: [], foundationHighlights: [], implementHighlights: [] };
  }

  function buildFilterSummary(filteredCount, totalCount) {
    if (!totalCount) return 'Nenhum treino criado ainda.';
    if (filteredCount === totalCount) return `Mostrando todos os ${totalCount} treinos criados.`;
    return `Mostrando ${filteredCount} de ${totalCount} treinos criados.`;
  }

  function buildSessionConfigLine(session) {
    const exerciseCount = Number(session.exercises?.length || 0);
    const seriesCount = Number(session.seriesCount || 1);
    const intensity4pis = String(session.intensity4pis || '0');
    if (session.mode === 'rot') {
      return `${seriesCount} Series x (${exerciseCount} exercicios com ${session.repsPerExercise || 0} reps - ${format4PisLabel(intensity4pis)} / ${formatMinutes(session.workMinutes || 0)})`;
    }
    return `${seriesCount} series x [${exerciseCount} exercicios x (${formatMinutes(session.workMinutes || 0)} - ${format4PisLabel(intensity4pis)} / ${formatMinutes(session.restMinutes || 0)})]`;
  }

  function format4PisLabel(value) {
    const normalized = String(value || '0').trim() || '0';
    return normalized.toLowerCase() === 'all out' ? 'All Out' : `${normalized} 4PIS`;
  }

  function buildSessionThumbnails(session) {
    const items = Array.isArray(session.exercises) ? session.exercises : [];
    const imageExercises = items.filter((exercise) => getExerciseImagePath(exercise));
    if (!imageExercises.length) return '';

    const maxVisible = 8;
    const visibleItems = imageExercises.slice(0, maxVisible);
    const remaining = imageExercises.length - visibleItems.length;

    const thumbs = visibleItems
      .map((exercise, index) => `
        <img
          class="training-card-thumb"
          src="${escapeHtml(getExerciseImagePath(exercise))}"
          alt="${escapeHtml(exercise.movement || `Exercicio ${index + 1}`)}"
          loading="lazy"
        >
      `)
      .join('');

    return remaining > 0
      ? `${thumbs}<span class="training-card-thumb-more">+${remaining}</span>`
      : thumbs;
  }

  function getExerciseImagePath(exercise) {
    const image = exercise?.image;
    const rawPath = typeof image === 'string' ? image : image?.path;
    return String(rawPath || '').replaceAll('\\', '/').trim();
  }

  function renderAnalytics() {
    const sessionExerciseAverage = getSessionExerciseAverage();
    return `
      ${renderUsageAnalyticsSection()}
      ${renderExerciseUsageSection()}
      ${analyticsSection('Visao geral', [
        statCard('Exercicios no banco', stats.total),
        statCard('Treinos criados', sessions.length),
        statCard('Media exercicios/treino', sessionExerciseAverage.toFixed(1)),
        statCard('Implementos no banco', stats.implements),
        statCard('Implemento mais frequente', getTopImplement(exercises)),
        statCard('Enfase mais criada', getTopSessionFocus(sessions))
      ])}
      ${analyticsSection('Foco corporal', [
        statCard('MMSS', stats.upperBody),
        statCard('MMII', stats.lowerBody),
        statCard('Tronco', stats.trunk),
        statCard('Core', stats.core),
        statCard('Equilibrio', stats.balance)
      ])}
      ${analyticsSection('Fundamentos estimulados', [
        statCard('Popup', stats.popup),
        statCard('Remada', stats.rowing),
        statCard('Navegacao', stats.navigation),
        statCard('Manobras de Borda', stats.railManeuvers)
      ])}
      ${analyticsSection('Implementos disponiveis', [
        statCard('Kettlebell', stats.kettlebell),
        statCard('Halter', stats.dumbbell),
        statCard('Elastico', stats.elasticBand),
        statCard('Bola Suica', stats.swissBall)
      ])}
    `;
  }

  function analyticsSection(title, cards) {
    return `
      <section class="analytics-group">
        <div class="analytics-group-header">
          <strong>${escapeHtml(title)}</strong>
        </div>
        <div class="dashboard-stats">
          ${cards.join('')}
        </div>
      </section>
    `;
  }

  function renderUsageAnalyticsSection() {
    const events = usage?.getEvents?.() || [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last30Start = now - (30 * dayMs);
    const previous30Start = now - (60 * dayMs);
    const firstEventTime = events.length ? Math.min(...events.map((event) => Number(event.timestamp || now))) : now;
    const hasPreviousWindow = firstEventTime <= last30Start;

    const access30 = countEventsInWindow(events, 'access', last30Start, now);
    const accessPrevious30 = countEventsInWindow(events, 'access', previous30Start, last30Start);
    const pdf30 = countEventsInWindow(events, 'pdf_exported', last30Start, now);
    const pdfPrevious30 = countEventsInWindow(events, 'pdf_exported', previous30Start, last30Start);
    const created30 = countEventsInWindow(events, 'session_created', last30Start, now);
    const createdPrevious30 = countEventsInWindow(events, 'session_created', previous30Start, last30Start);
    const activeDays30 = countUniqueActiveDays(events, last30Start, now);
    const activeDaysPrevious30 = countUniqueActiveDays(events, previous30Start, last30Start);
    const dashboardAccess30 = countPageAccesses(events, 'dashboard', last30Start, now);
    const analyticsAccess30 = countPageAccesses(events, 'analytics', last30Start, now);
    const prescriptionAccess30 = countPageAccesses(events, 'prescription', last30Start, now);
    const repositoryAccess30 = countPageAccesses(events, 'repository', last30Start, now);
    const usersAccess30 = countPageAccesses(events, 'users', last30Start, now);
    const weeklySeries = buildWeeklyAccessSeries(events, now, 8);

    return `
      <section class="analytics-group">
        <div class="analytics-group-header">
          <strong>Uso do sistema</strong>
          <p class="analytics-note">Leitura dos ultimos 30 dias, com comparacao ao periodo anterior quando houver base historica.</p>
        </div>
        <div class="dashboard-stats">
          ${statCardWithTrend('Acessos 30 dias', access30, buildTrendText(access30, accessPrevious30, hasPreviousWindow))}
          ${statCardWithTrend('PDFs exportados', pdf30, buildTrendText(pdf30, pdfPrevious30, hasPreviousWindow))}
          ${statCardWithTrend('Treinos criados', created30, buildTrendText(created30, createdPrevious30, hasPreviousWindow))}
          ${statCardWithTrend('Dias ativos', activeDays30, buildTrendText(activeDays30, activeDaysPrevious30, hasPreviousWindow))}
          ${statCard('Acessos dashboard', dashboardAccess30)}
          ${statCard('Acessos analytics', analyticsAccess30)}
          ${statCard('Acessos prescricao', prescriptionAccess30)}
          ${statCard('Acessos repositorio', repositoryAccess30)}
          ${statCard('Acessos gestao', usersAccess30)}
          ${statCard('Media treinos/acesso', access30 ? (created30 / access30).toFixed(2) : '0')}
        </div>
        <div class="usage-chart-card">
          <div class="usage-chart-header">
            <strong>Acessos semanais</strong>
            <span>Ultimas ${weeklySeries.length} semanas</span>
          </div>
          <div class="usage-chart">
            ${weeklySeries.map((item) => renderWeeklyBar(item, weeklySeries)).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderExerciseUsageSection() {
    const usageSeries = buildExerciseUsageSeries(sessions).slice(0, 10);
    const topExercise = usageSeries[0];

    return `
      <section class="analytics-group">
        <div class="analytics-group-header">
          <strong>Uso dos exercicios</strong>
          <p class="analytics-note">Leitura consolidada dos exercicios mais prescritos nas sessoes gravadas.</p>
        </div>
        <div class="dashboard-stats">
          ${statCard('Exercicio mais usado', topExercise?.label || 'Sem dados')}
          ${statCard('Vezes do mais usado', topExercise?.value || 0)}
          ${statCard('Exercicios diferentes usados', usageSeries.length)}
        </div>
        <div class="usage-chart-card">
          <div class="usage-chart-header">
            <strong>Top exercicios prescritos</strong>
            <span>${usageSeries.length ? `${usageSeries.length} itens` : 'Sem dados ainda'}</span>
          </div>
          <div class="exercise-usage-list">
            ${usageSeries.length
              ? usageSeries.map((item) => renderExerciseUsageRow(item, usageSeries)).join('')
              : '<div class="empty-state">Nenhum exercicio foi usado em treinos salvos ainda.</div>'}
          </div>
        </div>
      </section>
    `;
  }

  function statCard(label, value) {
    return `
      <article class="dashboard-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }

  function statCardWithTrend(label, value, trend) {
    return `
      <article class="dashboard-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small class="dashboard-trend">${escapeHtml(trend)}</small>
      </article>
    `;
  }

  function getTopImplement(items) {
    const counts = new Map();
    items.forEach((item) => {
      const key = item.implement || 'Sem implemento';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return getTopLabel(counts);
  }

  function getTopSessionFocus(items) {
    const counts = new Map();
    items.forEach((session) => {
      const candidate = (deriveSessionEmphasis(session).highlights || []).find((item) => Number(item.total || 0) > 0);
      if (candidate) counts.set(candidate.label, (counts.get(candidate.label) || 0) + 1);
    });
    return counts.size ? getTopLabel(counts) : 'Sem dados';
  }

  function getTopLabel(counts) {
    let bestLabel = 'Sem dados';
    let bestValue = -1;
    counts.forEach((value, key) => {
      if (value > bestValue) {
        bestValue = value;
        bestLabel = key;
      }
    });
    return bestLabel;
  }

  function countEventsInWindow(events, type, start, end) {
    return events.filter((event) => event.type === type && Number(event.timestamp || 0) >= start && Number(event.timestamp || 0) < end).length;
  }

  function countUniqueActiveDays(events, start, end) {
    return new Set(
      events
        .filter((event) => Number(event.timestamp || 0) >= start && Number(event.timestamp || 0) < end)
        .map((event) => new Date(event.timestamp).toISOString().slice(0, 10))
    ).size;
  }

  function countPageAccesses(events, page, start, end) {
    return events.filter((event) => (
      event.type === 'access'
      && Number(event.timestamp || 0) >= start
      && Number(event.timestamp || 0) < end
      && String(event.meta?.page || '') === page
    )).length;
  }

  function buildTrendText(current, previous, hasComparison) {
    if (!hasComparison) return 'Sem base anterior';
    if (previous === 0 && current === 0) return 'Estavel vs 30 dias anteriores';
    if (previous === 0) return 'Nova alta vs 30 dias anteriores';
    const delta = current - previous;
    const percent = Math.round((delta / previous) * 100);
    if (delta === 0) return 'Estavel vs 30 dias anteriores';
    return `${delta > 0 ? '+' : ''}${percent}% vs 30 dias anteriores`;
  }

  function buildWeeklyAccessSeries(events, now, weeks) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const referenceTime = Number(now || Date.now());

    return Array.from({ length: weeks }, (_, index) => {
      const reverseIndex = weeks - index - 1;
      const end = reverseIndex === 0
        ? referenceTime
        : referenceTime - (reverseIndex * weekMs);
      const start = end - weekMs;
      return {
        label: new Date(start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: countEventsInWindow(events, 'access', start, end)
      };
    });
  }

  function renderWeeklyBar(item, series) {
    const maxValue = Math.max(...series.map((entry) => entry.value), 1);
    const height = Math.max(16, Math.round((item.value / maxValue) * 96));
    return `
      <div class="usage-bar-wrap">
        <span class="usage-bar-value">${escapeHtml(item.value)}</span>
        <div class="usage-bar" style="height:${height}px"></div>
        <span class="usage-bar-label">${escapeHtml(item.label)}</span>
      </div>
    `;
  }

  function buildExerciseUsageSeries(items) {
    const counts = new Map();
    items.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        const key = String(exercise.movement || exercise.id || 'Sem nome');
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label), 'pt-BR'));
  }

  function renderExerciseUsageRow(item, series) {
    const maxValue = Math.max(...series.map((entry) => entry.value), 1);
    const width = Math.max(8, Math.round((item.value / maxValue) * 100));
    return `
      <div class="exercise-usage-row">
        <div class="exercise-usage-copy">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(`${item.value} uso${item.value === 1 ? '' : 's'}`)}</span>
        </div>
        <div class="exercise-usage-track">
          <div class="exercise-usage-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }

  function renderUserManagement() {
    if (!elements.userManagementPanel || !elements.userManagementContent) return;
    if (!auth?.isMaster?.(currentUser)) {
      elements.userManagementPanel.hidden = true;
      return;
    }

    const users = auth.getUsers();
    const pendingUsers = users.filter((user) => user.status === 'pending');
    const approvedUsers = users.filter((user) => user.status === 'approved');

    elements.userManagementPanel.hidden = false;
    elements.userManagementContent.innerHTML = `
      <div class="user-admin-grid">
        <section class="user-admin-block">
          <div class="panel-header compact">
            <div>
              <p class="panel-title">Pendentes</p>
              <span class="panel-subtitle">Cadastros aguardando liberacao do Master.</span>
            </div>
          </div>
          <div class="user-admin-list">
            ${pendingUsers.length ? pendingUsers.map(renderPendingUserCard).join('') : '<div class="empty-state">Nenhum pedido pendente.</div>'}
          </div>
        </section>
        <section class="user-admin-block">
          <div class="panel-header compact">
            <div>
              <p class="panel-title">Usuarios ativos</p>
              <span class="panel-subtitle">Ajuste de nivel para usuarios ja aprovados.</span>
            </div>
          </div>
          <div class="user-admin-list">
            ${approvedUsers.length ? approvedUsers.map(renderApprovedUserCard).join('') : '<div class="empty-state">Nenhum usuario aprovado ainda.</div>'}
          </div>
        </section>
      </div>
    `;

    bindUserManagementActions();
  }

  function renderPendingUserCard(user) {
    return `
      <article class="user-card">
        <div class="user-card-head">
          <strong>${escapeHtml(user.name)}</strong>
          <span class="pill">${escapeHtml(auth.STATUS_LABELS[user.status] || 'Pendente')}</span>
        </div>
        <p>${escapeHtml(user.email)} | CPF ${escapeHtml(formatCpf(user.cpf))}</p>
        <p>${escapeHtml(user.crefType === 'student' ? 'Estudante' : 'Profissional')} | ${escapeHtml(user.cref || 'Sem CREF informado')}</p>
        <p>Solicitou: ${escapeHtml(auth.ROLE_LABELS[user.requestedRole] || 'Basico')}</p>
        <div class="user-card-actions">
          <select data-role-select="${escapeHtml(user.id)}">
            <option value="basic"${user.requestedRole === 'basic' ? ' selected' : ''}>Basico</option>
            <option value="advanced"${user.requestedRole === 'advanced' ? ' selected' : ''}>Avancado</option>
            <option value="master">Master</option>
          </select>
          <button class="primary-button compact-button" type="button" data-approve-user="${escapeHtml(user.id)}">Aprovar</button>
          <button class="ghost-button compact-button" type="button" data-reject-user="${escapeHtml(user.id)}">Negar</button>
        </div>
      </article>
    `;
  }

  function renderApprovedUserCard(user) {
    return `
      <article class="user-card">
        <div class="user-card-head">
          <strong>${escapeHtml(user.name)}</strong>
          <span class="pill">${escapeHtml(auth.ROLE_LABELS[user.role] || 'Usuario')}</span>
        </div>
        <p>${escapeHtml(user.email)} | CPF ${escapeHtml(formatCpf(user.cpf))}</p>
        <p>${escapeHtml(user.crefType === 'student' ? 'Estudante' : 'Profissional')} | ${escapeHtml(user.cref || 'Sem CREF informado')}</p>
        <div class="user-card-actions">
          <select data-role-select="${escapeHtml(user.id)}">
            <option value="basic"${user.role === 'basic' ? ' selected' : ''}>Basico</option>
            <option value="advanced"${user.role === 'advanced' ? ' selected' : ''}>Avancado</option>
            <option value="master"${user.role === 'master' ? ' selected' : ''}>Master</option>
          </select>
          <button class="ghost-button compact-button" type="button" data-update-user-role="${escapeHtml(user.id)}">Atualizar nivel</button>
        </div>
      </article>
    `;
  }

  function bindUserManagementActions() {
    document.querySelectorAll('[data-approve-user]').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-approve-user');
        const role = document.querySelector(`[data-role-select="${cssEscape(userId)}"]`)?.value || 'basic';
        try {
          auth.approveUser(userId, role, currentUser);
          renderUserManagement();
        } catch (error) {
          alert(error.message || 'Nao foi possivel aprovar o usuario.');
        }
      });
    });

    document.querySelectorAll('[data-reject-user]').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-reject-user');
        try {
          auth.rejectUser(userId, currentUser);
          renderUserManagement();
        } catch (error) {
          alert(error.message || 'Nao foi possivel negar o usuario.');
        }
      });
    });

    document.querySelectorAll('[data-update-user-role]').forEach((button) => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-update-user-role');
        const role = document.querySelector(`[data-role-select="${cssEscape(userId)}"]`)?.value || 'basic';
        try {
          auth.updateUserRole(userId, role, currentUser);
          renderUserManagement();
        } catch (error) {
          alert(error.message || 'Nao foi possivel atualizar o nivel.');
        }
      });
    });
  }

  function formatCpf(value) {
    const digits = String(value || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function cssEscape(value) {
    return String(value || '').replace(/"/g, '\\"');
  }

  function bindTrainingActions() {
    document.querySelectorAll('[data-export-session-pdf]').forEach((button) => {
      button.addEventListener('click', () => {
        const sessionId = button.getAttribute('data-export-session-pdf');
        exportSessionPdf(sessionId);
      });
    });

    document.querySelectorAll('[data-delete-session]').forEach((button) => {
      button.addEventListener('click', () => {
        const sessionId = button.getAttribute('data-delete-session');
        deleteSession(sessionId);
      });
    });
  }

  function deleteSession(sessionId) {
    if (!sessionId) return;
    if (!window.confirm('Excluir este treino criado?')) return;
    sessions = sessions.filter((session) => session.id !== sessionId);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    renderDashboard();
  }

  function exportSessionPdf(sessionId) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    const emphasis = deriveSessionEmphasis(session);
    const exportBaseName = buildPdfFileName(session.name || 'Treino', session.createdAt ? new Date(session.createdAt) : new Date());
    const previewHtml = buildPdfDocumentHtml(session, emphasis);
    const styleHtml = `
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Manrope, Arial, sans-serif; color: #201914; background: #f5efe6; }
        .pdf-sheet { display: grid; gap: 10px; }
        .pdf-header { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 14px; align-items: center; padding: 16px 18px; border-radius: 22px; background: linear-gradient(135deg, #8d0000, #b50000 52%, #0c4b7b 100%); color: #fff; }
        .pdf-header p { margin: 0; }
        .pdf-title h1 { margin: 4px 0 6px; font-family: Sora, Arial, sans-serif; font-size: 28px; line-height: 1; }
        .pdf-title .pdf-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.86; }
        .pdf-title .pdf-credit { font-size: 14px; opacity: 0.9; }
        .pdf-logo-wrap { display: flex; justify-content: center; align-items: center; padding: 10px 12px; border-radius: 18px; background: rgba(255,255,255,0.12); }
        .pdf-logo { width: 100%; max-width: 150px; max-height: 72px; object-fit: contain; }
        .pdf-meta { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pdf-meta-card { padding: 12px 14px; border-radius: 18px; background: rgba(255,255,255,0.14); }
        .pdf-meta-card span { display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.84; }
        .pdf-meta-card strong { font-family: Sora, Arial, sans-serif; font-size: 18px; line-height: 1.05; }
        .pdf-callout { display: grid; gap: 6px; padding: 14px 20px; border-radius: 20px; background: linear-gradient(135deg, #ffef57 0%, #ffd84a 55%, #ffc531 100%); color: #2b2014; border: 1px solid rgba(120, 82, 0, 0.2); box-shadow: 0 10px 24px rgba(255, 196, 61, 0.24); }
        .pdf-callout span { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800; }
        .pdf-callout strong { font-family: Sora, Arial, sans-serif; font-size: 22px; line-height: 1.05; }
        .pdf-body { display: grid; gap: 10px; align-items: start; }
        .pdf-exercises { display: grid; gap: 10px; align-content: start; }
        .pdf-exercise { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; padding: 10px; border-radius: 18px; background: rgba(255,255,255,0.92); border: 1px solid #ddd2c4; break-inside: avoid; }
        .pdf-exercise img, .pdf-exercise .pdf-image-placeholder { width: 88px; height: 72px; object-fit: cover; border-radius: 14px; background: #ebe1d5; }
        .pdf-exercise-copy { display: grid; gap: 4px; min-width: 0; }
        .pdf-pill { display: inline-flex; align-items: center; width: fit-content; padding: 4px 8px; border-radius: 999px; background: #efe7db; color: #6c5644; font-size: 11px; font-weight: 700; }
        .pdf-exercise-name { font-family: Sora, Arial, sans-serif; font-size: 24px; line-height: 1.02; color: #211812; }
        .pdf-muted { color: #675341; font-size: 12px; line-height: 1.25; }
        .pdf-emphasis-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pdf-emphasis-card { background: rgba(255,255,255,0.92); border: 1px solid #ddd2c4; border-radius: 18px; overflow: hidden; }
        .pdf-emphasis-card strong { display: block; padding: 10px 12px; background: #efe7db; font-size: 14px; }
        .pdf-emphasis-card table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .pdf-emphasis-card th, .pdf-emphasis-card td { padding: 7px 10px; text-align: left; border-bottom: 1px solid #efe7db; }
        .pdf-emphasis-card th { color: #675341; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .pdf-signature { display: grid; gap: 4px; margin-top: 10px; margin-left: auto; width: min(320px, 100%); padding-top: 12px; border-top: 1px solid rgba(103, 83, 65, 0.28); text-align: right; }
        .pdf-signature span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #675341; font-weight: 800; }
        .pdf-signature strong { font-family: Sora, Arial, sans-serif; font-size: 18px; line-height: 1.05; color: #211812; }
        .pdf-signature p { margin: 0; color: #675341; font-size: 12px; }
      </style>
    `;

    usage?.trackEvent?.('pdf_exported', {
      source: 'dashboard',
      mode: session.mode || 'intervalado',
      exercises: Number(session.exercises?.length || 0),
      totalMinutes: Number(session.totalMinutes || 0)
    });
    printHtmlAsPdf(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(exportBaseName)}</title>${styleHtml}</head><body>${previewHtml}</body></html>`);
  }

  function buildPdfDocumentHtml(session, emphasis) {
    const mode = session.mode || 'intervalado';
    const logoUrl = normalizeAssetUrl(LOGO_PATH);
    const signatureHtml = buildPdfSignatureHtml(currentUser);
    const exercisesHtml = (session.exercises || [])
      .map((exercise, index) => {
        const imageUrl = normalizeAssetUrl(getExerciseImagePath(exercise));
        const description = shorten(exercise.description || 'Sem descricao cadastrada.', 140);
        const detailsLine = mode === 'intervalado'
          ? `${formatMinutes(session.workMinutes || 0)} de estimulo | ${format4PisLabel(session.intensity4pis || '0')} | ${formatMinutes(session.restMinutes || 0)} de recuperacao | RER ${formatRerLabel(session.workMinutes || 0, session.restMinutes || 0)}`
          : `${session.repsPerExercise || 0} reps por exercicio | ${format4PisLabel(session.intensity4pis || '0')} | serie completa em ate ${formatMinutes(session.workMinutes || 0)}`;

        return `
          <article class="pdf-exercise">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(exercise.movement || `Exercicio ${index + 1}`)}">` : '<div class="pdf-image-placeholder"></div>'}
            <div class="pdf-exercise-copy">
              <span class="pdf-pill">Selecao ${index + 1}</span>
              <strong class="pdf-exercise-name">${escapeHtml(exercise.movement || `Exercicio ${index + 1}`)}</strong>
              <span class="pdf-muted">${escapeHtml(description)}</span>
              <span class="pdf-muted">${escapeHtml(`Implemento: ${exercise.implement || 'Nao informado'}`)}</span>
              <span class="pdf-muted">${escapeHtml(detailsLine)}</span>
            </div>
          </article>
        `;
      })
      .join('');

    const thirdMetaTitle = mode === 'intervalado' ? 'RER e 4PIS' : '4PIS e series';
    const thirdMetaValue = mode === 'intervalado'
      ? `${formatRerLabel(session.workMinutes || 0, session.restMinutes || 0)} | ${format4PisLabel(session.intensity4pis || '0')}`
      : `${format4PisLabel(session.intensity4pis || '0')} | ${Number(session.exercises?.length || 0)} x ${Number(session.seriesCount || 1)}`;

    return `
      <section class="pdf-sheet">
        <header class="pdf-header">
          <div class="pdf-title">
            <p class="pdf-kicker">Programa de Condicionamento Fisico para o Surfe</p>
            <h1>${escapeHtml(session.name || 'Treino')}</h1>
            <p class="pdf-credit">Repositorio de Exercicios sUrFPE</p>
          </div>
          <div class="pdf-logo-wrap">
            <img class="pdf-logo" src="${escapeHtml(logoUrl)}" alt="Logo sUrFPE Tech">
          </div>
          <div class="pdf-meta">
            <article class="pdf-meta-card"><span>Modo</span><strong>${escapeHtml(session.mode === 'rot' ? 'ROT' : 'Intervalado')}</strong></article>
            <article class="pdf-meta-card"><span>Tempo total</span><strong>${escapeHtml(formatMinutes(session.totalMinutes || 0))}</strong></article>
            <article class="pdf-meta-card"><span>${escapeHtml(thirdMetaTitle)}</span><strong>${escapeHtml(thirdMetaValue)}</strong></article>
          </div>
        </header>
        <section class="pdf-callout">
          <span>Orientacao do programa</span>
          <strong>${escapeHtml(buildSessionConfigLine(session))}</strong>
        </section>
        <section class="pdf-body">
          <section class="pdf-exercises">${exercisesHtml}</section>
          <section class="pdf-emphasis-grid">
            ${buildPdfEmphasisTable('Foco corporal', emphasis.highlights || [])}
            ${buildPdfEmphasisTable('Fundamentos do surfe', emphasis.foundationHighlights || [])}
            ${buildPdfEmphasisTable('Implementos', emphasis.implementHighlights || [])}
          </section>
        </section>
        ${signatureHtml}
      </section>
    `;
  }

  function buildPdfEmphasisTable(title, rows) {
    const safeRows = (rows || []).filter((item) => Number(item.percentage || 0) > 0);
    const tableRows = (safeRows.length ? safeRows : [{ label: 'Sem destaque', percentage: 0 }])
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.label || 'Sem destaque')}</td>
          <td>${escapeHtml(`${Math.round(item.percentage || 0)}%`)}</td>
        </tr>
      `)
      .join('');

    return `
      <article class="pdf-emphasis-card">
        <strong>${escapeHtml(title)}</strong>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Enfase</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </article>
    `;
  }

  function buildPdfSignatureHtml(user) {
    if (!user) {
      return `
        <section class="pdf-signature">
          <span>Assinatura da prescricao</span>
          <strong>Usuario nao identificado</strong>
          <p>CREF/Matricula: nao informado</p>
        </section>
      `;
    }

    const crefLabel = String(user.cref || '').trim() || 'nao informado';
    return `
      <section class="pdf-signature">
        <span>Assinatura da prescricao</span>
        <strong>${escapeHtml(user.name || 'Usuario sem nome')}</strong>
        <p>CREF/Matricula: ${escapeHtml(crefLabel)}</p>
      </section>
    `;
  }

  function printHtmlAsPdf(html) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);

    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    };

    const printFrame = () => {
      const targetWindow = frame.contentWindow;
      if (!targetWindow) {
        cleanup();
        alert('Nao foi possivel preparar a impressao do PDF.');
        return;
      }

      window.addEventListener('afterprint', cleanup, { once: true });
      targetWindow.focus();
      targetWindow.print();
      setTimeout(cleanup, 1500);
    };

    const frameDocument = frame.contentDocument || frame.contentWindow?.document;
    if (!frameDocument) {
      cleanup();
      alert('Nao foi possivel preparar a impressao do PDF.');
      return;
    }

    frame.onload = () => setTimeout(printFrame, 150);
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
  }

  function normalizeAssetUrl(src) {
    if (!src) return '';
    try {
      return new URL(String(src).replaceAll('\\', '/'), window.location.href).href;
    } catch (error) {
      return String(src).replaceAll('\\', '/');
    }
  }

  function formatRerLabel(workMinutes, restMinutes) {
    const safeWork = Number(workMinutes || 0);
    if (safeWork <= 0) return '1 : 0';
    return `1 : ${formatRatioValue(Number(restMinutes || 0) / safeWork)}`;
  }

  function formatRatioValue(value) {
    const rounded = Math.round(Number(value || 0) * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace('.', ',').replace(/0+$/, '').replace(/,$/, '');
  }

  function buildPdfFileName(sessionName, dateValue) {
    return `${formatDateCompact(dateValue)} - ${sanitizeFileName(sessionName)}`;
  }

  function formatDateCompact(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    const day = String(safeDate.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function sanitizeFileName(value) {
    return String(value || 'Treino')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Treino';
  }

  function shorten(value, limit) {
    const text = String(value || '').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
  }

  function parseNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatDateTime(value) {
    if (!value) return 'Data nao informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data nao informada';
    return date.toLocaleString('pt-BR');
  }

  function formatMinutes(value) {
    const totalSeconds = Math.round(Number(value || 0) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (seconds === 0) return `${minutes} min`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function getSessionExerciseAverage() {
    return sessions.length
      ? (sessions.reduce((sum, session) => sum + Number(session.exercises?.length || 0), 0) / sessions.length)
      : 0;
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
