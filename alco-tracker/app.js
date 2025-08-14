"use strict";

(function initAlcoholTracker() {
  const STORAGE_KEY = "alco-tracker-v1";
  const KCAL_PER_GRAM_ALCOHOL = 7; // 1 грамм этанола ≈ 7 ккал

  const monthLabelEl = document.getElementById("monthLabel");
  const calendarGridEl = document.getElementById("calendarGrid");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  const totalAlcoholEl = document.getElementById("totalAlcohol");
  const totalCaloriesEl = document.getElementById("totalCalories");
  const avgCaloriesEl = document.getElementById("avgCalories");

  const clearMonthBtn = document.getElementById("clearMonth");
  const exportBtn = document.getElementById("exportData");
  const importBtn = document.getElementById("importData");
  const importFileInput = document.getElementById("importFile");

  const entryDialog = document.getElementById("entryDialog");
  const entryDateLabel = document.getElementById("entryDateLabel");
  const alcoholInput = document.getElementById("alcoholInput");
  const strengthInput = document.getElementById("strengthInput");
  const volumeInput = document.getElementById("volumeInput");
  const calcBtn = document.getElementById("calcBtn");
  const calcPreview = document.getElementById("calcPreview");
  const deleteEntryBtn = document.getElementById("deleteEntry");
  const saveEntryBtn = document.getElementById("saveEntry");
  const cancelEntryBtn = document.getElementById("cancelEntry");

  const ruMonthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0..11
  let selectedDateIso = null;

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { entries: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.entries) return { entries: {} };
      return { entries: { ...parsed.entries } };
    } catch (e) {
      console.warn("Failed to read storage", e);
      return { entries: {} };
    }
  }

  function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function setEntry(dateIso, grams) {
    const store = readStore();
    if (grams > 0) {
      store.entries[dateIso] = { grams: Number(grams) };
    } else {
      delete store.entries[dateIso];
    }
    writeStore(store);
  }

  function removeEntry(dateIso) {
    const store = readStore();
    delete store.entries[dateIso];
    writeStore(store);
  }

  function getEntry(dateIso) {
    const store = readStore();
    return store.entries[dateIso] || null;
  }

  function formatGrams(grams) {
    if (grams == null) return "0 г";
    return `${Number(grams).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} г`;
  }

  function formatKcal(kcal) {
    return `${Math.round(kcal).toLocaleString("ru-RU")} ккал`;
  }

  function toIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function weekdayIndexMonFirst(jsWeekday) {
    // Переносим воскресенье (0) в конец: Пн=0 .. Вс=6
    return (jsWeekday + 6) % 7;
  }

  function buildCalendar(year, month) {
    calendarGridEl.innerHTML = "";

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = weekdayIndexMonFirst(firstOfMonth.getDay());
    const daysInMonth = getDaysInMonth(year, month);

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Дни предыдущего месяца (пустые, для выравнивания)
    for (let i = 0; i < startOffset; i++) {
      const dayEl = document.createElement("div");
      dayEl.className = "day outside";
      dayEl.setAttribute("aria-hidden", "true");
      const label = document.createElement("div");
      label.className = "day-number";
      label.textContent = String(prevMonthLastDay - startOffset + 1 + i);
      dayEl.appendChild(label);
      calendarGridEl.appendChild(dayEl);
    }

    const todayIso = toIsoDate(new Date());

    // Дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateIso = toIsoDate(date);
      const entry = getEntry(dateIso);

      const dayEl = document.createElement("div");
      dayEl.className = "day" + (dateIso === todayIso ? " today" : "") + (entry ? " has-entry" : "");
      dayEl.dataset.date = dateIso;
      dayEl.setAttribute("role", "button");
      dayEl.setAttribute("tabindex", "0");
      dayEl.setAttribute("aria-label", `День ${day}. ${entry ? `Записано ${entry.grams} г` : "Нет записи"}`);

      const label = document.createElement("div");
      label.className = "day-number";
      label.textContent = String(day);
      dayEl.appendChild(label);

      if (entry) {
        const grams = entry.grams;
        const kcal = grams * KCAL_PER_GRAM_ALCOHOL;
        const entryEl = document.createElement("div");
        entryEl.className = "entry";
        const gramsEl = document.createElement("div");
        gramsEl.className = "grams";
        gramsEl.textContent = formatGrams(grams);
        const kcalEl = document.createElement("div");
        kcalEl.className = "kcal";
        kcalEl.textContent = formatKcal(kcal);
        entryEl.appendChild(gramsEl);
        entryEl.appendChild(kcalEl);
        dayEl.appendChild(entryEl);
      }

      dayEl.addEventListener("click", () => openEntryDialog(dateIso));
      dayEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openEntryDialog(dateIso);
        }
      });

      calendarGridEl.appendChild(dayEl);
    }

    // Дополняем сетку до полного количества строк (42 ячейки = 6 недель)
    const totalCells = startOffset + daysInMonth;
    const trailing = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let i = 1; i <= trailing; i++) {
      const dayEl = document.createElement("div");
      dayEl.className = "day outside";
      dayEl.setAttribute("aria-hidden", "true");
      const label = document.createElement("div");
      label.className = "day-number";
      label.textContent = String(i);
      dayEl.appendChild(label);
      calendarGridEl.appendChild(dayEl);
    }
  }

  function computeMonthStats(year, month) {
    const store = readStore();
    const daysInMonth = getDaysInMonth(year, month);
    let totalGrams = 0;
    let totalKcal = 0;
    let daysWithEntry = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = toIsoDate(new Date(year, month, day));
      const entry = store.entries[dateIso];
      if (entry && entry.grams > 0) {
        const grams = Number(entry.grams);
        totalGrams += grams;
        totalKcal += grams * KCAL_PER_GRAM_ALCOHOL;
        daysWithEntry += 1;
      }
    }

    return { totalGrams, totalKcal, daysWithEntry };
  }

  function updateStats(year, month) {
    const { totalGrams, totalKcal, daysWithEntry } = computeMonthStats(year, month);
    totalAlcoholEl.textContent = formatGrams(totalGrams);
    totalCaloriesEl.textContent = formatKcal(totalKcal);
    const avg = daysWithEntry > 0 ? totalKcal / daysWithEntry : 0;
    avgCaloriesEl.textContent = `${Math.round(avg).toLocaleString("ru-RU")} ккал/день`;
  }

  function render() {
    monthLabelEl.textContent = `${ruMonthNames[currentMonth]} ${currentYear}`;
    buildCalendar(currentYear, currentMonth);
    updateStats(currentYear, currentMonth);
  }

  function openEntryDialog(dateIso) {
    selectedDateIso = dateIso;
    const entry = getEntry(dateIso);
    entryDateLabel.textContent = dateIso;
    alcoholInput.value = entry ? String(entry.grams) : "";
    calcPreview.textContent = "";
    if (typeof entryDialog.showModal === "function") {
      entryDialog.showModal();
    } else {
      // Базовый fallback
      entryDialog.setAttribute("open", "true");
    }
    setTimeout(() => alcoholInput.focus(), 0);
  }

  function closeEntryDialog() {
    if (entryDialog.open) entryDialog.close();
    selectedDateIso = null;
  }

  // Навигация по месяцам
  prevMonthBtn.addEventListener("click", () => {
    const d = new Date(currentYear, currentMonth, 1);
    d.setMonth(d.getMonth() - 1);
    currentYear = d.getFullYear();
    currentMonth = d.getMonth();
    render();
  });

  nextMonthBtn.addEventListener("click", () => {
    const d = new Date(currentYear, currentMonth, 1);
    d.setMonth(d.getMonth() + 1);
    currentYear = d.getFullYear();
    currentMonth = d.getMonth();
    render();
  });

  // Диалог: сохранение/удаление
  function doSave() {
    if (!selectedDateIso) { closeEntryDialog(); return; }
    const grams = Number(alcoholInput.value);
    if (!isFinite(grams) || grams < 0) {
      alert("Введите корректное значение граммов (>= 0)");
      return;
    }
    setEntry(selectedDateIso, grams);
    closeEntryDialog();
    render();
  }

  saveEntryBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    doSave();
  });

  deleteEntryBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!selectedDateIso) return closeEntryDialog();
    removeEntry(selectedDateIso);
    closeEntryDialog();
    render();
  });

  entryDialog.addEventListener("close", () => {
    selectedDateIso = null;
  });

  // Отмена
  cancelEntryBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeEntryDialog();
  });

  // Сохранение по Enter
  alcoholInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      doSave();
    }
  });

  // Калькулятор: граммы = объём(мл) * плотность этанола(0.789 г/мл) * (крепость/100)
  calcBtn.addEventListener("click", () => {
    const strength = Number(strengthInput.value);
    const volumeMl = Number(volumeInput.value);
    if (!isFinite(strength) || !isFinite(volumeMl) || strength <= 0 || volumeMl <= 0) {
      calcPreview.textContent = "Введите крепость и объём (> 0)";
      return;
    }
    const ethanolDensity = 0.789; // г/мл
    const grams = volumeMl * ethanolDensity * (strength / 100);
    const kcal = grams * KCAL_PER_GRAM_ALCOHOL;
    alcoholInput.value = grams.toFixed(1);
    calcPreview.textContent = `≈ ${formatGrams(grams)} • ${formatKcal(kcal)}`;
  });

  // Очистка месяца
  clearMonthBtn.addEventListener("click", () => {
    const confirmClear = confirm("Удалить все записи текущего месяца?");
    if (!confirmClear) return;
    const store = readStore();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateIso = toIsoDate(new Date(currentYear, currentMonth, day));
      delete store.entries[dateIso];
    }
    writeStore(store);
    render();
  });

  // Экспорт/импорт
  exportBtn.addEventListener("click", () => {
    const data = readStore();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alco-tracker-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  });

  importBtn.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== "object" || !json.entries || typeof json.entries !== "object") {
        alert("Неверный формат файла");
        return;
      }
      writeStore({ entries: json.entries });
      render();
    } catch (e) {
      alert("Не удалось импортировать файл");
      console.error(e);
    } finally {
      importFileInput.value = "";
    }
  });

  // Первичный рендер
  render();
})();