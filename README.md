# Aritmetik

iPhone ve Android için uyarlamalı aritmetik seviye testi. 1. sınıftan 5. sınıfa kadar
toplama, çıkarma, çarpma, bölme (kalanlı dahil), kare ve küp konularını ölçer. Soruları
uygulama kendisi üretir; internet, hesap ya da yapay zekâ gerekmez. İlk açılıştan sonra
internetsiz de çalışır.

## iPhone'a kurulum

1. iPhone'da **Safari** ile şu adresi aç: **https://einaruk.github.io/aritmetik/**
2. Alttaki **Paylaş** düğmesine (yukarı ok olan kare) dokun.
3. **Ana Ekrana Ekle**'yi seç, sonra **Ekle**'ye dokun.
4. Ana ekrandaki **Aritmetik** simgesinden aç. Uygulama tam ekran açılır.

Güncelleme olunca uygulama bir sonraki açılışta kendini yeniler.

## Android'e kurulum

1. Telefonda şu linki aç ve **aritmetik.apk** dosyasını indir:
   **https://github.com/einaruk/aritmetik/releases/download/android/aritmetik.apk**
2. İndirme bitince dosyaya dokun.
3. Telefon "bilinmeyen uygulamalar" iznini sorarsa tarayıcıya (ör. Chrome) izin ver, geri dön, **Yükle**'ye dokun.
4. Play Protect uyarı verirse **Yine de yükle**'yi seç. Uygulama Play Store'da olmadığı için bu uyarı normal.

Yeni sürüm için aynı linkten indirip yükle; testler ve sonuçlar silinmez.
Android uygulaması internet istemez; dosyalar APK'nın içinde.

## Nasıl çalışır

- Her soruda iki sayı ve tek işlem var. Kesir, ondalık, yüzde yok.
- Doğru cevapta "Doğru." yazar ve soru biraz zorlaşır. Yanlış cevapta
  "Yanlış. Doğru cevaba X uzaktasın." yazar, doğru cevabı söylemez; aynı konuda biraz
  daha kolay bir soru gelir. Aynı soru iki kez sorulmaz.
- Soru sayısı ana sayfada seçilir (5–100, varsayılan 50); son seçilen sayı hatırlanır.
- Konular sırayla gelir. 50 soruda: toplama (10 soru), çıkarma (12), çarpma (10),
  bölme (12), kare ve küp (6); başka soru sayısında bu oranlarla bölünür. Kare ve küp
  5. sınıf konusudur; hiçbir konuda 4. sınıf düzeyine ulaşmamış öğrencide bu sorular
  en zayıf konuya gider.
- Yeni test bir önceki testin yanlışlarından başlar: her konu takıldığı seviyenin bir
  altından başlar ve o seviyeyi atlamadan ilerler; yanlışı olmayan konulardan 2'şer soru
  yanlışı çok olan konulara aktarılır. Ana sayfada nelerin tekrar edileceği yazar.
  **Sıfırdan başla** önceki testi dikkate almaz.
- Ekranın tepesindeki **Power** göstergesi 0–100 arası bir beceri puanıdır ve testten
  teste taşınır. Zor soruyu bilmek çok, kolayı bilmek az puan kazandırır; kolay soruda
  yanılmak çok, zorda yanılmak az kaybettirir. Puan, öğrencinin yarı yarıya bildiği
  soru zorluğuna oturur: 20'ler 1–2. sınıf, 50 civarı 3. sınıf, 70'ler 4. sınıf, 90'lar
  5. sınıf düzeyi. Hesap için bkz. `js/engine.js`, `powerDelta`.
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

### Android APK

`android/` bir [Capacitor](https://capacitorjs.com/) projesi. Web dosyalarını
(`index.html`, `css/`, `js/`, `icons/`) uygulamanın içine koyar. Web dosyasını
değiştirince Android tarafında ayrıca bir şey yapmak gerekmez.

GitHub Actions (`.github/workflows/android.yml`) main'e her push'ta imzalı APK derler
ve **android** sürümüne koyar; yukarıdaki indirme linki hep aynı kalır.

İmza anahtarı repoda değil. Aynı anahtarla imzalanmayan APK eski kurulumun üzerine
kurulamaz; bu yüzden anahtarı kaybetme. Anahtar ve parolası yerelde
`~/.config/aritmetik-android/` altında, GitHub'da şu iki secret'ta:

```sh
base64 -w0 ~/.config/aritmetik-android/aritmetik.p12 | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD < ~/.config/aritmetik-android/password.txt
```

Yerelde derlemek için JDK 21 ve Android SDK gerekir:

```sh
npm run android:sync                     # www/ klasörünü kurar, android/ içine kopyalar
cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
```

İkonu değiştirince `npm run icons` iOS ve Android ikonlarını yeniden üretir.
