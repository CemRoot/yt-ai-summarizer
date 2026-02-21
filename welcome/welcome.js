/**
 * YouTube AI Summarizer — Welcome / Onboarding Controller (v2.0)
 * Multi-language support + dual-provider + Gemini TTS podcast.
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ── i18n strings ──
  const I18N = {
    en: {
      title: 'YouTube AI Summarizer',
      subtitle: 'Get instant AI-powered summaries, key points, and detailed analysis for any YouTube video.',
      step1chip: 'Step 1 of 3',
      step1title: 'Choose Your AI Provider',
      step1desc: 'Both providers are free to start. You can switch anytime in settings.',
      groqName: 'Groq',
      groqDesc: 'Ultra-fast inference on LPU chips. Best for speed.',
      groqF1: 'Llama 3.3 70B, Llama 4 Scout',
      groqF2: 'Fastest response times',
      groqF3: 'Free tier: 14K req/day',
      ollamaName: 'Ollama Cloud',
      ollamaDesc: 'Gemini 3 Flash & massive open-source models. Free.',
      ollamaF1: 'Gemini 3 Flash — Recommended',
      ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B',
      ollamaF3: 'Free tier available',
      recommended: 'Recommended',
      continue: 'Continue',
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
      step3desc: 'Three simple steps on any YouTube video page.',
      how1title: 'Open a Video',
      how1desc: 'Go to any YouTube video that has captions or subtitles available.',
      how2title: 'Click the AI Button',
      how2desc: 'A floating button appears on the bottom-right of the page. Click it to open the panel.',
      how3title: 'Choose Your Mode',
      how3desc: 'Pick <strong>Summary</strong>, <strong>Key Points</strong>, <strong>Detailed Analysis</strong>, or <strong>Podcast</strong> — all generated instantly.',
      goYoutube: 'Go to YouTube & Try It',
      tip: 'You can change your provider, model, and language anytime from the extension settings (click the puzzle icon in Chrome toolbar).',
      footerPowered: 'Powered by',
      privacyPolicy: 'Privacy Policy',
      langLabel: 'Language',
    },
    tr: {
      title: 'YouTube AI Özetleyici',
      subtitle: 'Herhangi bir YouTube videosu için anında AI destekli özetler, anahtar noktalar ve detaylı analizler alın.',
      step1chip: 'Adım 1 / 3',
      step1title: 'AI Sağlayıcınızı Seçin',
      step1desc: 'Her iki sağlayıcı da ücretsiz olarak başlar. İstediğiniz zaman ayarlardan değiştirebilirsiniz.',
      groqName: 'Groq',
      groqDesc: 'LPU çiplerinde ultra hızlı çıkarım. Hız için en iyisi.',
      groqF1: 'Llama 3.3 70B, Llama 4 Scout',
      groqF2: 'En hızlı yanıt süreleri',
      groqF3: 'Ücretsiz: günlük 14K istek',
      ollamaName: 'Ollama Cloud',
      ollamaDesc: 'Gemini 3 Flash ve devasa açık kaynak modeller. Ücretsiz.',
      ollamaF1: 'Gemini 3 Flash — Önerilen',
      ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B',
      ollamaF3: 'Ücretsiz paket mevcut',
      recommended: 'Önerilen',
      continue: 'Devam Et',
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
      step3desc: 'Herhangi bir YouTube video sayfasında üç basit adım.',
      how1title: 'Video Açın',
      how1desc: 'Altyazıları olan herhangi bir YouTube videosuna gidin.',
      how2title: 'AI Butonuna Tıklayın',
      how2desc: 'Sayfanın sağ altında beliren butona tıklayarak paneli açın.',
      how3title: 'Modunuzu Seçin',
      how3desc: '<strong>Özet</strong>, <strong>Anahtar Noktalar</strong>, <strong>Detaylı Analiz</strong> veya <strong>Podcast</strong> — hepsi anında oluşturulur.',
      goYoutube: 'YouTube\'a Git ve Dene',
      tip: 'Sağlayıcı, model ve dili istediğiniz zaman uzantı ayarlarından değiştirebilirsiniz (Chrome araç çubuğundaki yapboz simgesine tıklayın).',
      footerPowered: 'Altyapı',
      privacyPolicy: 'Gizlilik Politikası',
      langLabel: 'Dil',
    },
    es: {
      title: 'YouTube AI Summarizer',
      subtitle: 'Obtén resúmenes instantáneos con IA, puntos clave y análisis detallados de cualquier video de YouTube.',
      step1chip: 'Paso 1 de 3',
      step1title: 'Elige tu proveedor de IA',
      step1desc: 'Ambos proveedores son gratuitos para empezar. Puedes cambiar en cualquier momento.',
      groqName: 'Groq', groqDesc: 'Inferencia ultrarrápida en chips LPU. Lo mejor para velocidad.',
      groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'Tiempos de respuesta más rápidos', groqF3: 'Gratis: 14K solicitudes/día',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash y modelos masivos de código abierto. Gratis.',
      ollamaF1: 'Gemini 3 Flash — Recomendado', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'Plan gratuito disponible',
      recommended: 'Recomendado', continue: 'Continuar',
      step2chip: 'Paso 2 de 3', step2titleGroq: 'Ingresa tu clave API de Groq', step2titleOllama: 'Ingresa tu clave API de Ollama',
      step2descGroq: 'Toma 30 segundos. Crea una cuenta gratuita y genera una clave.', step2descOllama: 'Crea una cuenta en ollama.com y genera una clave API.',
      inst1Groq: 'Visita <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visita <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Regístrate con <strong>Google</strong> o <strong>GitHub</strong> (gratis)', inst3: 'Haz clic en <strong>"Create API Key"</strong> y cópiala', inst4: 'Pégala en el campo de abajo',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Pega tu clave API de Ollama aquí',
      validateSave: 'Validar y Guardar', validating: 'Validando...', checking: 'Comprobando tu clave API...', valid: '¡Clave válida! Pasando al siguiente paso...', invalid: 'Clave API inválida. Por favor, revísala.', connError: 'Error de conexión. Inténtalo de nuevo.', enterKey: 'Por favor, ingresa tu clave API.', groqKeyWarn: 'Las claves de Groq empiezan con "gsk_".',
      step3chip: 'Paso 3 de 3', step3title: 'Cómo Funciona', step3desc: 'Tres pasos simples en cualquier página de video de YouTube.',
      how1title: 'Abre un Video', how1desc: 'Ve a cualquier video de YouTube con subtítulos disponibles.',
      how2title: 'Haz clic en el botón IA', how2desc: 'Un botón flotante aparece abajo a la derecha. Haz clic para abrir el panel.',
      how3title: 'Elige tu Modo', how3desc: 'Elige <strong>Resumen</strong>, <strong>Puntos Clave</strong>, <strong>Análisis Detallado</strong> o <strong>Podcast</strong>.',
      goYoutube: 'Ir a YouTube y Probar', tip: 'Puedes cambiar el proveedor, modelo e idioma en cualquier momento desde los ajustes de la extensión.',
      footerPowered: 'Desarrollado por', privacyPolicy: 'Política de Privacidad', langLabel: 'Idioma',
    },
    fr: {
      title: 'YouTube AI Summarizer',
      subtitle: 'Obtenez des résumés instantanés par IA, des points clés et des analyses détaillées pour toute vidéo YouTube.',
      step1chip: 'Étape 1 sur 3', step1title: 'Choisissez votre fournisseur IA', step1desc: 'Les deux fournisseurs sont gratuits pour commencer. Vous pouvez changer à tout moment.',
      groqName: 'Groq', groqDesc: 'Inférence ultra-rapide sur puces LPU.', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'Temps de réponse les plus rapides', groqF3: 'Gratuit: 14K requêtes/jour',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash et modèles open-source massifs. Gratuit.', ollamaF1: 'Gemini 3 Flash — Recommandé', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'Offre gratuite disponible',
      recommended: 'Recommandé', continue: 'Continuer',
      step2chip: 'Étape 2 sur 3', step2titleGroq: 'Entrez votre clé API Groq', step2titleOllama: 'Entrez votre clé API Ollama',
      step2descGroq: 'Cela prend 30 secondes. Créez un compte gratuit et générez une clé.', step2descOllama: 'Créez un compte sur ollama.com et générez une clé API.',
      inst1Groq: 'Visitez <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visitez <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Inscrivez-vous avec <strong>Google</strong> ou <strong>GitHub</strong> (gratuit)', inst3: 'Cliquez sur <strong>"Create API Key"</strong> et copiez-la', inst4: 'Collez-la dans le champ ci-dessous',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Collez votre clé API Ollama ici',
      validateSave: 'Valider et Enregistrer', validating: 'Validation...', checking: 'Vérification de votre clé API...', valid: 'Clé valide ! Passage à l\'étape suivante...', invalid: 'Clé API invalide. Veuillez vérifier.', connError: 'Erreur de connexion. Veuillez réessayer.', enterKey: 'Veuillez entrer votre clé API.', groqKeyWarn: 'Les clés Groq commencent par "gsk_".',
      step3chip: 'Étape 3 sur 3', step3title: 'Comment ça marche', step3desc: 'Trois étapes simples sur n\'importe quelle page vidéo YouTube.',
      how1title: 'Ouvrez une vidéo', how1desc: 'Allez sur une vidéo YouTube avec sous-titres disponibles.',
      how2title: 'Cliquez sur le bouton IA', how2desc: 'Un bouton flottant apparaît en bas à droite. Cliquez pour ouvrir le panneau.',
      how3title: 'Choisissez votre mode', how3desc: 'Choisissez <strong>Résumé</strong>, <strong>Points Clés</strong>, <strong>Analyse Détaillée</strong> ou <strong>Podcast</strong>.',
      goYoutube: 'Aller sur YouTube et Essayer', tip: 'Vous pouvez changer le fournisseur, le modèle et la langue à tout moment dans les paramètres.',
      footerPowered: 'Propulsé par', privacyPolicy: 'Politique de Confidentialité', langLabel: 'Langue',
    },
    de: {
      title: 'YouTube AI Summarizer',
      subtitle: 'Erhalten Sie sofortige KI-gestützte Zusammenfassungen, Kernpunkte und detaillierte Analysen für jedes YouTube-Video.',
      step1chip: 'Schritt 1 von 3', step1title: 'Wählen Sie Ihren KI-Anbieter', step1desc: 'Beide Anbieter sind kostenlos. Sie können jederzeit wechseln.',
      groqName: 'Groq', groqDesc: 'Ultraschnelle Inferenz auf LPU-Chips.', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'Schnellste Antwortzeiten', groqF3: 'Kostenlos: 14K Anfragen/Tag',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash und massive Open-Source-Modelle. Kostenlos.', ollamaF1: 'Gemini 3 Flash — Empfohlen', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'Kostenloser Plan verfügbar',
      recommended: 'Empfohlen', continue: 'Weiter',
      step2chip: 'Schritt 2 von 3', step2titleGroq: 'Geben Sie Ihren Groq API-Schlüssel ein', step2titleOllama: 'Geben Sie Ihren Ollama API-Schlüssel ein',
      step2descGroq: 'Dauert 30 Sekunden. Erstellen Sie ein kostenloses Konto.', step2descOllama: 'Erstellen Sie ein Konto auf ollama.com.',
      inst1Groq: 'Besuchen Sie <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Besuchen Sie <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Melden Sie sich mit <strong>Google</strong> oder <strong>GitHub</strong> an (kostenlos)', inst3: 'Klicken Sie auf <strong>"Create API Key"</strong> und kopieren Sie ihn', inst4: 'Fügen Sie ihn unten ein',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama API-Schlüssel hier einfügen',
      validateSave: 'Validieren & Speichern', validating: 'Validierung...', checking: 'API-Schlüssel wird überprüft...', valid: 'Schlüssel gültig! Weiter zum nächsten Schritt...', invalid: 'Ungültiger API-Schlüssel.', connError: 'Verbindungsfehler.', enterKey: 'Bitte geben Sie Ihren API-Schlüssel ein.', groqKeyWarn: 'Groq-Schlüssel beginnen mit "gsk_".',
      step3chip: 'Schritt 3 von 3', step3title: 'So funktioniert es', step3desc: 'Drei einfache Schritte auf jeder YouTube-Videoseite.',
      how1title: 'Video öffnen', how1desc: 'Gehen Sie zu einem YouTube-Video mit verfügbaren Untertiteln.',
      how2title: 'KI-Button klicken', how2desc: 'Ein schwebender Button erscheint unten rechts. Klicken Sie, um das Panel zu öffnen.',
      how3title: 'Modus wählen', how3desc: 'Wählen Sie <strong>Zusammenfassung</strong>, <strong>Kernpunkte</strong>, <strong>Detailanalyse</strong> oder <strong>Podcast</strong>.',
      goYoutube: 'Zu YouTube & Ausprobieren', tip: 'Anbieter, Modell und Sprache können jederzeit in den Einstellungen geändert werden.',
      footerPowered: 'Unterstützt von', privacyPolicy: 'Datenschutzrichtlinie', langLabel: 'Sprache',
    },
    ja: {
      title: 'YouTube AI Summarizer',
      subtitle: 'YouTubeの動画をAIで即座に要約。キーポイントと詳細分析も。',
      step1chip: 'ステップ 1/3', step1title: 'AIプロバイダーを選択', step1desc: '両方のプロバイダーは無料で始められます。設定からいつでも変更可能。',
      groqName: 'Groq', groqDesc: 'LPUチップによる超高速推論。', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: '最速の応答時間', groqF3: '無料: 1日14Kリクエスト',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flashと大規模オープンソースモデル。無料。', ollamaF1: 'Gemini 3 Flash — おすすめ', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: '無料プランあり',
      recommended: 'おすすめ', continue: '次へ',
      step2chip: 'ステップ 2/3', step2titleGroq: 'Groq APIキーを入力', step2titleOllama: 'Ollama APIキーを入力',
      step2descGroq: '30秒で完了。無料アカウントを作成してキーを生成。', step2descOllama: 'ollama.comでアカウントを作成しAPIキーを生成。',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>にアクセス',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>にアクセス',
      inst2: '<strong>Google</strong>または<strong>GitHub</strong>でサインアップ（無料）', inst3: '<strong>"Create API Key"</strong>をクリックしてコピー', inst4: '下のフィールドに貼り付け',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama APIキーをここに貼り付け',
      validateSave: '検証して保存', validating: '検証中...', checking: 'APIキーを確認中...', valid: 'APIキーが有効です！次のステップへ...', invalid: '無効なAPIキーです。', connError: '接続エラー。', enterKey: 'APIキーを入力してください。', groqKeyWarn: 'GroqのAPIキーは"gsk_"で始まります。',
      step3chip: 'ステップ 3/3', step3title: '使い方', step3desc: 'YouTube動画ページでの3つの簡単なステップ。',
      how1title: '動画を開く', how1desc: '字幕のあるYouTube動画に移動。',
      how2title: 'AIボタンをクリック', how2desc: 'ページ右下にフローティングボタンが表示されます。',
      how3title: 'モードを選択', how3desc: '<strong>要約</strong>、<strong>キーポイント</strong>、<strong>詳細分析</strong>、または<strong>ポッドキャスト</strong>を選択。',
      goYoutube: 'YouTubeで試す', tip: 'プロバイダー、モデル、言語は設定からいつでも変更可能です。',
      footerPowered: '提供元', privacyPolicy: 'プライバシーポリシー', langLabel: '言語',
    },
    ko: {
      title: 'YouTube AI Summarizer',
      subtitle: 'YouTube 동영상의 AI 요약, 핵심 포인트, 상세 분석을 즉시 받아보세요.',
      step1chip: '1단계 / 3', step1title: 'AI 제공업체 선택', step1desc: '두 제공업체 모두 무료로 시작할 수 있습니다.',
      groqName: 'Groq', groqDesc: 'LPU 칩의 초고속 추론.', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: '가장 빠른 응답 시간', groqF3: '무료: 일 14K 요청',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash 및 대규모 오픈소스 모델. 무료.', ollamaF1: 'Gemini 3 Flash — 추천', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: '무료 플랜 이용 가능',
      recommended: '추천', continue: '계속',
      step2chip: '2단계 / 3', step2titleGroq: 'Groq API 키 입력', step2titleOllama: 'Ollama API 키 입력',
      step2descGroq: '30초면 됩니다. 무료 계정을 만들고 키를 생성하세요.', step2descOllama: 'ollama.com에서 계정을 만들고 API 키를 생성하세요.',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> 방문',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a> 방문',
      inst2: '<strong>Google</strong> 또는 <strong>GitHub</strong>으로 가입 (무료)', inst3: '<strong>"Create API Key"</strong>를 클릭하고 복사', inst4: '아래 필드에 붙여넣기',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Ollama API 키를 여기에 붙여넣기',
      validateSave: '검증 및 저장', validating: '검증 중...', checking: 'API 키 확인 중...', valid: 'API 키가 유효합니다! 다음 단계로...', invalid: '유효하지 않은 API 키입니다.', connError: '연결 오류.', enterKey: 'API 키를 입력하세요.', groqKeyWarn: 'Groq API 키는 "gsk_"로 시작합니다.',
      step3chip: '3단계 / 3', step3title: '사용 방법', step3desc: 'YouTube 동영상 페이지에서 간단한 3단계.',
      how1title: '동영상 열기', how1desc: '자막이 있는 YouTube 동영상으로 이동.',
      how2title: 'AI 버튼 클릭', how2desc: '페이지 오른쪽 하단의 플로팅 버튼을 클릭하여 패널을 열기.',
      how3title: '모드 선택', how3desc: '<strong>요약</strong>, <strong>핵심 포인트</strong>, <strong>상세 분석</strong> 또는 <strong>팟캐스트</strong>를 선택.',
      goYoutube: 'YouTube에서 사용해보기', tip: '제공업체, 모델, 언어는 확장 프로그램 설정에서 언제든 변경할 수 있습니다.',
      footerPowered: '제공', privacyPolicy: '개인정보 보호정책', langLabel: '언어',
    },
    zh: {
      title: 'YouTube AI Summarizer',
      subtitle: '为任何YouTube视频获取即时AI摘要、关键要点和详细分析。',
      step1chip: '第1步 / 共3步', step1title: '选择您的AI提供商', step1desc: '两个提供商都可免费开始使用。随时可在设置中更改。',
      groqName: 'Groq', groqDesc: 'LPU芯片上的超快推理。', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: '最快的响应时间', groqF3: '免费: 每天14K请求',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash和大型开源模型。免费。', ollamaF1: 'Gemini 3 Flash — 推荐', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: '免费计划可用',
      recommended: '推荐', continue: '继续',
      step2chip: '第2步 / 共3步', step2titleGroq: '输入您的Groq API密钥', step2titleOllama: '输入您的Ollama API密钥',
      step2descGroq: '只需30秒。创建免费账户并生成密钥。', step2descOllama: '在ollama.com创建账户并生成API密钥。',
      inst1Groq: '访问 <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: '访问 <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: '使用<strong>Google</strong>或<strong>GitHub</strong>注册（免费）', inst3: '点击<strong>"Create API Key"</strong>并复制', inst4: '粘贴到下方输入框',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: '在此粘贴您的Ollama API密钥',
      validateSave: '验证并保存', validating: '验证中...', checking: '正在检查API密钥...', valid: 'API密钥有效！正在进入下一步...', invalid: '无效的API密钥。', connError: '连接错误。', enterKey: '请输入您的API密钥。', groqKeyWarn: 'Groq API密钥以"gsk_"开头。',
      step3chip: '第3步 / 共3步', step3title: '使用方法', step3desc: '在任何YouTube视频页面上的三个简单步骤。',
      how1title: '打开视频', how1desc: '前往任何有字幕的YouTube视频。',
      how2title: '点击AI按钮', how2desc: '页面右下角会出现一个浮动按钮。点击打开面板。',
      how3title: '选择模式', how3desc: '选择<strong>摘要</strong>、<strong>关键要点</strong>、<strong>详细分析</strong>或<strong>播客</strong>。',
      goYoutube: '去YouTube试试', tip: '您可以随时在扩展设置中更改提供商、模型和语言。',
      footerPowered: '技术支持', privacyPolicy: '隐私政策', langLabel: '语言',
    },
    pt: {
      title: 'YouTube AI Summarizer',
      subtitle: 'Obtenha resumos instantâneos com IA, pontos-chave e análises detalhadas de qualquer vídeo do YouTube.',
      step1chip: 'Passo 1 de 3', step1title: 'Escolha seu provedor de IA', step1desc: 'Ambos os provedores são gratuitos. Você pode trocar a qualquer momento.',
      groqName: 'Groq', groqDesc: 'Inferência ultrarrápida em chips LPU.', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'Tempos de resposta mais rápidos', groqF3: 'Grátis: 14K requisições/dia',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash e modelos massivos de código aberto. Grátis.', ollamaF1: 'Gemini 3 Flash — Recomendado', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'Plano gratuito disponível',
      recommended: 'Recomendado', continue: 'Continuar',
      step2chip: 'Passo 2 de 3', step2titleGroq: 'Digite sua chave API do Groq', step2titleOllama: 'Digite sua chave API do Ollama',
      step2descGroq: 'Leva 30 segundos. Crie uma conta gratuita e gere uma chave.', step2descOllama: 'Crie uma conta no ollama.com e gere uma chave API.',
      inst1Groq: 'Visite <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'Visite <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'Cadastre-se com <strong>Google</strong> ou <strong>GitHub</strong> (grátis)', inst3: 'Clique em <strong>"Create API Key"</strong> e copie', inst4: 'Cole no campo abaixo',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'Cole sua chave API do Ollama aqui',
      validateSave: 'Validar e Salvar', validating: 'Validando...', checking: 'Verificando sua chave API...', valid: 'Chave válida! Indo para o próximo passo...', invalid: 'Chave API inválida.', connError: 'Erro de conexão.', enterKey: 'Por favor, insira sua chave API.', groqKeyWarn: 'Chaves Groq começam com "gsk_".',
      step3chip: 'Passo 3 de 3', step3title: 'Como Funciona', step3desc: 'Três passos simples em qualquer página de vídeo do YouTube.',
      how1title: 'Abra um Vídeo', how1desc: 'Vá para qualquer vídeo do YouTube com legendas disponíveis.',
      how2title: 'Clique no Botão IA', how2desc: 'Um botão flutuante aparece no canto inferior direito.',
      how3title: 'Escolha seu Modo', how3desc: 'Escolha <strong>Resumo</strong>, <strong>Pontos-Chave</strong>, <strong>Análise Detalhada</strong> ou <strong>Podcast</strong>.',
      goYoutube: 'Ir ao YouTube e Testar', tip: 'Você pode alterar o provedor, modelo e idioma a qualquer momento nas configurações da extensão.',
      footerPowered: 'Desenvolvido por', privacyPolicy: 'Política de Privacidade', langLabel: 'Idioma',
    },
    ar: {
      title: 'YouTube AI Summarizer',
      subtitle: 'احصل على ملخصات فورية بالذكاء الاصطناعي والنقاط الرئيسية والتحليل المفصل لأي فيديو يوتيوب.',
      step1chip: 'الخطوة 1 من 3', step1title: 'اختر مزود الذكاء الاصطناعي', step1desc: 'كلا المزودين مجانيان. يمكنك التبديل في أي وقت.',
      groqName: 'Groq', groqDesc: 'استدلال فائق السرعة على شرائح LPU.', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'أسرع أوقات استجابة', groqF3: 'مجاني: 14K طلب/يوم',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash ونماذج مفتوحة المصدر. مجاني.', ollamaF1: 'Gemini 3 Flash — موصى به', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'خطة مجانية متاحة',
      recommended: 'موصى به', continue: 'متابعة',
      step2chip: 'الخطوة 2 من 3', step2titleGroq: 'أدخل مفتاح Groq API', step2titleOllama: 'أدخل مفتاح Ollama API',
      step2descGroq: 'يستغرق 30 ثانية. أنشئ حساباً مجانياً.', step2descOllama: 'أنشئ حساباً على ollama.com.',
      inst1Groq: 'زر <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
      inst1Ollama: 'زر <a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a>',
      inst2: 'سجل عبر <strong>Google</strong> أو <strong>GitHub</strong> (مجاني)', inst3: 'انقر على <strong>"Create API Key"</strong> وانسخه', inst4: 'الصقه في الحقل أدناه',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'الصق مفتاح Ollama API هنا',
      validateSave: 'تحقق وحفظ', validating: 'جارٍ التحقق...', checking: 'جارٍ فحص مفتاح API...', valid: 'المفتاح صالح! الانتقال للخطوة التالية...', invalid: 'مفتاح API غير صالح.', connError: 'خطأ في الاتصال.', enterKey: 'الرجاء إدخال مفتاح API.', groqKeyWarn: 'مفاتيح Groq تبدأ بـ "gsk_".',
      step3chip: 'الخطوة 3 من 3', step3title: 'كيف يعمل', step3desc: 'ثلاث خطوات بسيطة على أي صفحة فيديو يوتيوب.',
      how1title: 'افتح فيديو', how1desc: 'اذهب لأي فيديو يوتيوب مع ترجمات متاحة.',
      how2title: 'انقر على زر AI', how2desc: 'يظهر زر عائم في الأسفل. انقر لفتح اللوحة.',
      how3title: 'اختر الوضع', how3desc: 'اختر <strong>ملخص</strong>، <strong>نقاط رئيسية</strong>، <strong>تحليل مفصل</strong>، أو <strong>بودكاست</strong>.',
      goYoutube: 'اذهب ليوتيوب وجرب', tip: 'يمكنك تغيير المزود والنموذج واللغة في أي وقت من إعدادات الإضافة.',
      footerPowered: 'مدعوم من', privacyPolicy: 'سياسة الخصوصية', langLabel: 'اللغة',
    },
    hi: {
      title: 'YouTube AI Summarizer',
      subtitle: 'किसी भी YouTube वीडियो का तुरंत AI सारांश, मुख्य बिंदु और विस्तृत विश्लेषण प्राप्त करें।',
      step1chip: 'चरण 1 / 3', step1title: 'अपना AI प्रदाता चुनें', step1desc: 'दोनों प्रदाता मुफ़्त हैं। आप कभी भी बदल सकते हैं।',
      groqName: 'Groq', groqDesc: 'LPU चिप्स पर अल्ट्रा-फास्ट इनफ़रेंस।', groqF1: 'Llama 3.3 70B, Llama 4 Scout', groqF2: 'सबसे तेज़ प्रतिक्रिया समय', groqF3: 'मुफ़्त: 14K अनुरोध/दिन',
      ollamaName: 'Ollama Cloud', ollamaDesc: 'Gemini 3 Flash और बड़े ओपन-सोर्स मॉडल। मुफ़्त।', ollamaF1: 'Gemini 3 Flash — अनुशंसित', ollamaF2: 'DeepSeek V3.2 671B, Qwen3-Next 80B', ollamaF3: 'मुफ़्त योजना उपलब्ध',
      recommended: 'अनुशंसित', continue: 'जारी रखें',
      step2chip: 'चरण 2 / 3', step2titleGroq: 'अपनी Groq API कुंजी दर्ज करें', step2titleOllama: 'अपनी Ollama API कुंजी दर्ज करें',
      step2descGroq: '30 सेकंड लगते हैं। मुफ़्त खाता बनाएं।', step2descOllama: 'ollama.com पर खाता बनाएं।',
      inst1Groq: '<a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> पर जाएं',
      inst1Ollama: '<a href="https://ollama.com/settings/keys" target="_blank">ollama.com/settings/keys</a> पर जाएं',
      inst2: '<strong>Google</strong> या <strong>GitHub</strong> से साइन अप करें (मुफ़्त)', inst3: '<strong>"Create API Key"</strong> पर क्लिक करें और कॉपी करें', inst4: 'नीचे दिए गए फ़ील्ड में पेस्ट करें',
      placeholderGroq: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx', placeholderOllama: 'अपनी Ollama API कुंजी यहाँ पेस्ट करें',
      validateSave: 'सत्यापित करें और सहेजें', validating: 'सत्यापन...', checking: 'API कुंजी जाँच रहे हैं...', valid: 'API कुंजी मान्य है! अगले चरण पर...', invalid: 'अमान्य API कुंजी।', connError: 'कनेक्शन त्रुटि।', enterKey: 'कृपया अपनी API कुंजी दर्ज करें।', groqKeyWarn: 'Groq कुंजी "gsk_" से शुरू होती है।',
      step3chip: 'चरण 3 / 3', step3title: 'यह कैसे काम करता है', step3desc: 'किसी भी YouTube वीडियो पेज पर तीन सरल चरण।',
      how1title: 'वीडियो खोलें', how1desc: 'उपशीर्षक वाले किसी भी YouTube वीडियो पर जाएं।',
      how2title: 'AI बटन पर क्लिक करें', how2desc: 'पेज के नीचे दाईं ओर एक फ्लोटिंग बटन दिखाई देगा।',
      how3title: 'अपना मोड चुनें', how3desc: '<strong>सारांश</strong>, <strong>मुख्य बिंदु</strong>, <strong>विस्तृत विश्लेषण</strong>, या <strong>पॉडकास्ट</strong> चुनें।',
      goYoutube: 'YouTube पर जाएं और आज़माएं', tip: 'आप किसी भी समय एक्सटेंशन सेटिंग्स से प्रदाता, मॉडल और भाषा बदल सकते हैं।',
      footerPowered: 'संचालित', privacyPolicy: 'गोपनीयता नीति', langLabel: 'भाषा',
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
  const langSelect    = $('#langSelect');

  function applyTranslations() {
    const isRTL = currentLang === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

    $('#heroTitle').textContent = t('title');
    $('#heroSub').textContent = t('subtitle');

    $('#step1Chip').textContent = t('step1chip');
    $('#step1Title').textContent = t('step1title');
    $('#step1Desc').textContent = t('step1desc');

    $('#groqName').textContent = t('groqName');
    $('#groqDesc').textContent = t('groqDesc');
    $('#groqF1').textContent = t('groqF1');
    $('#groqF2').textContent = t('groqF2');
    $('#groqF3').textContent = t('groqF3');

    $('#ollamaName').textContent = t('ollamaName');
    $('#ollamaDesc').textContent = t('ollamaDesc');
    $('#ollamaF1').textContent = t('ollamaF1');
    $('#ollamaF2').textContent = t('ollamaF2');
    $('#ollamaF3').textContent = t('ollamaF3');
    $('#ollamaTag').textContent = t('recommended');

    $('#step1NextText').textContent = t('continue');

    $('#step2Chip').textContent = t('step2chip');
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
    $('#langLabel').textContent = t('langLabel');
  }

  // ── Language selector ──
  LANG_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.code;
    option.textContent = `${opt.flag} ${opt.label}`;
    if (opt.code === currentLang) option.selected = true;
    langSelect.appendChild(option);
  });

  langSelect.addEventListener('change', () => {
    currentLang = langSelect.value;
    applyTranslations();
  });

  // ── Provider selection ──
  const providerCards = $$('.provider-card');
  providerCards.forEach((card) => {
    card.addEventListener('click', () => {
      providerCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      chosenProvider = card.dataset.provider;
    });
  });

  // ── Step navigation ──
  $('#step1Next').addEventListener('click', () => {
    goToStep(2);
    updateStep2ForProvider();
  });

  function updateStep2ForProvider() {
    const step2Title = $('#step2Title');
    const step2Desc  = $('#step2Desc');
    const provLink   = $('#providerLink');
    const keyInput   = $('#apiKeyInput');

    if (chosenProvider === 'ollama') {
      step2Title.textContent = t('step2titleOllama');
      step2Desc.textContent = t('step2descOllama');
      provLink.href = 'https://ollama.com/settings/keys';
      $('#inst1Text').innerHTML = t('inst1Ollama');
      keyInput.placeholder = t('placeholderOllama');
    } else {
      step2Title.textContent = t('step2titleGroq');
      step2Desc.textContent = t('step2descGroq');
      provLink.href = 'https://console.groq.com/keys';
      $('#inst1Text').innerHTML = t('inst1Groq');
      keyInput.placeholder = t('placeholderGroq');
    }
    $('#inst2Text').innerHTML = t('inst2');
    $('#inst3Text').innerHTML = t('inst3');
    $('#inst4Text').textContent = t('inst4');
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
        const storageData = {
          provider: chosenProvider,
          onboardingComplete: true
        };
        if (chosenProvider === 'ollama') {
          storageData.ollamaApiKey = key;
        } else {
          storageData.groqApiKey = key;
        }
        await chrome.storage.local.set(storageData);

        showValidation(t('valid'), 'success');
        setTimeout(() => goToStep(3), 1200);
      } else {
        showValidation(response?.error || t('invalid'), 'error');
        resetValidateBtn();
      }
    } catch {
      showValidation(t('connError'), 'error');
      resetValidateBtn();
    }
  }

  function resetValidateBtn() {
    validateBtn.disabled = false;
    $('#validateBtnText').textContent = t('validateSave');
  }

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
    allSteps[num - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Privacy ──
  $('#privacyLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = chrome.runtime.getURL('privacy-policy.html');
    chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'));
  });

  // ── Already configured? ──
  chrome.storage.local.get(['groqApiKey', 'ollamaApiKey', 'provider', 'onboardingComplete'], (data) => {
    const hasKey = (data.provider === 'ollama' && data.ollamaApiKey) ||
                   (data.provider !== 'ollama' && data.groqApiKey);
    if (hasKey && data.onboardingComplete) goToStep(3);
  });

  function showValidation(msg, type) {
    valStatus.textContent = msg;
    valStatus.className = `validation-status ${type}`;
  }

  applyTranslations();
});
