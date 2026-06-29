(function () {
  const repository = window.EXERCISE_REPOSITORY || { exercises: [], meta: {} };
  const usage = window.SURFPE_USAGE || null;
  const auth = window.SURFPE_AUTH || null;
  const currentUser = auth?.getCurrentUser?.() || null;
  const EXERCISE_STORAGE_KEY = 'surfpe.exerciseRepository.v1';
  const SESSION_STORAGE_KEY = 'surfpe.trainingSessions.v1';
  const PAGE_SIZE = 12;
  const LOGO_PATH = 'assets/branding/logo-surfpe-tech.png';

  const labels = {
    scoreKeys: {
      upperBody: 'MMSS',
      lowerBody: 'MMII',
      trunk: 'Tronco',
      core: 'Core',
      balance: 'Equilíbrio'
    },
    foundationKeys: {
      popup: 'Popup',
      rowing: 'Remada',
      navigation: 'Navegação',
      railManeuvers: 'Manobras de Borda'
    },
    sportValenceKeys: {
      strengthEndurance: 'Força Resistente ou Pura',
      explosiveStrength: 'Força Explosiva',
      mobility: 'Mobilidade',
      balance: 'Equilíbrio',
      landing: 'Landing',
      aerobic: 'Aeróbio',
      speed: 'Velocidade',
      agility: 'Agilidade'
    }
  };

  const state = {
    exercises: loadExercises(),
    selectedItems: [],
    sessions: loadSessions(),
    search: '',
    implementFilters: new Set(),
    scoreFilters: new Set(),
    foundationFilters: new Set(),
    sportValenceFilters: new Set(),
    currentPage: 1
  };

  const elements = {
    exerciseGrid: document.getElementById('exerciseGrid'),
    searchInput: document.getElementById('searchInput'),
    implementFilters: document.getElementById('implementFilters'),
    scoreFilters: document.getElementById('scoreFilters'),
    foundationFilters: document.getElementById('foundationFilters'),
    sportValenceFilters: document.getElementById('sportValenceFilters'),
    pagination: document.getElementById('pagination'),
    clearFiltersButton: document.getElementById('clearFiltersButton'),
    clearSelectionButton: document.getElementById('clearSelectionButton'),
    randomSelectionButton: document.getElementById('randomSelectionButton'),
    randomModal: document.getElementById('randomModal'),
    randomForm: document.getElementById('randomForm'),
    sessionForm: document.getElementById('sessionForm'),
    randomExerciseCount: document.getElementById('randomExerciseCount'),
    closeRandomModalButton: document.getElementById('closeRandomModalButton'),
    cancelRandomButton: document.getElementById('cancelRandomButton'),
    selectedList: document.getElementById('selectedList'),
    sessionPreview: document.getElementById('sessionPreview'),
    sessionEmphasisGrid: document.getElementById('sessionEmphasisGrid'),
    saveSessionButton: document.getElementById('saveSessionButton'),
    exportPdfButton: document.getElementById('exportPdfButton'),
    exportJpegButton: document.getElementById('exportJpegButton'),
    sessionFeedback: document.getElementById('sessionFeedback'),
    savedSessionsList: document.getElementById('savedSessionsList'),
    sessionName: document.getElementById('sessionName'),
    sessionMode: document.getElementById('sessionMode'),
    workMinutes: document.getElementById('workMinutes'),
    workMinutesPart: document.getElementById('workMinutesPart'),
    workSecondsPart: document.getElementById('workSecondsPart'),
    intensity4pis: document.getElementById('intensity4pis'),
    restMinutes: document.getElementById('restMinutes'),
    restMinutesPart: document.getElementById('restMinutesPart'),
    restSecondsPart: document.getElementById('restSecondsPart'),
    seriesCount: document.getElementById('seriesCount'),
    repsPerExercise: document.getElementById('repsPerExercise'),
    workField: document.getElementById('workField'),
    workClusterLabel: document.getElementById('workClusterLabel'),
    intervalDurationGroup: document.getElementById('intervalDurationGroup'),
    durationGroupLabel: document.getElementById('durationGroupLabel'),
    intensityField: document.getElementById('intensityField'),
    restField: document.getElementById('restField'),
    restClusterLabel: document.getElementById('restClusterLabel'),
    repsField: document.getElementById('repsField'),
    workLabel: document.getElementById('workClusterLabel'),
    modeHint: document.getElementById('modeHint'),
    resultsCount: document.getElementById('resultsCount'),
    resultsSummary: document.getElementById('resultsSummary'),
    selectedCount: document.getElementById('selectedCount'),
    selectedListSubtitle: document.getElementById('selectedListSubtitle'),
    totalSessionTime: document.getElementById('totalSessionTime'),
    savedSessionCount: document.getElementById('savedSessionCount'),
    sessionHeadline: document.getElementById('sessionHeadline'),
    sessionRatio: document.getElementById('sessionRatio'),
    sessionTotalLabel: document.getElementById('sessionTotalLabel')
  };

  elements.exportJpegButton?.remove();

  bindEvents();
  renderFilterControls();
  syncAllDurationInputsFromModel();
  syncModeFields();
  loadSessionFromQuery();
  render();
  usage?.trackAccess?.('prescription');

  function loadExercises() {
    const saved = localStorage.getItem(EXERCISE_STORAGE_KEY);
    if (!saved) return (repository.exercises || []).map(normalizeExerciseData);

    try {
      return mergeExerciseLibraries(repository.exercises || [], JSON.parse(saved)).map(normalizeExerciseData);
    } catch (error) {
      console.warn('Falha ao restaurar a base editada. Usando base importada.', error);
      return (repository.exercises || []).map(normalizeExerciseData);
    }
  }

  function mergeExerciseLibraries(baseExercises, savedExercises) {
    const merged = new Map();

    (baseExercises || []).forEach((exercise) => {
      merged.set(Number(exercise.id), structuredClone(exercise));
    });

    (savedExercises || []).forEach((exercise) => {
      const id = Number(exercise?.id);
      const base = merged.get(id) || {};
      merged.set(id, { ...structuredClone(base), ...structuredClone(exercise || {}) });
    });

    return [...merged.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }

  function loadSessions() {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return [];

    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Falha ao restaurar sessões salvas.', error);
      return [];
    }
  }

  function normalizeExerciseData(exercise) {
    const normalized = structuredClone(exercise || {});
    normalized.sportValences = deriveSportValences(normalized);
    normalized.tags = buildExerciseTags(normalized);
    return normalized;
  }

  function deriveSportValences(exercise) {
    const valences = normalizeSportValences(exercise?.sportValences);
    if (!shouldClassifyAsMobility(exercise)) return valences;

    const withoutDefaultStrength = valences.filter((value) => value !== 'strengthEndurance');
    return withoutDefaultStrength.includes('mobility')
      ? withoutDefaultStrength
      : [...withoutDefaultStrength, 'mobility'];
  }

  function shouldClassifyAsMobility(exercise) {
    const sourceSheet = normalizeText(exercise?.source?.sheet);
    const tags = Array.isArray(exercise?.tags) ? exercise.tags.map((tag) => normalizeText(tag)) : [];
    return sourceSheet.includes('mobilidade') || tags.includes('mobilidade');
  }

  function buildExerciseTags(exercise) {
    const tags = Array.isArray(exercise?.tags) ? [...exercise.tags] : [];
    normalizeSportValences(exercise?.sportValences).forEach((key) => {
      const label = labels.sportValenceKeys[key];
      if (label && !tags.includes(label)) tags.push(label);
    });
    return tags;
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', (event) => {
      state.search = event.target.value.trim().toLowerCase();
      state.currentPage = 1;
      render();
    });

    elements.clearFiltersButton.addEventListener('click', () => {
      state.search = '';
      state.implementFilters.clear();
      state.scoreFilters.clear();
      state.foundationFilters.clear();
      state.sportValenceFilters.clear();
      elements.searchInput.value = '';
      renderFilterControls();
      render();
    });

    elements.clearSelectionButton.addEventListener('click', () => {
      state.selectedItems = [];
      render();
    });

    elements.randomSelectionButton.addEventListener('click', openRandomModal);
    elements.closeRandomModalButton.addEventListener('click', closeRandomModal);
    elements.cancelRandomButton.addEventListener('click', closeRandomModal);
    elements.randomForm.addEventListener('submit', (event) => {
      event.preventDefault();
      applyRandomSelection();
    });
    elements.randomModal.addEventListener('click', (event) => {
      if (event.target === elements.randomModal) {
        closeRandomModal();
      }
    });

    bindDurationInputSync('work');
    bindDurationInputSync('rest');
    elements.workMinutes.addEventListener('input', () => {
      syncDurationInputsFromModel('work');
      render();
    });
    elements.intensity4pis.addEventListener('input', render);
    elements.restMinutes.addEventListener('input', () => {
      syncDurationInputsFromModel('rest');
      render();
    });
    elements.seriesCount.addEventListener('input', render);
    elements.sessionMode.addEventListener('change', () => {
      clearSessionFeedback();
      syncModeFields();
      render();
    });
    elements.repsPerExercise.addEventListener('input', render);
    elements.sessionName.addEventListener('input', render);
    [elements.searchInput, elements.workMinutesPart, elements.workSecondsPart, elements.intensity4pis, elements.restMinutesPart, elements.restSecondsPart, elements.seriesCount, elements.repsPerExercise, elements.sessionName].forEach((element) => {
      element?.addEventListener('input', clearSessionFeedback);
    });
    elements.saveSessionButton.addEventListener('click', saveSession);
    elements.exportPdfButton.addEventListener('click', exportSessionAsPdf);
    elements.exportJpegButton?.addEventListener('click', exportSessionAsJpeg);
  }

  function renderFilterControls() {
    renderChips(elements.implementFilters, uniqueValues(state.exercises.map((exercise) => exercise.implement)), state.implementFilters);
    renderChips(elements.scoreFilters, Object.keys(labels.scoreKeys), state.scoreFilters, labels.scoreKeys);
    renderChips(elements.foundationFilters, Object.keys(labels.foundationKeys), state.foundationFilters, labels.foundationKeys);
    renderChips(elements.sportValenceFilters, Object.keys(labels.sportValenceKeys), state.sportValenceFilters, labels.sportValenceKeys);
  }

  function renderChips(container, options, activeSet, dictionary) {
    container.innerHTML = '';
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chip ${activeSet.has(option) ? 'is-active' : ''}`;
      button.textContent = dictionary?.[option] || option;
      button.addEventListener('click', () => {
        if (activeSet.has(option)) activeSet.delete(option);
        else activeSet.add(option);
        state.currentPage = 1;
        renderChips(container, options, activeSet, dictionary);
        render();
      });
      container.appendChild(button);
    });
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }

  function getFilteredExercises() {
    return state.exercises
      .filter((exercise) => {
        const searchBlob = [
          exercise.movement,
          exercise.description,
          exercise.implement,
          ...(exercise.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (state.search && !searchBlob.includes(state.search)) return false;
        if (state.implementFilters.size > 0 && !state.implementFilters.has(exercise.implement)) return false;

        if (state.scoreFilters.size > 0) {
          const ok = [...state.scoreFilters].every((key) => Number(exercise.scores?.[key] || 0) > 0);
          if (!ok) return false;
        }

        if (state.foundationFilters.size > 0) {
          const ok = [...state.foundationFilters].every((key) => Number(exercise.foundations?.[key] || 0) > 0);
          if (!ok) return false;
        }

        if (state.sportValenceFilters.size > 0) {
          const valences = normalizeSportValences(exercise.sportValences);
          const ok = [...state.sportValenceFilters].every((key) => valences.includes(key));
          if (!ok) return false;
        }

        return true;
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  }

  function render() {
    const filtered = getFilteredExercises();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;
    const start = (state.currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);
    const mode = getSessionMode();
    const workMinutes = modeUsesWork(mode) ? getNumber(elements.workMinutes.value) : 0;
    const intensity4pis = getIntensity4pisValue();
    const restMinutes = modeUsesRest(mode) ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = modeUsesReps(mode) ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    const blockMinutes = mode === 'intervalado' ? workMinutes + restMinutes : workMinutes;
    const roundMinutes = state.selectedItems.length === 0 ? 0 : getRoundMinutes(mode, workMinutes, restMinutes, state.selectedItems.length);
    const totalMinutes = roundMinutes * seriesCount;
    const sessionName = elements.sessionName.value.trim();
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    syncModeFields();

    elements.resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`;
    elements.resultsSummary.textContent = filtered.length
      ? `Página ${state.currentPage} de ${totalPages}`
      : (state.search ? `Busca por "${state.search}"` : 'Banco completo');
    elements.selectedCount.textContent = String(state.selectedItems.length);
    if (elements.selectedListSubtitle) {
      const count = state.selectedItems.length;
      elements.selectedListSubtitle.textContent = `${count} ${count === 1 ? 'exercício selecionado' : 'exercícios selecionados'}.`;
      elements.selectedListSubtitle.classList.toggle('selected-list-count', count > 0);
    }
    elements.totalSessionTime.textContent = formatSessionTotal(mode, totalMinutes);
    if (elements.savedSessionCount) {
      elements.savedSessionCount.textContent = String(state.sessions.length);
    }
    elements.sessionHeadline.textContent = state.selectedItems.length
      ? `${getModeLabel(mode)} | ${seriesCount} série${seriesCount === 1 ? '' : 's'} | ${state.selectedItems.length} ${isMobilityMode(mode) ? 'movimento' : 'exercício'}${state.selectedItems.length === 1 ? '' : 's'}`
      : 'Nenhum exercício selecionado';
    elements.sessionRatio.textContent = getSummaryRatioText(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis);
    elements.sessionTotalLabel.textContent = `Tempo total: ${formatSessionTotal(mode, totalMinutes)}`;

    renderExerciseGrid(paginated);
    renderPagination(totalPages);
    renderSelectedList(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise);
    renderSessionEmphasis(emphasis);
    renderSessionPreview(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis);
    renderSavedSessions();
  }

  function renderExerciseGrid(exercises) {
    elements.exerciseGrid.innerHTML = '';

    if (exercises.length === 0) {
      elements.exerciseGrid.innerHTML = '<div class="empty-state">Nenhum exercício encontrado com os filtros atuais.</div>';
      return;
    }

    exercises.forEach((exercise) => {
      const isSelected = state.selectedItems.some((item) => item.exercise.id === exercise.id);
      const card = document.createElement('article');
      card.className = `exercise-card ${isSelected ? 'is-selected' : ''}`;
      card.innerHTML = `
        ${exercise.image?.path ? `<img src="${exercise.image.path}" alt="${escapeHtml(exercise.movement)}">` : '<div class="detail-image"></div>'}
        <div class="card-meta">
          <span class="pill">#${exercise.id}</span>
          ${exercise.implement ? `<span class="pill">${escapeHtml(exercise.implement)}</span>` : ''}
        </div>
        <h3>${escapeHtml(exercise.movement)}</h3>
        <p>${escapeHtml(shorten(exercise.description || 'Sem descrição cadastrada.', 110))}</p>
        <div class="card-actions">
          <button class="primary-button compact-button" type="button">${isSelected ? 'Adicionar novamente' : 'Adicionar à sessão'}</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => addExercise(exercise));
      elements.exerciseGrid.appendChild(card);
    });
  }

  function renderPagination(totalPages) {
    elements.pagination.innerHTML = '';
    if (totalPages <= 1) return;

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chip ${page === state.currentPage ? 'is-active' : ''}`;
      button.textContent = String(page);
      button.addEventListener('click', () => {
        state.currentPage = page;
        render();
      });
      elements.pagination.appendChild(button);
    }
  }

  function addExercise(exercise) {
    state.selectedItems.push({
      entryId: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${exercise.id}-${Date.now()}-${Math.random()}`,
      exercise: structuredClone(exercise)
    });
    render();
  }

  function openRandomModal() {
    if (!state.exercises.length) {
      alert('Não há exercícios disponíveis no banco para sorteio.');
      return;
    }

    elements.randomExerciseCount.value = String(Math.max(1, state.selectedItems.length || 4));
    elements.randomModal.hidden = false;
    queueMicrotask(() => elements.randomExerciseCount.focus());
  }

  function closeRandomModal() {
    elements.randomModal.hidden = true;
  }

  function applyRandomSelection() {
    if (!state.exercises.length) {
      alert('Não há exercícios disponíveis no banco para sorteio.');
      return;
    }

    const desiredCount = Math.floor(Number(elements.randomExerciseCount.value));
    if (!Number.isFinite(desiredCount) || desiredCount <= 0) {
      alert('Informe um número válido de exercícios.');
      return;
    }

    const selectedFoundations = [...elements.randomForm.querySelectorAll('input[name="randomFoundation"]:checked')]
      .map((input) => input.value);
    const availableCount = state.exercises.length;
    const finalCount = Math.min(desiredCount, availableCount);
    const chosenExercises = pickWeightedExercises(state.exercises, finalCount, selectedFoundations);

    state.selectedItems = chosenExercises.map((exercise) => ({
      entryId: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${exercise.id}-${Date.now()}-${Math.random()}`,
      exercise: structuredClone(exercise)
    }));

    closeRandomModal();

    if (desiredCount > availableCount) {
      alert(`O banco possui ${availableCount} exercícios. A sessão foi montada com esse total máximo.`);
    }

    render();
  }

  function pickWeightedExercises(exercises, count, selectedFoundations) {
    if (!selectedFoundations.length) {
      return [...exercises]
        .map((exercise) => ({ exercise, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .slice(0, count)
        .map((item) => item.exercise);
    }

    const pool = [...exercises];
    const picked = [];

    while (picked.length < count && pool.length) {
      const weights = pool.map((exercise) => getFoundationWeight(exercise, selectedFoundations));
      const totalWeight = weights.reduce((sum, value) => sum + value, 0);
      let target = Math.random() * totalWeight;
      let chosenIndex = 0;

      for (let index = 0; index < pool.length; index += 1) {
        target -= weights[index];
        if (target <= 0) {
          chosenIndex = index;
          break;
        }
      }

      picked.push(pool.splice(chosenIndex, 1)[0]);
    }

    return picked;
  }

  function getFoundationWeight(exercise, selectedFoundations) {
    const emphasisScore = selectedFoundations.reduce((sum, key) => sum + Number(exercise.foundations?.[key] || 0), 0);
    if (emphasisScore <= 0) return 0.25;
    return 1 + (emphasisScore * 6);
  }

  function renderSelectedList(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise) {
    elements.selectedList.innerHTML = '';

    if (state.selectedItems.length === 0) {
      elements.selectedList.innerHTML = '<div class="empty-state">Adicione exercícios à sessão para montar a prescrição.</div>';
      return;
    }

    state.selectedItems.forEach((item, index) => {
      const row = document.createElement('article');
      row.className = 'selected-item';
      row.innerHTML = `
        ${item.exercise.image?.path ? `<img class="selected-thumb" src="${item.exercise.image.path}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="selected-thumb"></div>'}
        <div class="selected-main">
          <div class="selected-topline">
            <span class="pill">#${index + 1}</span>
            <span class="pill">${escapeHtml(item.exercise.implement || 'Sem implemento')}</span>
          </div>
          <strong>${escapeHtml(item.exercise.movement)}</strong>
          <span class="selected-time">${getExerciseTimingText(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise)}</span>
        </div>
        <div class="selected-actions">
          <button class="ghost-button compact-button" type="button" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="ghost-button compact-button" type="button" ${index === state.selectedItems.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ghost-button compact-button" type="button">Remover</button>
        </div>
      `;

      const [moveUpButton, moveDownButton, removeButton] = row.querySelectorAll('button');
      moveUpButton.addEventListener('click', () => moveItem(index, -1));
      moveDownButton.addEventListener('click', () => moveItem(index, 1));
      removeButton.addEventListener('click', () => removeItem(index));

      elements.selectedList.appendChild(row);
    });
  }

  function moveItem(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= state.selectedItems.length) return;

    const snapshot = [...state.selectedItems];
    [snapshot[index], snapshot[target]] = [snapshot[target], snapshot[index]];
    state.selectedItems = snapshot;
    render();
  }

  function removeItem(index) {
    state.selectedItems.splice(index, 1);
    render();
  }

  function renderSessionEmphasis(emphasis) {
    if (!emphasis || emphasis.totalExercises === 0) {
      elements.sessionEmphasisGrid.innerHTML = '<div class="empty-state">Selecione exercícios para ver o perfil de ênfase da sessão.</div>';
      return;
    }

    elements.sessionEmphasisGrid.innerHTML = `
      ${renderEmphasisTable('Foco corporal', emphasis.highlights)}
      ${renderEmphasisTable('Fundamentos do surfe', emphasis.foundationHighlights)}
      ${renderEmphasisTable('Implementos', emphasis.implementHighlights)}
    `;
  }

  function renderSessionPreview(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    if (state.selectedItems.length === 0) {
      elements.sessionPreview.innerHTML = '<div class="empty-state">A diagramação da sessão aparecerá aqui quando houver exercícios selecionados.</div>';
      return;
    }

    const title = sessionName || 'Sessão de treinamento';
    const intensity4pis = mode === 'intervalado' ? getIntensity4pisValue() : '';
    const cards = state.selectedItems
      .map((item, index) => `
        <article class="session-preview-card">
          ${item.exercise.image?.path ? `<img class="session-preview-image" src="${item.exercise.image.path}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="session-preview-image"></div>'}
          <div class="session-preview-copy">
            <span class="pill">Seleção ${index + 1}</span>
            <strong>${escapeHtml(item.exercise.movement)}</strong>
            <span>${mode === 'intervalado' ? `${formatMinutes(workMinutes)} de execução` : `${repsPerExercise} reps em até ${formatMinutes(workMinutes)}`}</span>
            <span>${mode === 'intervalado' ? `${formatMinutes(restMinutes)} de recuperação` : 'Recuperação incluída no tempo máximo'}</span>
          </div>
        </article>
      `)
      .join('');

    elements.sessionPreview.innerHTML = `
      <section class="program-sheet">
        <header class="program-sheet-header">
          <div>
            <p class="program-sheet-kicker">Programa de Condicionamento Físico para o Surfe</p>
            <h2>${escapeHtml(title)}</h2>
            <p class="credit">Repositório de Exercícios sUrFPE</p>
          </div>
          <div class="program-logo-wrap">
            <img class="program-logo" src="${LOGO_PATH}" alt="Logo sUrFPE Tech">
          </div>
          <div class="program-sheet-meta">
            <strong>${formatMinutes(totalMinutes)}</strong>
            <span>${state.selectedItems.length} exercícios</span>
            <span>${seriesCount} séries | ${mode === 'intervalado' ? 'Intervalado' : 'ROT'}</span>
          </div>
        </header>
        <div class="program-strip">
          <strong>${seriesCount} série${seriesCount === 1 ? '' : 's'}</strong>
          <span>|</span>
          <strong>${state.selectedItems.length} exercícios por série</strong>
          <span>|</span>
          <strong>${formatMinutes(roundMinutes)} por série</strong>
          <span>|</span>
          <strong>Total ${formatMinutes(totalMinutes)}</strong>
        </div>
        <div class="program-emphasis-line">
          <strong>Configuração</strong>
          <span>${escapeHtml(getModeSummaryText(mode, workMinutes, restMinutes, repsPerExercise))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Foco corporal</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.highlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Fundamentos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.foundationHighlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Implementos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.implementHighlights, true))}</span>
        </div>
        <div class="session-preview-grid">${cards}</div>
      </section>
    `;
  }

  function saveSession() {
    if (state.selectedItems.length === 0) {
      alert('Selecione pelo menos um exercício para gravar a sessão.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const intensity4pis = getIntensity4pisValue();
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    if (workMinutes <= 0) {
      alert('Informe um tempo de exercício maior que zero para fechar a sessão.');
      return;
    }
    if (mode === 'rot' && repsPerExercise <= 0) {
      alert('Informe o número de repetições por exercício para o modo ROT.');
      return;
    }
    const totalMinutes = (mode === 'intervalado'
      ? state.selectedItems.length * (workMinutes + restMinutes)
      : workMinutes) * seriesCount;
    const fullExercises = state.selectedItems.map((item) => structuredClone(item.exercise));
    const emphasis = summarizeSessionEmphasis(fullExercises);

    const session = {
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `session-${Date.now()}`,
      name: elements.sessionName.value.trim() || `Sessão ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: new Date().toISOString(),
      mode,
      workMinutes,
      intensity4pis,
      restMinutes,
      seriesCount,
      repsPerExercise,
      totalMinutes,
      emphasis,
      exercises: fullExercises.map((exercise, index) => ({
        order: index + 1,
        ...exercise
      }))
    };

    state.sessions.unshift(session);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.sessions));
    usage?.trackEvent?.('session_created', {
      mode,
      exercises: fullExercises.length,
      totalMinutes
    });
    render();
    alert('Sessão gravada com sucesso.');
  }

  function exportSessionAsPdf() {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercícios para exportar a sessão.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    if (workMinutes <= 0) {
      alert('Informe um tempo de exercício maior que zero para exportar a sessão.');
      return;
    }

    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    if (mode === 'rot' && repsPerExercise <= 0) {
      alert('Informe o número de repetições por exercício para exportar em modo ROT.');
      return;
    }
    const roundMinutes = state.selectedItems.length * (mode === 'intervalado' ? (workMinutes + restMinutes) : workMinutes);
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const sessionName = elements.sessionName.value.trim() || 'Sessão de treinamento';
    const exportBaseName = `${slugify(sessionName)}-${formatDateUs(new Date())}`;

    const printWindow = window.open('', '_blank', 'width=1280,height=960');
    if (!printWindow) {
      alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.');
      return;
    }

    const previewHtml = buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis);
    const styleHtml = `
      <style>
        body { font-family: Manrope, Arial, sans-serif; margin: 26px; color: #221b17; background: #f7f2e9; }
        .pdf-sheet { display: grid; gap: 16px; }
        .pdf-header { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 18px; align-items: start; padding: 20px; background: linear-gradient(135deg, #006d77, #0d8f9a); color: #fff; border-radius: 20px; }
        .pdf-title h1 { margin: 0 0 8px; font-size: 30px; }
        .pdf-title p { margin: 0; }
        .pdf-logo-wrap { display: flex; justify-content: flex-end; }
        .pdf-logo { width: 200px; max-height: 80px; object-fit: contain; }
        .pdf-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pdf-meta-card { padding: 12px; background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 14px; }
        .pdf-meta-card span { display: block; color: #695746; font-size: 12px; margin-bottom: 4px; }
        .pdf-meta-card strong { font-size: 22px; }
        .pdf-strip { padding: 12px 16px; background: #ffe44d; border-radius: 16px; font-weight: 800; text-align: center; }
        .pdf-emphasis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .pdf-emphasis-card { background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 16px; overflow: hidden; }
        .pdf-emphasis-card strong { display: block; padding: 12px 14px; background: #efe8dd; }
        .pdf-emphasis-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pdf-emphasis-card th, .pdf-emphasis-card td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #efe8dd; }
        .pdf-emphasis-card th { text-transform: uppercase; font-size: 11px; color: #695746; }
        .pdf-exercises { display: grid; gap: 10px; }
        .pdf-exercise { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: center; padding: 10px; background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 16px; break-inside: avoid; }
        .pdf-exercise img { width: 120px; height: 82px; object-fit: cover; border-radius: 12px; background: #eee6db; }
        .pdf-exercise-copy { display: grid; gap: 4px; }
        .pdf-pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #efe8dd; color: #695746; font-size: 12px; }
        .pdf-muted { color: #695746; }
      </style>
    `;

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${exportBaseName}</title>${styleHtml}</head><body>${previewHtml}</body></html>`);
    printWindow.document.close();
    printWindow.document.title = exportBaseName;
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }

  async function exportSessionAsJpeg() {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercícios para exportar a sessão.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const intensity4pis = getIntensity4pisValue();
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    if (workMinutes <= 0) {
      alert('Informe um tempo de exercício maior que zero para exportar a sessão.');
      return;
    }
    if (mode === 'rot' && repsPerExercise <= 0) {
      alert('Informe o número de repetições por exercício para exportar em modo ROT.');
      return;
    }

    const sessionName = elements.sessionName.value.trim() || 'Sessão de treinamento';
    const roundMinutes = state.selectedItems.length * (mode === 'intervalado' ? (workMinutes + restMinutes) : workMinutes);
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const width = 1600;
    const headerHeight = 230;
    const cardHeight = 150;
    const emphasisHeight = 82;
    const footerHeight = 50;
    const gap = 10;
    const height = headerHeight + emphasisHeight + (cardHeight + gap) * state.selectedItems.length + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f7f2e9';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#006d77');
    gradient.addColorStop(1, '#0d8f9a');
    ctx.fillStyle = gradient;
    roundRect(ctx, 60, 40, width - 120, 140, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Manrope, sans-serif';
    ctx.fillText('Programa de Condicionamento Físico para o Surfe', 96, 82);
    ctx.font = '800 36px Sora, sans-serif';
    ctx.fillText(sessionName, 96, 128);
    ctx.font = '600 20px Manrope, sans-serif';
    ctx.fillText(`Repositório de Exercícios sUrFPE`, 96, 160);

    try {
      const logo = await loadImage(LOGO_PATH);
      drawContainImage(ctx, logo, width - 340, 48, 220, 96);
    } catch (error) {
      console.warn('Não foi possível carregar o logo para exportação.', error);
    }

    ctx.fillStyle = '#ffd84a';
    roundRect(ctx, 60, 196, width - 120, 54, 16);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '800 22px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${seriesCount} séries | ${state.selectedItems.length} exercícios por série | ${formatMinutes(roundMinutes)} por série | Total ${formatMinutes(totalMinutes)}`,
      width / 2,
      230
    );
    ctx.textAlign = 'start';

    ctx.fillStyle = '#efe8dd';
    roundRect(ctx, 60, 264, width - 120, 54, 16);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '700 18px Manrope, sans-serif';
    wrapText(
      ctx,
      `Corporal: ${formatEmphasisHighlights(emphasis.highlights)} | Fundamentos: ${formatEmphasisHighlights(emphasis.foundationHighlights)} | Implementos: ${formatEmphasisHighlights(emphasis.implementHighlights, true)}`,
      84,
      298,
      width - 168,
      22
    );

    let top = 334;
    for (let index = 0; index < state.selectedItems.length; index += 1) {
      const item = state.selectedItems[index];
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.18)';
      ctx.lineWidth = 2;
      roundRect(ctx, 60, top, width - 120, cardHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9d0208';
      roundRect(ctx, 84, top + 16, 72, 34, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px Manrope, sans-serif';
      ctx.fillText(String(index + 1), 112, top + 39);

      if (item.exercise.image?.path) {
        try {
          const image = await loadImage(item.exercise.image.path);
          drawCoverImage(ctx, image, 178, top + 14, 140, 108, 12);
        } catch (error) {
          ctx.fillStyle = '#e7dfd2';
          roundRect(ctx, 178, top + 14, 140, 108, 12);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e7dfd2';
        roundRect(ctx, 178, top + 14, 140, 108, 12);
        ctx.fill();
      }

      ctx.fillStyle = '#221b17';
      ctx.font = '800 24px Sora, sans-serif';
      ctx.fillText(item.exercise.movement, 342, top + 40);
      ctx.font = '600 18px Manrope, sans-serif';
      ctx.fillStyle = '#695746';
      ctx.fillText(`Implemento: ${item.exercise.implement || 'Não informado'}`, 342, top + 68);
      ctx.fillText(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise), 342, top + 94);
      wrapText(ctx, item.exercise.description || 'Sem descrição cadastrada.', 342, top + 120, 1160, 22);

      top += cardHeight + gap;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) {
      const fallbackUrl = canvas.toDataURL('image/jpeg', 0.95);
      downloadDataUrl(fallbackUrl, `${slugify(sessionName)}.jpeg`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(sessionName)}.jpeg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderSavedSessions() {
    if (!elements.savedSessionsList) return;
    elements.savedSessionsList.innerHTML = '';

    if (state.sessions.length === 0) {
      elements.savedSessionsList.innerHTML = '<div class="empty-state">Nenhuma sessão finalizada foi gravada ainda.</div>';
      return;
    }

    state.sessions.slice(0, 8).forEach((session) => {
      const item = document.createElement('article');
      item.className = 'saved-session';
      const derivedEmphasis = session.emphasis || summarizeSessionEmphasis(
        (session.exercises || []).map((exercise) => {
          const baseExercise = state.exercises.find((item) => Number(item.id) === Number(exercise.id));
          return {
            ...(baseExercise || {}),
            ...exercise,
            scores: exercise.scores || baseExercise?.scores || {},
            foundations: exercise.foundations || baseExercise?.foundations || {}
          };
        })
      );
      const emphasisText = [
        `Corporal: ${formatEmphasisHighlights(derivedEmphasis.highlights)}`,
        `Fundamentos: ${formatEmphasisHighlights(derivedEmphasis.foundationHighlights)}`,
        `Implementos: ${formatEmphasisHighlights(derivedEmphasis.implementHighlights, true)}`
      ].join(' | ');
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(session.name)}</strong>
          <p>${new Date(session.createdAt).toLocaleString('pt-BR')}</p>
          <p>${escapeHtml(emphasisText)}</p>
        </div>
        <div class="saved-session-meta">
          <span class="pill">${session.exercises.length} exercícios</span>
          <span class="pill">${session.totalMinutes} min</span>
          <button class="ghost-button compact-button" type="button">Abrir sessão</button>
        </div>
      `;
      item.querySelector('button').addEventListener('click', () => loadSavedSession(session.id));
      elements.savedSessionsList.appendChild(item);
    });
  }

  function loadSavedSession(sessionId) {
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) return;

    elements.sessionName.value = session.name || '';
    elements.sessionMode.value = session.mode || 'intervalado';
    elements.workMinutes.value = session.workMinutes ?? '';
    elements.intensity4pis.value = session.intensity4pis ?? '0';
    elements.restMinutes.value = session.restMinutes ?? '';
    syncAllDurationInputsFromModel();
    elements.seriesCount.value = session.seriesCount ?? 1;
    elements.repsPerExercise.value = session.repsPerExercise ?? 5;
    syncModeFields();
    state.selectedItems = session.exercises
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((exercise) => {
        const baseExercise = state.exercises.find((item) => Number(item.id) === Number(exercise.id));
        return {
          entryId: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${exercise.id}-${Date.now()}-${Math.random()}`,
          exercise: normalizeExerciseData({
            ...(baseExercise || {}),
            ...exercise,
            scores: exercise.scores || baseExercise?.scores || {},
            foundations: exercise.foundations || baseExercise?.foundations || {},
            image: exercise.image ? (typeof exercise.image === 'string' ? { path: exercise.image } : exercise.image) : (baseExercise?.image || {})
          })
        };
      });
    render();
  }

  function loadSessionFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (sessionId) {
      loadSavedSession(sessionId);
    }
  }

  function getNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function bindDurationInputSync(kind) {
    const minuteField = kind === 'work' ? elements.workMinutesPart : elements.restMinutesPart;
    const secondField = kind === 'work' ? elements.workSecondsPart : elements.restSecondsPart;
    [minuteField, secondField].forEach((field) => {
      field?.addEventListener('input', () => {
        syncDurationModelFromInputs(kind);
        render();
      });
      field?.addEventListener('change', () => {
        syncDurationModelFromInputs(kind, true);
        render();
      });
    });
  }

  function syncAllDurationInputsFromModel() {
    syncDurationInputsFromModel('work');
    syncDurationInputsFromModel('rest');
  }

  function syncDurationInputsFromModel(kind) {
    const hiddenField = kind === 'work' ? elements.workMinutes : elements.restMinutes;
    const minuteField = kind === 'work' ? elements.workMinutesPart : elements.restMinutesPart;
    const secondField = kind === 'work' ? elements.workSecondsPart : elements.restSecondsPart;
    const totalSeconds = Math.max(0, Math.round(getNumber(hiddenField?.value) * 60));
    minuteField.value = String(Math.floor(totalSeconds / 60));
    secondField.value = String(totalSeconds % 60);
  }

  function syncDurationModelFromInputs(kind, normalizeVisible = false) {
    const hiddenField = kind === 'work' ? elements.workMinutes : elements.restMinutes;
    const minuteField = kind === 'work' ? elements.workMinutesPart : elements.restMinutesPart;
    const secondField = kind === 'work' ? elements.workSecondsPart : elements.restSecondsPart;
    const minutes = Math.max(0, Math.floor(getNumber(minuteField?.value)));
    const seconds = Math.max(0, Math.floor(getNumber(secondField?.value)));
    const normalizedTotalSeconds = (minutes * 60) + seconds;
    hiddenField.value = String(normalizedTotalSeconds / 60);

    if (normalizeVisible) {
      minuteField.value = String(Math.floor(normalizedTotalSeconds / 60));
      secondField.value = String(normalizedTotalSeconds % 60);
    }
  }

  function getSessionMode() {
    const mode = String(elements.sessionMode.value || '').trim();
    return ['intervalado', 'rot', 'mobility_reps', 'mobility_time'].includes(mode) ? mode : 'intervalado';
  }

  function syncModeFields() {
    const mode = getSessionMode();
    elements.repsField.hidden = mode !== 'rot';
    elements.restField.hidden = mode !== 'intervalado';
    elements.workLabel.textContent = mode === 'intervalado' ? 'Tempo por exercício' : 'Tempo máximo por exercício';
    elements.modeHint.textContent = mode === 'intervalado'
      ? 'No modo intervalado, o tempo total considera estímulo + recuperação para cada exercício.'
      : 'No modo ROT, você define as repetições por exercício e o tempo máximo total de cada exercício, já incluindo a recuperação.';
  }

  function formatMinutes(value) {
    const totalSeconds = Math.round(Number(value || 0) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (seconds === 0) return `${minutes} min`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function getExerciseTimingText(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise) {
    return mode === 'intervalado'
      ? `${formatMinutes(workMinutes)} de trabalho + ${formatMinutes(restMinutes)} de recuperação = ${formatMinutes(blockMinutes)}`
      : `${repsPerExercise} reps em até ${formatMinutes(workMinutes)} no total`;
  }

  function getModeSummaryText(mode, workMinutes, restMinutes, repsPerExercise) {
    return mode === 'intervalado'
      ? `${formatMinutes(workMinutes)} de estímulo + ${formatMinutes(restMinutes)} de recuperação`
      : `${repsPerExercise} reps em até ${formatMinutes(workMinutes)} por exercício`;
  }

  function getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise) {
    return mode === 'intervalado'
      ? `Execução: ${formatMinutes(workMinutes)} | Recuperação: ${formatMinutes(restMinutes)} | Séries: ${seriesCount}`
      : `ROT: ${repsPerExercise} reps em até ${formatMinutes(workMinutes)} | Séries: ${seriesCount}`;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function summarizeSessionEmphasis(exercises) {
    const scoreTotals = Object.fromEntries(Object.keys(labels.scoreKeys).map((key) => [key, 0]));
    const foundationTotals = Object.fromEntries(Object.keys(labels.foundationKeys).map((key) => [key, 0]));
    const implementTotals = new Map();

    exercises.forEach((exercise) => {
      Object.keys(scoreTotals).forEach((key) => {
        scoreTotals[key] += Number(exercise.scores?.[key] || 0);
      });
      Object.keys(foundationTotals).forEach((key) => {
        foundationTotals[key] += Number(exercise.foundations?.[key] || 0);
      });
      const implement = exercise.implement || 'Sem implemento';
      implementTotals.set(implement, (implementTotals.get(implement) || 0) + 1);
    });

    const totalExercises = exercises.length;
    const scoreGrandTotal = Object.values(scoreTotals).reduce((sum, value) => sum + value, 0);
    const foundationGrandTotal = Object.values(foundationTotals).reduce((sum, value) => sum + value, 0);
    const implementGrandTotal = Array.from(implementTotals.values()).reduce((sum, value) => sum + value, 0);

    const highlights = Object.entries(labels.scoreKeys)
      .map(([key, label]) => ({
        key,
        label,
        total: scoreTotals[key],
        average: totalExercises ? scoreTotals[key] / totalExercises : 0,
        percentage: scoreGrandTotal ? (scoreTotals[key] / scoreGrandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const foundationHighlights = Object.entries(labels.foundationKeys)
      .map(([key, label]) => ({
        key,
        label,
        total: foundationTotals[key],
        average: totalExercises ? foundationTotals[key] / totalExercises : 0,
        percentage: foundationGrandTotal ? (foundationTotals[key] / foundationGrandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const implementHighlights = Array.from(implementTotals.entries())
      .map(([label, total]) => ({
        key: label,
        label,
        total,
        average: totalExercises ? total / totalExercises : 0,
        percentage: implementGrandTotal ? (total / implementGrandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalExercises,
      scoreGrandTotal,
      foundationGrandTotal,
      implementGrandTotal,
      highlights,
      foundationHighlights,
      implementHighlights
    };
  }

  function formatEmphasisHighlights(items, countMode) {
    if (!items || !items.length) return 'Sem dados';
    const nonZeroItems = items.filter((item) => item.total > 0);
    if (!nonZeroItems.length) return 'Sem dados';
    return nonZeroItems
      .map((item) => `${item.label} ${countMode ? `${item.total}x` : `${item.percentage.toFixed(0)}%`}`)
      .join(', ');
  }

  function renderEmphasisTable(title, items) {
    const rows = (items || [])
      .filter((item) => item.total > 0)
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.percentage.toFixed(1)}%</td>
        </tr>
      `)
      .join('');

    return `
      <section class="emphasis-table-card">
        <div class="emphasis-table-header">
          <strong>${escapeHtml(title)}</strong>
        </div>
        <div class="emphasis-table-wrap">
          <table class="emphasis-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Ênfase</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="2">Sem dados para esta sessão.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    const logoUrl = new URL(LOGO_PATH, window.location.href).href;
    const exercisesHtml = state.selectedItems
      .map((item, index) => {
        const imageUrl = item.exercise.image?.path ? new URL(item.exercise.image.path, window.location.href).href : '';
        return `
          <article class="pdf-exercise">
            ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(item.exercise.movement)}">` : '<div></div>'}
            <div class="pdf-exercise-copy">
              <span class="pdf-pill">Seleção ${index + 1}</span>
              <strong>${escapeHtml(item.exercise.movement)}</strong>
              <span class="pdf-muted">Implemento: ${escapeHtml(item.exercise.implement || 'Não informado')}</span>
              <span class="pdf-muted">${escapeHtml(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise))}</span>
              <span class="pdf-muted">${escapeHtml(item.exercise.description || 'Sem descrição cadastrada.')}</span>
            </div>
          </article>
        `;
      })
      .join('');

    return `
      <section class="pdf-sheet">
        <header class="pdf-header">
          <div class="pdf-title">
            <p>Programa de Condicionamento Físico para o Surfe</p>
            <h1>${escapeHtml(sessionName)}</h1>
            <p>Repositório de Exercícios sUrFPE</p>
          </div>
          <div class="pdf-logo-wrap">
            <img class="pdf-logo" src="${logoUrl}" alt="Logo sUrFPE Tech">
          </div>
        </header>
        <section class="pdf-meta">
          <article class="pdf-meta-card"><span>Modo</span><strong>${mode === 'intervalado' ? 'Intervalado' : 'ROT'}</strong></article>
          <article class="pdf-meta-card"><span>Exercícios</span><strong>${state.selectedItems.length}</strong></article>
          <article class="pdf-meta-card"><span>Séries</span><strong>${seriesCount}</strong></article>
          <article class="pdf-meta-card"><span>Tempo total</span><strong>${formatMinutes(totalMinutes)}</strong></article>
          <article class="pdf-meta-card"><span>Tempo por série</span><strong>${formatMinutes(roundMinutes)}</strong></article>
        </section>
        <section class="pdf-strip">${seriesCount} séries | ${state.selectedItems.length} exercícios por série | ${escapeHtml(getModeSummaryText(mode, workMinutes, restMinutes, repsPerExercise))} | Total ${formatMinutes(totalMinutes)}</section>
        <section class="pdf-emphasis-grid">
          ${buildPdfEmphasisTable('Foco corporal', emphasis.highlights)}
          ${buildPdfEmphasisTable('Fundamentos do surfe', emphasis.foundationHighlights)}
          ${buildPdfEmphasisTable('Implementos', emphasis.implementHighlights)}
        </section>
        <section class="pdf-exercises">${exercisesHtml}</section>
      </section>
    `;
  }

  function buildPdfEmphasisTable(title, items) {
    const rows = (items || [])
      .filter((item) => item.total > 0)
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.percentage.toFixed(1)}%</td>
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
              <th>Ênfase</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="2">Sem dados</td></tr>'}
          </tbody>
        </table>
      </article>
    `;
  }

  function downloadDataUrl(dataUrl, fileName) {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawCoverImage(ctx, image, x, y, width, height, radius) {
    ctx.save();
    roundRect(ctx, x, y, width, height, radius);
    ctx.clip();
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  function drawContainImage(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    let line = '';
    let currentY = y;
    for (let i = 0; i < words.length; i += 1) {
      const testLine = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = words[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, currentY);
  }

  function slugify(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'sessao-treinamento';
  }

  function formatDateUs(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function shorten(text, maxLength) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}...`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function rewriteAssetPathsForExport(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('img').forEach((image) => {
      image.src = new URL(image.getAttribute('src'), window.location.href).href;
    });
    return container.innerHTML;
  }

  function renderSessionPreview(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    if (state.selectedItems.length === 0) {
      elements.sessionPreview.innerHTML = '<div class="empty-state">A diagramacao da sessao aparecera aqui quando houver exercicios selecionados.</div>';
      return;
    }

    const title = sessionName || 'Sessao de treinamento';
    const cards = state.selectedItems
      .map((item, index) => `
        <article class="session-preview-card">
          ${item.exercise.image?.path ? `<img class="session-preview-image" src="${item.exercise.image.path}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="session-preview-image"></div>'}
          <div class="session-preview-copy">
            <span class="pill">Selecao ${index + 1}</span>
            <strong>${escapeHtml(item.exercise.movement)}</strong>
            <span>${mode === 'intervalado' ? `${formatMinutes(workMinutes)} de execucao` : `${repsPerExercise} reps neste exercicio`}</span>
            <span>${mode === 'intervalado' ? `${formatMinutes(restMinutes)} de recuperacao` : `Serie completa em ate ${formatMinutes(workMinutes)}`}</span>
          </div>
        </article>
      `)
      .join('');

    elements.sessionPreview.innerHTML = `
      <section class="program-sheet">
        <header class="program-sheet-header">
          <div>
            <p class="program-sheet-kicker">Programa de Condicionamento Fisico para o Surfe</p>
            <h2>${escapeHtml(title)}</h2>
            <p class="credit">Repositorio de Exercicios sUrFPE</p>
          </div>
          <div class="program-logo-wrap">
            <img class="program-logo" src="${LOGO_PATH}" alt="Logo sUrFPE Tech">
          </div>
          <div class="program-sheet-meta">
            <strong>${formatMinutes(totalMinutes)}</strong>
            <span>${state.selectedItems.length} exercicios</span>
            <span>${seriesCount} series | ${mode === 'intervalado' ? 'Intervalado' : 'ROT'}</span>
          </div>
        </header>
        <div class="program-strip">
          <strong>${seriesCount} serie${seriesCount === 1 ? '' : 's'}</strong>
          <span>|</span>
          <strong>${state.selectedItems.length} exercicios por serie</strong>
          <span>|</span>
          <strong>${formatMinutes(roundMinutes)} por serie</strong>
          <span>|</span>
          <strong>Total ${formatMinutes(totalMinutes)}</strong>
        </div>
        <div class="program-emphasis-line">
          <strong>Foco corporal</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.highlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Fundamentos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.foundationHighlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Implementos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.implementHighlights, true))}</span>
        </div>
        <div class="session-preview-grid">${cards}</div>
      </section>
    `;
  }

  function saveSession() {
    if (elements.saveSessionButton?.disabled) return;

    if (state.selectedItems.length === 0) {
      alert('Selecione pelo menos um exercicio para gravar a sessao.');
      return;
    }

    setSessionBusy(true);

    try {
      const mode = getSessionMode();
      const workMinutes = modeUsesWork(mode) ? getNumber(elements.workMinutes.value) : 0;
      const intensity4pis = getIntensity4pisValue();
      const restMinutes = modeUsesRest(mode) ? getNumber(elements.restMinutes.value) : 0;
      const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
      const repsPerExercise = modeUsesReps(mode) ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;

      if (modeUsesWork(mode) && workMinutes <= 0) {
        alert('Informe um tempo maior que zero para fechar a sessao.');
        return;
      }

      if (modeUsesReps(mode) && repsPerExercise <= 0) {
        alert(`Informe o numero de repeticoes por ${isMobilityMode(mode) ? 'movimento' : 'exercicio'} para o modo ${getModeLabel(mode)}.`);
        return;
      }

      const roundMinutes = mode === 'intervalado'
        ? state.selectedItems.length * (workMinutes + restMinutes)
        : workMinutes;
      const totalMinutes = roundMinutes * seriesCount;
      const fullExercises = state.selectedItems.map((item) => normalizeExerciseData(item.exercise));
      const emphasis = summarizeSessionEmphasis(fullExercises);

      const activityAt = new Date().toISOString();
      const session = {
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `session-${Date.now()}`,
        name: elements.sessionName.value.trim() || `Sessao ${new Date().toLocaleDateString('pt-BR')}`,
        createdAt: activityAt,
        updatedAt: activityAt,
        mode,
        workMinutes,
        intensity4pis,
        restMinutes,
        seriesCount,
        repsPerExercise,
        totalMinutes,
        emphasis,
        exercises: fullExercises.map((exercise, index) => ({
          order: index + 1,
          ...exercise
        }))
      };

      state.sessions.unshift(session);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.sessions));
      render();
      setSessionFeedback(`Sessao "${session.name}" gravada com sucesso.`);
    } catch (error) {
      console.error('Falha ao gravar sessao.', error);
      setSessionFeedback('Nao foi possivel gravar a sessao. Verifique o armazenamento do navegador e tente novamente.');
    } finally {
      setSessionBusy(false);
    }
  }

  function exportSessionAsPdf() {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    if (workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }

    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'intervalado' ? 0 : Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0));
    if (mode !== 'intervalado' && repsPerExercise <= 0) {
      alert(`Informe o numero de repeticoes por exercicio para exportar em modo ${mode === 'mobility_reps' ? 'MOBILITY REPs' : 'ROT'}.`);
      return;
    }

    const roundMinutes = mode === 'intervalado'
      ? state.selectedItems.length * (workMinutes + restMinutes)
      : workMinutes;
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const exportBaseName = buildPdfFileName(sessionName, new Date());

    const printWindow = window.open('', '_blank', 'width=1280,height=960');
    if (!printWindow) {
      alert('Nao foi possivel abrir a janela de impressao. Verifique se o navegador bloqueou pop-ups.');
      return;
    }

    const previewHtml = buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis);
    const styleHtml = `
      <style>
        body { font-family: Manrope, Arial, sans-serif; margin: 26px; color: #221b17; background: #f7f2e9; }
        .pdf-sheet { display: grid; gap: 16px; }
        .pdf-header { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 18px; align-items: start; padding: 20px; background: linear-gradient(135deg, #006d77, #0d8f9a); color: #fff; border-radius: 20px; }
        .pdf-title h1 { margin: 0 0 8px; font-size: 30px; }
        .pdf-title p { margin: 0; }
        .pdf-logo-wrap { display: flex; justify-content: flex-end; }
        .pdf-logo { width: 200px; max-height: 80px; object-fit: contain; }
        .pdf-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pdf-meta-card { padding: 12px; background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 14px; }
        .pdf-meta-card span { display: block; color: #695746; font-size: 12px; margin-bottom: 4px; }
        .pdf-meta-card strong { font-size: 22px; }
        .pdf-strip { padding: 12px 16px; background: #ffe44d; border-radius: 16px; font-weight: 800; text-align: center; }
        .pdf-emphasis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .pdf-emphasis-card { background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 16px; overflow: hidden; }
        .pdf-emphasis-card strong { display: block; padding: 12px 14px; background: #efe8dd; }
        .pdf-emphasis-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pdf-emphasis-card th, .pdf-emphasis-card td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #efe8dd; }
        .pdf-emphasis-card th { text-transform: uppercase; font-size: 11px; color: #695746; }
        .pdf-exercises { display: grid; gap: 10px; }
        .pdf-exercise { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: center; padding: 10px; background: #fffdf8; border: 1px solid #ddd4c8; border-radius: 16px; break-inside: avoid; }
        .pdf-exercise img { width: 120px; height: 82px; object-fit: cover; border-radius: 12px; background: #eee6db; }
        .pdf-exercise-copy { display: grid; gap: 4px; }
        .pdf-pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #efe8dd; color: #695746; font-size: 12px; }
        .pdf-muted { color: #695746; }
      </style>
    `;

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${exportBaseName}</title>${styleHtml}</head><body>${previewHtml}</body></html>`);
    printWindow.document.close();
    printWindow.document.title = exportBaseName;
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }

  async function exportSessionAsJpeg() {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'intervalado' ? 0 : Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0));
    if (workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }
    if (mode !== 'intervalado' && repsPerExercise <= 0) {
      alert(`Informe o numero de repeticoes por exercicio para exportar em modo ${mode === 'mobility_reps' ? 'MOBILITY REPs' : 'ROT'}.`);
      return;
    }

    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const roundMinutes = mode === 'intervalado'
      ? state.selectedItems.length * (workMinutes + restMinutes)
      : workMinutes;
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const width = 1600;
    const headerHeight = 230;
    const cardHeight = 150;
    const emphasisHeight = 82;
    const footerHeight = 50;
    const gap = 10;
    const height = headerHeight + emphasisHeight + (cardHeight + gap) * state.selectedItems.length + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f7f2e9';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#006d77');
    gradient.addColorStop(1, '#0d8f9a');
    ctx.fillStyle = gradient;
    roundRect(ctx, 60, 40, width - 120, 140, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Manrope, sans-serif';
    ctx.fillText('Programa de Condicionamento Fisico para o Surfe', 96, 82);
    ctx.font = '800 36px Sora, sans-serif';
    ctx.fillText(sessionName, 96, 128);
    ctx.font = '600 20px Manrope, sans-serif';
    ctx.fillText('Repositorio de Exercicios sUrFPE', 96, 160);

    try {
      const logo = await loadImage(LOGO_PATH);
      drawContainImage(ctx, logo, width - 340, 48, 220, 96);
    } catch (error) {
      console.warn('Nao foi possivel carregar o logo para exportacao.', error);
    }

    ctx.fillStyle = '#ffd84a';
    roundRect(ctx, 60, 196, width - 120, 54, 16);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '800 22px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${seriesCount} series | ${state.selectedItems.length} exercicios por serie | ${formatMinutes(roundMinutes)} por serie | Total ${formatMinutes(totalMinutes)}`,
      width / 2,
      230
    );
    ctx.textAlign = 'start';

    ctx.fillStyle = '#efe8dd';
    roundRect(ctx, 60, 264, width - 120, 54, 16);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '700 18px Manrope, sans-serif';
    wrapText(
      ctx,
      `Corporal: ${formatEmphasisHighlights(emphasis.highlights)} | Fundamentos: ${formatEmphasisHighlights(emphasis.foundationHighlights)} | Implementos: ${formatEmphasisHighlights(emphasis.implementHighlights, true)}`,
      84,
      298,
      width - 168,
      22
    );

    let top = 334;
    for (let index = 0; index < state.selectedItems.length; index += 1) {
      const item = state.selectedItems[index];
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.18)';
      ctx.lineWidth = 2;
      roundRect(ctx, 60, top, width - 120, cardHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9d0208';
      roundRect(ctx, 84, top + 16, 72, 34, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px Manrope, sans-serif';
      ctx.fillText(String(index + 1), 112, top + 39);

      if (item.exercise.image?.path) {
        try {
          const image = await loadImage(item.exercise.image.path);
          drawCoverImage(ctx, image, 178, top + 14, 140, 108, 12);
        } catch (error) {
          ctx.fillStyle = '#e7dfd2';
          roundRect(ctx, 178, top + 14, 140, 108, 12);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e7dfd2';
        roundRect(ctx, 178, top + 14, 140, 108, 12);
        ctx.fill();
      }

      ctx.fillStyle = '#221b17';
      ctx.font = '800 24px Sora, sans-serif';
      ctx.fillText(item.exercise.movement, 342, top + 40);
      ctx.font = '600 18px Manrope, sans-serif';
      ctx.fillStyle = '#695746';
      ctx.fillText(`Implemento: ${item.exercise.implement || 'Nao informado'}`, 342, top + 68);
      ctx.fillText(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise), 342, top + 94);
      wrapText(ctx, item.exercise.description || 'Sem descricao cadastrada.', 342, top + 120, 1160, 22);

      top += cardHeight + gap;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) {
      const fallbackUrl = canvas.toDataURL('image/jpeg', 0.95);
      downloadDataUrl(fallbackUrl, `${slugify(sessionName)}.jpeg`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(sessionName)}.jpeg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderSavedSessions() {
    if (!elements.savedSessionsList) return;
    elements.savedSessionsList.innerHTML = '';

    if (state.sessions.length === 0) {
      elements.savedSessionsList.innerHTML = '<div class="empty-state">Nenhuma sessao finalizada foi gravada ainda.</div>';
      return;
    }

    state.sessions.slice(0, 8).forEach((session) => {
      const item = document.createElement('article');
      item.className = 'saved-session';
      const exerciseCount = Array.isArray(session.exercises) ? session.exercises.length : 0;
      const derivedEmphasis = session.emphasis || summarizeSessionEmphasis(
        (session.exercises || []).map((exercise) => {
          const baseExercise = state.exercises.find((entry) => Number(entry.id) === Number(exercise.id));
          return {
            ...(baseExercise || {}),
            ...exercise,
            scores: exercise.scores || baseExercise?.scores || {},
            foundations: exercise.foundations || baseExercise?.foundations || {}
          };
        })
      );
      const emphasisText = [
        `Corporal: ${formatEmphasisHighlights(derivedEmphasis.highlights)}`,
        `Fundamentos: ${formatEmphasisHighlights(derivedEmphasis.foundationHighlights)}`,
        `Implementos: ${formatEmphasisHighlights(derivedEmphasis.implementHighlights, true)}`
      ].join(' | ');
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(session.name)}</strong>
          <p>${new Date(session.createdAt).toLocaleString('pt-BR')}</p>
          <p>${escapeHtml(emphasisText)}</p>
        </div>
        <div class="saved-session-meta">
          <span class="pill">${exerciseCount} exercicios</span>
          <span class="pill">${formatMinutes(session.totalMinutes || 0)}</span>
          <button class="ghost-button compact-button" type="button" data-action="open">Abrir sessao</button>
          <button class="ghost-button compact-button" type="button" data-action="delete">Excluir sessao</button>
        </div>
      `;
      item.querySelector('[data-action="open"]').addEventListener('click', () => loadSavedSession(session.id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSavedSession(session.id));
      elements.savedSessionsList.appendChild(item);
    });
  }

  function deleteSavedSession(sessionId) {
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) return;

    if (!window.confirm(`Excluir a sessao "${session.name}"?`)) {
      return;
    }

    state.sessions = state.sessions.filter((item) => item.id !== sessionId);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.sessions));
    render();
  }

  function syncModeFields() {
    const mode = getSessionMode();
    elements.repsField.hidden = mode !== 'rot';
    elements.restField.hidden = mode !== 'intervalado';
    elements.workLabel.textContent = mode === 'intervalado' ? 'Tempo por exercicio' : 'Tempo maximo por serie';
    elements.modeHint.textContent = mode === 'intervalado'
      ? 'No modo intervalado, o tempo total considera estimulo + recuperacao para cada exercicio.'
      : 'No modo ROT, voce define as repeticoes por exercicio e o tempo maximo para concluir a serie inteira de exercicios selecionados.';
  }

  function getExerciseTimingText(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise) {
    return mode === 'intervalado'
      ? `${formatMinutes(workMinutes)} de trabalho + ${formatMinutes(restMinutes)} de recuperacao = ${formatMinutes(blockMinutes)}`
      : `${repsPerExercise} reps neste exercicio | serie completa em ate ${formatMinutes(workMinutes)}`;
  }

  function getModeSummaryText(mode, workMinutes, restMinutes, repsPerExercise) {
    return mode === 'intervalado'
      ? `${formatMinutes(workMinutes)} de estimulo + ${formatMinutes(restMinutes)} de recuperacao`
      : `${repsPerExercise} reps por exercicio | ${formatMinutes(workMinutes)} por serie`;
  }

  function getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise) {
    return mode === 'intervalado'
      ? `Execucao: ${formatMinutes(workMinutes)} | Recuperacao: ${formatMinutes(restMinutes)} | Series: ${seriesCount}`
      : `ROT: ${repsPerExercise} reps por exercicio | Serie em ate ${formatMinutes(workMinutes)} | Series: ${seriesCount}`;
  }

  function exportSessionAsPdf() {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    if (workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }

    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    if (mode === 'rot' && repsPerExercise <= 0) {
      alert('Informe o numero de repeticoes por exercicio para exportar em modo ROT.');
      return;
    }

    const roundMinutes = mode === 'intervalado'
      ? state.selectedItems.length * (workMinutes + restMinutes)
      : workMinutes;
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const exportBaseName = buildPdfFileName(sessionName, new Date());

    const previewHtml = buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis);
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
        .pdf-side { display: grid; gap: 10px; }
        .pdf-emphasis-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pdf-emphasis-card { background: rgba(255,255,255,0.92); border: 1px solid #ddd2c4; border-radius: 18px; overflow: hidden; }
        .pdf-emphasis-card strong { display: block; padding: 10px 12px; background: #efe7db; font-size: 14px; }
        .pdf-emphasis-card table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .pdf-emphasis-card th, .pdf-emphasis-card td { padding: 7px 10px; text-align: left; border-bottom: 1px solid #efe7db; }
        .pdf-emphasis-card th { color: #675341; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .pdf-summary-box { display: grid; gap: 8px; padding: 12px 14px; border-radius: 18px; background: rgba(255,255,255,0.92); border: 1px solid #ddd2c4; }
        .pdf-summary-box strong { font-family: Sora, Arial, sans-serif; font-size: 16px; }
      </style>
    `;
    printHtmlAsPdf(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${exportBaseName}</title>${styleHtml}</head><body>${previewHtml}</body></html>`);
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
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
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

  function buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    const logoUrl = normalizeAssetUrl(LOGO_PATH);
    const exercisesHtml = state.selectedItems
      .map((item, index) => {
        const imageUrl = item.exercise.image?.path ? normalizeAssetUrl(item.exercise.image.path) : '';
        const exerciseSummary = mode === 'intervalado'
          ? `${formatMinutes(workMinutes)} de execucao + ${formatMinutes(restMinutes)} de recuperacao`
          : `${repsPerExercise} reps neste exercicio`;
        const description = shorten(item.exercise.description || 'Sem descricao cadastrada.', 120);

        return `
          <article class="pdf-exercise">
            ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="pdf-image-placeholder"></div>'}
            <div class="pdf-exercise-copy">
              <span class="pdf-pill">Selecao ${index + 1}</span>
              <strong class="pdf-exercise-name">${escapeHtml(item.exercise.movement)}</strong>
              <span class="pdf-muted">${escapeHtml(exerciseSummary)}</span>
              <span class="pdf-muted">${escapeHtml(mode === 'intervalado' ? `Implemento: ${item.exercise.implement || 'Nao informado'}` : `Serie completa em ate ${formatMinutes(workMinutes)}`)}</span>
              <span class="pdf-muted">${escapeHtml(description)}</span>
            </div>
          </article>
        `;
      })
      .join('');

    return `
      <section class="pdf-sheet">
        <header class="pdf-header">
          <div class="pdf-title">
            <p class="pdf-kicker">Programa de Condicionamento Fisico para o Surfe</p>
            <h1>${escapeHtml(sessionName)}</h1>
            <p class="pdf-credit">Repositorio de Exercicios sUrFPE</p>
          </div>
          <div class="pdf-logo-wrap">
            <img class="pdf-logo" src="${logoUrl}" alt="Logo sUrFPE Tech">
          </div>
          <div class="pdf-meta">
            <article class="pdf-meta-card"><span>Modo</span><strong>${mode === 'intervalado' ? 'Intervalado' : 'ROT'}</strong></article>
            <article class="pdf-meta-card"><span>Tempo total</span><strong>${formatMinutes(totalMinutes)}</strong></article>
            <article class="pdf-meta-card"><span>Exercicios e series</span><strong>${state.selectedItems.length} x ${seriesCount}</strong></article>
          </div>
        </header>
        <section class="pdf-callout">
          <span>Orientacao do programa</span>
          <strong>${escapeHtml(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise))}</strong>
        </section>
        <section class="pdf-body">
          <section class="pdf-exercises">${exercisesHtml}</section>
          <aside class="pdf-side">
            <section class="pdf-emphasis-grid">
              ${buildPdfEmphasisTable('Foco corporal', emphasis.highlights)}
              ${buildPdfEmphasisTable('Fundamentos do surfe', emphasis.foundationHighlights)}
              ${buildPdfEmphasisTable('Implementos', emphasis.implementHighlights)}
            </section>
          </aside>
        </section>
      </section>
    `;
  }

  function buildPdfEmphasisTable(title, items) {
    const rows = (items || [])
      .filter((item) => Number(item.total || 0) > 0)
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.percentage.toFixed(1)}%</td>
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
          <tbody>
            ${rows || '<tr><td colspan="2">Sem dados</td></tr>'}
          </tbody>
        </table>
      </article>
    `;
  }

  function loadImage(src) {
    const resolvedSrc = normalizeAssetUrl(src);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Falha ao carregar imagem: ${resolvedSrc}`));
      image.src = resolvedSrc;
    });
  }

  function normalizeAssetUrl(src) {
    if (!src) return '';
    try {
      return new URL(String(src).replaceAll('\\', '/'), window.location.href).href;
    } catch (error) {
      return String(src).replaceAll('\\', '/');
    }
  }

  function getSessionExpression(mode, exerciseCount, seriesCount, workMinutes, restMinutes, repsPerExercise) {
    const safeExerciseCount = Math.max(0, Number(exerciseCount || 0));
    const safeSeriesCount = Math.max(1, Number(seriesCount || 1));
    if (mode === 'intervalado') {
      return `${safeSeriesCount} series x [${safeExerciseCount} exercicios x (${formatMinutes(workMinutes)} / ${formatMinutes(restMinutes)})]`;
    }
    return `${safeSeriesCount} Series x (${safeExerciseCount} exercicios com ${Math.max(1, Number(repsPerExercise || 0))} reps / ${formatMinutes(workMinutes)})`;
  }

  function buildPdfFileName(sessionName, date) {
    return `${formatDateCompact(date)} - ${sanitizeFileName(sessionName)}`;
  }

  function formatDateCompact(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function sanitizeFileName(value) {
    return String(value || 'Sessao de treinamento')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Sessao de treinamento';
  }

  getModeSummaryText = function (mode, workMinutes, restMinutes, repsPerExercise) {
    const exerciseCount = state.selectedItems.length;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    return getSessionExpression(mode, exerciseCount, seriesCount, workMinutes, restMinutes, repsPerExercise);
  };

  getExportLineText = function (mode, workMinutes, restMinutes, seriesCount, repsPerExercise) {
    return getSessionExpression(mode, state.selectedItems.length, seriesCount, workMinutes, restMinutes, repsPerExercise);
  };

  const baseRender = render;
  render = function () {
    baseRender();
    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;

    elements.sessionHeadline.textContent = state.selectedItems.length
      ? getSessionExpression(mode, state.selectedItems.length, seriesCount, workMinutes, restMinutes, repsPerExercise)
      : 'Nenhum exercicio selecionado';
    elements.sessionRatio.textContent = mode === 'intervalado'
      ? 'Treino intervalado configurado por tempo de estimulo e recuperacao.'
      : 'Treino ROT configurado por repeticoes por exercicio e tempo maximo por serie.';
  };

  renderSavedSessions = function () {
    if (!elements.savedSessionsList) return;
    elements.savedSessionsList.innerHTML = '';

    if (state.sessions.length === 0) {
      elements.savedSessionsList.innerHTML = '<div class="empty-state">Nenhuma sessao finalizada foi gravada ainda.</div>';
      return;
    }

    state.sessions.slice(0, 8).forEach((session) => {
      const item = document.createElement('article');
      item.className = 'saved-session';
      const exerciseCount = Array.isArray(session.exercises) ? session.exercises.length : 0;
      const derivedEmphasis = session.emphasis || summarizeSessionEmphasis(
        (session.exercises || []).map((exercise) => {
          const baseExercise = state.exercises.find((entry) => Number(entry.id) === Number(exercise.id));
          return {
            ...(baseExercise || {}),
            ...exercise,
            scores: exercise.scores || baseExercise?.scores || {},
            foundations: exercise.foundations || baseExercise?.foundations || {}
          };
        })
      );

      item.innerHTML = `
        <div class="saved-session-main">
          <div class="saved-session-top">
            <div class="saved-session-head">
              <strong>${escapeHtml(session.name)}</strong>
              <p>${new Date(session.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            <div class="saved-session-meta">
              <span class="pill">${exerciseCount} exercicios</span>
              <span class="pill">${formatMinutes(session.totalMinutes || 0)}</span>
              <button class="ghost-button compact-button" type="button" data-action="open">Abrir sessao</button>
              <button class="icon-button subtle-danger" type="button" data-action="delete" aria-label="Excluir sessao" title="Excluir sessao">🗑</button>
            </div>
          </div>
          <div class="saved-session-grid">
            <div class="saved-session-block is-program">
              <span class="saved-session-label">Programacao</span>
              <p>${escapeHtml(getSessionExpression(session.mode || 'intervalado', exerciseCount, session.seriesCount || 1, session.workMinutes || 0, session.restMinutes || 0, session.repsPerExercise || 0))}</p>
            </div>
            <div class="saved-session-block">
              <span class="saved-session-label">Foco corporal</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.highlights))}</p>
            </div>
            <div class="saved-session-block">
              <span class="saved-session-label">Fundamentos</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.foundationHighlights))}</p>
            </div>
            <div class="saved-session-block">
              <span class="saved-session-label">Implementos</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.implementHighlights, true))}</p>
            </div>
          </div>
        </div>
      `;
      item.querySelector('[data-action="open"]').addEventListener('click', () => loadSavedSession(session.id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSavedSession(session.id));
      elements.savedSessionsList.appendChild(item);
    });
  };

  syncModeFields = function () {
    const mode = getSessionMode();
    const isIntervalado = mode === 'intervalado';
    const isRot = mode === 'rot';

    elements.repsField.hidden = !isRot;
    elements.restField.hidden = !isIntervalado;
    elements.repsField.style.display = isRot ? '' : 'none';
    elements.restField.style.display = isIntervalado ? '' : 'none';
    elements.repsPerExercise.disabled = !isRot;
    elements.restMinutes.disabled = !isIntervalado;
    elements.workLabel.textContent = isIntervalado ? 'Tempo por exercicio' : 'Tempo maximo por serie';
    elements.modeHint.textContent = isIntervalado
      ? 'No modo intervalado, o treino e configurado apenas por tempo de estimulo e recuperacao.'
      : 'No modo ROT, o treino e configurado por repeticoes por exercicio e tempo maximo da serie inteira.';
  };

  function refreshEnhancedSessionSummary() {
    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;

    elements.sessionHeadline.textContent = state.selectedItems.length
      ? getSessionExpression(mode, state.selectedItems.length, seriesCount, workMinutes, restMinutes, repsPerExercise)
      : 'Nenhum exercicio selecionado';
    elements.sessionRatio.textContent = mode === 'intervalado'
      ? 'Treino intervalado configurado por tempo de estimulo e recuperacao.'
      : 'Treino ROT configurado por repeticoes por exercicio e tempo maximo por serie.';
  }

  function bindEnhancedUi() {
    [elements.workMinutes, elements.restMinutes, elements.seriesCount, elements.repsPerExercise, elements.sessionMode].forEach((element) => {
      if (!element) return;
      element.addEventListener('input', () => queueMicrotask(refreshEnhancedSessionSummary));
      element.addEventListener('change', () => queueMicrotask(() => {
        syncModeFields();
        refreshEnhancedSessionSummary();
      }));
    });

    elements.exportPdfButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportSessionAsPdf();
    }, true);

    elements.exportJpegButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await exportSessionAsJpeg();
    }, true);
  }

  exportSessionAsJpeg = async function () {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = getNumber(elements.workMinutes.value);
    const restMinutes = mode === 'intervalado' ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = mode === 'rot' ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;

    if (workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }

    if (mode === 'rot' && repsPerExercise <= 0) {
      alert('Informe o numero de repeticoes por exercicio para exportar em modo ROT.');
      return;
    }

    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const roundMinutes = mode === 'intervalado'
      ? state.selectedItems.length * (workMinutes + restMinutes)
      : workMinutes;
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const width = 1400;
    const headerHeight = 210;
    const stripHeight = 72;
    const emphasisHeight = 100;
    const cardHeight = 142;
    const gap = 12;
    const paddingBottom = 48;
    const height = headerHeight + stripHeight + emphasisHeight + (cardHeight + gap) * state.selectedItems.length + paddingBottom;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('Nao foi possivel gerar a imagem da sessao neste navegador.');
      return;
    }

    ctx.fillStyle = '#f7f2e9';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#8d0000');
    gradient.addColorStop(0.55, '#b50000');
    gradient.addColorStop(1, '#0c4b7b');
    ctx.fillStyle = gradient;
    roundRect(ctx, 48, 34, width - 96, 148, 28);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px Manrope, sans-serif';
    ctx.fillText('Programa de Condicionamento Fisico para o Surfe', 82, 76);
    ctx.font = '800 34px Sora, sans-serif';
    ctx.fillText(sessionName, 82, 118);
    ctx.font = '600 18px Manrope, sans-serif';
    ctx.fillText('Repositorio de Exercicios sUrFPE', 82, 150);

    try {
      const logo = await loadImage(LOGO_PATH);
      drawContainImage(ctx, logo, width - 300, 54, 170, 82);
    } catch (error) {
      console.warn('Nao foi possivel carregar o logo para exportacao JPEG.', error);
    }

    ctx.fillStyle = '#ffd84a';
    roundRect(ctx, 48, 198, width - 96, 58, 18);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '800 24px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise), width / 2, 234);
    ctx.textAlign = 'start';

    const emphasisBoxes = [
      { title: 'Foco corporal', text: formatEmphasisHighlights(emphasis.highlights) },
      { title: 'Fundamentos', text: formatEmphasisHighlights(emphasis.foundationHighlights) },
      { title: 'Implementos', text: formatEmphasisHighlights(emphasis.implementHighlights, true) }
    ];

    const boxWidth = (width - 96 - 24) / 3;
    emphasisBoxes.forEach((box, index) => {
      const left = 48 + index * (boxWidth + 12);
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.16)';
      ctx.lineWidth = 2;
      roundRect(ctx, left, 274, boxWidth, 84, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#695746';
      ctx.font = '800 14px Manrope, sans-serif';
      ctx.fillText(box.title, left + 14, 298);
      ctx.fillStyle = '#221b17';
      ctx.font = '600 16px Manrope, sans-serif';
      wrapText(ctx, box.text || 'Sem dados', left + 14, 324, boxWidth - 28, 20);
    });

    let top = 376;
    for (let index = 0; index < state.selectedItems.length; index += 1) {
      const item = state.selectedItems[index];
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.16)';
      ctx.lineWidth = 2;
      roundRect(ctx, 48, top, width - 96, cardHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9d0208';
      roundRect(ctx, 66, top + 16, 74, 34, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px Manrope, sans-serif';
      ctx.fillText(String(index + 1), 96, top + 39);

      const imageX = 158;
      const imageY = top + 14;
      const imageWidth = 146;
      const imageHeight = 110;

      if (item.exercise.image?.path) {
        try {
          const image = await loadImage(item.exercise.image.path);
          drawCoverImage(ctx, image, imageX, imageY, imageWidth, imageHeight, 12);
        } catch (error) {
          ctx.fillStyle = '#e7dfd2';
          roundRect(ctx, imageX, imageY, imageWidth, imageHeight, 12);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e7dfd2';
        roundRect(ctx, imageX, imageY, imageWidth, imageHeight, 12);
        ctx.fill();
      }

      const textX = 326;
      ctx.fillStyle = '#221b17';
      ctx.font = '800 26px Sora, sans-serif';
      wrapText(ctx, item.exercise.movement, textX, top + 40, width - textX - 80, 28);
      ctx.font = '600 17px Manrope, sans-serif';
      ctx.fillStyle = '#695746';
      ctx.fillText(`Implemento: ${item.exercise.implement || 'Nao informado'}`, textX, top + 72);
      ctx.fillText(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise), textX, top + 98);
      wrapText(ctx, item.exercise.description || 'Sem descricao cadastrada.', textX, top + 124, width - textX - 80, 20);

      top += cardHeight + gap;
    }

    await exportCanvasAsJpeg(canvas, slugify(sessionName));
  };

  async function exportCanvasAsJpeg(canvas, fileBaseName) {
    const blob = await new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob(resolve, 'image/jpeg', 0.96);
      } else {
        resolve(null);
      }
    });

    if (blob) {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${fileBaseName}.jpeg`);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
    triggerDownload(dataUrl, `${fileBaseName}.jpeg`);
  }

  function triggerDownload(url, fileName) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function getIntensity4pisValue(rawValue) {
    const value = rawValue ?? elements.intensity4pis?.value ?? '0';
    return String(value || '0').trim() || '0';
  }

  function format4PisLabel(value) {
    const normalized = getIntensity4pisValue(value);
    return normalized.toLowerCase() === 'all out' ? 'All Out' : `${normalized} 4PIS`;
  }

  function formatRatioValue(value) {
    const rounded = Math.round(Number(value || 0) * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(2).replace('.', ',').replace(/0+$/, '').replace(/,$/, '');
  }

  function formatRerLabel(workMinutes, restMinutes) {
    const safeWork = Number(workMinutes || 0);
    if (safeWork <= 0) return '1 : 0';
    return `1 : ${formatRatioValue(Number(restMinutes || 0) / safeWork)}`;
  }

  function getRoundMinutes(mode, workMinutes, restMinutes, exerciseCount) {
    if (mode === 'intervalado') {
      return Math.max(0, Number(exerciseCount || 0)) * (Number(workMinutes || 0) + Number(restMinutes || 0));
    }
    if (mode === 'mobility_time') {
      return Math.max(0, Number(exerciseCount || 0)) * Number(workMinutes || 0);
    }
    if (mode === 'mobility_reps') {
      return 0;
    }
    return Number(workMinutes || 0);
  }

  function getModeLabel(mode) {
    if (mode === 'rot') return 'ROT (Reps On Time)';
    if (mode === 'mobility_reps') return 'MOBILITY REPs (n Reps por movimento)';
    if (mode === 'mobility_time') return 'MOBILITY TIME (n s por movimento)';
    return 'Intervalado';
  }

  getSessionExpression = function (mode, exerciseCount, seriesCount, workMinutes, restMinutes, repsPerExercise, intensity4pis) {
    const safeExerciseCount = Math.max(0, Number(exerciseCount || 0));
    const safeSeriesCount = Math.max(1, Number(seriesCount || 1));
    if (mode === 'intervalado') {
      return `${getModeLabel(mode)} | ${safeSeriesCount} series x [${safeExerciseCount} exercicios x (${formatMinutes(workMinutes)} - ${format4PisLabel(intensity4pis)} / ${formatMinutes(restMinutes)})]`;
    }
    if (mode === 'mobility_reps') {
      return `${getModeLabel(mode)} | ${safeSeriesCount} series x (${safeExerciseCount} movimentos com ${Math.max(1, Number(repsPerExercise || 0))} reps - ${format4PisLabel(intensity4pis)})`;
    }
    if (mode === 'mobility_time') {
      return `${getModeLabel(mode)} | ${safeSeriesCount} series x (${safeExerciseCount} movimentos com ${formatMinutes(workMinutes)} - ${format4PisLabel(intensity4pis)})`;
    }
    return `${getModeLabel(mode)} | ${safeSeriesCount} series x (${safeExerciseCount} exercicios com ${Math.max(1, Number(repsPerExercise || 0))} reps - ${format4PisLabel(intensity4pis)} / ${formatMinutes(workMinutes)})`;
  };

  getModeSummaryText = function (mode, workMinutes, restMinutes, repsPerExercise) {
    const exerciseCount = state.selectedItems.length;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    return getSessionExpression(
      mode,
      exerciseCount,
      seriesCount,
      workMinutes,
      restMinutes,
      repsPerExercise,
      getIntensity4pisValue()
    );
  };

  getExportLineText = function (mode, workMinutes, restMinutes, seriesCount, repsPerExercise, intensity4pis) {
    return getSessionExpression(
      mode,
      state.selectedItems.length,
      seriesCount,
      workMinutes,
      restMinutes,
      repsPerExercise,
      intensity4pis ?? getIntensity4pisValue()
    );
  };

  getExerciseTimingText = function (mode, workMinutes, restMinutes, blockMinutes, repsPerExercise) {
    if (mode === 'intervalado') {
      return `${formatMinutes(workMinutes)} de estimulo | ${format4PisLabel()} | ${formatMinutes(restMinutes)} de recuperacao | RER ${formatRerLabel(workMinutes, restMinutes)}`;
    }
    if (mode === 'mobility_reps') {
      return `${repsPerExercise} reps por movimento | ${format4PisLabel()}`;
    }
    if (mode === 'mobility_time') {
      return `${formatMinutes(workMinutes)} por movimento | ${format4PisLabel()}`;
    }
    return `${repsPerExercise} reps por exercicio | ${format4PisLabel()} | serie completa em ate ${formatMinutes(workMinutes)}`;
  };

  syncModeFields = function () {
    const mode = getSessionMode();
    const isIntervalado = mode === 'intervalado';
    const isRot = mode === 'rot';
    const isMobilityReps = mode === 'mobility_reps';
    const isMobilityTime = mode === 'mobility_time';
    const showDurationGroup = isIntervalado || isRot || isMobilityTime;
    const showRestField = isIntervalado;
    const showRepsField = isRot || isMobilityReps;

    elements.sessionForm?.setAttribute('data-mode', mode);

    elements.intervalDurationGroup.hidden = !showDurationGroup;
    elements.intervalDurationGroup.style.display = showDurationGroup ? 'grid' : 'none';
    elements.workField.hidden = !showDurationGroup;
    elements.workField.style.display = showDurationGroup ? 'grid' : 'none';
    elements.workMinutes.disabled = !showDurationGroup;
    elements.workMinutesPart.disabled = !showDurationGroup;
    elements.workSecondsPart.disabled = !showDurationGroup;

    elements.restField.hidden = !showRestField;
    elements.restField.style.display = showRestField ? 'grid' : 'none';
    elements.restMinutes.disabled = !showRestField;
    elements.restMinutesPart.disabled = !showRestField;
    elements.restSecondsPart.disabled = !showRestField;

    elements.repsField.hidden = !showRepsField;
    elements.repsField.style.display = showRepsField ? 'grid' : 'none';
    elements.repsPerExercise.disabled = !showRepsField;

    elements.intensityField.hidden = false;
    elements.intensityField.style.display = 'grid';
    elements.intensity4pis.disabled = false;

    if (showDurationGroup && !String(elements.workMinutes.value || '').trim()) {
      elements.workMinutes.value = '2';
    }
    if (showRestField && !String(elements.restMinutes.value || '').trim()) {
      elements.restMinutes.value = '2';
    }
    if (showRepsField && !String(elements.repsPerExercise.value || '').trim()) {
      elements.repsPerExercise.value = '5';
    }
    if (!String(elements.intensity4pis.value || '').trim()) {
      elements.intensity4pis.value = '3';
    }

    const repsLabel = elements.repsField?.querySelector('span');
    if (repsLabel) {
      repsLabel.textContent = isMobilityReps ? 'Repetições por movimento' : 'Repetições por exercício';
    }

    if (elements.workClusterLabel) {
      elements.workClusterLabel.textContent = isIntervalado
        ? 'Estímulo'
        : isMobilityTime
          ? 'Tempo por movimento'
          : 'Tempo máximo por série';
    }
    if (elements.restClusterLabel) {
      elements.restClusterLabel.textContent = 'Recuperação';
    }

    if (elements.durationGroupLabel) {
      elements.durationGroupLabel.textContent = isIntervalado
        ? 'Estímulo / Recuperação'
        : isMobilityTime
          ? 'Tempo por movimento'
          : 'Tempo máximo por série';
    }

    elements.modeHint.textContent = isIntervalado
      ? 'No modo intervalado, o treino é configurado por estímulo, recuperação e escala 4PIS.'
      : isMobilityTime
        ? 'No modo MOBILITY TIME, o treino é configurado por tempo por movimento, escala 4PIS e número de séries.'
        : isMobilityReps
          ? 'No modo MOBILITY REPs, o treino é configurado por repetições por movimento, escala 4PIS e número de séries, sem variável de tempo.'
          : 'No modo ROT, o treino é configurado por repetições por exercício, escala 4PIS e tempo máximo da série.';

    syncAllDurationInputsFromModel();
  };

  renderSelectedList = function (mode, workMinutes, restMinutes, blockMinutes, repsPerExercise) {
    elements.selectedList.innerHTML = '';

    if (state.selectedItems.length === 0) {
      elements.selectedList.innerHTML = '<div class="empty-state">Adicione exercicios a sessao para montar a prescricao.</div>';
      return;
    }

    state.selectedItems.forEach((item, index) => {
      const row = document.createElement('article');
      row.className = 'selected-item';
      row.innerHTML = `
        ${item.exercise.image?.path ? `<img class="selected-thumb" src="${item.exercise.image.path}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="selected-thumb"></div>'}
        <div class="selected-main">
          <div class="selected-topline">
            <span class="pill">#${index + 1}</span>
            <span class="pill">${escapeHtml(item.exercise.implement || 'Sem implemento')}</span>
          </div>
          <strong>${escapeHtml(item.exercise.movement)}</strong>
          <span class="selected-time">${getExerciseTimingText(mode, workMinutes, restMinutes, blockMinutes, repsPerExercise)}</span>
        </div>
        <div class="selected-actions">
          <button class="ghost-button compact-button" type="button" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="ghost-button compact-button" type="button" ${index === state.selectedItems.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ghost-button compact-button" type="button">Remover</button>
        </div>
      `;

      const [moveUpButton, moveDownButton, removeButton] = row.querySelectorAll('button');
      moveUpButton.addEventListener('click', () => moveItem(index, -1));
      moveDownButton.addEventListener('click', () => moveItem(index, 1));
      removeButton.addEventListener('click', () => removeItem(index));

      elements.selectedList.appendChild(row);
    });
  };

  renderSessionPreview = function (mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    if (state.selectedItems.length === 0) {
      elements.sessionPreview.innerHTML = '<div class="empty-state">A diagramacao da sessao aparecera aqui quando houver exercicios selecionados.</div>';
      return;
    }

    const title = sessionName || 'Sessao de treinamento';
    const intensity4pis = getIntensity4pisValue();
    const cards = state.selectedItems
      .map((item, index) => `
        <article class="session-preview-card">
          ${item.exercise.image?.path ? `<img class="session-preview-image" src="${item.exercise.image.path}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="session-preview-image"></div>'}
          <div class="session-preview-copy">
            <span class="pill">Selecao ${index + 1}</span>
            <strong>${escapeHtml(item.exercise.movement)}</strong>
            <span>${getPreviewPrimaryLine(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis)}</span>
            <span>${getPreviewSecondaryLine(mode, workMinutes, restMinutes)}</span>
            <span>${escapeHtml(shorten(item.exercise.description || 'Sem descricao cadastrada.', 120))}</span>
          </div>
        </article>
      `)
      .join('');

    elements.sessionPreview.innerHTML = `
      <section class="program-sheet">
        <header class="program-sheet-header">
          <div>
            <p class="program-sheet-kicker">Programa de Condicionamento Fisico para o Surfe</p>
            <h2>${escapeHtml(title)}</h2>
            <p class="credit">Repositorio de Exercicios sUrFPE</p>
          </div>
          <div class="program-logo-wrap">
            <img class="program-logo" src="${LOGO_PATH}" alt="Logo sUrFPE Tech">
          </div>
          <div class="program-sheet-meta">
            <strong>${formatSessionTotal(mode, totalMinutes)}</strong>
            <span>${state.selectedItems.length} ${isMobilityMode(mode) ? 'movimentos' : 'exercicios'}</span>
            <span>${seriesCount} series | ${getModeLabel(mode)}</span>
          </div>
        </header>
        <div class="program-strip">
          <strong>${seriesCount} serie${seriesCount === 1 ? '' : 's'}</strong>
          <span>|</span>
          <strong>${state.selectedItems.length} ${isMobilityMode(mode) ? 'movimentos' : 'exercicios'} por serie</strong>
          <span>|</span>
          <strong>${mode === 'mobility_reps' ? 'Tempo nao aplicavel' : `${formatMinutes(roundMinutes)} por serie`}</strong>
          <span>|</span>
          <strong>Total ${formatSessionTotal(mode, totalMinutes)}</strong>
        </div>
        ${mode === 'intervalado' ? `
          <div class="program-emphasis-line">
            <strong>Intensidade e RER</strong>
            <span>${escapeHtml(`${format4PisLabel(intensity4pis)} | RER ${formatRerLabel(workMinutes, restMinutes)}`)}</span>
          </div>
        ` : `
          <div class="program-emphasis-line">
            <strong>${escapeHtml(mode === 'mobility_reps' ? 'Intensidade e Mobilidade' : 'Intensidade')}</strong>
            <span>${escapeHtml(format4PisLabel(intensity4pis))}</span>
          </div>
        `}
        <div class="program-emphasis-line">
          <strong>Foco corporal</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.highlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Fundamentos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.foundationHighlights))}</span>
        </div>
        <div class="program-emphasis-line">
          <strong>Implementos</strong>
          <span>${escapeHtml(formatEmphasisHighlights(emphasis.implementHighlights, true))}</span>
        </div>
        <div class="session-preview-grid">${cards}</div>
      </section>
    `;
  };

  const previousEnhancedRender = render;
  render = function () {
    previousEnhancedRender();
    refreshEnhancedSessionSummary();
  };

  function refreshEnhancedSessionSummary() {
    const mode = getSessionMode();
    const workMinutes = modeUsesWork(mode) ? getNumber(elements.workMinutes.value) : 0;
    const restMinutes = modeUsesRest(mode) ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = modeUsesReps(mode) ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    const intensity4pis = getIntensity4pisValue();

    elements.sessionHeadline.textContent = state.selectedItems.length
      ? getSessionExpression(mode, state.selectedItems.length, seriesCount, workMinutes, restMinutes, repsPerExercise, intensity4pis)
      : 'Nenhum exercicio selecionado';
    elements.sessionRatio.textContent = getSummaryRatioText(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis);
  }

  function getSessionActivityTimestamp(session) {
    return Number(new Date(session?.updatedAt || session?.createdAt || 0).getTime()) || 0;
  }

  renderSavedSessions = function () {
    if (!elements.savedSessionsList) return;
    elements.savedSessionsList.innerHTML = '';

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSessions = [...state.sessions]
      .filter((session) => getSessionActivityTimestamp(session) >= sevenDaysAgo)
      .sort((a, b) => getSessionActivityTimestamp(b) - getSessionActivityTimestamp(a))
      .slice(0, 8);

    if (recentSessions.length === 0) {
      elements.savedSessionsList.innerHTML = '<div class="empty-state">Nenhum treino criado ou atualizado nos ultimos 7 dias. A listagem completa continua na aba Treinos Criados.</div>';
      return;
    }

    recentSessions.forEach((session) => {
      const item = document.createElement('article');
      item.className = 'saved-session';
      const exerciseCount = Array.isArray(session.exercises) ? session.exercises.length : 0;
      const derivedEmphasis = session.emphasis || summarizeSessionEmphasis(
        (session.exercises || []).map((exercise) => {
          const baseExercise = state.exercises.find((entry) => Number(entry.id) === Number(exercise.id));
          return {
            ...(baseExercise || {}),
            ...exercise,
            scores: exercise.scores || baseExercise?.scores || {},
            foundations: exercise.foundations || baseExercise?.foundations || {}
          };
        })
      );

      item.innerHTML = `
        <div class="saved-session-main">
          <div class="saved-session-top">
            <div class="saved-session-head">
              <strong>${escapeHtml(session.name)}</strong>
              <p>${new Date(session.updatedAt || session.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            <div class="saved-session-meta">
              <span class="pill">${exerciseCount} exercicios</span>
              <span class="pill">${formatMinutes(session.totalMinutes || 0)}</span>
              <button class="ghost-button compact-button" type="button" data-action="open">Abrir sessao</button>
              <button class="icon-button subtle-danger" type="button" data-action="delete" aria-label="Excluir sessao" title="Excluir sessao">🗑</button>
            </div>
          </div>
          <div class="saved-session-grid">
            <div class="saved-session-block is-program">
              <span class="saved-session-label">Programacao</span>
              <p>${escapeHtml(getSessionExpression(session.mode || 'intervalado', exerciseCount, session.seriesCount || 1, session.workMinutes || 0, session.restMinutes || 0, session.repsPerExercise || 0, session.intensity4pis || '0'))}</p>
            </div>
            ${session.mode === 'intervalado' ? `
              <div class="saved-session-block">
                <span class="saved-session-label">RER e intensidade</span>
                <p>${escapeHtml(`RER ${formatRerLabel(session.workMinutes || 0, session.restMinutes || 0)} | ${format4PisLabel(session.intensity4pis || '0')}`)}</p>
              </div>
            ` : ''}
            <div class="saved-session-block">
              <span class="saved-session-label">Foco corporal</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.highlights))}</p>
            </div>
            <div class="saved-session-block">
              <span class="saved-session-label">Fundamentos</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.foundationHighlights))}</p>
            </div>
            <div class="saved-session-block">
              <span class="saved-session-label">Implementos</span>
              <p>${escapeHtml(formatEmphasisHighlights(derivedEmphasis.implementHighlights, true))}</p>
            </div>
          </div>
        </div>
      `;
      item.querySelector('[data-action="open"]').addEventListener('click', () => loadSavedSession(session.id));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSavedSession(session.id));
      elements.savedSessionsList.appendChild(item);
    });
  };

  buildPdfDocumentHtml = function (mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis) {
    const logoUrl = normalizeAssetUrl(LOGO_PATH);
    const intensity4pis = getIntensity4pisValue();
    const signatureHtml = buildPdfSignatureHtml(currentUser);
    const exercisesHtml = state.selectedItems
      .map((item, index) => {
        const imageUrl = item.exercise.image?.path ? normalizeAssetUrl(item.exercise.image.path) : '';
        const description = shorten(item.exercise.description || 'Sem descricao cadastrada.', 140);
        const detailsLine = getPdfDetailsLine(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis);

        return `
          <article class="pdf-exercise">
            ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(item.exercise.movement)}">` : '<div class="pdf-image-placeholder"></div>'}
            <div class="pdf-exercise-copy">
              <span class="pdf-pill">Selecao ${index + 1}</span>
              <strong class="pdf-exercise-name">${escapeHtml(item.exercise.movement)}</strong>
              <span class="pdf-muted">${escapeHtml(description)}</span>
              <span class="pdf-muted">${escapeHtml(`Implemento: ${item.exercise.implement || 'Nao informado'}`)}</span>
              <span class="pdf-muted">${escapeHtml(detailsLine)}</span>
            </div>
          </article>
        `;
      })
      .join('');

    const thirdMetaTitle = mode === 'intervalado' ? 'RER e 4PIS' : isMobilityMode(mode) ? '4PIS e mobilidade' : '4PIS e series';
    const thirdMetaValue = getPdfThirdMetaValue(mode, workMinutes, restMinutes, seriesCount, intensity4pis);

    return `
      <section class="pdf-sheet">
        <header class="pdf-header">
          <div class="pdf-title">
            <p class="pdf-kicker">Programa de Condicionamento Fisico para o Surfe</p>
            <h1>${escapeHtml(sessionName)}</h1>
            <p class="pdf-credit">Repositorio de Exercicios sUrFPE</p>
          </div>
          <div class="pdf-logo-wrap">
            <img class="pdf-logo" src="${logoUrl}" alt="Logo sUrFPE Tech">
          </div>
          <div class="pdf-meta">
            <article class="pdf-meta-card"><span>Modo</span><strong>${escapeHtml(getModeLabel(mode))}</strong></article>
            <article class="pdf-meta-card"><span>Tempo total</span><strong>${formatSessionTotal(mode, totalMinutes)}</strong></article>
            <article class="pdf-meta-card"><span>${thirdMetaTitle}</span><strong>${escapeHtml(thirdMetaValue)}</strong></article>
          </div>
        </header>
        <section class="pdf-callout">
          <span>Orientacao do programa</span>
          <strong>${escapeHtml(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise, intensity4pis))}</strong>
        </section>
        <section class="pdf-body">
          <section class="pdf-exercises">${exercisesHtml}</section>
          <aside class="pdf-side">
            <section class="pdf-emphasis-grid">
              ${buildPdfEmphasisTable('Foco corporal', emphasis.highlights)}
              ${buildPdfEmphasisTable('Fundamentos do surfe', emphasis.foundationHighlights)}
              ${buildPdfEmphasisTable('Implementos', emphasis.implementHighlights)}
            </section>
          </aside>
        </section>
        ${signatureHtml}
      </section>
    `;
  };

  exportSessionAsPdf = function () {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = modeUsesWork(mode) ? getNumber(elements.workMinutes.value) : 0;
    const restMinutes = modeUsesRest(mode) ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = modeUsesReps(mode) ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;

    if (modeUsesWork(mode) && workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }

    if (modeUsesReps(mode) && repsPerExercise <= 0) {
      alert(`Informe o numero de repeticoes por ${isMobilityMode(mode) ? 'movimento' : 'exercicio'} para exportar em ${getModeLabel(mode)}.`);
      return;
    }

    const roundMinutes = getRoundMinutes(mode, workMinutes, restMinutes, state.selectedItems.length);
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const exportBaseName = buildPdfFileName(sessionName, new Date());
    const previewHtml = buildPdfDocumentHtml(mode, sessionName, workMinutes, restMinutes, totalMinutes, seriesCount, roundMinutes, repsPerExercise, emphasis);
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
        .pdf-callout { display: grid; gap: 6px; padding: 12px 18px; border-radius: 20px; background: linear-gradient(135deg, #ffe600, #ffd34d); color: #2b2014; border: 1px solid rgba(34, 27, 23, 0.16); }
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
        .pdf-side { display: grid; gap: 10px; }
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
      source: 'prescription',
      mode,
      exercises: state.selectedItems.length,
      totalMinutes
    });
    printHtmlAsPdf(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${exportBaseName}</title>${styleHtml}</head><body>${previewHtml}</body></html>`);
  };

  exportSessionAsJpeg = async function () {
    if (state.selectedItems.length === 0) {
      alert('Selecione exercicios para exportar a sessao.');
      return;
    }

    const mode = getSessionMode();
    const workMinutes = modeUsesWork(mode) ? getNumber(elements.workMinutes.value) : 0;
    const restMinutes = modeUsesRest(mode) ? getNumber(elements.restMinutes.value) : 0;
    const seriesCount = Math.max(1, Math.floor(getNumber(elements.seriesCount.value) || 1));
    const repsPerExercise = modeUsesReps(mode) ? Math.max(1, Math.floor(getNumber(elements.repsPerExercise.value) || 0)) : 0;
    const intensity4pis = getIntensity4pisValue();

    if (modeUsesWork(mode) && workMinutes <= 0) {
      alert('Informe um tempo maior que zero para exportar a sessao.');
      return;
    }

    if (modeUsesReps(mode) && repsPerExercise <= 0) {
      alert(`Informe o numero de repeticoes por ${isMobilityMode(mode) ? 'movimento' : 'exercicio'} para exportar em ${getModeLabel(mode)}.`);
      return;
    }

    const sessionName = elements.sessionName.value.trim() || 'Sessao de treinamento';
    const roundMinutes = getRoundMinutes(mode, workMinutes, restMinutes, state.selectedItems.length);
    const totalMinutes = roundMinutes * seriesCount;
    const emphasis = summarizeSessionEmphasis(state.selectedItems.map((item) => item.exercise));
    const width = 1400;
    const headerHeight = 210;
    const stripHeight = 72;
    const emphasisHeight = 100;
    const cardHeight = 142;
    const gap = 12;
    const paddingBottom = 48;
    const height = headerHeight + stripHeight + emphasisHeight + (cardHeight + gap) * state.selectedItems.length + paddingBottom;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('Nao foi possivel gerar a imagem da sessao neste navegador.');
      return;
    }

    ctx.fillStyle = '#f7f2e9';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#8d0000');
    gradient.addColorStop(0.55, '#b50000');
    gradient.addColorStop(1, '#0c4b7b');
    ctx.fillStyle = gradient;
    roundRect(ctx, 48, 34, width - 96, 148, 28);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px Manrope, sans-serif';
    ctx.fillText('Programa de Condicionamento Fisico para o Surfe', 82, 76);
    ctx.font = '800 34px Sora, sans-serif';
    ctx.fillText(sessionName, 82, 118);
    ctx.font = '600 18px Manrope, sans-serif';
    ctx.fillText('Repositorio de Exercicios sUrFPE', 82, 150);

    try {
      const logo = await loadImage(LOGO_PATH);
      drawContainImage(ctx, logo, width - 300, 54, 170, 82);
    } catch (error) {
      console.warn('Nao foi possivel carregar o logo para exportacao JPEG.', error);
    }

    ctx.fillStyle = '#ffd84a';
    roundRect(ctx, 48, 198, width - 96, 58, 18);
    ctx.fill();
    ctx.fillStyle = '#221b17';
    ctx.font = '800 24px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getExportLineText(mode, workMinutes, restMinutes, seriesCount, repsPerExercise, intensity4pis), width / 2, 234);
    ctx.textAlign = 'start';

    const emphasisBoxes = [
      { title: 'Foco corporal', text: formatEmphasisHighlights(emphasis.highlights) },
      { title: 'Fundamentos', text: formatEmphasisHighlights(emphasis.foundationHighlights) },
      { title: 'Implementos', text: formatEmphasisHighlights(emphasis.implementHighlights, true) }
    ];

    const boxWidth = (width - 96 - 24) / 3;
    emphasisBoxes.forEach((box, index) => {
      const left = 48 + index * (boxWidth + 12);
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.16)';
      ctx.lineWidth = 2;
      roundRect(ctx, left, 274, boxWidth, 84, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#695746';
      ctx.font = '800 14px Manrope, sans-serif';
      ctx.fillText(box.title, left + 14, 298);
      ctx.fillStyle = '#221b17';
      ctx.font = '600 16px Manrope, sans-serif';
      wrapText(ctx, box.text || 'Sem dados', left + 14, 324, boxWidth - 28, 20);
    });

    let top = 376;
    for (let index = 0; index < state.selectedItems.length; index += 1) {
      const item = state.selectedItems[index];
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(76, 61, 46, 0.16)';
      ctx.lineWidth = 2;
      roundRect(ctx, 48, top, width - 96, cardHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9d0208';
      roundRect(ctx, 66, top + 16, 74, 34, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px Manrope, sans-serif';
      ctx.fillText(String(index + 1), 96, top + 39);

      const imageX = 158;
      const imageY = top + 14;
      const imageWidth = 146;
      const imageHeight = 110;

      if (item.exercise.image?.path) {
        try {
          const image = await loadImage(item.exercise.image.path);
          drawCoverImage(ctx, image, imageX, imageY, imageWidth, imageHeight, 12);
        } catch (error) {
          ctx.fillStyle = '#e7dfd2';
          roundRect(ctx, imageX, imageY, imageWidth, imageHeight, 12);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e7dfd2';
        roundRect(ctx, imageX, imageY, imageWidth, imageHeight, 12);
        ctx.fill();
      }

      const textX = 326;
      ctx.fillStyle = '#221b17';
      ctx.font = '800 26px Sora, sans-serif';
      wrapText(ctx, item.exercise.movement, textX, top + 40, width - textX - 80, 28);
      ctx.font = '600 17px Manrope, sans-serif';
      ctx.fillStyle = '#695746';
      wrapText(ctx, item.exercise.description || 'Sem descricao cadastrada.', textX, top + 72, width - textX - 80, 20);
      ctx.fillText(`Implemento: ${item.exercise.implement || 'Nao informado'}`, textX, top + 116);
      ctx.fillText(
        mode === 'intervalado'
          ? `${format4PisLabel(intensity4pis)} | RER ${formatRerLabel(workMinutes, restMinutes)}`
          : `${repsPerExercise} reps por exercicio | ${format4PisLabel(intensity4pis)} | serie em ate ${formatMinutes(workMinutes)}`,
        textX,
        top + 138
      );

      top += cardHeight + gap;
    }

    await exportCanvasAsJpeg(canvas, slugify(sessionName));
  };

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

  function normalizeSportValenceKey(value) {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '');

    const aliases = {
      strengthendurance: 'strengthEndurance',
      forcaresistenteoupura: 'strengthEndurance',
      forcaresistente: 'strengthEndurance',
      forcapura: 'strengthEndurance',
      forcaspura: 'strengthEndurance',
      explosivestrength: 'explosiveStrength',
      forcaexplosiva: 'explosiveStrength',
      mobility: 'mobility',
      mobilidade: 'mobility',
      balance: 'balance',
      equilibrio: 'balance',
      landing: 'landing',
      aerobic: 'aerobic',
      aerobio: 'aerobic',
      speed: 'speed',
      velocidade: 'speed',
      agility: 'agility',
      agilidade: 'agility'
    };

    return aliases[normalized] || '';
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function normalizeSportValences(values) {
    const items = Array.isArray(values)
      ? values
      : String(values || '')
        .split(/[|,;/]+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const normalized = items
      .map((value) => normalizeSportValenceKey(value))
      .filter(Boolean);

    return normalized.length ? [...new Set(normalized)] : ['strengthEndurance'];
  }

  function isMobilityMode(mode) {
    return mode === 'mobility_reps' || mode === 'mobility_time';
  }

  function modeUsesWork(mode) {
    return mode === 'intervalado' || mode === 'rot' || mode === 'mobility_time';
  }

  function modeUsesRest(mode) {
    return mode === 'intervalado';
  }

  function modeUsesReps(mode) {
    return mode === 'rot' || mode === 'mobility_reps';
  }

  function formatSessionTotal(mode, totalMinutes) {
    return mode === 'mobility_reps' ? 'N/A' : formatMinutes(totalMinutes);
  }

  function getSummaryRatioText(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis) {
    if (mode === 'intervalado') {
      return `RER ${formatRerLabel(workMinutes, restMinutes)} | ${format4PisLabel(intensity4pis)}`;
    }
    if (mode === 'mobility_reps') {
      return `${format4PisLabel(intensity4pis)} | ${repsPerExercise} reps por movimento.`;
    }
    if (mode === 'mobility_time') {
      return `${format4PisLabel(intensity4pis)} | ${formatMinutes(workMinutes)} por movimento.`;
    }
    return `${format4PisLabel(intensity4pis)} | Treino ROT configurado por repeticoes por exercicio e tempo maximo por serie.`;
  }

  function getPreviewPrimaryLine(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis) {
    if (mode === 'intervalado') {
      return `${formatMinutes(workMinutes)} de estimulo | ${format4PisLabel(intensity4pis)}`;
    }
    if (mode === 'mobility_reps') {
      return `${repsPerExercise} reps por movimento | ${format4PisLabel(intensity4pis)}`;
    }
    if (mode === 'mobility_time') {
      return `${formatMinutes(workMinutes)} por movimento | ${format4PisLabel(intensity4pis)}`;
    }
    return `${repsPerExercise} reps por exercicio | ${format4PisLabel(intensity4pis)}`;
  }

  function getPreviewSecondaryLine(mode, workMinutes, restMinutes) {
    if (mode === 'intervalado') {
      return `${formatMinutes(restMinutes)} de recuperacao | RER ${formatRerLabel(workMinutes, restMinutes)}`;
    }
    if (mode === 'mobility_reps') {
      return 'Sem variavel de tempo neste modo';
    }
    if (mode === 'mobility_time') {
      return 'Tempo aplicado individualmente em cada movimento';
    }
    return `Serie completa em ate ${formatMinutes(workMinutes)}`;
  }

  function getPdfDetailsLine(mode, workMinutes, restMinutes, repsPerExercise, intensity4pis) {
    if (mode === 'intervalado') {
      return `${formatMinutes(workMinutes)} de estimulo | ${format4PisLabel(intensity4pis)} | ${formatMinutes(restMinutes)} de recuperacao | RER ${formatRerLabel(workMinutes, restMinutes)}`;
    }
    if (mode === 'mobility_reps') {
      return `${repsPerExercise} reps por movimento | ${format4PisLabel(intensity4pis)}`;
    }
    if (mode === 'mobility_time') {
      return `${formatMinutes(workMinutes)} por movimento | ${format4PisLabel(intensity4pis)}`;
    }
    return `${repsPerExercise} reps por exercicio | ${format4PisLabel(intensity4pis)} | serie completa em ate ${formatMinutes(workMinutes)}`;
  }

  function getPdfThirdMetaValue(mode, workMinutes, restMinutes, seriesCount, intensity4pis) {
    if (mode === 'intervalado') {
      return `${formatRerLabel(workMinutes, restMinutes)} | ${format4PisLabel(intensity4pis)}`;
    }
    if (mode === 'mobility_reps') {
      return `${format4PisLabel(intensity4pis)} | ${state.selectedItems.length} x ${seriesCount}`;
    }
    if (mode === 'mobility_time') {
      return `${format4PisLabel(intensity4pis)} | ${formatMinutes(workMinutes)} por movimento`;
    }
    return `${format4PisLabel(intensity4pis)} | ${state.selectedItems.length} x ${seriesCount}`;
  }

  function setSessionFeedback(message) {
    if (!elements.sessionFeedback) return;
    elements.sessionFeedback.textContent = String(message || '');
  }

  function clearSessionFeedback() {
    setSessionFeedback('');
  }

  function setSessionBusy(isBusy) {
    if (elements.saveSessionButton) {
      elements.saveSessionButton.disabled = Boolean(isBusy);
      elements.saveSessionButton.textContent = isBusy ? 'Gravando sessão...' : 'Finalizar e gravar sessão';
    }
  }

  bindEnhancedUi = function () {
    [elements.workMinutes, elements.intensity4pis, elements.restMinutes, elements.seriesCount, elements.repsPerExercise, elements.sessionMode].forEach((element) => {
      if (!element) return;
      element.addEventListener('input', () => queueMicrotask(refreshEnhancedSessionSummary));
      element.addEventListener('change', () => queueMicrotask(() => {
        syncModeFields();
        refreshEnhancedSessionSummary();
      }));
    });

    elements.exportPdfButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportSessionAsPdf();
    }, true);

    elements.exportJpegButton?.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await exportSessionAsJpeg();
    }, true);
  };

  bindEnhancedUi();
  closeRandomModal();
  syncModeFields();
  render();
})();
