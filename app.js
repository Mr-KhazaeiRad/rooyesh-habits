(() => {
  'use strict';

  const STORAGE_HABITS = 'rooyesh.habits.v1';
  const STORAGE_LOGS = 'rooyesh.logs.v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const todayKey = dateKey(new Date());
  const colorsByCategory = {
    'سلامتی': '#e9f8ed',
    'یادگیری': '#f1edff',
    'آرامش': '#fff2e9',
    'رشد فردی': '#fff0f4',
    'سبک زندگی': '#eaf6fc'
  };
  const suggestedHabits = [
    { id: 'seed-water', name: 'آب کافی نوشیدن', emoji: '💧', category: 'سلامتی', note: 'یه لیوان بیشتر، یه قدم بهتر' },
    { id: 'seed-reading', name: '۲۰ دقیقه مطالعه', emoji: '📚', category: 'یادگیری', note: 'هر صفحه، دری به یک دنیای تازه' },
    { id: 'seed-move', name: 'کمی حرکت و ورزش', emoji: '🏃', category: 'سلامتی', note: 'حتی پنج دقیقه هم حسابه' },
    { id: 'seed-calm', name: 'چند دقیقه آرامش', emoji: '🧘', category: 'آرامش', note: 'یک نفس عمیق برای خودت' }
  ];

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function shiftDate(date, days) {
    const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    shifted.setDate(shifted.getDate() + days);
    return shifted;
  }

  function faNumber(value) {
    return Number(value).toLocaleString('fa-IR-u-nu-arabext');
  }

  function formatFullDate(date) {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long', day: 'numeric', month: 'long'
    }).format(date);
  }

  function formatCompactDate(date) {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric', month: 'long'
    }).format(date);
  }

  function formatPersianDay(date) {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }).format(date);
  }

  function loadJson(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : JSON.parse(stored);
    } catch {
      return fallback;
    }
  }

  const storedHabits = loadJson(STORAGE_HABITS, null);
  let habits = Array.isArray(storedHabits)
    ? storedHabits.filter((habit) => habit && typeof habit.id === 'string' && typeof habit.name === 'string')
    : suggestedHabits.map((habit) => ({ ...habit, createdAt: todayKey }));
  let logs = loadJson(STORAGE_LOGS, {});
  if (!logs || Array.isArray(logs) || typeof logs !== 'object') logs = {};

  let selectedDate = todayKey;
  let activeFilter = 'all';
  let selectedEmoji = '🌱';
  let editingId = null;
  let toastTimer = null;

  function saveData() {
    try {
      localStorage.setItem(STORAGE_HABITS, JSON.stringify(habits));
      localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
      return true;
    } catch {
      showToast('ذخیره‌سازی مرورگر در دسترس نیست.');
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function isEligible(habit, key) {
    return !habit.createdAt || habit.createdAt <= key;
  }

  function eligibleHabits(key) {
    return habits.filter((habit) => isEligible(habit, key));
  }

  function completedSet(key) {
    return new Set(Array.isArray(logs[key]) ? logs[key] : []);
  }

  function dayCounts(key) {
    const eligible = eligibleHabits(key);
    const completed = completedSet(key);
    const done = eligible.filter((habit) => completed.has(habit.id)).length;
    return { done, total: eligible.length, percent: eligible.length ? Math.round((done / eligible.length) * 100) : 0 };
  }

  function streakForHabit(habit, fromKey = todayKey) {
    let cursor = dateFromKey(fromKey);
    if (!completedSet(dateKey(cursor)).has(habit.id)) cursor = shiftDate(cursor, -1);
    let streak = 0;
    for (let i = 0; i < 366; i += 1) {
      const key = dateKey(cursor);
      if (!isEligible(habit, key) || !completedSet(key).has(habit.id)) break;
      streak += 1;
      cursor = shiftDate(cursor, -1);
    }
    return streak;
  }

  function overallStreak() {
    let cursor = dateFromKey(todayKey);
    if (dayCounts(todayKey).done === 0) cursor = shiftDate(cursor, -1);
    let streak = 0;
    for (let i = 0; i < 366; i += 1) {
      const key = dateKey(cursor);
      const counts = dayCounts(key);
      if (!counts.total || !counts.done) break;
      streak += 1;
      cursor = shiftDate(cursor, -1);
    }
    return streak;
  }

  function renderWeekChart() {
    const chart = $('#week-chart');
    const dates = Array.from({ length: 7 }, (_, index) => shiftDate(dateFromKey(todayKey), index - 6));
    const dayLabels = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
    let totalDone = 0;
    let totalAvailable = 0;

    chart.innerHTML = dates.map((date) => {
      const key = dateKey(date);
      const counts = dayCounts(key);
      totalDone += counts.done;
      totalAvailable += counts.total;
      const dayIndex = date.getDay();
      const isToday = key === todayKey;
      const selected = key === selectedDate;
      const height = counts.total ? Math.max(counts.percent, 5) : 3;
      return `<button class="chart-day${isToday ? ' today' : ''}${selected ? ' selected' : ''}" type="button" data-date="${key}" aria-pressed="${selected}" aria-label="${escapeHtml(formatFullDate(date))}؛ ${faNumber(counts.done)} از ${faNumber(counts.total)} عادت انجام‌شده">
        <span class="chart-day-label">${dayLabels[dayIndex]}</span>
        <span class="chart-bar-shell"><i class="chart-bar" style="--bar-height:${height}%">${counts.done ? `<small class="chart-day-count">${faNumber(counts.done)}</small>` : ''}</i></span>
        <span class="chart-day-number">${formatPersianDay(date)}</span>
      </button>`;
    }).join('');

    const rate = totalAvailable ? Math.round((totalDone / totalAvailable) * 100) : 0;
    $('#week-rate').textContent = `${faNumber(rate)}٪`;
    $('#week-summary').textContent = totalDone
      ? `${faNumber(totalDone)} قدم از ${faNumber(totalAvailable)} قدم`
      : 'هنوز فعالیتی ثبت نشده';
    $('#chart-total-label').textContent = `${faNumber(totalDone)} از ${faNumber(totalAvailable)}`;
  }

  function renderHabits(counts) {
    const list = $('#habit-list');
    const empty = $('#empty-state');
    const doneIds = completedSet(selectedDate);
    const eligible = eligibleHabits(selectedDate);
    $('#filter-all-count').textContent = faNumber(eligible.length);

    const visibleHabits = eligible.filter((habit) => {
      const done = doneIds.has(habit.id);
      if (activeFilter === 'done') return done;
      if (activeFilter === 'pending') return !done;
      return true;
    });

    list.innerHTML = visibleHabits.map((habit, index) => {
      const done = doneIds.has(habit.id);
      const streak = streakForHabit(habit, selectedDate);
      const tint = colorsByCategory[habit.category] || '#f3efff';
      return `<article class="habit-card${done ? ' is-done' : ''}" style="--habit-tint:${tint};animation-delay:${Math.min(index * 45, 220)}ms">
        <button class="check-button" type="button" data-action="toggle" data-id="${escapeHtml(habit.id)}" aria-label="${done ? 'لغو انجام ' : 'انجام '}${escapeHtml(habit.name)}" aria-pressed="${done}">
          <svg class="icon"><use href="#i-checkmark"/></svg>
        </button>
        <span class="habit-emoji" aria-hidden="true">${escapeHtml(habit.emoji || '🌱')}</span>
        <div class="habit-main">
          <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
          <div class="habit-meta"><span class="habit-category">${escapeHtml(habit.category || 'رشد فردی')}</span>${habit.note ? `<span class="habit-note">${escapeHtml(habit.note)}</span>` : ''}${streak ? `<span class="habit-streak">🔥 ${faNumber(streak)} <span>روز</span></span>` : ''}</div>
        </div>
        <div class="habit-actions">
          <button class="icon-action" type="button" data-action="edit" data-id="${escapeHtml(habit.id)}" aria-label="ویرایش ${escapeHtml(habit.name)}" title="ویرایش"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button class="icon-action delete" type="button" data-action="delete" data-id="${escapeHtml(habit.id)}" aria-label="حذف ${escapeHtml(habit.name)}" title="حذف"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </article>`;
    }).join('');

    const noHabitsAtAll = eligible.length === 0;
    const noFilteredResults = eligible.length > 0 && visibleHabits.length === 0;
    empty.hidden = !noHabitsAtAll && !noFilteredResults;
    list.hidden = noHabitsAtAll || noFilteredResults;
    $('#empty-title').textContent = noFilteredResults
      ? (activeFilter === 'done' ? 'هنوز عادتی انجام نشده' : 'همه‌ی عادت‌ها انجام شده‌اند')
      : (habits.length ? 'برای این روز عادتی ثبت نشده.' : 'هنوز عادتی اینجا نیست');
    $('#empty-copy').textContent = noFilteredResults
      ? (activeFilter === 'done' ? 'با انجام اولین عادت، پیشرفتت را ثبت کن.' : 'برنامه‌ی امروزت را با موفقیت کامل کردی.')
      : (habits.length ? 'برای این تاریخ عادتی ثبت نشده.' : 'برای شروع، اولین عادت روزانه‌ات را اضافه کن.');
    $('#empty-add').hidden = noFilteredResults || habits.length > 0;
  }

  function render() {
    const date = dateFromKey(selectedDate);
    const counts = dayCounts(selectedDate);
    const isToday = selectedDate === todayKey;
    const percent = counts.percent;

    $('#top-date').textContent = formatCompactDate(dateFromKey(todayKey));
    $('#welcome-date').textContent = formatFullDate(dateFromKey(todayKey));
    $('#hero-date-label').textContent = isToday ? 'ماموریت امروز' : `گزارش ${formatCompactDate(date)}`;
    $('#selected-day-word').textContent = isToday ? 'امروز' : formatCompactDate(date);
    $('#selected-date-label').textContent = isToday ? 'امروز' : formatFullDate(date);
    $('#habits-subtitle').textContent = isToday
      ? 'عادت‌های کوچیکت، موفقیت‌های بزرگ می‌سازن.'
      : 'هر روزی که تلاش کردی، ارزش دیدن و افتخار کردن داره.';
    $('#today-percent').textContent = `${faNumber(percent)}٪`;
    $('#daily-done').textContent = faNumber(counts.done);
    $('#daily-total').textContent = faNumber(counts.total);
    $('#daily-count-label').textContent = isToday ? 'عادت انجام‌شده' : 'عادت انجام‌شده در این روز';
    $('#active-count').textContent = faNumber(habits.length);
    $('#streak-count').textContent = faNumber(overallStreak());
    $('#progress-ring').style.strokeDashoffset = String(307.88 * (1 - percent / 100));

    if (counts.total && percent === 100) {
      $('#hero-message').textContent = 'برنامه‌ی امروز کامل شد.';
      $('#hero-submessage').textContent = 'با تداوم در قدم‌های کوچک، مسیرت را می‌سازی.';
      $('#progress-caption').textContent = 'همه‌ی عادت‌های امروز را انجام دادی.';
    } else if (counts.done > 0) {
      $('#hero-message').textContent = 'شروع خوبی داشتی.';
      $('#hero-submessage').textContent = 'یک قدم در هر بار؛ همین‌طور ادامه بده.';
      $('#progress-caption').textContent = 'عادت‌های انجام‌شده‌ی امروز ثبت شدند.';
    } else if (!counts.total) {
      $('#hero-message').textContent = 'از یک عادت ساده شروع کن.';
      $('#hero-submessage').textContent = 'قدم‌های کوچک، وقتی تکرار شوند، نتیجه می‌سازند.';
      $('#progress-caption').textContent = 'برای شروع، یک عادت روزانه اضافه کن.';
    } else {
      $('#hero-message').textContent = isToday ? 'روی کارهای مهم تمرکز کن.' : 'هر روز فرصتی تازه است.';
      $('#hero-submessage').textContent = 'هر عادت کوچک، بخشی از مسیری است که برای خودت می‌سازی.';
      $('#progress-caption').textContent = 'پیوستگی از شدت مهم‌تر است.';
    }

    $$('.filter-tab').forEach((button) => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderHabits(counts);
    renderWeekChart();
  }

  function showToast(message) {
    $('#toast-message').textContent = message;
    const toast = $('#toast');
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2550);
  }

  function celebrate() {
    const container = $('#celebration');
    const palette = ['#386b56', '#84b49a', '#c4d8c9', '#e1bc88'];
    for (let index = 0; index < 20; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = palette[index % palette.length];
      piece.style.setProperty('--confetti-x', `${Math.round((Math.random() - .5) * 220)}px`);
      piece.style.setProperty('--confetti-rotation', `${Math.round(Math.random() * 760 - 380)}deg`);
      piece.style.animationDelay = `${Math.random() * .25}s`;
      container.append(piece);
      window.setTimeout(() => piece.remove(), 2100);
    }
  }

  function openModal(habit = null) {
    editingId = habit?.id || null;
    $('#habit-form').reset();
    selectedEmoji = habit?.emoji || '🌱';
    $('#habit-name').value = habit?.name || '';
    $('#habit-category').value = habit?.category || 'سلامتی';
    $('#habit-note').value = habit?.note || '';
    $('#modal-title').textContent = habit ? 'عادتت رو ویرایش کن' : 'عادت جدیدت رو بساز';
    $('#save-habit span').textContent = habit ? 'ذخیره‌ی تغییرات' : 'ذخیره‌ی عادت';
    $$('.emoji-option').forEach((button) => {
      const selected = button.dataset.emoji === selectedEmoji;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#habit-modal').showModal();
    window.setTimeout(() => $('#habit-name').focus(), 50);
  }

  function closeModal() {
    $('#habit-modal').close();
  }

  function makeId() {
    return window.crypto?.randomUUID?.() || `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toggleHabit(id) {
    const habit = habits.find((item) => item.id === id);
    if (!habit || !isEligible(habit, selectedDate)) return;
    const dayLog = new Set(Array.isArray(logs[selectedDate]) ? logs[selectedDate] : []);
    const wasDone = dayLog.has(id);
    if (wasDone) dayLog.delete(id);
    else dayLog.add(id);
    logs[selectedDate] = [...dayLog];
    saveData();
    render();

    if (!wasDone) {
      const updated = dayCounts(selectedDate);
      if (updated.total > 0 && updated.done === updated.total) {
        showToast('تمام عادت‌های امروز انجام شد.');
        celebrate();
      } else {
        showToast('پیشرفت امروز ثبت شد.');
      }
    } else {
      showToast('انجام عادت لغو شد.');
    }
  }

  $('#habit-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const habit = habits.find((item) => item.id === button.dataset.id);
    if (!habit) return;
    if (button.dataset.action === 'toggle') toggleHabit(habit.id);
    if (button.dataset.action === 'edit') openModal(habit);
    if (button.dataset.action === 'delete') {
      const approved = window.confirm(`عادت «${habit.name}» حذف بشه؟`);
      if (!approved) return;
      habits = habits.filter((item) => item.id !== habit.id);
      Object.keys(logs).forEach((key) => { logs[key] = (logs[key] || []).filter((id) => id !== habit.id); });
      saveData();
      render();
      showToast('عادت حذف شد.');
    }
  });

  $$('.filter-tab').forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    render();
  }));

  $('#week-chart').addEventListener('click', (event) => {
    const day = event.target.closest('button[data-date]');
    if (!day) return;
    selectedDate = day.dataset.date;
    activeFilter = 'all';
    render();
    $('#habits-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('#week-chart').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = $$('.chart-day', $('#week-chart'));
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const nextIndex = Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowRight' ? -1 : 1)));
    buttons[nextIndex]?.focus();
  });

  ['#add-habit', '#hero-add', '#empty-add'].forEach((selector) => {
    $(selector).addEventListener('click', () => openModal());
  });

  $('#emoji-picker').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-emoji]');
    if (!button) return;
    selectedEmoji = button.dataset.emoji;
    $$('.emoji-option').forEach((option) => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  });

  $('#habit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#habit-name').value.trim();
    if (!name) {
      $('#habit-name').focus();
      return;
    }
    const details = {
      name,
      emoji: selectedEmoji,
      category: $('#habit-category').value,
      note: $('#habit-note').value.trim()
    };
    if (editingId) {
      const existing = habits.find((habit) => habit.id === editingId);
      if (existing) Object.assign(existing, details);
      showToast('تغییرات ذخیره شد.');
    } else {
      habits.unshift({ id: makeId(), ...details, createdAt: todayKey });
      selectedDate = todayKey;
      activeFilter = 'all';
      showToast('عادت جدید ذخیره شد.');
    }
    saveData();
    closeModal();
    render();
  });

  $('#modal-close').addEventListener('click', closeModal);
  $('#cancel-modal').addEventListener('click', closeModal);
  $('#habit-modal').addEventListener('click', (event) => {
    if (event.target === $('#habit-modal')) closeModal();
  });

  $$('.nav-link').forEach((link) => link.addEventListener('click', () => {
    $$('.nav-link').forEach((item) => item.classList.toggle('active', item === link));
  }));

  render();
})();
