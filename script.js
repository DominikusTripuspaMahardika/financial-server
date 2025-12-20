/* ================= CONFIG ================= */
const financialAnalystKey = "financial-analyst-data";
const financialAnalystArchiveKey = "financial-analyst-archive";
const financialAnalystSavingsKey = "financial-analyst-savings";
let financialAnalystEditId = null;
let financialAnalystDeleteId = null;
let financialAnalystPage = 1;
const financialAnalystLimit = 8;
let financialAnalystKeyword = "";
let financialAnalystArchiveDeleteTimers = {};

/* ================= VISIBILITY ================= */
let financialAnalystHideNominal =
  localStorage.getItem("financial-analyst-hide-nominal") === "true";

/* ================= UTIL ================= */
const rupiah = n =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR"
  }).format(n);

const getData = () =>
  JSON.parse(localStorage.getItem(financialAnalystKey)) || [];

const saveData = d =>
  localStorage.setItem(financialAnalystKey, JSON.stringify(d));

const getArchive = () =>
  JSON.parse(localStorage.getItem(financialAnalystArchiveKey)) || [];

const saveArchive = d =>
  localStorage.setItem(financialAnalystArchiveKey, JSON.stringify(d));

function financialAnalystHighlight(text, keyword) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, `<span class="financial-analyst-highlight">$1</span>`);
}

