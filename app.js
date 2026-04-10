const SUPABASE_URL = "https://wljgcwxoevnbnaauzrrk.supabase.co";
const SUPABASE_KEY = "sb_publishable_1u_6ELWHXiN7J1LvG2qLvQ_AI-kojbJ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTOSAVE_DELAY_MS = 800;
const DELIVERY_SHARE_STEP = 1 / 6;
const FLOAT_COMPARE_EPSILON = 0.0001;

const authGate = document.getElementById("authGate");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const loggedInUserBox = document.getElementById("loggedInUserBox");

const weekLabel = document.getElementById("weekLabel");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const resetWeekBtn = document.getElementById("resetWeekBtn");
const weekTableBody = document.getElementById("weekTableBody");
const weekHelperText = document.getElementById("weekHelperText");
const mobileDayPicker = document.getElementById("mobileDayPicker");
const mobileSelectedDayInfo = document.getElementById("mobileSelectedDayInfo");
const mobileWeekCards = document.getElementById("mobileWeekCards");

const CATEGORY_CONFIG = [
  { kategori: "Jobb for kunder", enhet: "timer", step: "0.25" },
  { kategori: "Jobb for kunder", enhet: "km", step: "0.1" },

  { kategori: "Jobb med ved", enhet: "timer", step: "0.25" },
  { kategori: "Jobb med ved", enhet: "km", step: "0.1" },

  { kategori: "Jobb div", enhet: "timer", step: "0.25" },
  { kategori: "Jobb div", enhet: "km", step: "0.1" },

  { kategori: "Kjøring Molde-Ålesund", enhet: "km", step: "0.1" },

  { kategori: "Levering av ved", enhet: "stk", step: String(DELIVERY_SHARE_STEP) },
  { kategori: "Levering av ved", enhet: "km", step: "0.1" }
];

let currentDate = new Date();
let currentWeekDates = [];
let selectedMobileDate = "";
let weekData = {};
let currentWeekEntries = [];
let currentProfile = null;
let pendingEditTarget = null;
let activeHighlightedInput = null;
const autosaveTimers = new Map();

function entryKey(kategori, enhet) {
  return `${kategori}__${enhet}`;
}

function cellSaveKey(kategori, enhet, dato) {
  return `${kategori}__${enhet}__${dato}`;
}

function getCurrentUser() {
  return currentProfile?.full_name || "";
}

function setLoggedInUserBox() {
  if (!loggedInUserBox) return;
  loggedInUserBox.textContent = currentProfile?.full_name || "Ukjent bruker";
}

function showAuthGate(message = "") {
  if (authGate) authGate.hidden = false;
  if (appShell) appShell.hidden = true;
  if (loginMessage) loginMessage.textContent = message;
}

function showAppShell() {
  if (authGate) authGate.hidden = true;
  if (appShell) appShell.hidden = false;
  if (loginMessage) loginMessage.textContent = "";
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function loadProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message || "Fant ikke brukerprofil.");
  }

  currentProfile = data;
  setLoggedInUserBox();
}

