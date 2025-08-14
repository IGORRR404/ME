"use strict";

/**
 * Alcohol tracker app: calendar input per day, total alcohol grams, and calories stats.
 * Data saved in localStorage under key ALC_TRACKER_V1.
 */

const STORAGE_KEY = "ALC_TRACKER_V1";
const ETHANOL_DENSITY_G_PER_ML = 0.789;

/**
 * Drink dictionary with ABV and calories per 100ml (approximate typical values).
 */
const BEVERAGE_TYPES = [
	{ id: "beer", name: "Пиво (5%)", abvPercent: 5, kcalPer100ml: 43 },
	{ id: "cider", name: "Сидр (4.5%)", abvPercent: 4.5, kcalPer100ml: 50 },
	{ id: "wine_red", name: "Вино красное (12%)", abvPercent: 12, kcalPer100ml: 85 },
	{ id: "wine_white", name: "Вино белое (11%)", abvPercent: 11, kcalPer100ml: 80 },
	{ id: "champagne", name: "Игристое (11%)", abvPercent: 11, kcalPer100ml: 76 },
	{ id: "vodka", name: "Водка (40%)", abvPercent: 40, kcalPer100ml: 231 },
	{ id: "whiskey", name: "Виски (40%)", abvPercent: 40, kcalPer100ml: 250 },
	{ id: "gin", name: "Джин (40%)", abvPercent: 40, kcalPer100ml: 263 },
	{ id: "rum", name: "Ром (40%)", abvPercent: 40, kcalPer100ml: 231 }
];

/**
 * @typedef {Object} DayEntry
 * @property {string} typeId
 * @property {number} volumeMl
 */

/** @type {{ [dateISO: string]: DayEntry[] }} */
let dateToEntries = {};

let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth(); // 0-11

const monthLabelEl = document.getElementById("monthLabel");
const calendarGridEl = document.getElementById("calendarGrid");
const statsPeriodEl = document.getElementById("statsPeriod");
const statsTotalAlcoholEl = document.getElementById("statsTotalAlcohol");
const statsTotalCaloriesEl = document.getElementById("statsTotalCalories");
const statsAvgPerCalendarDayEl = document.getElementById("statsAvgPerCalendarDay");
const statsAvgPerDrinkingDayEl = document.getElementById("statsAvgPerDrinkingDay");

// Modal elements
const dayModalEl = document.getElementById("dayModal");
const modalDateLabelEl = document.getElementById("modalDateLabel");
const entriesContainerEl = document.getElementById("entriesContainer");
const dayTotalAlcoholEl = document.getElementById("dayTotalAlcohol");
const dayTotalCaloriesEl = document.getElementById("dayTotalCalories");

let modalDateISO = null; // YYYY-MM-DD for currently edited day

// Init
loadFromStorage();
renderEverything();

document.getElementById("prevMonth").addEventListener("click", () => {
	const prev = shiftMonth(currentYear, currentMonthIndex, -1);
	currentYear = prev.year;
	currentMonthIndex = prev.monthIndex;
	renderEverything();
});

document.getElementById("nextMonth").addEventListener("click", () => {
	const next = shiftMonth(currentYear, currentMonthIndex, 1);
	currentYear = next.year;
	currentMonthIndex = next.monthIndex;
	renderEverything();
});

document.getElementById("addEntryRow").addEventListener("click", () => {
	appendEntryRow();
	updateDayTotalsFromUI();
});

document.getElementById("clearDay").addEventListener("click", () => {
	if (!modalDateISO) return;
	delete dateToEntries[modalDateISO];
	saveToStorage();
	closeModal();
	renderEverything();
});

document.getElementById("saveDay").addEventListener("click", () => {
	if (!modalDateISO) return;
	const collected = collectEntriesFromUI();
	if (collected.length === 0) {
		delete dateToEntries[modalDateISO];
	} else {
		dateToEntries[modalDateISO] = collected;
	}
	saveToStorage();
	closeModal();
	renderEverything();
});

document.getElementById("cancelModal").addEventListener("click", closeModal);

document.getElementById("closeModal").addEventListener("click", closeModal);

// Close on backdrop click

dayModalEl.addEventListener("click", (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);
	if (target.dataset.close === "true") {
		closeModal();
	}
});