function financialAnalystToast(message) {
  const toast = document.getElementById("financial-analyst-toast");
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add("show");

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

const getSavings = () =>
  JSON.parse(localStorage.getItem(financialAnalystSavingsKey)) || {
    target: 0,
    current: 0
  };

const saveSavings = d =>
  localStorage.setItem(financialAnalystSavingsKey, JSON.stringify(d));
/* ================= PIN ================= */
function financialAnalystTogglePin(id) {
  const data = getData().map(d =>
    d.id === id ? { ...d, pinned: !d.pinned } : d
  );
  saveData(data);
  financialAnalystUpdateUI();
  financialAnalystUpdateVisibility();
}

function getCurrentMonthKey() {
  const now = new Date();
  return now.toISOString().slice(0, 7); // YYYY-MM
}

function calculateMonthlyBalances() {
  const data = getData();
  const monthlyBalance = {};

  data.forEach(d => {
    const month = d.tanggal.slice(0, 7); // YYYY-MM
    if (!monthlyBalance[month]) monthlyBalance[month] = 0;

    if (d.jenis === "pemasukan") {
      monthlyBalance[month] += d.jumlah;
    } else {
      monthlyBalance[month] -= d.jumlah;
    }
  });

  return monthlyBalance;
}

/* ================= SEARCH ================= */
function financialAnalystSearch(keyword) {
  financialAnalystKeyword = keyword.toLowerCase();
  financialAnalystPage = 1;
  financialAnalystUpdateUI();
  financialAnalystUpdateVisibility();
}

function financialAnalystResetSearch() {
  financialAnalystKeyword = "";
  document.getElementById("financial-analyst-search").value = "";
  financialAnalystPage = 1;
  financialAnalystUpdateUI();
  financialAnalystUpdateVisibility();
}

let savingsAnimationFrame = null;

function animateProgressBar(from, to) {
  cancelAnimationFrame(savingsAnimationFrame);
  const bar = document.getElementById("savings-progress-bar");
  const duration = 500;
  const start = performance.now();

  function animate(time) {
    const progress = Math.min((time - start) / duration, 1);
    const value = from + (to - from) * progress;
    bar.style.width = value + "%";

    if (progress < 1) {
      savingsAnimationFrame = requestAnimationFrame(animate);
    }
  }
  savingsAnimationFrame = requestAnimationFrame(animate);
}

function financialAnalystUpdateSavings() {
  const monthlyBalances = calculateMonthlyBalances();

  let totalSavings = 0;

  Object.values(monthlyBalances).forEach(balance => {
    if (balance > 0) totalSavings += balance;
  });

  const savings = getSavings();
  const prevPercent = savings.target
    ? Math.min((savings.current / savings.target) * 100, 100)
    : 0;

  savings.current = totalSavings;
  saveSavings(savings);

  const newPercent = savings.target
    ? Math.min((totalSavings / savings.target) * 100, 100)
    : 0;

  document.getElementById("savings-current").innerText = rupiah(totalSavings);
  document.getElementById("savings-target").innerText = rupiah(savings.target);

  animateProgressBar(prevPercent, newPercent);
}

/* ================= VISIBILITY ================= */
function financialAnalystToggleVisibility() {
  financialAnalystHideNominal = !financialAnalystHideNominal;
  localStorage.setItem(
    "financial-analyst-hide-nominal",
    financialAnalystHideNominal
  );
  financialAnalystUpdateVisibility();
}

function financialAnalystUpdateVisibility() {
  const eye = document.getElementById("financial-analyst-eye");
  document
    .querySelectorAll(
      "#financial-analyst-total-saldo, #financial-analyst-total-masuk, #financial-analyst-total-keluar, .financial-analyst-amount, #savings-current, #savings-target"
    )
    .forEach(el =>
      el.classList.toggle("financial-analyst-blur", financialAnalystHideNominal)
    );

  if (eye) {
    eye.className = financialAnalystHideNominal
      ? "fa-solid fa-eye-slash eye-closed"
      : "fa-solid fa-eye eye-open";
  }
}

/* ================= ARCHIVE ================= */
function financialAnalystArchive(id) {
  const data = getData();
  const item = data.find(d => d.id === id);
  if (!item) return;

  saveData(data.filter(d => d.id !== id));
  saveArchive([item, ...getArchive()]);
  financialAnalystUpdateUI();
  financialAnalystUpdateSavings();
  financialAnalystUpdateVisibility();
  financialAnalystToast("Berhasil diarsipkan");
}

function financialAnalystOpenArchive() {
  const list = document.getElementById("financial-analyst-archive-list");
  const emptyText = document.getElementById("archive-empty-text");

  list.innerHTML = "";

  const archiveData = getArchive();

  // TOGGLE EMPTY STATE
  if (archiveData.length === 0) {
    emptyText.style.display = "block";
  } else {
    emptyText.style.display = "none";
  }

  archiveData.forEach(d => {
    const li = document.createElement("li");
    li.dataset.id = d.id;

    li.innerHTML = `
      <div class="archive-info">
        <strong>${d.tanggal}</strong><br>
        <small>${d.deskripsi}</small>
      </div>

      <div class="archive-actions">
        <span class="archive-countdown" style="display:none">5</span>
        <i class="fa-solid fa-xmark archive-cancel" style="display:none"></i>
        <i class="fa-solid fa-rotate-left financial-analyst-restore-icon"></i>
      </div>
    `;

    const restoreBtn = li.querySelector(".financial-analyst-restore-icon");
    const cancelBtn = li.querySelector(".archive-cancel");

    restoreBtn.onclick = e => {
      e.stopPropagation();
      financialAnalystRestore(d.id);
    };

    cancelBtn.onclick = e => {
      e.stopPropagation();
      financialAnalystCancelArchiveDelete(d.id);
    };

    li.onclick = () => {
      financialAnalystConfirmArchiveDelete(d.id);
    };

    list.appendChild(li);
  });

  document.getElementById("financial-analyst-modal-archive").style.display =
    "block";
}

function financialAnalystConfirmArchiveDelete(id) {
  if (financialAnalystArchiveDeleteTimers[id]) return;

  const li = document.querySelector(`#financial-analyst-archive-list li[data-id="${id}"]`);
  if (!li) return;

  const countdownEl = li.querySelector(".archive-countdown");
  const cancelBtn = li.querySelector(".archive-cancel");
  const restoreBtn = li.querySelector(".financial-analyst-restore-icon");

  let timeLeft = 5;

  countdownEl.innerText = timeLeft;
  countdownEl.style.display = "inline-block";
  cancelBtn.style.display = "inline-block";
  restoreBtn.style.display = "none";

  financialAnalystToast("Penghapusan arsip dalam 5 detik");

  financialAnalystArchiveDeleteTimers[id] = setInterval(() => {
    timeLeft--;
    countdownEl.innerText = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(financialAnalystArchiveDeleteTimers[id]);
      delete financialAnalystArchiveDeleteTimers[id];
      financialAnalystDeleteArchiveFinal(id);
    }
  }, 1000);
}

