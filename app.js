/* ============================================================
   香港小學樂學 — 互動邏輯
   ============================================================ */

let LANG = localStorage.getItem('hkpl_lang') || 'zh';
let PROGRESS = JSON.parse(localStorage.getItem('hkpl_progress') || '{}');
let COINS = parseInt(localStorage.getItem('hkpl_coins') || '0', 10);
let STREAK = 0;  // 連擊次數

let state = {
  subject: null,   // 科目 id
  grade: null,     // 年級 id
  quiz: [],        // 題目列表
  idx: 0,          // 目前題目
  answers: [],     // 用戶答案（依題型而異）
  correct: 0,      // 答對數
  sortDraft: null, // 排序題草稿 {idx, order}
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
  ['home','units','quiz','result','settings'].forEach(p => $(p).classList.add('hidden'));
  $(page).classList.remove('hidden');
  if(page === 'settings') loadAISettings();
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
    const total = SUBJECTS.reduce((sum, s) => sum + (QUESTIONS[s.id][g]?.length || 0), 0);
    let done = 0;
    SUBJECTS.forEach(s => { done += getProgress(s.id, g).done; });
    const pct = total ? Math.round(done / total * 100) : 0;
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

  // AI 出題按鈕
  const aiBtn = document.createElement('button');
  aiBtn.className = 'btn ghost';
  aiBtn.style.cssText = 'width:100%;margin-top:8px';
  aiBtn.innerHTML = '🤖 <span>' + t('aiGenerate') + '</span>';
  aiBtn.onclick = (e) => { e.stopPropagation(); aiGenerate(); };
  list.appendChild(aiBtn);
}

/* ---------- 測驗 ---------- */
function startQuiz(){
  state.quiz = QUESTIONS[state.subject][state.grade];
  state.idx = 0;
  state.answers = new Array(state.quiz.length).fill(null);
  state.correct = 0;
  state.sortDraft = null;
  matchState = null;
  go('quiz');
  $('quizTitle').textContent = `${subjectName(state.subject)} · ${t(state.grade)}`;
  renderQuestion();
}

