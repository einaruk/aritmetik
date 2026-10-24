import { test, expect } from '@playwright/test';

// Ekrandaki soruyu okuyup doğru cevabı hesaplar (testler uygulamanın içine bakmaz).
async function readQuestion(page) {
  const main = (await page.locator('[data-id="question"]').textContent()).trim();
  const sub = (await page.locator('.question .sub').textContent()).trim();
  const num = (s) => Number(s.replace(/\./g, ''));
  let m;
  if ((m = main.match(/^([\d.]+)²$/))) return { kind: 'n', value: num(m[1]) ** 2 };
  if ((m = main.match(/^([\d.]+)³$/))) return { kind: 'n', value: num(m[1]) ** 3 };
  m = main.match(/^([\d.]+) ([+−×÷]) ([\d.]+)$/);
  if (!m) throw new Error(`soru okunamadı: ${main}`);
  const a = num(m[1]);
  const b = num(m[3]);
  if (m[2] === '÷' && /kalan/.test(sub)) return { kind: 'r', q: Math.floor(a / b), r: a % b };
  const value = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]];
  return { kind: 'n', value };
}

async function tapKey(page, k) {
  await page.locator(`.keypad [data-key="${k}"]`).tap();
}

async function typeNumber(page, n) {
  for (const d of String(n)) await tapKey(page, d);
}

async function answerQuestion(page, q, offset = 0) {
  if (q.kind === 'r') {
    await typeNumber(page, q.q + offset);
    await tapKey(page, 'ok'); // kalan kutusuna geçer
    await typeNumber(page, q.r);
  } else {
    await typeNumber(page, q.value + offset);
  }
  await tapKey(page, 'ok');
}

async function start(page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Başla' }).tap();
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 50');
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('tam test: hepsi doğru cevaplanınca 5. sınıf raporu çıkar', async ({ page }) => {
  await start(page);
  let remainderSeen = false;
  for (let n = 1; n <= 50; n++) {
    await expect(page.locator('[data-id="count"]')).toHaveText(`Soru ${n} / 50`);
    const q = await readQuestion(page);
    if (q.kind === 'r') remainderSeen = true;
    await answerQuestion(page, q);
    await expect(page.locator('[data-id="feedback"]')).toHaveText('Doğru.');
  }
  await expect(page.getByRole('heading', { name: 'Test bitti' })).toBeVisible();
  await expect(page.locator('[data-id="overall"]')).toHaveText('5. sınıf seviyesi');
  await expect(page.locator('table.log tbody tr')).toHaveCount(50);
  await expect(page.locator('[data-topic]')).toHaveCount(5);
  expect(remainderSeen).toBe(true);

  // Sonuç ana sayfada listelenir ve yeniden açılabilir.
  await page.getByRole('button', { name: 'Ana sayfa' }).tap();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item').tap();
  await expect(page.locator('[data-id="overall"]')).toHaveText('5. sınıf seviyesi');
});

test('yanlış cevapta uzaklık söylenir, doğru cevap söylenmez; Devam ile geçilir', async ({ page }) => {
  await start(page);
  const q = await readQuestion(page);
  await answerQuestion(page, q, 7);
  const fb = page.locator('[data-id="feedback"]');
  await expect(fb).toHaveText('Yanlış. Doğru cevaba 7 uzaktasın.');
  await expect(page.locator('.keypad [data-key="5"]')).toBeDisabled();
  await expect(page.locator('[data-id="ok"]')).toHaveText('Devam');
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 50'); // kendiliğinden geçmez
  await tapKey(page, 'ok');
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 2 / 50');
});

test('doğru cevapta "Doğru." yazar ve kendiliğinden sonraki soruya geçer', async ({ page }) => {
  await start(page);
  await answerQuestion(page, await readQuestion(page));
  await expect(page.locator('[data-id="feedback"]')).toHaveText('Doğru.');
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 2 / 50');
});

test('Bilmiyorum yanlış sayılır', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Bilmiyorum' }).tap();
  await expect(page.locator('[data-id="feedback"]')).toHaveText('Yanlış.');
});

test('boş cevap gönderilmez, sil tuşu çalışır', async ({ page }) => {
  await start(page);
  await tapKey(page, 'ok');
  await expect(page.locator('[data-id="feedback"]')).toBeHidden();
  await typeNumber(page, 123);
  await tapKey(page, 'del');
  await expect(page.locator('[data-id="value-q"]')).toHaveText('12');
});

