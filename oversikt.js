const SUPABASE_URL = "https://wljgcwxoevnbnaauzrrk.supabase.co";
const SUPABASE_KEY = "sb_publishable_1u_6ELWHXiN7J1LvG2qLvQ_AI-kojbJ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const filterPerson = document.getElementById("filterPerson");
const filterYear = document.getElementById("filterYear");
const filterMonth = document.getElementById("filterMonth");
const filterKategori = document.getElementById("filterKategori");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");

const overviewKpiTitle = document.getElementById("overviewKpiTitle");
const overviewKpis = document.getElementById("overviewKpis");

const summaryCards = document.getElementById("summaryCards");
const monthlySummary = document.getElementById("monthlySummary");
const entriesList = document.getElementById("entriesList");
const entriesPagination = document.getElementById("entriesPagination");

const summaryTitle = document.getElementById("summaryTitle");
const monthlyTitle = document.getElementById("monthlyTitle");
const registreringerTitle = document.getElementById("registreringerTitle");

const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");

const toggleSelectModeBtn = document.getElementById("toggleSelectModeBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const selectedCount = document.getElementById("selectedCount");

const ITEMS_PER_PAGE = 25;
const OVERVIEW_FILTER_STORAGE_KEY = "vedogskog_oversikt_filters_v2";

let allEntries = [];
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let currentEntriesPage = 1;
let selectedEntryIds = new Set();
let selectionMode = false;
let hasInitializedFilters = false;

function formatDateNorwegian(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

function getMonthName(month) {
  const names = {
    "01": "Januar",
    "02": "Februar",
    "03": "Mars",
    "04": "April",
    "05": "Mai",
    "06": "Juni",
    "07": "Juli",
    "08": "August",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Desember"
  };
  return names[month] || month;
}

function getNorwegianMonthName(monthIndex) {
  const names = [
    "Januar", "Februar", "Mars", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Desember"
  ];
  return names[monthIndex];
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

function formatCategoryTotal(value, unit) {
  if (unit === "timer") {
    const totalMinutes = Math.round(Number(value || 0) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours} t`;
    return `${hours} t ${minutes} min`;
  }

  if (unit === "stk") {
    return formatStkDisplay(value);
  }

  return `${value} ${unit}`;
}

function populateYearFilter(entries) {
  const years = [...new Set(entries.map((entry) => entry.dato.slice(0, 4)))]
    .sort((a, b) => b.localeCompare(a));

  filterYear.innerHTML = `<option value="Alle">Alle</option>`;

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    filterYear.appendChild(option);
  });
}

function applyFilters(entries) {
  return entries.filter((entry) => {
    const year = entry.dato.slice(0, 4);
    const month = entry.dato.slice(5, 7);

    const personMatch = filterPerson.value === "Alle" || entry.navn === filterPerson.value;
    const yearMatch = filterYear.value === "Alle" || year === filterYear.value;
    const monthMatch = filterMonth.value === "Alle" || month === filterMonth.value;
    const categoryMatch = filterKategori.value === "Alle" || entry.kategori === filterKategori.value;

    return personMatch && yearMatch && monthMatch && categoryMatch;
  });
}

function getCalendarDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function getPersonClass(name) {
  if (name === "Tord") return "tord";
  if (name === "Tobias") return "tobias";
  if (name === "Johannes") return "johannes";
  return "";
}

function getFilteredEntries() {
  return applyFilters(allEntries);
}

function getEntriesForSelectedScope() {
  const filteredEntries = getFilteredEntries();

  if (selectedCalendarDate) {
    return filteredEntries.filter((entry) => entry.dato === selectedCalendarDate);
  }

  return filteredEntries;
}

function setSelectValueIfExists(selectEl, value, fallback = "Alle") {
  if (!selectEl) return;
  const exists = [...selectEl.options].some((option) => option.value === value);
  selectEl.value = exists ? value : fallback;
}

function getSavedOverviewFilters() {
  try {
    return JSON.parse(localStorage.getItem(OVERVIEW_FILTER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveOverviewFilters() {
  const payload = {
    person: filterPerson.value,
    year: filterYear.value,
    month: filterMonth.value,
    kategori: filterKategori.value
  };

  localStorage.setItem(OVERVIEW_FILTER_STORAGE_KEY, JSON.stringify(payload));
}

function restoreOverviewFilters() {
  const saved = getSavedOverviewFilters();
  if (!saved) return false;

  setSelectValueIfExists(filterPerson, saved.person || "Alle");
  setSelectValueIfExists(filterYear, saved.year || "Alle");
  setSelectValueIfExists(filterMonth, saved.month || "Alle");
  setSelectValueIfExists(filterKategori, saved.kategori || "Alle");

  return true;
}

function updateSectionTitles() {
  if (selectedCalendarDate) {
    const niceDate = formatDateNorwegian(selectedCalendarDate);
    registreringerTitle.textContent = `Registreringer – ${niceDate}`;
    summaryTitle.textContent = `Summer per kategori – ${niceDate}`;
    monthlyTitle.textContent = `Månedlig oversikt – ${niceDate}`;
    if (overviewKpiTitle) overviewKpiTitle.textContent = `Nøkkeltall – ${niceDate}`;
    return;
  }

  if (filterYear.value !== "Alle" && filterMonth.value !== "Alle") {
    const monthName = getMonthName(filterMonth.value);
    registreringerTitle.textContent = `Registreringer – ${monthName} ${filterYear.value}`;
    summaryTitle.textContent = `Summer per kategori – ${monthName} ${filterYear.value}`;
    monthlyTitle.textContent = `Månedlig oversikt – ${monthName} ${filterYear.value}`;
    if (overviewKpiTitle) overviewKpiTitle.textContent = `Nøkkeltall – ${monthName} ${filterYear.value}`;
    return;
  }

  registreringerTitle.textContent = "Registreringer";
  summaryTitle.textContent = "Summer per kategori";
  monthlyTitle.textContent = "Månedlig oversikt";
  if (overviewKpiTitle) overviewKpiTitle.textContent = "Nøkkeltall";
}

function renderOverviewKpis(entries) {
  if (!overviewKpis) return;

  const totals = {
    timer: 0,
    km: 0,
    stk: 0
  };

  entries.forEach((entry) => {
    if (entry.enhet === "timer") totals.timer += Number(entry.mengde || 0);
    if (entry.enhet === "km") totals.km += Number(entry.mengde || 0);
    if (entry.enhet === "stk") totals.stk += Number(entry.mengde || 0);
  });

  const cards = [
    {
      label: "Timer totalt",
      value: formatCategoryTotal(totals.timer, "timer"),
      icon: "⏱️"
    },
    {
      label: "Km totalt",
      value: formatCategoryTotal(totals.km, "km"),
      icon: "🚗"
    },
    {
      label: "Leveringer totalt",
      value: formatCategoryTotal(totals.stk, "stk"),
      icon: "🪵"
    }
  ];

  overviewKpis.innerHTML = cards.map((card) => `
    <div class="overviewKpiCard">
      <div class="overviewKpiTop">
        <span class="overviewKpiIcon">${card.icon}</span>
        <span class="overviewKpiLabel">${card.label}</span>
      </div>
      <div class="overviewKpiValue">${card.value}</div>
    </div>
  `).join("");
}

function renderSummary(entries) {
  if (!entries.length) {
    summaryCards.innerHTML = `<p class="empty">Ingen data for valgt filter.</p>`;
    return;
  }

  const grouped = {};

  entries.forEach((entry) => {
    const key = `${entry.kategori}__${entry.enhet}`;

    if (!grouped[key]) {
      grouped[key] = {
        kategori: entry.kategori,
        enhet: entry.enhet,
        total: 0
      };
    }

    grouped[key].total += Number(entry.mengde || 0);
  });

  const values = Object.values(grouped).sort((a, b) => a.kategori.localeCompare(b.kategori));

  summaryCards.innerHTML = `
    <div class="month-card month-card--summary">
      ${values.map((item) => `
        <div class="month-row month-row--pop">
          <span class="month-row-label">${item.kategori}</span>
          <strong class="month-row-value">${formatCategoryTotal(item.total, item.enhet)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMonthlySummary(entries) {
  if (!entries.length) {
    monthlySummary.innerHTML = `<p class="empty">Ingen månedssummer å vise.</p>`;
    return;
  }

  const grouped = {};

  entries.forEach((entry) => {
    const year = entry.dato.slice(0, 4);
    const month = entry.dato.slice(5, 7);
    const monthKey = `${year}-${month}`;
    const categoryKey = `${entry.kategori}__${entry.enhet}`;

    if (!grouped[monthKey]) grouped[monthKey] = {};

    if (!grouped[monthKey][categoryKey]) {
      grouped[monthKey][categoryKey] = {
        kategori: entry.kategori,
        enhet: entry.enhet,
        total: 0
      };
    }

    grouped[monthKey][categoryKey].total += Number(entry.mengde || 0);
  });

  const sortedMonthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  monthlySummary.innerHTML = sortedMonthKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-");
    const items = Object.values(grouped[monthKey]).sort((a, b) => a.kategori.localeCompare(b.kategori));

    return `
      <div class="month-card month-card--pop">
        <h3 class="month-card-title">${getMonthName(month)} ${year}</h3>
        ${items.map((item) => `
          <div class="month-row month-row--pop">
            <span class="month-row-label">${item.kategori}</span>
            <strong class="month-row-value">${formatCategoryTotal(item.total, item.enhet)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
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

function renderEntriesPagination(totalPages) {
  if (!entriesPagination) return;

  if (totalPages <= 1) {
    entriesPagination.innerHTML = "";
    return;
  }

  const pages = getVisiblePages(totalPages, currentEntriesPage);

  entriesPagination.innerHTML = `
    <button type="button" class="page-btn" ${currentEntriesPage === 1 ? "disabled" : ""} onclick="window.goToEntriesPage(${currentEntriesPage - 1})">Forrige</button>
    ${pages.map((page) =>
      page === "..."
        ? `<span class="page-dots">...</span>`
        : `<button type="button" class="page-btn ${page === currentEntriesPage ? "active" : ""}" onclick="window.goToEntriesPage(${page})">${page}</button>`
    ).join("")}
    <button type="button" class="page-btn" ${currentEntriesPage === totalPages ? "disabled" : ""} onclick="window.goToEntriesPage(${currentEntriesPage + 1})">Neste</button>
  `;
}

window.goToEntriesPage = function(page) {
  const scopeEntries = getEntriesForSelectedScope();
  const totalPages = Math.max(1, Math.ceil(scopeEntries.length / ITEMS_PER_PAGE));

  currentEntriesPage = Math.min(Math.max(1, page), totalPages);
  renderAll();

  if (entriesList) {
    entriesList.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

function updateSelectionUi() {
  if (selectedCount) {
    selectedCount.textContent = `${selectedEntryIds.size} valgt`;
  }

  if (toggleSelectModeBtn) {
    toggleSelectModeBtn.textContent = selectionMode ? "Ferdig" : "Marker";
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.classList.toggle("hidden", !selectionMode);
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.classList.toggle("hidden", !selectionMode);
  }
}

function renderCompactEntryCard(entry) {
  const card = document.createElement("div");
  card.className = "entry-card compact-entry-button";

  if (selectedEntryIds.has(entry.id)) {
    card.classList.add("selected-entry");
  }

  const personClass = getPersonClass(entry.navn);

  card.innerHTML = `
    <div class="compactEntryInner">
      <span class="compactPersonDot ${personClass}"></span>
      <div class="compactEntryValue">${formatValue(entry)}</div>
    </div>
  `;

  card.addEventListener("click", () => {
    if (selectionMode) {
      if (selectedEntryIds.has(entry.id)) {
        selectedEntryIds.delete(entry.id);
      } else {
        selectedEntryIds.add(entry.id);
      }

      updateSelectionUi();
      renderAll();
      return;
    }

    openEntryModal(entry);
  });

  return card;
}

function renderEntries(entries) {
  if (!entries.length) {
    entriesList.innerHTML = `<p class="empty">Ingen registreringer funnet.</p>`;
    if (entriesPagination) entriesPagination.innerHTML = "";
    updateSelectionUi();
    return;
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.dato === b.dato) return String(b.id).localeCompare(String(a.id));
    return b.dato.localeCompare(a.dato);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  if (currentEntriesPage > totalPages) currentEntriesPage = totalPages;

  const startIndex = (currentEntriesPage - 1) * ITEMS_PER_PAGE;
  const pagedEntries = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  entriesList.innerHTML = "";

  pagedEntries.forEach((entry) => {
    entriesList.appendChild(renderCompactEntryCard(entry));
  });

  renderEntriesPagination(totalPages);
  updateSelectionUi();
}

async function deleteEntry(id) {
  const confirmed = confirm("Er du sikker på at du vil slette denne posten?");
  if (!confirmed) return;

  const { data: existing } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabaseClient
    .from("entries")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) {
    alert("Feil ved sletting: " + error.message);
    return;
  }

  if (existing) {
    await supabaseClient
      .from("entry_changes")
      .insert([{
        entry_id: existing.id,
        action: "deleted",
        snapshot: existing,
        created_by: existing.opprettet_av || null
      }]);
  }

  closeEntryModal();
  alert("Post slettet");
  await loadEntries();
}

async function bulkDeleteSelected() {
  const ids = [...selectedEntryIds];

  if (!ids.length) {
    alert("Velg minst én registrering først.");
    return;
  }

  const confirmed = confirm(`Er du sikker på at du vil slette ${ids.length} registreringer?`);
  if (!confirmed) return;

  const entriesToDelete = allEntries.filter((entry) => ids.includes(entry.id));

  const { error } = await supabaseClient
    .from("entries")
    .update({ is_deleted: true })
    .in("id", ids);

  if (error) {
    alert("Feil ved massesletting: " + error.message);
    return;
  }

  if (entriesToDelete.length) {
    await supabaseClient
      .from("entry_changes")
      .insert(
        entriesToDelete.map((entry) => ({
          entry_id: entry.id,
          action: "deleted",
          snapshot: entry,
          created_by: entry.opprettet_av || null
        }))
      );
  }

  selectedEntryIds.clear();
  selectionMode = false;
  updateSelectionUi();
  closeEntryModal();
  alert(`${ids.length} poster slettet`);
  await loadEntries();
}

function goToEdit(entry) {
  const params = new URLSearchParams({
    edit: String(entry.id),
    dato: entry.dato,
    kategori: entry.kategori,
    enhet: entry.enhet
  });

  window.location.href = `index.html?${params.toString()}`;
}

function renderCalendar() {
  const filteredEntries = getFilteredEntries();
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  calendarMonthLabel.textContent = `${getNorwegianMonthName(month)} ${year}`;
  calendarGrid.innerHTML = "";

  const weekdays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  weekdays.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "calendarWeekday";
    cell.textContent = day;
    calendarGrid.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let firstWeekday = firstDay.getDay();
  if (firstWeekday === 0) firstWeekday = 7;

  for (let i = 1; i < firstWeekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendarDay emptyCell";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = getCalendarDateKey(year, month, day);
    const dayEntries = filteredEntries.filter((entry) => entry.dato === dateKey);
    const people = [...new Set(dayEntries.map((entry) => entry.navn))];

    const cell = document.createElement("div");
    cell.className = "calendarDay";

    if (selectedCalendarDate === dateKey) {
      cell.classList.add("selected");
    }

    if (people.length === 3) {
      cell.classList.add("all-logged");
    }

    cell.innerHTML = `
      <div class="calendarDayNumber">${day}</div>
      <div class="calendarMarkers">
        ${
          people.length === 3
            ? `<span class="calendarMarker all-logged"></span>`
            : people.map((person) => `<span class="calendarMarker ${getPersonClass(person)}"></span>`).join("")
        }
      </div>
    `;

    cell.addEventListener("click", () => {
      selectedCalendarDate = dateKey;
      currentEntriesPage = 1;
      renderAll();
    });

    calendarGrid.appendChild(cell);
  }
}

function syncCalendarToFilters() {
  const selectedYear = filterYear.value;
  const selectedMonth = filterMonth.value;

  let year = currentCalendarDate.getFullYear();
  let month = currentCalendarDate.getMonth();

  if (selectedYear !== "Alle") {
    year = Number(selectedYear);
  }

  if (selectedMonth !== "Alle") {
    month = Number(selectedMonth) - 1;
  }

  currentCalendarDate = new Date(year, month, 1);
}

function clearSelectedDayIfOutsideFilters() {
  if (!selectedCalendarDate) return;

  const filteredEntries = getFilteredEntries();
  const exists = filteredEntries.some((entry) => entry.dato === selectedCalendarDate);

  if (!exists) {
    selectedCalendarDate = null;
  }
}

function renderAll() {
  const scopeEntries = getEntriesForSelectedScope();
  const filteredEntries = getFilteredEntries();

  updateSectionTitles();
  renderOverviewKpis(scopeEntries);
  renderEntries(scopeEntries);
  renderSummary(scopeEntries);
  renderMonthlySummary(filteredEntries);
  renderCalendar();
  saveOverviewFilters();
}

prevMonthBtn.addEventListener("click", () => {
  currentCalendarDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() - 1,
    1
  );

  filterYear.value = String(currentCalendarDate.getFullYear());
  filterMonth.value = String(currentCalendarDate.getMonth() + 1).padStart(2, "0");

  selectedCalendarDate = null;
  currentEntriesPage = 1;
  renderAll();
});

nextMonthBtn.addEventListener("click", () => {
  currentCalendarDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + 1,
    1
  );

  filterYear.value = String(currentCalendarDate.getFullYear());
  filterMonth.value = String(currentCalendarDate.getMonth() + 1).padStart(2, "0");

  selectedCalendarDate = null;
  currentEntriesPage = 1;
  renderAll();
});

applyFiltersBtn.addEventListener("click", () => {
  clearSelectedDayIfOutsideFilters();
  syncCalendarToFilters();
  currentEntriesPage = 1;
  renderAll();
});

filterPerson.addEventListener("change", () => {
  clearSelectedDayIfOutsideFilters();
  currentEntriesPage = 1;
  renderAll();
});

filterYear.addEventListener("change", () => {
  clearSelectedDayIfOutsideFilters();
  syncCalendarToFilters();
  currentEntriesPage = 1;
  renderAll();
});

filterMonth.addEventListener("change", () => {
  clearSelectedDayIfOutsideFilters();
  syncCalendarToFilters();
  currentEntriesPage = 1;
  renderAll();
});

filterKategori.addEventListener("change", () => {
  clearSelectedDayIfOutsideFilters();
  currentEntriesPage = 1;
  renderAll();
});

window.editEntry = function(id) {
  const entry = allEntries.find((item) => String(item.id) === String(id));
  if (entry) goToEdit(entry);
};

window.removeEntry = function(id) {
  deleteEntry(id);
};

toggleSelectModeBtn?.addEventListener("click", () => {
  selectionMode = !selectionMode;

  if (!selectionMode) {
    selectedEntryIds.clear();
  }

  updateSelectionUi();
  renderAll();
});

clearSelectionBtn?.addEventListener("click", () => {
  selectedEntryIds.clear();
  updateSelectionUi();
  renderAll();
});

bulkDeleteBtn?.addEventListener("click", bulkDeleteSelected);

function openEntryModal(entry) {
  const modal = document.getElementById("entryModal");
  const modalBody = document.getElementById("entryModalBody");

  if (!modal || !modalBody || !entry) return;

  modalBody.innerHTML = `
    <div class="modalInfoGrid">
      <div class="modalInfoRow">
        <span>Person</span>
        <strong>${entry.navn}</strong>
      </div>

      <div class="modalInfoRow">
        <span>Kategori</span>
        <strong>${entry.kategori}</strong>
      </div>

      <div class="modalInfoRow">
        <span>Dato</span>
        <strong>${formatDateNorwegian(entry.dato)}</strong>
      </div>

      <div class="modalInfoRow">
        <span>Verdi</span>
        <strong>${formatValue(entry)}</strong>
      </div>

      <div class="modalInfoRow">
        <span>Opprettet av</span>
        <strong>${entry.opprettet_av || "-"}</strong>
      </div>
    </div>

    <div class="modalActions">
      <button type="button" onclick="window.editEntry('${entry.id}')">Rediger</button>
      <button type="button" class="delete-btn" onclick="window.removeEntry('${entry.id}')">Slett</button>
    </div>
  `;

  modal.classList.add("open");
}

function closeEntryModal() {
  const modal = document.getElementById("entryModal");
  if (modal) {
    modal.classList.remove("open");
  }
}

window.closeEntryModal = closeEntryModal;

document.addEventListener("click", (event) => {
  const modal = document.getElementById("entryModal");
  if (!modal) return;

  if (event.target === modal) {
    closeEntryModal();
  }
});

async function loadEntries() {
  const previousYear = filterYear.value;
  const previousMonth = filterMonth.value;

  const { data, error } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("is_deleted", false)
    .order("dato", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (overviewKpis) overviewKpis.innerHTML = "";
    summaryCards.innerHTML = `<p class="empty">Feil ved henting: ${error.message}</p>`;
    monthlySummary.innerHTML = "";
    entriesList.innerHTML = "";
    entriesPagination.innerHTML = "";
    calendarGrid.innerHTML = "";
    return;
  }

  allEntries = data || [];

  selectedEntryIds = new Set(
    [...selectedEntryIds].filter((id) =>
      allEntries.some((entry) => String(entry.id) === String(id))
    )
  );

  populateYearFilter(allEntries);

  const restoredFromStorage = restoreOverviewFilters();

  if (!hasInitializedFilters) {
    if (!restoredFromStorage) {
      const today = new Date();
      const currentYearString = String(today.getFullYear());

      if ([...filterYear.options].some((option) => option.value === currentYearString)) {
        filterYear.value = currentYearString;
      }

      filterMonth.value = String(today.getMonth() + 1).padStart(2, "0");
    }

    hasInitializedFilters = true;
  } else if (!restoredFromStorage) {
    if ([...filterYear.options].some((option) => option.value === previousYear)) {
      filterYear.value = previousYear;
    } else {
      filterYear.value = "Alle";
    }

    if (previousMonth) {
      filterMonth.value = previousMonth;
    }
  }

  clearSelectedDayIfOutsideFilters();
  syncCalendarToFilters();
  currentEntriesPage = 1;
  updateSelectionUi();
  renderAll();
}

loadEntries();