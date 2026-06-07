/**
 * 高中7000單 — 擴充功能
 * ① 單字卡 + 音檔（level JSON + audio/）
 * ② 匯出 + 考卷對字（manifest normalize）
 * ③ 今日任務 + 錯題排序
 */
(function (global) {
  'use strict';

  var RICH_INDEX_FILE = 'vocab-rich-index.json';
  var LEVEL_JSON = {
    1: 'vocab_7000-level01.json',
    2: 'vocab_7000-level02.json',
    3: 'vocab_7000-level03.json',
    4: 'vocab_7000-level04.json',
    5: 'vocab_7000-level05.json',
    6: 'vocab_7000-level06.json'
  };

  var NORMALIZE_RULES = {
    lowercase: true,
    strip_punctuation: true,
    possessive: [
      { pattern: "(.+)'s$", replace: '$1' },
      { pattern: "(.+)s'$", replace: '$1s' }
    ],
    plural_singular: [
      { pattern: '(.+)ies$', replace: '$1y' },
      { pattern: '(.+)es$', replace: '$1' },
      { pattern: '(.+)s$', replace: '$1' }
    ],
    verb_forms: [
      { pattern: '(.+)ing$', replace: '$1' },
      { pattern: '(.+)ing$', replace: '$1e' },
      { pattern: '(.+)ed$', replace: '$1' },
      { pattern: '(.+)ed$', replace: '$1e' }
    ],
    hyphen_variants: ['keep_original', 'remove_hyphen_variant']
  };

  var DAILY_GOAL_TARGET = 30;
  var DAILY_GOAL_DATES_KEY = 'daily_goal_dates';
  var DAILY_GOAL_PROGRESS_KEY = 'daily_goal_progress';

  var richByEn = {};
  var richIndexLoaded = false;
  var richIndexLoading = null;
  var levelLoaded = {};
  var levelLoading = {};
  var enLookup = {};
  var audioEl = null;
  var origSpeakText = null;
  var patched = false;
  var _vfPendingContinue = null;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('vf-styles')) return;
    var st = document.createElement('style');
    st.id = 'vf-styles';
    st.textContent = [
      '.daily-tasks{width:100%;margin-bottom:14px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px;}',
      '.daily-tasks-title{font-size:clamp(1rem,3.8vw,1.15rem);font-weight:800;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.daily-tasks-sub{font-size:.78rem;color:var(--text2);font-weight:500;}',
      '.daily-task-list{display:flex;flex-direction:column;gap:8px;}',
      '.daily-task-item{display:flex;align-items:center;gap:10px;width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:11px 12px;cursor:pointer;text-align:left;color:var(--text);}',
      '.daily-task-item:hover{border-color:var(--accent);}',
      '.daily-task-item .dt-icon{font-size:1.35rem;flex-shrink:0;}',
      '.daily-task-item .dt-body{flex:1;min-width:0;}',
      '.daily-task-item .dt-title{font-size:.92rem;font-weight:700;line-height:1.3;}',
      '.daily-task-item .dt-desc{font-size:.76rem;color:var(--text2);margin-top:2px;}',
      '.daily-task-item .dt-go{font-size:.72rem;color:var(--accent);font-weight:700;flex-shrink:0;}',
      '.daily-task-empty{font-size:.82rem;color:var(--text2);text-align:center;padding:8px 4px;}',
      '.exam-import-block{width:100%;margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;}',
      '.exam-import-block textarea{width:100%;min-height:88px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:10px;font-size:.82rem;resize:vertical;margin:8px 0;}',
      '.exam-import-actions{display:flex;gap:8px;flex-wrap:wrap;}',
      '.exam-import-actions button{flex:1;min-width:120px;border:none;border-radius:10px;padding:10px 12px;font-size:.82rem;font-weight:700;cursor:pointer;}',
      '.exam-import-result{font-size:.78rem;color:var(--text2);margin-top:8px;line-height:1.5;}',
      '.word-card-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;z-index:250;padding:16px;}',
      '.word-card-overlay.show{display:flex;}',
      '.word-card-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px 18px;max-width:440px;width:100%;max-height:88vh;overflow-y:auto;}',
      '.word-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;}',
      '.word-card-en{font-size:1.6rem;font-weight:800;line-height:1.2;}',
      '.word-card-meta{font-size:.82rem;color:var(--text2);margin-bottom:12px;}',
      '.word-card-section{margin-bottom:12px;}',
      '.word-card-section h4{font-size:.78rem;color:var(--accent);margin-bottom:5px;font-weight:700;}',
      '.word-card-section p,.word-card-section li{font-size:.86rem;color:var(--text);line-height:1.5;}',
      '.word-card-tags{display:flex;flex-wrap:wrap;gap:6px;}',
      '.word-card-tag{background:var(--surface2);border:1px solid var(--border);border-radius:99px;padding:4px 10px;font-size:.74rem;color:var(--text2);}',
      '.word-card-audio{display:flex;gap:8px;margin:10px 0 12px;}',
      '.word-card-audio button{flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px;font-size:.78rem;font-weight:600;cursor:pointer;}',
      '.word-card-audio button:hover{border-color:var(--accent);color:var(--accent);}',
      '.word-card-close{background:var(--surface2);border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 10px;font-size:.78rem;cursor:pointer;}',
      '.nb-word-tap{cursor:pointer;}',
      '.nb-word-tap:hover .word-row-en{color:var(--accent);}',
      '.nb-wrong-badge{font-size:.68rem;color:var(--unknown);font-weight:700;margin-left:6px;}',
      '.word-card-poszh{font-size:.92rem;color:var(--text2);margin-bottom:10px;line-height:1.45;}',
      '.word-card-ipa{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}',
      '.word-card-ipa-item{flex:1;min-width:140px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;font-size:.8rem;line-height:1.4;}',
      '.word-card-ipa-item strong{display:block;font-size:.7rem;color:var(--accent);margin-bottom:3px;}',
      '.word-card-coll-list{margin:0;padding-left:1.1em;font-size:.86rem;line-height:1.55;color:var(--text);}',
      '.word-card-empty{font-size:.82rem;color:var(--text2);font-style:italic;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function injectDom() {
    if (!document.getElementById('dailyTasksPanel')) {
      var header = document.querySelector('#home .home-header');
      if (header) {
        var panel = document.createElement('div');
        panel.id = 'dailyTasksPanel';
        panel.className = 'daily-tasks';
        panel.innerHTML =
          '<div class="daily-tasks-title">📋 今日任務 <span class="daily-tasks-sub" id="dailyTasksSub"></span></div>' +
          '<div class="daily-task-list" id="dailyTaskList"></div>';
        header.parentNode.insertBefore(panel, header.nextSibling);
      }
    }

    if (!document.getElementById('examImportBlock')) {
      var folderSection = document.getElementById('folderSection');
      if (folderSection && folderSection.parentNode) {
        var block = document.createElement('div');
        block.id = 'examImportBlock';
        block.className = 'exam-import-block section-block';
        block.style.borderTop = 'none';
        block.style.paddingTop = '0';
        block.innerHTML =
          '<div class="section-block-title">📥 考卷匯入</div>' +
          '<p class="ctx-hint">貼上老師考卷字表（每行一字），自動對應 7000 單並建立資料夾</p>' +
          '<textarea id="examImportText" placeholder="abandon&#10;absolute&#10;academic&#10;..."></textarea>' +
          '<div class="exam-import-actions">' +
          '<button type="button" style="background:var(--accent);color:#fff;" onclick="VF_importExamText()">建立資料夾</button>' +
          '<button type="button" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border);" onclick="VF_clearExamImport()">清空</button>' +
          '</div>' +
          '<div class="exam-import-result" id="examImportResult"></div>';
        folderSection.parentNode.insertBefore(block, folderSection);
      }
    }

    if (!document.getElementById('wordCardOverlay')) {
      var ov = document.createElement('div');
      ov.id = 'wordCardOverlay';
      ov.className = 'word-card-overlay';
      ov.onclick = function (e) {
        if (e.target === ov) VF_closeWordCard();
      };
      ov.innerHTML =
        '<div class="word-card-box" onclick="event.stopPropagation()">' +
        '<div class="word-card-head"><div style="flex:1;min-width:0;"><div class="word-card-en" id="wcEn"></div>' +
        '<div class="word-card-poszh" id="wcPosZh"></div></div>' +
        '<button type="button" class="word-card-close" onclick="VF_closeWordCard()">✕</button></div>' +
        '<div class="word-card-ipa" id="wcIpa"></div>' +
        '<div class="word-card-audio" id="wcAudio"></div>' +
        '<div class="word-card-section" id="wcColl"><h4>🔗 搭配詞</h4><div id="wcCollBody"></div></div>' +
        '<div class="word-card-section" id="wcExample"><h4>📝 例句</h4><div id="wcExampleBody"></div></div>' +
        '</div>';
      document.body.appendChild(ov);
    }

    var scanInfoBtn = document.getElementById('scanCardInfoBtn');
    if (scanInfoBtn) scanInfoBtn.remove();
    ['drillCardInfoBtn', 'reviewCardInfoBtn', 'folderCardInfoBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    var nbHint = document.querySelector('#notebook .ctx-hint');
    if (nbHint) {
      nbHint.innerHTML =
        '點單字可看<strong>字卡</strong>（音標、發音、搭配、例句）；勾選可複製，再按右下角 <strong>開始練習</strong>';
    }
  }

  function buildEnLookup() {
    enLookup = {};
    if (!global.allWords) return;
    global.allWords.forEach(function (w) {
      enLookup[w.en.toLowerCase()] = w;
    });
  }

  function indexRichFromSlim(entry, key) {
    if (!entry) return;
    richByEn[(key || entry.en || '').toLowerCase()] = {
      en: entry.en || key,
      zh: '',
      pos: '',
      level: entry.level || 0,
      ipa_us: entry.ipa_us || '',
      ipa_uk: entry.ipa_uk || '',
      audio_us: entry.audio_us || '',
      audio_uk: entry.audio_uk || '',
      collocations: entry.collocations || [],
      examples: entry.examples || []
    };
  }

  function loadRichIndex() {
    if (richIndexLoaded) return Promise.resolve(true);
    if (richIndexLoading) return richIndexLoading;
    richIndexLoading = fetch(RICH_INDEX_FILE)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var words = data.words || data;
        if (Array.isArray(words)) {
          words.forEach(function (e) {
            if (e && e.en) indexRichFromSlim(e, e.en);
          });
        } else {
          Object.keys(words).forEach(function (k) {
            indexRichFromSlim(words[k], k);
          });
        }
        richIndexLoaded = true;
        global._vfRichLoadFailed = false;
        return true;
      })
      .catch(function (e) {
        console.warn('VF: rich index load failed', e);
        global._vfRichLoadFailed = true;
        return false;
      })
      .finally(function () {
        richIndexLoading = null;
      });
    return richIndexLoading;
  }

  function indexRichEntry(entry) {
    if (!entry || !entry.headword) return;
    var zh = (entry.meanings_zh && entry.meanings_zh[0]) || '';
    var pos = entry.pos_display || '';
    var examples = [];
    if (entry.examples_by_pos) {
      Object.keys(entry.examples_by_pos).forEach(function (p) {
        var ex = entry.examples_by_pos[p];
        if (ex && ex.en) examples.push({ en: ex.en, zh: ex.zh || '', pos: p });
      });
    }
    var rich = {
      id: entry.id,
      en: entry.headword,
      zh: zh,
      pos: pos,
      level: entry.level_7000 || 0,
      ipa_us: entry.ipa_us || '',
      ipa_uk: entry.ipa_uk || '',
      audio_us: entry.audio_us || '',
      audio_uk: entry.audio_uk || '',
      collocations: entry.collocations || [],
      examples: examples,
      related_words: entry.related_words || []
    };
    richByEn[entry.headword.toLowerCase()] = rich;
  }

  function loadLevelRich(lv) {
    if (levelLoaded[lv]) return Promise.resolve();
    if (levelLoading[lv]) return levelLoading[lv];
    var file = LEVEL_JSON[lv];
    if (!file) return Promise.resolve();
    levelLoading[lv] = fetch(file)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        (data.entries || []).forEach(indexRichEntry);
        levelLoaded[lv] = true;
      })
      .catch(function (e) {
        console.warn('VF: level ' + lv + ' load failed', e);
      })
      .finally(function () {
        delete levelLoading[lv];
      });
    return levelLoading[lv];
  }

  function preloadRichData() {
    return loadRichIndex().then(function (ok) {
      if (ok) return true;
      var levels = [];
      if (global.allWords) {
        global.allWords.forEach(function (w) {
          if (w.level && levels.indexOf(w.level) === -1) levels.push(w.level);
        });
      }
      return Promise.all(levels.map(loadLevelRich));
    });
  }

  function getRichLoadHint() {
    if (location.protocol === 'file:') {
      return '字卡資料無法從本機檔案直接讀取。請在「00_要複製的字庫包」資料夾執行：python3 -m http.server 8765，再用瀏覽器開 http://127.0.0.1:8765/index.html';
    }
    return '找不到 vocab-rich-index.json（請確認與 index.html 放在同一資料夾並已上傳 GitHub）';
  }

  function getRich(en) {
    if (!en) return null;
    return richByEn[String(en).toLowerCase()] || null;
  }

  function speakTTS(t) {
    if (!global.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function playAudio(path, fallbackText) {
    if (!path) {
      speakTTS(fallbackText);
      return;
    }
    if (!audioEl) audioEl = new Audio();
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.src = path;
    audioEl.onerror = function () {
      speakTTS(fallbackText);
    };
    audioEl.play().catch(function () {
      speakTTS(fallbackText);
    });
  }

  function speakWord(en, uk) {
    var rich = getRich(en);
    var path = rich ? (uk ? rich.audio_uk : rich.audio_us) : '';
    if (path) playAudio(path, en);
    else speakTTS(en);
  }

  function ensureRichForWord(en, cb) {
    if (getRich(en)) {
      if (cb) cb();
      return;
    }
    loadRichIndex().then(function () {
      if (getRich(en)) {
        if (cb) cb();
        return;
      }
      var w = enLookup[String(en).toLowerCase()];
      if (w && w.level) {
        return loadLevelRich(w.level).then(function () {
          if (cb) cb();
        });
      }
      return Promise.all([1, 2, 3, 4, 5, 6].map(loadLevelRich)).then(function () {
        if (cb) cb();
      });
    });
  }

  function showWordCard(en) {
    ensureRichForWord(en, function () {
      var base = enLookup[String(en).toLowerCase()] || { en: en, zh: '', pos: '', level: 0 };
      var rich = getRich(en);
      document.getElementById('wcEn').textContent = base.en;
      var posZh = (base.pos || '') + (base.zh ? '　' + base.zh : '');
      if (base.level) posZh += '　·　Lv' + base.level;
      document.getElementById('wcPosZh').textContent = posZh;

      var ipaBox = document.getElementById('wcIpa');
      ipaBox.innerHTML = '';
      var loadFailed = !rich && global._vfRichLoadFailed;
      var ipaUs = rich && rich.ipa_us ? rich.ipa_us : '';
      var ipaUk = rich && rich.ipa_uk ? rich.ipa_uk : '';
      if (loadFailed) {
        ipaBox.innerHTML =
          '<div class="word-card-empty" style="color:var(--warn);line-height:1.5;">⚠️ 字卡資料載入失敗<br><span style="font-size:.74rem;">' +
          esc(getRichLoadHint()) +
          '</span></div>';
      } else if (ipaUs || ipaUk) {
        if (ipaUs) {
          ipaBox.innerHTML +=
            '<div class="word-card-ipa-item"><strong>美音 IPA</strong>/' + esc(ipaUs) + '/</div>';
        }
        if (ipaUk) {
          ipaBox.innerHTML +=
            '<div class="word-card-ipa-item"><strong>英音 IPA</strong>/' + esc(ipaUk) + '/</div>';
        }
      } else {
        ipaBox.innerHTML = '<div class="word-card-empty">此字尚無音標資料</div>';
      }

      var audioBox = document.getElementById('wcAudio');
      audioBox.innerHTML = '';
      var b1 = document.createElement('button');
      b1.textContent = '🔊 播放美音';
      b1.onclick = function () {
        speakWord(base.en, false);
      };
      audioBox.appendChild(b1);
      var b2 = document.createElement('button');
      b2.textContent = '🔊 播放英音';
      b2.onclick = function () {
        speakWord(base.en, true);
      };
      audioBox.appendChild(b2);

      var collBody = document.getElementById('wcCollBody');
      if (loadFailed) {
        collBody.innerHTML = '<div class="word-card-empty" style="color:var(--warn);">請先依上方說明修正載入方式</div>';
      } else if (rich && rich.collocations && rich.collocations.length) {
        collBody.innerHTML =
          '<ul class="word-card-coll-list">' +
          rich.collocations
            .slice(0, 8)
            .map(function (c) {
              return '<li>' + esc(c) + '</li>';
            })
            .join('') +
          '</ul>';
      } else {
        collBody.innerHTML = '<div class="word-card-empty">此字尚無搭配詞資料</div>';
      }

      var exBody = document.getElementById('wcExampleBody');
      var examples =
        rich && rich.examples && rich.examples.length
          ? rich.examples
          : rich && rich.example_en
            ? [{ en: rich.example_en, zh: rich.example_zh || '' }]
            : [];
      if (loadFailed) {
        exBody.innerHTML = '<div class="word-card-empty" style="color:var(--warn);">請先依上方說明修正載入方式</div>';
      } else if (examples.length) {
        exBody.innerHTML = examples
          .slice(0, 3)
          .map(function (ex) {
            return (
              '<p style="margin:0 0 10px;line-height:1.55;">' +
              esc(ex.en) +
              '<br><span style="color:var(--text2);font-size:.84rem;">' +
              esc(ex.zh) +
              '</span></p>'
            );
          })
          .join('');
      } else {
        exBody.innerHTML = '<div class="word-card-empty">此字尚無例句資料</div>';
      }

      document.getElementById('wordCardOverlay').classList.add('show');
      if (!loadFailed) speakWord(base.en, false);
    });
  }

  function closeWordCard() {
    var ov = document.getElementById('wordCardOverlay');
    if (ov) ov.classList.remove('show');
  }

  function applyRegexVariants(base, rules) {
    var out = [];
    var seen = {};
    function push(v) {
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    }
    function expand(list, pattern, replace) {
      var re = new RegExp(pattern);
      var next = [];
      list.forEach(function (v) {
        push(v);
        var m = v.match(re);
        if (m) next.push(v.replace(re, replace.replace('$1', m[1])));
      });
      next.forEach(push);
    }
    push(base);
    var cur = [base];
    (rules.possessive || []).forEach(function (rule) {
      expand(cur, rule.pattern, rule.replace);
      cur = out.slice();
    });
    (rules.plural_singular || []).forEach(function (rule) {
      expand(cur, rule.pattern, rule.replace);
      cur = out.slice();
    });
    (rules.verb_forms || []).forEach(function (rule) {
      expand(cur, rule.pattern, rule.replace);
      cur = out.slice();
    });
    if ((rules.hyphen_variants || []).indexOf('remove_hyphen_variant') >= 0) {
      out.slice().forEach(function (v) {
        if (v.indexOf('-') >= 0) push(v.replace(/-/g, ''));
      });
    }
    return out;
  }

  function normalizeToken(raw) {
    var t = String(raw || '').trim();
    if (!t) return [];
    if (NORMALIZE_RULES.lowercase) t = t.toLowerCase();
    if (NORMALIZE_RULES.strip_punctuation) t = t.replace(/[^a-zA-Z'-]/g, '');
    if (!t || !/^[a-z]/.test(t)) return [];
    return applyRegexVariants(t, NORMALIZE_RULES);
  }

  function matchWordFromToken(token) {
    var variants = normalizeToken(token);
    for (var i = 0; i < variants.length; i++) {
      var hit = enLookup[variants[i]];
      if (hit) return hit;
    }
    return null;
  }

  function parseExamText(text) {
    var matched = [];
    var unmatched = [];
    var seen = {};
    String(text || '')
      .split(/\r?\n/)
      .forEach(function (line) {
        var trimmed = line.trim();
        if (!trimmed) return;
        if (/^=+$/.test(trimmed)) return;
        if (/字數|第\s*\d|【|】|Level|小考|字母序/.test(trimmed) && !/^[a-zA-Z]/.test(trimmed)) return;

        var found = null;
        if (/^[a-zA-Z][a-zA-Z' -]*$/.test(trimmed)) {
          found = matchWordFromToken(trimmed);
        }
        if (!found) {
          trimmed.split(/\s+/).forEach(function (part) {
            if (!found) found = matchWordFromToken(part);
          });
        }
        if (found && !seen[found.en]) {
          seen[found.en] = true;
          matched.push(found);
        } else if (/^[a-zA-Z][a-zA-Z'-]+$/.test(trimmed.split(/\s+/)[0])) {
          unmatched.push(trimmed.split(/\s+/)[0]);
        }
      });
    return { matched: matched, unmatched: unmatched };
  }

  function importExamText() {
    var ta = document.getElementById('examImportText');
    var resultEl = document.getElementById('examImportResult');
    if (!ta) return;
    var parsed = parseExamText(ta.value);
    if (!parsed.matched.length) {
      if (resultEl) resultEl.innerHTML = '<span style="color:var(--unknown)">找不到可對應的單字，請確認格式（每行一個英文單字）</span>';
      return;
    }
    var defaultName = '考卷 ' + (global.getTodayStr ? global.getTodayStr() : '');
    var name = prompt('資料夾名稱：', defaultName);
    if (!name || !name.trim()) return;
    if (typeof global.createFolder !== 'function') return;
    var id = global.createFolder(name.trim());
    if (!id) return;
    parsed.matched.forEach(function (w) {
      global.addWordToFolder(id, w);
    });
    if (typeof global.buildFolderSection === 'function') global.buildFolderSection();
    if (typeof global.buildDailyTasks === 'function') global.buildDailyTasks();
    var msg =
      '已建立「' +
      esc(name.trim()) +
      '」共 <strong style="color:var(--know)">' +
      parsed.matched.length +
      '</strong> 字';
    if (parsed.unmatched.length) {
      msg +=
        '；<span style="color:var(--warn)">' +
        parsed.unmatched.length +
        ' 字未對到（' +
        esc(parsed.unmatched.slice(0, 8).join(', ')) +
        (parsed.unmatched.length > 8 ? '…' : '') +
        '）</span>';
    }
    if (resultEl) resultEl.innerHTML = msg;
    if (typeof global.showToast === 'function') global.showToast('考卷資料夾已建立 ✅');
  }

  function clearExamImport() {
    var ta = document.getElementById('examImportText');
    var resultEl = document.getElementById('examImportResult');
    if (ta) ta.value = '';
    if (resultEl) resultEl.innerHTML = '';
  }

  function getStaleMasteredCount() {
    if (!global.getBatchData || !global.dateKeyFromDate) return 0;
    var recent = {};
    var now = new Date();
    var d = global.getBatchData();
    for (var i = 0; i < 7; i++) {
      var dt = new Date(now);
      dt.setDate(dt.getDate() - i);
      var key = global.dateKeyFromDate(dt);
      if (d.days[key]) {
        d.days[key].forEach(function (w) {
          recent[w.en] = true;
        });
      }
    }
    var stale = 0;
    (global.ALL_LEVELS || []).forEach(function (lv) {
      (global.getMastered ? global.getMastered(lv) : []).forEach(function (en) {
        if (!recent[en]) stale++;
      });
    });
    return stale;
  }

  function getExamRemainingCount() {
    if (typeof global.getFolderById !== 'function') return 0;
    var f = global.getFolderById('preset_exam_1_528');
    if (!f || !f.words) return 0;
    return (global.getFolderRemainingWords ? global.getFolderRemainingWords('preset_exam_1_528') : f.words).length;
  }

  function getDailyGoalDates() {
    try {
      var arr = JSON.parse(localStorage.getItem(DAILY_GOAL_DATES_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveDailyGoalDates(arr) {
    try {
      localStorage.setItem(DAILY_GOAL_DATES_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function isDailyGoalCompletedToday() {
    if (typeof global.getTodayStr !== 'function') return false;
    return getDailyGoalDates().indexOf(global.getTodayStr()) >= 0;
  }

  function getDailyGoalProgress() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_GOAL_PROGRESS_KEY) || 'null') || { date: '', done: 0 };
    } catch (e) {
      return { date: '', done: 0 };
    }
  }

  function saveDailyGoalProgress(done) {
    if (typeof global.getTodayStr !== 'function') return;
    try {
      localStorage.setItem(
        DAILY_GOAL_PROGRESS_KEY,
        JSON.stringify({ date: global.getTodayStr(), done: done })
      );
    } catch (e) {}
  }

  function getTodayWordCount() {
    var prog = getDailyGoalProgress();
    var today = typeof global.getTodayStr === 'function' ? global.getTodayStr() : '';
    return prog.date === today ? prog.done : 0;
  }

  function recordDailyCheckin() {
    if (typeof global.getTodayStr !== 'function') return 0;
    var today = global.getTodayStr();
    var dates = getDailyGoalDates();
    if (dates.indexOf(today) === -1) {
      dates.push(today);
      dates.sort();
      saveDailyGoalDates(dates);
    }
    return getDailyGoalStreak();
  }

  function getDailyGoalStreak() {
    if (typeof global.getTodayStr !== 'function' || typeof global.dateKeyFromDate !== 'function') return 0;
    var set = {};
    getDailyGoalDates().forEach(function (d) {
      set[d] = true;
    });
    if (!Object.keys(set).length) return 0;
    var streak = 0;
    var cur = new Date();
    cur.setHours(0, 0, 0, 0);
    var today = global.getTodayStr();
    if (!set[today]) cur.setDate(cur.getDate() - 1);
    for (var i = 0; i < 400; i++) {
      var key = global.dateKeyFromDate(cur);
      if (set[key]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function beginDailyGoal(mode) {
    var done = getTodayWordCount();
    global._vfDailyGoal = { active: true, done: done, mode: mode || 'practice' };
    updateTodayProgressUI();
  }

  function ensureGoalSession() {
    if (!global._vfDailyGoal || !global._vfDailyGoal.active) beginDailyGoal('practice');
  }

  function getRoundPosition(totalDone) {
    var r = totalDone % DAILY_GOAL_TARGET;
    return r === 0 && totalDone > 0 ? DAILY_GOAL_TARGET : r;
  }

  function updateTodayProgressUI() {
    var el = document.getElementById('vfTodayProgress');
    if (!el) return;
    var done = getTodayWordCount();
    var pos = getRoundPosition(done);
    el.textContent = '今日 ' + done + ' 字 · 這組 ' + pos + '/' + DAILY_GOAL_TARGET;
  }

  function injectTodayProgressUI() {
    if (document.getElementById('vfTodayProgress')) return;
    var targets = ['.scan-header', '#drill .drill-header', '#reviewTest .review-test-header', '#folderDrill .drill-header'];
    targets.forEach(function (sel) {
      var host = document.querySelector(sel);
      if (!host || host.querySelector('.vf-today-progress')) return;
      var el = document.createElement('div');
      el.id = sel.indexOf('scan') >= 0 ? 'vfTodayProgress' : 'vfTodayProgress_' + sel.replace(/[^a-z]/gi, '');
      if (sel === '.scan-header') el.id = 'vfTodayProgress';
      el.className = 'vf-today-progress';
      el.style.cssText =
        'width:100%;text-align:center;font-size:.76rem;color:var(--text2);margin:4px 0 2px;font-weight:600;';
      host.appendChild(el);
    });
    if (!document.getElementById('vfTodayProgress')) {
      var scanHeader = document.querySelector('.scan-header');
      if (scanHeader) {
        var el2 = document.createElement('div');
        el2.id = 'vfTodayProgress';
        el2.className = 'vf-today-progress';
        el2.style.cssText =
          'width:100%;text-align:center;font-size:.76rem;color:var(--text2);margin:4px 0 2px;font-weight:600;';
        scanHeader.appendChild(el2);
      }
    }
    updateTodayProgressUI();
  }

  function buildCelebrateMessage(totalDone, streak) {
    var round = totalDone / DAILY_GOAL_TARGET;
    var msg = '🎉 太棒了！你已完成第 ' + round + ' 組（每組 ' + DAILY_GOAL_TARGET + ' 字）\n\n';
    msg += '📊 今日累計已練 ' + totalDone + ' 字';
    if (totalDone === DAILY_GOAL_TARGET) {
      msg += '\n\n✅ 今日目標打卡完成！';
      if (streak >= 3) msg += '\n🔥 恭喜連續 ' + streak + ' 天達成目標！';
      else if (streak === 2) msg += '\n🔥 恭喜連續 2 天打卡！';
      else msg += '\n✨ 今天的第一步完成了！明天繼續就能累積連續天數喔！';
    }
    msg += '\n\n要繼續挑戰，還是先回首頁休息一下？';
    return msg;
  }

  function showMilestoneCelebrate(totalDone) {
    var streak =
      totalDone === DAILY_GOAL_TARGET ? recordDailyCheckin() : getDailyGoalStreak();
    if (typeof global.showModal !== 'function') return;
    global.showModal('🏆 已練 ' + totalDone + ' 字', buildCelebrateMessage(totalDone, streak), [
      {
        label: '回首頁',
        cls: 'btn-secondary',
        fn: function () {
          global._vfDailyGoal = null;
          _vfPendingContinue = null;
          if (typeof global.closeModal === 'function') global.closeModal();
          if (typeof global.gotoHome === 'function') global.gotoHome();
          if (typeof buildDailyTasks === 'function') buildDailyTasks();
        }
      },
      {
        label: '繼續挑戰 💪',
        cls: 'btn-primary',
        fn: function () {
          if (typeof global.closeModal === 'function') global.closeModal();
          if (_vfPendingContinue) {
            var fn = _vfPendingContinue;
            _vfPendingContinue = null;
            fn();
          }
          updateTodayProgressUI();
          if (typeof buildDailyTasks === 'function') buildDailyTasks();
        }
      }
    ]);
    if (typeof global.showToast === 'function') {
      global.showToast('已完成 ' + totalDone + ' 字 🎉');
    }
    if (typeof buildDailyTasks === 'function') buildDailyTasks();
  }

  function tickDailyGoal(continueFn) {
    ensureGoalSession();
    var g = global._vfDailyGoal;
    if (!g || !g.active) return false;
    g.done++;
    saveDailyGoalProgress(g.done);
    updateTodayProgressUI();
    if (g.done % DAILY_GOAL_TARGET !== 0) return false;
    _vfPendingContinue = continueFn || null;
    showMilestoneCelebrate(g.done);
    return true;
  }

  function vfAfterWordDone(continueFn) {
    if (!tickDailyGoal(continueFn)) continueFn();
  }

  function patchDailyGoal() {
    if (typeof global.markUnknown === 'function' && !global.markUnknown._vfGoal) {
      var origUnknown = global.markUnknown;
      global.markUnknown = function () {
        if (global.qActive) return;
        global.counts.unknown++;
        if (typeof global.updateStats === 'function') global.updateStats();
        global.scanLevels.forEach(function (lv) {
          if (global.queue[global.idx].level === lv) global.addToNB(lv, global.queue[global.idx]);
        });
        global.idx++;
        vfAfterWordDone(function () {
          if (typeof global.renderWord === 'function') global.renderWord();
        });
      };
      global.markUnknown._vfGoal = true;
    }

    if (typeof global.finishQuiz === 'function' && !global.finishQuiz._vfGoal) {
      var origFinish = global.finishQuiz;
      global.finishQuiz = function (ok, w) {
        global.qActive = false;
        if (ok) {
          global.counts.know++;
          global.addMastered(w.level, w.en);
        } else {
          global.counts.unknown++;
          global.scanLevels.forEach(function (lv) {
            if (w.level === lv) global.addToNB(lv, w);
          });
        }
        if (typeof global.updateStats === 'function') global.updateStats();
        global.idx++;
        vfAfterWordDone(function () {
          if (typeof global.renderWord === 'function') global.renderWord();
        });
      };
      global.finishQuiz._vfGoal = true;
    }

    ['answerDrill', 'answerReview', 'answerFolderDrill'].forEach(function (name) {
      if (typeof global[name] !== 'function' || global[name]._vfGoal) return;
      var orig = global[name];
      global[name] = function () {
        orig.apply(global, arguments);
        tickDailyGoal(null);
      };
      global[name]._vfGoal = true;
    });

    if (typeof global.timeoutFolderDrill === 'function' && !global.timeoutFolderDrill._vfGoal) {
      var origFolderTimeout = global.timeoutFolderDrill;
      global.timeoutFolderDrill = function () {
        origFolderTimeout.apply(global, arguments);
        tickDailyGoal(null);
      };
      global.timeoutFolderDrill._vfGoal = true;
    }

    if (typeof global.startScan === 'function' && !global.startScan._vfGoal) {
      var origStartScan = global.startScan;
      global.startScan = function () {
        if (!global._vfDailyGoal) beginDailyGoal('scan');
        injectTodayProgressUI();
        updateTodayProgressUI();
        origStartScan();
      };
      global.startScan._vfGoal = true;
    }

    if (typeof global.startNotebookDrill === 'function' && !global.startNotebookDrill._vfGoal) {
      var origNBDrill = global.startNotebookDrill;
      global.startNotebookDrill = function () {
        if (!global._vfDailyGoal) beginDailyGoal('drill');
        injectTodayProgressUI();
        updateTodayProgressUI();
        origNBDrill();
      };
      global.startNotebookDrill._vfGoal = true;
    }

    if (typeof global.startFolderDrill === 'function' && !global.startFolderDrill._vfGoal) {
      var origFolderDrill = global.startFolderDrill;
      global.startFolderDrill = function (folderId) {
        if (!global._vfDailyGoal) beginDailyGoal('folder');
        injectTodayProgressUI();
        updateTodayProgressUI();
        origFolderDrill(folderId);
      };
      global.startFolderDrill._vfGoal = true;
    }

    if (typeof global.startReviewTest === 'function' && !global.startReviewTest._vfGoal) {
      var origReview = global.startReviewTest;
      global.startReviewTest = function () {
        if (!global._vfDailyGoal) beginDailyGoal('review');
        injectTodayProgressUI();
        updateTodayProgressUI();
        origReview();
      };
      global.startReviewTest._vfGoal = true;
    }
  }

  function startDailyScan(lv) {
    beginDailyGoal('scan');
    global.selMode = lv;
    if (typeof global.syncStyles === 'function') global.syncStyles();
    if (typeof global.startScan === 'function') global.startScan();
  }

  function startDailyNotebookDrill() {
    beginDailyGoal('drill');
    if (typeof global.gotoNotebook === 'function') global.gotoNotebook();
    setTimeout(function () {
      if (typeof global.startNotebookDrill === 'function') global.startNotebookDrill();
    }, 120);
  }

  function startDailyExamDrill() {
    beginDailyGoal('folder');
    if (typeof global.startFolderDrill === 'function') global.startFolderDrill('preset_exam_1_528');
  }

  function startDailyReview() {
    beginDailyGoal('review');
    var sel = document.getElementById('reviewLevelSelect');
    if (sel) sel.value = 'all';
    var btn30 = document.querySelector('.review-count-btn');
    if (typeof global.selectReviewCount === 'function' && btn30) {
      global.selectReviewCount(30, btn30);
    }
    if (typeof global.updateReviewBtn === 'function') global.updateReviewBtn();
    if (typeof global.startReviewTest === 'function') global.startReviewTest();
  }

  function buildDailyTasks() {
    var list = document.getElementById('dailyTaskList');
    var sub = document.getElementById('dailyTasksSub');
    if (!list) return;

    var tasks = [];
    var bestLv = null;
    var bestRem = 0;
    (global.ALL_LEVELS || []).forEach(function (lv) {
      var rem = global.getRemainingCount ? global.getRemainingCount(lv) : 0;
      if (rem > bestRem) {
        bestRem = rem;
        bestLv = lv;
      }
    });
    if (bestRem > 0) {
      tasks.push({
        icon: '⚡',
        title: '快篩新字 ' + Math.min(DAILY_GOAL_TARGET, bestRem) + ' 個',
        desc: 'Level ' + bestLv + ' 還剩 ' + bestRem + ' 字 · 每 ' + DAILY_GOAL_TARGET + ' 字提醒一次',
        action: function () {
          startDailyScan(bestLv);
        }
      });
    }

    var nbTotal = global.getAllNBCount ? global.getAllNBCount() : 0;
    if (nbTotal > 0) {
      tasks.push({
        icon: '📖',
        title: '優先練錯題 ' + Math.min(DAILY_GOAL_TARGET, nbTotal) + ' 個',
        desc: '錯題本共 ' + nbTotal + ' 字 · 每 ' + DAILY_GOAL_TARGET + ' 字提醒一次',
        action: startDailyNotebookDrill
      });
    }

    var stale = getStaleMasteredCount();
    if (stale > 0) {
      tasks.push({
        icon: '🔄',
        title: '複習久沒練的字 ' + DAILY_GOAL_TARGET + ' 個',
        desc: '約 ' + stale + ' 字超過 7 天沒複習',
        action: startDailyReview
      });
    }

    var examRem = getExamRemainingCount();
    if (examRem > 0) {
      tasks.push({
        icon: '📝',
        title: '段考衝刺 ' + Math.min(DAILY_GOAL_TARGET, examRem) + ' 字',
        desc: '528 字表還剩 ' + examRem + ' 字 · 每 ' + DAILY_GOAL_TARGET + ' 字提醒一次',
        action: startDailyExamDrill
      });
    }

    if (sub) {
      var done = getTodayWordCount();
      var pos = getRoundPosition(done);
      var left = DAILY_GOAL_TARGET - pos;
      var streak = getDailyGoalStreak();
      var line = '今日已練 ' + done + ' 字 · 這組 ' + pos + '/' + DAILY_GOAL_TARGET;
      if (left > 0) line += ' · 再 ' + left + ' 字休息';
      if (isDailyGoalCompletedToday()) line += ' · 已打卡 ✅';
      if (streak >= 2) line += ' · 連續 ' + streak + ' 天';
      sub.textContent = line;
    }

    if (!tasks.length) {
      list.innerHTML = '<div class="daily-task-empty">🎉 目前沒有急件，可以複習或加新字</div>';
      return;
    }

    list.innerHTML = '';
    tasks.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'daily-task-item';
      btn.innerHTML =
        '<span class="dt-icon">' +
        t.icon +
        '</span><div class="dt-body"><div class="dt-title">' +
        esc(t.title) +
        '</div><div class="dt-desc">' +
        esc(t.desc) +
        '</div></div><span class="dt-go">開始 →</span>';
      btn.onclick = t.action;
      list.appendChild(btn);
    });
  }

  function sortNBWords(words) {
    return words.slice().sort(function (a, b) {
      var wa = a.wrongCount || 1;
      var wb = b.wrongCount || 1;
      if (wb !== wa) return wb - wa;
      return (b.lastWrongTs || b.addedTs || 0) - (a.lastWrongTs || a.addedTs || 0);
    });
  }

  function patchNotebook() {
    if (typeof global.addToNB === 'function' && !global.addToNB._vf) {
      var orig = global.addToNB;
      global.addToNB = function (lv, w) {
        var a = global.getNB(lv);
        var ex = a.find(function (x) {
          return x.en === w.en;
        });
        var wrongCount = ex ? (ex.wrongCount || 1) + 1 : 1;
        a = a.filter(function (x) {
          return x.en !== w.en;
        });
        var entry = Object.assign({}, w, {
          addedTs: Date.now(),
          wrongCount: wrongCount,
          lastWrongTs: Date.now()
        });
        a.unshift(entry);
        global.setNB(lv, a);
      };
      global.addToNB._vf = true;
    }

    if (typeof global.addToFolderNB === 'function' && !global.addToFolderNB._vf) {
      var origF = global.addToFolderNB;
      global.addToFolderNB = function (folderId, word) {
        if (!folderId || !word || !word.en) return;
        var map = global.getFolderNBMap();
        var list = Array.isArray(map[folderId]) ? map[folderId].slice() : [];
        var ex = list.find(function (w) {
          return w.en === word.en;
        });
        var wrongCount = ex ? (ex.wrongCount || 1) + 1 : 1;
        list = list.filter(function (w) {
          return w.en !== word.en;
        });
        list.unshift({
          en: word.en,
          zh: word.zh || word.en,
          pos: word.pos || '',
          level: word.level || 0,
          wrongCount: wrongCount,
          lastWrongTs: Date.now()
        });
        map[folderId] = list;
        global.saveFolderNBMap(map);
      };
      global.addToFolderNB._vf = true;
    }

    if (typeof global.renderNBTab === 'function' && !global.renderNBTab._vf) {
      global.renderNBTab = function (level) {
        global.nbActiveLevel = level;
        var sub = document.getElementById('nbExamSubTabs');
        if (sub) sub.style.display = level === 'exam' ? 'flex' : 'none';
        var words;
        if (level === 'exam') {
          if (typeof global.buildExamSubTabs === 'function') global.buildExamSubTabs();
          words = global.nbActiveExamFolderId
            ? global.getFolderNB(global.nbActiveExamFolderId).map(function (w) {
                var fn = (global.getFolderById(global.nbActiveExamFolderId) || {}).name;
                return {
                  en: w.en,
                  zh: w.zh,
                  pos: w.pos || '',
                  level: 0,
                  wrongCount: w.wrongCount,
                  lastWrongTs: w.lastWrongTs,
                  _folderId: global.nbActiveExamFolderId,
                  _folderName: fn
                };
              })
            : global.getAllFolderNBWords();
        } else {
          words =
            level == null
              ? (global.ALL_LEVELS || []).reduce(function (a, lv) {
                  return a.concat(global.getNB(lv));
                }, [])
              : global.getNB(level);
        }
        words = sortNBWords(words);
        var list = document.getElementById('nbWordList');
        list.innerHTML = '';
        var total = level === 'exam' ? words.length : global.getAllNBCount();
        document.getElementById('nbTotalCount').textContent = '共 ' + total + ' 字';
        if (!words.length) {
          list.innerHTML =
            '<div class="nb-empty">' +
            (level === 'exam' ? '段考資料夾目前沒有錯題 🎉' : '這個程度目前沒有錯題 🎉') +
            '</div>';
          var pb = document.getElementById('nbPracticeBtn');
          if (pb) pb.style.display = 'none';
          if (typeof global.renderNBCopyBar === 'function') global.renderNBCopyBar([]);
          return;
        }
        var pb = document.getElementById('nbPracticeBtn');
        if (pb) {
          pb.style.display = 'block';
          pb.textContent = level === 'exam' ? '🎯 練段考錯題' : '🎯 練習錯題';
        }
        if (typeof global.renderNBCopyBar === 'function') global.renderNBCopyBar(words);
        words.forEach(function (w) {
          var row = document.createElement('div');
          row.className = 'word-row';
          var badge =
            w.wrongCount > 1
              ? '<span class="nb-wrong-badge">錯×' + w.wrongCount + '</span>'
              : '';
          var subLbl =
            level === 'exam' && w._folderName
              ? '<div style="font-size:.72rem;color:var(--accent);margin-bottom:2px;">📁 ' +
                global.escJs(w._folderName) +
                '</div>'
              : '';
          row.innerHTML =
            '<input type="checkbox" class="nb-check" data-en="' +
            global.escJs(w.en) +
            '" data-pos="' +
            global.escJs(w.pos) +
            '" data-zh="' +
            global.escJs(w.zh) +
            '" checked style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;">' +
            '<div class="word-row-info nb-word-tap" title="點擊查看字卡">' +
            subLbl +
            '<div class="word-line"><span class="word-row-en">' +
            w.en +
            badge +
            '</span><span class="word-row-pos">' +
            w.pos +
            '</span><span class="word-row-zh">' +
            w.zh +
            '</span></div></div>' +
            '<div class="word-row-btns">' +
            '<button class="icon-btn" type="button" title="發音">🔊</button>' +
            '<button class="icon-btn" type="button" title="複製">📋</button>' +
            '<button class="icon-btn del" type="button" title="移出錯題本">✕</button></div>';
          var chk = row.querySelector('.nb-check');
          if (chk) {
            chk.onclick = function (e) {
              e.stopPropagation();
            };
          }
          var info = row.querySelector('.word-row-info');
          if (info) {
            info.onclick = function () {
              showWordCard(w.en);
            };
          }
          var btns = row.querySelector('.word-row-btns');
          btns.children[0].onclick = function (e) {
            e.stopPropagation();
            speakWord(w.en, false);
          };
          btns.children[1].onclick = function (e) {
            e.stopPropagation();
            global.copyWord(w.zh + ' ' + w.pos + ' ' + w.en);
          };
          if (level === 'exam') {
            btns.children[2].onclick = function (e) {
              e.stopPropagation();
              global.removeWordFromExamNB(w._folderId, w.en);
            };
          } else {
            btns.children[2].onclick = function (e) {
              e.stopPropagation();
              global.removeWordFromNB(w.level, w.en);
            };
          }
          list.appendChild(row);
        });
      };
      global.renderNBTab._vf = true;
    }
  }

  function patchExport() {
    global.exportBatch = function () {
      var days = global.getSelectedDays();
      if (!days.length) {
        global.showModal('未選擇日期', '請至少勾選一個日期再匯出。', [
          { label: '確定', cls: 'btn-primary', fn: global.closeModal }
        ]);
        return;
      }
      var words = global.getBatchWordsByDays(days);
      if (!words.length) {
        global.showModal('沒有單字', '所選日期沒有已掌握的單字。', [
          { label: '確定', cls: 'btn-primary', fn: global.closeModal }
        ]);
        return;
      }
      days.sort();
      var payload = { v: 2, startDate: days[0], endDate: days[days.length - 1], days: days, words: words };
      var code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      document.getElementById('exportCode').value = code;
      document.getElementById('exportInfo').textContent =
        '共 ' + words.length + ' 個字　日期：' + days[0] + ' ～ ' + days[days.length - 1];
      document.getElementById('exportModal').style.display = 'flex';
    };

    var exportSec = document.querySelector('#home .section-block:last-of-type');
    if (exportSec) {
      exportSec.style.opacity = '1';
      var hint = exportSec.querySelector('.ctx-hint[style*="warn"]');
      if (hint) hint.remove();
      var btn = exportSec.querySelector('button[onclick="exportBatch()"]');
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }
  }

  function patchNavigation() {
    if (typeof global.buildGrid === 'function' && !global.buildGrid._vf) {
      var ob = global.buildGrid;
      global.buildGrid = function () {
        ob();
        buildDailyTasks();
      };
      global.buildGrid._vf = true;
    }
    if (typeof global.gotoHome === 'function' && !global.gotoHome._vf) {
      var oh = global.gotoHome;
      global.gotoHome = function () {
        oh();
        buildDailyTasks();
      };
      global.gotoHome._vf = true;
    }
  }

  function applyPatches() {
    if (patched) return;
    patched = true;
    buildEnLookup();
    origSpeakText = global.speakText;
    global.speakText = function (t, uk) {
      speakWord(t, uk);
    };
    patchNotebook();
    patchExport();
    patchDailyGoal();
    patchNavigation();
    global.buildDailyTasks = buildDailyTasks;
    global.VF_showWordCard = showWordCard;
    global.VF_closeWordCard = closeWordCard;
    global.VF_importExamText = importExamText;
    global.VF_clearExamImport = clearExamImport;
  }

  function postBoot() {
    injectDom();
    injectTodayProgressUI();
    applyPatches();
    buildDailyTasks();
    preloadRichData();
  }

  function hookBoot() {
    injectStyles();
    if (typeof global.bootApp !== 'function') return;
    var origBoot = global.bootApp;
    global.bootApp = function () {
      origBoot();
      postBoot();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }

  hookBoot();

  global.VF = {
    getRich: getRich,
    loadLevelRich: loadLevelRich,
    showWordCard: showWordCard,
    parseExamText: parseExamText,
    buildDailyTasks: buildDailyTasks,
    beginDailyGoal: beginDailyGoal,
    getDailyGoalStreak: getDailyGoalStreak,
    isDailyGoalCompletedToday: isDailyGoalCompletedToday
  };
})(typeof window !== 'undefined' ? window : this);
