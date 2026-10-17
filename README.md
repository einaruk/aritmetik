# Aritmetik

iPhone için 50 soruluk uyarlamalı aritmetik seviye testi. 1. sınıftan 5. sınıfa kadar
toplama, çıkarma, çarpma, bölme (kalanlı dahil), kare ve küp konularını ölçer. Soruları
uygulama kendisi üretir; internet, hesap ya da yapay zekâ gerekmez. İlk açılıştan sonra
internetsiz de çalışır.

## iPhone'a kurulum

1. iPhone'da **Safari** ile şu adresi aç: **https://einaruk.github.io/aritmetik/**
2. Alttaki **Paylaş** düğmesine (yukarı ok olan kare) dokun.
3. **Ana Ekrana Ekle**'yi seç, sonra **Ekle**'ye dokun.
4. Ana ekrandaki **Aritmetik** simgesinden aç. Uygulama tam ekran açılır.

Güncelleme olunca uygulama bir sonraki açılışta kendini yeniler.

## Nasıl çalışır

- Her soruda iki sayı ve tek işlem var. Kesir, ondalık, yüzde yok.
- Doğru cevapta "Doğru." yazar ve soru biraz zorlaşır. Yanlış cevapta
  "Yanlış. Doğru cevaba X uzaktasın." yazar, doğru cevabı söylemez; aynı konuda biraz
  daha kolay bir soru gelir. Aynı soru iki kez sorulmaz.
- Konular sırayla gelir: toplama (10 soru), çıkarma (12), çarpma (10), bölme (12),
  kare ve küp (6). Kare ve küp 5. sınıf konusudur; hiçbir konuda 4. sınıf düzeyine
  ulaşmamış öğrencide bu 6 soru en zayıf konuya gider.
- Yeni test bir önceki testin yanlışlarından başlar: her konu takıldığı seviyenin bir
  altından başlar ve o seviyeyi atlamadan ilerler; yanlışı olmayan konulardan 2'şer soru
  yanlışı çok olan konulara aktarılır. Ana sayfada nelerin tekrar edileceği yazar.
  **Sıfırdan başla** önceki testi dikkate almaz.
- Her sorunun süresi ölçülür. Uygulama arka plandayken geçen süre sayılmaz.
- Test yarıda kapanırsa kaldığı yerden sürer.
- Sonda genel seviye (ör. "3. sınıf seviyesi"), konu konu seviye ve eksikler, yanlış
  cevaplardaki hata kalıpları (ör. "onluk bozmak yerine büyük rakamdan küçüğü çıkarıyor")
  ve süreler gösterilir. **Sonucu paylaş** ile rapor WhatsApp'tan gönderilebilir.
- Testler ve sonuçlar yalnız o telefonda saklanır (son 20 test).

## Geliştirme

Derleme adımı yok; düz HTML, CSS ve JavaScript modülleri.

| Dosya | İçerik |
|---|---|
| `js/engine.js` | Soru üretimi, uyarlama, puanlama, hata kalıpları, rapor. DOM'a dokunmaz. |
| `js/app.js` | Ekranlar, tuş takımı, süre ölçümü, kayıt. |
| `sw.js` | Çevrimdışı önbellek. Dosya değiştirince `CACHE` sürümünü artır. |

```sh
npm install
npx playwright install webkit chromium
npm run serve        # http://localhost:8080/
npm test             # birim + uçtan uca testler
```

Uçtan uca testler iPhone 12 mini ekranında (Safari içinde 375 × 629, ana ekran uygulaması
olarak 375 × 812) WebKit ve Chromium ile koşar. WebKit'in sistem kütüphaneleri olmayan
makinede yalnız Chromium için: `E2E_BROWSERS=chromium npm run test:e2e`.
GitHub Actions her push'ta ikisini de koşar.