// Recompute totals when inputs change
entriesContainerEl.addEventListener("input", (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);
	if (target.tagName === "SELECT" || target.tagName === "INPUT") {
		updateDayTotalsFromUI();
	}
});

function renderEverything() {
	renderMonthHeader();
	renderCalendarGrid();
	renderStats();
}

function loadFromStorage() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		dateToEntries = raw ? JSON.parse(raw) : {};
		if (typeof dateToEntries !== "object" || dateToEntries === null) {
			dateToEntries = {};
		}
	} catch (e) {
		dateToEntries = {};
	}
}

function saveToStorage() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(dateToEntries));
}

function renderMonthHeader() {
	const monthNames = [
		"Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
		"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
	];
	monthLabelEl.textContent = `${monthNames[currentMonthIndex]} ${currentYear}`;
	statsPeriodEl.textContent = `${monthNames[currentMonthIndex]} ${currentYear}`;
}

function renderCalendarGrid() {
	calendarGridEl.innerHTML = "";

	const firstOfMonth = new Date(Date.UTC(currentYear, currentMonthIndex, 1));
	const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);

	// Monday-first index for the first day
	const firstWeekday = getMondayFirstWeekdayIndex(firstOfMonth); // 0..6
	const cellsBefore = firstWeekday; // number of leading empty cells

	const totalCells = Math.ceil((cellsBefore + daysInMonth) / 7) * 7; // full weeks grid
	const todayISO = toDateISO(new Date());

	for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
		const cellEl = document.createElement("div");
		cellEl.className = "day-cell";

		const dayNumber = cellIndex - cellsBefore + 1;
		const isCurrentMonthDay = dayNumber >= 1 && dayNumber <= daysInMonth;

		if (!isCurrentMonthDay) {
			cellEl.classList.add("outside");
			cellEl.innerHTML = `<div class="day-num muted">&nbsp;</div>`;
			calendarGridEl.appendChild(cellEl);
			continue;
		}

		const dateObj = new Date(Date.UTC(currentYear, currentMonthIndex, dayNumber));
		const dateISO = toDateISO(dateObj);

		if (dateISO === todayISO) {
			cellEl.classList.add("today");
		}

		const entries = dateToEntries[dateISO] || [];
		const { totalAlcoholGrams, totalCalories } = computeTotals(entries);

		const summaryHtml = entries.length > 0
			? `<div class="summary">${formatGrams(totalAlcoholGrams)} г алкоголя<br>${Math.round(totalCalories)} ккал</div>`
			: `<div class="summary muted small">Нет записей</div>`;

		cellEl.innerHTML = `
			<div class="day-num">${dayNumber}</div>
			${summaryHtml}
		`;

		cellEl.addEventListener("click", () => openDayModal(dateObj));
		calendarGridEl.appendChild(cellEl);
	}
}

function renderStats() {
	const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
	let totalAlcoholGrams = 0;
	let totalCalories = 0;
	let daysWithEntries = 0;

	for (let day = 1; day <= daysInMonth; day++) {
		const dateISO = toDateISO(new Date(Date.UTC(currentYear, currentMonthIndex, day)));
		const entries = dateToEntries[dateISO] || [];
		if (entries.length > 0) {
			daysWithEntries += 1;
			const totals = computeTotals(entries);
			totalAlcoholGrams += totals.totalAlcoholGrams;
			totalCalories += totals.totalCalories;
		}
	}

	statsTotalAlcoholEl.textContent = `${formatGrams(totalAlcoholGrams)}`;
	statsTotalCaloriesEl.textContent = `${Math.round(totalCalories)}`;

	const avgPerCalendarDay = totalCalories / daysInMonth;
	const avgPerDrinkingDay = daysWithEntries > 0 ? totalCalories / daysWithEntries : 0;
	statsAvgPerCalendarDayEl.textContent = `${Math.round(avgPerCalendarDay)}`;
	statsAvgPerDrinkingDayEl.textContent = `${Math.round(avgPerDrinkingDay)}`;
}

function openDayModal(dateObj) {
	modalDateISO = toDateISO(dateObj);
	modalDateLabelEl.textContent = formatDateHuman(dateObj);
	entriesContainerEl.innerHTML = "";

	const entries = dateToEntries[modalDateISO] || [];
	if (entries.length === 0) {
		appendEntryRow();
	} else {
		for (const entry of entries) {
			appendEntryRow(entry);
		}
	}

	updateDayTotalsFromUI();
	dayModalEl.classList.remove("hidden");
	dayModalEl.setAttribute("aria-hidden", "false");
}

