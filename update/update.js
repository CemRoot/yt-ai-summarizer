/**
 * Gleano — What's New / Update Page Controller
 *
 * ═══════════════════════════════════════════════════════════════
 *  HOW TO ADD A NEW VERSION:
 *  1. Add a new entry at the TOP of the CHANGELOG array below
 *  2. Each entry has: version, date, and changes array
 *  3. Each change has: type ('new' | 'improved' | 'fixed' | 'changed') and text (i18n key)
 *  4. Add matching i18n strings in the I18N object for each language
 *  5. Update manifest.json version number
 * ═══════════════════════════════════════════════════════════════
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);

  /**
   * Changelog data — newest version first.
   * The `text` field references a key in the I18N.changes object.
   */
  const CHANGELOG = [
    {
      version: '2.1.5',
      date: '2026-10-07',
      changes: [
        { type: 'fixed',    text: 'c215_article_button_scope' },
        { type: 'changed',  text: 'c215_no_homepage_button' },
      ]
    },
    {
      version: '2.1.4',
      date: '2026-10-04',
      changes: [
        { type: 'improved', text: 'c214_caption_hosts' },
        { type: 'new',      text: 'c214_article_button' },
        { type: 'changed',  text: 'c214_no_permissions' },
      ]
    },
    {
      version: '2.1.3',
      date: '2026-09-30',
      changes: [
        { type: 'fixed',    text: 'c213_real_errors' },
        { type: 'fixed',    text: 'c213_sign_in' },
        { type: 'improved', text: 'c213_caption_sources' },
        { type: 'improved', text: 'c213_empty_urls' },
        { type: 'changed',  text: 'c213_ci_tests' },
      ]
    },
    {
      version: '2.1.2',
      date: '2026-06-30',
      changes: [
        { type: 'fixed',    text: 'c212_article_errors' },
        { type: 'improved', text: 'c212_article_chat' },
        { type: 'fixed',    text: 'c212_article_keys' },
      ]
    },
    {
      version: '2.1.1',
      date: '2026-06-23',
      changes: [
        { type: 'fixed',    text: 'c211_ai_unavailable' },
        { type: 'improved', text: 'c211_fallback_chain' },
      ]
    },
    {
      version: '2.1.0',
      date: '2026-06-14',
      changes: [
        { type: 'new',      text: 'c210_rebrand_gleano' },
        { type: 'new',      text: 'c210_article_reader' },
        { type: 'improved', text: 'c210_memory' },
        { type: 'fixed',    text: 'c210_tab_race' },
        { type: 'changed',  text: 'c210_scripting' },
      ]
    },
    {
      version: '2.0.3',
      date: '2026-04-23',
      changes: [
        { type: 'improved', text: 'c203_localized_store_titles' },
      ]
    },
    {
      version: '2.0.2',
      date: '2026-04-23',
      changes: [
        { type: 'fixed',    text: 'c202_credits_message' },
        { type: 'fixed',    text: 'c202_podcast_voices' },
        { type: 'fixed',    text: 'c202_empty_response_credits' },
        { type: 'improved', text: 'c202_podcast_speed' },
        { type: 'improved', text: 'c202_summary_density' },
      ]
    },
    {
      version: '2.0.1',
      date: '2026-04-17',
      changes: [
        { type: 'fixed',    text: 'c201_credit_overdraft' },
        { type: 'fixed',    text: 'c201_tts_pricing' },
        { type: 'improved', text: 'c201_error_messages' },
        { type: 'improved', text: 'c201_privacy_redesign' },
        { type: 'new',      text: 'c201_production_live' },
      ]
    },
    {
      version: '2.0.0',
      date: '2026-04-12',
      changes: [
        { type: 'new', text: 'c200_freemium' },
        { type: 'improved', text: 'c200_chat' },
        { type: 'changed', text: 'c200_backend' },
      ]
    },
    {
      version: '1.8.1',
      date: '2026-04-04',
      changes: [
        { type: 'fixed', text: 'c181_version_labels' },
        { type: 'changed', text: 'c181_store_bundle' },
      ]
    },
    {
      version: '1.8.0',
      date: '2026-04-04',
      changes: [
        { type: 'fixed', text: 'c180_tts_model' },
        { type: 'new', text: 'c180_volume' },
        { type: 'new', text: 'c180_wav' },
        { type: 'improved', text: 'c180_tabs' },
        { type: 'improved', text: 'c180_clear_content' },
      ]
    },
    {
      version: '1.7.2',
      date: '2026-03-31',
      changes: [
        { type: 'changed', text: 'c172_uninstall_url' },
      ]
    },
    {
      version: '1.7.1',
      date: '2026-03-30',
      changes: [
        { type: 'improved', text: 'c171_privacy' },
        { type: 'improved', text: 'c171_pages' },
        { type: 'changed', text: 'c171_readme' },
      ]
    },
    {
      version: '1.7.0',
      date: '2026-03-18',
      changes: [
        { type: 'new',      text: 'c170_chat' },
        { type: 'improved', text: 'c170_fullscreen' },
        { type: 'changed', text: 'c170_console' },
        { type: 'fixed',    text: 'c170_podcast_rate' },
        { type: 'improved', text: 'c170_chat_context' },
      ]
    },
    {
      version: '1.6.4',
      date: '2026-03-12',
      changes: [
        { type: 'new',      text: 'c164_whats_new_page' },
        { type: 'improved', text: 'c164_performance' },
        { type: 'fixed',    text: 'c164_transcript_fix' },
      ]
    },
    {
      version: '1.6.3',
      date: '2026-03-01',
      changes: [
        { type: 'new',      text: 'c163_podcast' },
        { type: 'improved', text: 'c163_ollama_models' },
        { type: 'fixed',    text: 'c163_cache_bug' },
      ]
    },
    {
      version: '1.6.2',
      date: '2026-02-15',
      changes: [
        { type: 'new',      text: 'c162_ollama_cloud' },
        { type: 'improved', text: 'c162_combined_api' },
        { type: 'fixed',    text: 'c162_spa_nav' },
      ]
    },
    {
      version: '1.6.1',
      date: '2026-02-01',
      changes: [
        { type: 'improved', text: 'c161_multi_lang' },
        { type: 'improved', text: 'c161_onboarding' },
        { type: 'fixed',    text: 'c161_dark_mode' },
      ]
    },
  ];

  const I18N = {
    en: {
      heroTitle: "What's New",
      heroSub: 'Gleano has been updated with new features and improvements.',
      latest: 'Latest',
      previousVersions: 'Previous Versions',
      continueYoutube: 'Continue to YouTube',
      openSettings: 'Open Settings',
      footerPowered: 'Powered by',
      groupNew: 'New',
      groupImproved: 'Improved',
      groupFixed: 'Fixed',
      groupChanged: 'Changed',

      c215_article_button_scope: 'The article button now appears only on news stories, blog posts and forum threads — not on Instagram, X, Facebook, search, shops or apps',
      c215_no_homepage_button: 'Site homepages and section pages no longer show the button; open the story itself',
      c214_caption_hosts: 'Caption downloads stay on YouTube hosts (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'On an article, the Gleano button on the page starts the summary. Chat stays a tab.',
      c214_no_permissions: 'Article button: content script on ordinary http(s) pages, not YouTube',
      c213_real_errors: 'Real error messages instead of a generic failure',
      c213_sign_in: 'Expired sessions say to sign in again',
      c213_caption_sources: 'Caption extraction tries every source until one returns a real transcript',
      c213_empty_urls: 'Empty caption URLs are not retried',
      c213_ci_tests: 'Unit tests run in CI',
      c212_article_errors: 'Article Reader shows specific errors',
      c212_article_chat: 'Article chat answers topic questions from model knowledge and still declines unrelated tasks',
      c212_article_keys: 'Article settings and credits read the correct storage keys',

      c211_ai_unavailable: 'Fixed "AI service temporarily unavailable" errors — when Google\u2019s AI servers are briefly overloaded, summaries and chat now retry automatically and fall back to another provider instead of failing',
      c211_fallback_chain: 'More resilient managed AI — text now flows through Ollama Cloud → Gemini 2.5 Flash (with retry) → a last-resort provider, so a single outage no longer stops your request',

      c210_rebrand_gleano: 'Rebranded to Gleano — the extension name is now "Gleano" in all 21 locales, reflecting video + article reading beyond YouTube',
      c210_article_reader: 'Article Reader — summarize and chat about any news article or blog post. Open from the popup on supported pages; uses on-demand injection via activeTab (no broad host permissions)',
      c210_memory: 'Memory optimization — LRU eviction for in-memory caches (max 20 videos), proper cleanup of MutationObservers and event listeners on panel teardown',
      c210_tab_race: 'Tab switching race condition fixed — guard clauses prevent stale UI updates when rapidly switching Summary / Key Points / Detailed / Chat / Podcast during async work',
      c210_scripting: 'Scripting permission added — enables dynamic Article Reader injection on the tab you activate. YouTube host permissions unchanged',

      c203_localized_store_titles: 'Chrome Web Store listing title is now localized per language (21 locales) — product name is "Gleano" in every locale; descriptions mention YouTube videos and articles where relevant',
      c202_credits_message: 'When your free credits run out, you now see a clear "Credits exhausted" message with an upgrade button — no more misleading "Invalid API Key" error on managed AI',
      c202_podcast_voices: 'Podcast audio always uses both voices (Alex + Sam). Script generation now forces alternating speakers via a JSON schema, so the "one voice reads everything" bug is gone',
      c202_empty_response_credits: 'If the AI provider returns an empty reply (rare server issue), your credits are no longer deducted — the call is refunded and you can retry immediately',
      c202_podcast_speed: 'Podcast generation ~17% faster end-to-end on real videos (script 10.8s → 5.2s, TTS 53.9s → 48.3s on our 18-min benchmark)',
      c202_summary_density: 'Summaries on long videos are tighter and denser: per-section length targets in the prompt cut padding 22–35% while keeping every cited study, figure, and name',

      c201_credit_overdraft: 'Credit check before managed AI runs: long videos now warn you upfront if you need more credits, instead of starting and failing partway through',
      c201_tts_pricing: 'Podcast audio (Gemini TTS) billing now follows actual token usage from the provider, so your balance always matches real usage',
      c201_error_messages: 'Clearer managed-AI messages when something goes wrong — low credits, rate limits, and provider issues each explain what you can do next',
      c201_privacy_redesign: 'Privacy Policy redesigned with dark-mode support, at-a-glance guarantees, and a side-by-side BYOK vs Managed AI summary',
      c201_production_live: 'Managed AI is fully available: sign in with Google for cloud features, and subscribe to Pro through Stripe when you need more',

      c200_freemium: 'Sign in with Google for managed AI (cloud summaries, chat, podcast) with free credits or Pro — or keep using your own API keys (BYOK)',
      c200_chat: 'Video chat answers stay grounded in the transcript — fewer generic assistant replies when you greet or ask how to get help',
      c200_backend: 'Faster, more reliable managed AI pipeline (Supabase Edge + Stripe Pro); extension version 2.0.0 for Chrome Web Store',

      c181_version_labels: 'Settings popup and What’s New show the live version from manifest.json (no stale hardcoded label)',
      c181_store_bundle: 'Store package includes update/ assets; manifest bumped for Chrome Web Store resubmit',

      c180_tts_model: 'Podcast TTS: switched to gemini-2.5-flash-preview-tts (correct v1beta model) — fixes “model not found” errors',
      c180_volume: 'Podcast volume slider (0–100%) with setting saved across videos',
      c180_wav: 'Download podcast audio as WAV for offline listening or sharing (e.g. WhatsApp as document)',
      c180_tabs: 'Non-blocking tab switching: summary, podcast, and chat each have their own busy state',
      c180_clear_content: 'Tab switch clears content immediately — no brief flash of another tab’s text',

      c172_uninstall_url: 'Uninstall feedback page now opens on your portfolio domain (cemkoyluoglu.codes) instead of GitHub Pages',

      c171_privacy: 'Privacy policy redesigned — clearer layout; Chat, Gemini TTS, storage, and permissions',
      c171_pages: 'GitHub Pages docs landing polish; uninstall page uses an inline SVG favicon',
      c171_readme: 'README: project structure, uninstall hosting on Vercel, maintainer pre-release checklist',

      c170_chat: 'Interactive Video Chat — ask follow-ups grounded in the transcript (Groq, Ollama, Gemini)',
      c170_fullscreen: 'Fullscreen on YouTube auto-hides the extension toggle and side panel',
      c170_console: 'Removed routine console.log / console.warn; console.error kept for serious failures only',
      c170_podcast_rate: 'Fixed podcast playback speed change causing a small position jump',
      c170_chat_context: 'Chat transcript context aligned to 80K characters (same order of magnitude as summaries)',

      c164_whats_new_page: "What's New page — see what changed after every update",
      c164_performance: 'Faster transcript extraction with optimized fallback pipeline',
      c164_transcript_fix: 'Fixed caption tracks not loading for certain restricted videos',

      c163_podcast: 'AI Podcast — two-host NotebookLM-style conversations with Gemini TTS',
      c163_ollama_models: 'Added Qwen3-Next 80B and DeepSeek V3.2 to Ollama Cloud',
      c163_cache_bug: 'Fixed LRU cache not invalidating expired entries properly',

      c162_ollama_cloud: 'Ollama Cloud provider — Gemini 3 Flash and massive open-source models',
      c162_combined_api: 'Combined API call: Summary + Key Points + Detailed in one request',
      c162_spa_nav: 'Fixed panel not resetting when navigating between videos (SPA)',

      c161_multi_lang: 'Expanded to 20+ output languages with improved auto-detection',
      c161_onboarding: 'Redesigned onboarding with multi-language selector',
      c161_dark_mode: 'Fixed dark mode panel inconsistencies on YouTube',
    },
    tr: {
      heroTitle: 'Neler Yeni',
      heroSub: 'Gleano yeni özellikler ve iyileştirmelerle güncellendi.',
      latest: 'Güncel',
      previousVersions: 'Önceki Sürümler',
      continueYoutube: "YouTube'a Devam Et",
      openSettings: 'Ayarları Aç',
      footerPowered: 'Altyapı',
      groupNew: 'Yeni',
      groupImproved: 'İyileştirme',
      groupFixed: 'Düzeltme',
      groupChanged: 'Değişiklik',

      c215_article_button_scope: 'Makale düğmesi artık yalnızca haber, blog yazısı ve forum başlıklarında çıkar — Instagram, X, Facebook, arama, alışveriş ve uygulamalarda çıkmaz',
      c215_no_homepage_button: 'Site ana sayfaları ve kategori sayfaları düğme göstermez; haberin kendisini açın',
      c214_caption_hosts: 'Altyazı indirmeleri YouTube sunucularında kalır (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'Makale sayfasında Gleano düğmesi özeti hemen başlatır. Sohbet üstte sekme olarak kalır.',
      c214_no_permissions: 'Makale düğmesi: YouTube dışında sıradan http(s) sayfalarında içerik betiği',
      c213_real_errors: 'Genel bir başarısızlık yerine gerçek hata mesajları',
      c213_sign_in: 'Süresi dolan oturumlar yeniden giriş yapmanızı söyler',
      c213_caption_sources: 'Altyazı çıkarma, gerçek bir transkript dönene kadar her kaynağı dener',
      c213_empty_urls: 'Boş altyazı adresleri yeniden denenmez',
      c213_ci_tests: 'Birim testler CI içinde çalışır',
      c212_article_errors: 'Makale Okuyucu belirli hataları gösterir',
      c212_article_chat: 'Makale sohbeti konu sorularını model bilgisinden yanıtlar ve ilgisiz görevleri yine reddeder',
      c212_article_keys: 'Makale ayarları ve krediler doğru depolama anahtarlarını okur',

      c211_ai_unavailable: '"Yapay zeka hizmeti geçici olarak kullanılamıyor" hataları giderildi — Google\'ın yapay zeka sunucuları kısa süreli yoğunken özetler ve sohbet artık otomatik olarak yeniden deniyor ve başka bir sağlayıcıya geçiyor',
      c211_fallback_chain: 'Daha dayanıklı yönetilen yapay zeka — metin artık Ollama Cloud → Gemini 2.5 Flash (yeniden denemeli) → son çare sağlayıcı sırasıyla işleniyor; tek bir kesinti isteğinizi durdurmuyor',

      c210_rebrand_gleano: 'Gleano markası — uzantı adı artık 21 dilde "Gleano"; YouTube\'un ötesinde video + makale okuma kapsamını yansıtıyor',
      c210_article_reader: 'Makale Okuyucu — haber ve blog yazılarını özetleyin ve sohbet edin. Desteklenen sayfalarda popup\'tan açın; activeTab ile isteğe bağlı enjeksiyon (geniş host izni yok)',
      c210_memory: 'Bellek optimizasyonu — bellek içi önbellek için LRU (en fazla 20 video), panel kapanırken MutationObserver ve dinleyici temizliği',
      c210_tab_race: 'Sekme geçişi yarış durumu düzeltildi — Özet / Anahtar Noktalar / Detaylı / Sohbet / Podcast arasında hızlı geçişte eski UI güncellemeleri engellendi',
      c210_scripting: 'Scripting izni eklendi — etkinleştirdiğiniz sekmede Makale Okuyucu dinamik enjeksiyonu. YouTube host izinleri değişmedi',

      c203_localized_store_titles: 'Chrome Web Mağazası başlığı 21 dilde yerelleştirildi — ürün adı her dilde "Gleano"; açıklamalar gerektiğinde YouTube videoları ve makaleleri belirtir',
      c202_credits_message: 'Ücretsiz kredileriniz bittiğinde artık net bir "Kredi tükendi" mesajı ve yükseltme butonu görüyorsunuz — yönetilen AI\'da hatalı "Geçersiz API Anahtarı" uyarısı kaldırıldı',
      c202_podcast_voices: 'Podcast her zaman iki sesle çalışıyor (Alex + Sam). Senaryo artık JSON şemasıyla dönüşümlü konuşmacı zorunlu kılınıyor; "tek ses her şeyi okuyor" hatası giderildi',
      c202_empty_response_credits: 'AI sağlayıcı boş yanıt dönerse (nadir sunucu sorunu) krediniz artık düşmüyor — çağrı iade ediliyor ve hemen tekrar deneyebiliyorsunuz',
      c202_podcast_speed: 'Podcast üretimi uçtan uca yaklaşık %17 daha hızlı (senaryo 10.8sn → 5.2sn, TTS 53.9sn → 48.3sn — 18 dk\'lık gerçek video testinde)',
      c202_summary_density: 'Uzun videolarda özetler daha sıkı ve yoğun: prompt\'taki bölüm başı kelime hedefleri şişirmeyi %22–35 azaltıyor, atıflar/isimler/rakamlar korunuyor',

      c201_credit_overdraft: 'Yönetilen AI çalışmadan önce kredi kontrolü: uzun videolarda yetersiz krediniz varsa iş başlamadan uyarı alırsınız; yarıda kesilme olmaz',
      c201_tts_pricing: 'Podcast sesi (Gemini TTS) artık sağlayıcının gerçek token kullanımına göre hesaplanıyor; bakiyeniz kullanımla her zaman tutarlı',
      c201_error_messages: 'Yönetilen AI hata mesajları netleşti — yetersiz kredi, hız sınırı ve servis kesintilerinde ne yapabileceğiniz yazıyor',
      c201_privacy_redesign: 'Gizlilik politikası yenilendi: karanlık mod desteği, tek bakışta güven rozetleri ve BYOK vs Yönetilen AI karşılaştırması',
      c201_production_live: 'Yönetilen AI tam kullanıma açık: bulut özellikler için Google ile giriş yapın; ihtiyaç duyduğunuzda Stripe üzerinden Pro’ya abone olun',

      c200_freemium: 'Google ile giriş: yönetilen yapay zeka (bulut özet, sohbet, podcast) — ücretsiz krediler veya Pro; isterseniz kendi API anahtarınızla (BYOK) devam',
      c200_chat: 'Video sohbeti yanıtları transkripte bağlı kalır — selam veya “nasıl yardım” sorularında boş asistan cümleleri azaltıldı',
      c200_backend: 'Daha güvenilir yönetilen AI hattı (Supabase Edge + Stripe Pro); Chrome Web Store için sürüm 2.0.0',

      c181_version_labels: 'Ayarlar popup’ı ve Neler Yeni, manifest.json’daki canlı sürümü gösterir (sabit metin yok)',
      c181_store_bundle: 'Mağaza paketine update/ dosyaları dahil; Chrome Web Store yeniden yükleme için manifest sürümü yükseltildi',

      c180_tts_model: 'Podcast TTS: gemini-2.5-flash-preview-tts modeline geçildi (doğru v1beta kimliği) — “model bulunamadı” hataları giderildi',
      c180_volume: 'Podcast ses kaydırıcısı (%0–100); ayar videolar arasında saklanır',
      c180_wav: 'Podcast sesini WAV olarak indirme — çevrimdışı dinleme veya paylaşım (ör. WhatsApp belge)',
      c180_tabs: 'Engellemeyen sekme geçişi: özet, podcast ve sohbet için ayrı meşgul durumu',
      c180_clear_content: 'Sekme değişince içerik anında temizlenir — başka sekmenin metni kısa süre görünmez',

      c172_uninstall_url: 'Kaldırma geri bildirim sayfası artık GitHub Pages yerine portföy alan adınızda (cemkoyluoglu.codes) açılıyor',

      c171_privacy: 'Gizlilik politikası yenilendi — daha net düzen; Sohbet, Gemini TTS, depolama ve izinler',
      c171_pages: 'GitHub Pages docs giriş sayfası; kaldırma sayfasında satır içi SVG favicon',
      c171_readme: 'README: proje yapısı, Vercel’de uninstall barındırma, yayın öncesi kontrol listesi',

      c170_chat: 'Etkileşimli video sohbeti — transkripte dayalı takip soruları (Groq, Ollama, Gemini)',
      c170_fullscreen: 'YouTube tam ekranda uzantı düğmesi ve yan panel otomatik gizlenir',
      c170_console: 'Rutin console.log / console.warn kaldırıldı; console.error yalnızca ciddi hatalar için',
      c170_podcast_rate: 'Podcast oynatma hızı değişince oluşan küçük konum sıçraması düzeltildi',
      c170_chat_context: 'Sohbet transkript bağlamı 80K karaktere hizalandı (özetlerle aynı mertebe)',

      c164_whats_new_page: 'Neler Yeni sayfası — her güncellemeden sonra değişiklikleri görün',
      c164_performance: 'Optimize edilmiş yedek boru hattı ile daha hızlı altyazı çıkarma',
      c164_transcript_fix: 'Bazı kısıtlı videolarda altyazı parçalarının yüklenmeme sorunu düzeltildi',

      c163_podcast: 'AI Podcast — Gemini TTS ile iki sunuculu NotebookLM tarzı sohbetler',
      c163_ollama_models: 'Ollama Cloud\'a Qwen3-Next 80B ve DeepSeek V3.2 eklendi',
      c163_cache_bug: 'LRU önbelleğinin süresi dolmuş girişleri düzgün temizlememesi düzeltildi',

      c162_ollama_cloud: 'Ollama Cloud sağlayıcı — Gemini 3 Flash ve devasa açık kaynak modeller',
      c162_combined_api: 'Birleşik API çağrısı: Özet + Anahtar Noktalar + Detaylı tek istekte',
      c162_spa_nav: 'Videolar arasında geçiş yaparken panelin sıfırlanmaması düzeltildi (SPA)',

      c161_multi_lang: 'Gelişmiş otomatik algılama ile 20+ çıktı diline genişletildi',
      c161_onboarding: 'Çok dilli seçici ile yeniden tasarlanan başlangıç sayfası',
      c161_dark_mode: "YouTube'daki karanlık mod panel tutarsızlıkları düzeltildi",
    },
    es: {
      heroTitle: 'Novedades',
      heroSub: 'Gleano se ha actualizado con nuevas funciones y mejoras.',
      latest: 'Última',
      previousVersions: 'Versiones Anteriores',
      continueYoutube: 'Continuar a YouTube',
      openSettings: 'Abrir Ajustes',
      footerPowered: 'Desarrollado por',
      groupNew: 'Nuevo',
      groupImproved: 'Mejorado',
      groupFixed: 'Corregido',
      groupChanged: 'Cambiado',

      c215_article_button_scope: 'El botón de artículo ahora solo aparece en noticias, entradas de blog y hilos de foros — no en Instagram, X, Facebook, buscadores, tiendas ni apps',
      c215_no_homepage_button: 'Las portadas y páginas de sección ya no muestran el botón; abre la noticia',
      c214_caption_hosts: 'Las descargas de subtítulos se quedan en hosts de YouTube (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'En un artículo, el botón de Gleano en la página inicia el resumen. El chat sigue como pestaña.',
      c214_no_permissions: 'Botón de artículo: script de contenido en páginas http(s), no en YouTube',
      c213_real_errors: 'Mensajes de error reales en lugar de un fallo genérico',
      c213_sign_in: 'Las sesiones caducadas piden iniciar sesión de nuevo',
      c213_caption_sources: 'La extracción de subtítulos prueba cada fuente hasta obtener una transcripción real',
      c213_empty_urls: 'Las URL de subtítulos vacías no se reintentan',
      c213_ci_tests: 'Las pruebas unitarias se ejecutan en CI',
      c212_article_errors: 'El lector de artículos muestra errores específicos',
      c212_article_chat: 'El chat de artículos responde preguntas del tema con el conocimiento del modelo y sigue rechazando tareas ajenas',
      c212_article_keys: 'Los ajustes y créditos del artículo leen las claves de almacenamiento correctas',

      c164_whats_new_page: 'Página de novedades — ve los cambios después de cada actualización',
      c164_performance: 'Extracción de transcripción más rápida con pipeline de respaldo optimizado',
      c164_transcript_fix: 'Corregido: las pistas de subtítulos no cargaban en ciertos videos restringidos',

      c163_podcast: 'AI Podcast — conversaciones estilo NotebookLM con dos presentadores y Gemini TTS',
      c163_ollama_models: 'Añadidos Qwen3-Next 80B y DeepSeek V3.2 a Ollama Cloud',
      c163_cache_bug: 'Corregido: la caché LRU no invalidaba correctamente las entradas expiradas',

      c162_ollama_cloud: 'Proveedor Ollama Cloud — Gemini 3 Flash y modelos masivos de código abierto',
      c162_combined_api: 'Llamada API combinada: Resumen + Puntos Clave + Detallado en una solicitud',
      c162_spa_nav: 'Corregido: el panel no se reiniciaba al navegar entre videos (SPA)',

      c161_multi_lang: 'Ampliado a más de 20 idiomas de salida con detección automática mejorada',
      c161_onboarding: 'Incorporación rediseñada con selector multilingüe',
      c161_dark_mode: 'Corregidas inconsistencias del panel en modo oscuro en YouTube',
    },
    fr: {
      heroTitle: 'Nouveautés',
      heroSub: 'Gleano a été mis à jour avec de nouvelles fonctionnalités.',
      latest: 'Dernière',
      previousVersions: 'Versions Précédentes',
      continueYoutube: 'Continuer vers YouTube',
      openSettings: 'Ouvrir les Paramètres',
      footerPowered: 'Propulsé par',
      groupNew: 'Nouveau',
      groupImproved: 'Amélioré',
      groupFixed: 'Corrigé',
      groupChanged: 'Modifié',

      c215_article_button_scope: 'Le bouton article n\'apparaît plus que sur les articles de presse, billets de blog et fils de forum — pas sur Instagram, X, Facebook, la recherche, les boutiques ou les applis',
      c215_no_homepage_button: 'Les pages d\'accueil et de rubrique n\'affichent plus le bouton ; ouvrez l\'article',
      c214_caption_hosts: 'Les téléchargements de sous-titres restent sur les hôtes YouTube (https : youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'Sur un article, le bouton Gleano sur la page lance le résumé. Le chat reste un onglet.',
      c214_no_permissions: 'Bouton article : script de contenu sur les pages http(s), pas sur YouTube',
      c213_real_errors: 'De vrais messages d\u2019erreur à la place d\u2019un échec générique',
      c213_sign_in: 'Les sessions expirées demandent de se reconnecter',
      c213_caption_sources: 'L\u2019extraction des sous-titres parcourt chaque source jusqu\u2019à une vraie transcription',
      c213_empty_urls: 'Les URL de sous-titres vides ne sont plus réessayées',
      c213_ci_tests: 'Les tests unitaires s\u2019exécutent dans la CI',
      c212_article_errors: 'Le lecteur d\u2019articles affiche des erreurs précises',
      c212_article_chat: 'Le chat d\u2019article répond aux questions du sujet avec les connaissances du modèle et refuse toujours les tâches hors sujet',
      c212_article_keys: 'Les réglages et crédits d\u2019article lisent les bonnes clés de stockage',

      c164_whats_new_page: 'Page des nouveautés — voyez les changements après chaque mise à jour',
      c164_performance: 'Extraction de transcription plus rapide avec pipeline de secours optimisé',
      c164_transcript_fix: 'Correction : les pistes de sous-titres ne se chargeaient pas pour certaines vidéos',

      c163_podcast: 'AI Podcast — conversations à deux hôtes style NotebookLM avec Gemini TTS',
      c163_ollama_models: 'Ajout de Qwen3-Next 80B et DeepSeek V3.2 à Ollama Cloud',
      c163_cache_bug: "Correction : le cache LRU n'invalidait pas correctement les entrées expirées",

      c162_ollama_cloud: 'Fournisseur Ollama Cloud — Gemini 3 Flash et modèles open-source massifs',
      c162_combined_api: 'Appel API combiné : Résumé + Points Clés + Détaillé en une requête',
      c162_spa_nav: 'Correction : le panneau ne se réinitialisait pas lors de la navigation entre vidéos',

      c161_multi_lang: 'Étendu à plus de 20 langues avec détection automatique améliorée',
      c161_onboarding: "Intégration repensée avec sélecteur multilingue",
      c161_dark_mode: 'Correction des incohérences du panneau en mode sombre sur YouTube',
    },
    de: {
      heroTitle: 'Was ist neu',
      heroSub: 'Gleano wurde mit neuen Funktionen aktualisiert.',
      latest: 'Aktuell',
      previousVersions: 'Frühere Versionen',
      continueYoutube: 'Weiter zu YouTube',
      openSettings: 'Einstellungen öffnen',
      footerPowered: 'Unterstützt von',
      groupNew: 'Neu',
      groupImproved: 'Verbessert',
      groupFixed: 'Behoben',
      groupChanged: 'Geändert',

      c215_article_button_scope: 'Die Artikel-Schaltfläche erscheint nur noch auf Nachrichtenartikeln, Blogposts und Forenthreads — nicht auf Instagram, X, Facebook, Suche, Shops oder Apps',
      c215_no_homepage_button: 'Startseiten und Rubrikseiten zeigen die Schaltfläche nicht mehr; öffne den Artikel selbst',
      c214_caption_hosts: 'Untertitel-Downloads bleiben auf YouTube-Hosts (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'Auf einem Artikel startet die Gleano-Schaltfläche auf der Seite die Zusammenfassung. Der Chat bleibt ein Tab.',
      c214_no_permissions: 'Artikel-Schaltfläche: Inhaltsskript auf normalen http(s)-Seiten, nicht auf YouTube',
      c213_real_errors: 'Echte Fehlermeldungen statt eines allgemeinen Fehlers',
      c213_sign_in: 'Abgelaufene Sitzungen bitten um erneutes Anmelden',
      c213_caption_sources: 'Die Untertitel-Extraktion prüft jede Quelle, bis eine echte Transkription zurückkommt',
      c213_empty_urls: 'Leere Untertitel-URLs werden nicht erneut versucht',
      c213_ci_tests: 'Unit-Tests laufen in der CI',
      c212_article_errors: 'Der Artikel-Leser zeigt konkrete Fehler',
      c212_article_chat: 'Der Artikel-Chat beantwortet Themenfragen aus Modellwissen und lehnt fachfremde Aufgaben weiter ab',
      c212_article_keys: 'Artikel-Einstellungen und Credits lesen die richtigen Speicherschlüssel',

      c164_whats_new_page: 'Was-ist-neu-Seite — sehen Sie die Änderungen nach jedem Update',
      c164_performance: 'Schnellere Transkript-Extraktion mit optimierter Fallback-Pipeline',
      c164_transcript_fix: 'Behoben: Untertitelspuren wurden bei bestimmten Videos nicht geladen',

      c163_podcast: 'AI Podcast — Zwei-Moderatoren-Gespräche im NotebookLM-Stil mit Gemini TTS',
      c163_ollama_models: 'Qwen3-Next 80B und DeepSeek V3.2 zu Ollama Cloud hinzugefügt',
      c163_cache_bug: 'Behoben: LRU-Cache invalidierte abgelaufene Einträge nicht korrekt',

      c162_ollama_cloud: 'Ollama Cloud Anbieter — Gemini 3 Flash und massive Open-Source-Modelle',
      c162_combined_api: 'Kombinierter API-Aufruf: Zusammenfassung + Kernpunkte + Detail in einer Anfrage',
      c162_spa_nav: 'Behoben: Panel wurde beim Navigieren zwischen Videos nicht zurückgesetzt',

      c161_multi_lang: 'Auf 20+ Sprachen erweitert mit verbesserter automatischer Erkennung',
      c161_onboarding: 'Neugestaltetes Onboarding mit mehrsprachiger Auswahl',
      c161_dark_mode: 'Inkonsistenzen des Panels im Dark Mode auf YouTube behoben',
    },
    ja: {
      heroTitle: '新機能',
      heroSub: 'Gleanoが新機能と改善で更新されました。',
      latest: '最新',
      previousVersions: '以前のバージョン',
      continueYoutube: 'YouTubeへ',
      openSettings: '設定を開く',
      footerPowered: '提供元',
      groupNew: '新機能',
      groupImproved: '改善',
      groupFixed: '修正',
      groupChanged: '変更',

      c215_article_button_scope: '記事ボタンはニュース記事・ブログ投稿・フォーラムのスレッドにのみ表示されます（Instagram、X、Facebook、検索、ショップ、アプリには表示されません）',
      c215_no_homepage_button: 'サイトのトップページやカテゴリページにはボタンを表示しません。記事本体を開いてください',
      c214_caption_hosts: '字幕のダウンロードは YouTube のホストに限定されます（https: youtube.com、youtu.be、googlevideo.com、ytimg.com）',
      c214_article_button: '記事ページの Gleano ボタンで要約が始まります。チャットはタブのままです。',
      c214_no_permissions: '記事ボタン: YouTube 以外の通常の http(s) ページにコンテンツスクリプト',
      c213_real_errors: '一般的な失敗の代わりに具体的なエラーメッセージを表示',
      c213_sign_in: '期限切れのセッションは再ログインを案内します',
      c213_caption_sources: '字幕の抽出は、実際の文字起こしが返るまで各ソースを順に試します',
      c213_empty_urls: '空の字幕 URL は再試行しません',
      c213_ci_tests: 'ユニットテストを CI で実行',
      c212_article_errors: '記事リーダーが具体的なエラーを表示します',
      c212_article_chat: '記事チャットは話題の質問にモデルの知識で答え、無関係な作業は引き続き断りします',
      c212_article_keys: '記事の設定とクレジットは正しいストレージキーを読みます',

      c164_whats_new_page: '新機能ページ — 更新ごとの変更点を確認',
      c164_performance: '最適化されたフォールバックによる高速なトランスクリプト抽出',
      c164_transcript_fix: '特定の制限付き動画でキャプショントラックが読み込まれない問題を修正',

      c163_podcast: 'AIポッドキャスト — Gemini TTSによる2人のホストのNotebookLMスタイル会話',
      c163_ollama_models: 'Ollama CloudにQwen3-Next 80BとDeepSeek V3.2を追加',
      c163_cache_bug: 'LRUキャッシュが期限切れエントリを適切に無効化しない問題を修正',

      c162_ollama_cloud: 'Ollama Cloudプロバイダー — Gemini 3 Flashと大規模オープンソースモデル',
      c162_combined_api: '統合APIコール：要約 + キーポイント + 詳細を1リクエストで',
      c162_spa_nav: '動画間の移動時にパネルがリセットされない問題を修正（SPA）',

      c161_multi_lang: '改善された自動検出で20+言語に拡張',
      c161_onboarding: '多言語セレクター付きの新しいオンボーディング',
      c161_dark_mode: 'YouTubeのダークモードパネルの不整合を修正',
    },
    ko: {
      heroTitle: '새로운 기능',
      heroSub: 'Gleano가 새로운 기능과 개선사항으로 업데이트되었습니다.',
      latest: '최신',
      previousVersions: '이전 버전',
      continueYoutube: 'YouTube로 이동',
      openSettings: '설정 열기',
      footerPowered: '제공',
      groupNew: '새 기능',
      groupImproved: '개선',
      groupFixed: '수정',
      groupChanged: '변경',

      c215_article_button_scope: '기사 버튼은 이제 뉴스 기사, 블로그 글, 포럼 스레드에서만 표시됩니다 — Instagram, X, Facebook, 검색, 쇼핑, 앱에서는 표시되지 않습니다',
      c215_no_homepage_button: '사이트 홈페이지와 섹션 페이지에는 버튼이 표시되지 않습니다. 기사 자체를 여세요',
      c214_caption_hosts: '자막 다운로드는 YouTube 호스트에만 머뭅니다 (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: '기사 페이지의 Gleano 버튼이 요약을 시작합니다. 채팅은 탭으로 남습니다.',
      c214_no_permissions: '기사 버튼: YouTube가 아닌 일반 http(s) 페이지의 콘텐츠 스크립트',
      c213_real_errors: '일반적인 실패 대신 실제 오류 메시지',
      c213_sign_in: '만료된 세션은 다시 로그인하라고 안내합니다',
      c213_caption_sources: '자막 추출은 실제 대본이 나올 때까지 모든 소스를 차례로 시도합니다',
      c213_empty_urls: '빈 자막 URL은 다시 시도하지 않습니다',
      c213_ci_tests: '단위 테스트가 CI에서 실행됩니다',
      c212_article_errors: '기사 리더가 구체적인 오류를 보여 줍니다',
      c212_article_chat: '기사 채팅은 주제 질문에 모델 지식으로 답하고, 관련 없는 작업은 계속 거절합니다',
      c212_article_keys: '기사 설정과 크레딧이 올바른 저장소 키를 읽습니다',

      c164_whats_new_page: '새로운 기능 페이지 — 업데이트 후 변경 사항 확인',
      c164_performance: '최적화된 폴백 파이프라인으로 더 빠른 자막 추출',
      c164_transcript_fix: '특정 제한된 동영상에서 자막 트랙이 로드되지 않는 문제 수정',

      c163_podcast: 'AI 팟캐스트 — Gemini TTS를 사용한 2인 호스트 NotebookLM 스타일 대화',
      c163_ollama_models: 'Ollama Cloud에 Qwen3-Next 80B 및 DeepSeek V3.2 추가',
      c163_cache_bug: 'LRU 캐시가 만료된 항목을 올바르게 무효화하지 않는 문제 수정',

      c162_ollama_cloud: 'Ollama Cloud 제공업체 — Gemini 3 Flash 및 대규모 오픈소스 모델',
      c162_combined_api: '통합 API 호출: 요약 + 핵심 포인트 + 상세를 한 번의 요청으로',
      c162_spa_nav: '동영상 간 이동 시 패널이 초기화되지 않는 문제 수정 (SPA)',

      c161_multi_lang: '개선된 자동 감지로 20+ 출력 언어로 확장',
      c161_onboarding: '다국어 선택기를 갖춘 새로운 온보딩',
      c161_dark_mode: 'YouTube 다크 모드 패널 불일치 수정',
    },
    zh: {
      heroTitle: '新功能',
      heroSub: 'Gleano 已更新，带来新功能和改进。',
      latest: '最新',
      previousVersions: '历史版本',
      continueYoutube: '前往YouTube',
      openSettings: '打开设置',
      footerPowered: '技术支持',
      groupNew: '新增',
      groupImproved: '改进',
      groupFixed: '修复',
      groupChanged: '变更',

      c215_article_button_scope: '文章按钮现在只出现在新闻、博客文章和论坛帖子上——不会出现在 Instagram、X、Facebook、搜索、购物网站或应用中',
      c215_no_homepage_button: '网站首页和栏目页不再显示按钮；请打开具体文章',
      c214_caption_hosts: '字幕下载仅限 YouTube 主机（https：youtube.com、youtu.be、googlevideo.com、ytimg.com）',
      c214_article_button: '在文章页上，页面上的 Gleano 按钮会开始摘要。聊天仍是标签。',
      c214_no_permissions: '文章按钮：在普通 http(s) 页面注入内容脚本（不含 YouTube）',
      c213_real_errors: '显示具体错误，而不再是笼统的失败提示',
      c213_sign_in: '会话过期时会提示重新登录',
      c213_caption_sources: '字幕提取会逐个尝试来源，直到得到真实转录',
      c213_empty_urls: '空的字幕链接不再重试',
      c213_ci_tests: '单元测试在 CI 中运行',
      c212_article_errors: '文章阅读器显示具体错误',
      c212_article_chat: '文章聊天可用模型知识回答主题问题，仍会拒绝无关任务',
      c212_article_keys: '文章设置和额度读取正确的存储键',

      c164_whats_new_page: '新功能页面 — 每次更新后查看变更内容',
      c164_performance: '通过优化的备用管道更快地提取字幕',
      c164_transcript_fix: '修复了某些受限视频中字幕轨道无法加载的问题',

      c163_podcast: 'AI播客 — 使用Gemini TTS的双主持人NotebookLM风格对话',
      c163_ollama_models: '在Ollama Cloud中添加了Qwen3-Next 80B和DeepSeek V3.2',
      c163_cache_bug: '修复了LRU缓存未正确使过期条目失效的问题',

      c162_ollama_cloud: 'Ollama Cloud提供商 — Gemini 3 Flash和大规模开源模型',
      c162_combined_api: '合并API调用：摘要 + 要点 + 详细分析一次请求完成',
      c162_spa_nav: '修复了在视频之间导航时面板未重置的问题（SPA）',

      c161_multi_lang: '通过改进的自动检测扩展到20+种输出语言',
      c161_onboarding: '带有多语言选择器的重新设计的引导页面',
      c161_dark_mode: '修复了YouTube上暗黑模式面板的不一致性',
    },
    pt: {
      heroTitle: 'Novidades',
      heroSub: 'Gleano foi atualizado com novos recursos e melhorias.',
      latest: 'Última',
      previousVersions: 'Versões Anteriores',
      continueYoutube: 'Continuar para o YouTube',
      openSettings: 'Abrir Configurações',
      footerPowered: 'Desenvolvido por',
      groupNew: 'Novo',
      groupImproved: 'Melhorado',
      groupFixed: 'Corrigido',
      groupChanged: 'Alterado',

      c215_article_button_scope: 'O botão de artigo agora só aparece em notícias, posts de blog e tópicos de fórum — não no Instagram, X, Facebook, buscas, lojas ou apps',
      c215_no_homepage_button: 'Páginas iniciais e de seção não mostram mais o botão; abra a matéria',
      c214_caption_hosts: 'Os downloads de legendas ficam nos hosts do YouTube (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'Num artigo, o botão Gleano na página inicia o resumo. O chat continua como aba.',
      c214_no_permissions: 'Botão de artigo: script de conteúdo em páginas http(s), exceto YouTube',
      c213_real_errors: 'Mensagens de erro reais em vez de uma falha genérica',
      c213_sign_in: 'Sessões expiradas pedem para entrar de novo',
      c213_caption_sources: 'A extração de legendas percorre cada fonte até uma transcrição real',
      c213_empty_urls: 'URLs de legenda vazias não são tentadas de novo',
      c213_ci_tests: 'Testes unitários rodam no CI',
      c212_article_errors: 'O leitor de artigos mostra erros específicos',
      c212_article_chat: 'O chat do artigo responde perguntas do tema com o conhecimento do modelo e continua recusando tarefas sem relação',
      c212_article_keys: 'Configurações e créditos do artigo leem as chaves de armazenamento corretas',

      c164_whats_new_page: 'Página de novidades — veja as mudanças após cada atualização',
      c164_performance: 'Extração de transcrição mais rápida com pipeline de fallback otimizado',
      c164_transcript_fix: 'Corrigido: faixas de legendas não carregavam em certos vídeos restritos',

      c163_podcast: 'AI Podcast — conversas com dois apresentadores estilo NotebookLM com Gemini TTS',
      c163_ollama_models: 'Adicionados Qwen3-Next 80B e DeepSeek V3.2 ao Ollama Cloud',
      c163_cache_bug: 'Corrigido: cache LRU não invalidava corretamente entradas expiradas',

      c162_ollama_cloud: 'Provedor Ollama Cloud — Gemini 3 Flash e modelos massivos de código aberto',
      c162_combined_api: 'Chamada API combinada: Resumo + Pontos-Chave + Detalhado em uma requisição',
      c162_spa_nav: 'Corrigido: painel não era reiniciado ao navegar entre vídeos (SPA)',

      c161_multi_lang: 'Expandido para 20+ idiomas com detecção automática aprimorada',
      c161_onboarding: 'Integração redesenhada com seletor multilíngue',
      c161_dark_mode: 'Corrigidas inconsistências do painel no modo escuro no YouTube',
    },
    ar: {
      heroTitle: 'ما الجديد',
      heroSub: 'تم تحديث Gleano بميزات وتحسينات جديدة.',
      latest: 'الأحدث',
      previousVersions: 'الإصدارات السابقة',
      continueYoutube: 'المتابعة إلى YouTube',
      openSettings: 'فتح الإعدادات',
      footerPowered: 'مدعوم من',
      groupNew: 'جديد',
      groupImproved: 'محسّن',
      groupFixed: 'تم الإصلاح',
      groupChanged: 'تم التغيير',

      c215_article_button_scope: 'زر المقال يظهر الآن فقط في الأخبار وتدوينات المدونات وموضوعات المنتديات — وليس في Instagram أو X أو Facebook أو البحث أو المتاجر أو التطبيقات',
      c215_no_homepage_button: 'لم تعد الصفحات الرئيسية وصفحات الأقسام تعرض الزر؛ افتح الخبر نفسه',
      c214_caption_hosts: 'تنزيلات الترجمة تبقى على مضيفات YouTube (https: youtube.com و youtu.be و googlevideo.com و ytimg.com)',
      c214_article_button: 'في صفحة المقال، زر Gleano على الصفحة يبدأ الملخص. تبقى الدردشة تبويبًا.',
      c214_no_permissions: 'زر المقال: سكربت محتوى على صفحات http(s) العادية، وليس يوتيوب',
      c213_real_errors: 'رسائل خطأ حقيقية بدل فشل عام',
      c213_sign_in: 'الجلسات المنتهية تطلب تسجيل الدخول مرة أخرى',
      c213_caption_sources: 'استخراج الترجمة يمر على كل مصدر حتى يعيد نصًا حقيقيًا',
      c213_empty_urls: 'روابط الترجمة الفارغة لا تُعاد محاولتها',
      c213_ci_tests: 'اختبارات الوحدة تعمل في CI',
      c212_article_errors: 'قارئ المقالات يعرض أخطاء محددة',
      c212_article_chat: 'دردشة المقال تجيب عن أسئلة الموضوع من معرفة النموذج وما زالت ترفض المهام غير المتعلقة',
      c212_article_keys: 'إعدادات المقال والرصيد تقرأ مفاتيح التخزين الصحيحة',

      c164_whats_new_page: 'صفحة ما الجديد — شاهد التغييرات بعد كل تحديث',
      c164_performance: 'استخراج أسرع للنسخ مع خط أنابيب احتياطي محسّن',
      c164_transcript_fix: 'إصلاح: مسارات الترجمة لم تكن تُحمّل لبعض الفيديوهات المقيدة',

      c163_podcast: 'بودكاست AI — محادثات بأسلوب NotebookLM مع مضيفين و Gemini TTS',
      c163_ollama_models: 'تمت إضافة Qwen3-Next 80B و DeepSeek V3.2 إلى Ollama Cloud',
      c163_cache_bug: 'إصلاح: ذاكرة LRU التخزينية لم تكن تبطل الإدخالات المنتهية بشكل صحيح',

      c162_ollama_cloud: 'مزود Ollama Cloud — Gemini 3 Flash ونماذج مفتوحة المصدر ضخمة',
      c162_combined_api: 'استدعاء API مدمج: ملخص + نقاط رئيسية + تفصيلي في طلب واحد',
      c162_spa_nav: 'إصلاح: اللوحة لم تكن تتم إعادة تعيينها عند التنقل بين الفيديوهات',

      c161_multi_lang: 'توسيع إلى أكثر من 20 لغة مع كشف تلقائي محسّن',
      c161_onboarding: 'إعادة تصميم صفحة الترحيب مع محدد متعدد اللغات',
      c161_dark_mode: 'إصلاح تناقضات لوحة الوضع المظلم على YouTube',
    },
    hi: {
      heroTitle: 'नया क्या है',
      heroSub: 'Gleano नई सुविधाओं और सुधारों के साथ अपडेट हुआ।',
      latest: 'नवीनतम',
      previousVersions: 'पिछले संस्करण',
      continueYoutube: 'YouTube पर जारी रखें',
      openSettings: 'सेटिंग्स खोलें',
      footerPowered: 'संचालित',
      groupNew: 'नया',
      groupImproved: 'सुधार',
      groupFixed: 'ठीक किया',
      groupChanged: 'बदला',

      c215_article_button_scope: 'लेख बटन अब केवल समाचार, ब्लॉग पोस्ट और फ़ोरम थ्रेड पर दिखता है — Instagram, X, Facebook, खोज, शॉपिंग या ऐप्स पर नहीं',
      c215_no_homepage_button: 'साइट के होमपेज और सेक्शन पेज पर बटन नहीं दिखता; खबर खुद खोलें',
      c214_caption_hosts: 'कैप्शन डाउनलोड YouTube होस्ट पर ही रहते हैं (https: youtube.com, youtu.be, googlevideo.com, ytimg.com)',
      c214_article_button: 'लेख पृष्ठ पर Gleano बटन सारांश शुरू करता है। चैट टैब बनी रहती है।',
      c214_no_permissions: 'लेख बटन: YouTube को छोड़कर साधारण http(s) पृष्ठों पर कंटेंट स्क्रिप्ट',
      c213_real_errors: 'सामान्य विफलता के बजाय असली त्रुटि संदेश',
      c213_sign_in: 'समाप्त सत्र फिर से साइन इन करने को कहते हैं',
      c213_caption_sources: 'कैप्शन निष्कर्षण हर स्रोत को तब तक आज़माता है जब तक असली ट्रांसक्रिप्ट न मिले',
      c213_empty_urls: 'खाली कैप्शन URL दोबारा नहीं आज़माए जाते',
      c213_ci_tests: 'यूनिट टेस्ट CI में चलते हैं',
      c212_article_errors: 'आर्टिकल रीडर विशिष्ट त्रुटियाँ दिखाता है',
      c212_article_chat: 'आर्टिकल चैट विषय के सवाल मॉडल ज्ञान से जवाब देता है और असंबंधित काम फिर भी मना करता है',
      c212_article_keys: 'आर्टिकल सेटिंग्स और क्रेडिट सही स्टोरेज कुंजियाँ पढ़ते हैं',

      c164_whats_new_page: 'नया क्या है पेज — हर अपडेट के बाद बदलाव देखें',
      c164_performance: 'अनुकूलित फॉलबैक पाइपलाइन के साथ तेज़ ट्रांसक्रिप्ट निष्कर्षण',
      c164_transcript_fix: 'कुछ प्रतिबंधित वीडियो के लिए कैप्शन ट्रैक लोड न होने की समस्या ठीक की',

      c163_podcast: 'AI पॉडकास्ट — Gemini TTS के साथ दो-होस्ट NotebookLM शैली बातचीत',
      c163_ollama_models: 'Ollama Cloud में Qwen3-Next 80B और DeepSeek V3.2 जोड़े गए',
      c163_cache_bug: 'LRU कैश द्वारा समाप्त प्रविष्टियों को सही ढंग से अमान्य न करने की समस्या ठीक की',

      c162_ollama_cloud: 'Ollama Cloud प्रदाता — Gemini 3 Flash और विशाल ओपन-सोर्स मॉडल',
      c162_combined_api: 'संयुक्त API कॉल: सारांश + मुख्य बिंदु + विस्तृत एक अनुरोध में',
      c162_spa_nav: 'वीडियो के बीच नेविगेट करते समय पैनल रीसेट न होने की समस्या ठीक की (SPA)',

      c161_multi_lang: 'बेहतर ऑटो-डिटेक्शन के साथ 20+ आउटपुट भाषाओं में विस्तारित',
      c161_onboarding: 'बहु-भाषा चयनकर्ता के साथ पुनर्डिज़ाइन किया गया ऑनबोर्डिंग',
      c161_dark_mode: 'YouTube पर डार्क मोड पैनल असंगतियां ठीक की गईं',
    },
  };

  const TYPE_ICONS = {
    new:      '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    improved: '<svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>',
    fixed:    '<svg viewBox="0 0 24 24"><path d="M22 5.72l-4.6 3.86-1.29-1.29L15 9.41l2.48 2.48L22.59 7 22 5.72zM7.41 13.41L2 18.83 3.41 20.24 8.83 14.83 7.41 13.41zM19.07 14.88l-1.41 1.41L14.83 13.46l1.41-1.41 2.83 2.83zM5.17 7.76l2.83 2.83L6.59 12l-2.83-2.83L5.17 7.76z"/></svg>',
    changed:  '<svg viewBox="0 0 24 24"><path d="M12 6V9L16 5L12 1V4C7.58 4 4 7.58 4 12C4 13.57 4.46 15.03 5.24 16.26L6.7 14.8C6.25 13.97 6 13.01 6 12C6 8.69 8.69 6 12 6ZM18.76 7.74L17.3 9.2C17.74 10.04 18 10.99 18 12C18 15.31 15.31 18 12 18V15L8 19L12 23V20C16.42 20 20 16.42 20 12C20 10.43 19.54 8.97 18.76 7.74Z"/></svg>',
  };

  function detectLanguage() {
    const browserLang = (navigator.language || 'en').substring(0, 2).toLowerCase();
    return I18N[browserLang] ? browserLang : 'en';
  }

  const lang = detectLanguage();

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString(navigator.language || 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function buildChangelogCard(entry, isCurrent) {
    const groupedChanges = {};
    for (const change of entry.changes) {
      if (!groupedChanges[change.type]) groupedChanges[change.type] = [];
      groupedChanges[change.type].push(change);
    }

    const groupOrder = ['new', 'improved', 'changed', 'fixed'];
    const groupLabels = {
      new: t('groupNew'),
      improved: t('groupImproved'),
      fixed: t('groupFixed'),
      changed: t('groupChanged'),
    };

    let html = `
      <div class="changelog-header">
        <span class="changelog-version">v${entry.version}</span>
        ${isCurrent ? `<span class="changelog-tag latest">${t('latest')}</span>` : ''}
        <span class="changelog-date">${formatDate(entry.date)}</span>
      </div>
    `;

    for (const type of groupOrder) {
      const items = groupedChanges[type];
      if (!items) continue;

      html += `
        <div class="change-group">
          <div class="change-group-title ${type}">
            ${TYPE_ICONS[type]}
            ${groupLabels[type]}
          </div>
          <ul class="change-list">
            ${items.map(item => `
              <li class="change-item">
                <span class="change-icon ${item.type}">${TYPE_ICONS[item.type]}</span>
                <span>${t(item.text)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    return html;
  }

  /**
   * Sort CHANGELOG newest-first by (date DESC, semver DESC) so that out-of-order
   * array entries still render correctly. Non-mutating — produces a new array.
   */
  function sortedChangelog() {
    const toSemver = (v) => String(v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
    const cmpSemver = (a, b) => {
      const [am, ai, ap] = toSemver(a);
      const [bm, bi, bp] = toSemver(b);
      return bm - am || bi - ai || bp - ap;
    };
    return [...CHANGELOG].sort((a, b) => {
      const dateDiff = String(b.date).localeCompare(String(a.date));
      if (dateDiff !== 0) return dateDiff;
      return cmpSemver(a.version, b.version);
    });
  }

  const SORTED = sortedChangelog();
  const manifestVersion = chrome.runtime?.getManifest?.()?.version;

  /**
   * Pick the entry to highlight as "latest". Preference order:
   *   1. Entry whose version === manifest.version (so the user sees exactly what they installed).
   *   2. First entry in the date-sorted list (the newest we know about).
   * Returning a single object keeps downstream rendering and dedup trivial.
   */
  const currentEntry =
    (manifestVersion && SORTED.find((e) => e.version === manifestVersion)) ||
    SORTED[0];

  $('#versionPill').textContent = `v${manifestVersion || currentEntry.version}`;
  $('#currentChangelog').innerHTML = buildChangelogCard(currentEntry, true);

  // ── Render previous versions (exclude whatever is shown as "current") ──
  const historyList = $('#historyList');
  const previousVersions = SORTED.filter((e) => e.version !== currentEntry.version);

  if (previousVersions.length > 0) {
    previousVersions.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'changelog-card';
      card.innerHTML = buildChangelogCard(entry, false);
      historyList.appendChild(card);
    });
  } else {
    $('#historySection').style.display = 'none';
  }

  // ── Toggle history ──
  const historyToggle = $('#historyToggle');
  historyToggle.addEventListener('click', () => {
    const isHidden = historyList.hidden;
    historyList.hidden = !isHidden;
    historyToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  // ── Apply i18n ──
  $('#heroTitle').textContent = t('heroTitle');
  $('#heroSub').textContent = t('heroSub');
  $('#historyToggleText').textContent = t('previousVersions');
  $('#ctaText').textContent = t('continueYoutube');
  $('#settingsText').textContent = t('openSettings');
  $('#footerPowered').textContent = t('footerPowered');

  if (lang === 'ar') {
    document.documentElement.dir = 'rtl';
  }

  // ── Settings button ──
  $('#settingsBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSettings' }, (response) => {
      const failed = chrome.runtime.lastError || !response?.ok;
      if (failed) {
        showSettingsToast();
      }
    });
  });

  function showSettingsToast() {
    const existing = document.querySelector('.settings-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'settings-toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="color:#065fd4;flex-shrink:0">
        <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      </svg>
      <span>${lang === 'tr' ? 'Ayarları açmak için tarayıcı araç çubuğundaki uzantı simgesine tıklayın.' : 'Click the extension icon in your browser toolbar to open settings.'}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0 0 0 8px">×</button>
    `;
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      display:flex;align-items:center;gap:10px;
      background:#fff;color:#0f172a;
      padding:14px 18px;border-radius:12px;
      box-shadow:0 8px 32px rgba(15,23,42,0.14),0 0 0 1px rgba(15,23,42,0.06);
      font-size:13px;font-weight:500;line-height:1.4;
      max-width:420px;z-index:9999;
      animation:fadeSlideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
});
