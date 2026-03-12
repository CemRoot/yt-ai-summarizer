/**
 * YouTube AI Summarizer — What's New / Update Page Controller
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
      heroSub: 'YouTube AI Summarizer has been updated with new features and improvements.',
      latest: 'Latest',
      previousVersions: 'Previous Versions',
      continueYoutube: 'Continue to YouTube',
      openSettings: 'Open Settings',
      footerPowered: 'Powered by',
      groupNew: 'New',
      groupImproved: 'Improved',
      groupFixed: 'Fixed',
      groupChanged: 'Changed',

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
      heroSub: 'YouTube AI Özetleyici yeni özellikler ve iyileştirmelerle güncellendi.',
      latest: 'Güncel',
      previousVersions: 'Önceki Sürümler',
      continueYoutube: "YouTube'a Devam Et",
      openSettings: 'Ayarları Aç',
      footerPowered: 'Altyapı',
      groupNew: 'Yeni',
      groupImproved: 'İyileştirme',
      groupFixed: 'Düzeltme',
      groupChanged: 'Değişiklik',

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
      heroSub: 'YouTube AI Summarizer se ha actualizado con nuevas funciones y mejoras.',
      latest: 'Última',
      previousVersions: 'Versiones Anteriores',
      continueYoutube: 'Continuar a YouTube',
      openSettings: 'Abrir Ajustes',
      footerPowered: 'Desarrollado por',
      groupNew: 'Nuevo',
      groupImproved: 'Mejorado',
      groupFixed: 'Corregido',
      groupChanged: 'Cambiado',

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
      heroSub: 'YouTube AI Summarizer a été mis à jour avec de nouvelles fonctionnalités.',
      latest: 'Dernière',
      previousVersions: 'Versions Précédentes',
      continueYoutube: 'Continuer vers YouTube',
      openSettings: 'Ouvrir les Paramètres',
      footerPowered: 'Propulsé par',
      groupNew: 'Nouveau',
      groupImproved: 'Amélioré',
      groupFixed: 'Corrigé',
      groupChanged: 'Modifié',

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
      heroSub: 'YouTube AI Summarizer wurde mit neuen Funktionen aktualisiert.',
      latest: 'Aktuell',
      previousVersions: 'Frühere Versionen',
      continueYoutube: 'Weiter zu YouTube',
      openSettings: 'Einstellungen öffnen',
      footerPowered: 'Unterstützt von',
      groupNew: 'Neu',
      groupImproved: 'Verbessert',
      groupFixed: 'Behoben',
      groupChanged: 'Geändert',

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
      heroSub: 'YouTube AI Summarizerが新機能と改善で更新されました。',
      latest: '最新',
      previousVersions: '以前のバージョン',
      continueYoutube: 'YouTubeへ',
      openSettings: '設定を開く',
      footerPowered: '提供元',
      groupNew: '新機能',
      groupImproved: '改善',
      groupFixed: '修正',
      groupChanged: '変更',

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
      heroSub: 'YouTube AI Summarizer가 새로운 기능과 개선사항으로 업데이트되었습니다.',
      latest: '최신',
      previousVersions: '이전 버전',
      continueYoutube: 'YouTube로 이동',
      openSettings: '설정 열기',
      footerPowered: '제공',
      groupNew: '새 기능',
      groupImproved: '개선',
      groupFixed: '수정',
      groupChanged: '변경',

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
      heroSub: 'YouTube AI Summarizer 已更新，带来新功能和改进。',
      latest: '最新',
      previousVersions: '历史版本',
      continueYoutube: '前往YouTube',
      openSettings: '打开设置',
      footerPowered: '技术支持',
      groupNew: '新增',
      groupImproved: '改进',
      groupFixed: '修复',
      groupChanged: '变更',

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
      heroSub: 'YouTube AI Summarizer foi atualizado com novos recursos e melhorias.',
      latest: 'Última',
      previousVersions: 'Versões Anteriores',
      continueYoutube: 'Continuar para o YouTube',
      openSettings: 'Abrir Configurações',
      footerPowered: 'Desenvolvido por',
      groupNew: 'Novo',
      groupImproved: 'Melhorado',
      groupFixed: 'Corrigido',
      groupChanged: 'Alterado',

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
      heroSub: 'تم تحديث YouTube AI Summarizer بميزات وتحسينات جديدة.',
      latest: 'الأحدث',
      previousVersions: 'الإصدارات السابقة',
      continueYoutube: 'المتابعة إلى YouTube',
      openSettings: 'فتح الإعدادات',
      footerPowered: 'مدعوم من',
      groupNew: 'جديد',
      groupImproved: 'محسّن',
      groupFixed: 'تم الإصلاح',
      groupChanged: 'تم التغيير',

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
      heroSub: 'YouTube AI Summarizer नई सुविधाओं और सुधारों के साथ अपडेट हुआ।',
      latest: 'नवीनतम',
      previousVersions: 'पिछले संस्करण',
      continueYoutube: 'YouTube पर जारी रखें',
      openSettings: 'सेटिंग्स खोलें',
      footerPowered: 'संचालित',
      groupNew: 'नया',
      groupImproved: 'सुधार',
      groupFixed: 'ठीक किया',
      groupChanged: 'बदला',

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

  // ── Render current version ──
  const currentVersion = CHANGELOG[0];
  const manifestVersion = chrome.runtime?.getManifest?.()?.version;

  if (manifestVersion) {
    $('#versionPill').textContent = `v${manifestVersion}`;
    const matchingEntry = CHANGELOG.find(e => e.version === manifestVersion);
    if (matchingEntry && matchingEntry !== currentVersion) {
      $('#currentChangelog').innerHTML = buildChangelogCard(matchingEntry, true);
    } else {
      $('#currentChangelog').innerHTML = buildChangelogCard(currentVersion, true);
    }
  } else {
    $('#currentChangelog').innerHTML = buildChangelogCard(currentVersion, true);
  }

  // ── Render previous versions ──
  const historyList = $('#historyList');
  const previousVersions = CHANGELOG.slice(1);

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
    const url = chrome.runtime.getURL('popup/popup.html');
    chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  });
});
