import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL, TOPICS, PLAN, CORE, makeRng, createSession, nextQuestion, submit, isFinished,
  expected, check, classifyError, buildReport, reportText, genitive, fmt, questionText,
  carryCount, borrowCount, digitAbsDiff, borrowNoDecrement, additionNoCarry, startLevel, previousFocus,
} from '../js/engine.js';

const L = (n) => String(n).length;

// Her seviyenin üretmesi gereken soruyu bağımsız olarak tarif eden kurallar.
const RULES = {
  toplama: [
    (q) => L(q.a) === 1 && L(q.b) === 1 && q.a + q.b <= 10,
    (q) => L(q.a) === 1 && L(q.b) === 1 && q.a + q.b > 10,
    (q) => L(q.a) === 2 && L(q.b) === 1 && carryCount(q.a, q.b) === 0,
    (q) => L(q.a) === 2 && L(q.b) === 2 && carryCount(q.a, q.b) === 0 && q.a + q.b < 100,
    (q) => L(q.a) === 2 && L(q.b) === 2 && carryCount(q.a, q.b) === 1 && q.a + q.b < 100,
    (q) => L(q.a) === 3 && L(q.b) === 3 && carryCount(q.a, q.b) === 0,
    (q) => L(q.a) === 3 && L(q.b) === 3 && carryCount(q.a, q.b) >= 2 && q.a + q.b < 1000,
    (q) => L(q.a) === 4 && L(q.b) === 4 && carryCount(q.a, q.b) >= 2 && q.a + q.b < 10000,
    (q) => L(q.a) === 5 && L(q.b) >= 4 && carryCount(q.a, q.b) >= 3 && q.a + q.b < 100000,
  ],
  cikarma: [
    (q) => q.a <= 10 && L(q.b) === 1 && q.a > q.b,
    (q) => L(q.a) === 2 && L(q.b) === 1 && borrowCount(q.a, q.b) === 0,
    (q) => L(q.a) === 2 && L(q.b) === 2 && borrowCount(q.a, q.b) === 0,
    (q) => L(q.a) === 2 && L(q.b) === 1 && borrowCount(q.a, q.b) === 1,
    (q) => L(q.a) === 2 && L(q.b) === 2 && borrowCount(q.a, q.b) === 1 && q.a - q.b >= 10,
    (q) => L(q.a) === 3 && L(q.b) === 3 && borrowCount(q.a, q.b) === 1,
    (q) => L(q.a) === 3 && L(q.b) === 3 && borrowCount(q.a, q.b) === 2,
    (q) => L(q.a) === 4 && L(q.b) === 4 && borrowCount(q.a, q.b) >= 2,
    (q) => L(q.a) === 5 && L(q.b) >= 4 && borrowCount(q.a, q.b) >= 3,
  ],
  carpma: [
    (q) => q.a <= 5 && q.b <= 5 && q.a >= 2 && q.b >= 2,
    (q) => q.a <= 9 && q.b <= 9 && (q.a >= 6 || q.b >= 6),
    (q) => L(q.a) === 2 && L(q.b) === 1,
    (q) => [10, 100, 1000].includes(q.b) && q.a < 100,
    (q) => L(q.a) === 3 && L(q.b) === 1,
    (q) => L(q.a) === 2 && L(q.b) === 2,
    (q) => L(q.a) === 3 && L(q.b) === 2,
  ],
  bolme: [
    (q) => q.op === '/' && q.b <= 9 && q.a / q.b <= 9,
    (q) => q.op === '/' && L(q.a) === 2 && L(q.b) === 1 && q.a / q.b >= 10,
    (q) => q.op === '/r' && L(q.a) === 2 && L(q.b) === 1 && q.a % q.b !== 0,
    (q) => q.op === '/' && L(q.a) === 3 && L(q.b) === 1,
    (q) => q.op === '/' && [10, 100, 1000].includes(q.b),
    (q) => q.op === '/r' && L(q.a) === 3 && L(q.b) === 1 && q.a % q.b !== 0,
    (q) => q.op === '/' && L(q.a) === 3 && L(q.b) === 2,
    (q) => q.op === '/' && L(q.a) === 4 && L(q.b) === 2,
    (q) => q.op === '/r' && L(q.a) === 3 && L(q.b) === 2 && q.a % q.b !== 0,
  ],
  kare: [
    (q) => q.op === 'sq' && q.a >= 2 && q.a <= 10,
    (q) => q.op === 'cu' && q.a >= 2 && q.a <= 5,
    (q) => (q.op === 'sq' && q.a >= 11 && q.a <= 15) || (q.op === 'cu' && q.a >= 6 && q.a <= 10),
  ],
};

