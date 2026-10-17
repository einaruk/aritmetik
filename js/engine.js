// Aritmetik seviye testi motoru: soru üretimi, uyarlama, puanlama, rapor.
// DOM'a ve tarayıcıya dokunmaz; Node testleri doğrudan bu dosyayı içe aktarır.
// Oturum durumu düz JSON'dur: localStorage'a yazılıp geri okunabilir.

export const TOTAL = 50;
export const STATE_VERSION = 1;

// ---------------------------------------------------------------- RNG
// mulberry32; durum tek bir 32 bit tamsayı, JSON'a yazılabilir.
export function makeRng(seed) {
  return { s: seed >>> 0 };
}

export function rand(r) {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(r, lo, hi) {
  return lo + Math.floor(rand(r) * (hi - lo + 1));
}

function pick(r, arr) {
  return arr[int(r, 0, arr.length - 1)];
}

// ---------------------------------------------------------------- basamak yardımcıları
export function digits(n) {
  // birler basamağı başta
  const out = [];
  do {
    out.push(n % 10);
    n = Math.floor(n / 10);
  } while (n > 0);
  return out;
}

export function len(n) {
  return String(n).length;
}

// Toplamada kaç sütunda elde oluşur.
export function carryCount(a, b) {
  const da = digits(a);
  const db = digits(b);
  let carry = 0;
  let count = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const s = (da[i] || 0) + (db[i] || 0) + carry;
    carry = s >= 10 ? 1 : 0;
    count += carry;
  }
  return count;
}

// Çıkarmada (a − b, a ≥ b) kaç sütunda bozma gerekir.
export function borrowCount(a, b) {
  const da = digits(a);
  const db = digits(b);
  let borrow = 0;
  let count = 0;
  for (let i = 0; i < da.length; i++) {
    const x = da[i] - borrow - (db[i] || 0);
    borrow = x < 0 ? 1 : 0;
    count += borrow;
  }
  return count;
}

// ---------------------------------------------------------------- seviyeler
// Her konu kolaydan zora sıralı seviyelerden oluşur. grade: MEB müfredatında
// konunun işlendiği sınıf. gen(r) {a, b, op} döndürür; koşulu tutmayan aday
// reddedilir ve yeniden çekilir.

function gen(r, draw, ok) {
  for (let i = 0; i < 1000; i++) {
    const q = draw(r);
    if (ok(q)) return q;
  }
  throw new Error('soru üretilemedi');
}

const add = (lo1, hi1, lo2, hi2, ok) => (r) =>
  gen(r, (r) => ({ a: int(r, lo1, hi1), b: int(r, lo2, hi2), op: '+' }), ok);

const sub = (lo1, hi1, lo2, hi2, ok) => (r) =>
  gen(r, (r) => ({ a: int(r, lo1, hi1), b: int(r, lo2, hi2), op: '-' }), (q) => q.a > q.b && ok(q));

