import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- staat ----------
let user = null;
let CARDS = [];
let progress = {}; // card_id -> {known, times_seen, times_correct}
let QLEN = 10;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tag = (bron) => `<span class="tag ${bron.toLowerCase()}">${bron}</span>`;
const isKnown = (id) => !!(progress[id] && progress[id].known);

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
}

// ---------- opslaan in Supabase ----------
async function saveProgress(cardId, change) {
  const p = progress[cardId] || { known: false, times_seen: 0, times_correct: 0 };
  Object.assign(p, change);
  progress[cardId] = p;
  const { error } = await sb.from("card_progress").upsert({
    user_id: user.id, card_id: cardId,
    known: p.known, times_seen: p.times_seen, times_correct: p.times_correct,
    updated_at: new Date().toISOString(),
  });
  if (error) showError("Opslaan van je voortgang lukte niet: " + error.message);
}

async function saveQuizResult(mode, total, score) {
  const { error } = await sb.from("quiz_results").insert({ user_id: user.id, mode, total, score });
  if (error) showError("Opslaan van je quizuitslag lukte niet: " + error.message);
}

// ---------- inloggen ----------
function renderLogin(sent) {
  $("app").style.display = "none";
  $("login").style.display = "flex";
  $("login").innerHTML = sent
    ? `<div class="panel"><h2>Check je mail</h2><p style="margin:0">We hebben een inloglink gestuurd naar <strong>${esc(sent)}</strong>. Open die link op dit apparaat om in te loggen.</p><button class="btn" id="l-back">Ander e-mailadres</button></div>`
    : `<form class="panel" id="l-form"><h2>Inloggen</h2>
        <p class="small" style="margin:0">Je krijgt een link per mail; een wachtwoord is niet nodig.</p>
        <label for="l-email" style="display:flex;flex-direction:column;gap:4px;font-size:14px">E-mailadres
          <input id="l-email" type="email" required autocomplete="email" class="input"></label>
        <button class="btn primary" type="submit" id="l-send">Stuur inloglink</button></form>`;
  if (sent) { $("l-back").onclick = () => renderLogin(); return; }
  $("l-form").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("l-email").value.trim();
    $("l-send").disabled = true;
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.origin + location.pathname },
    });
    $("l-send").disabled = false;
    if (error) showError("Inloglink versturen lukte niet: " + error.message);
    else { showError(""); renderLogin(email); }
  };
}

// ---------- data laden ----------
async function loadData() {
  $("login").style.display = "none";
  $("app").style.display = "flex";
  $("who").textContent = user.email;
  $("view-cards").innerHTML = '<div class="empty">Kaarten laden…</div>';
  const [c, p] = await Promise.all([
    sb.from("cards").select("*").order("volgorde"),
    sb.from("card_progress").select("card_id, known, times_seen, times_correct"),
  ]);
  if (c.error) { showError("Kaarten laden lukte niet: " + c.error.message); return; }
  if (p.error) showError("Voortgang laden lukte niet: " + p.error.message);
  CARDS = c.data || [];
  progress = {};
  (p.data || []).forEach((r) => { progress[r.card_id] = r; });
  fillGroups(); buildDeck(); quiz = null; renderQuiz(); setTab(tab);
}

// ---------- filters ----------
const fBron = $("f-bron"), fGroep = $("f-groep");
function fillGroups() {
  const cur = fGroep.value || "alle", b = fBron.value, seen = [];
  CARDS.forEach((c) => { if ((b === "alle" || c.bron === b) && !seen.includes(c.groep)) seen.push(c.groep); });
  fGroep.innerHTML = '<option value="alle">Alle onderdelen</option>' + seen.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  fGroep.value = seen.includes(cur) ? cur : "alle";
}
function filtered() {
  const b = fBron.value, g = fGroep.value;
  return CARDS.filter((c) => (b === "alle" || c.bron === b) && (g === "alle" || c.groep === g));
}

