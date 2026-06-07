/* 學生身分、活動紀錄、進度同步（需先載入 class-config.js 與 index 內建函式） */
var _progressSyncTimer = null;
var _activeFolderDrillId = null;
var _activeFolderDrillName = '';

function fbSafeKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[.#$\[\]/\\]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'x';
}
function getDeviceId() {
  var id = localStorage.getItem('device_id');
  if (!id) {
    id = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('device_id', id);
  }
  return id;
}
function getStudentProfile() {
  try {
    var s = localStorage.getItem(CLASS_CONFIG.PROFILE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}
function saveStudentProfile(p) {
  localStorage.setItem(CLASS_CONFIG.PROFILE_KEY, JSON.stringify(p));
}
function getStudentDisplayName(p) {
  if (!p) return '';
  if (p.nameOverride && String(p.nameOverride).trim()) return String(p.nameOverride).trim();
  return p.nickname || '';
}
function buildStudentKey(gradeId, classId, seat, nickname) {
  return fbSafeKey(gradeId + '_' + classId + '_' + seat + '_' + nickname);
}
function studentFirebaseBase(profile) {
  if (!profile || !profile.classKey || !profile.studentKey) return null;
  return 'classrooms/' + profile.classKey + '/students/' + profile.studentKey;
}
function nowTimeStr() {
  var now = new Date();
  return (
    now.getHours().toString().padStart(2, '0') +
    ':' +
    now.getMinutes().toString().padStart(2, '0') +
    ':' +
    now.getSeconds().toString().padStart(2, '0')
  );
}

function populateGradeSelect() {
  var sel = document.getElementById('studentGradeSelect');
  if (!sel) return;
  sel.innerHTML = '';
  CLASS_CONFIG.GRADES.forEach(function (g) {
    var o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.label;
    sel.appendChild(o);
  });
}
function populateClassSelect() {
  var sel = document.getElementById('studentClassSelect');
  if (!sel) return;
  sel.innerHTML = '';
  CLASS_CONFIG.CLASSES.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.label;
    sel.appendChild(o);
  });
}
function populateSeatSelect() {
  var sel = document.getElementById('studentSeatSelect');
  if (!sel) return;
  sel.innerHTML = '';
  for (var i = CLASS_CONFIG.SEAT_MIN; i <= CLASS_CONFIG.SEAT_MAX; i++) {
    var o = document.createElement('option');
    o.value = cfgPadSeat(i);
    o.textContent = cfgPadSeat(i) + ' 號';
    sel.appendChild(o);
  }
}
function updateStudentGateFields() {
  var gradeSel = document.getElementById('studentGradeSelect');
  var classSel = document.getElementById('studentClassSelect');
  var seatWrap = document.getElementById('studentSeatWrap');
  if (!gradeSel || !classSel) return;
  var isVisitor = classSel.value === 'other';
  if (seatWrap) seatWrap.style.display = isVisitor ? 'none' : 'block';
}
function formatStudentClassSeatLine(p) {
  var label = String(p.classLabel || '').replace(/我只是來參觀的路人/g, '路過旅客');
  if (p.classId === 'other') return label;
  return label + ' #' + p.seat;
}
function renderStudentProfileBar() {
  var txt = document.getElementById('studentProfileText');
  var p = getStudentProfile();
  if (!txt) return;
  if (!p) {
    txt.textContent = '';
    return;
  }
  var name = getStudentDisplayName(p);
  txt.innerHTML =
    '<span class="student-class-line">' +
    escapeHtml(formatStudentClassSeatLine(p)) +
    '</span><span class="student-name-line">' +
    escapeHtml(name) +
    '</span>';
}
function showStudentGate() {
  populateGradeSelect();
  populateClassSelect();
  populateSeatSelect();
  var p = getStudentProfile();
  if (p) {
    var g = document.getElementById('studentGradeSelect');
    var c = document.getElementById('studentClassSelect');
    var s = document.getElementById('studentSeatSelect');
    var nick = document.getElementById('studentNickInput');
    if (g) g.value = p.gradeId || 'g2';
    if (c) c.value = p.classId || 'zhong';
    if (s && p.seat) s.value = cfgPadSeat(parseInt(p.seat, 10) || p.seat);
    if (nick) nick.value = p.nickname || '';
  }
  updateStudentGateFields();
  document.getElementById('studentGate').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function hideStudentGate() {
  var g = document.getElementById('studentGate');
  if (g) g.style.display = 'none';
  document.body.style.overflow = '';
}

function collectFolderStatsSnapshot() {
  var out = {};
  if (typeof getFolders !== 'function') return out;
  var map = typeof getFolderMasteredMap === 'function' ? getFolderMasteredMap() : {};
  getFolders().forEach(function (f) {
    var mastered = Array.isArray(map[f.id]) ? map[f.id].length : 0;
    var nb = typeof getFolderNBCount === 'function' ? getFolderNBCount(f.id) : 0;
    out[f.id] = {
      name: f.name,
      preset: !!f.preset,
      wordCount: (f.words && f.words.length) || 0,
      mastered: mastered,
      nb: nb,
    };
  });
  return out;
}

function collectAchievementSnapshot() {
  var levels = [];
  if (typeof ALL_LEVELS !== 'undefined' && typeof getLevelStat === 'function') {
    ALL_LEVELS.forEach(function (lv) {
      var s = getLevelStat(lv);
      levels.push({
        lv: s.lv,
        tot: s.tot,
        mastered: s.mastered,
        rem: s.rem,
        nb: s.nb,
        pct: s.pct,
      });
    });
  }
  var batchDays = [];
  if (typeof getBatchData === 'function' && typeof getBatchDays === 'function') {
    var d = getBatchData();
    getBatchDays().forEach(function (day) {
      batchDays.push({
        day: day,
        count: d.days[day] ? d.days[day].length : 0,
      });
    });
  }
  var recentLogs = [];
  if (typeof getMergedActivityLogs === 'function') {
    getMergedActivityLogs()
      .slice(0, 25)
      .forEach(function (e) {
        recentLogs.push({
          type: e.type,
          detail: e.detail,
          score: e.score || 0,
          date: e.date,
          time: e.time,
        });
      });
  }
  var last =
    typeof getLastSessionInfo === 'function' ? getLastSessionInfo() : null;
  return {
    todayMastered:
      typeof getTodayMasteredCount === 'function' ? getTodayMasteredCount() : 0,
    weekMastered:
      typeof getWeekMasteredCount === 'function' ? getWeekMasteredCount() : 0,
    batchTotal:
      typeof getTotalBatchCount === 'function' ? getTotalBatchCount() : 0,
    streak: typeof getStudyStreak === 'function' ? getStudyStreak() : 0,
    levels: levels,
    batchDays: batchDays,
    lastSession: last,
    recentLogs: recentLogs,
  };
}

function collectProgressSummary() {
  var byLevel = {};
  var nbByLevel = {};
  if (typeof ALL_LEVELS !== 'undefined') {
    ALL_LEVELS.forEach(function (lv) {
      byLevel['lv' + lv] = getMastered(lv).length;
      nbByLevel['lv' + lv] = getNB(lv).length;
    });
  }
  var nbTotal =
    typeof ALL_LEVELS !== 'undefined'
      ? ALL_LEVELS.reduce(function (s, lv) {
          return s + getNB(lv).length;
        }, 0)
      : 0;
  return {
    masteredTotal: getAllMasteredCount(),
    nbTotal: nbTotal,
    folderMastered: Object.values(collectFolderStatsSnapshot()).reduce(function (s, x) {
      return s + (x.mastered || 0);
    }, 0),
    byLevel: byLevel,
    nbByLevel: nbByLevel,
    folderStats: collectFolderStatsSnapshot(),
    achievement: collectAchievementSnapshot(),
    updatedAt: Date.now(),
    date: typeof getTodayStr === 'function' ? getTodayStr() : '',
  };
}

function logStudentEvent(action, detail, meta) {
  var profile = getStudentProfile();
  var base = studentFirebaseBase(profile);
  if (!base || typeof fbRestPost !== 'function') return;
  var entry = {
    ts: Date.now(),
    date: typeof getTodayStr === 'function' ? getTodayStr() : '',
    time: nowTimeStr(),
    action: action,
    detail: detail || '',
    meta: meta || {},
    displayName: getStudentDisplayName(profile),
  };
  fbRestPost(base + '/events', entry).catch(function (e) {
    console.log('event log error', e);
  });
  scheduleProgressSync();
}

function fbBumpFolderPractice(folderId, folderName, total, correct) {
  var profile = getStudentProfile();
  var base = studentFirebaseBase(profile);
  if (!base || !folderId || typeof fbRestGet !== 'function') return;
  var path = base + '/folderPractice/' + fbSafeKey(folderId);
  fbRestGet(path)
    .then(function (cur) {
      cur = cur || {
        folderId: folderId,
        name: folderName,
        sessions: 0,
        questions: 0,
        correct: 0,
      };
      cur.name = folderName;
      cur.sessions = (cur.sessions || 0) + 1;
      cur.questions = (cur.questions || 0) + (total || 0);
      cur.correct = (cur.correct || 0) + (correct || 0);
      cur.lastAt = Date.now();
      return fbRestPut(path, cur);
    })
    .catch(function (e) {
      console.log('folder practice sync', e);
    });
}

function scheduleProgressSync() {
  if (!getStudentProfile()) return;
  clearTimeout(_progressSyncTimer);
  _progressSyncTimer = setTimeout(function () {
    fbSyncStudentProgress(false);
  }, 2800);
}

function fbSyncStudentProgress(force) {
  var profile = getStudentProfile();
  var base = studentFirebaseBase(profile);
  if (!base || typeof fbRestPut !== 'function') return Promise.resolve();
  var payload = {
    profile: {
      gradeId: profile.gradeId,
      gradeLabel: profile.gradeLabel,
      classId: profile.classId,
      classLabel: profile.classLabel,
      classKey: profile.classKey,
      seat: profile.seat,
      nickname: profile.nickname,
      nameOverride: profile.nameOverride || '',
      displayName: getStudentDisplayName(profile),
      customClass: profile.customClass || '',
      isOther: !!profile.isOther,
      deviceId: profile.deviceId,
      lastSeen: Date.now(),
    },
    progress: collectProgressSummary(),
  };
  var patchFn = typeof fbRestPatch === 'function' ? fbRestPatch : fbRestPut;
  return patchFn(base, payload)
    .then(function () {
      if (force) renderStudentProfileBar();
    })
    .catch(function (e) {
      console.log('progress sync error', e);
    });
}

function submitStudentProfile() {
  var gradeId = document.getElementById('studentGradeSelect').value;
  var classId = document.getElementById('studentClassSelect').value;
  var nickname = document.getElementById('studentNickInput').value.trim();
  if (!nickname) {
    showToast('請輸入暱稱');
    return;
  }
  if (nickname.length > 20) {
    showToast('暱稱請 20 字以內');
    return;
  }
  var isVisitor = classId === 'other';
  var seat = '00';
  if (!isVisitor) {
    seat = document.getElementById('studentSeatSelect').value;
    if (!seat) {
      showToast('請選擇座號');
      return;
    }
  }
  var classKey = cfgBuildClassKey(gradeId, classId);
  var classLabel = cfgFormatClassLabel(gradeId, classId);
  var profile = {
    gradeId: gradeId,
    gradeLabel: cfgGradeLabel(gradeId),
    classId: classId,
    classLabel: classLabel,
    classKey: classKey,
    seat: seat,
    nickname: nickname,
    nameOverride: '',
    customClass: '',
    isOther: isVisitor,
    studentKey: buildStudentKey(gradeId, classId, seat, nickname),
    deviceId: getDeviceId(),
    createdAt: Date.now(),
  };
  var prev = getStudentProfile();
  if (prev && prev.studentKey !== profile.studentKey && typeof backupAllProgress === 'function') {
    backupAllProgress('before-profile-change');
  }
  saveStudentProfile(profile);
  hideStudentGate();
  renderStudentProfileBar();
  logStudentEvent('login', '登入 ' + classLabel + (isVisitor ? '' : ' #' + seat) + ' ' + nickname, {});
  fbSyncStudentProgress(true);
  showToast('已登記：' + classLabel + (isVisitor ? '' : ' #' + seat) + ' ' + nickname);
  if (typeof buildGrid === 'function') buildGrid();
}

function initStudentGate() {
  populateGradeSelect();
  populateClassSelect();
  populateSeatSelect();
  var gradeSel = document.getElementById('studentGradeSelect');
  var classSel = document.getElementById('studentClassSelect');
  if (gradeSel) gradeSel.onchange = updateStudentGateFields;
  if (classSel) classSel.onchange = updateStudentGateFields;

  if (getStudentProfile()) {
    hideStudentGate();
    renderStudentProfileBar();
    fbSyncStudentProgress(true);
    setTimeout(function () {
      scheduleProgressSync();
    }, 4000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) scheduleProgressSync();
    });
    window.addEventListener('beforeunload', function () {
      fbSyncStudentProgress(false);
    });
    return;
  }
  showStudentGate();
}

