/** 學生身分與同步 — 精簡版（本機可跑；正式環境請換成完整版） */
function initStudentGate() {
  var gate = document.getElementById('studentGate');
  var profileEl = document.getElementById('studentProfileText');
  var gradeSel = document.getElementById('studentGradeSelect');
  var classSel = document.getElementById('studentClassSelect');
  var seatSel = document.getElementById('studentSeatSelect');
  if (!gate || !gradeSel || !classSel) return;

  var cfg = typeof CLASS_CONFIG !== 'undefined' ? CLASS_CONFIG : {};
  gradeSel.innerHTML = '';
  (cfg.grades || ['一', '二', '三']).forEach(function (g) {
    var o = document.createElement('option');
    o.value = g;
    o.textContent = g + '年級';
    gradeSel.appendChild(o);
  });
  classSel.innerHTML = '';
  (cfg.classes || ['忠', '孝', '仁', '愛']).forEach(function (c) {
    var o = document.createElement('option');
    o.value = c;
    o.textContent = c + '班';
    classSel.appendChild(o);
  });
  if (seatSel) {
    seatSel.innerHTML = '';
    var seats = cfg.seats || 25;
    for (var i = 1; i <= seats; i++) {
      var s = document.createElement('option');
      var label = i < 10 ? '0' + i : String(i);
      s.value = label;
      s.textContent = label;
      seatSel.appendChild(s);
    }
    if (cfg.allowGuest) {
      var g = document.createElement('option');
      g.value = 'guest';
      g.textContent = cfg.guestLabel || '路過旅客';
      seatSel.appendChild(g);
    }
  }

  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('student_profile') || 'null');
  } catch (e) {}

  if (saved && saved.nick) {
    gate.style.display = 'none';
    renderStudentProfile(saved, profileEl);
    return;
  }
  gate.style.display = 'flex';
}

function renderStudentProfile(p, el) {
  if (!el || !p) return;
  el.innerHTML =
    '<span class="student-class-line">' +
    (p.grade || '') +
    '年級 ' +
    (p.cls || '') +
    '班 · 座號 ' +
    (p.seat || '') +
    '</span>' +
    '<span class="student-name-line">' +
    (p.nick || '') +
    '</span>';
}

function submitStudentProfile() {
  var nick = (document.getElementById('studentNickInput') || {}).value || '';
  nick = nick.trim();
  if (!nick) {
    alert('請輸入暱稱');
    return;
  }
  var p = {
    grade: (document.getElementById('studentGradeSelect') || {}).value,
    cls: (document.getElementById('studentClassSelect') || {}).value,
    seat: (document.getElementById('studentSeatSelect') || {}).value,
    nick: nick
  };
  localStorage.setItem('student_profile', JSON.stringify(p));
  document.getElementById('studentGate').style.display = 'none';
  renderStudentProfile(p, document.getElementById('studentProfileText'));
}

function scheduleProgressSync() {}
function syncLogScanStart() {}
function syncLogScanEnd() {}
function syncLogNotebookDrill() {}
function syncLogReviewTest() {}
function syncLogFolderDrillStart() {}
function syncLogFolderDrillEnd() {}
