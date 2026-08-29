/* ============================================================
   香港小學樂學 — 互動邏輯
   ============================================================ */

let LANG = localStorage.getItem('hkpl_lang') || 'zh';
let PROGRESS = JSON.parse(localStorage.getItem('hkpl_progress') || '{}');

let state = {
  subject: null,   // 科目 id
  grade: null,     // 年級 id
  quiz: [],        // 題目列表
  idx: 0,          // 目前題目
  answers: [],     // 用戶答案（index）
  correct: 0,      // 答對數
};

const $ = (id) => document.getElementById(id);

function t(key){ return (I18N[LANG] && I18N[LANG][key]) || key; }
function gradeWord(g){ return t(g); }
function subjectName(s){ const o = SUBJECTS.find(x=>x.id===s); return LANG==='zh' ? o.zh : o.en; }

/* ---------- 語言切換 ---------- */
function toggleLang(){
  LANG = (LANG === 'zh') ? 'en' : 'zh';
  localStorage.setItem('hkpl_lang', LANG);
  applyLang();
  render();
}

function applyLang(){
  document.body.classList.toggle('en', LANG==='en');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  $('langIco').textContent = LANG==='zh' ? '中' : 'En';
}

/* ---------- 進度存取 ---------- */
function progressKey(subject, grade){
  return subject + ':' + grade;
}
function getProgress(subject, grade){
  const k = progressKey(subject, grade);
  const p = PROGRESS[k] || { done:0, total:0, best:0 };
  return p;
}
function setProgress(subject, grade, done, total, score, best){
  const k = progressKey(subject, grade);
  PROGRESS[k] = { done: Math.max(done, PROGRESS[k]?.done||0), total, score, best: Math.max(best, PROGRESS[k]?.best||0) };
  localStorage.setItem('hkpl_progress', JSON.stringify(PROGRESS));
}