export const TOPICS = {
  toplama: {
    name: 'Toplama',
    levels: [
      { grade: 1, label: 'tek basamaklı toplama (10\'a kadar)',
        gen: add(1, 9, 1, 9, (q) => q.a + q.b <= 10) },
      { grade: 1, label: 'tek basamaklı toplama (10\'u geçen)',
        gen: add(2, 9, 2, 9, (q) => q.a + q.b > 10) },
      { grade: 2, label: 'iki basamaklı + tek basamaklı, eldesiz',
        gen: add(11, 89, 1, 9, (q) => q.a % 10 + q.b < 10 && q.a % 10 !== 0) },
      { grade: 2, label: 'iki basamaklı + iki basamaklı, eldesiz',
        gen: add(10, 89, 10, 89, (q) => q.a + q.b < 100 && carryCount(q.a, q.b) === 0) },
      { grade: 2, label: 'iki basamaklı + iki basamaklı, eldeli',
        gen: add(10, 89, 10, 89, (q) => q.a + q.b < 100 && carryCount(q.a, q.b) === 1) },
      { grade: 3, label: 'üç basamaklı toplama, eldesiz',
        gen: add(100, 899, 100, 899, (q) => q.a + q.b < 1000 && carryCount(q.a, q.b) === 0) },
      { grade: 3, label: 'üç basamaklı toplama, eldeli',
        gen: add(100, 899, 100, 899, (q) => q.a + q.b < 1000 && carryCount(q.a, q.b) >= 2) },
      { grade: 4, label: 'dört basamaklı toplama, eldeli',
        gen: add(1000, 8999, 1000, 8999, (q) => q.a + q.b < 10000 && carryCount(q.a, q.b) >= 2) },
      { grade: 5, label: 'beş basamaklı toplama, eldeli',
        gen: add(10000, 89999, 1000, 89999, (q) => q.a + q.b < 100000 && carryCount(q.a, q.b) >= 3) },
    ],
  },
  cikarma: {
    name: 'Çıkarma',
    levels: [
      { grade: 1, label: 'tek basamaklı çıkarma',
        gen: sub(2, 10, 1, 9, () => true) },
      { grade: 1, label: 'iki basamaklı − tek basamaklı, onluk bozmadan',
        gen: sub(11, 99, 1, 9, (q) => q.a % 10 >= q.b) },
      { grade: 2, label: 'iki basamaklı − iki basamaklı, onluk bozmadan',
        gen: sub(20, 99, 10, 98, (q) => borrowCount(q.a, q.b) === 0 && q.b % 10 !== 0 && q.a - q.b >= 10) },
      { grade: 2, label: 'iki basamaklı − tek basamaklı, onluk bozarak',
        gen: sub(20, 99, 2, 9, (q) => q.a % 10 < q.b) },
      { grade: 2, label: 'iki basamaklı − iki basamaklı, onluk bozarak',
        gen: sub(30, 99, 11, 89, (q) => q.a % 10 < q.b % 10 && q.a - q.b >= 10) },
      { grade: 3, label: 'üç basamaklı çıkarma, bir kez bozarak',
        gen: sub(200, 999, 100, 899, (q) => borrowCount(q.a, q.b) === 1 && q.a - q.b >= 100) },
      { grade: 3, label: 'üç basamaklı çıkarma, iki kez bozarak',
        gen: sub(200, 999, 100, 899, (q) => borrowCount(q.a, q.b) === 2 && q.a - q.b >= 10) },
      { grade: 4, label: 'dört basamaklı çıkarma, bozarak',
        gen: sub(2000, 9999, 1000, 8999, (q) => borrowCount(q.a, q.b) >= 2 && q.a - q.b >= 100) },
      { grade: 5, label: 'beş basamaklı çıkarma, bozarak',
        gen: sub(20000, 99999, 1000, 89999, (q) => borrowCount(q.a, q.b) >= 3 && q.a - q.b >= 1000) },
    ],
  },
  carpma: {
    name: 'Çarpma',
    levels: [
      { grade: 2, label: 'çarpım tablosu (5\'e kadar)',
        gen: (r) => ({ a: int(r, 2, 5), b: int(r, 2, 5), op: 'x' }) },
      { grade: 3, label: 'çarpım tablosu (9\'a kadar)',
        gen: (r) => gen(r, (r) => ({ a: int(r, 2, 9), b: int(r, 2, 9), op: 'x' }), (q) => q.a >= 6 || q.b >= 6) },
      { grade: 3, label: 'iki basamaklı × tek basamaklı',
        gen: (r) => ({ a: int(r, 12, 49), b: int(r, 2, 9), op: 'x' }) },
      { grade: 4, label: '10, 100, 1000 ile çarpma',
        gen: (r) => ({ a: int(r, 2, 99), b: pick(r, [10, 100, 1000]), op: 'x' }) },
      { grade: 4, label: 'üç basamaklı × tek basamaklı',
        gen: (r) => ({ a: int(r, 101, 999), b: int(r, 2, 9), op: 'x' }) },
      { grade: 4, label: 'iki basamaklı × iki basamaklı',
        gen: (r) => gen(r, (r) => ({ a: int(r, 12, 99), b: int(r, 12, 99), op: 'x' }), (q) => q.a % 10 !== 0 && q.b % 10 !== 0) },
      { grade: 5, label: 'üç basamaklı × iki basamaklı',
        gen: (r) => gen(r, (r) => ({ a: int(r, 101, 999), b: int(r, 12, 99), op: 'x' }), (q) => q.b % 10 !== 0) },
    ],
  },
  bolme: {
    name: 'Bölme',
    levels: [
      { grade: 3, label: 'çarpım tablosundan bölme',
        gen: (r) => { const b = int(r, 2, 9); const q = int(r, 2, 9); return { a: b * q, b, op: '/' }; } },
      { grade: 3, label: 'iki basamaklı ÷ tek basamaklı, kalansız',
        gen: (r) => gen(r, (r) => { const b = int(r, 2, 9); const q = int(r, 10, 49); return { a: b * q, b, op: '/' }; }, (q) => q.a < 100) },
      { grade: 3, label: 'iki basamaklı ÷ tek basamaklı, kalanlı',
        gen: (r) => gen(r, (r) => ({ a: int(r, 10, 99), b: int(r, 2, 9), op: '/r' }), (q) => q.a % q.b !== 0 && q.a > q.b * 2) },
      { grade: 4, label: 'üç basamaklı ÷ tek basamaklı, kalansız',
        gen: (r) => gen(r, (r) => { const b = int(r, 2, 9); const q = int(r, 12, 499); return { a: b * q, b, op: '/' }; }, (q) => q.a >= 100 && q.a <= 999) },
      { grade: 4, label: '10, 100, 1000 ile bölme',
        gen: (r) => gen(r, (r) => { const b = pick(r, [10, 100, 1000]); const q = int(r, 2, 99); return { a: b * q, b, op: '/' }; }, () => true) },
      { grade: 4, label: 'üç basamaklı ÷ tek basamaklı, kalanlı',
        gen: (r) => gen(r, (r) => ({ a: int(r, 100, 999), b: int(r, 3, 9), op: '/r' }), (q) => q.a % q.b !== 0) },
      { grade: 4, label: 'üç basamaklı ÷ iki basamaklı, kalansız',
        gen: (r) => gen(r, (r) => { const b = int(r, 11, 49); const q = int(r, 3, 60); return { a: b * q, b, op: '/' }; }, (q) => q.a >= 100 && q.a <= 999 && q.b % 10 !== 0) },
      { grade: 5, label: 'dört basamaklı ÷ iki basamaklı, kalansız',
        gen: (r) => gen(r, (r) => { const b = int(r, 11, 99); const q = int(r, 12, 400); return { a: b * q, b, op: '/' }; }, (q) => q.a >= 1000 && q.a <= 9999 && q.b % 10 !== 0) },
      { grade: 5, label: 'üç basamaklı ÷ iki basamaklı, kalanlı',
        gen: (r) => gen(r, (r) => ({ a: int(r, 100, 999), b: int(r, 11, 49), op: '/r' }), (q) => q.a % q.b !== 0 && q.b % 10 !== 0 && q.a > q.b * 3) },
    ],
  },
  kare: {
    name: 'Kare ve küp',
    levels: [
      { grade: 5, label: 'kare (10\'a kadar)', gen: (r) => ({ a: int(r, 2, 10), b: 2, op: 'sq' }) },
      { grade: 5, label: 'küp (5\'e kadar)', gen: (r) => ({ a: int(r, 2, 5), b: 3, op: 'cu' }) },
      { grade: 5, label: 'kare (11–15) ve küp (6–10)',
        gen: (r) => (rand(r) < 0.5 ? { a: int(r, 11, 15), b: 2, op: 'sq' } : { a: int(r, 6, 10), b: 3, op: 'cu' }) },
    ],
  },
};