test('uygulama kapanıp açılınca test kaldığı yerden sürer', async ({ page }) => {
  await start(page);
  for (let i = 0; i < 3; i++) {
    await answerQuestion(page, await readQuestion(page));
    await expect(page.locator('[data-id="count"]')).toHaveText(`Soru ${i + 2} / 50`);
  }
  const before = await page.locator('[data-id="question"]').textContent();
  await page.reload();
  await page.getByRole('button', { name: 'Devam et (3/50)' }).tap();
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 4 / 50');
  await expect(page.locator('[data-id="question"]')).toHaveText(before);
});

test('süre ölçülür; uygulama arka plandayken geçen süre sayılmaz', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  await answerQuestion(page, await readQuestion(page));
  const ms = await page.evaluate(() => JSON.parse(localStorage.getItem('aritmetik.session.v1')).history[0].ms);
  expect(ms).toBeGreaterThan(1300);
  expect(ms).toBeLessThan(2900);
});

test('yerleşim ekrana sığar: yatay kaydırma yok, tuşlar görünür ve parmakla basılabilir', async ({ page }) => {
  await start(page);
  const vp = page.viewportSize();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(vp.height);
  for (const el of await page.locator('.key, .skip').all()) {
    const box = await el.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  }
});

test('en uzun soru (beş basamaklı) ekrana sığar', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const e = await import('./js/engine.js');
    const s = e.createSession(1);
    e.nextQuestion(s);
    Object.assign(s.current, { topic: 'cikarma', level: 9, a: 98765, b: 43218, op: '-' });
    localStorage.setItem('aritmetik.session.v1', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('[data-id="question"]')).toHaveText('98.765 − 43.218');
  const fits = await page.locator('[data-id="question"]').evaluate((el) => el.scrollWidth <= el.parentElement.clientWidth);
  expect(fits).toBe(true);
});

test('kalanlı bölmede iki kutu var; kalan kutusu boşken gönderilmez', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const e = await import('./js/engine.js');
    const s = e.createSession(1);
    e.nextQuestion(s);
    Object.assign(s.current, { topic: 'bolme', level: 3, a: 47, b: 5, op: '/r' });
    localStorage.setItem('aritmetik.session.v1', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('.question .sub')).toHaveText('Bölümü ve kalanı yaz.');
  await typeNumber(page, 9);
  await tapKey(page, 'ok');
  await expect(page.locator('[data-field="r"]')).toHaveClass(/active/);
  await expect(page.locator('[data-id="feedback"]')).toBeHidden();
  await typeNumber(page, 4);
  await tapKey(page, 'ok');
  await expect(page.locator('[data-id="feedback"]')).toHaveText('Yanlış. Doğru cevaba kalanda 2 uzaktasın.');
});

test('ana ekrana eklenebilir: manifest ve ikonlar yerinde', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href)).json();
  expect(manifest.display).toBe('standalone');
  const icons = [...manifest.icons.map((i) => i.src), await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')];
  for (const src of icons) expect((await request.get(src)).status()).toBe(200);
});

test('ilk açılıştan sonra internetsiz çalışır', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Başla' }).tap();
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 50');
  await context.setOffline(false);
});

test('yeni test önceki testin yanlışlarından başlar', async ({ page }) => {
  await page.goto('./');
  // Çıkarmada onluk bozmayı bilmeyen öğrencinin biten testi.
  await page.evaluate(async () => {
    const e = await import('./js/engine.js');
    const s = e.createSession(5, Date.now() - 60_000);
    while (!e.isFinished(s)) {
      const q = e.nextQuestion(s);
      const knows = q.topic !== 'cikarma' || q.level <= 3;
      const exp = e.expected(q);
      e.submit(s, knows ? exp : (q.op === '/r' ? { q: exp.q + 1, r: exp.r } : exp + 1), 2000);
    }
    localStorage.setItem('aritmetik.results.v1', JSON.stringify([s]));
  });
  await page.reload();
  const focus = page.locator('[data-id="focus"]');
  await expect(focus).toContainText('önceki testin yanlışlarından');
  await expect(focus).toContainText('Çıkarma: iki basamaklı − tek basamaklı, onluk bozarak');
  await page.getByRole('button', { name: 'Başla', exact: true }).tap();
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 50');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('aritmetik.session.v1')));
  expect(s.basedOn).not.toBeNull();
  expect(s.topics.cikarma).toEqual({ level: 3, climbing: false });
  expect(s.blocks.find((b) => b.topic === 'cikarma').count).toBe(18);
});