/* ---------- 導航 ---------- */
function go(page){
  ['home','units','quiz','result'].forEach(p => $(p).classList.add('hidden'));
  $(page).classList.remove('hidden');
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- 渲染 ---------- */
function render(){
  applyLang();
  renderGrades();
  renderSubjects();
  if(!$('units').classList.contains('hidden')) renderUnits();
}

function renderGrades(){
  const list = $('gradeList');
  list.innerHTML = '';
  GRADES.forEach(g => {
    const total = SUBJECTS.length * 4; // 每科4題
    let done = 0;
    SUBJECTS.forEach(s => { done += getProgress(s.id, g).done; });
    const pct = Math.round(done / total * 100);
    const d = document.createElement('div');
    d.className = 'grade' + (state.grade===g ? ' active' : '');
    d.innerHTML = `
      <div class="lv">${t('gradeWord')}</div>
      <div class="num">${g.toUpperCase().replace('P','')}</div>
      <div class="tag">${t(g)}</div>
      ${pct>0 ? `<div class="pct">${t('done')} ${pct}%</div>` : ''}
    `;
    d.onclick = () => { state.grade = g; go('units'); renderUnits(); };
    list.appendChild(d);
  });
}

function renderSubjects(){
  const list = $('subjectList');
  list.innerHTML = '';
  SUBJECTS.forEach(s => {
    const d = document.createElement('div');
    d.className = 'subject';
    const cn = s.zh, en = s.en;
    d.innerHTML = `
      <div class="bar" style="background:${s.color}"></div>
      <div class="ic" style="background:${s.color}22">${s.ic}</div>
      <div class="nm">${LANG==='zh' ? cn : en}</div>
      <div class="en">${LANG==='zh' ? en : cn}</div>
      <div class="desc">${LANG==='zh' ? s.descZh : s.descEn}</div>
    `;
    d.onclick = () => {
      state.subject = s.id;
      if(!state.grade){ state.grade = 'p1'; }
      go('units'); renderUnits();
    };
    list.appendChild(d);
  });
}

function renderUnits(){
  $('unitsTitle').textContent =
    `${subjectName(state.subject)} · ${t(state.grade)}`;
  const unit = CURRICULUM[state.subject][state.grade];
  $('unitsSub').textContent = LANG==='zh' ? unit.zh : unit.en;

  const list = $('unitList');
  list.innerHTML = '';
  const s = SUBJECTS.find(x=>x.id===state.subject);
  const prog = getProgress(state.subject, state.grade);
  const d = document.createElement('div');
  d.className = 'unit';
  d.style.borderLeftColor = s.color;
  d.innerHTML = `
    <div class="top">
      <span class="code ${s.code}" style="background:${s.color}">${LANG==='zh'?s.zh:s.en}</span>
      <span class="ttl">${LANG==='zh' ? unit.zh : unit.en}</span>
    </div>
    <div class="en">${LANG==='zh' ? unit.en : unit.zh}</div>
    <div class="lo">📌 ${LANG==='zh' ? unit.lo.zh : unit.lo.en}</div>
    <div class="meta">
      ${unit.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      ${prog.done>0 ? `<span class="tag" style="color:var(--ok);background:#ecf9f1">✓ ${t('done')} ${prog.done}/${prog.total}</span>` : ''}
      ${prog.best>0 ? `<span class="tag" style="color:var(--brand);background:#eef4ff">🏆 ${prog.best}/${prog.total}</span>` : ''}
    </div>
  `;
  d.onclick = () => startQuiz();
  list.appendChild(d);
}

/* ---------- 測驗 ---------- */
function startQuiz(){
  state.quiz = QUESTIONS[state.subject][state.grade];
  state.idx = 0;
  state.answers = new Array(state.quiz.length).fill(null);
  state.correct = 0;
  go('quiz');
  $('quizTitle').textContent = `${subjectName(state.subject)} · ${t(state.grade)}`;
  renderQuestion();
}

function renderQuestion(){
  const q = state.quiz[state.idx];
  const total = state.quiz.length;

  // 進度
  $('progTxt').textContent = `${state.idx+1} / ${total}`;
  $('progFill').style.width = (state.idx / total * 100) + '%';
  $('progScore').textContent = `⭐ ${state.correct}`;

  // 題目
  const area = $('qArea');
  const ans = state.answers[state.idx];
  area.innerHTML = `
    <div class="qcard">
      <div class="qhead">
        <span class="qnum">${state.idx+1}</span>
        <span class="qtype">${LANG==='zh' ? subjectName(state.subject) : subjectName(state.subject)}</span>
      </div>
      <div class="qstem">${q.q}</div>
      <div class="qstem-en">${q.qe}</div>
      <div class="opts">
        ${q.o.map((opt,i)=>{
          let cls = 'opt';
          if(ans !== null){
            if(i === q.a) cls += ' correct';
            else if(i === ans) cls += ' wrong';
          }
          return `<button class="${cls}" data-i="${i}" ${ans!==null?'disabled':''}>
            <span class="k">${String.fromCharCode(65+i)}</span>
            <span>${opt}</span>
          </button>`;
        }).join('')}
      </div>
      ${ans !== null ? `<div class="explain ${LANG==='en'?'en':''}"><b>${t('explain')}：</b>${LANG==='zh'?q.ex:q.exe}</div>` : ''}
    </div>
  `;

  area.querySelectorAll('.opt').forEach(btn => {
    if(btn.disabled) return;
    btn.onclick = () => choose(parseInt(btn.dataset.i));
  });

  // 按鈕
  const btns = $('quizBtns');
  if(ans === null){
    btns.innerHTML = `<button class="btn ghost" onclick="go('units')">${t('backUnit')}</button>`;
  } else {
    btns.innerHTML = `
      <button class="btn ghost" onclick="go('units')">${t('backUnit')}</button>
      ${state.idx < total-1
        ? `<button class="btn pri" onclick="nextQ()">${t('next')} →</button>`
        : `<button class="btn pri" onclick="finishQuiz()">${t('seeResult')} →</button>`}
    `;
  }
}

function choose(i){
  const q = state.quiz[state.idx];
  state.answers[state.idx] = i;
  if(i === q.a){
    state.correct++;
    // 簡單音效可選，略
  }
  renderQuestion();
}

function nextQ(){
  state.idx++;
  renderQuestion();
}

function finishQuiz(){
  const total = state.quiz.length;
  const score = state.correct;
  setProgress(state.subject, state.grade, total, total, score, score);

  const pct = score / total;
  let cls = 'low', stars = '⭐', msg = t('starsOk');
  if(pct >= 0.9){ cls='good'; stars='⭐⭐⭐'; msg=t('starsGreat'); }
  else if(pct >= 0.6){ cls='mid'; stars='⭐⭐'; msg=t('starsGood'); }

  go('result');
  $('resultBox').innerHTML = `
    <div class="score ${cls}">${score} / ${total}</div>
    <div class="stars">${stars}</div>
    <h2 style="margin:8px 0">${msg}</h2>
    <p>${subjectName(state.subject)} · ${t(state.grade)}</p>
    <div class="btn-row">
      <button class="btn pri" onclick="startQuiz()">${t('retry')}</button>
      <button class="btn ghost" onclick="go('units')">${t('backUnit')}</button>
      <button class="btn ghost" onclick="go('home')">${t('back')}</button>
    </div>
  `;
}

/* ---------- 安裝（PWA） ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBtn();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallBtn();
  installToast(t('installed'));
});

function showInstallBtn(){
  const bar = $('installBar');
  if(bar) bar.classList.remove('hidden');
}
function hideInstallBtn(){
  const bar = $('installBar');
  if(bar) bar.classList.add('hidden');
}
function installApp(){
  if(!deferredPrompt){ installToast(t('installHint')); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(()=>{ deferredPrompt=null; hideInstallBtn(); });
}
function installToast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>el.classList.add('show'), 50);
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 400); }, 2600);
}

/* ---------- 初始化 ---------- */
render();
initInstallUI();
handleDeepLink();

function initInstallUI(){
  // 於首頁插入安裝按鈕列
  const bar = document.createElement('div');
  bar.id = 'installBar';
  bar.className = 'install-bar hidden';
  bar.innerHTML = `<button class="btn pri" onclick="installApp()">📲 <span data-i18n="installNow">安裝 App</span></button>`;
  const wrap = document.querySelector('.wrap');
  if(wrap) wrap.insertBefore(bar, wrap.firstChild);
  // iOS 獨立模式隱藏
  if(window.navigator.standalone){ hideInstallBtn(); }
}

function handleDeepLink(){
  const p = new URLSearchParams(location.search);
  const subj = p.get('subject');
  if(subj && SUBJECTS.some(s=>s.id===subj)){
    state.subject = subj;
    if(!state.grade) state.grade = 'p1';
    go('units'); renderUnits();
  }
}