export const CORE = ['toplama', 'cikarma', 'carpma', 'bolme'];

// Konu blokları ve soru sayıları; toplam TOTAL.
export const PLAN = [
  { topic: 'toplama', count: 10 },
  { topic: 'cikarma', count: 12 },
  { topic: 'carpma', count: 10 },
  { topic: 'bolme', count: 12 },
  { topic: 'kare', count: 6 },
];

// ---------------------------------------------------------------- soru
export function expected(q) {
  switch (q.op) {
    case '+': return q.a + q.b;
    case '-': return q.a - q.b;
    case 'x': return q.a * q.b;
    case '/': return q.a / q.b;
    case '/r': return { q: Math.floor(q.a / q.b), r: q.a % q.b };
    case 'sq': return q.a * q.a;
    case 'cu': return q.a * q.a * q.a;
  }
  throw new Error('bilinmeyen işlem ' + q.op);
}

export function keyOf(q) {
  return `${q.a}${q.op}${q.b}`;
}

export function fmt(n) {
  // 10.000 ve üstünde Türkçe binlik ayırıcı (nokta)
  const s = String(n);
  if (n < 10000) return s;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Sayının adına göre tamlayan eki: 7'nin, 3'ün, 6'nın, 10'un ...
const ONES = ['ın', 'in', 'nin', 'ün', 'ün', 'in', 'nın', 'nin', 'in', 'un'];
const TENS = [null, 'un', 'nin', 'un', 'ın', 'nin', 'ın', 'in', 'in', 'ın'];
export function genitive(n) {
  let suffix;
  if (n === 0) suffix = 'ın';
  else if (n % 1000000 === 0) suffix = 'un';
  else if (n % 1000 === 0) suffix = 'in';
  else if (n % 100 === 0) suffix = 'ün';
  else if (n % 10 === 0) suffix = TENS[(n / 10) % 10];
  else suffix = ONES[n % 10];
  return `${fmt(n)}'${suffix}`;
}

const SYMBOL = { '+': '+', '-': '−', 'x': '×', '/': '÷', '/r': '÷' };

export function questionText(q) {
  if (q.op === 'sq') return { main: `${fmt(q.a)}²`, sub: `${genitive(q.a)} karesi` };
  if (q.op === 'cu') return { main: `${fmt(q.a)}³`, sub: `${genitive(q.a)} küpü` };
  const sub = q.op === '/r' ? 'Bölümü ve kalanı yaz.' : '';
  return { main: `${fmt(q.a)} ${SYMBOL[q.op]} ${fmt(q.b)}`, sub };
}

// ---------------------------------------------------------------- oturum
// previous: biten bir önceki oturum. Verilirse yeni oturum onun yanlışlarından başlar.
export function createSession(seed, now = Date.now(), previous = null) {
  const focus = previous ? previousFocus(previous) : null;
  return {
    v: STATE_VERSION,
    seed: seed >>> 0,
    rng: makeRng(seed),
    startedAt: now,
    finishedAt: null,
    basedOn: previous ? previous.startedAt : null,
    blocks: (focus ? focus.plan : PLAN).map((b) => ({ topic: b.topic, count: b.count, resolved: null })),
    blockIndex: 0,
    inBlock: 0,
    topics: focus ? focus.topics : {},
    used: [],
    history: [],
    current: null,
  };
}

const MIN_BLOCK = 6;
const SHIFT = 2;

// Önceki oturumdan yeni oturumun başlangıcını çıkarır:
// - Yanlışı olan konu, takıldığı ilk seviyenin bir altından başlar ve birer
//   seviye ilerler; takıldığı seviye atlanmadan yeniden sorulur.
// - Yanlışı olmayan konu, ulaştığı seviyeden başlar ve hızlı tırmanır.
// - Yanlışı olmayan her konudan SHIFT soru, yanlışı en çok olan konulara aktarılır.
export function previousFocus(prev) {
  const h = prev.history || [];
  const topics = {};
  const wrongs = {};
  const weak = [];
  for (const t of Object.keys(TOPICS)) {
    const items = h.filter((x) => x.topic === t);
    if (!items.length) continue;
    const st = levelStats(h, t);
    const wrongLevels = Object.keys(st).map(Number).filter((L) => st[L].w > 0).sort((a, b) => a - b);
    wrongs[t] = items.filter((x) => !x.correct).length;
    if (wrongLevels.length) {
      const failed = wrongLevels.find((L) => st[L].w > st[L].c) ?? wrongLevels[0];
      topics[t] = { level: Math.max(1, failed - 1), climbing: false };
      weak.push({ topic: t, name: TOPICS[t].name, level: failed, label: TOPICS[t].levels[failed - 1].label });
    } else {
      topics[t] = { level: Math.max(1, achievedLevel(h, t)), climbing: true };
    }
  }

  const plan = PLAN.map((b) => ({ ...b }));
  let pool = 0;
  for (const b of plan) {
    if (wrongs[b.topic] === 0 && b.count - SHIFT >= MIN_BLOCK) {
      b.count -= SHIFT;
      pool += SHIFT;
    }
  }
  const receivers = plan.filter((b) => wrongs[b.topic] > 0).sort((a, b) => wrongs[b.topic] - wrongs[a.topic]);
  if (!receivers.length) {
    plan.forEach((b, i) => (b.count = PLAN[i].count));
    pool = 0;
  }
  for (let i = 0; pool > 0; i++, pool--) receivers[i % receivers.length].count++;

  weak.sort((a, b) => wrongs[b.topic] - wrongs[a.topic]);
  return { plan, topics, weak };
}

export function isFinished(s) {
  return s.history.length >= TOTAL;
}

// Konu-seviye bazında doğru/yanlış/süre.
export function levelStats(history, topic) {
  const out = {};
  for (const h of history) {
    if (h.topic !== topic) continue;
    const st = (out[h.level] ||= { c: 0, w: 0, ms: 0, n: 0 });
    if (h.correct) st.c++;
    else st.w++;
    st.ms += h.ms;
    st.n++;
  }
  return out;
}

// Ulaşılan seviye: doğru sayısı yanlıştan az olmayan ve en az bir doğrusu
// olan en yüksek seviye (1 tabanlı). Hiçbiri yoksa 0.
export function achievedLevel(history, topic) {
  const st = levelStats(history, topic);
  let best = 0;
  for (const [lvl, v] of Object.entries(st)) {
    const L = Number(lvl);
    if (v.c >= 1 && v.c >= v.w && L > best) best = L;
  }
  return best;
}

export function achievedGrade(history, topic) {
  const L = achievedLevel(history, topic);
  return L === 0 ? 0 : TOPICS[topic].levels[L - 1].grade;
}

// Şimdiye kadar çalışılmış ana konuların en düşük sınıf düzeyi (en az 1).
export function estimatedGrade(s) {
  const seen = CORE.filter((t) => s.history.some((h) => h.topic === t));
  if (seen.length === 0) return 1;
  return Math.max(1, Math.min(...seen.map((t) => achievedGrade(s.history, t))));
}

export function bestGrade(s) {
  return Math.max(0, ...CORE.map((t) => achievedGrade(s.history, t)));
}

// Yeni konuya, tahmini düzeyin iki altındaki ilk seviyeden girilir (ısınma payı).
export function startLevel(topic, grade) {
  const levels = TOPICS[topic].levels;
  const i = levels.findIndex((l) => l.grade >= grade - 2);
  return i === -1 ? levels.length : i + 1;
}

// Ana konular arasında en zayıfı: ulaşılan seviyenin seviye sayısına oranı en düşük olan.
export function weakestTopic(s) {
  let best = CORE[0];
  let bestRatio = Infinity;
  for (const t of CORE) {
    const ratio = achievedLevel(s.history, t) / TOPICS[t].levels.length;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = t;
    }
  }
  return best;
}

