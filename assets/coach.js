// =============================================================================
// Clubena デモ：コーチの画面（スマホ。体育館で使う）
//   デモのコーチは「佐藤 ゆか」さん。担当は 幼児クラス（火・金）と 小学生クラスA（どれも編集）
//   今日のクラス／出席の記録／シフト希望／引き継ぎメモ／フィードバック／級の付け替え（仕様書 6章）
// =============================================================================
import {
  db, commit, onChange, esc, on, TODAY, NOW_TIME, demoBar, bindDemoBar, newId,
  classById, memberById, sessionById, nameOf, gradeOf, mdw, jmdw, md, wdLabel, monthOf, addMonths, mLabel,
  isHeld, isPast, rosterOf, absenceOf, tagById, kyuOf, activeMembers,
} from './core.js';

const ME = 'u1';
const me = () => db.coaches.find((c) => c.id === ME);
const myClasses = () => Object.keys(me().assign);
const canEdit = (classId) => me().assign[classId] === 'edit';
const route = () => (location.hash.replace(/^#\/?/, '') || 'today').split('/');
let showAll = false;
let modal = null;
let picked = new Set();      // 級の付け替えで選んだ子
let fbKid = null;            // フィードバックを書いている子
let fbForm = {};
let memoErr = '';

const timeOf = (s) => `${s.start}〜${s.end}`;
const todaySessions = () => db.sessions.filter((s) => s.date === TODAY && isHeld(s) || (s.date === TODAY && s.status === 'cancelled'))
  .sort((a, b) => a.start.localeCompare(b.start));
const recorded = (s) => rosterOf(s).some(({ m }) => db.attendance[`${s.id}|${m.id}`]);
// 終わったのに出欠が1人分も入っていない、担当の回（過去31日）
const missing = () => db.sessions.filter((s) => myClasses().includes(s.classId) && isHeld(s) && isPast(s) && s.date >= '2026-10-05' && !recorded(s))
  .sort((a, b) => b.date.localeCompare(a.date));

function shell(body, tab) {
  const nav = [
    ['today', '今日のクラス', true],
    ['attend', '出席の記録', on('attendance')],
    ['wishes', 'シフト希望', on('shifts')],
    ['handover', '引き継ぎメモ', on('feedback')],
    ['feedback', 'フィードバック', on('feedback')],
    ['tags', '級の付け替え', on('tags')],
  ].filter((x) => x[2]);
  return `
    <header class="c-head"><strong>${esc(db.club.name)}</strong><span class="small">${esc(me().name)}（コーチ）</span></header>
    <nav class="c-nav" aria-label="コーチのメニュー">${nav.map(([k, l]) => `<a href="#/${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <div class="phone-scroll" id="scroll"><main class="p-main">${body}</main></div>`;
}

// --- 今日のクラス -----------------------------------------------------------------------------
function todayView() {
  const list = todaySessions().filter((s) => showAll || myClasses().includes(s.classId));
  const shifts = on('shifts') ? db.sessions.filter((s) => (db.shifts.assign[s.id] ?? []).includes(ME) && s.date >= TODAY && db.shifts.confirmed[monthOf(s.date)] && isHeld(s))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6) : [];
  const miss = on('attendance') ? missing() : [];
  return shell(`
    <h1 class="p-title">今日のクラス</h1>
    <p class="small" style="margin:-8px 2px 0">${esc(jmdw(TODAY))}</p>
    <div class="choices" role="group" aria-label="出すクラス">
      <button type="button" class="choice" data-all="0" aria-pressed="${!showAll}">担当だけ</button>
      <button type="button" class="choice" data-all="1" aria-pressed="${showAll}">すべてのクラス</button>
    </div>
    <section class="p-card">
      ${list.length ? list.map((s) => {
        const r = rosterOf(s);
        const mk = r.filter((x) => x.makeup).length;
        const ab = r.filter(({ m }) => absenceOf(s.id, m.id)).length;
        return `<div class="c-session">
          <div><b>${esc(timeOf(s))}</b> ${myClasses().includes(s.classId) ? '<span class="tag">担当</span>' : ''}<br>
            ${esc(classById(s.classId).name)}<br><span class="small">${esc(s.venue)}・来る予定 ${r.length - ab}人${mk ? `（振替${mk}）` : ''}${ab ? `・欠席連絡 ${ab}人` : ''}</span>
            ${s.status === 'cancelled' ? `<br><span class="tag warn">中止</span> <span class="small">${esc(s.note)}</span>` : ''}</div>
          ${s.status !== 'cancelled' && on('attendance') && myClasses().includes(s.classId) ? `<a class="btn sm" href="#/attend/${s.id}">出席を記録</a>` : ''}
        </div>`;
      }).join('') : `<p class="small">${showAll ? '今日はレッスンがありません。' : '今日は担当のクラスがありません。'}</p>`}
    </section>
    ${miss.length ? `<section class="p-card"><h2>出欠の未入力（${miss.length}回）</h2>${miss.map((s) => `
      <div class="c-session"><span>${esc(mdw(s.date))} ${esc(s.start)}<br><span class="small">${esc(classById(s.classId).name)}</span></span><a class="btn sub sm" href="#/attend/${s.id}">記録する</a></div>`).join('')}</section>` : ''}
    ${on('shifts') ? `<section class="p-card"><h2>これからのシフト</h2>${shifts.length ? shifts.map((s) => `
      <div class="c-session"><span><b>${esc(mdw(s.date))}</b> ${esc(timeOf(s))}<br><span class="small">${esc(classById(s.classId).name)}</span></span></div>`).join('') : '<p class="small">確定したシフトはまだありません。</p>'}</section>` : ''}`, 'today');
}

// --- 出席の記録 -------------------------------------------------------------------------------
function attendView(sid) {
  const choices = db.sessions.filter((s) => myClasses().includes(s.classId) && isHeld(s) && s.date <= TODAY && s.date >= '2026-10-01')
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
  const s = sessionById(sid) ?? todaySessions().find((x) => myClasses().includes(x.classId) && isHeld(x)) ?? choices[0];
  if (!s) return shell('<section class="p-card"><p>記録できる回がありません。</p></section>', 'attend');
  const r = rosterOf(s).sort((a, b) => Number(a.makeup) - Number(b.makeup) || a.m.fk.localeCompare(b.m.fk, 'ja'));
  const edit = canEdit(s.classId);
  const n = { present: 0, absent: 0, none: 0 };
  for (const { m } of r) n[db.attendance[`${s.id}|${m.id}`] ?? 'none']++;
  return shell(`
    <div class="field" style="margin:0">
      <label for="att-session">回を選ぶ</label>
      <select id="att-session">${choices.map((x) => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(mdw(x.date))} ${esc(x.start)} ${esc(classById(x.classId).name)}${recorded(x) ? '' : '（未入力）'}</option>`).join('')}</select>
    </div>
    <section class="p-card">
      <h2>${esc(jmdw(s.date))} ${esc(classById(s.classId).name)}</h2>
      <p class="small">${esc(timeOf(s))}・${esc(s.venue)}　出席 ${n.present}・欠席 ${n.absent}・未記録 ${n.none}</p>
      ${edit ? '<p class="small">名前の右のボタンを押すたびに「出席」「欠席」が切り替わります。押した時点で保存されます。</p>' : '<p class="note-box">このクラスは「閲覧」の担当なので、記録はできません。</p>'}
      <ul class="c-roster">${r.map(({ m, makeup }) => {
        const v = db.attendance[`${s.id}|${m.id}`];
        const ab = absenceOf(s.id, m.id);
        return `<li class="c-kid">
          <div><div class="c-kid-name">${esc(nameOf(m))}</div>
            <div class="c-kid-sub">${esc(gradeOf(m))}${makeup ? `<span class="tag fill">振替</span><span>${esc(classById(m.classId).name)}から</span>` : ''}
              ${ab ? `<span class="tag warn">欠席連絡あり：${esc(ab.reason)}</span>` : ''}${m.care ? '<span class="tag">配慮あり</span>' : ''}</div></div>
          <button type="button" class="c-mark ${v ? `is-${v}` : ''}" data-mark="${m.id}" data-session="${s.id}" ${edit ? '' : 'disabled'} aria-label="${esc(nameOf(m))}：${v === 'present' ? '出席' : v === 'absent' ? '欠席' : '未記録'}">${v === 'present' ? '出席' : v === 'absent' ? '欠席' : '未記録'}</button>
          <div class="c-ec"><button type="button" class="link" data-ec="${m.id}">緊急連絡先</button></div>
        </li>`;
      }).join('')}</ul>
      ${edit && n.none ? `<div class="actions"><button type="button" class="btn wide" data-all-present="${s.id}">残り${n.none}人を「出席」にする</button></div>` : ''}
    </section>`, 'attend');
}

// --- シフト希望 -------------------------------------------------------------------------------
function wishesView() {
  const ym = [monthOf(TODAY), addMonths(monthOf(TODAY), 1)].find((x) => db.months[x]?.confirmedAt && !db.shifts.confirmed[x]);
  if (!ym) {
    const next = addMonths(monthOf(TODAY), 1);
    return shell(`<h1 class="p-title">シフト希望</h1><section class="p-card">
      <p>${db.shifts.confirmed[next] ? `${mLabel(next)}のシフトは確定しました。「今日のクラス」の下に出ています。` : `${mLabel(next)}分の開講日が確定すると、ここで希望を出せます。`}</p>
      <p class="small">（デモ：事務担当の画面で「${mLabel(next)}分を確定する」を押すと、受付が始まります）</p></section>`, 'wishes');
  }
  const list = db.sessions.filter((s) => monthOf(s.date) === ym && isHeld(s) && Object.keys(me().assign).includes(s.classId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const done = list.filter((s) => db.shifts.wishes[`${ME}|${s.id}`]).length;
  return shell(`
    <h1 class="p-title">${mLabel(ym)}のシフト希望</h1>
    <section class="p-card">
      <p class="small">日ごとに ○（入れる）・△（相談）・×（入れない）を選ぶだけです。押した時点で保存されます。${done}/${list.length} 回 入力済み</p>
      ${list.map((s) => {
        const v = db.shifts.wishes[`${ME}|${s.id}`];
        return `<div class="c-wish"><span><b>${esc(mdw(s.date))}</b> ${esc(s.start)}<br><span class="small">${esc(classById(s.classId).name)}</span></span>
          <span class="c-wish-btns" role="group" aria-label="${esc(mdw(s.date))}の希望">${['○', '△', '×'].map((x) => `<button type="button" data-wish="${s.id}" data-v="${x}" aria-pressed="${v === x}">${x}</button>`).join('')}</span></div>`;
      }).join('')}
    </section>`, 'wishes');
}

// --- 引き継ぎメモ -----------------------------------------------------------------------------
function handoverView() {
  const notes = db.handovers.filter((h) => myClasses().includes(h.classId)).sort((a, b) => b.at.localeCompare(a.at));
  return shell(`
    <h1 class="p-title">引き継ぎメモ</h1>
    <section class="p-card">
      <h2>メモを書く</h2>
      <p class="note-box">健康・医療に関すること、住所など紙で管理している情報は書かないでください。</p>
      <form id="memo-form" novalidate style="margin-top:10px">
        <div class="field"><label for="memo-class">クラス</label><select id="memo-class">${myClasses().map((c) => `<option value="${c}">${esc(classById(c).name)}</option>`).join('')}</select></div>
        <div class="field"><label for="memo-kid">子（クラス全体のことなら空のまま）</label><select id="memo-kid"><option value="">クラス全体</option></select></div>
        <div class="field"><label for="memo-text">メモ</label><textarea id="memo-text" maxlength="400" ${memoErr ? 'aria-invalid="true"' : ''}></textarea>${memoErr ? `<p class="err" role="alert">${esc(memoErr)}</p>` : ''}</div>
        <button type="submit" class="btn wide">保存する</button>
      </form>
      <p class="small" style="margin-top:8px">コーチと事務担当だけが読めます。保護者には見えません。</p>
    </section>
    <section class="p-card"><h2>これまでのメモ</h2>${notes.map((h) => `
      <div class="c-memo"><p class="small">${esc(md(h.at))}・${esc(classById(h.classId).name)}${h.memberId ? `・${esc(nameOf(memberById(h.memberId)))}` : ''}・${esc(h.by)}</p><p>${esc(h.text)}</p></div>`).join('') || '<p class="small">まだありません。</p>'}</section>`, 'handover');
}

// --- フィードバック ---------------------------------------------------------------------------
const FB_ITEMS = ['意欲', '基本の姿勢', '前回からの伸び'];
const FB_CHOICES = ['とてもよい', 'よい', 'もう少し'];
function feedbackView() {
  const kids = activeMembers().filter((m) => myClasses().includes(m.classId)).sort((a, b) => a.fk.localeCompare(b.fk, 'ja'));
  const m = memberById(fbKid) ?? null;
  if (!m) {
    return shell(`<h1 class="p-title">フィードバック</h1><section class="p-card">
      <p class="small">保護者に見せる、月1回〜学期1回の記録です。公開したものだけが保護者の「成長の記録」に出ます。</p>
      <ul class="p-list">${kids.map((k) => {
        const last = db.feedbacks.filter((f) => f.memberId === k.id).sort((a, b) => b.month.localeCompare(a.month))[0];
        return `<li class="p-lesson" style="grid-template-columns:1fr auto"><span><b>${esc(nameOf(k))}</b> <span class="small">${esc(gradeOf(k))}・${esc(classById(k.classId).name)}</span><br>
          <span class="small">${last ? `${mLabel(last.month)}：${last.published ? '公開済み' : '下書き'}` : 'まだありません'}</span></span>
          <button type="button" class="btn sub sm" data-fb="${k.id}">書く</button></li>`;
      }).join('')}</ul></section>`, 'feedback');
  }
  const hist = db.tagHistory.filter((h) => h.memberId === m.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const f = fbForm;
  return shell(`
    <button type="button" class="link" data-fb="">‹ 子の一覧</button>
    <section class="p-card">
      <h2>${esc(nameOf(m))}（${esc(gradeOf(m))}）${mLabel(monthOf(TODAY))}のフィードバック</h2>
      <p class="small">いまのタグ：${m.tags.map(tagById).filter(Boolean).map((t) => `${esc(t.group.name)} ${esc(t.name)}`).join('・') || 'なし'}</p>
      ${hist.length ? `<p class="small">級の記録：${hist.map((h) => `${Number(h.at.slice(5, 7))}月 ${esc(tagById(h.from)?.name)}→${esc(tagById(h.to)?.name)}`).join('、')}</p>` : ''}
      <form id="fb-form" novalidate>
        ${FB_ITEMS.map((it) => `<fieldset class="field" style="border:0;padding:0"><legend class="label">${it}</legend>
          <div class="choices">${FB_CHOICES.map((c) => `<label class="choice"><input type="radio" name="fb-${it}" value="${c}" ${f[it] === c ? 'checked' : ''}>${c}</label>`).join('')}</div></fieldset>`).join('')}
        <div class="field"><label for="fb-skill">できるようになった技（なくてもかまいません）</label><input type="text" id="fb-skill" value="${esc(f.skill ?? '')}" maxlength="30"></div>
        <div class="field"><label for="fb-text">ひとこと（200文字まで）</label><textarea id="fb-text" maxlength="200">${esc(f.text ?? '')}</textarea></div>
        <div class="actions"><button type="submit" class="btn" name="publish" value="1">保護者に公開する</button><button type="submit" class="btn sub" name="publish" value="0">下書きで保存</button></div>
      </form>
    </section>`, 'feedback');
}

// --- 級の付け替え -----------------------------------------------------------------------------
function tagsView() {
  const kids = activeMembers().filter((m) => myClasses().includes(m.classId)).sort((a, b) => a.classId.localeCompare(b.classId) || a.fk.localeCompare(b.fk, 'ja'));
  return shell(`
    <h1 class="p-title">級の付け替え</h1>
    <section class="p-card">
      <p class="small">子を選んで「級を変える」。変えると、いつ・だれが・どれからどれへ、が自動で記録され、保護者の「成長の記録」に出ます。</p>
      <ul class="c-roster">${kids.map((m) => `<li class="c-kid" style="grid-template-columns:auto 1fr auto">
        <input type="checkbox" data-pick="${m.id}" ${picked.has(m.id) ? 'checked' : ''} aria-label="${esc(nameOf(m))}を選ぶ" style="width:24px;height:24px">
        <div><div class="c-kid-name" style="font-size:16px">${esc(nameOf(m))}</div><div class="c-kid-sub">${esc(gradeOf(m))}・${esc(classById(m.classId).name)}</div></div>
        <span class="tag">${esc(kyuOf(m))}</span></li>`).join('')}</ul>
      <div class="actions"><button type="button" class="btn wide" id="kyu-open" ${picked.size ? '' : 'disabled'}>選んだ${picked.size}人の級を変える</button></div>
    </section>`, 'tags');
}

// =============================================================================
const root = document.getElementById('phone');
function render() {
  const [r, a] = route();
  let html;
  if (r === 'attend' && on('attendance')) html = attendView(a);
  else if (r === 'wishes' && on('shifts')) html = wishesView();
  else if (r === 'handover' && on('feedback')) html = handoverView();
  else if (r === 'feedback' && on('feedback')) html = feedbackView();
  else if (r === 'tags' && on('tags')) html = tagsView();
  else html = todayView();
  const y = document.getElementById('scroll')?.scrollTop ?? 0;
  root.innerHTML = html + (modal ? `<div class="modal-back" id="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-h">${modal}</div></div>` : '');
  document.getElementById('scroll')?.scrollTo(0, y);
  if (r === 'handover') fillMemoKids();
}
function fillMemoKids() {
  const cls = document.getElementById('memo-class')?.value;
  const sel = document.getElementById('memo-kid');
  if (!sel) return;
  sel.innerHTML = '<option value="">クラス全体</option>' + activeMembers().filter((m) => m.classId === cls).map((m) => `<option value="${m.id}">${esc(nameOf(m))}</option>`).join('');
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('button, input[type="checkbox"]');
  if (!el) { if (e.target.id === 'modal-back') { modal = null; render(); } return; }
  if (el.dataset.all !== undefined) { showAll = el.dataset.all === '1'; render(); return; }
  if (el.dataset.mark) {
    const k = `${el.dataset.session}|${el.dataset.mark}`;
    const cur = db.attendance[k];
    db.attendance[k] = cur === 'present' ? 'absent' : 'present';
    commit();
    return;
  }
  if (el.dataset.allPresent) {
    const s = sessionById(el.dataset.allPresent);
    for (const { m } of rosterOf(s)) db.attendance[`${s.id}|${m.id}`] ??= absenceOf(s.id, m.id) ? 'absent' : 'present';
    commit('残りを記録しました（欠席連絡のある子は「欠席」）');
    return;
  }
  if (el.dataset.ec) {
    const m = memberById(el.dataset.ec);
    const at = `${TODAY} ${NOW_TIME}`;
    db.ecLog.push({ at, by: me().name, memberId: m.id });
    commit();
    modal = `<h2 id="modal-h">${esc(nameOf(m))} の緊急連絡先</h2>
      ${m.ec.map((x, i) => `<p style="font-size:17px">${i + 1}. ${esc(x.name)}（${esc(x.rel)}）<br><a href="tel:${esc(x.phone)}">${esc(x.phone)}</a></p>`).join('')}
      <p class="note-box">見た記録が残ります（${esc(me().name)}・${esc(md(TODAY))} ${NOW_TIME}）。担当のクラスの子と、振替で来る子だけが見られます。</p>
      <div class="actions"><button type="button" class="btn wide" id="modal-close">閉じる</button></div>`;
    render();
    document.getElementById('modal-close')?.focus();
    return;
  }
  if (el.id === 'modal-close') { modal = null; render(); return; }
  if (el.dataset.wish) {
    db.shifts.wishes[`${ME}|${el.dataset.wish}`] = el.dataset.v;
    commit();
    return;
  }
  if (el.dataset.fb !== undefined) {
    fbKid = el.dataset.fb || null;
    const last = db.feedbacks.find((f) => f.memberId === fbKid && f.month === monthOf(TODAY));
    fbForm = last ? { ...last.items, skill: last.skill, text: last.text } : {};
    render();
    document.getElementById('scroll')?.scrollTo(0, 0);
    return;
  }
  if (el.dataset.pick) {
    if (el.checked) picked.add(el.dataset.pick); else picked.delete(el.dataset.pick);
    const b = document.getElementById('kyu-open');
    b.disabled = picked.size === 0;
    b.textContent = `選んだ${picked.size}人の級を変える`;
    return;
  }
  if (el.id === 'kyu-open') {
    const g = db.tagGroups.find((x) => x.id === 'g1');
    modal = `<h2 id="modal-h">${picked.size}人の級を変える</h2>
      <div class="field"><label for="kyu-to">新しい級</label><select id="kyu-to">${g.tags.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
      <p class="small">${[...picked].map((id) => esc(nameOf(memberById(id)))).join('、')}</p>
      <div class="actions"><button type="button" class="btn" id="kyu-save">変える</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>`;
    render();
    return;
  }
  if (el.id === 'kyu-save') {
    const to = document.getElementById('kyu-to').value;
    for (const id of picked) {
      const m = memberById(id);
      const from = m.tags.find((t) => tagById(t)?.group.id === 'g1');
      if (from === to) continue;
      m.tags = [...m.tags.filter((t) => t !== from), to];
      db.tagHistory.push({ memberId: id, groupId: 'g1', from, to, at: TODAY, by: me().name });
    }
    const n = picked.size;
    picked = new Set();
    modal = null;
    commit(`${n}人の級を「${tagById(to).name}」にしました`);
  }
});
root.addEventListener('change', (e) => {
  if (e.target.id === 'att-session') location.hash = `#/attend/${e.target.value}`;
  if (e.target.id === 'memo-class') fillMemoKids();
});
root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'memo-form') {
    const text = document.getElementById('memo-text').value.trim();
    if (!text) { memoErr = 'メモを入れてください'; render(); return; }
    memoErr = '';
    db.handovers.push({ id: newId('h'), classId: document.getElementById('memo-class').value, memberId: document.getElementById('memo-kid').value || null, text, by: me().name, at: TODAY });
    commit('引き継ぎメモを保存しました');
    return;
  }
  if (e.target.id === 'fb-form') {
    const publish = e.submitter?.value === '1';
    const items = Object.fromEntries(FB_ITEMS.map((it) => [it, e.target.querySelector(`input[name="fb-${it}"]:checked`)?.value ?? '—']));
    const rec = { memberId: fbKid, month: monthOf(TODAY), items, skill: document.getElementById('fb-skill').value.trim(), text: document.getElementById('fb-text').value.trim(), published: publish, by: me().name };
    const old = db.feedbacks.find((f) => f.memberId === fbKid && f.month === rec.month);
    if (old) Object.assign(old, rec); else db.feedbacks.push({ id: newId('fb'), ...rec });
    fbKid = null; fbForm = {};
    commit(publish ? '公開しました。保護者の「成長の記録」に出ます' : '下書きで保存しました（保護者には見えません）');
  }
});
addEventListener('hashchange', () => { modal = null; render(); document.getElementById('scroll')?.scrollTo(0, 0); });
onChange(render);

document.getElementById('bar').innerHTML = demoBar('coach');
bindDemoBar();
render();
