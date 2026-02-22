/* ============================
   TextWise - Application Logic
   ============================ */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    text: '',
    results: { summary: '', analysis: '', review: '', flashcards: [], translate: '', qna: [] },
    currentTab: 'input',
    audioPlaying: false,
    flashcardIndex: 0,
    flashcardFlipped: false,
    apiKey: localStorage.getItem('tw_apiKey') || '',
    apiProvider: localStorage.getItem('tw_apiProvider') || 'openai',
    ocrLang: localStorage.getItem('tw_ocrLang') || 'eng',
    theme: localStorage.getItem('tw_theme') || 'light',
    sidebarCollapsed: localStorage.getItem('tw_sidebar') === 'collapsed',
    browserAIReady: false,
    browserAILoading: false,
    browserAIPipeline: null,
  };

  // ---- DOM refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- Init ----
  function init() {
    applyTheme(state.theme);
    if (state.sidebarCollapsed) $('#sidebar').classList.add('collapsed');
    if (state.apiKey) $('#apiKeyInput').value = '••••••••••••••••';
    $('#apiProvider').value = state.apiProvider;
    $('#ocrLang').value = state.ocrLang;
    bindEvents();
    populateVoices();
    updateAllTierBadges();
    switchTab('input');
  }

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('tw_theme', theme);
  }

  // ---- Tab Switching ----
  function switchTab(tab) {
    state.currentTab = tab;

    $$('.nav-tab[data-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));

    // Show/hide no-text warnings
    const hasText = state.text.trim().length > 0;
    const tabs = ['audiobook', 'summary', 'analyze', 'review', 'flashcards', 'translate', 'qna', 'export'];
    tabs.forEach((t) => {
      const warn = $(`#${t}NoText`);
      const container = $(`#${t}Container`);
      if (warn) warn.style.display = (!hasText && tab === t) ? 'flex' : 'none';
      if (container) container.style.display = hasText ? 'block' : (tab === t ? 'none' : container.style.display);
    });

    // Audiobook: load text display
    if (tab === 'audiobook' && hasText) {
      $('#audioTextDisplay').textContent = state.text;
    }

    // Close mobile sidebar
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebarOverlay').classList.remove('active');
  }

  // ---- Events ----
  function bindEvents() {
    // Nav tabs
    $$('.nav-tab[data-tab]').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    // Goto links in warnings
    $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); switchTab(a.dataset.goto); }));

    // Sidebar toggle
    $('#sidebarToggle').addEventListener('click', () => {
      const sb = $('#sidebar');
      sb.classList.toggle('collapsed');
      state.sidebarCollapsed = sb.classList.contains('collapsed');
      localStorage.setItem('tw_sidebar', state.sidebarCollapsed ? 'collapsed' : 'expanded');
    });

    // Mobile
    $('#mobileMenuBtn').addEventListener('click', () => {
      $('#sidebar').classList.add('mobile-open');
      $('#sidebarOverlay').classList.add('active');
    });
    $('#sidebarOverlay').addEventListener('click', () => {
      $('#sidebar').classList.remove('mobile-open');
      $('#sidebarOverlay').classList.remove('active');
    });

    // Theme
    $('#themeToggle').addEventListener('click', () => applyTheme(state.theme === 'light' ? 'dark' : 'light'));

    // Settings
    $('#settingsBtn').addEventListener('click', () => $('#settingsModal').classList.add('active'));
    $('#settingsClose').addEventListener('click', () => $('#settingsModal').classList.remove('active'));
    $('#settingsModal').addEventListener('click', (e) => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.remove('active'); });

    $('#saveApiKey').addEventListener('click', saveApiKey);
    $('#apiProvider').addEventListener('change', (e) => {
      state.apiProvider = e.target.value;
      localStorage.setItem('tw_apiProvider', state.apiProvider);
    });
    $('#ocrLang').addEventListener('change', (e) => {
      state.ocrLang = e.target.value;
      localStorage.setItem('tw_ocrLang', state.ocrLang);
    });

    // Browser AI download
    $('#downloadBrowserAI').addEventListener('click', initBrowserAI);

    // Input methods
    $('#pasteBtn').addEventListener('click', showTextArea);
    $('#cameraBtn').addEventListener('click', openCamera);
    $('#uploadBtn').addEventListener('click', () => $('#imageInput').click());
    $('#fileUploadBtn').addEventListener('click', () => $('#fileInput').click());
    $('#imageInput').addEventListener('change', handleImageUpload);
    $('#fileInput').addEventListener('change', handleFileUpload);
    $('#clearTextBtn').addEventListener('click', clearText);

    // Textarea input
    $('#mainTextarea').addEventListener('input', (e) => {
      state.text = e.target.value;
      updateCharCount();
    });

    // Camera
    $('#cameraClose').addEventListener('click', closeCamera);
    $('#cameraModal').addEventListener('click', (e) => { if (e.target === $('#cameraModal')) closeCamera(); });
    $('#cameraShutterBtn').addEventListener('click', capturePhoto);
    $('#cameraSwitchBtn').addEventListener('click', switchCamera);

    // Audiobook
    $('#audioPlayBtn').addEventListener('click', toggleAudioPlayback);
    $('#audioStop').addEventListener('click', stopAudio);
    $('#audioRewind').addEventListener('click', rewindAudio);
    $('#speedRange').addEventListener('input', (e) => { $('#speedValue').textContent = e.target.value + 'x'; });
    $('#pitchRange').addEventListener('input', (e) => { $('#pitchValue').textContent = e.target.value; });

    // Feature buttons
    $('#summarizeBtn').addEventListener('click', handleSummarize);
    $('#analyzeBtn').addEventListener('click', handleAnalyze);
    $('#reviewBtn').addEventListener('click', handleReview);
    $('#flashcardsBtn').addEventListener('click', handleFlashcards);
    $('#translateBtn').addEventListener('click', handleTranslate);
    $('#qnaBtn').addEventListener('click', handleQnA);
    $('#qnaInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleQnA(); });

    // Pills
    $$('.option-pills').forEach((group) => {
      group.querySelectorAll('.pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          group.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
        });
      });
    });

    // Flashcard navigation
    $('#fcPrev').addEventListener('click', () => navigateFlashcard(-1));
    $('#fcNext').addEventListener('click', () => navigateFlashcard(1));
    $('#flashcard').addEventListener('click', flipFlashcard);

    // Export
    $$('.export-card').forEach((card) => card.addEventListener('click', () => handleExport(card.dataset.format)));

    // Voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  // ---- API Key ----
  function saveApiKey() {
    const key = $('#apiKeyInput').value.trim();
    if (!key || key === '••••••••••••••••') {
      showToast('Please enter a valid API key', 'warning');
      return;
    }
    state.apiKey = key;
    localStorage.setItem('tw_apiKey', key);
    $('#apiKeyInput').value = '••••••••••••••••';
    $('#apiStatus').textContent = 'API key saved successfully';
    $('#apiStatus').className = 'api-status success';
    showToast('API key saved', 'success');
    updateAllTierBadges();
  }

  // ---- Text Input ----
  function showTextArea() {
    $('#textInputArea').style.display = 'block';
    $('#inputSourceLabel').textContent = 'Your Text';
    $('#mainTextarea').focus();
    updateCharCount();
  }

  function clearText() {
    state.text = '';
    state.results = { summary: '', analysis: '', review: '', flashcards: [], translate: '', qna: [] };
    $('#mainTextarea').value = '';
    updateCharCount();
    showToast('Text cleared', 'info');
  }

  function loadText(text, source) {
    state.text = text;
    $('#mainTextarea').value = text;
    $('#textInputArea').style.display = 'block';
    $('#inputSourceLabel').textContent = source || 'Your Text';
    updateCharCount();
    showToast(`Text loaded from ${source || 'input'}`, 'success');
  }

  function updateCharCount() {
    const len = state.text.length;
    const words = state.text.trim() ? state.text.trim().split(/\s+/).length : 0;
    $('#charCount').textContent = `${words} words, ${len} chars`;
  }

  // ---- OCR (Tesseract.js) ----
  async function processImageOCR(imageSource) {
    const progress = $('#ocrProgress');
    const fill = $('#ocrProgressFill');
    const text = $('#ocrProgressText');
    progress.style.display = 'flex';
    $('#textInputArea').style.display = 'block';
    fill.style.width = '0%';

    try {
      text.textContent = 'Initializing OCR...';
      fill.style.width = '10%';

      const result = await Tesseract.recognize(imageSource, state.ocrLang, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            fill.style.width = `${10 + pct * 0.85}%`;
            text.textContent = `Recognizing text... ${pct}%`;
          }
        },
      });

      fill.style.width = '100%';
      text.textContent = 'Done!';
      const extracted = result.data.text.trim();
      if (extracted) {
        loadText(extracted, 'Image (OCR)');
      } else {
        showToast('No text detected in image. Try a clearer photo.', 'warning');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      showToast('OCR failed. Please try again.', 'error');
    }

    setTimeout(() => { progress.style.display = 'none'; }, 1500);
  }

  // ---- Camera ----
  let cameraStream = null;
  let facingMode = 'environment';

  async function openCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      $('#cameraFeed').srcObject = cameraStream;
      $('#cameraModal').classList.add('active');
    } catch (err) {
      console.error('Camera error:', err);
      showToast('Could not access camera. Please allow camera permissions.', 'error');
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    $('#cameraModal').classList.remove('active');
  }

  async function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      $('#cameraFeed').srcObject = cameraStream;
    } catch (err) {
      showToast('Could not switch camera', 'error');
    }
  }

  function capturePhoto() {
    const video = $('#cameraFeed');
    const canvas = $('#cameraCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    closeCamera();
    const dataUrl = canvas.toDataURL('image/png');
    processImageOCR(dataUrl);
  }

  // ---- Image Upload ----
  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processImageOCR(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ---- File Upload ----
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadText(ev.target.result, `File (${file.name})`);
    reader.readAsText(file);
    e.target.value = '';
  }

  // ---- AI Tier System ----

  // Returns 'api', 'browser', or 'local' depending on what's available
  function getAITier(feature) {
    if (state.apiKey) return 'api';
    if (state.browserAIReady) return 'browser';
    // Translate and Q&A have no local fallback
    if (feature === 'translate' || feature === 'qna') return 'unavailable';
    return 'local';
  }

  function getTierLabel(tier) {
    const labels = {
      api: state.apiProvider === 'openai' ? 'API (GPT-4o)' : 'API (Claude)',
      browser: 'Browser AI',
      local: 'Local',
      unavailable: 'Requires AI',
    };
    return labels[tier] || tier;
  }

  function updateTierBadge(elementId, feature) {
    const badge = $(elementId);
    if (!badge) return;
    const tier = getAITier(feature);
    badge.className = `ai-tier-badge tier-${tier}`;
    badge.textContent = getTierLabel(tier);
  }

  function updateAllTierBadges() {
    updateTierBadge('#summaryTierBadge', 'summary');
    updateTierBadge('#analyzeTierBadge', 'analyze');
    updateTierBadge('#reviewTierBadge', 'review');
    updateTierBadge('#flashcardsTierBadge', 'flashcards');
    updateTierBadge('#translateTierBadge', 'translate');
    updateTierBadge('#qnaTierBadge', 'qna');
  }

  // ---- Browser AI (Transformers.js) ----

  async function initBrowserAI() {
    if (state.browserAIReady || state.browserAILoading) return;
    state.browserAILoading = true;

    const indicator = $('#browserAIIndicator');
    const statusText = $('#browserAIStatusText');
    const progressEl = $('#browserAIProgress');
    const progressFill = $('#browserAIProgressFill');
    const progressText = $('#browserAIProgressText');
    const btn = $('#downloadBrowserAI');

    indicator.className = 'browser-ai-indicator loading';
    statusText.textContent = 'Loading model...';
    progressEl.style.display = 'block';
    btn.disabled = true;
    btn.textContent = 'Downloading...';

    try {
      // Dynamically import Transformers.js (loaded via CDN as module)
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');

      state.browserAIPipeline = await pipeline('text-generation', 'onnx-community/Phi-3.5-mini-instruct-onnx-web', {
        dtype: 'q4',
        device: 'webgpu' in navigator.gpu ? 'webgpu' : 'wasm',
        progress_callback: (progress) => {
          if (progress.status === 'progress' && progress.total) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = `Downloading... ${pct}%`;
          } else if (progress.status === 'ready') {
            progressFill.style.width = '100%';
            progressText.textContent = 'Ready!';
          }
        },
      });

      state.browserAIReady = true;
      state.browserAILoading = false;
      indicator.className = 'browser-ai-indicator ready';
      statusText.textContent = 'Model loaded and ready';
      btn.textContent = 'Model Ready';
      progressEl.style.display = 'none';
      updateAllTierBadges();
      showToast('Browser AI model loaded successfully', 'success');
    } catch (err) {
      console.error('Browser AI load error:', err);
      state.browserAILoading = false;
      indicator.className = 'browser-ai-indicator error';
      statusText.textContent = 'Failed to load model';
      progressText.textContent = err.message;
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Retry Download`;
      showToast('Failed to load Browser AI: ' + err.message, 'error');
    }
  }

  async function callBrowserAI(prompt, systemPrompt) {
    if (!state.browserAIPipeline) throw new Error('Browser AI not loaded');

    const messages = [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant. Be concise.' },
      { role: 'user', content: prompt },
    ];

    const result = await state.browserAIPipeline(messages, {
      max_new_tokens: 1024,
      temperature: 0.7,
      do_sample: true,
    });

    // Extract the assistant response
    const output = result[0].generated_text;
    if (Array.isArray(output)) {
      const assistantMsg = output.find((m) => m.role === 'assistant');
      return assistantMsg ? assistantMsg.content : output[output.length - 1].content;
    }
    return typeof output === 'string' ? output : JSON.stringify(output);
  }

  // ---- Local Fallback Functions ----

  function localSummarize(text, length) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= 2) return text;

    // Score sentences by word frequency
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const freq = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });

    // Remove very common words
    const stopWords = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'with', 'from', 'into', 'about', 'which', 'when', 'where', 'what', 'there', 'their', 'they', 'them', 'then', 'than', 'other', 'some', 'such', 'only', 'also', 'more', 'most', 'very', 'just', 'not']);
    Object.keys(freq).forEach((w) => { if (stopWords.has(w)) delete freq[w]; });

    const scored = sentences.map((s, i) => {
      const sWords = s.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      const score = sWords.reduce((sum, w) => sum + (freq[w] || 0), 0) / Math.max(sWords.length, 1);
      // Boost first and second sentences
      const posBoost = i === 0 ? 1.5 : i === 1 ? 1.2 : 1;
      return { sentence: s.trim(), score: score * posBoost, index: i };
    });

    const counts = { brief: 2, standard: 4, detailed: 6, bullet: 6 };
    const n = Math.min(counts[length] || 4, sentences.length);
    const top = scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.index - b.index);

    if (length === 'bullet') {
      return top.map((s) => `- ${s.sentence}`).join('\n');
    }
    return top.map((s) => s.sentence).join(' ');
  }

  function localAnalyze(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const lowerWords = words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);

    // Top keywords (excluding stop words)
    const stopWords = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'with', 'from', 'into', 'about', 'which', 'when', 'where', 'what', 'there', 'their', 'they', 'them', 'then', 'than', 'other', 'some', 'such', 'only', 'also', 'more', 'most', 'very', 'just', 'not', 'but', 'its', 'it']);
    const freq = {};
    lowerWords.forEach((w) => { if (!stopWords.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1; });
    const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Vocabulary richness
    const uniqueWords = new Set(lowerWords);
    const richness = (uniqueWords.size / Math.max(lowerWords.length, 1) * 100).toFixed(1);

    // Average sentence length
    const avgSentLen = (words.length / Math.max(sentences.length, 1)).toFixed(1);

    // Longest / shortest sentence
    const sentLengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const longest = Math.max(...sentLengths);
    const shortest = Math.min(...sentLengths);

    let result = '## Text Statistics (Extended)\n\n';
    result += `- **Average Sentence Length:** ${avgSentLen} words\n`;
    result += `- **Longest Sentence:** ${longest} words\n`;
    result += `- **Shortest Sentence:** ${shortest} words\n`;
    result += `- **Unique Words:** ${uniqueWords.size.toLocaleString()}\n`;
    result += `- **Vocabulary Richness:** ${richness}% unique\n\n`;
    result += '## Top Keywords\n\n';
    topKeywords.forEach(([word, count]) => { result += `- **${word}** (${count}x)\n`; });
    result += '\n*For deeper theme, tone, and style analysis, enable Browser AI or add an API key in Settings.*';

    return result;
  }

  function localReview(text) {
    const issues = [];
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Double words: "the the", "is is", etc.
    const doubleWordRegex = /\b(\w+)\s+\1\b/gi;
    let match;
    while ((match = doubleWordRegex.exec(text)) !== null) {
      issues.push({ type: 'Grammar', issue: `Repeated word: "${match[1]} ${match[1]}"`, suggestion: `Remove the duplicate "${match[1]}"` });
    }

    // Missing capitalization at sentence start
    const rawSentences = text.split(/(?<=[.!?])\s+/);
    rawSentences.forEach((s) => {
      const trimmed = s.trim();
      if (trimmed && /^[a-z]/.test(trimmed)) {
        const preview = trimmed.substring(0, 40) + (trimmed.length > 40 ? '...' : '');
        issues.push({ type: 'Capitalization', issue: `Sentence starts with lowercase: "${preview}"`, suggestion: 'Capitalize the first letter' });
      }
    });

    // Very long sentences (>40 words)
    sentences.forEach((s) => {
      const wordCount = s.trim().split(/\s+/).length;
      if (wordCount > 40) {
        const preview = s.trim().substring(0, 50) + '...';
        issues.push({ type: 'Readability', issue: `Very long sentence (${wordCount} words): "${preview}"`, suggestion: 'Consider breaking into shorter sentences' });
      }
    });

    // Common misspellings
    const misspellings = {
      'teh': 'the', 'recieve': 'receive', 'occured': 'occurred', 'definately': 'definitely',
      'seperate': 'separate', 'occurance': 'occurrence', 'accomodate': 'accommodate',
      'apparantly': 'apparently', 'calender': 'calendar', 'commitee': 'committee',
      'concensus': 'consensus', 'embarass': 'embarrass', 'enviroment': 'environment',
      'goverment': 'government', 'independant': 'independent', 'neccessary': 'necessary',
      'occurence': 'occurrence', 'parliment': 'parliament', 'preceeding': 'preceding',
      'recomend': 'recommend', 'refrence': 'reference', 'wierd': 'weird',
      'alot': 'a lot', 'untill': 'until', 'wich': 'which', 'becuase': 'because',
    };

    const textWords = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    textWords.forEach((w) => {
      if (misspellings[w]) {
        issues.push({ type: 'Spelling', issue: `"${w}" appears to be misspelled`, suggestion: `Did you mean "${misspellings[w]}"?` });
      }
    });

    // Multiple spaces
    if (/  +/.test(text)) {
      issues.push({ type: 'Formatting', issue: 'Multiple consecutive spaces found', suggestion: 'Use single spaces between words' });
    }

    // Build result
    let result = '## Writing Review (Local)\n\n';
    if (issues.length === 0) {
      result += 'No obvious issues found. The text looks clean!\n\n';
    } else {
      result += `Found **${issues.length}** potential issue${issues.length > 1 ? 's' : ''}:\n\n`;
      issues.forEach((issue, i) => {
        result += `### ${i + 1}. ${issue.type}\n`;
        result += `- **Issue:** ${issue.issue}\n`;
        result += `- **Suggestion:** ${issue.suggestion}\n\n`;
      });
    }
    result += '*For comprehensive grammar, style, and tone review, enable Browser AI or add an API key in Settings.*';
    return result;
  }

  function localFlashcards(text, count) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length === 0) return [];

    // Find sentences with key terms (capitalized words, terms in quotes, or longer important words)
    const stopWords = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'with', 'from', 'into', 'about', 'which', 'when', 'where', 'what', 'there', 'their', 'they', 'them', 'then', 'than', 'other', 'some', 'such', 'only', 'also', 'more', 'most', 'very', 'just', 'not', 'but']);

    // Word frequency
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq = {};
    words.forEach((w) => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });

    // Score each sentence for card-worthiness
    const scored = sentences.map((s) => {
      const trimmed = s.trim();
      const sWords = trimmed.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      const keyTerms = sWords.filter((w) => freq[w] && freq[w] >= 2 && !stopWords.has(w));
      return { sentence: trimmed, keyTerms, score: keyTerms.length };
    }).filter((s) => s.keyTerms.length > 0 && s.sentence.split(/\s+/).length >= 5);

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, parseInt(count));

    return selected.map((item) => {
      // Pick the best key term to blank out
      const term = item.keyTerms.reduce((best, w) => (freq[w] > freq[best] ? w : best), item.keyTerms[0]);
      // Create fill-in-the-blank
      const blanked = item.sentence.replace(new RegExp(`\\b${term}\\b`, 'i'), '_____');
      return {
        question: `Fill in the blank: ${blanked}`,
        answer: term.charAt(0).toUpperCase() + term.slice(1),
      };
    });
  }

  // ---- AI API Calls (Tier Router) ----

  async function callAPIProvider(prompt, systemPrompt) {
    if (state.apiProvider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${res.status}`);
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': state.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt || 'You are a helpful assistant.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${res.status}`);
      }

      const data = await res.json();
      return data.content[0].text;
    }
  }

  // Tier-aware AI call: API key > Browser AI > throws
  async function callAI(prompt, systemPrompt) {
    if (state.apiKey) {
      return callAPIProvider(prompt, systemPrompt);
    }
    if (state.browserAIReady) {
      return callBrowserAI(prompt, systemPrompt);
    }
    throw new Error('No AI available');
  }

  function showLoading(text) {
    $('#loadingText').textContent = text || 'Processing...';
    $('#loadingOverlay').style.display = 'flex';
  }

  function hideLoading() {
    $('#loadingOverlay').style.display = 'none';
  }

  function renderResult(containerId, content, title) {
    const container = $(containerId);
    const html = typeof marked !== 'undefined' ? marked.parse(content) : content.replace(/\n/g, '<br>');
    container.innerHTML = `
      <div class="result-header">
        <h4>${title || 'Result'}</h4>
        <button class="btn-secondary copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(content).replace(/</g, '\\u003c')}).then(()=>window.__toast('Copied!','success'))">Copy</button>
      </div>
      <div class="result-content">${html}</div>
    `;
  }

  // Expose toast for inline handlers
  window.__toast = showToast;

  // ---- Summarize ----
  async function handleSummarize() {
    if (!state.text.trim()) return;
    const length = $('#panel-summary .pill.active')?.dataset.length || 'standard';
    const tier = getAITier('summary');

    if (tier === 'local') {
      const result = localSummarize(state.text, length);
      state.results.summary = result;
      renderResult('#summaryResult', result, 'Summary (Local)');
      showToast('Summary generated (local)', 'success');
      return;
    }

    const prompts = {
      brief: 'Provide a very brief 2-3 sentence summary of the following text.',
      standard: 'Provide a clear, well-structured summary of the following text in about one paragraph.',
      detailed: 'Provide a detailed, comprehensive summary of the following text, covering all key points and important details.',
      bullet: 'Summarize the following text as a clear, organized list of bullet points covering all main ideas.',
    };
    showLoading('Generating summary...');
    try {
      const result = await callAI(
        `${prompts[length]}\n\nText:\n${state.text}`,
        'You are an expert at summarizing text clearly and accurately. Use markdown formatting for your response.'
      );
      state.results.summary = result;
      renderResult('#summaryResult', result, `Summary (${getTierLabel(tier)})`);
      showToast('Summary generated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    hideLoading();
  }

  // ---- Analyze ----
  async function handleAnalyze() {
    if (!state.text.trim()) return;
    // Local stats (always computed)
    const text = state.text;
    const words = text.trim().split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const readTime = Math.max(1, Math.ceil(words.length / 230));

    // Flesch-Kincaid approximation
    const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const fk = 206.835 - 1.015 * (words.length / Math.max(sentences.length, 1)) - 84.6 * (syllables / Math.max(words.length, 1));
    let level = 'College';
    if (fk >= 90) level = 'Grade 5';
    else if (fk >= 80) level = 'Grade 6';
    else if (fk >= 70) level = 'Grade 7';
    else if (fk >= 60) level = 'Grade 8-9';
    else if (fk >= 50) level = 'Grade 10-12';
    else if (fk >= 30) level = 'College';
    else level = 'Graduate';

    $('#statWords').textContent = words.length.toLocaleString();
    $('#statChars').textContent = text.length.toLocaleString();
    $('#statSentences').textContent = sentences.length.toLocaleString();
    $('#statParagraphs').textContent = paragraphs.length.toLocaleString();
    $('#statReadTime').textContent = readTime + 'm';
    $('#statReadability').textContent = level;
    $('#statsGrid').style.display = 'grid';

    const tier = getAITier('analyze');

    if (tier === 'local') {
      const result = localAnalyze(text);
      state.results.analysis = result;
      renderResult('#analyzeResult', result, 'Analysis (Local)');
      showToast('Analysis complete (local)', 'success');
      return;
    }

    // AI analysis
    showLoading('Analyzing text...');
    try {
      const result = await callAI(
        `Perform a thorough analysis of the following text. Include:
1. **Theme & Subject** - Main themes and subject matter
2. **Tone & Style** - Writing tone, style, and voice
3. **Structure** - How the text is organized
4. **Key Arguments/Points** - Main ideas presented
5. **Strengths** - What the text does well
6. **Target Audience** - Who this text is written for
7. **Notable Vocabulary** - Important or interesting word choices

Text:
${state.text}`,
        'You are a literary and text analysis expert. Provide thorough, insightful analysis using markdown formatting.'
      );
      state.results.analysis = result;
      renderResult('#analyzeResult', result, `AI Analysis (${getTierLabel(tier)})`);
      showToast('Analysis complete', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    hideLoading();
  }

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  // ---- Review ----
  async function handleReview() {
    if (!state.text.trim()) return;
    const mode = $('#panel-review .pill.active')?.dataset.mode || 'full';
    const tier = getAITier('review');

    if (tier === 'local') {
      const result = localReview(state.text);
      state.results.review = result;
      renderResult('#reviewResult', result, 'Writing Review (Local)');
      showToast('Review complete (local)', 'success');
      return;
    }

    const prompts = {
      full: `Provide a comprehensive writing review of the following text. Cover:
1. **Grammar & Spelling** - Errors and corrections
2. **Style & Tone** - Consistency and appropriateness
3. **Clarity** - How clear and readable the writing is
4. **Structure** - Organization and flow
5. **Suggestions** - Specific improvements
6. **Revised Version** - A polished version of key passages (if needed)`,
      grammar: 'Review the following text for grammar, spelling, and punctuation errors. List each error with the correction and a brief explanation.',
      style: 'Analyze the writing style and tone of the following text. Discuss consistency, voice, formality level, and suggest style improvements.',
      clarity: 'Evaluate the clarity and readability of the following text. Identify confusing passages, suggest simpler alternatives, and rate the overall readability.',
    };

    showLoading('Reviewing text...');
    try {
      const result = await callAI(
        `${prompts[mode]}\n\nText:\n${state.text}`,
        'You are a professional editor and writing coach. Provide constructive, detailed feedback using markdown formatting.'
      );
      state.results.review = result;
      renderResult('#reviewResult', result, `Writing Review (${getTierLabel(tier)})`);
      showToast('Review complete', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    hideLoading();
  }

  // ---- Flashcards ----
  async function handleFlashcards() {
    if (!state.text.trim()) return;
    const count = $('#panel-flashcards .pill.active')?.dataset.count || '10';
    const tier = getAITier('flashcards');

    if (tier === 'local') {
      const cards = localFlashcards(state.text, count);
      if (cards.length === 0) {
        showToast('Could not generate flashcards from this text. Try longer text with more detail.', 'warning');
        return;
      }
      state.results.flashcards = cards;
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      renderFlashcard();
      $('#flashcardsDeck').style.display = 'block';
      $('#flashcardsResult').style.display = 'none';
      showToast(`${cards.length} flashcards created (local)`, 'success');
      return;
    }

    showLoading('Generating flashcards...');
    try {
      const result = await callAI(
        `Create exactly ${count} study flashcards from the following text. Each flashcard should have a question and a concise answer.

Return them as a JSON array with objects containing "question" and "answer" fields. Return ONLY the JSON array, no other text.

Text:
${state.text}`,
        'You are an expert educator who creates effective study materials. Generate clear, educational flashcards that help students learn key concepts from the text.'
      );

      // Parse JSON from response
      let cards;
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        cards = JSON.parse(jsonMatch ? jsonMatch[0] : result);
      } catch {
        showToast('Failed to parse flashcards. Retrying...', 'warning');
        hideLoading();
        return;
      }

      state.results.flashcards = cards;
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      renderFlashcard();
      $('#flashcardsDeck').style.display = 'block';
      $('#flashcardsResult').style.display = 'none';
      showToast(`${cards.length} flashcards created`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    hideLoading();
  }

  function renderFlashcard() {
    const cards = state.results.flashcards;
    if (!cards.length) return;
    const card = cards[state.flashcardIndex];
    $('#fcQuestion').textContent = card.question;
    $('#fcAnswer').textContent = card.answer;
    $('#fcCounter').textContent = `${state.flashcardIndex + 1} / ${cards.length}`;
    $('#flashcardInner').classList.toggle('flipped', state.flashcardFlipped);
  }

  function navigateFlashcard(dir) {
    const cards = state.results.flashcards;
    if (!cards.length) return;
    state.flashcardIndex = (state.flashcardIndex + dir + cards.length) % cards.length;
    state.flashcardFlipped = false;
    renderFlashcard();
  }

  function flipFlashcard() {
    state.flashcardFlipped = !state.flashcardFlipped;
    $('#flashcardInner').classList.toggle('flipped', state.flashcardFlipped);
  }

  // ---- Translate ----
  async function handleTranslate() {
    if (!state.text.trim()) return;
    const lang = $('#targetLang').value;

    showLoading(`Translating to ${lang}...`);
    try {
      const result = await callAI(
        `Translate the following text to ${lang}. Preserve the original formatting and tone as much as possible. Return only the translated text.

Text:
${state.text}`,
        `You are a professional translator specializing in ${lang}. Produce natural, accurate translations.`
      );
      state.results.translate = result;
      renderResult('#translateResult', result, `Translation (${lang})`);
      showToast('Translation complete', 'success');
    } catch (err) {
      if (err.message !== 'No API key') showToast(err.message, 'error');
    }
    hideLoading();
  }

  // ---- Q&A ----
  async function handleQnA() {
    const question = $('#qnaInput').value.trim();
    if (!question || !state.text.trim()) return;

    $('#qnaInput').value = '';
    const historyEl = $('#qnaHistory');
    // Remove placeholder
    const placeholder = historyEl.querySelector('.result-placeholder');
    if (placeholder) placeholder.remove();

    // Add question immediately
    const item = document.createElement('div');
    item.className = 'qna-item';
    item.innerHTML = `<div class="qna-question">Q: ${escapeHtml(question)}</div><div class="qna-answer"><em>Thinking...</em></div>`;
    historyEl.prepend(item);

    try {
      const answer = await callAI(
        `Based on the following text, answer this question: "${question}"

If the answer cannot be found in the text, say so clearly.

Text:
${state.text}`,
        'You are a helpful assistant that answers questions based on provided text. Be accurate and concise. Use markdown formatting where helpful.'
      );

      const html = typeof marked !== 'undefined' ? marked.parse(answer) : answer.replace(/\n/g, '<br>');
      item.querySelector('.qna-answer').innerHTML = html;
      state.results.qna.push({ question, answer });
    } catch (err) {
      item.querySelector('.qna-answer').innerHTML = `<em style="color:var(--error)">${err.message === 'No API key' ? 'Please set your API key in Settings.' : err.message}</em>`;
    }
  }

  // ---- Audiobook (Web Speech API) ----
  let utterance = null;
  let audioInterval = null;
  let audioStartTime = 0;
  let audioPausedAt = 0;

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    const select = $('#voiceSelect');
    select.innerHTML = '';
    const preferred = voices.filter((v) => v.lang.startsWith('en'));
    const others = voices.filter((v) => !v.lang.startsWith('en'));

    [...preferred, ...others].forEach((voice, i) => {
      const opt = document.createElement('option');
      opt.value = i < preferred.length ? preferred.indexOf(voice) : preferred.length + others.indexOf(voice);
      opt.textContent = `${voice.name} (${voice.lang})`;
      opt.dataset.idx = voices.indexOf(voice);
      if (voice.default) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function toggleAudioPlayback() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      state.audioPlaying = false;
      $('.play-icon').style.display = '';
      $('.pause-icon').style.display = 'none';
      clearInterval(audioInterval);
      return;
    }

    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      state.audioPlaying = true;
      $('.play-icon').style.display = 'none';
      $('.pause-icon').style.display = '';
      startAudioTimer();
      return;
    }

    // Start new
    if (!state.text.trim()) return;

    utterance = new SpeechSynthesisUtterance(state.text);
    const voices = speechSynthesis.getVoices();
    const selectedOpt = $('#voiceSelect').selectedOptions[0];
    if (selectedOpt) utterance.voice = voices[parseInt(selectedOpt.dataset.idx)];
    utterance.rate = parseFloat($('#speedRange').value);
    utterance.pitch = parseFloat($('#pitchRange').value);

    utterance.onend = () => {
      state.audioPlaying = false;
      $('.play-icon').style.display = '';
      $('.pause-icon').style.display = 'none';
      clearInterval(audioInterval);
      $('#audioProgressFill').style.width = '100%';
    };

    utterance.onerror = () => {
      state.audioPlaying = false;
      $('.play-icon').style.display = '';
      $('.pause-icon').style.display = 'none';
      clearInterval(audioInterval);
    };

    speechSynthesis.speak(utterance);
    state.audioPlaying = true;
    audioStartTime = Date.now();
    $('.play-icon').style.display = 'none';
    $('.pause-icon').style.display = '';

    // Estimate total time
    const wordsPerMin = 150 * parseFloat($('#speedRange').value);
    const wordCount = state.text.trim().split(/\s+/).length;
    const totalSeconds = Math.ceil((wordCount / wordsPerMin) * 60);

    startAudioTimer(totalSeconds);
  }

  function startAudioTimer(totalSeconds) {
    const total = totalSeconds || 60;
    audioInterval = setInterval(() => {
      if (!speechSynthesis.speaking) {
        clearInterval(audioInterval);
        return;
      }
      const elapsed = (Date.now() - audioStartTime) / 1000;
      const pct = Math.min(100, (elapsed / total) * 100);
      $('#audioProgressFill').style.width = pct + '%';
      $('#audioCurrentPos').textContent = formatTime(elapsed);
      $('#audioTotalTime').textContent = '~' + formatTime(total);
    }, 250);
  }

  function stopAudio() {
    speechSynthesis.cancel();
    state.audioPlaying = false;
    $('.play-icon').style.display = '';
    $('.pause-icon').style.display = 'none';
    clearInterval(audioInterval);
    $('#audioProgressFill').style.width = '0%';
    $('#audioCurrentPos').textContent = '--:--';
  }

  function rewindAudio() {
    // Web Speech API doesn't support seeking; restart
    if (speechSynthesis.speaking || speechSynthesis.paused) {
      stopAudio();
      toggleAudioPlayback();
    }
  }

  function formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ---- Export ----
  function handleExport(format) {
    if (!state.text.trim()) {
      showToast('No text to export', 'warning');
      return;
    }

    let content, filename, mime;

    switch (format) {
      case 'txt':
        content = buildExportText();
        filename = 'textwise-export.txt';
        mime = 'text/plain';
        break;
      case 'md':
        content = buildExportMarkdown();
        filename = 'textwise-export.md';
        mime = 'text/markdown';
        break;
      case 'html':
        content = buildExportHTML();
        filename = 'textwise-export.html';
        mime = 'text/html';
        break;
      case 'json':
        content = JSON.stringify({ text: state.text, results: state.results, exportedAt: new Date().toISOString() }, null, 2);
        filename = 'textwise-export.json';
        mime = 'application/json';
        break;
    }

    downloadFile(content, filename, mime);
    showToast(`Exported as ${format.toUpperCase()}`, 'success');
  }

  function buildExportText() {
    let out = 'TEXTWISE EXPORT\n' + '='.repeat(40) + '\n\n';
    out += 'ORIGINAL TEXT\n' + '-'.repeat(20) + '\n' + state.text + '\n\n';
    if (state.results.summary) out += 'SUMMARY\n' + '-'.repeat(20) + '\n' + state.results.summary + '\n\n';
    if (state.results.analysis) out += 'ANALYSIS\n' + '-'.repeat(20) + '\n' + state.results.analysis + '\n\n';
    if (state.results.review) out += 'REVIEW\n' + '-'.repeat(20) + '\n' + state.results.review + '\n\n';
    if (state.results.translate) out += 'TRANSLATION\n' + '-'.repeat(20) + '\n' + state.results.translate + '\n\n';
    if (state.results.flashcards.length) {
      out += 'FLASHCARDS\n' + '-'.repeat(20) + '\n';
      state.results.flashcards.forEach((c, i) => { out += `${i + 1}. Q: ${c.question}\n   A: ${c.answer}\n\n`; });
    }
    if (state.results.qna.length) {
      out += 'Q&A\n' + '-'.repeat(20) + '\n';
      state.results.qna.forEach((qa) => { out += `Q: ${qa.question}\nA: ${qa.answer}\n\n`; });
    }
    return out;
  }

  function buildExportMarkdown() {
    let out = '# TextWise Export\n\n';
    out += '## Original Text\n\n' + state.text + '\n\n';
    if (state.results.summary) out += '## Summary\n\n' + state.results.summary + '\n\n';
    if (state.results.analysis) out += '## Analysis\n\n' + state.results.analysis + '\n\n';
    if (state.results.review) out += '## Review\n\n' + state.results.review + '\n\n';
    if (state.results.translate) out += '## Translation\n\n' + state.results.translate + '\n\n';
    if (state.results.flashcards.length) {
      out += '## Flashcards\n\n';
      state.results.flashcards.forEach((c, i) => { out += `### Card ${i + 1}\n\n**Q:** ${c.question}\n\n**A:** ${c.answer}\n\n`; });
    }
    if (state.results.qna.length) {
      out += '## Q&A\n\n';
      state.results.qna.forEach((qa) => { out += `**Q:** ${qa.question}\n\n**A:** ${qa.answer}\n\n---\n\n`; });
    }
    return out;
  }

  function buildExportHTML() {
    const md = buildExportMarkdown();
    const body = typeof marked !== 'undefined' ? marked.parse(md) : md.replace(/\n/g, '<br>');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TextWise Export</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1d23;line-height:1.6}h1{color:#2d6af6}h2{border-bottom:2px solid #e2e5ea;padding-bottom:8px}blockquote{border-left:3px solid #2d6af6;padding-left:16px;color:#5f6775}</style></head><body>${body}</body></html>`;
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Toasts ----
  function showToast(message, type) {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type || 'info'}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ---- Utility ----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', init);
})();
