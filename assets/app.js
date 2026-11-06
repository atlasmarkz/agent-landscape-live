/* =========================================================
   Agent Landscape · Live
   Data: data/curated.json + data/live.json
   ========================================================= */
(() => {
  "use strict";

  const MODE_LABEL = { curated: "精选", hot: "最热", rising: "新锐" };
  const MODE_NOTE = {
    curated: "编辑精选 · 按阶段覆盖度编排",
    hot: "GitHub Search · 按 Stars 排序",
    rising: "GitHub Search · 近 12 个月创建 · 按 Stars 排序",
  };
  const LANG_COLORS = {
    Python: "#3572A5",
    TypeScript: "#3178C6",
    JavaScript: "#F1E05A",
    Rust: "#DEA584",
    Go: "#00ADD8",
    C: "#555555",
    "C++": "#F34B7D",
    "C#": "#178600",
    Java: "#B07219",
    Ruby: "#701516",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Shell: "#89E051",
    HTML: "#E34C26",
    CSS: "#563D7C",
    Vue: "#41B883",
    "Jupyter Notebook": "#DA5B0B",
    MDX: "#FCB32C",
    Zig: "#EC915C",
    CUDA: "#3A4E3A",
  };
  const LANG_SHORT = {
    "Jupyter Notebook": "Jupyter",
    "Visual Basic .NET": "VB.NET",
  };

  const state = {
    curated: null,
    live: null,
    mode: localStorage.getItem("al-mode") || "curated",
    query: "",
    expanded: new Set(),
    allExpanded: false,
    activeStage: null,
    loading: false,
    toastTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const stageList = $("#stageList");
  const stageNav = $("#stageNav");
  const signalList = $("#signalList");
  const tickerTrack = $("#tickerTrack");
  const syncStatus = $("#syncStatus");
  const syncText = $("#syncText");
  const heroSync = $("#heroSync");
  const resultsMeta = $("#resultsMeta");
  const resultsNote = $("#resultsNote");
  const emptyState = $("#emptyState");
  const expandAllWrap = $("#expandAllWrap");
  const toggleAll = $("#toggleAll");
  const toggleAllText = $("#toggleAllText");
  const searchInput = $("#searchInput");
  const refreshBtn = $("#refreshBtn");
  const clearSearch = $("#clearSearch");
  const menuBtn = $("#menuBtn");
  const siteNav = $("#siteNav");
  const buildDate = $("#buildDate");
  const toast = $("#toast");

  let stageObserver = null;

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function safeUrl(url, fullName) {
    if (typeof url === "string" && /^https:\/\/github\.com\/[^\s]+$/i.test(url)) return url;
    return `https://github.com/${fullName}`;
  }

  function formatStars(n) {
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}m`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
    return String(n);
  }

  function relativeTime(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const diff = Date.now() - then;
    const future = diff < 0;
    const abs = Math.abs(diff);
    let value;
    if (abs < 60e3) return future ? "即将" : "刚刚";
    if (abs < 3600e3) value = `${Math.floor(abs / 60e3)} 分钟`;
    else if (abs < 86400e3) value = `${Math.floor(abs / 3600e3)} 小时`;
    else if (abs < 30 * 86400e3) value = `${Math.floor(abs / 86400e3)} 天`;
    else if (abs < 365 * 86400e3) value = `${Math.floor(abs / (30 * 86400e3))} 个月`;
    else value = `${Math.floor(abs / (365 * 86400e3))} 年`;
    return future ? `${value}后` : `${value}前`;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  function formatDateShort(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function langColor(lang) {
    return LANG_COLORS[lang] || "#8A90A0";
  }

  function langLabel(lang) {
    return LANG_SHORT[lang] || lang;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function starIcon() {
    return `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.6 9.9 6l4.7.4-3.6 3 1.1 4.6L8 11.6 3.9 14l1.1-4.6-3.6-3L6.1 6 8 1.6Z"/></svg>`;
  }

  function externalIcon() {
    return `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  /* ---------------------------------------------------------
     Data
     --------------------------------------------------------- */
  function hydrateCurated(fullName) {
    const meta = state.live?.curated?.[fullName] || {};
    const slash = fullName.indexOf("/");
    const owner = slash >= 0 ? fullName.slice(0, slash) : fullName;
    const name = slash >= 0 ? fullName.slice(slash + 1) : "";
    return {
      fullName,
      owner,
      name,
      url: meta.url || `https://github.com/${fullName}`,
      description: meta.description || "",
      stars: Number(meta.stars) || 0,
      language: meta.language || "",
      pushedAt: meta.pushedAt || "",
      topics: Array.isArray(meta.topics) ? meta.topics : [],
      curated: true,
    };
  }

  function normalizeLive(repo) {
    const fullName = repo.fullName || "";
    const slash = fullName.indexOf("/");
    return {
      ...repo,
      fullName,
      owner: slash >= 0 ? fullName.slice(0, slash) : fullName,
      name: slash >= 0 ? fullName.slice(slash + 1) : "",
      url: repo.url || `https://github.com/${fullName}`,
      description: repo.description || "",
      stars: Number(repo.stars) || 0,
      language: repo.language || "",
      pushedAt: repo.pushedAt || "",
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      curated: Boolean(repo.curated),
    };
  }

  function getRepos(stage, mode) {
    if (mode === "curated") return stage.repos.map(hydrateCurated);
    const live = state.live?.stages?.[stage.id]?.[mode];
    if (Array.isArray(live) && live.length) return live.map(normalizeLive);
    // If the live snapshot is unavailable, keep the page useful with the
    // editorial shortlist rather than showing empty sections.
    return stage.repos.slice(0, 6).map(hydrateCurated);
  }

  function modeTotal(mode) {
    if (!state.curated) return 0;
    return state.curated.stages.reduce((sum, stage) => sum + getRepos(stage, mode).length, 0);
  }

  function matches(repo, query) {
    if (!query) return true;
    return `${repo.fullName} ${repo.description} ${repo.topics.join(" ")} ${repo.language}`
      .toLowerCase()
      .includes(query);
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */
  function renderAll() {
    if (!state.curated) return;
    renderSignalMap();
    renderStageNav();
    renderTicker();
    renderStages();
    updateSyncStatus();
    setActiveStage(state.curated.stages[0]?.id || null);
  }

  function renderSignalMap() {
    if (!signalList || !state.curated) return;
    const stages = state.curated.stages;
    const counts = stages.map((stage) => getRepos(stage, state.mode).length);
    const max = Math.max(...counts, 1);
    signalList.innerHTML = stages
      .map((stage, index) => {
        const count = counts[index];
        const width = Math.max(12, Math.round((count / max) * 100));
        return `<a class="signal-row" href="#stage-${escapeHtml(stage.id)}" style="--c:${escapeHtml(stage.color)}">
          <span class="signal-dot"></span>
          <span class="signal-name">${escapeHtml(stage.num)} · ${escapeHtml(stage.title)}</span>
          <span class="signal-count">${count} repos</span>
          <span class="signal-bar"><i style="width:${width}%"></i></span>
        </a>`;
      })
      .join("");
  }

  function renderStageNav() {
    if (!stageNav || !state.curated) return;
    stageNav.innerHTML = state.curated.stages
      .map(
        (stage) => `<a class="stage-pill" href="#stage-${escapeHtml(stage.id)}" data-stage-link="${escapeHtml(stage.id)}" style="--c:${escapeHtml(stage.color)}"><i></i>${escapeHtml(stage.short)}</a>`
      )
      .join("");
  }

  function renderTicker() {
    if (!tickerTrack || !state.curated) return;
    const colors = new Map();
    for (const stage of state.curated.stages) {
      for (const repo of stage.repos) colors.set(repo, stage.color);
    }

    let entries = [];
    if (state.live?.curated) {
      entries = Object.values(state.live.curated)
        .filter((repo) => repo && !repo.error && repo.fullName)
        .sort((a, b) => new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0))
        .slice(0, 12);
    }
    if (!entries.length) {
      const seen = new Set();
      for (const stage of state.curated.stages) {
        for (const full of stage.repos) {
          if (seen.has(full)) continue;
          seen.add(full);
          const repo = hydrateCurated(full);
          entries.push(repo);
          if (entries.length >= 12) break;
        }
        if (entries.length >= 12) break;
      }
    }

    const html = entries
      .map((repo) => {
        const color = colors.get(repo.fullName) || "#8B8CF7";
        return `<a class="ticker-item" href="${escapeHtml(safeUrl(repo.url, repo.fullName))}" target="_blank" rel="noopener noreferrer">
          <span class="ticker-dot" style="background:${escapeHtml(color)}"></span>
          <strong>${escapeHtml(repo.fullName)}</strong>
          <span class="tick-star">★ ${escapeHtml(formatStars(repo.stars))}</span>
          <span class="tick-time">${escapeHtml(relativeTime(repo.pushedAt))}</span>
        </a>`;
      })
      .join("");

    tickerTrack.innerHTML = html + html;
    tickerTrack.setAttribute("aria-hidden", "true");
  }

  function renderStages() {
    if (!stageList || !state.curated) return;
    const query = state.query;
    const stages = state.curated.stages;
    const sections = [];
    let matched = 0;

    for (const stage of stages) {
      let repos = getRepos(stage, state.mode);
      if (query) repos = repos.filter((repo) => matches(repo, query));
      if (query && !repos.length) continue;
      matched += repos.length;

      const isOpen = state.allExpanded || state.expanded.has(stage.id);
      const visible = query ? repos : isOpen ? repos : repos.slice(0, 4);
      const more = !query && !state.allExpanded && repos.length > 4
        ? `<button class="stage-more${isOpen ? " is-open" : ""}" type="button" data-stage-more="${escapeHtml(stage.id)}" aria-expanded="${isOpen}">
            <span>${isOpen ? "收起" : `显示全部 ${repos.length} 个`}</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5 8 10l4-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>`
        : "";

      sections.push(`<section class="stage-block" id="stage-${escapeHtml(stage.id)}" data-stage="${escapeHtml(stage.id)}" style="--c:${escapeHtml(stage.color)}">
        <div class="stage-head">
          <div class="stage-num-wrap"><span class="stage-num">${escapeHtml(stage.num)}</span><span class="stage-line"></span></div>
          <div class="stage-title">
            <h3>${escapeHtml(stage.title)}</h3>
            <p>${escapeHtml(stage.goal)}</p>
          </div>
          <div class="stage-aside"><span class="stage-count">${repos.length} 个${state.mode === "curated" ? "仓库" : "实时结果"}</span></div>
        </div>
        ${
          visible.length
            ? `<div class="repo-grid">${visible.map((repo, index) => repoCard(repo, index, stage, state.mode)).join("")}</div>`
            : `<p class="stage-empty">暂时没有实时结果。切换到“精选”查看该阶段的编辑推荐。</p>`
        }
        ${more}
      </section>`);
    }

    stageList.innerHTML = sections.join("");
    stageList.hidden = query ? matched === 0 : false;
    emptyState.hidden = !query || matched > 0;

    const total = modeTotal(state.mode);
    if (query) {
      resultsMeta.textContent = `找到 ${matched} 个匹配 · ${MODE_LABEL[state.mode]}`;
    } else {
      resultsMeta.textContent = `${MODE_LABEL[state.mode]} · ${stages.length} 个阶段 / ${total} 个仓库`;
    }
    resultsNote.textContent = `${MODE_NOTE[state.mode]}${state.live ? ` · ${formatDateShort(state.live.generatedAt)} 同步` : " · 快照"}`;

    const showToggle = !query && total > stages.length * 4;
    expandAllWrap.hidden = !showToggle;
    if (showToggle) {
      toggleAllText.textContent = state.allExpanded
        ? `收起全部 ${total} 个${MODE_LABEL[state.mode]}仓库`
        : `展开全部 ${total} 个${MODE_LABEL[state.mode]}仓库`;
      toggleAll.classList.toggle("is-open", state.allExpanded);
    }

    setupStageObserver();
  }

  function repoCard(repo, index, stage, mode) {
    const fullName = repo.fullName;
    const badge = badgeFor(repo, mode);
    const topics = repo.topics.slice(0, 3);
    const topicHtml = topics.length
      ? topics.map((topic) => `<span class="topic-chip">${escapeHtml(topic)}</span>`).join("")
      : `<span class="topic-chip stage-tag">${escapeHtml(stage.short)}</span>`;
    const language = repo.language
      ? `<span class="repo-lang"><i style="background:${escapeHtml(langColor(repo.language))}"></i>${escapeHtml(langLabel(repo.language))}</span>`
      : "";
    const updated = repo.pushedAt
      ? `<span class="repo-updated" data-pushed="${escapeHtml(repo.pushedAt)}">${escapeHtml(relativeTime(repo.pushedAt))}</span>`
      : "";

    return `<a class="repo-card" href="${escapeHtml(safeUrl(repo.url, fullName))}" target="_blank" rel="noopener noreferrer" style="--stage:${escapeHtml(stage.color)}" aria-label="${escapeHtml(fullName)} on GitHub">
      <div class="repo-top">
        <span class="repo-rank">#${String(index + 1).padStart(2, "0")}</span>
        <span class="repo-badge ${badge.className}">${badge.label}</span>
        <span class="repo-external">${externalIcon()}</span>
      </div>
      <h4 class="repo-name"><span>${escapeHtml(repo.owner)}/</span><strong>${escapeHtml(repo.name)}</strong></h4>
      <p class="repo-desc">${escapeHtml(repo.description || "暂无描述。点击打开 GitHub 查看 README。")}</p>
      <div class="repo-topics">${topicHtml}</div>
      <div class="repo-foot">
        <span class="repo-stat">${starIcon()}${escapeHtml(formatStars(repo.stars))}</span>
        ${language}
        ${updated}
      </div>
    </a>`;
  }

  function badgeFor(repo, mode) {
    if (mode === "curated") return { className: "curated", label: "精选" };
    if (repo.curated) return { className: "both", label: "精选" };
    if (mode === "hot") return { className: "hot", label: "热门" };
    return { className: "rising", label: "新锐" };
  }

  function updateSyncStatus() {
    if (!state.live) {
      syncStatus.classList.add("is-error");
      syncStatus.classList.remove("is-stale");
      syncText.textContent = "实时数据不可用 · 显示精选快照";
      heroSync.textContent = "snapshot";
      return;
    }
    const age = Date.now() - new Date(state.live.generatedAt).getTime();
    const stale = Number.isFinite(age) && age > 12 * 3600 * 1000;
    syncStatus.classList.toggle("is-stale", stale);
    syncStatus.classList.remove("is-error");
    const stats = state.live.stats || {};
    syncText.textContent = `${stale ? "数据可能已过期 · " : ""}更新于 ${formatDateTime(state.live.generatedAt)} · ${stats.curated || 100} curated / ${stats.hot || 0} hot / ${stats.rising || 0} rising`;
    heroSync.textContent = `更新于 ${relativeTime(state.live.generatedAt)}`;
    buildDate.textContent = formatDateShort(state.live.generatedAt);
  }

  function updateTimes() {
    document.querySelectorAll("[data-pushed]").forEach((el) => {
      el.textContent = relativeTime(el.dataset.pushed);
    });
    if (state.live) heroSync.textContent = `更新于 ${relativeTime(state.live.generatedAt)}`;
  }

  function setActiveStage(id) {
    if (!id) return;
    state.activeStage = id;
    document.querySelectorAll("[data-stage-link]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.stageLink === id);
    });
  }

  function setupStageObserver() {
    if (stageObserver) stageObserver.disconnect();
    const blocks = [...document.querySelectorAll(".stage-block")];
    if (!blocks.length) return;
    stageObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveStage(visible[0].target.dataset.stage);
      },
      { rootMargin: "-160px 0px -62% 0px", threshold: 0 }
    );
    blocks.forEach((block) => stageObserver.observe(block));
  }

  /* ---------------------------------------------------------
     Loading
     --------------------------------------------------------- */
  async function loadData(manual = false) {
    if (state.loading) return;
    state.loading = true;
    if (manual) refreshBtn.classList.add("is-spinning");
    if (!state.curated) syncText.textContent = "正在读取数据…";

    try {
      const cRes = await fetch(`data/curated.json${manual ? `?t=${Date.now()}` : ""}`, {
        cache: manual ? "no-store" : "default",
      });
      if (!cRes.ok) throw new Error(`curated.json ${cRes.status}`);
      state.curated = await cRes.json();

      state.live = null;
      try {
        const lRes = await fetch(`data/live.json?t=${Date.now()}`, { cache: "no-store" });
        if (lRes.ok) state.live = await lRes.json();
      } catch {
        state.live = null;
      }

      renderAll();
      if (manual) {
        showToast(state.live ? `已刷新 · 数据同步于 ${formatDateTime(state.live.generatedAt)}` : "已刷新 · 实时数据暂不可用");
      }
    } catch (err) {
      console.error(err);
      syncStatus.classList.add("is-error");
      syncText.textContent = "数据加载失败";
      if (!state.curated) {
        stageList.innerHTML = `<div class="empty-state"><span class="empty-mark">!</span><h3>数据加载失败</h3><p>请检查 data/curated.json 是否可访问，或稍后重试。</p><button class="btn btn-ghost" type="button" onclick="location.reload()">重新加载</button></div>`;
      }
      showToast("数据加载失败，请稍后重试");
    } finally {
      state.loading = false;
      refreshBtn.classList.remove("is-spinning");
    }
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */
  function setMode(mode) {
    if (!["curated", "hot", "rising"].includes(mode)) return;
    state.mode = mode;
    state.allExpanded = false;
    state.expanded.clear();
    localStorage.setItem("al-mode", mode);
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderSignalMap();
    renderStages();
  }

  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value.trim().toLowerCase();
      renderStages();
    }, 110);
  });

  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    state.query = "";
    renderStages();
    searchInput.focus();
  });

  refreshBtn.addEventListener("click", () => loadData(true));

  toggleAll.addEventListener("click", () => {
    state.allExpanded = !state.allExpanded;
    state.expanded.clear();
    const y = window.scrollY;
    renderStages();
    window.scrollTo(0, y);
  });

  stageList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage-more]");
    if (!button) return;
    const id = button.dataset.stageMore;
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    const y = window.scrollY;
    renderStages();
    window.scrollTo(0, y);
  });

  stageNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-stage-link]");
    if (!link) return;
    event.preventDefault();
    const id = link.dataset.stageLink;
    setActiveStage(id);
    document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#stage-${id}`);
  });

  menuBtn.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) return;
    if (siteNav.contains(event.target) || menuBtn.contains(event.target)) return;
    siteNav.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      state.query = "";
      renderStages();
      searchInput.blur();
    }
  });

  window.addEventListener(
    "scroll",
    () => document.getElementById("siteHeader").classList.toggle("is-scrolled", window.scrollY > 8),
    { passive: true }
  );

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  const validMode = ["curated", "hot", "rising"].includes(state.mode) ? state.mode : "curated";
  state.mode = validMode;
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const active = tab.dataset.mode === state.mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  setInterval(updateTimes, 60 * 1000);
  setInterval(() => loadData(false), 15 * 60 * 1000);

  loadData(false);
})();