// ---------- FLASHCARDS ----------
let deck = [], pos = 0, flipped = false, onlyOpen = false;
function buildDeck() {
  let list = filtered();
  if (onlyOpen) list = list.filter((c) => !isKnown(c.id));
  deck = shuffle(list); pos = 0; flipped = false; renderCards();
}
function renderCards() {
  const all = filtered(), nKnown = all.filter((c) => isKnown(c.id)).length, v = $("view-cards");
  const head = `<div class="meta"><span>${nKnown} van ${all.length} gemarkeerd als gekend</span>
    <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="only-open" ${onlyOpen ? "checked" : ""}> alleen nog te leren</label></div>
    <div class="progress" aria-hidden="true"><div style="width:${all.length ? Math.round((nKnown / all.length) * 100) : 0}%"></div></div>`;
  if (!deck.length) {
    v.innerHTML = head + `<div class="empty">${onlyOpen ? "Alles in deze selectie ken je al. Zet het vinkje uit om te herhalen." : "Geen kaarten in deze selectie."}</div>`;
    bindOnlyOpen(); return;
  }
  const c = deck[pos];
  v.innerHTML = head +
    `<div class="card" id="card" role="button" tabindex="0" aria-label="Kaart omdraaien">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${tag(c.bron)}<span class="grp">${esc(c.groep)}</span></div>
      <p class="q">${esc(c.vraag)}</p>
      ${flipped ? `<p class="a">${esc(c.antwoord)}</p>${c.uitleg ? `<p class="u">${esc(c.uitleg)}</p>` : ""}` : ""}
      <div class="hint">${flipped ? "Tik om de vraag weer te zien" : "Tik om het antwoord te zien"}</div></div>` +
    (flipped
      ? `<div class="row"><button class="btn" id="b-again">Nog oefenen</button><button class="btn good" id="b-known">${isKnown(c.id) ? "✓ Gekend" : "Ken ik"}</button></div>`
      : `<button class="btn primary" id="b-flip">Toon antwoord</button>`) +
    `<div class="nav"><button class="btn" id="b-prev" aria-label="Vorige kaart" ${pos === 0 ? "disabled" : ""}>‹</button>
      <div class="meta" style="justify-content:center">Kaart ${pos + 1} van ${deck.length}</div>
      <button class="btn" id="b-next" aria-label="Volgende kaart" ${pos >= deck.length - 1 ? "disabled" : ""}>›</button></div>
     <button class="btn" id="b-shuffle">Opnieuw schudden</button>`;
  bindOnlyOpen();
  const flip = () => { flipped = !flipped; renderCards(); };
  $("card").onclick = flip;
  $("card").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
  if ($("b-flip")) $("b-flip").onclick = flip;
  if ($("b-again")) $("b-again").onclick = () => { saveProgress(c.id, { known: false }); next(); };
  if ($("b-known")) $("b-known").onclick = () => { saveProgress(c.id, { known: true }); next(); };
  $("b-prev").onclick = () => { if (pos > 0) { pos--; flipped = false; renderCards(); } };
  $("b-next").onclick = next;
  $("b-shuffle").onclick = buildDeck;
}
function next() { if (pos < deck.length - 1) pos++; flipped = false; renderCards(); }
function bindOnlyOpen() { const el = $("only-open"); if (el) el.onchange = () => { onlyOpen = el.checked; buildDeck(); }; }