function financialAnalystCancelArchiveDelete(id) {
  clearInterval(financialAnalystArchiveDeleteTimers[id]);
  delete financialAnalystArchiveDeleteTimers[id];

  const li = document.querySelector(`#financial-analyst-archive-list li[data-id="${id}"]`);
  if (!li) return;

  li.querySelector(".archive-countdown").style.display = "none";
  li.querySelector(".archive-cancel").style.display = "none";
  li.querySelector(".financial-analyst-restore-icon").style.display = "inline-block";

  financialAnalystToast("Penghapusan dibatalkan");
}

function financialAnalystDeleteArchiveFinal(id) {
  saveArchive(getArchive().filter(d => d.id !== id));
  financialAnalystOpenArchive();
  financialAnalystToast("Arsip berhasil dihapus");
}

function financialAnalystCloseArchive() {
  document.getElementById("financial-analyst-modal-archive").style.display =
    "none";
}

function financialAnalystRestore(id) {
  const archive = getArchive();
  const item = archive.find(d => d.id === id);
  if (!item) return;

  saveArchive(archive.filter(d => d.id !== id));
  saveData([item, ...getData()]);
  financialAnalystOpenArchive();
  financialAnalystUpdateUI();
  financialAnalystUpdateSavings();
  financialAnalystUpdateVisibility();
}

