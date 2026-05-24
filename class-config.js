/** 班級與教師設定（index.html、teacher.html 共用） */
var CLASS_CONFIG = {
  FB_URL: 'https://vocab7000-8ad19-default-rtdb.asia-southeast1.firebasedatabase.app',
  TEACHER_USER: 'teacher3388',
  TEACHER_PASS: '3388teacher8833',
  PROFILE_KEY: 'student_profile_v2',
  GRADES: [
    { id: 'g1', label: '高一' },
    { id: 'g2', label: '高二' },
    { id: 'g3', label: '高三' },
  ],
  CLASSES: [
    { id: 'zhong', label: '忠' },
    { id: 'xiao', label: '孝' },
    { id: 'ren', label: '仁' },
    { id: 'ai', label: '愛' },
    { id: 'other', label: '路過旅客' },
  ],
  SEAT_MIN: 1,
  SEAT_MAX: 25,
  /** 各 Level 字數（教師端還原成就用） */
  LEVEL_WORD_COUNTS: { 1: 1084, 2: 1053, 3: 1053, 4: 1056, 5: 1187, 6: 1292 },
};

function cfgGradeLabel(gradeId) {
  var g = CLASS_CONFIG.GRADES.find(function (x) { return x.id === gradeId; });
  return g ? g.label : gradeId;
}
function cfgClassLabel(classId) {
  var c = CLASS_CONFIG.CLASSES.find(function (x) { return x.id === classId; });
  return c ? c.label : classId;
}
function cfgBuildClassKey(gradeId, classId) {
  if (classId === 'other') return gradeId + '_other';
  return gradeId + '_' + classId;
}
function cfgFormatClassLabel(gradeId, classId) {
  if (classId === 'other') {
    return cfgGradeLabel(gradeId) + ' · ' + cfgClassLabel('other');
  }
  return cfgGradeLabel(gradeId) + cfgClassLabel(classId) + '班';
}
function cfgPadSeat(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s.slice(0, 2);
}
