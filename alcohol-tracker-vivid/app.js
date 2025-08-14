"use strict";

const STORAGE_KEY = "ALC_TRACKER_V2_VIVID";
const ETHANOL_DENSITY_G_PER_ML = 0.789;

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

/** @type {{ [dateISO: string]: { typeId: string, volumeMl: number }[] }} */
let dateToEntries = {};
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth();

const monthLabelEl = document.getElementById("monthLabel");
const calendarGridEl = document.getElementById("calendarGrid");
const statsPeriodEl = document.getElementById("statsPeriod");
const statsTotalAlcoholEl = document.getElementById("statsTotalAlcohol");
const statsTotalCaloriesEl = document.getElementById("statsTotalCalories");
const statsAvgPerCalendarDayEl = document.getElementById("statsAvgPerCalendarDay");
const statsAvgPerDrinkingDayEl = document.getElementById("statsAvgPerDrinkingDay");
const dayModalEl = document.getElementById("dayModal");
const modalDateLabelEl = document.getElementById("modalDateLabel");
const entriesContainerEl = document.getElementById("entriesContainer");
const dayTotalAlcoholEl = document.getElementById("dayTotalAlcohol");
const dayTotalCaloriesEl = document.getElementById("dayTotalCalories");
const toastContainerEl = document.getElementById("toastContainer");

let modalDateISO = null;

init();

function init() {
	loadFromStorage();
	renderEverything();
	setupMonthButtons();
	setupModalButtons();
	setupEntriesListeners();
	initBackgroundCanvas();
}

function setupMonthButtons() {
	const prevBtn = document.getElementById("prevMonth");
	const nextBtn = document.getElementById("nextMonth");
	prevBtn.addEventListener("click", () => { shiftAndRender(-1); animateMonthEnter("left"); });
	nextBtn.addEventListener("click", () => { shiftAndRender(1); animateMonthEnter("right"); });
}

function shiftAndRender(delta) {
	const shifted = shiftMonth(currentYear, currentMonthIndex, delta);
	currentYear = shifted.year;
	currentMonthIndex = shifted.monthIndex;
	renderEverything();
}

function setupModalButtons() {
	document.getElementById("addEntryRow").addEventListener("click", () => { appendEntryRow(); updateDayTotalsFromUI(); });
	document.getElementById("clearDay").addEventListener("click", () => {
		if (!modalDateISO) return;
		delete dateToEntries[modalDateISO];
		saveToStorage();
		closeModal();
		showToast("День очищен");
		renderEverything();
	});
	document.getElementById("saveDay").addEventListener("click", () => {
		if (!modalDateISO) return;
		const collected = collectEntriesFromUI();
		if (collected.length === 0) {
			delete dateToEntries[modalDateISO];
			showToast("Пустая запись не сохранена");
		} else {
			dateToEntries[modalDateISO] = collected;
			showToast("Сохранено");
			launchConfetti();
		}
		saveToStorage();
		closeModal();
		renderEverything();
	});
	document.getElementById("cancelModal").addEventListener("click", closeModal);
	document.getElementById("closeModal").addEventListener("click", closeModal);
	dayModalEl.addEventListener("click", (evt) => {
		const target = /** @type {HTMLElement} */ (evt.target);
		if (target.dataset.close === "true") closeModal();
	});
}

function setupEntriesListeners() {
	entriesContainerEl.addEventListener("input", (evt) => {
		const target = /** @type {HTMLElement} */ (evt.target);
		if (target.tagName === "SELECT" || target.tagName === "INPUT") updateDayTotalsFromUI();
	});
}

function loadFromStorage() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		dateToEntries = raw ? JSON.parse(raw) : {};
		if (typeof dateToEntries !== "object" || dateToEntries === null) dateToEntries = {};
	} catch (_) { dateToEntries = {}; }
}

function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(dateToEntries)); }

function renderEverything() {
	renderMonthHeader();
	renderCalendarGrid();
	renderStats();
}