test('Sıfırdan başla önceki testi dikkate almaz', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const e = await import('./js/engine.js');
    const s = e.createSession(5, Date.now() - 60_000);
    while (!e.isFinished(s)) e.submit(s, null, 1000, e.nextQuestion(s) && Date.now());
    localStorage.setItem('aritmetik.results.v1', JSON.stringify([s]));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Sıfırdan başla' }).tap();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('aritmetik.session.v1')));
  expect(s.basedOn).toBeNull();
  expect(s.blocks.map((b) => b.count)).toEqual([10, 12, 10, 12, 6]);
});

// ---------------------------------------------------------------- soru sayısı ve power
const powerValue = async (page) => Number(await page.locator('[data-id="power-value"]').textContent());

test('soru sayısı seçilir, o kadar soru sorulur ve bir sonraki açılışta hatırlanır', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-id="count-input"]')).toHaveValue('50');
  await page.locator('.chip', { hasText: '10' }).tap();
  await page.getByRole('button', { name: 'Başla' }).tap();
  for (let n = 1; n <= 10; n++) {
    await expect(page.locator('[data-id="count"]')).toHaveText(`Soru ${n} / 10`);
    await answerQuestion(page, await readQuestion(page));
    await expect(page.locator('[data-id="feedback"]')).toHaveText('Doğru.');
  }
  await expect(page.getByRole('heading', { name: 'Test bitti' })).toBeVisible();
  await expect(page.locator('table.log tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Ana sayfa' }).tap();
  await expect(page.locator('[data-id="count-input"]')).toHaveValue('10');
});

test('geçersiz soru sayısıyla test başlamaz', async ({ page }) => {
  await page.goto('./');
  for (const v of ['3', '101', '']) {
    await page.locator('[data-id="count-input"]').fill(v);
    await page.getByRole('button', { name: 'Başla' }).tap();
    await expect(page.locator('[data-id="count-error"]')).toHaveText('5 ile 100 arasında bir sayı yaz.');
    await expect(page.locator('[data-id="count"]')).toHaveCount(0);
  }
  await page.locator('[data-id="count-input"]').fill('7');
  await page.getByRole('button', { name: 'Başla' }).tap();
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 7');
});

test('power ekranın tepesinde; doğru cevapta artar, Bilmiyorum ile azalır', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('aritmetik.power.v1', '40'));
  await start(page);
  const bar = page.locator('[data-id="power"]');
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox()).y).toBeLessThan((await page.locator('[data-id="count"]').boundingBox()).y);
  expect(await powerValue(page)).toBe(40);

  await answerQuestion(page, await readQuestion(page));
  await expect(page.locator('[data-id="power-delta"]')).toHaveText(/^\+\d+$/);
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 2 / 50');
  const up = await powerValue(page);
  expect(up).toBeGreaterThan(40);

  await page.getByRole('button', { name: 'Bilmiyorum' }).tap();
  await expect(page.locator('[data-id="power-delta"]')).toHaveText(/^−\d+$/);
  expect(await powerValue(page)).toBeLessThan(up);
  expect(await page.evaluate(() => Number(localStorage.getItem('aritmetik.power.v1')))).toBe(await powerValue(page));
});

test('power bir önceki testten kalan değerle sürer', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-id="count-input"]').fill('5');
  await page.getByRole('button', { name: 'Başla' }).tap();
  for (let n = 1; n <= 5; n++) {
    await expect(page.locator('[data-id="count"]')).toHaveText(`Soru ${n} / 5`);
    await answerQuestion(page, await readQuestion(page));
  }
  await expect(page.locator('[data-id="power-change"]')).toHaveText(/^Power 0 → \d+ \(\+\d+\)$/);
  const end = await powerValue(page);
  expect(end).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Ana sayfa' }).tap();
  expect(await powerValue(page)).toBe(end);
  await page.reload();
  await page.getByRole('button', { name: 'Başla', exact: true }).tap();
  expect(await powerValue(page)).toBe(end);
});

test('power olmadan başlamış yarım test, kayıtlı power ile sürer', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const e = await import('./js/engine.js');
    const s = e.createSession(1);
    delete s.total;
    delete s.power;
    delete s.powerStart;
    e.nextQuestion(s);
    localStorage.setItem('aritmetik.session.v1', JSON.stringify(s));
    localStorage.setItem('aritmetik.power.v1', '33');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Devam et (0/50)' })).toHaveCount(0); // history boş: doğrudan soru
  await expect(page.locator('[data-id="count"]')).toHaveText('Soru 1 / 50');
  expect(await powerValue(page)).toBe(33);
});