function renderQuestion(){
  const q = state.quiz[state.idx];
  const total = state.quiz.length;
  const type = q.type || 'choice';

  // 進度
  $('progTxt').textContent = `${state.idx+1} / ${total}`;
  $('progFill').style.width = (state.idx / total * 100) + '%';
  $('progScore').textContent = `⭐ ${state.correct}`;

  const area = $('qArea');
  const ans = state.answers[state.idx];

  const typeMeta = QTYPE[type] || QTYPE.choice;
  const typeLabel = LANG==='zh' ? typeMeta.zh : typeMeta.en;

  let body = '';
  switch(type){
    case 'fill':   body = renderFill(q, ans); break;
    case 'match':  body = renderMatch(q, ans); break;
    case 'sort':   body = renderSort(q, ans); break;
    case 'listen': body = renderListen(q, ans); break;
    default:       body = renderChoice(q, ans); break;
  }

  area.innerHTML = `
    <div class="qcard">
      <div class="qhead">
        <span class="qnum">${state.idx+1}</span>
        <span class="qtype">${typeMeta.ic} ${typeLabel}</span>
      </div>
      <div class="qstem">${q.q || ''}</div>
      ${q.qe ? `<div class="qstem-en">${q.qe}</div>` : ''}
      ${body}
      ${ans !== null && (q.ex || q.exe) ? `<div class="explain ${LANG==='en'?'en':''}"><b>${t('explain')}：</b>${LANG==='zh' ? (q.ex||q.exe) : (q.exe||q.ex)}</div>` : ''}
    </div>
  `;

  bindQuestion(type, q, ans);

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

/* ---------- 各題型渲染 ---------- */
function renderChoice(q, ans){
  return `<div class="opts">
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
  </div>`;
}

function renderFill(q, ans){
  const val = (typeof ans === 'string') ? ans : '';
  const done = ans !== null;
  const ok = done && ans === true;
  const okArr = q.o || (q.a != null ? [q.a] : []);
  return `
    <div class="fill-wrap">
      <input class="fill-input" id="fillInput" type="text" autocomplete="off"
        placeholder="${t('fillHint')}" value="${val}" ${done?'disabled':''} ${ok?'data-ok="1"':''}>
      ${!done ? `<button class="btn pri fill-check" id="fillCheck">${t('checkFill')}</button>` : ''}
    </div>
    ${done && !ok ? `<div class="fill-answer">${t('correct')} ${okArr.join(' / ')}</div>` : ''}
  `;
}

function renderMatch(q, ans){
  const pairs = q.pairs || [];
  // 左欄順序固定，右欄打亂（用題目內建 seed 保證每次一致）
  const right = pairs.map((p,i)=>p[1]);
  const rightShuffled = shuffleCopy(right, q.seed || state.idx);
  const leftSel = ans ? ans.left : null;    // 目前選中嘅左項 index
  const matched = ans ? ans.matched : {};   // {leftIdx: rightIdx}
  const done = ans !== null;

  return `
    <div class="match-hint">${t('matchHint')}</div>
    <div class="match-grid">
      <div class="match-col">
        ${pairs.map((p,li)=>{
          const done_i = matched[li] !== undefined;
          let cls = 'match-item';
          if(done_i){
            if(matched[li] === li) cls += ' correct';
            else cls += ' wrong';
          } else if(leftSel === li) cls += ' active';
          return `<button class="${cls}" data-li="${li}" ${done?'disabled':''}>${p[0]}</button>`;
        }).join('')}
      </div>
      <div class="match-col">
        ${rightShuffled.map((r,ri)=>{
          const orig = pairs.findIndex(p=>p[1]===r);
          const claimed = Object.entries(matched).some(([k,v])=>v===orig);
          let cls = 'match-item';
          if(claimed) cls += ' done';
          return `<button class="${cls}" data-ri="${orig}" ${done?'disabled':''}>${r}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderSort(q, ans){
  const correct = q.o || [];
  const user = ans || null;
  const done = ans !== null;
  // 未作答：排序區初始為空，候選池放全部詞（已揀嘅依次填入排序區）
  let order;
  if(done){
    order = user; // 用戶提交嘅順序
  } else if(ans === null && state.sortDraft && state.sortDraft.idx === state.idx){
    order = state.sortDraft.order;
  } else {
    order = [];
  }
  const pool = correct.map((_,i)=>i).filter(i=>!order.includes(i));
  const poolShuffled = shuffleCopy(pool, q.seed || (state.idx + 1000));
  return `
    <div class="match-hint">${t('sortHint')}</div>
    <div class="sort-stage" id="sortStage">
      ${order.length === 0 ? `<div class="sort-empty">${t('fillHint')}…</div>` : ''}
      ${order.map((idx,pos)=>{
        let cls = 'sort-chip';
        if(done){
          if(idx === pos) cls += ' correct';
          else cls += ' wrong';
        }
        return `<button class="${cls}" data-i="${idx}" data-pos="${pos}" ${done?'disabled':''}>
          <span class="sort-no">${pos+1}</span>${correct[idx]}</button>`;
      }).join('')}
    </div>
    ${!done && pool.length ? `<div class="sort-pool" id="sortPool">
      ${poolShuffled.map(idx=>`<button class="sort-chip pool" data-i="${idx}">${correct[idx]}</button>`).join('')}
    </div>` : ''}
    ${!done ? `<button class="btn pri sort-submit" id="sortSubmit" ${order.length<correct.length?'disabled':''}>${t('submitSort')}</button>` : ''}
  `;
}

function renderListen(q, ans){
  const canPlay = 'speechSynthesis' in window;
  return `
    <div class="listen-box">
      <button class="btn listen-play" id="listenPlay" onclick="speakQ()" ${!canPlay?'disabled':''}>
        🔊 ${t('playAgain')}
      </button>
    </div>
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
  `;
}

function choose(i){
  const q = state.quiz[state.idx];
  state.answers[state.idx] = i;
  const correct = (i === q.a);
  afterAnswer(correct);
  renderQuestion();
}

/* 統一答題後處理：計分、金幣、連擊、音效 */
function afterAnswer(correct){
  if(correct){
    state.correct++;
    STREAK++;
    addCoins(10);
    playSound('correct');
    spawnConfetti();
    if(STREAK >= 2){ showCombo(STREAK); }
  } else {
    STREAK = 0;
    playSound('wrong');
  }
}

/* ---------- 題型互動綁定 ---------- */
function bindQuestion(type, q, ans){
  const area = $('qArea');
  if(type === 'choice' || type === 'listen'){
    area.querySelectorAll('.opt').forEach(btn => {
      if(btn.disabled) return;
      btn.onclick = () => choose(parseInt(btn.dataset.i));
    });
  } else if(type === 'fill'){
    const inp = $('fillInput');
    const btn = $('fillCheck');
    if(inp && btn){
      btn.onclick = submitFill;
      inp.addEventListener('keydown', e => { if(e.key === 'Enter') submitFill(); });
    }
  } else if(type === 'match'){
    area.querySelectorAll('.match-item').forEach(btn => {
      if(btn.disabled) return;
      btn.onclick = () => matchTap(btn);
    });
  } else if(type === 'sort'){
    area.querySelectorAll('.sort-chip').forEach(btn => {
      if(btn.disabled) return;
      btn.onclick = () => sortTap(btn);
    });
    const sub = $('sortSubmit');
    if(sub) sub.onclick = submitSort;
  }
}

/* ---------- 填充題 ---------- */
function submitFill(){
  const inp = $('fillInput');
  if(!inp) return;
  const q = state.quiz[state.idx];
  const val = inp.value.trim().toLowerCase().replace(/\s+/g,' ');
  if(!val) return;
  const accepted = (q.o || (q.a != null ? [q.a] : [])).map(s =>
    String(s).trim().toLowerCase().replace(/\s+/g,' ')
  );
  const correct = accepted.includes(val);
  state.answers[state.idx] = correct; // true / false
  afterAnswer(correct);
  renderQuestion();
}

/* ---------- 配對題 ---------- */
let matchState = null; // { left: idx, matched: {leftIdx: rightIdx} }
function matchTap(btn){
  const q = state.quiz[state.idx];
  const pairs = q.pairs || [];
  if(!matchState) matchState = { left:null, matched:{} };

  if(btn.dataset.li !== undefined){
    // 點左欄：選中，準備配對
    matchState.left = parseInt(btn.dataset.li);
    renderQuestion();
    return;
  }
  if(btn.dataset.ri !== undefined){
    const ri = parseInt(btn.dataset.ri);
    if(matchState.left === null) return; // 未選左項
    const already = Object.entries(matchState.matched).find(([k,v])=>v===ri);
    if(already) return; // 右項已被配
    matchState.matched[matchState.left] = ri;
    matchState.left = null;
    // 若全部配完，判定
    if(Object.keys(matchState.matched).length === pairs.length){
      submitMatch();
      return;
    }
    renderQuestion();
  }
}
function submitMatch(){
  const q = state.quiz[state.idx];
  const pairs = q.pairs || [];
  const correct = pairs.every((p,i)=> matchState.matched[i] === i);
  state.answers[state.idx] = { left:null, matched: matchState.matched };
  matchState = null;
  afterAnswer(correct);
  renderQuestion();
}

/* ---------- 排序題 ---------- */
function sortTap(btn){
  const q = state.quiz[state.idx];
  const correct = q.o || [];
  const idx = parseInt(btn.dataset.i);
  if(!state.sortDraft || state.sortDraft.idx !== state.idx){
    state.sortDraft = { idx: state.idx, order: [] };
  }
  const order = state.sortDraft.order;
  if(btn.classList.contains('pool')){
    // 從候選池加入排序尾（按正確次序點選）
    if(!order.includes(idx)) order.push(idx);
  } else {
    // 已喺排序區：點擊移回候選池（撤銷）
    const pos = order.indexOf(idx);
    if(pos >= 0) order.splice(pos, 1);
  }
  renderQuestion();
}
function submitSort(){
  const q = state.quiz[state.idx];
  const correct = q.o || [];
  const order = state.sortDraft ? state.sortDraft.order : [];
  if(order.length < correct.length) return;
  const isCorrect = order.every((idx,pos)=> idx === pos);
  state.answers[state.idx] = order.slice();
  state.sortDraft = null;
  afterAnswer(isCorrect);
  renderQuestion();
}

/* ---------- 聽音題 ---------- */
function speakQ(){
  if(!('speechSynthesis' in window)) return;
  const q = state.quiz[state.idx];
  const text = q.text || q.q || '';
  if(!text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (q.lang) || (state.subject === 'eng' ? 'en-US' : 'zh-HK');
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/* 洗牌（可重現，用 seed） */
function shuffleCopy(arr, seed){
  const a = arr.slice();
  let s = (typeof seed === 'number') ? seed : 42;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for(let i = a.length-1; i>0; i--){
    const j = Math.floor(rnd() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
      <button class="btn ghost" onclick="aiAnalyze()">🧠 ${t('aiAnalyze')}</button>
    </div>
    <div class="btn-row" style="margin-top:10px">
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
initBubbles();
initMascot();
updateCoinBar();

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

/* ============================================================
   AI 智能出題 / 批改 / 錯題分析（前端直接 call LLM，兼容 OpenAI 格式）
   ============================================================ */

/* 供應商預設配置 */
const AI_PROVIDERS = {
  huawei: {
    // 經 Cloudflare Worker 代理（繞過 CORS 預檢限制）
    endpoint: "https://hk-learning-llm-proxy.kelvinkklee-hk-learning.workers.dev",
    model: "glm-5.2",
  },
  huawei_direct: {
    endpoint: "https://api-ap-southeast-1.modelarts-maas.com/openai/v1",
    model: "glm-5.2",
  },
  openai: {
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  custom: {
    endpoint: "",
    model: "",
  }
};

/* 將 endpoint 標準化：若以 /openai/v1 或 /v1 結尾（base_url），自動拼 /chat/completions；
   若係完整代理地址（如 Cloudflare Worker），直接使用唔拼 */
function normalizeEndpoint(ep){
  if(!ep) return '';
  ep = ep.trim().replace(/\/+$/,'');
  if(/\/chat\/completions$/i.test(ep)) return ep; // 已是完整 endpoint
  if(/\.workers\.dev$/i.test(ep)) return ep;      // Worker 代理地址，直接使用
  if(/\/v1$/i.test(ep) || /\/openai\/v1$/i.test(ep)) return ep + '/chat/completions';
  // 其他情況：視為 base_url，拼 /chat/completions
  return ep + '/chat/completions';
}

function getAISettings(){
  try{
    return JSON.parse(localStorage.getItem('hkpl_ai') || '{}');
  }catch(e){ return {}; }
}
function setAISettings(s){
  localStorage.setItem('hkpl_ai', JSON.stringify(s));
}

function loadAISettings(){
  const s = getAISettings();
  $('aiProvider').value = s.provider || 'huawei';
  onProviderChange();
  $('aiEndpoint').value = s.endpoint || AI_PROVIDERS[s.provider||'huawei'].endpoint;
  $('aiModel').value = s.model || AI_PROVIDERS[s.provider||'huawei'].model;
  $('aiKey').value = s.key || '';
  const st = $('aiStatus');
  if(st){ st.className = 'ai-status'; st.textContent=''; }
}

function onProviderChange(){
  const p = $('aiProvider').value;
  const cfg = AI_PROVIDERS[p];
  // 只在用戶未手動改過時填入預設（簡化：直接填預設，用戶可再改）
  $('aiEndpoint').value = cfg.endpoint || '';
  $('aiModel').value = cfg.model || '';
}

function saveAISettings(){
  const s = {
    provider: $('aiProvider').value,
    endpoint: $('aiEndpoint').value.trim(),
    model: $('aiModel').value.trim(),
    key: $('aiKey').value.trim(),
  };
  setAISettings(s);
  const st = $('aiStatus');
  st.className = 'ai-status ok';
  st.textContent = t('aiSaved');
  installToast(t('aiSaved'));
}

function getAI(){
  let s = getAISettings();
  // 若設定頁欄位存在，優先讀取即時輸入（用戶可能未撳儲存）
  const el = $('aiKey');
  if(el){
    s = {
      provider: $('aiProvider') ? $('aiProvider').value : (s.provider || 'huawei'),
      endpoint: $('aiEndpoint') ? $('aiEndpoint').value.trim() : s.endpoint,
      model: $('aiModel') ? $('aiModel').value.trim() : s.model,
      key: el.value.trim(),
    };
  }
  if(!s.endpoint) s.endpoint = AI_PROVIDERS.huawei.endpoint;
  if(!s.model) s.model = AI_PROVIDERS.huawei.model;
  return s;
}

/* 通用 LLM 調用（OpenAI 兼容 /chat/completions） */
async function callLLM(messages, { json=false, maxTokens=1500 } = {}){
  const ai = getAI();
  const url = normalizeEndpoint(ai.endpoint);
  // 判斷係咪經 Worker 代理（代理有內置 secret，key 可選）
  const isProxy = /\.workers\.dev/i.test(url);
  if(!ai.key && !isProxy) throw new Error('NO_KEY');
  const body = {
    model: ai.model,
    messages: messages,
    temperature: 0.6,
    max_tokens: maxTokens,
  };
  // 若為推理模型（如 glm），關閉 thinking 以加快速度及節省 token
  if(/glm/i.test(ai.model)){
    body.thinking = { type: 'disabled' };
  }
  if(json){
    body.response_format = { type: 'json_object' };
  }
  const headers = { 'Content-Type': 'application/json' };
  if(ai.key){
    headers['Authorization'] = 'Bearer ' + ai.key;
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error('HTTP ' + resp.status + ' ' + txt.slice(0,200));
  }
  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : (data.choices && data.choices[0] && data.choices[0].text) || '';
  return content;
}

async function testAIConnection(){
  const ai = getAI();
  const st = $('aiStatus');
  const isProxy = /\.workers\.dev/i.test(normalizeEndpoint(ai.endpoint));
  if(!ai.key && !isProxy){
    st.className = 'ai-status err';
    st.textContent = t('aiFillKey');
    return;
  }
  st.className = 'ai-status loading';
  st.innerHTML = '<span class="spinner"></span>' + t('aiGenerating');
  try{
    const content = await callLLM([
      { role:'system', content:'你是香港小學教育助手，用繁體中文簡短回應。' },
      { role:'user', content:'請回覆「連接成功」四個字。' }
    ], { maxTokens: 50 });
    st.className = 'ai-status ok';
    st.textContent = t('aiTestOk') + ' · ' + content.slice(0, 60);
    // 測試成功，自動儲存設定，方便後續出題
    saveAISettings();
    st.textContent = t('aiTestOk') + ' · ' + content.slice(0, 60) + ' （已自動儲存）';
  }catch(e){
    st.className = 'ai-status err';
    st.textContent = t('aiTestFail') + (e.message === 'NO_KEY' ? t('aiFillKey') : e.message);
  }
}

/* AI 出題：生成選擇題 */
async function aiGenerate(){
  const ai = getAI();
  const isProxy = /\.workers\.dev/i.test(normalizeEndpoint(ai.endpoint));
  if(!ai.key && !isProxy){ installToast(t('aiNoKey')); go('settings'); return; }

  // 收集題材
  const topic = prompt(t('aiGenTopic'), '');
  if(topic === null) return; // 取消

  installToast(t('aiGenerating'));
  const subjectZh = subjectName(state.subject);
  const gradeZh = t(state.grade || 'p1');
  const system = `你是香港小學教育專家，精通香港教育局課程。請為「${gradeZh} ${subjectZh}」生成 3 條關於「${topic}」的選擇題。
要求：
1. 題目難度必須符合香港${gradeZh}水平
2. 用繁體中文出題（英文科可用英文）
3. 每題 4 個選項（A-D），只有一個正確答案
4. 每題附簡短中文解釋
5. 嚴格輸出 JSON，格式如下：
{"questions":[{"q":"題目","options":["A選項","B選項","C選項","D選項"],"answer":0,"explain":"解釋"}]}
其中 answer 是正確選項的索引（0-3）。`;

  try{
    const content = await callLLM([
      { role:'system', content: system },
      { role:'user', content: `請生成關於「${topic}」的${gradeZh}${subjectZh}練習題` }
    ], { json:true, maxTokens: 2000 });

    // 解析 JSON
    const jsonStr = content.replace(/```json/gi,'').replace(/```/g,'').trim();
    let parsed;
    try{
      parsed = JSON.parse(jsonStr);
    }catch(e){
      const m = jsonStr.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if(!parsed || !parsed.questions || !parsed.questions.length){
      throw new Error('AI 回傳格式異常');
    }

    // 轉成 app 題目格式，加入 quiz
    const newQs = parsed.questions.map((q,i) => ({
      q: q.q || q.question || ('題目'+(i+1)),
      qe: q.qe || q.q_en || '',
      o: q.options || q.o || [],
      a: typeof q.answer === 'number' ? q.answer : parseInt(q.answer),
      ex: q.explain || q.ex || '',
      exe: q.explain_en || '',
      ai: true,
    })).filter(q => q.o.length >= 2 && q.a >= 0 && q.a < q.o.length);

    if(!newQs.length) throw new Error('AI 生成嘅題目無效');

    state.quiz = newQs;
    state.idx = 0;
    state.answers = new Array(newQs.length).fill(null);
    state.correct = 0;
    go('quiz');
    $('quizTitle').textContent = `${subjectName(state.subject)} · ${gradeZh} · AI`;
    renderQuestion();
    installToast('✅ AI 已生成 ' + newQs.length + ' 題');
  }catch(e){
    installToast(t('aiTestFail') + (e.message === 'NO_KEY' ? t('aiFillKey') : e.message));
  }
}

/* AI 批改 + 錯題分析 */
async function aiAnalyze(){
  const ai = getAI();
  const isProxy = /\.workers\.dev/i.test(normalizeEndpoint(ai.endpoint));
  if(!ai.key && !isProxy){ installToast(t('aiNoKey')); go('settings'); return; }

  // 收集錯題
  const wrong = [];
  state.quiz.forEach((q,i) => {
    if(state.answers[i] !== null && state.answers[i] !== q.a){
      wrong.push({
        q: q.q,
        options: q.o,
        userAnswer: q.o[state.answers[i]],
        correctAnswer: q.o[q.a],
      });
    }
  });

  const subjectZh = subjectName(state.subject);
  const gradeZh = t(state.grade || 'p1');

  installToast(t('aiGenerating'));

  const system = `你是香港小學補習導師，用繁體中文（可夾雜粵語口吻，但保持專業）。請針對學生以下錯題，做一份簡潔嘅錯題分析報告：
1. 逐題指出錯誤原因
2. 講解正確做法
3. 總結需要重點溫習嘅知識點
4. 給出 2-3 條溫習建議
用 Markdown 格式輸出。`;

  const wrongText = wrong.length
    ? wrong.map((w,i)=>`第${i+1}題：${w.q}\n學生答案：${w.userAnswer}\n正確答案：${w.correctAnswer}`).join('\n\n')
    : '（今次全部答啱，冇錯題）';

  try{
    const content = await callLLM([
      { role:'system', content: system },
      { role:'user', content: `科目：${subjectZh} ${gradeZh}\n總題數：${state.quiz.length}，答對：${state.correct} 題\n\n錯題如下：\n${wrongText}` }
    ], { maxTokens: 1500 });

    showAIReport(content);
  }catch(e){
    installToast(t('aiTestFail') + (e.message === 'NO_KEY' ? t('aiFillKey') : e.message));
  }
}

function showAIReport(markdown){
  // 建立一個全屏 modal 顯示報告
  let modal = $('aiReportModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'aiReportModal';
    modal.className = 'ai-modal';
    modal.innerHTML = `
      <div class="ai-modal-box">
        <div class="ai-modal-head">
          <h3>${t('aiResult')}</h3>
          <button onclick="closeAIReport()">✕</button>
        </div>
        <div class="ai-modal-body" id="aiReportBody"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  // 簡單 markdown 轉 html
  const html = markdown
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.*)$/gm,'<h4>$1</h4>')
    .replace(/^## (.*)$/gm,'<h3>$1</h3>')
    .replace(/^# (.*)$/gm,'<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')
    .replace(/^- (.*)$/gm,'<li>$1</li>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/\n/g,'<br>');
  $('aiReportBody').innerHTML = '<p>' + html + '</p>';
  modal.style.display = 'flex';
}

function closeAIReport(){
  const modal = $('aiReportModal');
  if(modal) modal.style.display = 'none';
}

/* ============================================================
   遊戲化系統：金幣、連擊、音效、星星、氣泡、吉祥物
   ============================================================ */

function addCoins(n){
  COINS += n;
  localStorage.setItem('hkpl_coins', COINS);
  updateCoinBar();
}
function updateCoinBar(){
  const el = $('coinCount');
  if(el) el.textContent = COINS;
}

/* 音效（Web Audio 合成，唔使外置檔案） */
let audioCtx = null;
function playSound(type){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if(type === 'correct'){
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    }
  }catch(e){ /* 音效失敗唔影響功能 */ }
}

function spawnConfetti(){
  const emojis = ['⭐','🌟','✨','💫','🎉'];
  for(let i=0;i<6;i++){
    const el = document.createElement('div');
    el.className = 'confetti';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = (10 + Math.random()*80) + '%';
    el.style.top = (20 + Math.random()*40) + '%';
    el.style.fontSize = (18 + Math.random()*18) + 'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1500);
  }
}

function showCombo(n){
  const el = document.createElement('div');
  el.className = 'combo';
  el.textContent = '🔥 ' + n + ' 連擊!';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 800);
}

/* 氣泡背景 */
function initBubbles(){
  const wrap = $('bubbles');
  if(!wrap) return;
  const colors = ['#fde68a','#ddd6fe','#fbcfe8','#bfdbfe','#bbf7d0'];
  for(let i=0;i<12;i++){
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 20 + Math.random()*60;
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    b.style.left = Math.random()*100 + '%';
    b.style.top = Math.random()*100 + '%';
    b.style.background = colors[i % colors.length];
    b.style.animationDuration = (6 + Math.random()*6) + 's';
    b.style.animationDelay = (Math.random()*4) + 's';
    wrap.appendChild(b);
  }
}

/* 吉祥物（可愛貓頭鷹 SVG） */
function initMascot(){
  const el = $('mascot');
  if(!el) return;
  el.innerHTML = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="58" rx="34" ry="32" fill="#7c3aed"/>
    <ellipse cx="50" cy="60" rx="24" ry="22" fill="#a78bfa"/>
    <ellipse cx="50" cy="62" rx="18" ry="16" fill="#f5f3ff"/>
    <circle cx="38" cy="38" r="12" fill="#fff"/>
    <circle cx="62" cy="38" r="12" fill="#fff"/>
    <circle cx="40" cy="40" r="6" fill="#3d2b4f"/>
    <circle cx="64" cy="40" r="6" fill="#3d2b4f"/>
    <circle cx="41" cy="39" r="2.2" fill="#fff"/>
    <circle cx="65" cy="39" r="2.2" fill="#fff"/>
    <path d="M50 46 L46 54 L54 54 Z" fill="#f97316"/>
    <path d="M20 58 L50 70 L80 58" fill="none" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="20" cy="40" rx="5" ry="3" fill="#f97316"/>
    <ellipse cx="80" cy="40" rx="5" ry="3" fill="#f97316"/>
    <path d="M28 20 L32 10 L38 20 Z" fill="#f43f5e"/>
    <path d="M62 20 L68 10 L72 20 Z" fill="#f43f5e"/>
    <circle cx="34" cy="80" r="5" fill="#f97316"/>
    <circle cx="66" cy="80" r="5" fill="#f97316"/>
  </svg>`;
}