function currentTopic(s) {
  const block = s.blocks[s.blockIndex];
  if (block.resolved === null) {
    // 5. sınıf konusu olan kare/küp, hiçbir ana konuda 4. sınıf düzeyine ulaşmamış
    // öğrenciye sorulmaz; o sorular en zayıf ana konuya gider.
    block.resolved = block.topic === 'kare' && bestGrade(s) < 4 ? weakestTopic(s) : block.topic;
  }
  return block.resolved;
}

export function nextQuestion(s) {
  if (s.current) return s.current;
  if (isFinished(s)) return null;
  while (s.inBlock >= s.blocks[s.blockIndex].count) {
    s.blockIndex++;
    s.inBlock = 0;
  }
  const topic = currentTopic(s);
  let ts = s.topics[topic];
  if (!ts) {
    ts = s.topics[topic] = { level: startLevel(topic, estimatedGrade(s)), climbing: true };
  }
  const { q, level } = freshQuestion(s, topic, ts.level);
  const key = keyOf(q);
  s.used.push(key);
  s.current = { n: s.history.length + 1, topic, level, a: q.a, b: q.b, op: q.op, key, elapsed: 0 };
  return s.current;
}

// Daha önce sorulmamış bir soru üretir. Seviyenin soru havuzu tükenmişse
// (ör. küp 2–5) en yakın komşu seviyeye geçer.
function freshQuestion(s, topic, level) {
  const levels = TOPICS[topic].levels;
  const used = new Set(s.used);
  const order = [level];
  for (let d = 1; d < levels.length; d++) order.push(level - d, level + d);
  for (const L of order) {
    if (L < 1 || L > levels.length) continue;
    for (let i = 0; i < 200; i++) {
      const q = levels[L - 1].gen(s.rng);
      if (!used.has(keyOf(q))) return { q, level: L };
    }
  }
  throw new Error('yeni soru kalmadı');
}

