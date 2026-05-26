const LAGER_SUPABASE_URL = "https://wljgcwxoevnbnaauzrrk.supabase.co";
const LAGER_SUPABASE_KEY = "sb_publishable_1u_6ELWHXiN7J1LvG2qLvQ_AI-kojbJ";
const lagerSupabaseClient = supabase.createClient(LAGER_SUPABASE_URL, LAGER_SUPABASE_KEY);

const ITEMS_TABLE = "lager_items";
const MOVEMENTS_TABLE = "lager_hendelser";
const LOCAL_ITEMS_KEY = "vedogskog_lager_items_v1";
const LOCAL_MOVEMENTS_KEY = "vedogskog_lager_hendelser_v1";

const inventoryItemForm = document.getElementById("inventoryItemForm");
const inventoryItemId = document.getElementById("inventoryItemId");
const inventoryName = document.getElementById("inventoryName");
const inventoryType = document.getElementById("inventoryType");
const inventoryUnit = document.getElementById("inventoryUnit");
const inventoryQuantity = document.getElementById("inventoryQuantity");
const inventoryUnitValue = document.getElementById("inventoryUnitValue");
const inventoryNote = document.getElementById("inventoryNote");
const resetInventoryFormBtn = document.getElementById("resetInventoryFormBtn");
const saveInventoryItemBtn = document.getElementById("saveInventoryItemBtn");

const inventoryMovementForm = document.getElementById("inventoryMovementForm");
const movementItemId = document.getElementById("movementItemId");
const movementType = document.getElementById("movementType");
const movementQuantity = document.getElementById("movementQuantity");
const movementNote = document.getElementById("movementNote");

const inventoryTotalValue = document.getElementById("inventoryTotalValue");
const firewoodTotalValue = document.getElementById("firewoodTotalValue");
const equipmentTotalValue = document.getElementById("equipmentTotalValue");
const inventoryItemCount = document.getElementById("inventoryItemCount");
const inventoryList = document.getElementById("inventoryList");
const inventoryHistory = document.getElementById("inventoryHistory");
const inventorySearch = document.getElementById("inventorySearch");
const inventoryTypeFilter = document.getElementById("inventoryTypeFilter");
const refreshInventoryBtn = document.getElementById("refreshInventoryBtn");
const storageModeInfo = document.getElementById("storageModeInfo");
const clearLocalHistoryBtn = document.getElementById("clearLocalHistoryBtn");