function renderMonthHeader() {
	const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
	monthLabelEl.textContent = `${MONTHS[currentMonthIndex]} ${currentYear}`;
	statsPeriodEl.textContent = `${MONTHS[currentMonthIndex]} ${currentYear}`;
}

function renderCalendarGrid() {
	calendarGridEl.innerHTML = "";
	const firstOfMonth = new Date(Date.UTC(currentYear, currentMonthIndex, 1));
	const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
	const firstWeekday = getMondayFirstWeekdayIndex(firstOfMonth);
	const cellsBefore = firstWeekday;
	const totalCells = Math.ceil((cellsBefore + daysInMonth) / 7) * 7;
	const todayISO = toDateISO(new Date());

	for (let idx = 0; idx < totalCells; idx++) {
		const cellEl = document.createElement("div");
		cellEl.className = "day-cell";
		const dayNumber = idx - cellsBefore + 1;
		const isCurrentMonthDay = dayNumber >= 1 && dayNumber <= daysInMonth;
		if (!isCurrentMonthDay) {
			cellEl.classList.add("outside");
			cellEl.innerHTML = `<div class=\"day-num muted\">&nbsp;</div>`;
			calendarGridEl.appendChild(cellEl);
			continue;
		}
		const dateObj = new Date(Date.UTC(currentYear, currentMonthIndex, dayNumber));
		const dateISO = toDateISO(dateObj);
		if (dateISO === todayISO) cellEl.classList.add("today");
		const entries = dateToEntries[dateISO] || [];
		const { totalAlcoholGrams, totalCalories } = computeTotals(entries);
		const summaryHtml = entries.length > 0
			? `<div class=\"summary\">${formatGrams(totalAlcoholGrams)} г алкоголя<br>${Math.round(totalCalories)} ккал</div>`
			: `<div class=\"summary muted small\">Нет записей</div>`;
		cellEl.innerHTML = `<div class=\"day-num\">${dayNumber}</div>${summaryHtml}`;
		cellEl.addEventListener("click", (ev) => handleDayCellClick(ev, dateObj, cellEl));
		calendarGridEl.appendChild(cellEl);
	}
}

function renderStats() {
	const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
	let totalAlcoholGrams = 0, totalCalories = 0, daysWithEntries = 0;
	for (let day = 1; day <= daysInMonth; day++) {
		const iso = toDateISO(new Date(Date.UTC(currentYear, currentMonthIndex, day)));
		const entries = dateToEntries[iso] || [];
		if (entries.length) {
			daysWithEntries++;
			const sums = computeTotals(entries);
			totalAlcoholGrams += sums.totalAlcoholGrams;
			totalCalories += sums.totalCalories;
		}
	}
	statsTotalAlcoholEl.textContent = `${formatGrams(totalAlcoholGrams)}`;
	statsTotalCaloriesEl.textContent = `${Math.round(totalCalories)}`;
	statsAvgPerCalendarDayEl.textContent = `${Math.round(totalCalories / daysInMonth)}`;
	statsAvgPerDrinkingDayEl.textContent = `${Math.round(daysWithEntries ? totalCalories / daysWithEntries : 0)}`;
}

function openDayModal(dateObj) {
	modalDateISO = toDateISO(dateObj);
	modalDateLabelEl.textContent = formatDateHuman(dateObj);
	entriesContainerEl.innerHTML = "";
	const entries = dateToEntries[modalDateISO] || [];
	if (!entries.length) appendEntryRow(); else entries.forEach((e) => appendEntryRow(e));
	updateDayTotalsFromUI();
	dayModalEl.classList.remove("hidden");
	dayModalEl.setAttribute("aria-hidden", "false");
	const content = dayModalEl.querySelector(".modal-content");
	if (content) {
		content.classList.remove("closing");
		content.classList.add("pop");
		content.addEventListener("animationend", () => content.classList.remove("pop"), { once: true });
	}
}