// Cevap: sayı, {q, r} (kalanlı bölme) ya da null (Bilmiyorum).
export function check(q, answer) {
  const exp = expected(q);
  if (answer === null || answer === undefined) return { correct: false, skipped: true, message: 'Yanlış.' };
  if (q.op === '/r') {
    const dq = Math.abs(answer.q - exp.q);
    const dr = Math.abs(answer.r - exp.r);
    if (dq === 0 && dr === 0) return { correct: true, message: 'Doğru.' };
    const parts = [];
    if (dq) parts.push(`bölümde ${dq}`);
    if (dr) parts.push(`kalanda ${dr}`);
    const msg = `Yanlış. Doğru cevaba ${parts.join(', ')} uzaktasın.`;
    return { correct: false, distance: { q: dq, r: dr }, message: msg };
  }
  const d = Math.abs(answer - exp);
  if (d === 0) return { correct: true, message: 'Doğru.' };
  return { correct: false, distance: d, message: `Yanlış. Doğru cevaba ${fmt(d)} uzaktasın.` };
}

// Uyarlama: doğruysa zorlaşır, yanlışsa aynı konuda kolaylaşır. Konunun ilk
// yanlışına kadar iki seviye atlanır (hızlı tırmanış), sonra birer birer.
function adapt(s, topic, correct, level) {
  const ts = (s.topics[topic] ||= { level, climbing: true });
  const max = TOPICS[topic].levels.length;
  if (correct) ts.level = Math.min(max, ts.level + (ts.climbing ? 2 : 1));
  else {
    ts.climbing = false;
    ts.level = Math.max(1, ts.level - 1);
  }
}

