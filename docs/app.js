'use strict';
const $ = id => document.getElementById(id);
const KEY = 'gu-reader-v1';
const CONTENT_VERSION = '3';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
let chapters = [], volumes = [], current = -1, request = 0, ready = false, bookmarksOnly = false, toastTimer;
const state = {
  chapter: Number.isInteger(saved.chapter) ? saved.chapter : 2,
  fraction: Number.isFinite(saved.fraction) ? clamp(saved.fraction, 0, 1) : 0,
  font: clamp(Number(saved.font) || (matchMedia('(max-width:760px)').matches ? 20 : 22), 16, 44),
  line: clamp(Number(saved.line) || 2, 1.6, 2.6),
  theme: saved.appearanceVersion === 2 && ['green', 'paper', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'green',
  appearanceVersion: 2,
  typeface: saved.typeface === 'serif' ? 'serif' : 'sans',
  width: ['narrow', 'medium', 'wide'].includes(saved.width) ? saved.width : 'medium',
  gap: clamp(Number(saved.gap) || 1.1, 0.5, 2),
  focus: saved.focus === true,
  rest: saved.rest === true,
  anchor: saved.anchor && Number.isInteger(saved.anchor.index) && Number.isFinite(saved.anchor.offset) ? saved.anchor : null,
  bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks.filter(Number.isInteger) : [],
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed.filter(value => typeof value === 'string') : []
};
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('浏览器无法保存进度，请检查存储设置'); } }
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
function applySettings() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.typeface = state.typeface;
  $('typeface').value = state.typeface;
  $('reading-width').value = state.width;
  $('paragraph-gap').value = state.gap; $('gap-value').textContent = state.gap.toFixed(1);
  $('rest-enabled').checked = state.rest;
  document.documentElement.style.setProperty('--reading-chars', {narrow:26, medium:32, wide:38}[state.width]);
  document.documentElement.style.setProperty('--paragraph-gap', state.gap + 'em');
  document.body.classList.toggle('focus-mode', state.focus);
  $('exit-focus').hidden = !state.focus;
  $('focus-mode').setAttribute('aria-pressed', state.focus);
  $('focus-mode').textContent = state.focus ? '退出专注阅读' : '进入专注阅读';
  document.documentElement.style.setProperty('--font-size', state.font + 'px');
  document.documentElement.style.setProperty('--leading', state.line);
  $('font-size').value = state.font; $('font-value').textContent = state.font;
  $('line-height').value = state.line; $('line-value').textContent = state.line.toFixed(1);
  document.querySelectorAll('.themes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === state.theme));
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}
function renderList() {
  const query = $('search').value.trim().toLowerCase();
  const list = chapters.filter(c => (!bookmarksOnly || state.bookmarks.includes(c.id)) && (!query || c.title.toLowerCase().includes(query) || String(c.id + 1) === query));
  const fragment = document.createDocumentFragment();
  for (const volume of volumes) {
    const items = list.filter(chapter => chapter.volume === volume);
    if (!items.length) continue;
    const group = document.createElement('details'); group.className = 'volume-group'; group.dataset.volume = volume;
    group.open = query || bookmarksOnly || !state.collapsed.includes(volume);
    const summary = document.createElement('summary');
    const name = document.createElement('span'); name.textContent = volume;
    const count = document.createElement('span'); count.className = 'volume-count'; count.textContent = `${items.length} 篇`;
    summary.append(name, count); group.append(summary);
    for (const c of items) {
      const button = document.createElement('button'); button.dataset.id = c.id; button.setAttribute('aria-current', String(c.id === current));
      const num = document.createElement('span'); num.className = 'num'; num.textContent = String(c.id + 1).padStart(3, '0');
      const title = document.createElement('span'); title.textContent = c.title;
      button.append(num, title); group.append(button);
    }
    group.ontoggle = () => {
      if (query || bookmarksOnly) return;
      state.collapsed = group.open ? state.collapsed.filter(item => item !== volume) : [...new Set([...state.collapsed, volume])];
      persist();
    };
    fragment.append(group);
  }
  $('chapter-list').replaceChildren(fragment);
  if (!list.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = bookmarksOnly ? '还没有符合条件的书签。点击正文右上角的星标即可收藏。' : '没有找到章节，试试其他关键词。'; $('chapter-list').append(p); }
}
function updateBookmark() { const active = state.bookmarks.includes(current); $('bookmark').replaceChildren(document.createTextNode(active ? '★ ' : '☆ ')); const label = document.createElement('span'); label.textContent = '书签'; $('bookmark').append(label); $('bookmark').setAttribute('aria-label', active ? '移除书签' : '添加书签'); $('bookmark').setAttribute('aria-pressed', String(active)); }
function maxScroll() { return Math.max(0, document.documentElement.scrollHeight - innerHeight); }
function anchorTop() { return state.focus ? 20 : $('reading').getBoundingClientRect().top < 0 ? document.querySelector('.toolbar').offsetHeight + 18 : 95; }
function captureAnchor() {
  if (scrollY < 5) return null;
  const top = anchorTop();
  const ps = [...$('content').children];
  const index = ps.findIndex(p => p.getBoundingClientRect().bottom > top);
  if (index < 0) return null;
  const rect = ps[index].getBoundingClientRect();
  return {index, offset: clamp((top - rect.top) / rect.height, 0, 1)};
}
function restoreAnchor(anchor, fraction) {
  const p = anchor && $('content').children[anchor.index];
  if (p) { const rect = p.getBoundingClientRect(); window.scrollTo(0, scrollY + rect.top + clamp(anchor.offset, 0, 1) * rect.height - (state.focus ? 20 : document.querySelector('.toolbar').offsetHeight + 18)); }
  else window.scrollTo(0, fraction * maxScroll());
}
function changeLayout(update) {
  const anchor = ready ? captureAnchor() : null, fraction = state.fraction;
  update(); applySettings(); restoreAnchor(anchor, fraction); updateProgress(); persist();
}
function updateProgress() {
  if (!ready) return;
  state.fraction = maxScroll() ? clamp(scrollY / maxScroll(), 0, 1) : 0;
  state.anchor = captureAnchor();
  $('percent').textContent = `本章 ${Math.round(state.fraction * 100)}%`;
  $('progress').style.width = `${state.fraction * 100}%`;
}
async function openChapter(id, fraction = 0, anchor = null) {
  if (!chapters.length) return;
  id = clamp(id, 0, chapters.length - 1);
  const token = ++request; ready = false;
  $('content').setAttribute('aria-busy', 'true'); $('error').hidden = true;
  $('previous').disabled = $('next').disabled = $('bookmark').disabled = true;
  closeMenu();
  try {
    const response = await fetch(`book/${id}.json?v=${CONTENT_VERSION}`); if (!response.ok) throw new Error('加载失败');
    const data = await response.json(); if (token !== request) return;
    current = id; state.chapter = id;
    $('title').textContent = data.title; $('short-title').textContent = data.title;
    document.title = `${data.title} · 蛊真人`;
    $('chapter-number').textContent = `第 ${String(id + 1).padStart(3, '0')} 篇`;
    $('word-count').textContent = `${chapters[id].words.toLocaleString()} 字`;
    $('reading-time').textContent = `约 ${Math.max(1, Math.ceil(chapters[id].words / 450))} 分钟`;
    const content = document.createDocumentFragment();
    for (const text of data.paragraphs) { const p = document.createElement('p'); p.textContent = text; content.append(p); }
    $('content').replaceChildren(content); $('content').setAttribute('aria-busy', 'false');
    $('previous').disabled = id === 0; $('next').disabled = id === chapters.length - 1; $('bookmark').disabled = false;
    $('position').textContent = `${id + 1} / ${chapters.length} 篇`;
    history.replaceState(null, '', `#chapter=${id}`);
    updateBookmark(); renderList();
    requestAnimationFrame(() => { if (token !== request) return; restoreAnchor(anchor, fraction); ready = true; updateProgress(); persist(); $('reading').focus({preventScroll:true}); });
  } catch {
    if (token !== request) return;
    $('content').setAttribute('aria-busy', 'false'); $('error').hidden = false;
    $('error-text').textContent = '章节未能加载，请检查网络后重试。';
    $('retry').onclick = () => openChapter(id, fraction, anchor);
  }
}
function closeMenu() { document.body.classList.remove('menu-open'); $('scrim').hidden = true; $('open-menu').setAttribute('aria-expanded', 'false'); }
$('open-menu').onclick = () => { document.body.classList.add('menu-open'); $('scrim').hidden = false; $('open-menu').setAttribute('aria-expanded', 'true'); $('search').focus(); $('chapter-list').querySelector('[aria-current="true"]')?.scrollIntoView({block:'center'}); };
$('close-menu').onclick = $('scrim').onclick = closeMenu;
$('chapter-list').onclick = e => { const button = e.target.closest('button[data-id]'); if (button) openChapter(Number(button.dataset.id)); };
$('search').oninput = renderList;
function setTab(value) { bookmarksOnly = value; for (const [id, selected] of [['all-tab', !value], ['bookmarks-tab', value]]) { $(id).classList.toggle('selected', selected); $(id).setAttribute('aria-pressed', selected); } renderList(); }
$('all-tab').onclick = () => setTab(false); $('bookmarks-tab').onclick = () => setTab(true);
$('bookmark').onclick = () => { if (!ready) return; const active = state.bookmarks.includes(current); state.bookmarks = active ? state.bookmarks.filter(i => i !== current) : [...state.bookmarks, current]; persist(); updateBookmark(); if (bookmarksOnly) renderList(); toast(active ? '已移除书签' : '已添加书签'); };
$('previous').onclick = () => openChapter(current - 1); $('next').onclick = () => openChapter(current + 1);
$('to-top').onclick = () => window.scrollTo(0, 0);
function settingsOpen(value) { $('settings').hidden = !value; $('settings-button').setAttribute('aria-expanded', value); }
$('settings-button').onclick = () => settingsOpen($('settings').hidden); $('close-settings').onclick = () => settingsOpen(false);
for (const [id, key] of [['font-size', 'font'], ['line-height', 'line'], ['paragraph-gap', 'gap']]) $(id).oninput = e => changeLayout(() => { state[key] = Number(e.target.value); });
document.querySelectorAll('.themes button').forEach(button => button.onclick = () => { state.theme = button.dataset.theme; applySettings(); persist(); });
for (const [id, key] of [['typeface', 'typeface'], ['reading-width', 'width']]) $(id).onchange = e => changeLayout(() => { state[key] = e.target.value; });
function toggleFocus(value) { closeMenu(); settingsOpen(false); changeLayout(() => { state.focus = value; }); (value ? $('exit-focus') : $('settings-button')).focus({preventScroll:true}); }
$('focus-mode').onclick = () => toggleFocus(!state.focus);
$('exit-focus').onclick = () => toggleFocus(false);
const readingClock = new ReadingClock();
setInterval(() => { if (readingClock.tick(performance.now(), state.rest && ready && !document.hidden && $('rest-reminder').hidden)) $('rest-reminder').hidden = false; }, 1000);
document.addEventListener('visibilitychange', () => { readingClock.last = null; if (document.hidden && ready) persist(); });
$('rest-enabled').onchange = e => { state.rest = e.target.checked; readingClock.reset(); $('rest-reminder').hidden = true; persist(); };
$('dismiss-rest').onclick = () => { $('rest-reminder').hidden = true; readingClock.reset(); };
$('disable-rest').onclick = () => { state.rest = false; $('rest-enabled').checked = false; $('rest-reminder').hidden = true; readingClock.reset(); persist(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && state.focus) toggleFocus(false); });
let scrollTimer;
addEventListener('scroll', () => { updateProgress(); clearTimeout(scrollTimer); scrollTimer = setTimeout(() => { if (ready) persist(); }, 250); }, {passive:true});
addEventListener('pagehide', () => { if (ready) { updateProgress(); persist(); } });
addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); settingsOpen(false); } if (!ready || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey || document.body.classList.contains('menu-open') || !$('settings').hidden) return; if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); openChapter(current - 1); } if (e.key === 'ArrowRight' && current < chapters.length - 1) { e.preventDefault(); openChapter(current + 1); } });
addEventListener('hashchange', () => { const match = location.hash.match(/^#chapter=(\d+)$/); if (match) openChapter(Number(match[1])); });
async function init() {
  applySettings();
  try {
    const response = await fetch(`book/index.json?v=${CONTENT_VERSION}`); if (!response.ok) throw new Error('目录加载失败');
    const book = await response.json(); chapters = book.chapters; volumes = book.volumes || [...new Set(chapters.map(chapter => chapter.volume || '全书'))]; $('total').textContent = `${chapters.length.toLocaleString()} 篇`;
    const editionChanged = saved.edition !== book.edition;
    if (editionChanged) {
      state.chapter = Number.isInteger(book.start) ? book.start : 0;
      state.fraction = 0; state.anchor = null; state.bookmarks = [];
      const startVolume = chapters.find(chapter => chapter.id === state.chapter)?.volume;
      state.collapsed = volumes.filter(volume => volume !== startVolume);
    }
    state.edition = book.edition;
    const match = location.hash.match(/^#chapter=(\d+)$/); const id = match && !editionChanged ? Number(match[1]) : state.chapter;
    renderList(); await openChapter(id, id === state.chapter ? state.fraction : 0, id === state.chapter ? state.anchor : null);
  } catch { $('content').replaceChildren(); $('error').hidden = false; $('error-text').textContent = '书籍目录加载失败，请通过网站地址访问并检查网络连接。'; $('retry').onclick = init; }
}
init();