function closeModal() {
	const content = dayModalEl.querySelector(".modal-content");
	if (content) {
		content.classList.add("closing");
		content.addEventListener("animationend", () => {
			dayModalEl.classList.add("hidden");
			dayModalEl.setAttribute("aria-hidden", "true");
			content.classList.remove("closing");
			modalDateISO = null;
		}, { once: true });
	} else {
		dayModalEl.classList.add("hidden");
		dayModalEl.setAttribute("aria-hidden", "true");
		modalDateISO = null;
	}
}

function appendEntryRow(initial) {
	const rowEl = document.createElement("div"); rowEl.className = "entry-row";
	const selectEl = document.createElement("select");
	for (const b of BEVERAGE_TYPES) { const opt = document.createElement("option"); opt.value = b.id; opt.textContent = b.name; selectEl.appendChild(opt); }
	const inputEl = document.createElement("input"); inputEl.type = "number"; inputEl.min = "0"; inputEl.step = "50"; inputEl.placeholder = "мл";
	const removeBtn = document.createElement("button"); removeBtn.type = "button"; removeBtn.className = "remove-row"; removeBtn.textContent = "Удалить";
	removeBtn.addEventListener("click", () => { rowEl.remove(); updateDayTotalsFromUI(); });
	if (initial) { selectEl.value = initial.typeId; inputEl.value = String(initial.volumeMl); }
	rowEl.appendChild(selectEl); rowEl.appendChild(inputEl); rowEl.appendChild(removeBtn); entriesContainerEl.appendChild(rowEl);
}

function collectEntriesFromUI() {
	const result = []; const rows = entriesContainerEl.querySelectorAll(".entry-row");
	rows.forEach((row) => { const s = row.querySelector("select"); const i = row.querySelector("input"); const vol = Number(i.value); if (!s.value) return; if (!(vol > 0)) return; result.push({ typeId: s.value, volumeMl: vol }); });
	return result;
}

function updateDayTotalsFromUI() {
	const totals = computeTotals(collectEntriesFromUI());
	dayTotalAlcoholEl.textContent = `${formatGrams(totals.totalAlcoholGrams)} г`;
	dayTotalCaloriesEl.textContent = `${Math.round(totals.totalCalories)} ккал`;
}

function computeTotals(entries) {
	let totalAlcoholGrams = 0, totalCalories = 0;
	for (const entry of entries) {
		const drink = BEVERAGE_TYPES.find((d) => d.id === entry.typeId) || BEVERAGE_TYPES[0];
		const ethanolMl = entry.volumeMl * (drink.abvPercent / 100);
		const ethanolGrams = ethanolMl * ETHANOL_DENSITY_G_PER_ML;
		const calories = (entry.volumeMl / 100) * drink.kcalPer100ml;
		totalAlcoholGrams += ethanolGrams; totalCalories += calories;
	}
	return { totalAlcoholGrams, totalCalories };
}

function getDaysInMonth(year, monthIndex) { return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(); }
function getMondayFirstWeekdayIndex(dateObj) { const js = dateObj.getUTCDay(); return (js + 6) % 7; }
function shiftMonth(year, monthIndex, delta) { const d = new Date(Date.UTC(year, monthIndex + delta, 1)); return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() }; }
function toDateISO(dateObj) { const y = dateObj.getUTCFullYear(); const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0"); const d = String(dateObj.getUTCDate()).padStart(2, "0"); return `${y}-${m}-${d}`; }
function formatDateHuman(dateObj) { const day = String(dateObj.getUTCDate()).padStart(2, "0"); const M = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]; return `${day} ${M[dateObj.getUTCMonth()]} ${dateObj.getUTCFullYear()}`; }
function formatGrams(v) { return Math.round(v * 10) / 10; }