export function submit(s, answer, ms, now = Date.now()) {
  const q = s.current;
  if (!q) throw new Error('aktif soru yok');
  const res = check(q, answer);
  s.history.push({
    n: q.n, topic: q.topic, level: q.level, a: q.a, b: q.b, op: q.op,
    answer, correct: res.correct, ms: Math.max(0, Math.round(ms)),
    pattern: res.correct ? null : classifyError(q, answer),
  });
  adapt(s, q.topic, res.correct, q.level);
  s.inBlock++;
  s.current = null;
  if (isFinished(s)) s.finishedAt = now;
  return res;
}

// ---------------------------------------------------------------- hata kalıpları
const reverseNum = (n) => Number(String(n).split('').reverse().join(''));

// Her basamakta büyük rakamdan küçüğü çıkarma: 52 − 17 → 45
export function digitAbsDiff(a, b) {
  const da = digits(a);
  const db = digits(b);
  let out = 0;
  for (let i = da.length - 1; i >= 0; i--) out = out * 10 + Math.abs(da[i] - (db[i] || 0));
  return out;
}

// Onluk bozup soldaki basamağı azaltmamak: 52 − 17 → 12−7=5, 5−1=4 → 45; 43 − 18 → 35
export function borrowNoDecrement(a, b) {
  const da = digits(a);
  const db = digits(b);
  let out = 0;
  for (let i = da.length - 1; i >= 0; i--) {
    const x = da[i] - (db[i] || 0);
    out = out * 10 + (x < 0 ? x + 10 : x);
  }
  return out;
}

// Eldeyi eklememek: 47 + 38 → 75
export function additionNoCarry(a, b) {
  const da = digits(a);
  const db = digits(b);
  let out = 0;
  for (let i = Math.max(da.length, db.length) - 1; i >= 0; i--) out = out * 10 + (((da[i] || 0) + (db[i] || 0)) % 10);
  return out;
}

// Çarpmada her basamağın çarpımını yan yana yazmak: 23 × 4 → "8" + "12" = 812
export function multiplyConcat(a, b) {
  return Number(digits(a).reverse().map((d) => d * b).join(''));
}

// Çarpmada eldeyi eklememek: 23 × 4 → 82 (8, 12'nin 2'si)
export function multiplyNoCarry(a, b) {
  return Number(digits(a).reverse().map((d) => (d * b) % 10).join(''));
}

