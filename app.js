(function () {
  const repository = window.EXERCISE_REPOSITORY || { meta: {}, exercises: [] };
  const usage = window.SURFPE_USAGE || null;
  const STORAGE_KEY = 'surfpe.exerciseRepository.v1';
  const PAGE_SIZE = 12;

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
    }
  };

  const state = {
    exercises: loadInitialExercises(),
    selectedId: null,
    search: '',
    implementFilters: new Set(),
    scoreFilters: new Set(),
    foundationFilters: new Set(),
    currentPage: 1,
    implementOptions: [],
    lastImportSummary: ''
  };

  const elements = {
    exerciseGrid: document.getElementById('exerciseGrid'),
    detailContent: document.getElementById('detailContent'),
    exerciseCount: document.getElementById('exerciseCount'),
    activeFilterCount: document.getElementById('activeFilterCount'),
    imageCount: document.getElementById('imageCount'),
    resultsCount: document.getElementById('resultsCount'),
    resultsSummary: document.getElementById('resultsSummary'),
    pagination: document.getElementById('pagination'),
    storageStatus: document.getElementById('storageStatus'),
    searchInput: document.getElementById('searchInput'),
    implementFilters: document.getElementById('implementFilters'),
    scoreFilters: document.getElementById('scoreFilters'),
    foundationFilters: document.getElementById('foundationFilters'),
    clearFiltersButton: document.getElementById('clearFiltersButton'),
    newExerciseButton: document.getElementById('newExerciseButton'),
    exportButton: document.getElementById('exportButton'),
    resetButton: document.getElementById('resetButton'),
    importLibraryButton: document.getElementById('importLibraryButton'),
    libraryFileInput: document.getElementById('libraryFileInput'),
    deleteButton: document.getElementById('deleteButton'),
    form: document.getElementById('exerciseForm'),
    originalId: document.getElementById('originalId'),
    fieldId: document.getElementById('fieldId'),
    fieldMovement: document.getElementById('fieldMovement'),
    fieldDescription: document.getElementById('fieldDescription'),
    fieldImplement: document.getElementById('fieldImplement'),
    fieldNewImplement: document.getElementById('fieldNewImplement'),
    addImplementButton: document.getElementById('addImplementButton'),
    fieldSelection: document.getElementById('fieldSelection'),
    fieldImagePath: document.getElementById('fieldImagePath'),
    fieldImageAttribution: document.getElementById('fieldImageAttribution'),
    fieldUpperBody: document.getElementById('fieldUpperBody'),
    fieldLowerBody: document.getElementById('fieldLowerBody'),
    fieldTrunk: document.getElementById('fieldTrunk'),
    fieldCore: document.getElementById('fieldCore'),
    fieldBalance: document.getElementById('fieldBalance'),
    fieldPopup: document.getElementById('fieldPopup'),
    fieldRowing: document.getElementById('fieldRowing'),
    fieldNavigation: document.getElementById('fieldNavigation'),
    fieldRailManeuvers: document.getElementById('fieldRailManeuvers')
  };

  bindEvents();
  syncImplementOptions();
  renderFilterControls();
  selectExercise(state.exercises[0]?.id ?? null);
  render();
  usage?.trackAccess?.('repository');

  function loadInitialExercises() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return (repository.exercises || []).map(normalizeExerciseData);
    }

    try {
      return JSON.parse(saved).map(normalizeExerciseData);
    } catch (error) {
      console.warn('Falha ao restaurar localStorage, usando importação original.', error);
      return (repository.exercises || []).map(normalizeExerciseData);
    }
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
      elements.searchInput.value = '';
      renderFilterControls();
      render();
    });

    elements.newExerciseButton.addEventListener('click', () => {
      state.selectedId = null;
      fillForm(createEmptyExercise());
      renderDetails(null);
    });

    elements.exportButton.addEventListener('click', exportRepository);
    elements.resetButton.addEventListener('click', resetRepository);
    elements.importLibraryButton.addEventListener('click', () => elements.libraryFileInput.click());
    elements.libraryFileInput.addEventListener('change', importLibraryFromFile);
    elements.deleteButton.addEventListener('click', deleteExercise);
    elements.addImplementButton.addEventListener('click', addImplementOptionFromInput);

    elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveExerciseFromForm();
    });
  }

  function renderFilterControls() {
    renderChips(elements.implementFilters, state.implementOptions, state.implementFilters);
    renderChips(elements.scoreFilters, Object.keys(labels.scoreKeys), state.scoreFilters, labels.scoreKeys);
    renderChips(elements.foundationFilters, Object.keys(labels.foundationKeys), state.foundationFilters, labels.foundationKeys);
    renderImplementSelect();
  }

  function renderChips(container, options, activeSet, dictionary) {
    container.innerHTML = '';
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chip ${activeSet.has(option) ? 'is-active' : ''}`;
      button.textContent = dictionary?.[option] || option;
      button.addEventListener('click', () => {
        if (activeSet.has(option)) {
          activeSet.delete(option);
        } else {
          activeSet.add(option);
        }
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
          const matchesScore = [...state.scoreFilters].every((key) => Number(exercise.scores?.[key] || 0) > 0);
          if (!matchesScore) return false;
        }

        if (state.foundationFilters.size > 0) {
          const matchesFoundation = [...state.foundationFilters].every((key) => Number(exercise.foundations?.[key] || 0) > 0);
          if (!matchesFoundation) return false;
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
    const selected = state.exercises.find((exercise) => exercise.id === state.selectedId) || filtered[0] || null;

    if (selected && selected.id !== state.selectedId) {
      state.selectedId = selected.id;
    }

    elements.exerciseCount.textContent = String(state.exercises.length);
    elements.activeFilterCount.textContent = String(
      state.implementFilters.size + state.scoreFilters.size + state.foundationFilters.size + (state.search ? 1 : 0)
    );
    elements.imageCount.textContent = String(state.exercises.filter((exercise) => exercise.image?.path).length);
    elements.resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`;
    elements.resultsSummary.textContent = filtered.length
      ? `Página ${state.currentPage} de ${totalPages}`
      : (state.search ? `Busca por "${state.search}"` : 'Catálogo completo');
    elements.storageStatus.textContent = state.lastImportSummary || 'Usando armazenamento local do navegador.';

    renderCards(paginated);
    renderPagination(totalPages);
    renderDetails(selected);
  }

  function renderCards(exercises) {
    elements.exerciseGrid.innerHTML = '';

    if (exercises.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Nenhum exercício encontrado com os filtros atuais.';
      elements.exerciseGrid.appendChild(empty);
      return;
    }

    exercises.forEach((exercise) => {
      const card = document.createElement('article');
      card.className = `exercise-card ${exercise.id === state.selectedId ? 'is-selected' : ''}`;
      card.innerHTML = `
        ${exercise.image?.path ? `<img src="${exercise.image.path}" alt="${escapeHtml(exercise.movement)}">` : '<div class="detail-image"></div>'}
        <div class="card-meta">
          <span class="pill">#${exercise.id}</span>
          ${exercise.implement ? `<span class="pill">${escapeHtml(exercise.implement)}</span>` : ''}
        </div>
        <h3>${escapeHtml(exercise.movement)}</h3>
        <p>${escapeHtml(shorten(exercise.description || 'Sem descrição cadastrada.', 110))}</p>
        <div class="card-meta">${(exercise.tags || []).slice(0, 4).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}</div>
      `;
      card.addEventListener('click', () => {
        state.selectedId = exercise.id;
        fillForm(exercise);
        render();
      });
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

  function renderDetails(exercise) {
    if (!exercise) {
      elements.detailContent.innerHTML = '<div class="empty-state">Preencha o formulário para cadastrar um novo exercício.</div>';
      return;
    }

    fillForm(exercise);

    elements.detailContent.innerHTML = `
      ${exercise.image?.path ? `<img class="detail-image" src="${exercise.image.path}" alt="${escapeHtml(exercise.movement)}">` : '<div class="detail-image"></div>'}
      <div class="detail-meta">
        <span class="pill">ID ${exercise.id}</span>
        ${exercise.implement ? `<span class="pill">${escapeHtml(exercise.implement)}</span>` : ''}
        ${exercise.selection ? `<span class="pill">Seleção ${exercise.selection}</span>` : ''}
      </div>
      <h3 class="detail-title">${escapeHtml(exercise.movement)}</h3>
      <p class="detail-description">${escapeHtml(exercise.description || 'Sem descrição cadastrada.')}</p>
      <div>
        <p class="panel-title">Ênfase corporal</p>
        <ul class="metric-list">${renderMetricList(exercise.scores, labels.scoreKeys)}</ul>
      </div>
      <div>
        <p class="panel-title">Fundamentos do surfe</p>
        <ul class="metric-list">${renderMetricList(exercise.foundations, labels.foundationKeys)}</ul>
      </div>
      ${exercise.image?.attribution ? `<p class="credit">Crédito da imagem: ${escapeHtml(exercise.image.attribution)}</p>` : ''}
    `;
  }

  function renderMetricList(values, dictionary) {
    return Object.entries(dictionary)
      .map(([key, label]) => `<li><span>${escapeHtml(label)}</span><strong>${numericOrZero(values?.[key])}</strong></li>`)
      .join('');
  }

  function selectExercise(id) {
    state.selectedId = id;
    const selected = state.exercises.find((exercise) => exercise.id === id) || null;
    fillForm(selected || createEmptyExercise());
  }

  function fillForm(exercise) {
    elements.originalId.value = exercise?.id ?? '';
    elements.fieldId.value = exercise?.id ?? '';
    elements.fieldMovement.value = exercise?.movement ?? '';
    elements.fieldDescription.value = exercise?.description ?? '';
    elements.fieldImplement.value = exercise?.implement ?? '';
    elements.fieldSelection.value = exercise?.selection ?? '';
    elements.fieldImagePath.value = exercise?.image?.path ?? '';
    elements.fieldImageAttribution.value = exercise?.image?.attribution ?? '';
    elements.fieldUpperBody.value = exercise?.scores?.upperBody ?? '';
    elements.fieldLowerBody.value = exercise?.scores?.lowerBody ?? '';
    elements.fieldTrunk.value = exercise?.scores?.trunk ?? '';
    elements.fieldCore.value = exercise?.scores?.core ?? '';
    elements.fieldBalance.value = exercise?.scores?.balance ?? '';
    elements.fieldPopup.value = exercise?.foundations?.popup ?? '';
    elements.fieldRowing.value = exercise?.foundations?.rowing ?? '';
    elements.fieldNavigation.value = exercise?.foundations?.navigation ?? '';
    elements.fieldRailManeuvers.value = exercise?.foundations?.railManeuvers ?? '';
  }

  function createEmptyExercise() {
    return {
      id: nextId(),
      movement: '',
      description: '',
      implement: '',
      selection: '',
      image: { path: '', attribution: '' },
      scores: { upperBody: '', lowerBody: '', trunk: '', core: '', balance: '' },
      foundations: { popup: '', rowing: '', navigation: '', railManeuvers: '' }
    };
  }

  function saveExerciseFromForm() {
    const exercise = readForm();
    const originalId = Number(elements.originalId.value || 0);
    const duplicate = state.exercises.find((item) => Number(item.id) === Number(exercise.id) && Number(item.id) !== originalId);

    if (duplicate) {
      alert(`Já existe um exercício com o ID ${exercise.id}.`);
      return;
    }

    const index = state.exercises.findIndex((item) => Number(item.id) === originalId);
    if (index >= 0) {
      state.exercises[index] = exercise;
    } else {
      state.exercises.push(exercise);
    }

    state.exercises.sort((a, b) => Number(a.id) - Number(b.id));
    state.selectedId = exercise.id;
    syncImplementOptions();
    persistState();
    renderFilterControls();
    render();
  }

  function deleteExercise() {
    const id = Number(elements.originalId.value || 0);
    if (!id) {
      fillForm(createEmptyExercise());
      return;
    }

    if (!confirm(`Excluir o exercício ${id}?`)) return;

    state.exercises = state.exercises.filter((exercise) => Number(exercise.id) !== id);
    state.selectedId = state.exercises[0]?.id ?? null;
    syncImplementOptions();
    persistState();
    renderFilterControls();
    render();
  }

  function readForm() {
    const exercise = {
      id: Number(elements.fieldId.value),
      movement: elements.fieldMovement.value.trim(),
      description: elements.fieldDescription.value.trim(),
      implement: elements.fieldImplement.value.trim(),
      selection: numericOrNull(elements.fieldSelection.value),
      randomWeight: 0,
      scores: {
        upperBody: numericOrZero(elements.fieldUpperBody.value),
        lowerBody: numericOrZero(elements.fieldLowerBody.value),
        trunk: numericOrZero(elements.fieldTrunk.value),
        core: numericOrZero(elements.fieldCore.value),
        balance: numericOrZero(elements.fieldBalance.value)
      },
      foundations: {
        popup: numericOrZero(elements.fieldPopup.value),
        rowing: numericOrZero(elements.fieldRowing.value),
        navigation: numericOrZero(elements.fieldNavigation.value),
        railManeuvers: numericOrZero(elements.fieldRailManeuvers.value)
      },
      image: {
        path: elements.fieldImagePath.value.trim(),
        attribution: elements.fieldImageAttribution.value.trim()
      },
      source: {
        workbook: repository.meta?.sourceWorkbook || 'local',
        sheet: 'Manual',
        row: null
      }
    };

    exercise.tags = buildTags(exercise);
    return exercise;
  }

  function buildTags(exercise) {
    const tags = [];
    Object.entries(labels.scoreKeys).forEach(([key, label]) => {
      if (Number(exercise.scores?.[key] || 0) > 0) tags.push(label);
    });
    Object.entries(labels.foundationKeys).forEach(([key, label]) => {
      if (Number(exercise.foundations?.[key] || 0) > 0) tags.push(label);
    });
    return tags;
  }

  function normalizeExerciseData(exercise) {
    const normalized = structuredClone(exercise || {});

    normalized.scores = {
      upperBody: numericOrZero(normalized.scores?.upperBody),
      lowerBody: numericOrZero(normalized.scores?.lowerBody),
      trunk: numericOrZero(normalized.scores?.trunk),
      core: numericOrZero(normalized.scores?.core),
      balance: numericOrZero(normalized.scores?.balance)
    };

    normalized.foundations = {
      popup: numericOrZero(normalized.foundations?.popup),
      rowing: numericOrZero(normalized.foundations?.rowing),
      navigation: numericOrZero(normalized.foundations?.navigation),
      railManeuvers: numericOrZero(normalized.foundations?.railManeuvers)
    };

    normalized.tags = buildTags(normalized);
    return normalized;
  }

  function numericOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function numericOrNull(value) {
    if (value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.exercises));
  }

  async function importLibraryFromFile(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    if (!window.XLSX) {
      alert('A biblioteca de leitura de Excel não carregou. Verifique sua conexão e tente novamente.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const importedExercises = rows
        .map((row) => mapImportedRow(row, file.name))
        .filter(Boolean);

      const existingSignatures = new Set(state.exercises.flatMap((exercise) => getDuplicateKeys(exercise)));
      const merged = [...state.exercises];
      let importedCount = 0;
      let duplicateCount = 0;

      importedExercises.forEach((exercise) => {
        const keys = getDuplicateKeys(exercise);
        const isDuplicate = keys.some((key) => existingSignatures.has(key));
        if (isDuplicate) {
          duplicateCount += 1;
          return;
        }
        merged.push(exercise);
        keys.forEach((key) => existingSignatures.add(key));
        importedCount += 1;
      });

      state.exercises = merged.sort((a, b) => Number(a.id) - Number(b.id));
      state.lastImportSummary = `${importedCount} exercício${importedCount === 1 ? '' : 's'} importado${importedCount === 1 ? '' : 's'} de ${file.name}; ${duplicateCount} duplicata${duplicateCount === 1 ? '' : 's'} ignorada${duplicateCount === 1 ? '' : 's'}.`;
      syncImplementOptions();
      persistState();
      renderFilterControls();
      render();
      usage?.trackEvent?.('library_imported', { importedCount, duplicateCount });
      alert(state.lastImportSummary);
    } catch (error) {
      console.error(error);
      alert('Não foi possível importar a biblioteca a partir da planilha selecionada.');
    } finally {
      elements.libraryFileInput.value = '';
    }
  }

  function exportRepository() {
    const ordered = [...state.exercises].sort((a, b) => {
      const rowA = Number(a.source?.row || Number.MAX_SAFE_INTEGER);
      const rowB = Number(b.source?.row || Number.MAX_SAFE_INTEGER);
      if (rowA !== rowB) return rowA - rowB;
      return Number(a.id) - Number(b.id);
    });

    const header = [
      'Selecao', 'Id', 'Movimento', 'Execucao', 'Kettlebell', 'Halter', 'Elastic Band', 'Bola Suica',
      'MMSS', 'MMII', 'Tronco', 'Core', 'Equilibrio', 'Popup', 'Remada', 'Navegacao',
      'Manobras de Borda', 'Descricao', 'Implemento', 'Aleatorio'
    ];

    const rows = ordered.map((exercise) => ([
      exercise.selection ?? '',
      exercise.id ?? '',
      exercise.movement ?? '',
      exercise.image?.path ?? '',
      exercise.implementsAvailable?.kettlebell ?? '',
      exercise.implementsAvailable?.dumbbell ?? '',
      exercise.implementsAvailable?.elasticBand ?? '',
      exercise.implementsAvailable?.swissBall ?? '',
      exercise.scores?.upperBody ?? '',
      exercise.scores?.lowerBody ?? '',
      exercise.scores?.trunk ?? '',
      exercise.scores?.core ?? '',
      exercise.scores?.balance ?? '',
      exercise.foundations?.popup ?? '',
      exercise.foundations?.rowing ?? '',
      exercise.foundations?.navigation ?? '',
      exercise.foundations?.railManeuvers ?? '',
      exercise.description ?? '',
      exercise.implement ?? '',
      exercise.randomWeight ?? ''
    ]));

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'repositorio-exercicios-surfpe.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    usage?.trackEvent?.('csv_exported', { rows: ordered.length });
  }

  function resetRepository() {
    if (!confirm('Restaurar a importação original e apagar as edições locais do navegador?')) return;

    localStorage.removeItem(STORAGE_KEY);
    state.exercises = structuredClone(repository.exercises || []);
    state.selectedId = state.exercises[0]?.id ?? null;
    state.search = '';
    state.implementFilters.clear();
    state.scoreFilters.clear();
    state.foundationFilters.clear();
    state.currentPage = 1;
    state.lastImportSummary = '';
    elements.searchInput.value = '';
    syncImplementOptions();
    renderFilterControls();
    render();
  }

  function syncImplementOptions() {
    state.implementOptions = uniqueValues(state.exercises.map((exercise) => exercise.implement));
  }

  function renderImplementSelect() {
    const currentValue = elements.fieldImplement.value;
    elements.fieldImplement.innerHTML = '<option value="">Selecione um implemento</option>';
    state.implementOptions.forEach((implement) => {
      const option = document.createElement('option');
      option.value = implement;
      option.textContent = implement;
      elements.fieldImplement.appendChild(option);
    });
    if (currentValue && state.implementOptions.includes(currentValue)) {
      elements.fieldImplement.value = currentValue;
    }
  }

  function addImplementOptionFromInput() {
    const newImplement = elements.fieldNewImplement.value.trim();
    if (!newImplement) return;
    if (!state.implementOptions.includes(newImplement)) {
      state.implementOptions = uniqueValues([...state.implementOptions, newImplement]);
    }
    renderImplementSelect();
    elements.fieldImplement.value = newImplement;
    elements.fieldNewImplement.value = '';
  }

  function nextId() {
    return state.exercises.reduce((max, exercise) => Math.max(max, Number(exercise.id) || 0), 0) + 1;
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

  function escapeCsv(value) {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }

  function mapImportedRow(row, sourceName) {
    const get = (...keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return row[key];
        }
      }
      return '';
    };

    const id = Number(get('Id', 'ID', 'id'));
    const movement = String(get('Movimento', 'Movement', 'movimento')).trim();
    if (!id || !movement) return null;

    const implement = String(get('Implemento', 'implemento')).trim();
    const exercise = {
      id,
      movement,
      selection: numericOrNull(get('Selecao', 'Seleção', 'selection')),
      description: String(get('Descricao', 'Descrição', 'description')).trim(),
      implement,
      randomWeight: numericOrZero(get('Aleatorio', 'Aleatório', 'randomWeight')),
      scores: {
        upperBody: numericOrZero(get('MMSS', 'upperBody')),
        lowerBody: numericOrZero(get('MMII', 'lowerBody')),
        trunk: numericOrZero(get('Tronco', 'trunk')),
        core: numericOrZero(get('Core', 'core')),
        balance: numericOrZero(get('Equilibrio', 'Equilíbrio', 'balance'))
      },
      foundations: {
        popup: numericOrZero(get('Popup', 'popup')),
        rowing: numericOrZero(get('Remada', 'rowing')),
        navigation: numericOrZero(get('Navegacao', 'Navegação', 'navigation')),
        railManeuvers: numericOrZero(get('Manobras de Borda', 'railManeuvers'))
      },
      implementsAvailable: {
        kettlebell: numericOrZero(get('Kettlebell', 'kettlebell')),
        dumbbell: numericOrZero(get('Halter', 'dumbbell')),
        elasticBand: numericOrZero(get('Elastic Band', 'elasticBand')),
        swissBall: numericOrZero(get('Bola Suica', 'Bola Suiça', 'swissBall'))
      },
      image: {
        path: String(get('Execucao', 'Execução', 'imagePath')).trim(),
        attribution: ''
      },
      source: {
        workbook: sourceName,
        sheet: 'Importado',
        row: null
      }
    };

    exercise.tags = buildTags(exercise);
    return exercise;
  }

  function getDuplicateKeys(exercise) {
    const normalizedMovement = normalizeText(exercise.movement);
    const normalizedImplement = normalizeText(exercise.implement);
    return [
      `id:${exercise.id}`,
      `movement:${normalizedMovement}|implement:${normalizedImplement}`
    ];
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
})();