/** 供 index 呼叫：快篩開始 */
function syncLogScanStart(levels, count) {
  logStudentEvent('scan_start', '開始快篩 Level ' + levels.join(',') + ' · ' + count + ' 字', {
    levels: levels,
    count: count,
  });
}
function syncLogScanEnd(levels, know, unknown, total) {
  logStudentEvent(
    'scan_end',
    '完成快篩 · 共 ' + total + ' 字 · 答對 ' + know + ' · 錯題 ' + unknown,
    { levels: levels, know: know, unknown: unknown, total: total }
  );
}
function syncLogFolderDrillStart(folderId, folderName, mode, count) {
  _activeFolderDrillId = folderId;
  _activeFolderDrillName = folderName;
  logStudentEvent(
    'folder_start',
    '開始資料夾「' + folderName + '」' + (mode === 'wrong' ? '錯題' : '') + '練習 · ' + count + ' 字',
    { folderId: folderId, folderName: folderName, mode: mode || 'all', count: count }
  );
}
function syncLogFolderDrillEnd(folderId, folderName, total, correct) {
  fbBumpFolderPractice(folderId, folderName, total, correct);
  logStudentEvent(
    'folder_end',
    '完成資料夾「' + folderName + '」練習 · 答對 ' + correct + '/' + total,
    { folderId: folderId, folderName: folderName, total: total, correct: correct }
  );
  _activeFolderDrillId = null;
  _activeFolderDrillName = '';
}
function syncLogNotebookDrill(title, total, correct) {
  logStudentEvent('notebook_drill', title + ' · 答對 ' + correct + '/' + total, {
    total: total,
    correct: correct,
  });
}
function syncLogReviewTest(detail, total, correct) {
  logStudentEvent('review_test', detail, { total: total, correct: correct });
}
