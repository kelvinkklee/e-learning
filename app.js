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
    endpoint: "https://api.modelarts-maas.com/v2/chat/completions",
    model: "openpangu-2.0-pro",
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  custom: {
    endpoint: "",
    model: "",
  }
};

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
  const s = getAISettings();
  if(!s.endpoint) s.endpoint = AI_PROVIDERS.huawei.endpoint;
  if(!s.model) s.model = AI_PROVIDERS.huawei.model;
  return s;
}

/* 通用 LLM 調用（OpenAI 兼容 /chat/completions） */
async function callLLM(messages, { json=false, maxTokens=1500 } = {}){
  const ai = getAI();
  if(!ai.key) throw new Error('NO_KEY');
  const body = {
    model: ai.model,
    messages: messages,
    temperature: 0.6,
    max_tokens: maxTokens,
  };
  if(json){
    body.response_format = { type: 'json_object' };
  }
  const resp = await fetch(ai.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ai.key,
    },
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
  if(!ai.key){
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
  }catch(e){
    st.className = 'ai-status err';
    st.textContent = t('aiTestFail') + (e.message === 'NO_KEY' ? t('aiFillKey') : e.message);
  }
}

/* AI 出題：生成選擇題 */
async function aiGenerate(){
  const ai = getAI();
  if(!ai.key){ installToast(t('aiNoKey')); go('settings'); return; }

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
  if(!ai.key){ installToast(t('aiNoKey')); go('settings'); return; }

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
