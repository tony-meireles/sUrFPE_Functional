(function () {
  const STORAGE_KEY = 'surfpe.usageEvents.v1';
  const LAST_ACCESS_KEY = 'surfpe.usageLastAccessByPage.v1';
  const ACCESS_COOLDOWN_MS = 5 * 60 * 1000;
  const MAX_EVENT_AGE_DAYS = 400;
  const MAX_EVENTS = 5000;

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Falha ao restaurar analytics de uso.', error);
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function loadLastAccessRegistry() {
    try {
      const raw = localStorage.getItem(LAST_ACCESS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveLastAccessRegistry(registry) {
    localStorage.setItem(LAST_ACCESS_KEY, JSON.stringify(registry));
  }

  function pruneEvents(events) {
    const cutoff = Date.now() - (MAX_EVENT_AGE_DAYS * 24 * 60 * 60 * 1000);
    return events
      .filter((event) => Number(event?.timestamp || 0) >= cutoff)
      .slice(-MAX_EVENTS);
  }

  function trackEvent(type, meta) {
    const events = pruneEvents(loadEvents());
    events.push({
      type: String(type || 'unknown'),
      timestamp: Date.now(),
      meta: meta && typeof meta === 'object' ? meta : {}
    });
    saveEvents(pruneEvents(events));
  }

  function trackAccess(page) {
    const now = Date.now();
    const normalizedPage = String(page || 'unknown');
    const registry = loadLastAccessRegistry();
    const lastAccessAt = Number(registry[normalizedPage] || 0);
    if (now - lastAccessAt < ACCESS_COOLDOWN_MS) {
      return false;
    }

    registry[normalizedPage] = now;
    saveLastAccessRegistry(registry);
    trackEvent('access', { page: normalizedPage });
    return true;
  }

  function getEvents() {
    return pruneEvents(loadEvents());
  }

  window.SURFPE_USAGE = {
    trackEvent,
    trackAccess,
    getEvents
  };
})();