test('her seviye tanımına uyan soru üretir', () => {
  for (const [topic, def] of Object.entries(TOPICS)) {
    assert.equal(def.levels.length, RULES[topic].length, `${topic} seviye sayısı`);
    def.levels.forEach((level, i) => {
      for (let seed = 1; seed <= 400; seed++) {
        const q = level.gen(makeRng(seed * 7919 + i));
        assert.ok(RULES[topic][i](q), `${topic} seviye ${i + 1}: ${JSON.stringify(q)}`);
        const e = expected(q);
        const values = typeof e === 'object' ? [e.q, e.r] : [e];
        for (const v of values) {
          assert.ok(Number.isInteger(v) && v >= 0, `tamsayı ve negatif değil: ${JSON.stringify(q)}`);
        }
        if (q.op === '/') assert.equal(q.a % q.b, 0, 'kalansız bölme');
      }
    });
  }
});

test('seviyeler kolaydan zora: sınıf düzeyi hiç düşmez, en fazla 5. sınıf', () => {
  for (const def of Object.values(TOPICS)) {
    for (let i = 0; i < def.levels.length; i++) {
      assert.ok(def.levels[i].grade >= 1 && def.levels[i].grade <= 5);
      if (i) assert.ok(def.levels[i].grade >= def.levels[i - 1].grade);
    }
  }
});

test('plan toplam 50 soru', () => {
  assert.equal(TOTAL, 50);
  assert.equal(PLAN.reduce((a, b) => a + b.count, 0), TOTAL);
});

// ------------------------------------------------ oturum simülasyonu
function rightAnswer(q) {
  return expected(q);
}

function wrongAnswer(q) {
  const e = expected(q);
  return q.op === '/r' ? { q: e.q + 1, r: e.r } : e + 3;
}

// Belirli sınıf düzeyine kadar olan seviyeleri bilen öğrenci.
const studentOfGrade = (g) => (q) => TOPICS[q.topic].levels[q.level - 1].grade <= g;

function run(seed, knows, previous = null) {
  const s = createSession(seed, 0, previous);
  const asked = [];
  while (!isFinished(s)) {
    const q = nextQuestion(s);
    asked.push({ ...q });
    const ok = knows(q);
    submit(s, ok ? rightAnswer(q) : wrongAnswer(q), 1000);
  }
  return { s, asked };
}

const STRATEGIES = {
  hepsiDogru: () => true,
  hepsiYanlis: () => false,
  sinif2: studentOfGrade(2),
  sinif3: studentOfGrade(3),
  sinif4: studentOfGrade(4),
};

test('her oturum tam 50 soru, aynı soru tekrar sorulmaz', () => {
  for (const [name, knows] of Object.entries(STRATEGIES)) {
    for (let seed = 1; seed <= 150; seed++) {
      const { s, asked } = run(seed, knows);
      assert.equal(s.history.length, TOTAL, name);
      assert.equal(new Set(asked.map((q) => q.key)).size, TOTAL, `${name} seed ${seed}: tekrar`);
      assert.equal(nextQuestion(s), null);
      assert.ok(s.finishedAt !== null);
    }
  }
});

test('doğrudan sonra zorlaşır, yanlıştan sonra aynı konuda kolaylaşır', () => {
  for (const [name, knows] of Object.entries(STRATEGIES)) {
    for (let seed = 1; seed <= 100; seed++) {
      const { s } = run(seed, knows);
      const h = s.history;
      for (let i = 1; i < h.length; i++) {
        const prev = h[i - 1];
        const cur = h[i];
        if (prev.topic !== cur.topic) continue;
        const max = TOPICS[cur.topic].levels.length;
        if (prev.correct) assert.ok(cur.level > prev.level || prev.level === max, `${name} ${seed} #${cur.n}: zorlaşmadı`);
        else assert.ok(cur.level < prev.level || prev.level === 1, `${name} ${seed} #${cur.n}: kolaylaşmadı`);
      }
    }
  }
});