// ---------- QUIZ ----------
let quiz = null;
function quizStart(mode) {
  let pool = filtered(), qs;
  if (mode === "wie") {
    pool = pool.filter((c) => c.groep !== "Tonaliteit" && c.groep !== "Achtergrond");
    qs = shuffle(pool).slice(0, QLEN).map((c) => ({ card: c, prompt: "Van wie komt dit principe of begrip?", quote: c.antwoord, options: ["Belfort", "Carnegie"], correct: c.bron }));
  } else {
    qs = shuffle(pool).slice(0, QLEN).map((c) => {
      let same = CARDS.filter((o) => o.id !== c.id && o.bron === c.bron && o.groep === c.groep && o.antwoord !== c.antwoord);
      if (same.length < 3) same = same.concat(shuffle(CARDS.filter((o) => o.id !== c.id && o.bron === c.bron && o.groep !== c.groep && o.groep !== "Achtergrond")));
      const opts = shuffle([c.antwoord, ...shuffle(same).slice(0, 3).map((o) => o.antwoord)]);
      return { card: c, prompt: c.vraag, options: opts, correct: c.antwoord };
    });
  }
  quiz = { mode, qs, i: 0, score: 0, answered: null, mistakes: [], saved: false };
  renderQuiz();
}
function renderQuiz() {
  const v = $("view-quiz");
  if (!quiz) {
    v.innerHTML = `<div class="panel"><h2>Test jezelf</h2>
      <p class="small" style="margin:0">${filtered().length} kaarten in je selectie. Elke ronde kiest willekeurig nieuwe vragen.</p>
      <label for="q-len" style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)">Aantal vragen per ronde
        <select id="q-len">${[10, 20, 30].map((x) => `<option value="${x}" ${x === QLEN ? "selected" : ""}>${x}</option>`).join("")}<option value="999" ${QLEN === 999 ? "selected" : ""}>Alle</option></select></label>
      <button class="btn primary" id="q-mc">Meerkeuze: kies het juiste antwoord</button>
      <button class="btn" id="q-wie">Belfort of Carnegie?</button></div>`;
    $("q-len").onchange = (e) => { QLEN = +e.target.value; };
    $("q-mc").onclick = () => quizStart("mc");
    $("q-wie").onclick = () => quizStart("wie");
    return;
  }
  if (!quiz.qs.length) {
    v.innerHTML = '<div class="empty">Geen vragen in deze selectie. Kies een ander onderdeel.</div><button class="btn" id="q-back">Terug</button>';
    $("q-back").onclick = () => { quiz = null; renderQuiz(); };
    return;
  }
  if (quiz.i >= quiz.qs.length) {
    if (!quiz.saved) { quiz.saved = true; saveQuizResult(quiz.mode, quiz.qs.length, quiz.score); }
    const pct = Math.round((quiz.score / quiz.qs.length) * 100);
    const rev = quiz.mistakes.length
      ? `<h2 style="font-size:18px">Om te herhalen</h2><ul class="review">${quiz.mistakes.map((c) => `<li>${tag(c.bron)}<strong>${esc(c.vraag)}</strong><span>${esc(c.antwoord)}</span></li>`).join("")}</ul>`
      : '<p style="margin:0">Alles goed. Sterk!</p>';
    v.innerHTML = `<div class="panel"><p class="small" style="margin:0">Je score</p><p class="big">${quiz.score} / ${quiz.qs.length}</p>
      <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>${rev}
      <div class="row"><button class="btn primary" id="q-again">Nieuwe ronde</button><button class="btn" id="q-menu">Ander quiztype</button></div></div>`;
    $("q-again").onclick = () => quizStart(quiz.mode);
    $("q-menu").onclick = () => { quiz = null; renderQuiz(); };
    return;
  }
  const q = quiz.qs[quiz.i], a = quiz.answered;
  let html = `<div class="meta"><span>Vraag ${quiz.i + 1} van ${quiz.qs.length}</span><span>Score ${quiz.score}</span></div>
    <div class="progress" aria-hidden="true"><div style="width:${Math.round((quiz.i / quiz.qs.length) * 100)}%"></div></div>
    <div class="panel">${quiz.mode === "mc" ? `<div style="display:flex;justify-content:space-between;gap:8px">${tag(q.card.bron)}<span class="small">${esc(q.card.groep)}</span></div>` : ""}
    <p class="qq">${esc(q.prompt)}</p>${q.quote ? `<p style="margin:0;font-size:18px;font-weight:600">${esc(q.quote)}</p>` : ""}
    <div class="opts">${q.options.map((o, idx) => {
      let cls = "opt";
      if (a !== null) { if (o === q.correct) cls += " correct"; else if (o === a) cls += " wrong"; }
      return `<button class="${cls}" data-i="${idx}" ${a !== null ? "disabled" : ""}>${esc(o)}</button>`;
    }).join("")}</div></div>`;
  if (a !== null) {
    const ok = a === q.correct;
    html += `<div class="feedback" aria-live="polite"><strong class="${ok ? "ok" : "no"}">${ok ? "Goed!" : "Niet goed."}</strong>
      ${quiz.mode === "wie" ? `<span>${esc(q.card.vraag)} Dit komt van ${q.card.bron}.</span>` : ""}
      ${q.card.uitleg ? `<span class="small">${esc(q.card.uitleg)}</span>` : ""}</div>
      <button class="btn primary" id="q-next">${quiz.i === quiz.qs.length - 1 ? "Bekijk resultaat" : "Volgende vraag"}</button>`;
  }
  html += '<button class="btn" id="q-stop">Stoppen</button>';
  v.innerHTML = html;
  v.querySelectorAll(".opt").forEach((b) => {
    b.onclick = () => {
      if (quiz.answered !== null) return;
      const o = q.options[+b.dataset.i], ok = o === q.correct;
      quiz.answered = o;
      if (ok) quiz.score++; else quiz.mistakes.push(q.card);
      const p = progress[q.card.id] || { times_seen: 0, times_correct: 0, known: false };
      saveProgress(q.card.id, { times_seen: p.times_seen + 1, times_correct: p.times_correct + (ok ? 1 : 0) });
      renderQuiz();
    };
  });
  if ($("q-next")) $("q-next").onclick = () => { quiz.i++; quiz.answered = null; renderQuiz(); };
  $("q-stop").onclick = () => { quiz = null; renderQuiz(); };
}

// ---------- tabs ----------
let tab = "cards";
function setTab(t) {
  tab = t;
  $("tab-cards").setAttribute("aria-selected", t === "cards");
  $("tab-quiz").setAttribute("aria-selected", t === "quiz");
  $("view-cards").style.display = t === "cards" ? "flex" : "none";
  $("view-quiz").style.display = t === "quiz" ? "flex" : "none";
}
$("tab-cards").onclick = () => setTab("cards");
$("tab-quiz").onclick = () => setTab("quiz");
fBron.onchange = () => { fillGroups(); buildDeck(); quiz = null; renderQuiz(); };
fGroep.onchange = () => { buildDeck(); quiz = null; renderQuiz(); };
$("logout").onclick = async () => { await sb.auth.signOut(); };

// ---------- start ----------
if (SUPABASE_URL.includes("JOUW-PROJECT-ID")) {
  showError("Vul eerst je Supabase-gegevens in config.js in (zie README, stap 3).");
} else {
  let started = false;
  sb.auth.onAuthStateChange((_event, session) => {
    const newUser = session ? session.user : null;
    if (started && (newUser && newUser.id) === (user && user.id)) return;
    started = true;
    user = newUser;
    if (user) setTimeout(loadData, 0); else renderLogin();
  });
}