let inventoryItems = [];
let inventoryMovements = [];
let useSupabaseStorage = true;
let currentActorName = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatCurrency(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("no-NO")} kr`;
}

function getTypeLabel(type) {
  if (type === "ved") return "Ved";
  if (type === "utstyr") return "Utstyr";
  return "Annet";
}

function getMovementLabel(type) {
  if (type === "sell") return "Solgt / brukt";
  if (type === "produce") return "Produsert mer";
  if (type === "buy") return "Kjøpt inn";
  if (type === "adjust") return "Korrigert";
  return "Endret";
}

function getSignedQuantity(type, quantity) {
  const amount = Math.abs(toNumber(quantity));
  if (type === "sell") return -amount;
  return amount;
}

function getItemValue(item) {
  return toNumber(item.quantity) * toNumber(item.unit_value);
}

function saveLocalItems() {
  localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(inventoryItems));
}

function saveLocalMovements() {
  localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(inventoryMovements));
}

function loadLocalItems() {
  try {
    inventoryItems = JSON.parse(localStorage.getItem(LOCAL_ITEMS_KEY) || "[]");
  } catch {
    inventoryItems = [];
  }
}

function loadLocalMovements() {
  try {
    inventoryMovements = JSON.parse(localStorage.getItem(LOCAL_MOVEMENTS_KEY) || "[]");
  } catch {
    inventoryMovements = [];
  }
}

function setStorageModeInfo() {
  if (!storageModeInfo) return;

  if (useSupabaseStorage) {
    storageModeInfo.textContent = "Lageret lagres i Supabase slik at det kan brukes fra flere telefoner og PC-er.";
  } else {
    storageModeInfo.textContent = "Lageret lagres lokalt i denne nettleseren. Kjør SQL-filen som følger med for å lagre lageret felles i Supabase.";
  }
}

async function loadCurrentActorName() {
  try {
    const { data } = await lagerSupabaseClient.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;

    const { data: profile } = await lagerSupabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    currentActorName = profile?.full_name || data.session.user.email || "";
  } catch {
    currentActorName = "";
  }
}

async function loadInventory() {
  try {
    const { data: items, error: itemError } = await lagerSupabaseClient
      .from(ITEMS_TABLE)
      .select("*")
      .order("created_at", { ascending: true });

    if (itemError) throw itemError;

    const { data: movements, error: movementError } = await lagerSupabaseClient
      .from(MOVEMENTS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (movementError) throw movementError;

    useSupabaseStorage = true;
    inventoryItems = items || [];
    inventoryMovements = movements || [];
  } catch (error) {
    console.warn("Supabase lager ikke klart, bruker localStorage:", error);
    useSupabaseStorage = false;
    loadLocalItems();
    loadLocalMovements();
  }

  setStorageModeInfo();
  renderInventory();
}

async function upsertInventoryItem(item) {
  if (useSupabaseStorage) {
    const { data, error } = await lagerSupabaseClient
      .from(ITEMS_TABLE)
      .upsert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const existingIndex = inventoryItems.findIndex((existing) => existing.id === item.id);
  if (existingIndex >= 0) {
    inventoryItems[existingIndex] = { ...inventoryItems[existingIndex], ...item, updated_at: new Date().toISOString() };
  } else {
    inventoryItems.push({ ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  saveLocalItems();
  return item;
}

async function addMovement(movement) {
  if (useSupabaseStorage) {
    const { error } = await lagerSupabaseClient.from(MOVEMENTS_TABLE).insert(movement);
    if (error) throw error;
    return;
  }

  inventoryMovements.unshift({ ...movement, created_at: new Date().toISOString() });
  inventoryMovements = inventoryMovements.slice(0, 100);
  saveLocalMovements();
}

async function deleteInventoryItem(id) {
  if (useSupabaseStorage) {
    const { error } = await lagerSupabaseClient.from(ITEMS_TABLE).delete().eq("id", id);
    if (error) throw error;
  } else {
    inventoryItems = inventoryItems.filter((item) => item.id !== id);
    saveLocalItems();
  }
}

function resetInventoryForm() {
  inventoryItemId.value = "";
  inventoryItemForm.reset();
  inventoryUnit.value = "stk";
  inventoryType.value = "ved";
  saveInventoryItemBtn.textContent = "Lagre lagerlinje";
}

function fillInventoryForm(id) {
  const item = inventoryItems.find((entry) => entry.id === id);
  if (!item) return;

  inventoryItemId.value = item.id;
  inventoryName.value = item.name || "";
  inventoryType.value = item.type || "ved";
  inventoryUnit.value = item.unit || "stk";
  inventoryQuantity.value = item.quantity || 0;
  inventoryUnitValue.value = item.unit_value || 0;
  inventoryNote.value = item.note || "";
  saveInventoryItemBtn.textContent = "Oppdater lagerlinje";
  inventoryName.focus();
  window.scrollTo({ top: inventoryItemForm.offsetTop - 80, behavior: "smooth" });
}

function renderTotals() {
  const total = inventoryItems.reduce((sum, item) => sum + getItemValue(item), 0);
  const firewood = inventoryItems.filter((item) => item.type === "ved").reduce((sum, item) => sum + getItemValue(item), 0);
  const equipment = inventoryItems.filter((item) => item.type === "utstyr").reduce((sum, item) => sum + getItemValue(item), 0);

  inventoryTotalValue.textContent = formatCurrency(total);
  firewoodTotalValue.textContent = formatCurrency(firewood);
  equipmentTotalValue.textContent = formatCurrency(equipment);
  inventoryItemCount.textContent = String(inventoryItems.length);
}

function getFilteredItems() {
  const search = String(inventorySearch?.value || "").toLowerCase().trim();
  const type = inventoryTypeFilter?.value || "alle";

  return inventoryItems.filter((item) => {
    const matchesType = type === "alle" || item.type === type;
    const matchesSearch = !search || [item.name, item.unit, item.note, getTypeLabel(item.type)]
      .join(" ")
      .toLowerCase()
      .includes(search);

    return matchesType && matchesSearch;
  });
}

function renderMovementOptions() {
  if (!movementItemId) return;

  if (!inventoryItems.length) {
    movementItemId.innerHTML = `<option value="">Ingen lagerlinjer enda</option>`;
    movementItemId.disabled = true;
    return;
  }

  movementItemId.disabled = false;
  movementItemId.innerHTML = inventoryItems
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${formatNumber(item.quantity)} ${escapeHtml(item.unit || "stk")})</option>`)
    .join("");
}