test('hepsi doğru: genel seviye 5. sınıf, kare/küp sorulur', () => {
  const { s } = run(42, STRATEGIES.hepsiDogru);
  const rep = buildReport(s);
  assert.equal(rep.overall.grade, 5);
  assert.equal(rep.correct, TOTAL);
  assert.ok(s.history.some((h) => h.topic === 'kare'));
  assert.equal(rep.patterns.length, 0);
});

test('hepsi yanlış: seviye 1. sınıfın altında, kare/küp sorulmaz', () => {
  const { s } = run(42, STRATEGIES.hepsiYanlis);
  const rep = buildReport(s);
  assert.equal(rep.overall.grade, 0);
  assert.match(rep.overall.text, /altında/);
  assert.ok(!s.history.some((h) => h.topic === 'kare'));
  for (const t of rep.topics) assert.ok(t.weak.length > 0);
});

test('düzeyi bilinen öğrenci doğru düzeyde ölçülür', () => {
  for (const g of [2, 3, 4]) {
    for (let seed = 1; seed <= 50; seed++) {
      const { s } = run(seed, STRATEGIES[`sinif${g}`]);
      const rep = buildReport(s);
      assert.equal(rep.overall.grade, g, `sınıf ${g} seed ${seed}`);
      for (const t of rep.topics.filter((t) => CORE.includes(t.topic))) {
        // Konunun en düşük seviyesi g'den yüksekse (ör. bölme 3. sınıfta başlar) 0 çıkar.
        const lowest = TOPICS[t.topic].levels[0].grade;
        assert.equal(t.grade, lowest > g ? 0 : g, `sınıf ${g} ${t.topic} seed ${seed}`);
        if (lowest > g) assert.equal(t.gradeLabel, 'henüz değil');
      }
      assert.equal(s.history.some((h) => h.topic === 'kare'), g >= 4, `sınıf ${g} kare`);
    }
  }
});

test('yeni konu, tahmini düzeyin iki altından başlar', () => {
  assert.equal(startLevel('toplama', 1), 1);
  assert.equal(startLevel('cikarma', 5), 6); // ilk 3. sınıf seviyesi
  assert.equal(startLevel('carpma', 2), 1);
  assert.equal(startLevel('bolme', 5), 1);
});

test('oturum JSON olarak kaydedilip aynen sürdürülebilir', () => {
  const a = createSession(777, 0);
  for (let i = 0; i < 20; i++) {
    const q = nextQuestion(a);
    submit(a, i % 3 ? rightAnswer(q) : wrongAnswer(q), 500);
  }
  nextQuestion(a); // ekranda bekleyen soru da kayda girer
  const b = JSON.parse(JSON.stringify(a));
  assert.deepEqual(b.current, a.current);
  while (!isFinished(a)) {
    const qa = nextQuestion(a);
    const qb = nextQuestion(b);
    assert.deepEqual(qb, qa);
    submit(a, rightAnswer(qa), 500);
    submit(b, rightAnswer(qb), 500);
  }
  assert.deepEqual(b.history, a.history);
});

test('süre kaydı yuvarlanır ve negatif olmaz', () => {
  const s = createSession(1, 0);
  nextQuestion(s);
  submit(s, 0, 1234.6);
  nextQuestion(s);
  submit(s, 0, -5);
  assert.equal(s.history[0].ms, 1235);
  assert.equal(s.history[1].ms, 0);
});

// ------------------------------------------------ geri bildirim
test('geri bildirim mesajları', () => {
  const sub = { a: 52, b: 17, op: '-' };
  assert.deepEqual(check(sub, 35), { correct: true, message: 'Doğru.' });
  assert.equal(check(sub, 45).message, 'Yanlış. Doğru cevaba 10 uzaktasın.');
  assert.equal(check(sub, 30).message, 'Yanlış. Doğru cevaba 5 uzaktasın.');
  assert.equal(check(sub, null).message, 'Yanlış.');
  assert.equal(check({ a: 45678, b: 12345, op: '+' }, 48023).message, 'Yanlış. Doğru cevaba 10.000 uzaktasın.');

  const rem = { a: 47, b: 5, op: '/r' }; // 9 kalan 2
  assert.equal(check(rem, { q: 9, r: 2 }).message, 'Doğru.');
  assert.equal(check(rem, { q: 8, r: 2 }).message, 'Yanlış. Doğru cevaba bölümde 1 uzaktasın.');
  assert.equal(check(rem, { q: 9, r: 4 }).message, 'Yanlış. Doğru cevaba kalanda 2 uzaktasın.');
  assert.equal(check(rem, { q: 8, r: 7 }).message, 'Yanlış. Doğru cevaba bölümde 1, kalanda 5 uzaktasın.');
});

