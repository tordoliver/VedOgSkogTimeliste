export function createCalendar({
  container,
  entries = [],
  onSelectionChange,
  initialDate = new Date(),
  initialSelectedDates = []
}) {
  let currentDate = new Date(initialDate);
  let selectedDates = new Set(initialSelectedDates);
  let currentEntries = [...entries];

  function getDateKey(year, month, day) {
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

  function emitSelection() {
    if (typeof onSelectionChange === "function") {
      onSelectionChange(Array.from(selectedDates).sort());
    }
  }

  function render() {
    if (!container) return;

    container.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const header = document.createElement("div");
    header.className = "calendarHeader";

    const prev = document.createElement("button");
    prev.textContent = "Forrige";
    prev.className = "secondary";
    prev.type = "button";
    prev.onclick = () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      render();
    };

    const next = document.createElement("button");
    next.textContent = "Neste";
    next.className = "secondary";
    next.type = "button";
    next.onclick = () => {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      render();
    };

    const title = document.createElement("div");
    title.className = "calendarMonthLabel";
    title.textContent = currentDate.toLocaleDateString("no-NO", {
      month: "long",
      year: "numeric"
    });

    header.appendChild(prev);
    header.appendChild(title);
    header.appendChild(next);
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "calendarGrid";

    const weekdays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
    weekdays.forEach((day) => {
      const el = document.createElement("div");
      el.className = "calendarWeekday";
      el.textContent = day;
      grid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let start = firstDay.getDay();
    if (start === 0) start = 7;

    for (let i = 1; i < start; i++) {
      const empty = document.createElement("div");
      empty.className = "calendarDay emptyCell";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateKey = getDateKey(year, month, day);
      const dayEntries = currentEntries.filter((e) => e.dato === dateKey);
      const people = [...new Set(dayEntries.map((e) => e.navn))];

      const cell = document.createElement("div");
      cell.className = "calendarDay";

      if (selectedDates.has(dateKey)) {
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
              : people
                  .map((person) => `<span class="calendarMarker ${getPersonClass(person)}"></span>`)
                  .join("")
          }
        </div>
      `;

      cell.onclick = () => {
        if (selectedDates.has(dateKey)) {
          selectedDates.delete(dateKey);
        } else {
          selectedDates.add(dateKey);
        }

        emitSelection();
        render();
      };

      grid.appendChild(cell);
    }

    container.appendChild(grid);
  }

  render();

  return {
    setEntries(newEntries = []) {
      currentEntries = [...newEntries];
      render();
    },
    setSelectedDates(dates = []) {
      selectedDates = new Set(dates);
      emitSelection();
      render();
    },
    getSelectedDates() {
      return Array.from(selectedDates).sort();
    }
  };
}