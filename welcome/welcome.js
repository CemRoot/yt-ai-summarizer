/**
 * Gleano — Welcome / Onboarding Controller (v2.1)
 * Multi-language support + dual-provider + Article Reader scope.
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ── i18n strings ──
  const I18N = {
    en: {
      title: 'Gleano',
      subtitle: 'Summarize YouTube videos and web articles with AI — key points, detailed analysis, chat, and podcast.',
      heroF1: 'YouTube summaries',
      heroF2: 'Article Reader',
      heroF3: 'Chat & podcast',
      step1chip: 'Step 1 of 3',
      step1title: 'Get Started',
      step1desc: 'Sign in for free AI summaries or bring your own API key.',
      googleCardTitle: 'Sign in with Google',
      googleCardDesc: 'Get 5 free AI-powered summaries — no API key needed.',
      googleF1: '5 free AI summaries',
      googleF2: 'No API key required',
      googleF3: 'Upgrade anytime for unlimited',
      byokCardTitle: 'Use My Own API Key',
      byokCardDesc: 'Free forever with your own Groq or Ollama Cloud key.',
      byokF1: 'Unlimited free usage',
      byokF2: 'Groq or Ollama Cloud',
      byokF3: 'Requires API key setup',
      signingIn: 'Signing in with Google…',
      signInSuccess: 'Welcome! Redirecting…',
      signInError: 'Sign-in failed. Click to try again.',
      signInCancel: 'Sign-in was cancelled. Click to try again.',
      signInTechDetails: 'Diagnostic details (for support)',
      signInTimeoutHint:
        'If you use two-step verification (2FA), keep the sign-in window visible until you finish — switching away for too long can time out. Try again and complete the prompt without leaving Chrome for long.',
      groqName: 'Groq',
      groqDesc: 'Ultra-fast inference. Best for speed.',
      ollamaName: 'Ollama Cloud',
      ollamaDesc: 'Gemini 3 Flash & open-source models.',
      recommended: 'Recommended',
      continue: 'Continue',
      back: 'Back',
      step2chip: 'Step 2 of 3',
      step2titleGroq: 'Enter Your Groq API Key',
      step2titleOllama: 'Enter Your Ollama API Key',
      step2descGroq: 'It takes 30 seconds. Create a free account and generate a key.',
      step2descOllama: 'Create an account on ollama.com and generate an API key.',
      inst1Groq: 'Visit <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com/keys</a>',
      inst1Ollama: 'Visit <a href="https://ollama.com/settings/keys" target="_blank" rel="noopener noreferrer">ollama.com/settings/keys</a>',
      inst2: 'Sign up with <strong>Google</strong> or <strong>GitHub</strong> (free)',
      inst3: 'Click <strong>"Create API Key"</strong> and copy it',
      inst4: 'Paste it in the field below',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx',
      placeholderOllama: 'Paste your Ollama API key here',
      validateSave: 'Validate & Save',
      validating: 'Validating...',
      checking: 'Checking your API key...',
      valid: 'API key is valid! Moving to the next step...',
      invalid: 'Invalid API key. Please check and try again.',
      connError: 'Connection error. Please try again.',
      enterKey: 'Please enter your API key.',
      groqKeyWarn: 'Groq API keys start with "gsk_". Please check your key.',
      step3chip: 'Step 3 of 3',
      step3title: 'How It Works',
      step3desc: 'Three simple steps on YouTube or any supported article page.',
      how1title: 'Open Content',
      how1desc: 'Play a YouTube video with captions, or open a news article or blog in Chrome.',
      how2title: 'Launch Gleano',
      how2desc: 'On YouTube, click the floating button. On articles, open Gleano from the toolbar and tap Article Reader.',
      how3title: 'Choose Your Mode',
      how3desc: 'Pick <strong>Summary</strong>, <strong>Key Points</strong>, <strong>Detailed Analysis</strong>, <strong>Chat</strong>, or <strong>Podcast</strong> — all generated instantly.',
      goYoutube: 'Try on YouTube',
      tip: 'On articles, pin Gleano and use Article Reader from the popup. Change provider, model, and language anytime in extension settings.',
      footerPowered: 'Powered by',
      privacyPolicy: 'Privacy Policy',
      langLabel: 'Language',
      heroKicker: 'AI Content Reader',
      rail1: 'Account',
      rail2: 'API key',
      rail3: 'Start',
    },
    tr: {
      title: 'Gleano',
      subtitle: 'YouTube videoları ve web makaleleri için AI özetleri, sohbet ve podcast — ücretsiz kredi veya kendi API anahtarınız.',
      heroF1: 'YouTube özetleri',
      heroF2: 'Makale Okuyucu',
      heroF3: 'Sohbet ve podcast',
      step1chip: 'Adım 1 / 3',
      step1title: 'Başlayın',
      step1desc: 'Ücretsiz AI özetleri için giriş yapın veya kendi API anahtarınızı kullanın.',
      googleCardTitle: 'Google ile Giriş Yap',
      googleCardDesc: '5 ücretsiz AI destekli özet alın — API anahtarı gerekmez.',
      googleF1: '5 ücretsiz AI özeti',
      googleF2: 'API anahtarı gerekmez',
      googleF3: 'Sınırsız için yükseltin',
      byokCardTitle: 'Kendi API Anahtarımı Kullan',
      byokCardDesc: 'Groq veya Ollama Cloud anahtarınızla sonsuza kadar ücretsiz.',
      byokF1: 'Sınırsız ücretsiz kullanım',
      byokF2: 'Groq veya Ollama Cloud',
      byokF3: 'API anahtarı kurulumu gerekli',
      signingIn: 'Google ile giriş yapılıyor…',
      signInSuccess: 'Hoş geldiniz! Yönlendiriliyor…',
      signInError: 'Giriş başarısız. Tekrar denemek için tıklayın.',
      signInCancel: 'Giriş iptal edildi. Tekrar denemek için tıklayın.',
      signInTechDetails: 'Tanılama ayrıntıları (destek için)',
      signInTimeoutHint:
        'İki adımlı doğrulama (2FA) kullanıyorsanız, giriş penceresini bitene kadar açık tutun — uzun süre başka uygulamaya geçmek zaman aşımına yol açabilir. Tekrar deneyin ve Chrome’da işlemi kesintisiz tamamlayın.',
      groqName: 'Groq',
      groqDesc: 'Ultra hızlı çıkarım. Hız için en iyisi.',
      ollamaName: 'Ollama Cloud',
      ollamaDesc: 'Gemini 3 Flash ve açık kaynak modeller.',
      recommended: 'Önerilen',
      continue: 'Devam Et',
      back: 'Geri',
      step2chip: 'Adım 2 / 3',
      step2titleGroq: 'Groq API Anahtarınızı Girin',
      step2titleOllama: 'Ollama API Anahtarınızı Girin',
      step2descGroq: '30 saniye sürer. Ücretsiz hesap açın ve anahtar oluşturun.',
      step2descOllama: 'ollama.com\'da hesap açın ve API anahtarı oluşturun.',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com/keys</a> adresine gidin',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank" rel="noopener noreferrer">ollama.com/settings/keys</a> adresine gidin',
      inst2: '<strong>Google</strong> veya <strong>GitHub</strong> ile kaydolun (ücretsiz)',
      inst3: '<strong>"Create API Key"</strong> butonuna tıklayın ve kopyalayın',
      inst4: 'Aşağıdaki alana yapıştırın',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx',
      placeholderOllama: 'Ollama API anahtarınızı yapıştırın',
      validateSave: 'Doğrula & Kaydet',
      validating: 'Doğrulanıyor...',
      checking: 'API anahtarınız kontrol ediliyor...',
      valid: 'API anahtarı geçerli! Sonraki adıma geçiliyor...',
      invalid: 'Geçersiz API anahtarı. Lütfen kontrol edin ve tekrar deneyin.',
      connError: 'Bağlantı hatası. Lütfen tekrar deneyin.',
      enterKey: 'Lütfen API anahtarınızı girin.',
      groqKeyWarn: 'Groq API anahtarları "gsk_" ile başlar. Lütfen anahtarınızı kontrol edin.',
      step3chip: 'Adım 3 / 3',
      step3title: 'Nasıl Çalışır',
      step3desc: 'YouTube veya desteklenen makale sayfalarında üç basit adım.',
      how1title: 'İçerik Açın',
      how1desc: 'Altyazılı bir YouTube videosu oynatın veya Chrome\'da bir haber ya da blog makalesi açın.',
      how2title: 'Gleano\'yu Başlatın',
      how2desc: 'YouTube\'da yüzen butona tıklayın. Makalelerde araç çubuğundan Gleano\'yu açıp Makale Okuyucu\'ya dokunun.',
      how3title: 'Modunuzu Seçin',
      how3desc: '<strong>Özet</strong>, <strong>Anahtar Noktalar</strong>, <strong>Detaylı Analiz</strong>, <strong>Sohbet</strong> veya <strong>Podcast</strong> — hepsi anında oluşturulur.',
      goYoutube: 'YouTube\'da Dene',
      tip: 'Makalelerde Gleano\'yu sabitleyin ve popup\'tan Makale Okuyucu\'yu kullanın. Sağlayıcı, model ve dili istediğiniz zaman uzantı ayarlarından değiştirebilirsiniz.',
      footerPowered: 'Altyapı',
      privacyPolicy: 'Gizlilik Politikası',
      langLabel: 'Dil',
      heroKicker: 'AI İçerik Okuyucu',
      rail1: 'Hesap',
      rail2: 'API anahtarı',
      rail3: 'Başla',
    },
    es: {
      title: 'Gleano',
      subtitle: 'Resume videos de YouTube y artículos web con IA — puntos clave, análisis, chat y podcast.',
      heroF1: 'Resúmenes de YouTube', heroF2: 'Lector de artículos', heroF3: 'Chat y podcast',
      step1chip: 'Paso 1 de 3', step1title: 'Comenzar', step1desc: 'Inicia sesión para resúmenes gratuitos o usa tu propia clave API.',
      googleCardTitle: 'Iniciar sesión con Google', googleCardDesc: 'Obtén 5 resúmenes gratuitos — sin clave API.',
      googleF1: '5 resúmenes AI gratis', googleF2: 'Sin clave API necesaria', googleF3: 'Actualiza para ilimitado',
      byokCardTitle: 'Usar mi propia clave API', byokCardDesc: 'Gratis para siempre con tu clave Groq u Ollama.',
      byokF1: 'Uso gratuito ilimitado', byokF2: 'Groq u Ollama Cloud', byokF3: 'Requiere configuración de clave',
      signingIn: 'Iniciando sesión con Google…', signInSuccess: '¡Bienvenido! Redirigiendo…', signInError: 'Error al iniciar sesión. Haz clic para reintentar.', signInCancel: 'Inicio de sesión cancelado.',
      groqName: 'Groq', groqDesc: 'Inferencia ultrarrápida. Lo mejor para velocidad.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash y modelos de código abierto.',
      recommended: 'Recomendado', continue: 'Continuar', back: 'Atrás',
      step2chip: 'Paso 2 de 3', step2titleGroq: 'Ingresa tu clave API de Groq', step2titleOllama: 'Ingresa tu clave API de Ollama',
      step2descGroq: 'Toma 30 segundos. Crea una cuenta gratuita y genera una clave.', step2descOllama: 'Crea una cuenta en ollama.com y genera una clave API.',
      inst1Groq: 'Visita <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visita <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Regístrate con <strong>Google</strong> o <strong>GitHub</strong> (gratis)', inst3: 'Haz clic en <strong>"Create API Key"</strong> y cópiala', inst4: 'Pégala en el campo de abajo',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Pega tu clave API de Ollama aquí',
      validateSave: 'Validar y Guardar', validating: 'Validando...', checking: 'Comprobando tu clave API...', valid: '¡Clave válida! Pasando al siguiente paso...', invalid: 'Clave API inválida. Por favor, revísala.', connError: 'Error de conexión. Inténtalo de nuevo.', enterKey: 'Por favor, ingresa tu clave API.', groqKeyWarn: 'Las claves de Groq empiezan con "gsk_".',
      step3chip: 'Paso 3 de 3', step3title: 'Cómo Funciona', step3desc: 'Tres pasos simples en YouTube o cualquier página de artículo compatible.',
      how1title: 'Abre contenido', how1desc: 'Reproduce un video de YouTube con subtítulos o abre un artículo o blog en Chrome.',
      how2title: 'Inicia Gleano', how2desc: 'En YouTube, haz clic en el botón flotante. En artículos, abre Gleano desde la barra y elige Lector de artículos.',
      how3title: 'Elige tu Modo', how3desc: 'Elige <strong>Resumen</strong>, <strong>Puntos Clave</strong>, <strong>Análisis Detallado</strong>, <strong>Chat</strong> o <strong>Podcast</strong>.',
      goYoutube: 'Probar en YouTube', tip: 'En artículos, fija Gleano y usa Lector de artículos desde el popup. Cambia proveedor, modelo e idioma en los ajustes.',
      footerPowered: 'Desarrollado por', privacyPolicy: 'Política de Privacidad', langLabel: 'Idioma', heroKicker: 'Lector de contenido IA',
    },
    fr: {
      title: 'Gleano',
      subtitle: 'Résumez des vidéos YouTube et des articles web avec l\'IA — points clés, analyse, chat et podcast.',
      heroF1: 'Résumés YouTube', heroF2: 'Lecteur d\'articles', heroF3: 'Chat et podcast',
      step1chip: 'Étape 1 sur 3', step1title: 'Commencer', step1desc: 'Connectez-vous pour des résumés gratuits ou utilisez votre propre clé API.',
      googleCardTitle: 'Se connecter avec Google', googleCardDesc: 'Obtenez 5 résumés gratuits — aucune clé API requise.',
      googleF1: '5 résumés IA gratuits', googleF2: 'Aucune clé API requise', googleF3: 'Passez à illimité',
      byokCardTitle: 'Utiliser ma propre clé API', byokCardDesc: 'Gratuit pour toujours avec votre clé Groq ou Ollama.',
      byokF1: 'Utilisation gratuite illimitée', byokF2: 'Groq ou Ollama Cloud', byokF3: 'Configuration de clé requise',
      signingIn: 'Connexion avec Google…', signInSuccess: 'Bienvenue ! Redirection…', signInError: 'Échec de connexion. Cliquez pour réessayer.', signInCancel: 'Connexion annulée.',
      groqName: 'Groq', groqDesc: 'Inférence ultra-rapide sur puces LPU.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash et modèles open-source.',
      recommended: 'Recommandé', continue: 'Continuer', back: 'Retour',
      step2chip: 'Étape 2 sur 3', step2titleGroq: 'Entrez votre clé API Groq', step2titleOllama: 'Entrez votre clé API Ollama',
      step2descGroq: 'Cela prend 30 secondes. Créez un compte gratuit et générez une clé.', step2descOllama: 'Créez un compte sur ollama.com et générez une clé API.',
      inst1Groq: 'Visitez <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visitez <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Inscrivez-vous avec <strong>Google</strong> ou <strong>GitHub</strong> (gratuit)', inst3: 'Cliquez sur <strong>"Create API Key"</strong> et copiez-la', inst4: 'Collez-la dans le champ ci-dessous',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Collez votre clé API Ollama ici',
      validateSave: 'Valider et Enregistrer', validating: 'Validation...', checking: 'Vérification de votre clé API...', valid: 'Clé valide ! Passage à l\'étape suivante...', invalid: 'Clé API invalide. Veuillez vérifier.', connError: 'Erreur de connexion. Veuillez réessayer.', enterKey: 'Veuillez entrer votre clé API.', groqKeyWarn: 'Les clés Groq commencent par "gsk_".',
      step3chip: 'Étape 3 sur 3', step3title: 'Comment ça marche', step3desc: 'Trois étapes simples sur YouTube ou toute page d\'article prise en charge.',
      how1title: 'Ouvrir du contenu', how1desc: 'Lancez une vidéo YouTube avec sous-titres ou ouvrez un article ou blog dans Chrome.',
      how2title: 'Lancer Gleano', how2desc: 'Sur YouTube, cliquez sur le bouton flottant. Sur les articles, ouvrez Gleano depuis la barre et choisissez Lecteur d\'articles.',
      how3title: 'Choisissez votre mode', how3desc: 'Choisissez <strong>Résumé</strong>, <strong>Points Clés</strong>, <strong>Analyse Détaillée</strong>, <strong>Chat</strong> ou <strong>Podcast</strong>.',
      goYoutube: 'Essayer sur YouTube', tip: 'Sur les articles, épinglez Gleano et utilisez Lecteur d\'articles depuis le popup. Changez fournisseur, modèle et langue dans les paramètres.',
      footerPowered: 'Propulsé par', privacyPolicy: 'Politique de Confidentialité', langLabel: 'Langue', heroKicker: 'Lecteur de contenu IA',
    },
    de: {
      title: 'Gleano',
      subtitle: 'YouTube-Videos und Webartikel mit KI zusammenfassen — Kernpunkte, Analyse, Chat und Podcast.',
      heroF1: 'YouTube-Zusammenfassungen', heroF2: 'Artikel-Leser', heroF3: 'Chat & Podcast',
      step1chip: 'Schritt 1 von 3', step1title: 'Loslegen', step1desc: 'Melden Sie sich an für kostenlose KI-Zusammenfassungen oder verwenden Sie Ihren eigenen API-Schlüssel.',
      googleCardTitle: 'Mit Google anmelden', googleCardDesc: 'Erhalten Sie 5 kostenlose Zusammenfassungen — kein API-Schlüssel nötig.',
      googleF1: '5 kostenlose KI-Zusammenfassungen', googleF2: 'Kein API-Schlüssel erforderlich', googleF3: 'Jederzeit auf unbegrenzt upgraden',
      byokCardTitle: 'Eigenen API-Schlüssel verwenden', byokCardDesc: 'Für immer kostenlos mit Ihrem Groq- oder Ollama-Schlüssel.',
      byokF1: 'Unbegrenzte kostenlose Nutzung', byokF2: 'Groq oder Ollama Cloud', byokF3: 'API-Schlüssel-Einrichtung erforderlich',
      signingIn: 'Anmeldung mit Google…', signInSuccess: 'Willkommen! Weiterleitung…', signInError: 'Anmeldung fehlgeschlagen. Klicken Sie zum Wiederholen.', signInCancel: 'Anmeldung abgebrochen.',
      groqName: 'Groq', groqDesc: 'Ultraschnelle Inferenz auf LPU-Chips.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash und Open-Source-Modelle.',
      recommended: 'Empfohlen', continue: 'Weiter', back: 'Zurück',
      step2chip: 'Schritt 2 von 3', step2titleGroq: 'Geben Sie Ihren Groq API-Schlüssel ein', step2titleOllama: 'Geben Sie Ihren Ollama API-Schlüssel ein',
      step2descGroq: 'Dauert 30 Sekunden. Erstellen Sie ein kostenloses Konto.', step2descOllama: 'Erstellen Sie ein Konto auf ollama.com.',
      inst1Groq: 'Besuchen Sie <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Besuchen Sie <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Melden Sie sich mit <strong>Google</strong> oder <strong>GitHub</strong> an (kostenlos)', inst3: 'Klicken Sie auf <strong>"Create API Key"</strong> und kopieren Sie ihn', inst4: 'Fügen Sie ihn unten ein',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama API-Schlüssel hier einfügen',
      validateSave: 'Validieren & Speichern', validating: 'Validierung...', checking: 'API-Schlüssel wird überprüft...', valid: 'Schlüssel gültig! Weiter zum nächsten Schritt...', invalid: 'Ungültiger API-Schlüssel.', connError: 'Verbindungsfehler.', enterKey: 'Bitte geben Sie Ihren API-Schlüssel ein.', groqKeyWarn: 'Groq-Schlüssel beginnen mit "gsk_".',
      step3chip: 'Schritt 3 von 3', step3title: 'So funktioniert es', step3desc: 'Drei einfache Schritte auf YouTube oder jeder unterstützten Artikelseite.',
      how1title: 'Inhalt öffnen', how1desc: 'Spielen Sie ein YouTube-Video mit Untertiteln ab oder öffnen Sie einen Artikel oder Blog in Chrome.',
      how2title: 'Gleano starten', how2desc: 'Auf YouTube den schwebenden Button klicken. Bei Artikeln Gleano in der Symbolleiste öffnen und Artikel-Leser wählen.',
      how3title: 'Modus wählen', how3desc: 'Wählen Sie <strong>Zusammenfassung</strong>, <strong>Kernpunkte</strong>, <strong>Detailanalyse</strong>, <strong>Chat</strong> oder <strong>Podcast</strong>.',
      goYoutube: 'Auf YouTube testen', tip: 'Bei Artikeln Gleano anheften und Artikel-Leser im Popup nutzen. Anbieter, Modell und Sprache jederzeit in den Einstellungen ändern.',
      footerPowered: 'Unterstützt von', privacyPolicy: 'Datenschutzrichtlinie', langLabel: 'Sprache', heroKicker: 'KI-Inhaltsleser',
    },
    ja: {
      title: 'Gleano',
      subtitle: 'YouTube動画とWeb記事をAIで要約 — キーポイント、詳細分析、チャット、ポッドキャスト。',
      heroF1: 'YouTube要約', heroF2: '記事リーダー', heroF3: 'チャットとポッドキャスト',
      step1chip: 'ステップ 1/3', step1title: '始めましょう', step1desc: '無料AIサマリーにサインインするか、自分のAPIキーを使用します。',
      googleCardTitle: 'Googleでサインイン', googleCardDesc: '5つの無料AIサマリー — APIキー不要。',
      googleF1: '5つの無料AIサマリー', googleF2: 'APIキー不要', googleF3: '無制限にアップグレード',
      byokCardTitle: '自分のAPIキーを使用', byokCardDesc: 'GroqまたはOllamaキーで永久無料。',
      byokF1: '無制限の無料使用', byokF2: 'GroqまたはOllama Cloud', byokF3: 'APIキーの設定が必要',
      signingIn: 'Googleでサインイン中…', signInSuccess: 'ようこそ！リダイレクト中…', signInError: 'サインインに失敗しました。再試行するにはクリック。', signInCancel: 'サインインがキャンセルされました。',
      groqName: 'Groq', groqDesc: 'LPUチップによる超高速推論。',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flashとオープンソースモデル。',
      recommended: 'おすすめ', continue: '次へ', back: '戻る',
      step2chip: 'ステップ 2/3', step2titleGroq: 'Groq APIキーを入力', step2titleOllama: 'Ollama APIキーを入力',
      step2descGroq: '30秒で完了。無料アカウントを作成してキーを生成。', step2descOllama: 'ollama.comでアカウントを作成しAPIキーを生成。',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>にアクセス',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>にアクセス',
      inst2: '<strong>Google</strong>または<strong>GitHub</strong>でサインアップ（無料）', inst3: '<strong>"Create API Key"</strong>をクリックしてコピー', inst4: '下のフィールドに貼り付け',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama APIキーをここに貼り付け',
      validateSave: '検証して保存', validating: '検証中...', checking: 'APIキーを確認中...', valid: 'APIキーが有効です！次のステップへ...', invalid: '無効なAPIキーです。', connError: '接続エラー。', enterKey: 'APIキーを入力してください。', groqKeyWarn: 'GroqのAPIキーは"gsk_"で始まります。',
      step3chip: 'ステップ 3/3', step3title: '使い方', step3desc: 'YouTubeまたは対応記事ページでの3つの簡単なステップ。',
      how1title: 'コンテンツを開く', how1desc: '字幕付きYouTube動画を再生するか、Chromeでニュース記事やブログを開きます。',
      how2title: 'Gleanoを起動', how2desc: 'YouTubeではフローティングボタンをクリック。記事ではツールバーからGleanoを開き記事リーダーを選択。',
      how3title: 'モードを選択', how3desc: '<strong>要約</strong>、<strong>キーポイント</strong>、<strong>詳細分析</strong>、<strong>チャット</strong>、または<strong>ポッドキャスト</strong>を選択。',
      goYoutube: 'YouTubeで試す', tip: '記事ではGleanoをピン留めし、ポップアップから記事リーダーを使用。設定でプロバイダー、モデル、言語を変更可能。',
      footerPowered: '提供元', privacyPolicy: 'プライバシーポリシー', langLabel: '言語', heroKicker: 'AIコンテンツリーダー',
    },
    ko: {
      title: 'Gleano',
      subtitle: 'YouTube 동영상과 웹 기사를 AI로 요약 — 핵심 포인트, 상세 분석, 채팅, 팟캐스트.',
      heroF1: 'YouTube 요약', heroF2: '기사 리더', heroF3: '채팅 및 팟캐스트',
      step1chip: '1단계 / 3', step1title: '시작하기', step1desc: '무료 AI 요약을 위해 로그인하거나 자신의 API 키를 사용하세요.',
      googleCardTitle: 'Google로 로그인', googleCardDesc: '5개의 무료 AI 요약 — API 키 필요 없음.',
      googleF1: '5개 무료 AI 요약', googleF2: 'API 키 필요 없음', googleF3: '무제한으로 업그레이드',
      byokCardTitle: '내 API 키 사용', byokCardDesc: 'Groq 또는 Ollama 키로 영원히 무료.',
      byokF1: '무제한 무료 사용', byokF2: 'Groq 또는 Ollama Cloud', byokF3: 'API 키 설정 필요',
      signingIn: 'Google로 로그인 중…', signInSuccess: '환영합니다! 리디렉션 중…', signInError: '로그인 실패. 다시 시도하려면 클릭.', signInCancel: '로그인이 취소되었습니다.',
      groqName: 'Groq', groqDesc: 'LPU 칩의 초고속 추론.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash 및 오픈소스 모델.',
      recommended: '추천', continue: '계속', back: '뒤로',
      step2chip: '2단계 / 3', step2titleGroq: 'Groq API 키 입력', step2titleOllama: 'Ollama API 키 입력',
      step2descGroq: '30초면 됩니다. 무료 계정을 만들고 키를 생성하세요.', step2descOllama: 'ollama.com에서 계정을 만들고 API 키를 생성하세요.',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> 방문',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a> 방문',
      inst2: '<strong>Google</strong> 또는 <strong>GitHub</strong>으로 가입 (무료)', inst3: '<strong>"Create API Key"</strong>를 클릭하고 복사', inst4: '아래 필드에 붙여넣기',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama API 키를 여기에 붙여넣기',
      validateSave: '검증 및 저장', validating: '검증 중...', checking: 'API 키 확인 중...', valid: 'API 키가 유효합니다! 다음 단계로...', invalid: '유효하지 않은 API 키입니다.', connError: '연결 오류.', enterKey: 'API 키를 입력하세요.', groqKeyWarn: 'Groq API 키는 "gsk_"로 시작합니다.',
      step3chip: '3단계 / 3', step3title: '사용 방법', step3desc: 'YouTube 또는 지원되는 기사 페이지에서 간단한 3단계.',
      how1title: '콘텐츠 열기', how1desc: '자막이 있는 YouTube 동영상을 재생하거나 Chrome에서 뉴스 기사나 블로그를 엽니다.',
      how2title: 'Gleano 실행', how2desc: 'YouTube에서는 플로팅 버튼을 클릭. 기사에서는 도구 모음에서 Gleano를 열고 기사 리더를 선택.',
      how3title: '모드 선택', how3desc: '<strong>요약</strong>, <strong>핵심 포인트</strong>, <strong>상세 분석</strong>, <strong>채팅</strong> 또는 <strong>팟캐스트</strong>를 선택.',
      goYoutube: 'YouTube에서 사용해보기', tip: '기사에서는 Gleano를 고정하고 팝업에서 기사 리더를 사용하세요. 설정에서 제공업체, 모델, 언어를 변경할 수 있습니다.',
      footerPowered: '제공', privacyPolicy: '개인정보 보호정책', langLabel: '언어', heroKicker: 'AI 콘텐츠 리더',
    },
    zh: {
      title: 'Gleano',
      subtitle: '用AI总结YouTube视频和网络文章 — 关键要点、详细分析、聊天和播客。',
      heroF1: 'YouTube摘要', heroF2: '文章阅读器', heroF3: '聊天与播客',
      step1chip: '第1步 / 共3步', step1title: '开始使用', step1desc: '登录以获取免费AI摘要或使用您自己的API密钥。',
      googleCardTitle: '使用Google登录', googleCardDesc: '获取5个免费AI摘要 — 无需API密钥。',
      googleF1: '5个免费AI摘要', googleF2: '无需API密钥', googleF3: '随时升级为无限制',
      byokCardTitle: '使用我自己的API密钥', byokCardDesc: '使用您的Groq或Ollama密钥永久免费。',
      byokF1: '无限免费使用', byokF2: 'Groq或Ollama Cloud', byokF3: '需要API密钥设置',
      signingIn: '正在使用Google登录…', signInSuccess: '欢迎！正在跳转…', signInError: '登录失败。点击重试。', signInCancel: '登录已取消。',
      groqName: 'Groq', groqDesc: 'LPU芯片上的超快推理。',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash和开源模型。',
      recommended: '推荐', continue: '继续', back: '返回',
      step2chip: '第2步 / 共3步', step2titleGroq: '输入您的Groq API密钥', step2titleOllama: '输入您的Ollama API密钥',
      step2descGroq: '只需30秒。创建免费账户并生成密钥。', step2descOllama: '在ollama.com创建账户并生成API密钥。',
      inst1Groq: '访问 <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: '访问 <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: '使用<strong>Google</strong>或<strong>GitHub</strong>注册（免费）', inst3: '点击<strong>"Create API Key"</strong>并复制', inst4: '粘贴到下方输入框',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: '在此粘贴您的Ollama API密钥',
      validateSave: '验证并保存', validating: '验证中...', checking: '正在检查API密钥...', valid: 'API密钥有效！正在进入下一步...', invalid: '无效的API密钥。', connError: '连接错误。', enterKey: '请输入您的API密钥。', groqKeyWarn: 'Groq API密钥以"gsk_"开头。',
      step3chip: '第3步 / 共3步', step3title: '使用方法', step3desc: '在YouTube或任何支持的文章页面上三个简单步骤。',
      how1title: '打开内容', how1desc: '播放带字幕的YouTube视频，或在Chrome中打开新闻文章或博客。',
      how2title: '启动Gleano', how2desc: '在YouTube上点击浮动按钮。在文章上从工具栏打开Gleano并选择文章阅读器。',
      how3title: '选择模式', how3desc: '选择<strong>摘要</strong>、<strong>关键要点</strong>、<strong>详细分析</strong>、<strong>聊天</strong>或<strong>播客</strong>。',
      goYoutube: '在YouTube上试用', tip: '在文章上固定Gleano并从弹窗使用文章阅读器。可在扩展设置中随时更改提供商、模型和语言。',
      footerPowered: '技术支持', privacyPolicy: '隐私政策', langLabel: '语言', heroKicker: 'AI内容阅读器',
    },
    pt: {
      title: 'Gleano',
      subtitle: 'Resuma vídeos do YouTube e artigos web com IA — pontos-chave, análise, chat e podcast.',
      heroF1: 'Resumos do YouTube', heroF2: 'Leitor de artigos', heroF3: 'Chat e podcast',
      step1chip: 'Passo 1 de 3', step1title: 'Começar', step1desc: 'Faça login para resumos gratuitos ou use sua própria chave API.',
      googleCardTitle: 'Entrar com Google', googleCardDesc: 'Obtenha 5 resumos gratuitos — sem chave API.',
      googleF1: '5 resumos IA grátis', googleF2: 'Sem chave API necessária', googleF3: 'Atualize para ilimitado',
      byokCardTitle: 'Usar minha própria chave API', byokCardDesc: 'Grátis para sempre com sua chave Groq ou Ollama.',
      byokF1: 'Uso gratuito ilimitado', byokF2: 'Groq ou Ollama Cloud', byokF3: 'Configuração de chave necessária',
      signingIn: 'Entrando com Google…', signInSuccess: 'Bem-vindo! Redirecionando…', signInError: 'Falha no login. Clique para tentar novamente.', signInCancel: 'Login cancelado.',
      groqName: 'Groq', groqDesc: 'Inferência ultrarrápida em chips LPU.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash e modelos de código aberto.',
      recommended: 'Recomendado', continue: 'Continuar', back: 'Voltar',
      step2chip: 'Passo 2 de 3', step2titleGroq: 'Digite sua chave API do Groq', step2titleOllama: 'Digite sua chave API do Ollama',
      step2descGroq: 'Leva 30 segundos. Crie uma conta gratuita e gere uma chave.', step2descOllama: 'Crie uma conta no ollama.com e gere uma chave API.',
      inst1Groq: 'Visite <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visite <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Cadastre-se com <strong>Google</strong> ou <strong>GitHub</strong> (grátis)', inst3: 'Clique em <strong>"Create API Key"</strong> e copie', inst4: 'Cole no campo abaixo',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Cole sua chave API do Ollama aqui',
      validateSave: 'Validar e Salvar', validating: 'Validando...', checking: 'Verificando sua chave API...', valid: 'Chave válida! Indo para o próximo passo...', invalid: 'Chave API inválida.', connError: 'Erro de conexão.', enterKey: 'Por favor, insira sua chave API.', groqKeyWarn: 'Chaves Groq começam com "gsk_".',
      step3chip: 'Passo 3 de 3', step3title: 'Como Funciona', step3desc: 'Três passos simples no YouTube ou em qualquer página de artigo compatível.',
      how1title: 'Abrir conteúdo', how1desc: 'Reproduza um vídeo do YouTube com legendas ou abra um artigo ou blog no Chrome.',
      how2title: 'Iniciar Gleano', how2desc: 'No YouTube, clique no botão flutuante. Em artigos, abra o Gleano na barra e escolha Leitor de artigos.',
      how3title: 'Escolha seu Modo', how3desc: 'Escolha <strong>Resumo</strong>, <strong>Pontos-Chave</strong>, <strong>Análise Detalhada</strong>, <strong>Chat</strong> ou <strong>Podcast</strong>.',
      goYoutube: 'Experimentar no YouTube', tip: 'Em artigos, fixe o Gleano e use Leitor de artigos no popup. Altere provedor, modelo e idioma nas configurações.',
      footerPowered: 'Desenvolvido por', privacyPolicy: 'Política de Privacidade', langLabel: 'Idioma', heroKicker: 'Leitor de conteúdo IA',
    },
    ar: {
      title: 'Gleano',
      subtitle: 'لخّص فيديوهات YouTube ومقالات الويب بالذكاء الاصطناعي — نقاط رئيسية وتحليل ودردشة وبودكاست.',
      heroF1: 'ملخصات YouTube', heroF2: 'قارئ المقالات', heroF3: 'دردشة وبودكاست',
      step1chip: 'الخطوة 1 من 3', step1title: 'ابدأ الآن', step1desc: 'سجل دخولك للحصول على ملخصات مجانية أو استخدم مفتاح API الخاص بك.',
      googleCardTitle: 'تسجيل الدخول بـ Google', googleCardDesc: 'احصل على 5 ملخصات مجانية — بدون مفتاح API.',
      googleF1: '5 ملخصات AI مجانية', googleF2: 'لا يلزم مفتاح API', googleF3: 'ترقية للاستخدام غير المحدود',
      byokCardTitle: 'استخدام مفتاح API الخاص بي', byokCardDesc: 'مجاني للأبد مع مفتاح Groq أو Ollama.',
      byokF1: 'استخدام مجاني غير محدود', byokF2: 'Groq أو Ollama Cloud', byokF3: 'يتطلب إعداد مفتاح API',
      signingIn: 'جارٍ تسجيل الدخول بـ Google…', signInSuccess: 'مرحباً! جارٍ التحويل…', signInError: 'فشل تسجيل الدخول. انقر للمحاولة مرة أخرى.', signInCancel: 'تم إلغاء تسجيل الدخول.',
      groqName: 'Groq', groqDesc: 'استدلال فائق السرعة على شرائح LPU.',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash ونماذج مفتوحة المصدر.',
      recommended: 'موصى به', continue: 'متابعة', back: 'رجوع',
      step2chip: 'الخطوة 2 من 3', step2titleGroq: 'أدخل مفتاح Groq API', step2titleOllama: 'أدخل مفتاح Ollama API',
      step2descGroq: 'يستغرق 30 ثانية. أنشئ حساباً مجانياً.', step2descOllama: 'أنشئ حساباً على ollama.com.',
      inst1Groq: 'زر <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'زر <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'سجل عبر <strong>Google</strong> أو <strong>GitHub</strong> (مجاني)', inst3: 'انقر على <strong>"Create API Key"</strong> وانسخه', inst4: 'الصقه في الحقل أدناه',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'الصق مفتاح Ollama API هنا',
      validateSave: 'تحقق وحفظ', validating: 'جارٍ التحقق...', checking: 'جارٍ فحص مفتاح API...', valid: 'المفتاح صالح! الانتقال للخطوة التالية...', invalid: 'مفتاح API غير صالح.', connError: 'خطأ في الاتصال.', enterKey: 'الرجاء إدخال مفتاح API.', groqKeyWarn: 'مفاتيح Groq تبدأ بـ "gsk_".',
      step3chip: 'الخطوة 3 من 3', step3title: 'كيف يعمل', step3desc: 'ثلاث خطوات بسيطة على YouTube أو أي صفحة مقال مدعومة.',
      how1title: 'افتح المحتوى', how1desc: 'شغّل فيديو YouTube مع ترجمات، أو افتح مقالاً أو مدونة في Chrome.',
      how2title: 'شغّل Gleano', how2desc: 'على YouTube انقر الزر العائم. على المقالات افتح Gleano من شريط الأدوات واختر قارئ المقالات.',
      how3title: 'اختر الوضع', how3desc: 'اختر <strong>ملخص</strong>، <strong>نقاط رئيسية</strong>، <strong>تحليل مفصل</strong>، <strong>دردشة</strong> أو <strong>بودكاست</strong>.',
      goYoutube: 'جرّب على YouTube', tip: 'على المقالات، ثبّت Gleano واستخدم قارئ المقالات من النافذة المنبثقة. غيّر المزود والنموذج واللغة في الإعدادات.',
      footerPowered: 'مدعوم من', privacyPolicy: 'سياسة الخصوصية', langLabel: 'اللغة', heroKicker: 'قارئ المحتوى بالذكاء الاصطناعي',
    },
    hi: {
      title: 'Gleano',
      subtitle: 'YouTube वीडियो और वेब लेखों का AI सारांश — मुख्य बिंदु, विश्लेषण, चैट और पॉडकास्ट।',
      heroF1: 'YouTube सारांश', heroF2: 'लेख रीडर', heroF3: 'चैट और पॉडकास्ट',
      step1chip: 'चरण 1 / 3', step1title: 'शुरू करें', step1desc: 'मुफ़्त AI सारांश के लिए साइन इन करें या अपनी API कुंजी का उपयोग करें।',
      googleCardTitle: 'Google से साइन इन', googleCardDesc: '5 मुफ़्त AI सारांश प्राप्त करें — API कुंजी की आवश्यकता नहीं।',
      googleF1: '5 मुफ़्त AI सारांश', googleF2: 'API कुंजी आवश्यक नहीं', googleF3: 'असीमित के लिए अपग्रेड करें',
      byokCardTitle: 'अपनी API कुंजी का उपयोग करें', byokCardDesc: 'अपनी Groq या Ollama कुंजी से हमेशा मुफ़्त।',
      byokF1: 'असीमित मुफ़्त उपयोग', byokF2: 'Groq या Ollama Cloud', byokF3: 'API कुंजी सेटअप आवश्यक',
      signingIn: 'Google से साइन इन हो रहा है…', signInSuccess: 'स्वागत है! रीडायरेक्ट हो रहा है…', signInError: 'साइन इन विफल। पुनः प्रयास के लिए क्लिक करें।', signInCancel: 'साइन इन रद्द किया गया।',
      groqName: 'Groq', groqDesc: 'LPU चिप्स पर अल्ट्रा-फास्ट इनफ़रेंस।',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash और ओपन-सोर्स मॉडल।',
      recommended: 'अनुशंसित', continue: 'जारी रखें', back: 'वापस',
      step2chip: 'चरण 2 / 3', step2titleGroq: 'अपनी Groq API कुंजी दर्ज करें', step2titleOllama: 'अपनी Ollama API कुंजी दर्ज करें',
      step2descGroq: '30 सेकंड लगते हैं। मुफ़्त खाता बनाएं।', step2descOllama: 'ollama.com पर खाता बनाएं।',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> पर जाएं',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a> पर जाएं',
      inst2: '<strong>Google</strong> या <strong>GitHub</strong> से साइन अप करें (मुफ़्त)', inst3: '<strong>"Create API Key"</strong> पर क्लिक करें और कॉपी करें', inst4: 'नीचे दिए गए फ़ील्ड में पेस्ट करें',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'अपनी Ollama API कुंजी यहाँ पेस्ट करें',
      validateSave: 'सत्यापित करें और सहेजें', validating: 'सत्यापन...', checking: 'API कुंजी जाँच रहे हैं...', valid: 'API कुंजी मान्य है! अगले चरण पर...', invalid: 'अमान्य API कुंजी।', connError: 'कनेक्शन त्रुटि।', enterKey: 'कृपया अपनी API कुंजी दर्ज करें।', groqKeyWarn: 'Groq कुंजी "gsk_" से शुरू होती है।',
      step3chip: 'चरण 3 / 3', step3title: 'यह कैसे काम करता है', step3desc: 'YouTube या किसी भी समर्थित लेख पृष्ठ पर तीन सरल चरण।',
      how1title: 'सामग्री खोलें', how1desc: 'उपशीर्षक वाला YouTube वीडियो चलाएं, या Chrome में समाचार लेख या ब्लॉग खोलें।',
      how2title: 'Gleano लॉन्च करें', how2desc: 'YouTube पर फ़्लोटिंग बटन पर क्लिक करें। लेखों पर टूलबार से Gleano खोलें और लेख रीडर चुनें।',
      how3title: 'अपना मोड चुनें', how3desc: '<strong>सारांश</strong>, <strong>मुख्य बिंदु</strong>, <strong>विस्तृत विश्लेषण</strong>, <strong>चैट</strong> या <strong>पॉडकास्ट</strong> चुनें।',
      goYoutube: 'YouTube पर आज़माएं', tip: 'लेखों पर Gleano पिन करें और पॉपअप से लेख रीडर का उपयोग करें। सेटिंग्स में प्रदाता, मॉडल और भाषा बदलें।',
      footerPowered: 'संचालित', privacyPolicy: 'गोपनीयता नीति', langLabel: 'भाषा', heroKicker: 'AI सामग्री रीडर',
    },
  };

  const LANG_OPTIONS = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'tr', flag: '🇹🇷', label: 'Türkçe' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'zh', flag: '🇨🇳', label: '中文' },
    { code: 'pt', flag: '🇧🇷', label: 'Português' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
    { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  ];

  function detectLanguage() {
    const browserLang = (navigator.language || 'en').substring(0, 2).toLowerCase();
    return I18N[browserLang] ? browserLang : 'en';
  }

  let currentLang = detectLanguage();
  let chosenProvider = 'ollama';
  let currentStep = 1;

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  }

  // ── DOM refs ──
  const step1         = $('#step1');
  const step2         = $('#step2');
  const step3         = $('#step3');
  const progressFill  = $('#progressFill');
  const progressBarEl = $('#progressBar');
  const stepRailItems = $$('.step-rail-item');
  const langToggle    = $('#langToggle');
  const langMenu      = $('#langMenu');
  const langGrid      = $('#langGrid');
  const langSearch    = $('#langSearch');
  const langPicker    = $('#langPicker');
  const langFlagEl    = $('#langCurrentFlag');
  const langLabelEl   = $('#langCurrentLabel');
  const providerCards = $$('.provider-card');

  function applyTranslations() {
    const isRTL = currentLang === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

    $('#heroTitle').textContent = t('title');
    $('#heroSub').textContent = t('subtitle');
    const kicker = $('#heroKicker');
    if (kicker) kicker.textContent = t('heroKicker');
    const heroF1 = $('#heroF1');
    if (heroF1) heroF1.textContent = t('heroF1');
    const heroF2 = $('#heroF2');
    if (heroF2) heroF2.textContent = t('heroF2');
    const heroF3 = $('#heroF3');
    if (heroF3) heroF3.textContent = t('heroF3');
    $('#railL1').textContent = t('rail1');
    $('#railL2').textContent = t('rail2');
    $('#railL3').textContent = t('rail3');

    $('#step1Chip').textContent = t('step1chip');
    $('#step1Title').textContent = t('step1title');
    $('#step1Desc').textContent = t('step1desc');

    $('#googleCardTitle').textContent = t('googleCardTitle');
    $('#googleCardDesc').textContent = t('googleCardDesc');
    $('#googleF1').textContent = t('googleF1');
    $('#googleF2').textContent = t('googleF2');
    $('#googleF3').textContent = t('googleF3');
    $('#googleTag').textContent = t('recommended');

    $('#byokCardTitle').textContent = t('byokCardTitle');
    $('#byokCardDesc').textContent = t('byokCardDesc');
    $('#byokF1').textContent = t('byokF1');
    $('#byokF2').textContent = t('byokF2');
    $('#byokF3').textContent = t('byokF3');

    $('#groqName').textContent = t('groqName');
    $('#groqDesc').textContent = t('groqDesc');
    $('#ollamaName').textContent = t('ollamaName');
    $('#ollamaDesc').textContent = t('ollamaDesc');
    $('#ollamaTag').textContent = t('recommended');

    $('#step2Chip').textContent = t('step2chip');
    $('#step2BackText').textContent = t('back');
    updateStep2ForProvider();

    $('#step3Chip').textContent = t('step3chip');
    $('#step3Title').textContent = t('step3title');
    $('#step3Desc').textContent = t('step3desc');

    $('#how1Title').textContent = t('how1title');
    $('#how1Desc').textContent = t('how1desc');
    $('#how2Title').textContent = t('how2title');
    $('#how2Desc').textContent = t('how2desc');
    $('#how3Title').textContent = t('how3title');
    $('#how3Desc').innerHTML = t('how3desc');

    $('#goYoutubeText').textContent = t('goYoutube');
    $('#tipBox').textContent = t('tip');

    $('#footerPowered').textContent = t('footerPowered');
    $('#privacyLink').textContent = t('privacyPolicy');

    $('#validateBtnText').textContent = t('validateSave');
    langToggle.setAttribute('aria-label', t('langLabel'));
    $('#langLabel').textContent = t('langLabel');
    langSearch.placeholder = t('langLabel');
  }

  // ── Language selector ──
  function setLanguage(code) {
    const opt = LANG_OPTIONS.find(o => o.code === code) || LANG_OPTIONS[0];
    currentLang = opt.code;
    langFlagEl.textContent = opt.flag;
    langLabelEl.textContent = opt.label;
    applyTranslations();
    closeLangMenu();
  }

  function renderLanguageGrid(filter = '') {
    langGrid.innerHTML = '';
    const needle = filter.trim().toLowerCase();
    LANG_OPTIONS
      .filter(opt => !needle || opt.label.toLowerCase().includes(needle) || opt.code.includes(needle))
      .forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `lang-option${opt.code === currentLang ? ' active' : ''}`;
        btn.innerHTML = `
          <span>${opt.flag}</span>
          <span>${opt.label}</span>
          <span class="code">${opt.code.toUpperCase()}</span>
        `;
        btn.addEventListener('click', () => setLanguage(opt.code));
        langGrid.appendChild(btn);
      });
  }

  function openLangMenu() {
    langMenu.hidden = false;
    langToggle.setAttribute('aria-expanded', 'true');
    langSearch.focus();
    renderLanguageGrid(langSearch.value);
  }

  function closeLangMenu() {
    langMenu.hidden = true;
    langToggle.setAttribute('aria-expanded', 'false');
  }

  langToggle.addEventListener('click', () => {
    const willOpen = langMenu.hidden;
    if (willOpen) openLangMenu(); else closeLangMenu();
  });

  langSearch.addEventListener('input', () => renderLanguageGrid(langSearch.value));

  document.addEventListener('click', (e) => {
    if (!langPicker.contains(e.target)) closeLangMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLangMenu();
  });

  // initial render
  const heroVersionEl = $('#heroVersion');
  if (heroVersionEl && chrome?.runtime?.getManifest) {
    heroVersionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  }
  setLanguage(currentLang);
  renderLanguageGrid();

  // ── Path: Google Sign-in or BYOK ──
  let authPath = null; // 'google' | 'byok'
  const authStatusEl = $('#authStatus');
  const googleAuthCard = $('#googleAuthCard');
  const byokCard = $('#byokCard');

  googleAuthCard.addEventListener('click', handleGoogleSignIn);

  byokCard.addEventListener('click', () => {
    authPath = 'byok';
    goToStep(2);
    updateStep2ForProvider();
  });

  $('#step2Back').addEventListener('click', () => {
    authStatusEl.className = 'auth-status hidden';
    goToStep(1);
  });

  async function handleGoogleSignIn() {
    authPath = 'google';
    googleAuthCard.disabled = true;
    googleAuthCard.classList.add('is-loading');
    showAuthStatus(t('signingIn'), 'loading');

    try {
      const res = await chrome.runtime.sendMessage({ action: 'supabaseSignIn' });
      if (res?.error) {
        const isCancelled = /cancelled|user.*cancel/i.test(res.error);
        showAuthFailure(
          isCancelled ? t('signInCancel') : t('signInError'),
          res.error,
          res.authDebugTail,
          !isCancelled
        );
        googleAuthCard.disabled = false;
        googleAuthCard.classList.remove('is-loading');
        return;
      }

      const user = res.session?.user || {};
      const meta = user.user_metadata || {};
      const name = meta.full_name || meta.name || user.email || '';
      const avatar = meta.avatar_url || meta.picture || '';

      renderAuthStatusSuccess(t('signInSuccess'), name, avatar);

      await chrome.storage.local.set({ onboardingComplete: true, authMethod: 'google' });
      setTimeout(() => goToStep(3), 1500);
    } catch (err) {
      const isCancelled = /cancelled|user.*cancel/i.test(err.message);
      showAuthFailure(
        isCancelled ? t('signInCancel') : t('signInError'),
        err.message,
        '',
        !isCancelled
      );
      googleAuthCard.disabled = false;
      googleAuthCard.classList.remove('is-loading');
    }
  }

  function sanitizeAuthDebugForUser(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/https?:\/\/[^\s\])'"]+/gi, '[URL]')
      .replace(/chrome-extension:\/\/[^\s\])'"]+/gi, '[extension]')
      .replace(/\bsb_[a-zA-Z0-9_-]{8,}/g, '[key]');
  }

  function shouldShowSignInTimeoutHint(technical, debugTail) {
    const blob = `${technical || ''}\n${debugTail || ''}`.toLowerCase();
    return blob.includes('authorization page could not be loaded');
  }

  function showAuthFailure(summary, technical, debugTail, includeDetails) {
    authStatusEl.className = 'auth-status error';
    authStatusEl.replaceChildren();
    const p = document.createElement('p');
    p.className = 'auth-status-summary';
    p.textContent = summary;
    authStatusEl.appendChild(p);
    if (shouldShowSignInTimeoutHint(technical, debugTail) && t('signInTimeoutHint')) {
      const hint = document.createElement('p');
      hint.className = 'auth-status-hint';
      hint.textContent = t('signInTimeoutHint');
      authStatusEl.appendChild(hint);
    }
    if (includeDetails && (technical || debugTail)) {
      const det = document.createElement('details');
      det.open = false;
      const sum = document.createElement('summary');
      sum.textContent = t('signInTechDetails');
      det.appendChild(sum);
      const pre = document.createElement('pre');
      pre.className = 'auth-debug-pre';
      const logLabel = currentLang === 'tr' ? 'günlük' : 'log';
      let block = sanitizeAuthDebugForUser(technical || '');
      const tail = sanitizeAuthDebugForUser(debugTail || '');
      if (tail) {
        block += (block ? `\n\n--- ${logLabel} ---\n` : '') + tail;
      }
      pre.textContent = block;
      det.appendChild(pre);
      authStatusEl.appendChild(det);
    }
  }

  function showAuthStatus(msg, type, isHtml = false) {
    if (isHtml) authStatusEl.innerHTML = msg;
    else authStatusEl.textContent = msg;
    authStatusEl.className = `auth-status ${type}`;
  }

  /**
   * Render the post-sign-in success state via DOM APIs so user-controlled
   * `avatar` / `name` values cannot break out of attributes into script or
   * markup. Avoids `innerHTML` with template interpolation.
   */
  function renderAuthStatusSuccess(message, name, avatar) {
    authStatusEl.className = 'auth-status success';
    authStatusEl.replaceChildren();
    const msgNode = document.createElement('span');
    msgNode.className = 'auth-status-summary';
    msgNode.textContent = message || '';
    authStatusEl.appendChild(msgNode);
    if (!name) return;
    const wrap = document.createElement('div');
    wrap.className = 'auth-user';
    if (avatar) {
      const span = document.createElement('span');
      span.className = 'auth-avatar';
      const img = document.createElement('img');
      img.src = avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      span.appendChild(img);
      wrap.appendChild(span);
    }
    const strong = document.createElement('strong');
    strong.textContent = name;
    wrap.appendChild(strong);
    authStatusEl.appendChild(wrap);
  }

  // ── Provider selection (Step 2 — BYOK path) ──
  providerCards.forEach((card) => {
    card.addEventListener('click', () => {
      providerCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      chosenProvider = card.dataset.provider;
      updateStep2ForProvider();
    });
  });

  function updateStep2ForProvider() {
    const step2Title = $('#step2Title');
    const step2Desc  = $('#step2Desc');
    const keyInput   = $('#apiKeyInput');

    providerCards.forEach((c) => {
      c.classList.toggle('selected', c.dataset.provider === chosenProvider);
    });

    if (chosenProvider === 'ollama') {
      step2Title.textContent = t('step2titleOllama');
      step2Desc.textContent = t('step2descOllama');
      $('#inst1Text').innerHTML = t('inst1Ollama');
      keyInput.placeholder = t('placeholderOllama');
    } else {
      step2Title.textContent = t('step2titleGroq');
      step2Desc.textContent = t('step2descGroq');
      $('#inst1Text').innerHTML = t('inst1Groq');
      keyInput.placeholder = t('placeholderGroq');
    }
    $('#inst2Text').innerHTML = t('inst2');
    $('#inst3Text').innerHTML = t('inst3');
    $('#inst4Text').textContent = t('inst4');
    $('#validateBtnText').textContent = t('validateSave');
  }

  // ── Toggle key visibility ──
  $('#toggleKeyVis').addEventListener('click', () => {
    const inp = $('#apiKeyInput');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // ── Validate & Save ──
  const validateBtn = $('#validateBtn');
  const apiKeyInput = $('#apiKeyInput');
  const valStatus   = $('#validationStatus');

  validateBtn.addEventListener('click', handleValidate);
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleValidate();
  });

  async function handleValidate() {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showValidation(t('enterKey'), 'error');
      return;
    }

    if (chosenProvider === 'groq' && !key.startsWith('gsk_')) {
      showValidation(t('groqKeyWarn'), 'error');
      return;
    }

    validateBtn.disabled = true;
    $('#validateBtnText').textContent = t('validating');
    showValidation(t('checking'), 'loading');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateApiKey',
        apiKey: key,
        provider: chosenProvider
      });

      if (response?.valid) {
        const enc = StorageHelper.tryObfuscate(key);
        if (!enc.ok) {
          showValidation(enc.message, 'error');
          resetValidateBtn();
          return;
        }
        const storageData = {
          provider: chosenProvider,
          onboardingComplete: true
        };
        if (chosenProvider === 'ollama') {
          storageData.ollamaApiKey = enc.value;
        } else {
          storageData.groqApiKey = enc.value;
        }
        await chrome.storage.local.set(storageData);

        showValidation(t('valid'), 'success');
        setTimeout(() => goToStep(3), 1200);
      } else {
        showValidation(response?.error || t('invalid'), 'error');
        resetValidateBtn();
      }
    } catch (err) {
      showValidation(err?.message || t('connError'), 'error');
      resetValidateBtn();
    }
  }

  function resetValidateBtn() {
    validateBtn.disabled = false;
    $('#validateBtnText').textContent = t('validateSave');
  }

  function updateStepRail(num) {
    stepRailItems.forEach((el) => {
      const sn = parseInt(el.dataset.step, 10) || 0;
      el.classList.remove('is-active', 'is-done');
      if (sn < num) el.classList.add('is-done');
      else if (sn === num) el.classList.add('is-active');
    });
  }

  stepRailItems.forEach((el) => {
    el.addEventListener('click', () => {
      const sn = parseInt(el.dataset.step, 10) || 0;
      if (sn < currentStep) goToStep(sn);
    });
  });

  function goToStep(num) {
    const allSteps = [step1, step2, step3];

    allSteps.forEach((s, i) => {
      const stepNum = i + 1;
      s.classList.remove('active', 'completed');
      if (stepNum < num) s.classList.add('completed');
      else if (stepNum === num) s.classList.add('active');
    });

    currentStep = num;
    progressFill.style.width = `${(num / 3) * 100}%`;
    if (progressBarEl) progressBarEl.setAttribute('aria-valuenow', String(num));
    updateStepRail(num);
    allSteps[num - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Privacy ──
  $('#privacyLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = chrome.runtime.getURL('privacy-policy.html');
    chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  });

  // ── Already configured? Check BYOK keys + Supabase session ──
  chrome.storage.local.get(['groqApiKey', 'ollamaApiKey', 'provider', 'onboardingComplete', 'authMethod'], async (data) => {
    const hasBYOK = (data.provider === 'ollama' && data.ollamaApiKey) ||
                    (data.provider !== 'ollama' && data.groqApiKey);

    if (hasBYOK && data.onboardingComplete) {
      goToStep(3);
      return;
    }

    if (data.authMethod === 'google' && data.onboardingComplete) {
      try {
        const res = await chrome.runtime.sendMessage({ action: 'supabaseGetSession' });
        if (res?.session) {
          goToStep(3);
          return;
        }
      } catch { /* session expired, stay on step 1 */ }
    }
  });

  function showValidation(msg, type) {
    valStatus.textContent = msg;
    valStatus.className = `validation-status ${type}`;
  }

  applyTranslations();
  updateStepRail(1);
});