// ------------------------------------------------ hata kalıpları
test('hata kalıbı yardımcıları', () => {
  assert.equal(digitAbsDiff(52, 17), 45);
  assert.equal(digitAbsDiff(403, 158), 355);
  assert.equal(borrowNoDecrement(43, 16), 37);
  assert.equal(additionNoCarry(47, 38), 75);
  assert.equal(carryCount(47, 38), 1);
  assert.equal(carryCount(999, 1), 3);
  assert.equal(borrowCount(403, 158), 2);
  assert.equal(borrowCount(58, 25), 0);
});

test('hata kalıpları sınıflandırılır', () => {
  const c = (a, op, b, ans) => classifyError({ a, b, op }, ans);
  assert.equal(c(52, '-', 17, 45), 'ters-cikarma');
  assert.equal(c(43, '-', 16, 37), 'bozma-azaltmama');
  assert.equal(c(31, '-', 12, 43), 'islem-karisikligi');
  assert.equal(c(47, '+', 38, 75), 'elde-unutma');
  assert.equal(c(23, 'x', 4, 812), 'carpma-elde');
  assert.equal(c(7, 'x', 8, 48), 'tablo-hatasi');
  assert.equal(c(47, 'x', 100, 470), 'sifir-hatasi');
  assert.equal(c(3600, '/', 10, 36), 'sifir-hatasi');
  assert.equal(c(47, '/r', 5, { q: 8, r: 7 }), 'kalan-buyuk');
  assert.equal(c(47, '/r', 5, { q: 9, r: 3 }), 'kalan-hatasi');
  assert.equal(c(7, 'sq', 2, 14), 'kare-hatasi');
  assert.equal(c(3, 'cu', 3, 9), 'kup-hatasi');
  assert.equal(c(25, '+', 27, 25), 'rakam-ters');
  assert.equal(c(9, '-', 4, 4), 'bir-fark');
  assert.equal(c(9, '-', 4, null), 'bilmiyorum');
  assert.equal(c(9, '-', 4, 1), null);
});

test('raporda hata kalıbı ve yavaşlık görünür', () => {
  const s = createSession(5, 0);
  while (!isFinished(s)) {
    const q = nextQuestion(s);
    const ans = q.op === '-' && borrowCount(q.a, q.b) > 0 ? digitAbsDiff(q.a, q.b) : rightAnswer(q);
    submit(s, ans, 9000);
  }
  const rep = buildReport(s);
  const codes = rep.patterns.map((p) => p.code);
  assert.ok(codes.includes('ters-cikarma'), codes.join());
  assert.ok(codes.includes('yavas-temel'), codes.join());
  const cik = rep.topics.find((t) => t.topic === 'cikarma');
  assert.ok(cik.weak.some((w) => /bozarak/.test(w.label)));
  const text = reportText(rep, '17 Ekim');
  assert.match(text, /Genel: /);
  assert.match(text, /Hata kalıpları:/);
});

// ------------------------------------------------ biçim
test('Türkçe tamlayan eki', () => {
  const cases = { 2: "2'nin", 3: "3'ün", 4: "4'ün", 5: "5'in", 6: "6'nın", 7: "7'nin", 8: "8'in", 9: "9'un", 10: "10'un", 11: "11'in", 12: "12'nin", 13: "13'ün", 14: "14'ün", 15: "15'in", 20: "20'nin", 40: "40'ın", 60: "60'ın", 100: "100'ün" };
  for (const [n, want] of Object.entries(cases)) assert.equal(genitive(Number(n)), want);
});

test('sayı ve soru metni biçimi', () => {
  assert.equal(fmt(9999), '9999');
  assert.equal(fmt(12345), '12.345');
  assert.equal(fmt(98901), '98.901');
  assert.deepEqual(questionText({ a: 52, b: 17, op: '-' }), { main: '52 − 17', sub: '' });
  assert.deepEqual(questionText({ a: 7, b: 2, op: 'sq' }), { main: '7²', sub: "7'nin karesi" });
  assert.deepEqual(questionText({ a: 3, b: 3, op: 'cu' }), { main: '3³', sub: "3'ün küpü" });
  assert.equal(questionText({ a: 47, b: 5, op: '/r' }).sub, 'Bölümü ve kalanı yaz.');
});

