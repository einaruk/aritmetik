// Arayüz: ekranlar, tuş takımı, süre ölçümü, kayıt. Soru mantığı engine.js'te.
import {
  TOTAL, MIN_TOTAL, MAX_TOTAL, POWER_MAX, STATE_VERSION, createSession, nextQuestion, submit,
  isFinished, totalOf, questionText, buildReport, reportText, fmt, fmtDuration, gradeText,
  previousFocus, answerText, expectedText, initialPower, signed,
} from './engine.js';

const SESSION_KEY = 'aritmetik.session.v1';
const RESULTS_KEY = 'aritmetik.results.v1';
const POWER_KEY = 'aritmetik.power.v1';
const COUNT_KEY = 'aritmetik.count.v1';
const MAX_RESULTS = 20;
const MAX_DIGITS = 7;
const OK_DELAY_MS = 700;

const app = document.getElementById('app');

// ---------------------------------------------------------------- kayıt
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // özel pencere ya da dolu depolama: oturum bellekte sürer
  }
}

function loadSession() {
  const s = load(SESSION_KEY, null);
  return s && s.v === STATE_VERSION && Array.isArray(s.history) ? s : null;
}

// Power her cevaptan sonra ayrıca yazılır; yeni test kaldığı yerden sürdürür.
function saveSession() {
  store(SESSION_KEY, session);
  if (session && session.power != null) store(POWER_KEY, session.power);
}

function currentPower() {
  if (session && session.power != null) return session.power;
  const p = load(POWER_KEY, null);
  return typeof p === 'number' ? p : initialPower(load(RESULTS_KEY, []));
}

function newSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

// ---------------------------------------------------------------- yardımcılar
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function dateText(ts) {
  return new Date(ts).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function clock(ms) {
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- durum
let session = loadSession();
// Power'dan önce başlamış yarım test, kayıtlı power ile sürer.
if (session && session.power == null) session.power = session.powerStart = currentPower();
let quiz = null; // { inputs: {q, r}, field, locked, shownAt, timer, okTimeout }

function stopQuiz() {
  if (!quiz) return;
  clearInterval(quiz.timer);
  clearTimeout(quiz.okTimeout);
  quiz = null;
}

// Soru ekranda ve görünürken geçen süre. Arka planda geçen süre sayılmaz.
function questionElapsed() {
  const cur = session && session.current;
  if (!cur) return 0;
  const live = quiz && quiz.shownAt !== null ? performance.now() - quiz.shownAt : 0;
  return cur.elapsed + live;
}

function pauseClock() {
  if (!quiz || quiz.shownAt === null || !session.current) return;
  session.current.elapsed += performance.now() - quiz.shownAt;
  quiz.shownAt = null;
  saveSession();
}

function resumeClock() {
  if (!quiz || quiz.shownAt !== null || quiz.locked || !session.current) return;
  quiz.shownAt = performance.now();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pauseClock();
  else resumeClock();
});
window.addEventListener('pagehide', pauseClock);

// ---------------------------------------------------------------- power göstergesi
function powerBar(p) {
  // Meter rolü yalnız çubukta: etiket, değer ve değişim ayrı metin olarak okunur.
  return `<div class="power" data-id="power">
    <span class="power-label">Power</span>
    <div class="power-track" data-id="power-meter" role="meter" aria-label="Power"
      aria-valuemin="0" aria-valuemax="${POWER_MAX}" aria-valuenow="${p}"><div class="power-fill" data-id="power-fill" style="width:${(p / POWER_MAX) * 100}%"></div></div>
    <span class="power-value" data-id="power-value">${p}</span>
    <span class="power-delta" data-id="power-delta"></span>
  </div>`;
}

function showPower(p, delta) {
  $('power-meter').setAttribute('aria-valuenow', p);
  $('power-fill').style.width = `${(p / POWER_MAX) * 100}%`;
  $('power-value').textContent = p;
  const d = $('power-delta');
  d.textContent = signed(delta);
  d.className = `power-delta show ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`;
}

// ---------------------------------------------------------------- ana sayfa
function renderHome() {
  stopQuiz();
  const results = load(RESULTS_KEY, []);
  const inProgress = session && !isFinished(session) && session.history.length > 0;
  const focus = results.length ? previousFocus(results[0]) : null;
  const count = load(COUNT_KEY, TOTAL);
  const countField = `
    <label class="count-field">
      <span>Soru sayısı</span>
      <input type="number" inputmode="numeric" min="${MIN_TOTAL}" max="${MAX_TOTAL}" value="${count}" data-id="count-input" aria-label="Soru sayısı">
    </label>
    <div class="chips">${[10, 20, 30, 50].map((n) => `<button class="chip" data-act="count" data-n="${n}">${n}</button>`).join('')}</div>
    <div class="field-error" data-id="count-error" role="alert"></div>`;
  app.innerHTML = `
    <h1>Aritmetik</h1>
    ${powerBar(currentPower())}
    <p class="muted">Seviye testi. Sorular tek tek gelir; doğru cevapta biraz zorlaşır, yanlışta biraz kolaylaşır. Her sorunun süresi ölçülür. Power zor soruyu bildikçe çok, kolayı bildikçe az artar; yanlışta azalır.</p>
    ${inProgress
      ? `<button class="btn primary" data-act="continue">Devam et (${session.history.length}/${totalOf(session)})</button>
         <button class="btn" data-act="restart">Baştan başla</button>`
      : focus
        ? `<div class="card small" data-id="focus">
             <strong>Yeni test önceki testin yanlışlarından başlar.</strong>
             ${focus.weak.length
               ? `<ul class="clean">${focus.weak.map((w) => `<li>${esc(w.name)}: ${esc(w.label)}</li>`).join('')}</ul>`
               : `<div class="muted">Önceki testte yanlış yoktu; her konu ulaşılan seviyeden başlar.</div>`}
           </div>
           ${countField}
           <button class="btn primary" data-act="start">Başla</button>
           <button class="btn" data-act="fresh">Sıfırdan başla</button>`
        : `${countField}
           <button class="btn primary" data-act="start">Başla</button>`}
    ${results.length ? `<h2>Önceki sonuçlar</h2>` : ''}
    ${results.map((r, i) => {
      const rep = buildReport(r);
      return `<button class="card history-item" data-act="result" data-i="${i}">
        <span>${esc(dateText(r.finishedAt))}<br><span class="muted small">${rep.correct}/${rep.total} doğru · ${esc(fmtDuration(rep.totalMs))}</span></span>
        <span class="pill">${esc(gradeText(rep.overall.grade))}</span>
      </button>`;
    }).join('')}
  `;
  app.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'count') {
      $('count-input').value = b.dataset.n;
      $('count-error').textContent = '';
    } else if (act === 'start') startNew(results[0] || null);
    else if (act === 'fresh') startNew(null);
    else if (act === 'continue') renderQuiz();
    else if (act === 'restart') {
      if (b.dataset.armed) {
        session = null; // yarım testin power'ı kayıtlı; yeni test oradan sürer
        startNew(results[0] || null);
      }
      else {
        b.dataset.armed = '1';
        b.textContent = 'Emin misin? Yeniden dokun';
      }
    } else if (act === 'result') renderReport(results[Number(b.dataset.i)], false);
  };
}