function handleDayCellClick(ev, dateObj, cellEl) { createRipple(ev, cellEl); openDayModal(dateObj); }
function createRipple(ev, el) { const r = el.getBoundingClientRect(); const x = ev.clientX - r.left; const y = ev.clientY - r.top; const s = document.createElement("span"); s.className = "ripple"; s.style.left = `${x}px`; s.style.top = `${y}px`; el.appendChild(s); setTimeout(() => s.remove(), 700); }
function animateMonthEnter(dir) { const cls = dir === "left" ? "enter-left" : "enter-right"; calendarGridEl.classList.remove("enter-left","enter-right"); void calendarGridEl.offsetWidth; calendarGridEl.classList.add(cls); calendarGridEl.addEventListener("animationend", () => calendarGridEl.classList.remove(cls), { once: true }); }
function showToast(text) { if (!toastContainerEl) return; const t = document.createElement("div"); t.className = "toast"; t.textContent = text; toastContainerEl.appendChild(t); setTimeout(() => { t.style.transition = "opacity 240ms ease, transform 240ms ease"; t.style.opacity = "0"; t.style.transform = "translateY(6px)"; setTimeout(() => t.remove(), 260); }, 1600); }
function launchConfetti() { const colors = ["#F43F5E","#FB923C","#F59E0B","#22C55E","#06B6D4","#6366F1","#A78BFA","#EC4899"]; const count = 100; for (let i=0;i<count;i++){ const p=document.createElement("div"); p.className="confetti-piece"; p.style.left=`${Math.random()*100}vw`; p.style.background=colors[i%colors.length]; p.style.transform=`translateY(-10px) rotate(0deg)`; document.body.appendChild(p); const fall=110+Math.random()*20; const drift=(Math.random()-0.5)*80; const rot=(Math.random()-0.5)*900; const dur=900+Math.random()*1100; requestAnimationFrame(()=>{ p.style.transition=`transform ${dur}ms cubic-bezier(.3,.7,.1,1)`; p.style.transform=`translate(${drift}px, ${fall}vh) rotate(${rot}deg)`; }); setTimeout(()=>p.remove(), dur+250);} }

// Background canvas animation: neon orbs
function initBackgroundCanvas() {
	const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("bgCanvas"));
	if (!canvas) return;
	const ctx = canvas.getContext("2d", { alpha: true });
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	let width = 0, height = 0, orbs = [], rafId = 0;
	const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	function resize() {
		width = canvas.clientWidth = window.innerWidth;
		height = canvas.clientHeight = window.innerHeight;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	function makeOrbs(count) {
		orbs = [];
		for (let i=0;i<count;i++) {
			const hue = Math.floor(200 + Math.random()*160); // 200..360
			orbs.push({
				x: Math.random()*width,
				y: Math.random()*height,
				r: 80 + Math.random()*140,
				dx: (-0.3 + Math.random()*0.6) * (width/800),
				dy: (-0.3 + Math.random()*0.6) * (height/800),
				h: hue,
				alpha: 0.16 + Math.random()*0.22
			});
		}
	}
	function tick() {
		ctx.clearRect(0,0,width,height);
		ctx.globalCompositeOperation = "lighter";
		for (const o of orbs) {
			const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
			grad.addColorStop(0, `hsla(${o.h},95%,60%,${o.alpha})`);
			grad.addColorStop(1, `hsla(${(o.h+40)%360},90%,50%,0)`);
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
			ctx.fill();
			o.x += o.dx; o.y += o.dy;
			if (o.x < -o.r) o.x = width + o.r; if (o.x > width + o.r) o.x = -o.r;
			if (o.y < -o.r) o.y = height + o.r; if (o.y > height + o.r) o.y = -o.r;
		}
		ctx.globalCompositeOperation = "source-over";
		rafId = requestAnimationFrame(tick);
	}
	window.addEventListener("resize", () => { resize(); makeOrbs(orbs.length||10); }, { passive: true });
	resize();
	makeOrbs(window.innerWidth < 600 ? 8 : 12);
	if (!prefersReduced) rafId = requestAnimationFrame(tick);
}