function formatDateNorwegian(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

function formatTimeOnly(date = new Date()) {
  return date.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isDeliveryShareField(kategori, enhet) {
  return kategori === "Levering av ved" && enhet === "stk";
}

function trimTrailingZeros(value) {
  return String(value).replace(/\.?0+$/, "");
}

function normalizeValue(value, kategori, enhet) {
  const numericValue = Number(value || 0);

  if (!numericValue) {
    return 0;
  }

  if (isDeliveryShareField(kategori, enhet)) {
    const roundedToSixths = Math.round(numericValue / DELIVERY_SHARE_STEP) * DELIVERY_SHARE_STEP;
    return Number(roundedToSixths.toFixed(6));
  }

  return numericValue;
}

function formatStkDisplay(value) {
  const sixths = Math.round(Number(value || 0) * 6);

  if (!sixths) {
    return "0 stk";
  }

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

  if (whole > 0) {
    parts.push(String(whole));
  }

  if (remainder > 0) {
    parts.push(fractionMap[remainder]);
  }

  return `${parts.join(" ")} stk`;
}

function formatInputValue(value, kategori, enhet) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const numericValue = normalizeValue(value, kategori, enhet);

  if (isDeliveryShareField(kategori, enhet)) {
    return trimTrailingZeros(numericValue.toFixed(3));
  }

  return String(value);
}

function formatCellDisplay(value, enhet) {
  const numericValue = Number(value || 0);

  if (!numericValue) {
    return "0";
  }

  if (enhet === "timer") {
    const totalMinutes = Math.round(numericValue * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours} t`;
    }

    return `${hours} t ${minutes} min`;
  }

  if (enhet === "stk") {
    return formatStkDisplay(numericValue);
  }

  return `${numericValue} ${enhet}`;
}

function getStartOfWeek(date) {
  const copy = new Date(date);
  const jsDay = copy.getDay();
  const day = jsDay === 0 ? 7 : jsDay;
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function getWeekDates(date) {
  const start = getStartOfWeek(date);

  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

function setWeekLabel() {
  const from = formatDateNorwegian(currentWeekDates[0]);
  const to = formatDateNorwegian(currentWeekDates[6]);
  weekLabel.textContent = `${from} – ${to}`;
}

function getDateParts(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function dateKeyToDate(dateString) {
  const { year, month, day } = getDateParts(dateString);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getShortWeekdayLabel(dateString) {
  return dateKeyToDate(dateString).toLocaleDateString("no-NO", { weekday: "short" }).replace('.', '');
}

function getLongWeekdayLabel(dateString) {
  return dateKeyToDate(dateString).toLocaleDateString("no-NO", { weekday: "long" });
}

function getWeekdayIndex(dateString) {
  const jsDay = dateKeyToDate(dateString).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseEditTargetFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const edit = params.get("edit");
  const dato = params.get("dato");
  const kategori = params.get("kategori");
  const enhet = params.get("enhet");

  if (!edit || !dato || !kategori || !enhet) {
    pendingEditTarget = null;
    return;
  }

  pendingEditTarget = { edit, dato, kategori, enhet };
  currentDate = dateKeyToDate(dato);
  selectedMobileDate = dato;
}

function clearEditParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("edit");
  url.searchParams.delete("dato");
  url.searchParams.delete("kategori");
  url.searchParams.delete("enhet");
  window.history.replaceState({}, "", url);
}

function clearActiveEditHighlight() {
  if (!activeHighlightedInput) return;
  activeHighlightedInput.classList.remove("editTargetHighlight");
  activeHighlightedInput = null;
}

function applyEditTargetHighlight() {
  if (!pendingEditTarget) return;

  if (selectedMobileDate !== pendingEditTarget.dato) {
    selectedMobileDate = pendingEditTarget.dato;
    renderMobileWeekView();
  }

  const matchingInputs = Array.from(
  document.querySelectorAll("input[data-kategori][data-enhet][data-dato]")
).filter((input) =>
  input.dataset.kategori === pendingEditTarget.kategori &&
  input.dataset.enhet === pendingEditTarget.enhet &&
  input.dataset.dato === pendingEditTarget.dato
);

const targetInput =
  matchingInputs.find((input) => input.offsetParent !== null) ||
  matchingInputs[0];

if (!targetInput) {
  return;
}

  clearActiveEditHighlight();

  activeHighlightedInput = targetInput;
  targetInput.classList.add("editTargetHighlight");
  targetInput.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    targetInput.focus({ preventScroll: true });
    targetInput.select?.();
  }, 150);

  setTimeout(() => {
    clearActiveEditHighlight();
  }, 3500);

  clearEditParamsFromUrl();
  pendingEditTarget = null;
}

function ensureSelectedMobileDate() {
  if (!currentWeekDates.length) return;

  if (currentWeekDates.includes(selectedMobileDate)) {
    return;
  }

  if (selectedMobileDate) {
    selectedMobileDate = currentWeekDates[getWeekdayIndex(selectedMobileDate)] || currentWeekDates[0];
    return;
  }

  const todayKey = getTodayKey();
  selectedMobileDate = currentWeekDates.includes(todayKey) ? todayKey : currentWeekDates[0];
}

function countFilledFieldsForDate(dateString) {
  return CATEGORY_CONFIG.reduce((count, config) => {
    const value = Number(getWeekDataValue(config.kategori, config.enhet, dateString) || 0);
    return count + (value ? 1 : 0);
  }, 0);
}

function renderMobileDayPicker() {
  if (!mobileDayPicker) return;

  ensureSelectedMobileDate();
  mobileDayPicker.innerHTML = "";

  currentWeekDates.forEach((dato) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobileDayButton";

    if (dato === selectedMobileDate) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <span class="mobileDayButtonName">${getShortWeekdayLabel(dato)}</span>
      <span class="mobileDayButtonDate">${dato.slice(8, 10)}.${dato.slice(5, 7)}</span>
    `;

    button.addEventListener("click", () => {
      selectedMobileDate = dato;
      renderMobileWeekView();
    });

    mobileDayPicker.appendChild(button);
  });
}

