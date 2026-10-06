# Correntra Downloader 0.4.9

## Türkçe

- Google Drive indirmelerinde son dosya bağlantısı, dosya adı ve tarayıcının
  kullandığı oturum bilgileri birlikte aktarılır. Drive onay adımlarını önce
  tarayıcıda tamamlayın; paylaşım/görüntüleme sayfası doğrudan dosya değildir.
- Eşzamanlı tarayıcı olayları aynı dosyayı iki kez kuyruğa eklemez. Dosya adı
  seçiminde tam Windows yolu gönderilmez; güncellenen bilgiler tekrar okunur.
- Oturum bilgileri başka bir sunucuya yönlendirmede kaldırılır. Başarısız
  devirler, POST indirmeleri ve tarayıcıya özel blob dosyaları tarayıcıda sürer.
- Derleme işlemleri klasörü kilitleyen gereksiz MSBuild süreçlerini açık bırakmaz.
- Paket, SHA-256 ve LGPL denetimleri yapılan FFmpeg 8.1.3 sürümünü içerir.
- Eklenti ve .NET testleri geçti; herkese açık Drive, GitHub ve W3C dosyaları
  canlı indirme motoruyla indirildi ve içerikleri doğrulandı. Kullanıcının
  özel Drive dosyası ve gerçek Chrome/Edge yakalama akışı henüz doğrulanmadı.

**Kurulum:** `Correntra.Downloader-win-Setup.exe` dosyasını indirip çalıştırın.
Güncellemeden sonra Chrome/Edge'deki Correntra Catch eklentisini yeniden yükleyin.
Portable paket kurulum istemeyen kullanıcılar içindir. Dosya doğrulama bilgileri
`SHA256SUMS.txt` içindedir.

## English

Google Drive and other browser HTTP downloads now carry their refreshed final
URL, filename and actual request session headers. Concurrent download events
are deduplicated; browser User-Agent replaces the engine default. Credentials
are stripped across redirect origins. Failed handoffs, POST downloads and
browser-only blobs remain in the browser. Build processes no longer leave
orphaned MSBuild workers holding the repository directory open.

The extension and .NET regression suites passed; public Drive, GitHub and W3C
files completed through the live agent with verified contents. Signed-in/private
Drive capture and actual Chrome/Edge event delivery remain unverified.

Install using `Correntra.Downloader-win-Setup.exe`, then reload the unpacked
Correntra Catch extension. Checksums are provided in `SHA256SUMS.txt`.
