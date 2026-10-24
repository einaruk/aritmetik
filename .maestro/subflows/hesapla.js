// copyTextFrom ile okunan soruyu ("8 + 5", "1.204 − 356") hesaplar.
const m = maestro.copiedText.trim().match(/^([\d.]+) ([+−×÷]) ([\d.]+)$/);
if (!m) throw new Error('soru okunamadı: ' + maestro.copiedText);
const num = (s) => Number(s.replace(/\./g, ''));
const a = num(m[1]);
const b = num(m[3]);
const value = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]];
output.question = maestro.copiedText.trim();
output.digits = String(value);
output.i = 0;
output.typed = '';