export function classifyError(q, answer) {
  if (answer === null || answer === undefined) return 'bilmiyorum';
  const { a, b, op } = q;
  if (op === '/r') {
    const exp = expected(q);
    if (answer.r >= b) return 'kalan-buyuk';
    if (answer.q === exp.q) return 'kalan-hatasi';
    if (answer.q === exp.q + 1 || answer.q === exp.q - 1) return 'bir-fark';
    return null;
  }
  const exp = expected(q);
  const n = answer;
  if (op === '-') {
    if (n === digitAbsDiff(a, b) && borrowCount(a, b) > 0) return 'ters-cikarma';
    if (n === borrowNoDecrement(a, b) && borrowCount(a, b) > 0) return 'bozma-azaltmama';
    if (n === a + b) return 'islem-karisikligi';
  }
  if (op === '+') {
    if (n === additionNoCarry(a, b) && carryCount(a, b) > 0) return 'elde-unutma';
    if (n === Math.abs(a - b)) return 'islem-karisikligi';
  }
  if (op === 'x') {
    if ((b === 10 || b === 100 || b === 1000) && (n * 10 === exp || n === exp * 10 || n === a)) return 'sifir-hatasi';
    if (b < 10 && a >= 10 && (n === multiplyConcat(a, b) || n === multiplyNoCarry(a, b))) return 'carpma-elde';
    if (a < 10 && b < 10 && (n === a * (b + 1) || n === a * (b - 1) || n === (a + 1) * b || n === (a - 1) * b)) return 'tablo-hatasi';
    if (n === a + b) return 'islem-karisikligi';
  }
  if (op === '/') {
    if ((b === 10 || b === 100 || b === 1000) && (n * 10 === exp || n === exp * 10 || n === a)) return 'sifir-hatasi';
    if (n === a - b || n === a * b) return 'islem-karisikligi';
  }
  if (op === 'sq' && n === a * 2) return 'kare-hatasi';
  if (op === 'cu' && (n === a * 3 || n === a * a)) return 'kup-hatasi';
  if (exp >= 10 && n !== exp && reverseNum(n) === exp && String(n).length === String(exp).length) return 'rakam-ters';
  if (Math.abs(n - exp) === 1) return 'bir-fark';
  return null;
}

export const PATTERNS = {
  'ters-cikarma': 'Çıkarmada onluk bozmak yerine her basamakta büyük rakamdan küçüğü çıkarıyor (ör. 52 − 17 = 45).',
  'bozma-azaltmama': 'Onluk bozuyor ama soldaki basamağı 1 azaltmayı unutuyor.',
  'elde-unutma': 'Toplamada eldeyi bir sonraki basamağa eklemeyi unutuyor.',
  'carpma-elde': 'Çarpmada eldeyi eklemiyor ya da basamak çarpımlarını yan yana yazıyor.',
  'tablo-hatasi': 'Çarpım tablosunda komşu çarpımla karıştırıyor (ör. 7 × 8 = 48).',
  'sifir-hatasi': '10, 100, 1000 ile çarpma/bölmede sıfır sayısını karıştırıyor.',
  'kalan-buyuk': 'Kalanı bölenden büyük ya da ona eşit yazıyor; bölümü 1 artırmalıydı.',
  'kalan-hatasi': 'Bölümü doğru buluyor, kalanı yanlış hesaplıyor.',
  'kare-hatasi': 'Kareyi sayıyı 2 ile çarpmak sanıyor (ör. 7² = 14).',
  'kup-hatasi': 'Küpü sayıyı 3 ile çarpmak ya da karesini almak sanıyor.',
  'islem-karisikligi': 'İşlemi karıştırıyor (ör. çıkarma yerine toplama yapıyor).',
  'rakam-ters': 'Doğru rakamları ters sırayla yazıyor.',
  'bir-fark': 'Sonuç 1 eksik ya da fazla: sayarken ya da bölümde kayma.',
  'bilmiyorum': '"Bilmiyorum" dediği sorular.',
  'yavas-temel': 'Temel işlemleri doğru yapıyor ama yavaş; henüz ezber/otomatik değil.',
};

// ---------------------------------------------------------------- rapor
export function answerText(q, answer) {
  if (answer === null || answer === undefined) return '—';
  if (q.op === '/r') return `${fmt(answer.q)} kalan ${fmt(answer.r)}`;
  return fmt(answer);
}

export function expectedText(q) {
  const e = expected(q);
  if (q.op === '/r') return `${fmt(e.q)} kalan ${fmt(e.r)}`;
  return fmt(e);
}

