/* ─── State ─────────────────────────────────────────────────────────────── */

const state = {
  tone:    '',
  types:   [],
  desc:    '',
  context: {}
};

/* ─── DOM References ────────────────────────────────────────────────────── */

const textarea    = document.getElementById('productDesc');
const charCount   = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const loadingSub  = document.getElementById('loadingSub');
const outputMeta  = document.getElementById('outputMeta');
const outputGrid  = document.getElementById('outputGrid');
const errorCard   = document.getElementById('errorCard');
const exportBar   = document.getElementById('exportBar');
const chipsHint   = document.getElementById('chipsHint');
const narrowToggle = document.getElementById('narrowToggle');
const narrowPanel  = document.getElementById('narrowPanel');
const inputArea    = document.getElementById('productArea');
const inputScreen  = document.getElementById('screenOrFlow');
const inputUser    = document.getElementById('whoIsUser');

/* ─── Narrow Toggle ─────────────────────────────────────────────────────── */

narrowToggle.addEventListener('click', () => {
  const isOpen = narrowPanel.classList.toggle('open');
  narrowToggle.classList.toggle('open', isOpen);
  narrowToggle.setAttribute('aria-expanded', isOpen);
  narrowPanel.setAttribute('aria-hidden', !isOpen);
  if (isOpen) inputArea.focus();
});

/* ─── Product Input ─────────────────────────────────────────────────────── */

textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = len;
  charCount.classList.toggle('near-limit', len > 160);
  updateBtn();
});

/* ─── Tone Selection ────────────────────────────────────────────────────── */

document.querySelectorAll('.tone-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.tone-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.tone = card.dataset.tone;
    updateBtn();
  });
});

/* ─── Copy Type Chips ───────────────────────────────────────────────────── */

document.querySelectorAll('.copy-type-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    updateBtn();
    updateChipsHint();
  });
});

function selectAll() {
  document.querySelectorAll('.copy-type-chip').forEach(c => c.classList.add('selected'));
  updateBtn();
  updateChipsHint();
}

function clearAll() {
  document.querySelectorAll('.copy-type-chip').forEach(c => c.classList.remove('selected'));
  updateBtn();
  updateChipsHint();
}

function updateChipsHint() {
  const anySelected = document.querySelector('.copy-type-chip.selected');
  chipsHint.classList.toggle('visible', !anySelected);
}

/* ─── Generate Button State ─────────────────────────────────────────────── */

function updateBtn() {
  const hasDesc  = textarea.value.trim().length > 0;
  const hasTone  = state.tone !== '';
  const hasTypes = document.querySelector('.copy-type-chip.selected') !== null;
  generateBtn.disabled = !(hasDesc && hasTone && hasTypes);
}

/* ─── Keyboard Shortcuts ────────────────────────────────────────────────── */

document.addEventListener('keydown', e => {
  const step1Active = document.getElementById('step1').classList.contains('active');
  const step3Active = document.getElementById('step3').classList.contains('active');

  if (e.key === 'Escape' && step3Active) goBack();
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && step1Active && !generateBtn.disabled) {
    e.preventDefault();
    generate();
  }
});

/* ─── Step Navigation ───────────────────────────────────────────────────── */

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() { showStep(1); }

/* ─── Generate ──────────────────────────────────────────────────────────── */

const loadingMessages = [
  'Tuning the tone',
  'Crafting your error states',
  'Writing the empty states',
  'Finding the right words',
  'Polishing every line',
  'Making it consistent',
  'Almost there'
];

async function generate() {
  state.desc  = textarea.value.trim();
  state.tone  = document.querySelector('.tone-card.selected')?.dataset.tone || state.tone;
  state.types = [...document.querySelectorAll('.copy-type-chip.selected')].map(c => c.dataset.type);
  state.context = {
    productArea:  inputArea.value.trim(),
    screenOrFlow: inputScreen.value.trim(),
    whoIsUser:    inputUser.value.trim()
  };

  showStep(2);

  let msgIdx = 0;
  loadingSub.textContent = loadingMessages[0];
  const interval = setInterval(() => {
    loadingSub.style.opacity = '0';
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      loadingSub.textContent = loadingMessages[msgIdx];
      loadingSub.style.opacity = '1';
    }, 150);
  }, 1800);

  try {
    const parsed = await API.generateAll(state.desc, state.tone, state.types, state.context);
    clearInterval(interval);
    renderOutput(parsed);
  } catch (err) {
    clearInterval(interval);
    showStep(3);
    showError(err);
  }
}

/* ─── Error Rendering ───────────────────────────────────────────────────── */