// ------------------------------------------------ önceki oturumdan başlama
test('yeni oturum önceki oturumun yanlışlarından başlar', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const prev = run(seed, STRATEGIES.sinif2).s;
    const focus = previousFocus(prev);
    const cik = TOPICS.cikarma.levels;
    const firstFail = cik.findIndex((l) => l.grade > 2) + 1; // 2. sınıf öğrencisinin takıldığı ilk çıkarma seviyesi
    assert.deepEqual(focus.topics.cikarma, { level: firstFail - 1, climbing: false });
    assert.ok(focus.weak.some((w) => w.topic === 'cikarma' && w.level === firstFail));

    const { s, asked } = run(seed + 1000, STRATEGIES.sinif2, prev);
    assert.equal(s.history.length, TOTAL);
    assert.equal(new Set(asked.map((q) => q.key)).size, TOTAL);
    assert.equal(s.basedOn, prev.startedAt);
    // Çıkarmanın ilk iki sorusu: takıldığı seviyenin bir altı, sonra takıldığı seviye.
    const firstTwo = s.history.filter((h) => h.topic === 'cikarma').slice(0, 2).map((h) => h.level);
    assert.deepEqual(firstTwo, [firstFail - 1, firstFail]);
    // Ölçüm tutarlı kalır.
    assert.equal(buildReport(s).overall.grade, 2);
  }
});

test('yanlışı olmayan konulardan sorular yanlışı olan konulara aktarılır', () => {
  // Yalnız çıkarmada zayıf öğrenci: diğer konularda yanlışı yok.
  const onlySubWeak = (q) => q.topic !== 'cikarma' || TOPICS.cikarma.levels[q.level - 1].grade <= 2;
  const prev = run(3, onlySubWeak).s;
  const wrongs = (t) => prev.history.filter((h) => h.topic === t && !h.correct).length;
  const { plan } = previousFocus(prev);
  assert.equal(plan.reduce((a, b) => a + b.count, 0), TOTAL);
  for (const b of plan) {
    const base = PLAN.find((p) => p.topic === b.topic).count;
    if (wrongs(b.topic) === 0 && base - 2 >= 6) assert.equal(b.count, base - 2, b.topic);
    if (wrongs(b.topic) > 0) assert.ok(b.count >= base, b.topic);
  }
  assert.equal(plan.find((b) => b.topic === 'cikarma').count, 12 + 2 * 3); // kare bloğu 6'nın altına inmez
});

test('hepsi doğru önceki oturum: plan aynı kalır, konular ulaşılan seviyeden başlar', () => {
  const prev = run(9, STRATEGIES.hepsiDogru).s;
  const focus = previousFocus(prev);
  assert.deepEqual(focus.plan, PLAN);
  assert.equal(focus.weak.length, 0);
  for (const t of Object.keys(TOPICS)) {
    assert.deepEqual(focus.topics[t], { level: TOPICS[t].levels.length, climbing: true });
  }
  const { s } = run(10, STRATEGIES.hepsiDogru, prev);
  assert.equal(buildReport(s).overall.grade, 5);
});

test('üst üste oturumlar: her biri bir öncekinden başlar, kayıt JSON ile taşınır', () => {
  let prev = null;
  for (let i = 0; i < 5; i++) {
    const { s } = run(100 + i, STRATEGIES.sinif3, prev && JSON.parse(JSON.stringify(prev)));
    assert.equal(s.history.length, TOTAL);
    assert.equal(buildReport(s).overall.grade, 3);
    prev = s;
  }
});

test('yalnız bir konuda zayıf, diğerlerinde güçlü öğrenciye kare/küp yine sorulur', () => {
  const onlySubWeak = (q) => q.topic !== 'cikarma' || TOPICS.cikarma.levels[q.level - 1].grade <= 2;
  for (let seed = 1; seed <= 30; seed++) {
    const { s } = run(seed, onlySubWeak);
    assert.ok(s.history.some((h) => h.topic === 'kare'), `seed ${seed}`);
    assert.equal(buildReport(s).overall.grade, 2);
  }
});