export function fmtDuration(ms) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} dk ${s} sn` : `${s} sn`;
}

const SLOW_BASIC_MS = 6000;

export function buildReport(s) {
  const h = s.history;
  const topics = [];
  for (const t of Object.keys(TOPICS)) {
    const items = h.filter((x) => x.topic === t);
    if (items.length === 0) continue;
    const levels = TOPICS[t].levels;
    const L = achievedLevel(h, t);
    const st = levelStats(h, t);
    const weak = Object.entries(st)
      .filter(([, v]) => v.w > 0)
      .map(([lvl, v]) => ({ level: Number(lvl), label: levels[lvl - 1].label, grade: levels[lvl - 1].grade, c: v.c, w: v.w }))
      .sort((x, y) => x.level - y.level);
    const grade = L ? levels[L - 1].grade : 0;
    const lowest = levels[0].grade;
    topics.push({
      topic: t,
      name: TOPICS[t].name,
      level: L,
      grade,
      // İlk seviyesini geçemediği konu, o konunun sınıfından bir alt düzey demektir
      // (bölme 3. sınıfta başlar; geçemeyen 2. sınıf düzeyindedir).
      effective: grade || lowest - 1,
      gradeLabel: grade ? `${grade}. sınıf` : lowest > 1 ? 'henüz değil' : '1. sınıfın altında',
      reached: L ? levels[L - 1].label : null,
      next: L < levels.length ? levels[L].label : null,
      correct: items.filter((x) => x.correct).length,
      total: items.length,
      ms: items.reduce((acc, x) => acc + x.ms, 0),
      weak,
    });
  }

  const core = topics.filter((t) => CORE.includes(t.topic));
  const minGrade = core.length ? Math.min(...core.map((t) => t.effective)) : 0;
  const weakest = core.filter((t) => t.effective === minGrade).map((t) => t.name);

  const counts = {};
  const examples = {};
  for (const x of h) {
    if (!x.pattern) continue;
    counts[x.pattern] = (counts[x.pattern] || 0) + 1;
    (examples[x.pattern] ||= []).length < 3 &&
      examples[x.pattern].push(`${questionText(x).main} → ${answerText(x, x.answer)} (doğrusu ${expectedText(x)})`);
  }

  // Temel olgular (tek basamaklı toplama/çıkarma, çarpım tablosu, tablodan bölme)
  const basic = h.filter((x) => x.correct && (
    (x.topic === 'toplama' && x.level <= 2) || (x.topic === 'cikarma' && x.level <= 1) ||
    (x.topic === 'carpma' && x.level <= 2) || (x.topic === 'bolme' && x.level === 1)));
  if (basic.length >= 2) {
    const avg = basic.reduce((acc, x) => acc + x.ms, 0) / basic.length;
    if (avg > SLOW_BASIC_MS) {
      counts['yavas-temel'] = basic.length;
      examples['yavas-temel'] = [`temel işlemlerde ortalama ${fmtDuration(avg)}`];
    }
  }

  const patterns = Object.entries(counts)
    .map(([code, count]) => ({ code, count, text: PATTERNS[code], examples: examples[code] || [] }))
    .sort((x, y) => y.count - x.count);

  const totalMs = h.reduce((acc, x) => acc + x.ms, 0);
  return {
    overall: {
      grade: minGrade,
      text: minGrade ? `${minGrade}. sınıf seviyesi` : '1. sınıf seviyesinin altında',
      weakest,
    },
    topics,
    patterns,
    correct: h.filter((x) => x.correct).length,
    total: h.length,
    totalMs,
    avgMs: h.length ? totalMs / h.length : 0,
  };
}

export function gradeText(g) {
  return g ? `${g}. sınıf` : '1. sınıfın altında';
}

// Paylaşmak için düz metin rapor.
export function reportText(rep, date) {
  const lines = [];
  lines.push(`Aritmetik seviye testi — ${date}`);
  lines.push(`Genel: ${rep.overall.text}${rep.overall.weakest.length ? ` (en zayıf: ${rep.overall.weakest.join(', ')})` : ''}`);
  lines.push(`${rep.correct}/${rep.total} doğru · toplam ${fmtDuration(rep.totalMs)} · soru başına ort. ${fmtDuration(rep.avgMs)}`);
  lines.push('');
  for (const t of rep.topics) {
    lines.push(`${t.name}: ${t.gradeLabel} — ${t.correct}/${t.total} doğru, ort. ${fmtDuration(t.ms / t.total)}`);
    if (t.reached) lines.push(`  Başardığı en zor: ${t.reached}`);
    if (t.next) lines.push(`  Sıradaki hedef: ${t.next}`);
    for (const w of t.weak) lines.push(`  Eksik: ${w.label} (${w.c} doğru, ${w.w} yanlış)`);
  }
  if (rep.patterns.length) {
    lines.push('');
    lines.push('Hata kalıpları:');
    for (const p of rep.patterns) {
      lines.push(`- ${p.text} (${p.count} kez)`);
      for (const e of p.examples) lines.push(`    ${e}`);
    }
  }
  return lines.join('\n');
}