function closeModal() {
	dayModalEl.classList.add("hidden");
	dayModalEl.setAttribute("aria-hidden", "true");
	modalDateISO = null;
}

/**
 * @param {DayEntry=} initial
 */
function appendEntryRow(initial) {
	const rowEl = document.createElement("div");
	rowEl.className = "entry-row";

	const selectEl = document.createElement("select");
	for (const b of BEVERAGE_TYPES) {
		const opt = document.createElement("option");
		opt.value = b.id;
		opt.textContent = b.name;
		selectEl.appendChild(opt);
	}

	const inputEl = document.createElement("input");
	inputEl.type = "number";
	inputEl.min = "0";
	inputEl.step = "50";
	inputEl.placeholder = "мл";

	const removeBtn = document.createElement("button");
	removeBtn.type = "button";
	removeBtn.className = "remove-row";
	removeBtn.textContent = "Удалить";
	removeBtn.addEventListener("click", () => {
		rowEl.remove();
		updateDayTotalsFromUI();
	});

	if (initial) {
		selectEl.value = initial.typeId;
		inputEl.value = String(initial.volumeMl);
	}

	rowEl.appendChild(selectEl);
	rowEl.appendChild(inputEl);
	rowEl.appendChild(removeBtn);
	entriesContainerEl.appendChild(rowEl);
}

function collectEntriesFromUI() {
	/** @type {DayEntry[]} */
	const result = [];
	const rows = entriesContainerEl.querySelectorAll(".entry-row");
	rows.forEach((row) => {
		const select = /** @type {HTMLSelectElement} */ (row.querySelector("select"));
		const input = /** @type {HTMLInputElement} */ (row.querySelector("input"));
		const vol = Number(input.value);
		if (!select.value) return;
		if (!(vol > 0)) return;
		result.push({ typeId: select.value, volumeMl: vol });
	});
	return result;
}

function updateDayTotalsFromUI() {
	const collected = collectEntriesFromUI();
	const totals = computeTotals(collected);
	dayTotalAlcoholEl.textContent = `${formatGrams(totals.totalAlcoholGrams)} г`;
	dayTotalCaloriesEl.textContent = `${Math.round(totals.totalCalories)} ккал`;
}

/**
 * @param {DayEntry[]} entries
 */
function computeTotals(entries) {
	let totalAlcoholGrams = 0;
	let totalCalories = 0;

	for (const entry of entries) {
		const drink = BEVERAGE_TYPES.find((d) => d.id === entry.typeId) || BEVERAGE_TYPES[0];
		const ethanolMl = entry.volumeMl * (drink.abvPercent / 100);
		const ethanolGrams = ethanolMl * ETHANOL_DENSITY_G_PER_ML;
		const calories = (entry.volumeMl / 100) * drink.kcalPer100ml;
		totalAlcoholGrams += ethanolGrams;
		totalCalories += calories;
	}

	return { totalAlcoholGrams, totalCalories };
}

function getDaysInMonth(year, monthIndex) {
	return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function getMondayFirstWeekdayIndex(dateObj) {
	// JS: 0=Sun..6=Sat. Convert to Monday-first: 0=Mon..6=Sun
	const js = dateObj.getUTCDay();
	return (js + 6) % 7;
}

function shiftMonth(year, monthIndex, delta) {
	const newMonthIndex = monthIndex + delta;
	const d = new Date(Date.UTC(year, newMonthIndex, 1));
	return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

function toDateISO(dateObj) {
	const y = dateObj.getUTCFullYear();
	const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
	const d = String(dateObj.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatDateHuman(dateObj) {
	const day = String(dateObj.getUTCDate()).padStart(2, "0");
	const monthNamesGen = [
		"января", "февраля", "марта", "апреля", "мая", "июня",
		"июля", "августа", "сентября", "октября", "ноября", "декабря"
	];
	const monthText = monthNamesGen[dateObj.getUTCMonth()];
	const year = dateObj.getUTCFullYear();
	return `${day} ${monthText} ${year}`;
}

function formatGrams(value) {
	return Math.round(value * 10) / 10; // 1 decimal
}