function getErrorMessage(err) {
  const messages = {
    RATE_LIMIT:   'Rate limit reached. Wait a moment and try again.',
    SERVER_ERROR: 'The server ran into an issue. Try again in a few seconds.',
    API_ERROR:    err.message || 'Something went wrong. Please try again.'
  };
  return messages[err.code] || messages.API_ERROR;
}

function showError(err) {
  errorCard.innerHTML = `<strong>Couldn't generate copy.</strong> ${getErrorMessage(err)}`;
  errorCard.style.display = 'block';
  exportBar.classList.remove('visible');
  outputGrid.innerHTML = '';
}

/* ─── Output Rendering ──────────────────────────────────────────────────── */

function renderOutput(parsed) {
  showStep(3);
  outputMeta.textContent = `${state.tone} tone · ${state.types.length} state${state.types.length !== 1 ? 's' : ''} · ${state.desc.substring(0, 40)}${state.desc.length > 40 ? '…' : ''}`;
  errorCard.style.display = 'none';
  outputGrid.innerHTML = '';

  let delay = 0;
  state.types.forEach(type => {
    const copy = parsed.copy?.[type];
    if (!copy) return;
    outputGrid.appendChild(createOutputCard(type, copy, delay));
    delay += 80;
  });

  exportBar.classList.add('visible');
}

function createOutputCard(type, text, delay) {
  const id   = cardId(type);
  const card = document.createElement('div');
  card.className = 'output-card';
  card.style.animationDelay = delay + 'ms';

  card.innerHTML = `
    <div class="output-card-header">
      <span class="output-type-badge">${escHtml(type)}</span>
      <div class="output-card-actions">
        <button class="icon-btn regen-btn" title="Regenerate this copy">
          <svg viewBox="0 0 14 14"><path d="M12 7A5 5 0 112 7"/><path d="M12 3v4h-4"/></svg>
        </button>
        <button class="icon-btn copy-btn" title="Copy to clipboard">
          <svg class="icon-copy" viewBox="0 0 14 14"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V3a1 1 0 011-1h7"/></svg>
          <svg class="icon-check" viewBox="0 0 14 14" style="display:none"><polyline points="2,7 6,11 12,3"/></svg>
        </button>
      </div>
    </div>
    <div class="output-copy-text" id="${id}"></div>
  `;

  card.querySelector('.output-copy-text').textContent = text;
  card.querySelector('.regen-btn').addEventListener('click', function () { regenerateCard(this, type, id); });
  card.querySelector('.copy-btn').addEventListener('click', function () { copyCard(this, id); });

  return card;
}

/* ─── Regenerate Single Card ────────────────────────────────────────────── */

async function regenerateCard(btn, type, id) {
  const el = document.getElementById(id);
  btn.classList.add('spinning');
  btn.disabled = true;
  el.style.opacity = '0.35';

  try {
    el.textContent = await API.regenerateCard(type, state.desc, state.tone, state.context);
  } catch {}

  btn.classList.remove('spinning');
  btn.disabled = false;
  el.style.opacity = '1';
}

/* ─── Copy Card ─────────────────────────────────────────────────────────── */

function copyCard(btn, id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.textContent).then(() => {
    btn.classList.add('copied');
    btn.querySelector('.icon-copy').style.display = 'none';
    btn.querySelector('.icon-check').style.display = 'block';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.querySelector('.icon-copy').style.display = 'block';
      btn.querySelector('.icon-check').style.display = 'none';
    }, 1500);
  });
}

/* ─── Export ────────────────────────────────────────────────────────────── */

function copyAll() {
  const text = state.types
    .map(t => { const el = document.getElementById(cardId(t)); return el ? `[${t}]\n${el.textContent}` : ''; })
    .filter(Boolean).join('\n\n');
  navigator.clipboard.writeText(text);
}

function downloadTxt() {
  const text = state.types
    .map(t => { const el = document.getElementById(cardId(t)); return el ? `[${t}]\n${el.textContent}` : ''; })
    .filter(Boolean).join('\n\n---\n\n');
  triggerDownload('tono-copy.txt', text, 'text/plain');
}

function downloadJson() {
  const copy = {};
  state.types.forEach(t => { const el = document.getElementById(cardId(t)); if (el) copy[t] = el.textContent; });
  const out = { tone: state.tone, product: state.desc, generated: new Date().toISOString(), copy };
  triggerDownload('tono-copy.json', JSON.stringify(out, null, 2), 'application/json');
}

function triggerDownload(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function cardId(type)  { return 'text-' + type.replace(/[^a-z0-9]/gi, '_'); }
function escHtml(str)  { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