function renderInventoryList() {
  const items = getFilteredItems();

  if (!items.length) {
    inventoryList.innerHTML = `<p class="empty">Ingen lagerlinjer funnet.</p>`;
    return;
  }

  inventoryList.innerHTML = items.map((item) => {
    const value = getItemValue(item);
    const quantity = `${formatNumber(item.quantity)} ${escapeHtml(item.unit || "stk")}`;

    return `
      <article class="inventoryCard">
        <div class="inventoryCardTop">
          <div>
            <span class="inventoryTypeBadge inventoryTypeBadge--${escapeHtml(item.type || "annet")}">${getTypeLabel(item.type)}</span>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
          <strong>${formatCurrency(value)}</strong>
        </div>

        <div class="inventoryCardStats">
          <div><span>Antall</span><strong>${quantity}</strong></div>
          <div><span>Verdi per enhet</span><strong>${formatCurrency(item.unit_value)}</strong></div>
        </div>

        ${item.note ? `<p class="inventoryNote">${escapeHtml(item.note)}</p>` : ""}

        <div class="inventoryCardActions">
          <button type="button" class="secondary" data-action="edit" data-id="${escapeHtml(item.id)}">Endre</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHtml(item.id)}">Slett</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderHistory() {
  if (!inventoryMovements.length) {
    inventoryHistory.innerHTML = `<p class="empty">Ingen endringer enda.</p>`;
    return;
  }

  inventoryHistory.innerHTML = inventoryMovements.slice(0, 30).map((movement) => {
    const itemName = movement.item_name || inventoryItems.find((item) => item.id === movement.item_id)?.name || "Ukjent lagerlinje";
    const date = movement.created_at ? new Date(movement.created_at) : new Date();
    const signedQuantity = getSignedQuantity(movement.type, movement.quantity);
    const sign = signedQuantity > 0 ? "+" : "";

    return `
      <article class="inventoryHistoryRow">
        <div>
          <strong>${escapeHtml(getMovementLabel(movement.type))}: ${escapeHtml(itemName)}</strong>
          <span>${date.toLocaleString("no-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}${movement.actor_name ? ` · ${escapeHtml(movement.actor_name)}` : ""}</span>
          ${movement.note ? `<p>${escapeHtml(movement.note)}</p>` : ""}
        </div>
        <strong>${sign}${formatNumber(signedQuantity)}</strong>
      </article>
    `;
  }).join("");
}

function renderInventory() {
  renderTotals();
  renderMovementOptions();
  renderInventoryList();
  renderHistory();
}

inventoryItemForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const existingId = inventoryItemId.value || newId();
  const existingItem = inventoryItems.find((item) => item.id === existingId);

  const item = {
    id: existingId,
    name: inventoryName.value.trim(),
    type: inventoryType.value,
    unit: inventoryUnit.value.trim() || "stk",
    quantity: Math.max(0, toNumber(inventoryQuantity.value)),
    unit_value: Math.max(0, toNumber(inventoryUnitValue.value)),
    note: inventoryNote.value.trim(),
    updated_at: new Date().toISOString()
  };

  if (!item.name) return;

  try {
    await upsertInventoryItem(item);

    const quantityChange = item.quantity - toNumber(existingItem?.quantity || 0);
    await addMovement({
      id: newId(),
      item_id: item.id,
      item_name: item.name,
      type: existingItem ? "adjust" : "buy",
      quantity: Math.abs(quantityChange || item.quantity),
      note: existingItem ? "Lagerlinje oppdatert direkte" : "Ny lagerlinje lagt til",
      actor_name: currentActorName,
      created_at: new Date().toISOString()
    });

    resetInventoryForm();
    await loadInventory();
  } catch (error) {
    alert(`Kunne ikke lagre lagerlinje: ${error.message || error}`);
  }
});

inventoryMovementForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const item = inventoryItems.find((entry) => entry.id === movementItemId.value);
  if (!item) return;

  const amount = Math.abs(toNumber(movementQuantity.value));
  if (!amount) return;

  const signed = getSignedQuantity(movementType.value, amount);
  const nextQuantity = Math.max(0, toNumber(item.quantity) + signed);
  const updatedItem = { ...item, quantity: nextQuantity, updated_at: new Date().toISOString() };

  try {
    await upsertInventoryItem(updatedItem);
    await addMovement({
      id: newId(),
      item_id: item.id,
      item_name: item.name,
      type: movementType.value,
      quantity: amount,
      note: movementNote.value.trim(),
      actor_name: currentActorName,
      created_at: new Date().toISOString()
    });

    inventoryMovementForm.reset();
    await loadInventory();
  } catch (error) {
    alert(`Kunne ikke oppdatere lager: ${error.message || error}`);
  }
});

inventoryList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    fillInventoryForm(id);
    return;
  }

  if (action === "delete") {
    const item = inventoryItems.find((entry) => entry.id === id);
    if (!item) return;

    const confirmed = confirm(`Slette ${item.name} fra lageret?`);
    if (!confirmed) return;

    try {
      await addMovement({
        id: newId(),
        item_id: id,
        item_name: item.name,
        type: "adjust",
        quantity: item.quantity,
        note: "Lagerlinje slettet",
        actor_name: currentActorName,
        created_at: new Date().toISOString()
      });
      await deleteInventoryItem(id);
      await loadInventory();
    } catch (error) {
      alert(`Kunne ikke slette lagerlinje: ${error.message || error}`);
      await loadInventory();
    }
  }
});

resetInventoryFormBtn?.addEventListener("click", resetInventoryForm);
refreshInventoryBtn?.addEventListener("click", loadInventory);
inventorySearch?.addEventListener("input", renderInventoryList);
inventoryTypeFilter?.addEventListener("change", renderInventoryList);

clearLocalHistoryBtn?.addEventListener("click", () => {
  if (!confirm("Tømme lokal lagerhistorikk i denne nettleseren?")) return;
  inventoryMovements = [];
  saveLocalMovements();
  renderHistory();
});

(async function initInventoryPage() {
  await loadCurrentActorName();
  await loadInventory();
})();