// Ana sayfadaki soru sayısı; geçersizse uyarı yazar ve null döner.
// "Baştan başla"da alan yok; son seçilen sayı kullanılır.
function chosenTotal() {
  const input = $('count-input');
  if (!input) return load(COUNT_KEY, TOTAL);
  const n = Number(input.value);
  if (!Number.isInteger(n) || n < MIN_TOTAL || n > MAX_TOTAL) {
    $('count-error').textContent = `${MIN_TOTAL} ile ${MAX_TOTAL} arasında bir sayı yaz.`;
    input.focus();
    return null;
  }
  return n;
}

function startNew(previous) {
  const total = chosenTotal();
  if (total === null) return;
  store(COUNT_KEY, total);
  session = createSession(newSeed(), Date.now(), previous, { total, power: currentPower() });
  saveSession();
  renderQuiz();
}

// ---------------------------------------------------------------- soru ekranı
function renderQuiz() {
  stopQuiz();
  if (isFinished(session)) return finish();
  const q = nextQuestion(session);
  saveSession();
  const t = questionText(q);
  const twoFields = q.op === '/r';
  app.innerHTML = `
    <section class="quiz">
      ${powerBar(session.power)}
      <div class="topbar">
        <span data-id="count">Soru ${q.n} / ${totalOf(session)}</span>
        <span data-id="clock" aria-label="Geçen süre">00:00</span>
      </div>
      <div class="progress"><div style="width:${((q.n - 1) / totalOf(session)) * 100}%"></div></div>
      <div class="question">
        <div class="main" data-id="question">${esc(t.main)}</div>
        <div class="sub">${esc(t.sub)}</div>
      </div>
      <div class="answers">
        ${twoFields
          ? `<button class="answer active" data-field="q"><span class="label">Bölüm</span><span class="value" data-id="value-q"></span></button>
             <button class="answer" data-field="r"><span class="label">Kalan</span><span class="value" data-id="value-r"></span></button>`
          : `<div class="answer active"><span class="value" data-id="value-q"></span></div>`}
      </div>
      <div class="feedback" data-id="feedback" role="status"></div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-key="${d}">${d}</button>`).join('')}
        <button class="key" data-key="del" aria-label="Sil">⌫</button>
        <button class="key" data-key="0">0</button>
        <button class="key go" data-key="ok" data-id="ok" aria-label="Onayla">✓</button>
      </div>
      <button class="skip" data-key="skip">Bilmiyorum</button>
    </section>`;

  quiz = { inputs: { q: '', r: '' }, field: 'q', twoFields, locked: false, shownAt: null, timer: null, okTimeout: null };
  fitQuestion();
  if (document.visibilityState === 'visible') quiz.shownAt = performance.now();
  updateClock();
  quiz.timer = setInterval(updateClock, 500);
  app.onclick = onQuizClick;
}

const $ = (id) => app.querySelector(`[data-id="${id}"]`);

// Uzun soruları (ör. 45.678 − 12.345) ekran genişliğine sığdırır.
function fitQuestion() {
  const el = $('question');
  let size = 56;
  el.style.fontSize = `${size}px`;
  const max = el.parentElement.clientWidth;
  while (el.scrollWidth > max && size > 26) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}

function updateClock() {
  if (!quiz || !session) return;
  const done = session.history.reduce((acc, h) => acc + h.ms, 0);
  $('clock').textContent = clock(done + questionElapsed());
}

function showInputs() {
  $('value-q').textContent = quiz.inputs.q ? fmt(Number(quiz.inputs.q)) : '';
  if (quiz.twoFields) {
    $('value-r').textContent = quiz.inputs.r ? fmt(Number(quiz.inputs.r)) : '';
    for (const el of app.querySelectorAll('[data-field]')) el.classList.toggle('active', el.dataset.field === quiz.field);
  }
}

function onQuizClick(e) {
  const field = e.target.closest('[data-field]');
  if (field && !quiz.locked) {
    quiz.field = field.dataset.field;
    showInputs();
    return;
  }
  const key = e.target.closest('[data-key]');
  if (key) press(key.dataset.key);
}

function press(k) {
  if (!quiz) return;
  if (quiz.locked) {
    if (k === 'ok' && quiz.waiting) advance();
    return;
  }
  const f = quiz.field;
  if (/^\d$/.test(k)) {
    if (quiz.inputs[f].length >= MAX_DIGITS) return;
    quiz.inputs[f] = quiz.inputs[f] === '0' ? k : quiz.inputs[f] + k;
  } else if (k === 'del') {
    quiz.inputs[f] = quiz.inputs[f].slice(0, -1);
  } else if (k === 'tab' && quiz.twoFields) {
    quiz.field = f === 'q' ? 'r' : 'q';
  } else if (k === 'ok') {
    return answer();
  } else if (k === 'skip') {
    return answer(true);
  }
  showInputs();
}

function answer(skipped = false) {
  const { inputs, twoFields } = quiz;
  let value = null;
  if (!skipped) {
    if (twoFields) {
      if (inputs.q === '') { quiz.field = 'q'; return showInputs(); }
      if (inputs.r === '') { quiz.field = 'r'; return showInputs(); }
      value = { q: Number(inputs.q), r: Number(inputs.r) };
    } else {
      if (inputs.q === '') return;
      value = Number(inputs.q);
    }
  }
  const ms = questionElapsed();
  quiz.shownAt = null;
  quiz.locked = true;
  const res = submit(session, value, ms);
  saveSession();

  const fb = $('feedback');
  fb.textContent = res.message;
  fb.className = `feedback ${res.correct ? 'ok' : 'bad'}`;
  showPower(res.power, res.powerDelta);
  for (const el of app.querySelectorAll('.key, .skip')) el.disabled = true;
  if (res.correct) {
    quiz.okTimeout = setTimeout(advance, OK_DELAY_MS);
  } else {
    quiz.waiting = true;
    const ok = $('ok');
    ok.disabled = false;
    ok.textContent = 'Devam';
    ok.style.fontSize = '20px';
    ok.setAttribute('aria-label', 'Devam');
  }
  updateClock();
}

function advance() {
  if (!quiz) return;
  if (isFinished(session)) finish();
  else renderQuiz();
}

document.addEventListener('keydown', (e) => {
  if (!quiz || e.metaKey || e.ctrlKey || e.altKey) return;
  const map = { Backspace: 'del', Enter: 'ok', Tab: 'tab' };
  const k = /^\d$/.test(e.key) ? e.key : map[e.key];
  if (!k) return;
  e.preventDefault();
  press(k);
});

// ---------------------------------------------------------------- bitiş ve rapor
function finish() {
  stopQuiz();
  const results = load(RESULTS_KEY, []);
  if (!results.some((r) => r.seed === session.seed && r.startedAt === session.startedAt)) {
    results.unshift({ ...session, current: null });
    store(RESULTS_KEY, results.slice(0, MAX_RESULTS));
  }
  const done = session;
  session = null;
  store(SESSION_KEY, null);
  renderReport(done, true);
}

function renderReport(s, fresh) {
  stopQuiz();
  const rep = buildReport(s);
  const date = dateText(s.finishedAt || s.startedAt);
  app.innerHTML = `
    <h1>${fresh ? 'Test bitti' : 'Sonuç'}</h1>
    <p class="muted">${esc(date)}</p>
    <div class="card">
      <div class="muted small">Genel seviye</div>
      <div class="big-grade" data-id="overall">${esc(rep.overall.text)}</div>
      ${rep.overall.weakest.length ? `<div class="small">En zayıf konu: ${esc(rep.overall.weakest.join(', '))}</div>` : ''}
      <div class="small muted">${rep.correct}/${rep.total} doğru · toplam ${esc(fmtDuration(rep.totalMs))} · soru başına ort. ${esc(fmtDuration(rep.avgMs))}</div>
    </div>
    ${rep.power ? `
      <div class="card">
        ${powerBar(rep.power.end)}
        <div class="small muted" data-id="power-change">Power ${rep.power.start} → ${rep.power.end} (${esc(signed(rep.power.end - rep.power.start))})</div>
      </div>` : ''}

    <h2>Konu konu</h2>
    ${rep.topics.map((t) => `
      <div class="card" data-topic="${t.topic}">
        <div class="topic-head"><strong>${esc(t.name)}</strong><span class="pill">${esc(t.gradeLabel)}</span></div>
        <div class="small muted">${t.correct}/${t.total} doğru · ort. ${esc(fmtDuration(t.ms / t.total))}</div>
        <ul class="clean small">
          ${t.reached ? `<li>Başardığı en zor: ${esc(t.reached)}</li>` : ''}
          ${t.next ? `<li>Sıradaki hedef: ${esc(t.next)}</li>` : ''}
          ${t.weak.map((w) => `<li>Eksik: ${esc(w.label)} (${w.c} doğru, ${w.w} yanlış)</li>`).join('')}
        </ul>
      </div>`).join('')}

    ${rep.patterns.length ? `
      <h2>Hata kalıpları</h2>
      ${rep.patterns.map((p) => `
        <div class="card small">
          <div>${esc(p.text)} <span class="muted">(${p.count} kez)</span></div>
          ${p.examples.length ? `<ul class="clean muted">${p.examples.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}` : ''}

    <details>
      <summary>Tüm sorular</summary>
      <table class="log">
        <thead><tr><th>#</th><th>Soru</th><th>Cevap</th><th>Süre</th></tr></thead>
        <tbody>
          ${s.history.map((h) => `<tr>
            <td>${h.n}</td>
            <td>${esc(questionText(h).main)}</td>
            <td class="${h.correct ? 'ok' : 'bad'}">${esc(answerText(h, h.answer))}${h.correct ? ' ✓' : ` ✗ <span class="muted">(${esc(expectedText(h))})</span>`}</td>
            <td>${(h.ms / 1000).toFixed(1)} sn</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </details>

    <button class="btn primary" data-act="share">Sonucu paylaş</button>
    <div class="toast" data-id="toast"></div>
    <button class="btn" data-act="home">Ana sayfa</button>
  `;
  window.scrollTo(0, 0);
  app.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'home') renderHome();
    if (b.dataset.act === 'share') {
      const text = reportText(rep, date);
      try {
        // Android uygulamasının WebView'ında navigator.share yok; Capacitor Share eklentisi var.
        const nativeShare = window.Capacitor?.Plugins?.Share;
        if (nativeShare) await nativeShare.share({ title: 'Aritmetik sonucu', text });
        else if (navigator.share) await navigator.share({ title: 'Aritmetik sonucu', text });
        else {
          await navigator.clipboard.writeText(text);
          $('toast').textContent = 'Kopyalandı.';
        }
      } catch {
        // kullanıcı paylaşımı kapattı
      }
    }
  };
}

// ---------------------------------------------------------------- başlangıç
if (session && isFinished(session)) finish();
else if (session && session.history.length === 0 && session.current) renderQuiz();
else renderHome();

// Android uygulamasında dosyalar APK'nın içinde; önbellek eski sürümü tutmasın.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor?.isNativePlatform?.()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
