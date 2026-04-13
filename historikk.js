const SUPABASE_URL = "https://wljgcwxoevnbnaauzrrk.supabase.co";
const SUPABASE_KEY = "sb_publishable_1u_6ELWHXiN7J1LvG2qLvQ_AI-kojbJ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const historyList = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");
const historyPagination = document.getElementById("historyPagination");
const historyPersonFilter = document.getElementById("historyPersonFilter");
const historyActionFilter = document.getElementById("historyActionFilter");
const historySearchInput = document.getElementById("historySearchInput");
const historyActivePerson = document.getElementById("historyActivePerson");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

const ITEMS_PER_PAGE = 50;
const HISTORY_FILTER_STORAGE_KEY = "vedogskog_historikk_filters_v2";

let allChanges = [];
let currentHistoryPage = 1;
let expandedChangeId = null;
let currentActorName = "";
let hasRestoredHistoryFilters = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateNorwegian(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateTimeNorwegian(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTimeOnly(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function dateKeyToDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function createdAtToDateKey(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateGroupHeading(dateKey) {
  const label = dateKeyToDate(dateKey).toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatStkDisplay(value) {
  const sixths = Math.round(Number(value || 0) * 6);

  if (!sixths) return "0 stk";

  const whole = Math.floor(sixths / 6);
  const remainder = sixths % 6;
  const fractionMap = {
    1: "1/6",
    2: "1/3",
    3: "1/2",
    4: "2/3",
    5: "5/6"
  };

  const parts = [];

  if (whole > 0) parts.push(String(whole));
  if (remainder > 0) parts.push(fractionMap[remainder]);

  return `${parts.join(" ")} stk`;
}

function formatValue(entry) {
  if (!entry) return "-";

  if (entry.enhet === "timer") {
    const totalMinutes = Math.round(Number(entry.mengde || 0) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours} t`;
    return `${hours} t ${minutes} min`;
  }

  if (entry.enhet === "stk") {
    return formatStkDisplay(entry.mengde || 0);
  }

  return `${entry.mengde} ${entry.enhet}`;
}

function getPersonClass(name) {
  if (name === "Tord") return "tord";
  if (name === "Tobias") return "tobias";
  if (name === "Johannes") return "johannes";
  if (name === "Alle") return "all-logged";
  return "";
}

function getActionLabel(action) {
  if (action === "created") return "Opprettet";
  if (action === "updated") return "Endret";
  if (action === "deleted") return "Slettet";
  if (action === "restored") return "Gjenopprettet";
  return "Ukjent";
}

function getActionBadgeText(action) {
  return getActionLabel(action).toUpperCase();
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function getSavedHistoryFilters() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_FILTER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveHistoryFilters() {
  const payload = {
    person: historyPersonFilter?.value || "Alle",
    action: historyActionFilter?.value || "Alle",
    search: historySearchInput?.value || ""
  };

  localStorage.setItem(HISTORY_FILTER_STORAGE_KEY, JSON.stringify(payload));
}

function restoreHistoryFilters() {
  const saved = getSavedHistoryFilters();
  if (!saved) return;

  if (historyPersonFilter) {
    const exists = [...historyPersonFilter.options].some((option) => option.value === saved.person);
    historyPersonFilter.value = exists ? saved.person : "Alle";
  }

  if (historyActionFilter) {
    const exists = [...historyActionFilter.options].some((option) => option.value === saved.action);
    historyActionFilter.value = exists ? saved.action : "Alle";
  }

  if (historySearchInput) {
    historySearchInput.value = saved.search || "";
  }
}

function getSearchTextForChange(change) {
  const snapshot = change.snapshot || {};

  return normalizeText([
    snapshot.kategori || "",
    snapshot.dato || "",
    formatDateNorwegian(snapshot.dato || ""),
    change.created_at || "",
    formatDateTimeNorwegian(change.created_at || ""),
    getActionLabel(change.action || ""),
    snapshot.navn || ""
  ].join(" "));
}

function getFilteredChanges() {
  const searchValue = normalizeText(historySearchInput?.value || "");

  return allChanges.filter((change) => {
    const snapshot = change.snapshot || {};

    const personMatch =
      historyPersonFilter.value === "Alle" || snapshot.navn === historyPersonFilter.value;

    const actionMatch =
      historyActionFilter.value === "Alle" || change.action === historyActionFilter.value;

    const searchMatch =
      !searchValue || getSearchTextForChange(change).includes(searchValue);

    return personMatch && actionMatch && searchMatch;
  });
}

function renderActivePersonIndicator() {
  if (!historyActivePerson) return;

  const selectedPerson = historyPersonFilter.value;
  const personClass = getPersonClass(selectedPerson);

  if (selectedPerson === "Alle") {
    historyActivePerson.innerHTML = `
      <div class="personBadge all">
        <span class="compactPersonDot all-logged"></span>
        <span>Viser alle personer</span>
      </div>
    `;
    return;
  }

  historyActivePerson.innerHTML = `
    <div class="personBadge">
      <span class="compactPersonDot ${personClass}"></span>
      <span>Valgt person: ${escapeHtml(selectedPerson)}</span>
    </div>
  `;
}

function getVisiblePages(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

function renderHistoryPagination(totalPages) {
  if (!historyPagination) return;

  if (totalPages <= 1) {
    historyPagination.innerHTML = "";
    return;
  }

  const pages = getVisiblePages(totalPages, currentHistoryPage);

  historyPagination.innerHTML = `
    <button type="button" class="page-btn" ${currentHistoryPage === 1 ? "disabled" : ""} onclick="window.goToHistoryPage(${currentHistoryPage - 1})">Forrige</button>
    ${pages.map((page) =>
      page === "..."
        ? `<span class="page-dots">...</span>`
        : `<button type="button" class="page-btn ${page === currentHistoryPage ? "active" : ""}" onclick="window.goToHistoryPage(${page})">${page}</button>`
    ).join("")}
    <button type="button" class="page-btn" ${currentHistoryPage === totalPages ? "disabled" : ""} onclick="window.goToHistoryPage(${currentHistoryPage + 1})">Neste</button>
  `;
}

function getChangeId(change) {
  if (change?.id !== undefined && change?.id !== null) {
    return String(change.id);
  }

  const snapshot = change?.snapshot || {};
  return [
    change?.created_at || "",
    change?.action || "",
    snapshot.navn || "",
    snapshot.kategori || "",
    snapshot.dato || "",
    snapshot.enhet || "",
    snapshot.mengde || ""
  ].join("__");
}

window.goToHistoryPage = function(page) {
  const filtered = getFilteredChanges();
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  currentHistoryPage = Math.min(Math.max(1, page), totalPages);
  expandedChangeId = null;
  renderHistory();

  if (historyList) {
    historyList.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

function createHistorySummaryText(change) {
  const snapshot = change.snapshot || {};
  const personName = snapshot.navn || "-";
  const category = snapshot.kategori || "-";
  const dateLabel = snapshot.dato ? formatDateNorwegian(snapshot.dato) : "-";
  const valueLabel = snapshot.enhet ? formatValue(snapshot) : "-";

  return {
    personName,
    category,
    dateLabel,
    valueLabel
  };
}

function getOptionalBeforeSnapshot(change) {
  return (
    change.before_snapshot ||
    change.previous_snapshot ||
    change.old_snapshot ||
    null
  );
}

function getOptionalAfterSnapshot(change) {
  return (
    change.after_snapshot ||
    change.current_snapshot ||
    change.new_snapshot ||
    null
  );
}

function createHistoryDetailsHtml(change) {
  const snapshot = change.snapshot || {};
  const actor = change.created_by || snapshot.opprettet_av || snapshot.navn || "-";
  const beforeSnapshot = getOptionalBeforeSnapshot(change);
  const afterSnapshot = getOptionalAfterSnapshot(change);

  const detailRows = [
    { label: "Handling", value: getActionLabel(change.action) },
    { label: "Tidspunkt", value: formatDateTimeNorwegian(change.created_at) || "-" },
    { label: "Person", value: snapshot.navn || "-" },
    { label: "Kategori", value: snapshot.kategori || "-" },
    { label: "Registreringsdato", value: snapshot.dato ? formatDateNorwegian(snapshot.dato) : "-" },
    { label: "Verdi", value: snapshot.enhet ? formatValue(snapshot) : "-" },
    { label: "Kommentar", value: snapshot.kommentar || "-" },
    { label: "Logget av", value: actor || "-" }
  ];

  if (beforeSnapshot?.enhet) {
    detailRows.push({ label: "Fra", value: formatValue(beforeSnapshot) });
  }

  if (afterSnapshot?.enhet) {
    detailRows.push({ label: "Til", value: formatValue(afterSnapshot) });
  }

  const restoreButton = change.action === "deleted"
    ? `
      <div class="historyLogActionRow">
        <button type="button" class="secondary historyRestoreBtn">Gjenopprett post</button>
      </div>
    `
    : "";

  return `
    <div class="historyLogDetailsInner">
      <div class="historyLogDetailGrid">
        ${detailRows.map((row) => `
          <div class="historyLogDetailItem">
            <span class="historyLogDetailLabel">${escapeHtml(row.label)}</span>
            <strong class="historyLogDetailValue">${escapeHtml(row.value)}</strong>
          </div>
        `).join("")}
      </div>
      ${restoreButton}
    </div>
  `;
}

function createHistoryRow(change) {
  const snapshot = change.snapshot || {};
  const personClass = getPersonClass(snapshot.navn || "-");
  const changeId = getChangeId(change);
  const isOpen = expandedChangeId === changeId;
  const summary = createHistorySummaryText(change);

  const wrapper = document.createElement("div");
  wrapper.className = `historyLogItem ${isOpen ? "open" : ""}`;

  wrapper.innerHTML = `
    <button
      type="button"
      class="historyLogRow"
      aria-expanded="${isOpen ? "true" : "false"}"
    >
      <span class="historyLogTime">${escapeHtml(formatTimeOnly(change.created_at))}</span>

      <span class="historyLogMain">
        <span class="historyLogPerson">
          <span class="compactPersonDot ${personClass}"></span>
          ${escapeHtml(summary.personName)}
        </span>

        <span class="historyLogText">
          ${escapeHtml(summary.category)} · ${escapeHtml(summary.dateLabel)} · ${escapeHtml(summary.valueLabel)}
        </span>
      </span>

      <span class="historyTag historyTag--compact ${change.action || ""}">
        ${escapeHtml(getActionBadgeText(change.action))}
      </span>
    </button>

    <div class="historyLogDetails ${isOpen ? "open" : ""}">
      ${createHistoryDetailsHtml(change)}
    </div>
  `;

  const rowButton = wrapper.querySelector(".historyLogRow");
  const restoreBtn = wrapper.querySelector(".historyRestoreBtn");

  rowButton.addEventListener("click", () => {
    expandedChangeId = isOpen ? null : changeId;
    renderHistory();
  });

  if (restoreBtn) {
    restoreBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await restoreDeletedEntry(changeId);
    });
  }

  return wrapper;
}

function groupChangesByCreatedDate(changes) {
  const groups = [];

  changes.forEach((change) => {
    const dateKey = createdAtToDateKey(change.created_at);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.dateKey !== dateKey) {
      groups.push({
        dateKey,
        items: [change]
      });
      return;
    }

    lastGroup.items.push(change);
  });

  return groups;
}

async function loadCurrentActorName() {
  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;

    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    currentActorName = profile?.full_name || sessionData.session.user.email || "";
  } catch (error) {
    console.error("Kunne ikke hente aktiv bruker for historikk:", error);
  }
}

async function restoreDeletedEntry(changeId) {
  const change = allChanges.find((item) => getChangeId(item) === String(changeId));
  if (!change || change.action !== "deleted") return;

  const snapshot = change.snapshot || {};
  const entryId = change.entry_id || snapshot.id;

  if (!entryId) {
    alert("Fant ikke posten som skal gjenopprettes.");
    return;
  }

  const confirmed = confirm("Vil du gjenopprette denne posten?");
  if (!confirmed) return;

  const { data: existingEntry, error: existingEntryError } = await supabaseClient
    .from("entries")
    .select("id, is_deleted")
    .eq("id", entryId)
    .maybeSingle();

  if (existingEntryError) {
    alert("Feil ved oppslag før gjenoppretting: " + existingEntryError.message);
    return;
  }

  if (existingEntry && existingEntry.is_deleted === false) {
    alert("Posten er allerede aktiv.");
    return;
  }

  const restorePayload = {
    navn: snapshot.navn,
    kategori: snapshot.kategori,
    dato: snapshot.dato,
    enhet: snapshot.enhet,
    mengde: snapshot.mengde,
    opprettet_av: snapshot.opprettet_av || currentActorName || change.created_by || snapshot.navn || null,
    is_deleted: false
  };

  let restoreError = null;

  if (existingEntry) {
    const { error } = await supabaseClient
      .from("entries")
      .update(restorePayload)
      .eq("id", entryId);

    restoreError = error;
  } else {
    const { error } = await supabaseClient
      .from("entries")
      .insert([{
        id: entryId,
        ...restorePayload
      }]);

    restoreError = error;
  }

  if (restoreError) {
    alert("Feil ved gjenoppretting: " + restoreError.message);
    return;
  }

  const restoredSnapshot = {
    ...snapshot,
    ...restorePayload,
    id: entryId,
    is_deleted: false
  };

  const { error: historyError } = await supabaseClient
    .from("entry_changes")
    .insert([{
      entry_id: entryId,
      action: "restored",
      snapshot: restoredSnapshot,
      created_by: currentActorName || change.created_by || snapshot.opprettet_av || snapshot.navn || null
    }]);

  if (historyError) {
    alert("Posten ble gjenopprettet, men historikkinnslaget kunne ikke lagres: " + historyError.message);
    await loadHistory();
    return;
  }

  alert("Post gjenopprettet.");
  await loadHistory();
}

function renderHistory() {
  saveHistoryFilters();

  const filtered = getFilteredChanges();
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  if (currentHistoryPage > totalPages) {
    currentHistoryPage = totalPages;
  }

  const startIndex = (currentHistoryPage - 1) * ITEMS_PER_PAGE;
  const pagedChanges = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  historyCount.textContent =
    `Viser ${pagedChanges.length} av ${filtered.length} filtrerte endringer (${allChanges.length} totalt)`;

  if (!pagedChanges.length) {
    historyList.innerHTML = `<p class="empty">Ingen endringer funnet.</p>`;
    historyPagination.innerHTML = "";
    return;
  }

  const groups = groupChangesByCreatedDate(pagedChanges);

  historyList.innerHTML = groups.map((group) => `
    <section class="historyDateGroup">
      <div class="historyDateHeading">${escapeHtml(formatDateGroupHeading(group.dateKey))}</div>
      <div class="historyDateItems" data-date-group="${escapeHtml(group.dateKey)}"></div>
    </section>
  `).join("");

  const groupContainers = historyList.querySelectorAll(".historyDateItems");

  groups.forEach((group, index) => {
    const container = groupContainers[index];
    if (!container) return;

    group.items.forEach((change) => {
      container.appendChild(createHistoryRow(change));
    });
  });

  renderHistoryPagination(totalPages);
}

async function loadHistory() {
  const { data, error } = await supabaseClient
    .from("entry_changes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    historyList.innerHTML = `<p class="empty">Feil ved henting av historikk: ${escapeHtml(error.message)}</p>`;
    historyCount.textContent = "";
    historyPagination.innerHTML = "";
    return;
  }

  allChanges = data || [];
  currentHistoryPage = 1;
  expandedChangeId = null;

  if (!hasRestoredHistoryFilters) {
    restoreHistoryFilters();
    hasRestoredHistoryFilters = true;
  }

  renderActivePersonIndicator();
  renderHistory();
}

function resetToFirstPageAndRender() {
  currentHistoryPage = 1;
  expandedChangeId = null;
  renderActivePersonIndicator();
  renderHistory();
}

historyPersonFilter?.addEventListener("change", resetToFirstPageAndRender);
historyActionFilter?.addEventListener("change", resetToFirstPageAndRender);
historySearchInput?.addEventListener("input", resetToFirstPageAndRender);
refreshHistoryBtn?.addEventListener("click", loadHistory);

loadCurrentActorName();
loadHistory();