function renderMobileSelectedDayInfo() {
  if (!mobileSelectedDayInfo || !selectedMobileDate) return;

  const weekday = getLongWeekdayLabel(selectedMobileDate);
  const filledFields = countFilledFieldsForDate(selectedMobileDate);
  const fieldText = filledFields === 1 ? "1 felt fylt inn" : `${filledFields} felt fylt inn`;

  mobileSelectedDayInfo.textContent = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${formatDateNorwegian(selectedMobileDate)} · ${fieldText}`;
}

function createWeekInput(config, dato, onAfterChange) {
  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.step = config.step;
  input.min = "0";
  input.value = formatInputValue(
    getWeekDataValue(config.kategori, config.enhet, dato),
    config.kategori,
    config.enhet
  );

  if (isDeliveryShareField(config.kategori, config.enhet)) {
    input.placeholder = "0.333 / 0.5 / 1";
  }

  input.dataset.kategori = config.kategori;
  input.dataset.enhet = config.enhet;
  input.dataset.dato = dato;
  input.setAttribute("aria-label", `${config.kategori} ${formatDateNorwegian(dato)}`);

  input.addEventListener("input", () => {
    const raw = input.value.trim();
    const parsed = raw === "" ? "" : Number(raw);
    const normalized =
      raw === "" || Number.isNaN(parsed)
        ? ""
        : normalizeValue(parsed, config.kategori, config.enhet);

    setWeekDataValue(config.kategori, config.enhet, dato, normalized);

    if (typeof onAfterChange === "function") {
      onAfterChange();
    }

    scheduleAutosave(config.kategori, config.enhet, dato);
  });

  input.addEventListener("blur", async () => {
    input.value = formatInputValue(
      getWeekDataValue(config.kategori, config.enhet, dato),
      config.kategori,
      config.enhet
    );
    await flushAutosave(config.kategori, config.enhet, dato);

    if (typeof onAfterChange === "function") {
      onAfterChange();
    }
  });

  return input;
}

function renderMobileWeekView() {
  if (!mobileWeekCards) return;

  ensureSelectedMobileDate();
  renderMobileDayPicker();
  renderMobileSelectedDayInfo();

  mobileWeekCards.innerHTML = "";

  CATEGORY_CONFIG.forEach((config) => {
    const card = document.createElement("article");
    card.className = "mobileWeekCard";

    const sumText = formatCellDisplay(sumRow(config.kategori, config.enhet), config.enhet);
    const selectedDateLabel = `${getLongWeekdayLabel(selectedMobileDate)} ${formatDateNorwegian(selectedMobileDate)}`;

    card.innerHTML = `
      <div class="mobileWeekCardHeader">
        <div class="mobileWeekCardTitle">
          <strong>${config.kategori}</strong>
          <div class="mobileWeekCardMeta">${config.enhet} · ${selectedDateLabel}</div>
        </div>
        <div class="mobileWeekCardSum">Ukesum: <span class="mobileWeekCardSumValue">${sumText}</span></div>
      </div>
      <div class="mobileWeekCardInput">
        <label for="mobile-${entryKey(config.kategori, config.enhet)}">Verdi for valgt dag</label>
      </div>
    `;

    const inputWrap = card.querySelector(".mobileWeekCardInput");
    const sumValue = card.querySelector(".mobileWeekCardSumValue");

    const input = createWeekInput(config, selectedMobileDate, () => {
      if (sumValue) {
        sumValue.textContent = formatCellDisplay(sumRow(config.kategori, config.enhet), config.enhet);
      }
      renderMobileSelectedDayInfo();
    });

    input.id = `mobile-${entryKey(config.kategori, config.enhet)}`;
    inputWrap.appendChild(input);
    mobileWeekCards.appendChild(card);
  });
}

function getWeekDataValue(kategori, enhet, dato) {
  const key = entryKey(kategori, enhet);
  return weekData[key]?.[dato] ?? "";
}

function setWeekDataValue(kategori, enhet, dato, value) {
  const key = entryKey(kategori, enhet);

  if (!weekData[key]) {
    weekData[key] = {};
  }

  weekData[key][dato] = value;
}

function sumRow(kategori, enhet) {
  return currentWeekDates.reduce((sum, dato) => {
    return sum + (Number(getWeekDataValue(kategori, enhet, dato)) || 0);
  }, 0);
}

function updateWeekHelperText(text, isError = false) {
  if (!weekHelperText) return;
  weekHelperText.textContent = text;
  weekHelperText.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function findExistingEntry(kategori, enhet, dato) {
  return currentWeekEntries.find(
    (entry) =>
      entry.kategori === kategori &&
      entry.enhet === enhet &&
      entry.dato === dato
  );
}

function upsertCurrentWeekEntry(entry) {
  const index = currentWeekEntries.findIndex(
    (item) => String(item.id) === String(entry.id)
  );

  if (index === -1) {
    currentWeekEntries.push(entry);
    return;
  }

  currentWeekEntries[index] = entry;
}

function removeCurrentWeekEntryById(entryId) {
  currentWeekEntries = currentWeekEntries.filter(
    (entry) => String(entry.id) !== String(entryId)
  );
}

function renderWeekTable() {
  weekTableBody.innerHTML = "";

  CATEGORY_CONFIG.forEach((config) => {
    const tr = document.createElement("tr");

    const categoryTd = document.createElement("td");
    categoryTd.className = "categoryCol";
    categoryTd.innerHTML = `
      <div class="weekCategoryCell">
        <strong>${config.kategori}</strong>
        <div class="entry-sub">${config.enhet}</div>
      </div>
    `;
    tr.appendChild(categoryTd);

    currentWeekDates.forEach((dato, index) => {
      const td = document.createElement("td");

      const input = createWeekInput(config, dato, () => {
        const sumCell = tr.querySelector(".weekSumCell");
        if (sumCell) {
          sumCell.textContent = formatCellDisplay(
            sumRow(config.kategori, config.enhet),
            config.enhet
          );
        }
      });

      if (index >= 5) {
        td.classList.add("weekend");
      }

      td.appendChild(input);
      tr.appendChild(td);
    });

    const sumTd = document.createElement("td");
    sumTd.className = "weekSumCell";
    sumTd.textContent = formatCellDisplay(
      sumRow(config.kategori, config.enhet),
      config.enhet
    );
    tr.appendChild(sumTd);

    weekTableBody.appendChild(tr);
  });
}

async function loadCurrentWeekEntries() {
  if (!currentProfile) {
    currentWeekEntries = [];
    weekData = {};
    return;
  }

  const from = currentWeekDates[0];
  const to = currentWeekDates[6];

  const { data, error } = await supabaseClient
    .from("entries")
    .select("*")
    .eq("user_id", currentProfile.id)
    .gte("dato", from)
    .lte("dato", to)
    .eq("is_deleted", false);

  if (error) {
    updateWeekHelperText(`Feil ved henting av uke: ${error.message}`, true);
    currentWeekEntries = [];
    weekData = {};
    return;
  }

  currentWeekEntries = data || [];
  weekData = {};

  currentWeekEntries.forEach((entry) => {
    setWeekDataValue(entry.kategori, entry.enhet, entry.dato, entry.mengde);
  });
}

async function logChange({ entryId, action, snapshot, createdBy }) {
  const { error } = await supabaseClient
    .from("entry_changes")
    .insert([
      {
        entry_id: entryId,
        action,
        snapshot,
        created_by: createdBy || null
      }
    ]);

  if (error) {
    console.error("Feil ved logging av endring:", error.message);
  }
}

async function createEntry(entry, createdBy) {
  const { data, error } = await supabaseClient
    .from("entries")
    .insert([entry])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logChange({
    entryId: data.id,
    action: "created",
    snapshot: data,
    createdBy
  });

  return data;
}

async function updateEntry(existingEntry, payload, createdBy) {
  const { data, error } = await supabaseClient
    .from("entries")
    .update(payload)
    .eq("id", existingEntry.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logChange({
    entryId: data.id,
    action: "updated",
    snapshot: data,
    createdBy
  });

  return data;
}

async function deleteEntryByClearing(existingEntry, createdBy) {
  const { error } = await supabaseClient
    .from("entries")
    .update({ is_deleted: true })
    .eq("id", existingEntry.id);

  if (error) {
    throw new Error(error.message);
  }

  await logChange({
    entryId: existingEntry.id,
    action: "deleted",
    snapshot: existingEntry,
    createdBy
  });
}

async function saveSingleCell(kategori, enhet, dato) {
  if (!currentProfile) {
    updateWeekHelperText("Du må være logget inn.", true);
    return;
  }

  const selectedPerson = getCurrentUser();
  const createdBy = selectedPerson;
  const rawValue = getWeekDataValue(kategori, enhet, dato);
  const numericValue = rawValue === "" ? 0 : normalizeValue(rawValue || 0, kategori, enhet);
  const existing = findExistingEntry(kategori, enhet, dato);

  try {
    updateWeekHelperText("Lagrer automatisk...");

    if (!numericValue) {
      if (existing) {
        await deleteEntryByClearing(existing, createdBy);
        removeCurrentWeekEntryById(existing.id);
      }

      updateWeekHelperText(`Lagret automatisk ${formatTimeOnly()}`);
      return;
    }

    const payload = {
      user_id: currentProfile.id,
      navn: selectedPerson,
      kategori,
      dato,
      mengde: numericValue,
      enhet,
      kommentar: existing?.kommentar || "",
      opprettet_av: createdBy,
      is_deleted: false
    };

    if (existing) {
      const hasChanged =
        Math.abs(Number(existing.mengde) - numericValue) > FLOAT_COMPARE_EPSILON ||
        existing.is_deleted === true ||
        existing.opprettet_av !== createdBy;

      if (hasChanged) {
        const updated = await updateEntry(existing, payload, createdBy);
        upsertCurrentWeekEntry(updated);
      }
    } else {
      const created = await createEntry(payload, createdBy);
      upsertCurrentWeekEntry(created);
    }

    updateWeekHelperText(`Lagret automatisk ${formatTimeOnly()}`);
  } catch (error) {
    console.error(error);
    updateWeekHelperText(`Feil ved lagring: ${error.message}`, true);
  }
}

function scheduleAutosave(kategori, enhet, dato) {
  const key = cellSaveKey(kategori, enhet, dato);

  if (autosaveTimers.has(key)) {
    clearTimeout(autosaveTimers.get(key));
  }

  updateWeekHelperText("Lagrer automatisk...");

  const timer = setTimeout(async () => {
    autosaveTimers.delete(key);
    await saveSingleCell(kategori, enhet, dato);
  }, AUTOSAVE_DELAY_MS);

  autosaveTimers.set(key, timer);
}

async function flushAutosave(kategori, enhet, dato) {
  const key = cellSaveKey(kategori, enhet, dato);

  if (!autosaveTimers.has(key)) {
    return;
  }

  clearTimeout(autosaveTimers.get(key));
  autosaveTimers.delete(key);
  await saveSingleCell(kategori, enhet, dato);
}

async function flushAllAutosaves() {
  const pending = [...autosaveTimers.keys()];

  for (const key of pending) {
    const [kategori, enhet, dato] = key.split("__");
    await flushAutosave(kategori, enhet, dato);
  }
}

function resetWeekView() {
  currentDate = new Date();
  updateWeekHelperText("Visning nullstilt.");
  initWeekView();
}

async function initWeekView() {
  currentWeekDates = getWeekDates(currentDate);
  ensureSelectedMobileDate();
  setWeekLabel();
  await loadCurrentWeekEntries();
  renderWeekTable();
  renderMobileWeekView();
  applyEditTargetHighlight();
}

prevWeekBtn?.addEventListener("click", async () => {
  await flushAllAutosaves();
  currentDate.setDate(currentDate.getDate() - 7);
  await initWeekView();
});

nextWeekBtn?.addEventListener("click", async () => {
  await flushAllAutosaves();
  currentDate.setDate(currentDate.getDate() + 7);
  await initWeekView();
});

resetWeekBtn?.addEventListener("click", resetWeekView);



loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

console.log("LOGIN SUBMIT KJØRER");

  try {
    if (loginMessage) {
      loginMessage.textContent = "Logger inn...";
    }

    const email = loginEmail?.value?.trim() || "";
    const password = loginPassword?.value || "";

    console.log("FØR AUTH KALL");

const authResult = await Promise.race([
  supabaseClient.auth.signInWithPassword({
    email,
    password
  }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Innlogging timeout etter 10 sekunder")), 10000)
  )
]);

console.log("ETTER AUTH KALL", authResult);

const { data, error } = authResult;

if (error) {
  throw error;
}

    if (error) {
      throw error;
    }

    if (!data?.user?.id) {
      throw new Error("Ingen bruker ble returnert fra innlogging.");
    }

    await loadProfile(data.user.id);
    parseEditTargetFromUrl();
    showAppShell();
    await initWeekView();
    updateWeekHelperText(`Viser registreringer for ${getCurrentUser()}.`);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    showAuthGate(error?.message || "Innlogging feilet.");
  }
});

(async function initPage() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data?.session) {
      showAuthGate();
      return;
    }

    await loadProfile(data.session.user.id);
    parseEditTargetFromUrl();
    showAppShell();
    await initWeekView();
    updateWeekHelperText(`Viser registreringer for ${getCurrentUser()}.`);
  } catch (error) {
    console.error("INIT ERROR:", error);
    showAuthGate(error?.message || "Kunne ikke starte appen.");
  }
})();