/* ================= UI UPDATE ================= */
function financialAnalystUpdateUI() {
  const list = document.getElementById("financial-analyst-transaction-list");
  list.innerHTML = "";

  let data = getData().filter(d =>
    (d.deskripsi || "").toLowerCase().includes(financialAnalystKeyword) ||
    (d.tipe || "").toLowerCase().includes(financialAnalystKeyword) ||
    d.tanggal.includes(financialAnalystKeyword)
  );

  data.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.id - a.id;
  });

  if ((financialAnalystPage - 1) * financialAnalystLimit >= data.length) {
    financialAnalystPage = 1;
  }

  const start = (financialAnalystPage - 1) * financialAnalystLimit;
  const paginated = data.slice(start, start + financialAnalystLimit);

  const currentMonth = getCurrentMonthKey();
  let masuk = 0;
  let keluar = 0;

  getData().forEach(d => {
    if (d.tanggal.startsWith(currentMonth)) {
      if (d.jenis === "pemasukan") masuk += d.jumlah;
      if (d.jenis === "pengeluaran") keluar += d.jumlah;
    }
  });

  paginated.forEach(d => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div>
        <strong>${financialAnalystHighlight(d.tanggal, financialAnalystKeyword)}</strong><br>
        <small>${financialAnalystHighlight(d.tipe, financialAnalystKeyword)}</small>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <i class="fa-${d.pinned ? "solid" : "regular"} fa-star financial-analyst-pin"
           onclick="event.stopPropagation();financialAnalystTogglePin(${d.id})"></i>
        <strong class="financial-analyst-amount"
          style="color:${d.jenis === "pemasukan" ? "#2ecc71" : "#e74c3c"}">
          ${rupiah(d.jumlah)}
        </strong>
      </div>
    `;

    let startX = 0;
    let isSwiping = false;
    let pressTimer;

    li.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      isSwiping = false;
      pressTimer = setTimeout(() => financialAnalystArchive(d.id), 600);
    });

    li.addEventListener("touchmove", e => {
      clearTimeout(pressTimer);
      const diff = e.touches[0].clientX - startX;
      li.style.transform = `translateX(${diff}px)`;
      li.classList.toggle("financial-analyst-swipe-edit", diff < -60);
      li.classList.toggle("financial-analyst-swipe-delete", diff > 60);
      isSwiping = true;
    });

    li.addEventListener("touchend", e => {
      clearTimeout(pressTimer);
      const diff = e.changedTouches[0].clientX - startX;
      li.style.transform = "";
      if (diff < -100) financialAnalystEdit(d.id);
      if (diff > 100) financialAnalystOpenConfirm(d.id);
      li.classList.remove("financial-analyst-swipe-edit", "financial-analyst-swipe-delete");
    });

    li.addEventListener("click", () => {
      if (!isSwiping) financialAnalystOpenDetail(d);
    });

    list.appendChild(li);
  });

  document.getElementById("financial-analyst-total-masuk").innerText = rupiah(masuk);
  document.getElementById("financial-analyst-total-keluar").innerText = rupiah(keluar);
  document.getElementById("financial-analyst-total-saldo").innerText =
    rupiah(masuk - keluar);

  financialAnalystRenderPagination(data.length);
}

/* ================= PAGINATION ================= */
function financialAnalystRenderPagination(total) {
  const container = document.getElementById("financial-analyst-pagination");
  container.innerHTML = "";

  const pages = Math.ceil(total / financialAnalystLimit);
  if (pages <= 1) return;

  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.className = i === financialAnalystPage ? "active" : "";
    btn.onclick = () => {
      financialAnalystPage = i;
      financialAnalystUpdateUI();
      financialAnalystUpdateVisibility();
    };
    container.appendChild(btn);
  }
}

/* ================= FORM ================= */
function financialAnalystOpenForm() {
  financialAnalystEditId = null;
  document.getElementById("financial-analyst-form-title").innerText =
    "Tambah Data";
  document.getElementById("financial-analyst-modal-form").style.display =
    "block";
  document.getElementById("financial-analyst-tanggal").value =
    new Date().toISOString().split("T")[0];
  ["jenis", "deskripsi", "jumlah", "tipe"].forEach(id =>
    (document.getElementById(`financial-analyst-${id}`).value = "")
  );
}

function financialAnalystEdit(id) {
  const d = getData().find(x => x.id === id);
  if (!d) return;
  financialAnalystEditId = id;
  ["jenis", "deskripsi", "jumlah", "tipe", "tanggal"].forEach(k =>
    (document.getElementById(`financial-analyst-${k}`).value = d[k])
  );
  document.getElementById("financial-analyst-form-title").innerText =
    "Edit Data";
  document.getElementById("financial-analyst-modal-form").style.display =
    "block";
}

function financialAnalystSave() {
  const jenis = document.getElementById("financial-analyst-jenis").value;
  const deskripsi = document.getElementById("financial-analyst-deskripsi").value.trim();
  const jumlah = Number(document.getElementById("financial-analyst-jumlah").value);
  const tipe = document.getElementById("financial-analyst-tipe").value;
  const tanggal = document.getElementById("financial-analyst-tanggal").value;
  if (!jenis || !deskripsi || jumlah <= 0 || !tipe) return;

  let data = getData();
  if (financialAnalystEditId) {
    data = data.map(d =>
      d.id === financialAnalystEditId
        ? { ...d, jenis, deskripsi, jumlah, tipe, tanggal }
        : d
    );
  } else {
    data.unshift({
      id: Date.now(),
      jenis,
      deskripsi,
      jumlah,
      tipe,
      tanggal,
      pinned: false
    });
  }

  saveData(data);
  financialAnalystCloseForm();
  financialAnalystUpdateUI();
  financialAnalystUpdateSavings();
  financialAnalystUpdateVisibility();
}

function financialAnalystCloseForm() {
  document.getElementById("financial-analyst-modal-form").style.display = "none";
}

/* ================= DELETE ================= */
function financialAnalystOpenConfirm(id) {
  financialAnalystDeleteId = id;
  document.getElementById("financial-analyst-modal-confirm").style.display =
    "block";
}

function financialAnalystCloseConfirm() {
  financialAnalystDeleteId = null;
  document.getElementById("financial-analyst-modal-confirm").style.display =
    "none";
}

document.getElementById("financial-analyst-confirm-delete").onclick = () => {
  saveData(getData().filter(d => d.id !== financialAnalystDeleteId));
  financialAnalystCloseConfirm();
  financialAnalystUpdateUI();
  financialAnalystUpdateSavings();
  financialAnalystUpdateVisibility();
};

/* ================= PROFILE ================= */
function financialAnalystOpenProfile() {
  document.getElementById("financial-analyst-modal-profile").style.display =
    "block";
}
function financialAnalystCloseProfile() {
  document.getElementById("financial-analyst-modal-profile").style.display =
    "none";
}

/* ================= DETAIL ================= */
function financialAnalystOpenDetail(d) {
  document.getElementById("detail-jenis").innerText = d.jenis;
  document.getElementById("detail-tanggal").innerText = d.tanggal;
  document.getElementById("detail-tipe").innerText = d.tipe;
  document.getElementById("detail-jumlah").innerText = rupiah(d.jumlah);
  document.getElementById("detail-deskripsi").innerHTML =
    financialAnalystHighlight(d.deskripsi, financialAnalystKeyword);
  document.getElementById("financial-analyst-modal-detail").style.display =
    "block";
}
function financialAnalystCloseDetail() {
  document.getElementById("financial-analyst-modal-detail").style.display =
    "none";
}

function financialAnalystAddTarget() {
  document.getElementById("savings-modal-title").innerText = "Tambah Target Tabungan";
  document.getElementById("savings-target-input").value = "";
  document.getElementById("savings-target-modal").style.display = "block";
}

function financialAnalystEditTarget() {
  const savings = getSavings();
  if (!savings.target) {
    financialAnalystToast("Belum ada target tabungan");
    return;
  }

  document.getElementById("savings-modal-title").innerText = "Edit Target Tabungan";
  document.getElementById("savings-target-input").value = savings.target;
  document.getElementById("savings-target-modal").style.display = "block";
}

function financialAnalystSaveTarget() {
  const value = Number(document.getElementById("savings-target-input").value);
  if (!value || value <= 0) return;

  const savings = getSavings();
  savings.target = value;
  saveSavings(savings);

  financialAnalystCloseTargetModal();
  financialAnalystUpdateSavings();
  financialAnalystUpdateSavingsButtons();
  financialAnalystToast("Target tabungan disimpan");
}

function financialAnalystCloseTargetModal() {
  document.getElementById("savings-target-modal").style.display = "none";
}

function financialAnalystDeleteTarget() {
  const savings = getSavings();
  if (!savings.target) {
    financialAnalystToast("Tidak ada target untuk dihapus");
    return;
  }
  document.getElementById("savings-delete-modal").style.display = "block";
}

function financialAnalystConfirmDeleteTarget() {
  saveSavings({ target: 0, current: 0 });
  financialAnalystCloseDeleteTarget();
  financialAnalystUpdateSavings();
  financialAnalystUpdateSavingsButtons();
  financialAnalystToast("Target tabungan dihapus");
}

function financialAnalystCloseDeleteTarget() {
  document.getElementById("savings-delete-modal").style.display = "none";
}

function financialAnalystUpdateSavingsButtons() {
  const addBtn = document.getElementById("btn-savings-add");
  const editGroup = document.getElementById("savings-edit-group");

  const hasTarget = getSavings().target > 0;

  if (hasTarget) {
    addBtn.classList.remove("is-visible");
    addBtn.classList.add("is-hidden");

    editGroup.classList.remove("is-hidden");
    editGroup.classList.add("is-visible");
  } else {
    editGroup.classList.remove("is-visible");
    editGroup.classList.add("is-hidden");

    addBtn.classList.remove("is-hidden");
    addBtn.classList.add("is-visible");
  }
}

function showButton(btn) {
  if (!btn) return;
  btn.classList.remove("is-hidden");
  btn.classList.add("is-visible");
}

function hideButton(btn) {
  if (!btn) return;
  btn.classList.remove("is-visible");
  btn.classList.add("is-hidden");
}

function toggleSavingsButton(button, show) {
  if (!button) return;

  button.classList.remove("is-visible", "is-hidden");

  // Trigger reflow biar animasi konsisten
  void button.offsetWidth;

  if (show) {
    button.classList.add("is-visible");
  } else {
    button.classList.add("is-hidden");
  }
}


/* ================= INIT ================= */
financialAnalystUpdateUI();
financialAnalystUpdateVisibility();
financialAnalystUpdateSavings();
financialAnalystUpdateSavingsButtons();

let lastMonthKey = getCurrentMonthKey();

setInterval(() => {
  const nowMonth = getCurrentMonthKey();
  if (nowMonth !== lastMonthKey) {
    lastMonthKey = nowMonth;
    financialAnalystUpdateUI();
    financialAnalystUpdateVisibility();
    financialAnalystToast("Saldo bulan baru dimulai");
  }
}, 60 * 1000); // cek tiap 1 menit
