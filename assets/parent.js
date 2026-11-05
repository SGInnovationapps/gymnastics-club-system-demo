// =============================================================================
// Clubena デモ：保護者の画面（LINEミニアプリ・スマホ）
//   デモの保護者は「上野 美咲」さん。子は はると（小3）と ゆい（年長）
//   下のタブ：ホーム／予定／お知らせ／メニュー
// =============================================================================
import {
  db, commit, onChange, esc, on, TODAY, demoBar, bindDemoBar, newId, showToast,
  classById, memberById, sessionById, planById, familyKids, nameOf, memberNo, gradeOf, ageOf,
  monthOf, addMonths, ymLabel, mLabel, mdw, jmdw, wdLabel, md, yen, signedYen, feeTotal,
  isPublic, isHeld, isPast, pastDeadline, absenceOf, creditExpiry, makeupCandidates,
  noticesFor, isRead, markRead, tagById, termsLatest, gradeNumber, gradeLabel,
} from './core.js';

const FAMILY = 'f1';
const REASONS = ['体調', '学校行事', '家庭の都合', 'その他'];
let kidId = sessionStorage.getItem('demo-kid') || 'm1';
let form = {};          // 入力中の値（欠席・登録情報・入会申込）
let errors = {};
let modal = null;       // 確かめの窓

const ICON = {
  absence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M10 14l4 4M14 14l-4 4"/></svg>',
  fee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8l3 4 3-4M12 12v6M9 13h6M9 16h6"/></svg>',
  growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M8.5 13 7 21l5-3 5 3-1.5-8"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

const kids = () => familyKids(FAMILY);
const kid = () => kids().find((k) => k.id === kidId) ?? kids()[0];
const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
const go = (h) => { location.hash = h; };
const timeOf = (s) => `${s.start}〜${s.end}`;

// その子の回（クラスの回＋振替で行く回）。保護者に見える回だけ
function lessonsOf(m) {
  const own = db.sessions.filter((s) => s.classId === m.classId && isPublic(s)).map((s) => ({ s, makeup: false }));
  const mk = db.credits.filter((c) => c.memberId === m.id && ['reserved', 'pending'].includes(c.status))
    .map((c) => ({ s: sessionById(c.reservedSessionId), makeup: true, credit: c }));
  return [...own, ...mk].sort((a, b) => a.s.date.localeCompare(b.s.date) || a.s.start.localeCompare(b.s.start));
}
const nextLesson = (m) => lessonsOf(m).find(({ s }) => isHeld(s) && !isPast(s));
const creditsOf = (m) => db.credits.filter((c) => c.memberId === m.id && c.status === 'available' && c.expires >= TODAY);
const unreadCount = () => noticesFor(FAMILY).filter((n) => !isRead(n, FAMILY)).length;

// --- 枠 -------------------------------------------------------------------------------------
function shell(body, tab) {
  const tabs = [['home', 'ホーム', ICON.home], ['schedule', '予定', ICON.cal], ['notices', 'お知らせ', ICON.bell], ['menu', 'メニュー', ICON.menu]]
    .filter(([k]) => k !== 'schedule' || on('schedule'));
  const n = unreadCount();
  return `
    <header class="p-head">
      <p class="p-club">${esc(db.club.name)}</p>
      ${kids().length > 1 ? `<div class="p-kids" role="group" aria-label="子を選ぶ">${kids().map((k) => `
        <button type="button" class="p-kid" data-kid="${k.id}" aria-pressed="${k.id === kid().id}">${esc(k.given)}（${esc(gradeOf(k))}）</button>`).join('')}</div>` : ''}
    </header>
    <div class="phone-scroll" id="scroll"><main class="p-main">${body}</main></div>
    <nav class="p-tabs" aria-label="下のタブ" style="grid-template-columns: repeat(${tabs.length}, 1fr)">
      ${tabs.map(([k, l, ic]) => `<a href="#/${k}" ${tab === k ? 'aria-current="page"' : ''}>${ic}${l}${k === 'notices' && n ? `<span class="badge" aria-label="未読${n}件">${n}</span>` : ''}</a>`).join('')}
    </nav>`;
}

// --- ホーム -----------------------------------------------------------------------------------
function homeView() {
  const m = kid();
  const news = noticesFor(FAMILY).filter((n) => !isRead(n, FAMILY)).slice(0, 3);
  const next = nextLesson(m);
  const nCredits = on('makeup') ? creditsOf(m).length : 0;
  const big = [
    [on('makeup') ? '欠席・振替' : '欠席連絡', '#/absence', ICON.absence, nCredits ? `振替できる回 ${nCredits}` : ''],
    on('fees') && ['月謝', '#/fees', ICON.fee, ''],
    (on('tags') || on('feedback')) && ['成長の記録', '#/growth', ICON.growth, ''],
    ['登録情報', '#/profile', ICON.profile, ''],
  ].filter(Boolean);
  let nextHtml = '<p>予定されているレッスンはありません。</p>';
  if (next) {
    const ab = absenceOf(next.s.id, m.id);
    const today = next.s.date === TODAY;
    nextHtml = `
      <div class="p-next-label">${today ? '<span class="tag fill">今日</span>' : ''}次のレッスン${next.makeup ? '<span class="tag">振替で参加</span>' : ''}</div>
      <p class="p-next-when">${esc(jmdw(next.s.date))}<br>${esc(timeOf(next.s))}</p>
      <p class="p-next-where">${esc(next.s.venue)}・${esc(classById(next.s.classId).name)}</p>
      ${next.s.status === 'venue_changed' ? `<p class="note-box">会場が変わりました：${esc(next.s.note)}</p>` : ''}
      ${ab ? '<p class="ok-box">欠席の連絡を送っています</p>'
        : next.makeup ? '' : `<a class="btn sub wide" href="#/absence/new/${next.s.id}">この日を欠席する</a>`}`;
  }
  return shell(`
    <section class="p-card p-news" aria-labelledby="news-h">
      <h2 id="news-h">新しい知らせ</h2>
      ${news.length ? `<ul>${news.map((n) => `<li><a href="#/notice/${n.id}"><span class="dot" aria-label="未読"></span><span class="p-news-text">${esc(n.title)}</span><span class="chev" aria-hidden="true">›</span></a></li>`).join('')}</ul>`
        : '<p class="is-empty">新しい知らせはありません</p>'}
    </section>
    <section class="p-card" aria-label="次のレッスン">${nextHtml}</section>
    <nav class="p-big" aria-label="よく使う画面">
      ${big.map(([l, h, ic, c]) => `<a href="${h}">${ic}<span>${l}</span>${c ? `<span class="count">${esc(c)}</span>` : ''}</a>`).join('')}
    </nav>`, 'home');
}

// --- 予定 -------------------------------------------------------------------------------------
let schedMonth = monthOf(TODAY);
function scheduleView() {
  const m = kid();
  const months = [monthOf(TODAY), addMonths(monthOf(TODAY), 1)];
  if (!months.includes(schedMonth)) schedMonth = months[0];
  const info = db.months[schedMonth];
  const rows = info?.confirmedAt ? lessonsOf(m).filter(({ s }) => monthOf(s.date) === schedMonth) : [];
  const banner = info?.confirmedAt
    ? `<p class="p-banner is-confirmed">${mLabel(schedMonth)}の開講日は確定しています</p>`
    : `<p class="p-banner is-waiting">${mLabel(schedMonth)}の予定は、まだ確定していません${info?.expected ? `（${md(info.expected)}ごろ確定します）` : ''}</p>`;
  const i = months.indexOf(schedMonth);
  return shell(`
    <h1 class="p-title">予定</h1>
    <section class="p-card">
      <div class="p-monthbar">
        <button type="button" class="btn sub sm" data-month="${months[i - 1] ?? ''}" ${i === 0 ? 'disabled' : ''} aria-label="前の月">‹ ${i === 0 ? '' : mLabel(months[i - 1])}</button>
        <strong>${ymLabel(schedMonth)}</strong>
        <button type="button" class="btn sub sm" data-month="${months[i + 1] ?? ''}" ${i === months.length - 1 ? 'disabled' : ''} aria-label="次の月">${i === months.length - 1 ? '' : mLabel(months[i + 1])} ›</button>
      </div>
      ${banner}
      ${rows.length ? `<ul class="p-list">${rows.map(({ s, makeup, credit }) => lessonRow(m, s, makeup, credit)).join('')}</ul>`
        : `<p class="small">${info?.confirmedAt ? 'この月のレッスンはありません' : '確定すると、ここにレッスンの日が並びます'}</p>`}
    </section>`, 'schedule');
}
function lessonRow(m, s, makeup, credit) {
  const ab = absenceOf(s.id, m.id);
  const att = db.attendance[`${s.id}|${m.id}`];
  let badge = '';
  if (s.status === 'cancelled') badge = '<span class="tag warn">中止</span>';
  else if (att === 'present') badge = '<span class="tag ok">出席確認済み</span>';
  else if (ab) badge = '<span class="tag muted">欠席連絡済み</span>';
  else if (att === 'absent') badge = '<span class="tag muted">欠席</span>';
  else if (makeup && credit?.status === 'pending') badge = '<span class="tag warn">振替の承認待ち</span>';
  else if (makeup) badge = '<span class="tag fill">振替で参加</span>';
  else if (s.status === 'venue_changed' && !isPast(s)) badge = '<span class="tag warn">会場変更</span>';
  const canAbsent = !isPast(s) && isHeld(s) && !ab && !makeup && !pastDeadline(s);
  const inner = `
    <span class="p-date"><b>${md(s.date)}</b><small>${wdLabel(s.date)}</small></span>
    <span class="p-lesson-main"><span class="p-lesson-time">${esc(timeOf(s))}</span>
      <span class="sub">${esc(s.venue)}${makeup ? `・${esc(classById(s.classId).name)}` : ''}</span>
      ${s.note && s.status !== 'confirmed' ? `<span class="note">${s.status === 'venue_changed' ? '会場変更：' : ''}${esc(s.note)}</span>` : ''}</span>
    <span>${badge}</span>`;
  const cls = `p-lesson${s.status === 'cancelled' ? ' is-cancelled' : ''}`;
  return canAbsent
    ? `<li><a class="${cls} is-link" href="#/absence/new/${s.id}" title="押すと、この日の欠席の連絡ができます">${inner}</a></li>`
    : `<li class="${cls}">${inner}</li>`;
}

// --- お知らせ ---------------------------------------------------------------------------------
function noticesView() {
  const list = noticesFor(FAMILY);
  return shell(`
    <h1 class="p-title">お知らせ</h1>
    <section class="p-card p-news">
      ${list.length ? `<ul>${list.map((n) => `<li><a href="#/notice/${n.id}">${isRead(n, FAMILY) ? '<span class="dot" style="background:transparent"></span>' : '<span class="dot" aria-label="未読"></span>'}
        <span class="p-news-text">${esc(n.title)}<br><span class="small">${esc(jmdw(n.sentAt))}</span></span><span class="chev" aria-hidden="true">›</span></a></li>`).join('')}</ul>`
        : '<p class="is-empty">お知らせはまだありません</p>'}
    </section>`, 'notices');
}
function noticeView(id) {
  const n = db.notices.find((x) => x.id === id);
  if (!n) return noticesView();
  if (!isRead(n, FAMILY)) setTimeout(() => markRead(n, FAMILY), 0);
  return shell(`
    <a class="link" href="#/notices">‹ お知らせの一覧</a>
    <section class="p-card">
      <p class="small">${esc(jmdw(n.sentAt))}</p>
      <h2 style="font-size:19px">${esc(n.title)}</h2>
      <p class="p-notice-body">${esc(n.body)}</p>
      ${n.kind === 'confirm' && on('schedule') ? '<a class="btn sub" href="#/schedule">予定を見る</a>' : ''}
    </section>`, 'notices');
}

// --- メニュー ---------------------------------------------------------------------------------
function menuView() {
  const items = [
    [on('makeup') ? '欠席・振替' : '欠席連絡', '#/absence'],
    on('fees') && ['月謝', '#/fees'],
    (on('tags') || on('feedback')) && ['成長の記録', '#/growth'],
    ['登録情報', '#/profile'],
    ['会員規約', '#/terms'],
    ['入会を申し込む（きょうだいなど）', '#/apply'],
  ].filter(Boolean);
  return shell(`
    <h1 class="p-title">メニュー</h1>
    <section class="p-card"><ul class="p-menu">${items.map(([l, h]) => `<li><a href="${h}">${l}<span aria-hidden="true">›</span></a></li>`).join('')}</ul></section>
    <p class="small">LINEアプリの中で開いたときは、ここに「閉じる」が出ます。</p>`, 'menu');
}

// --- 欠席・振替 -------------------------------------------------------------------------------
function absenceView() {
  const m = kid();
  const upcoming = lessonsOf(m).filter(({ s, makeup }) => !makeup && isHeld(s) && !isPast(s)).slice(0, 6);
  const credits = on('makeup') ? creditsOf(m) : [];
  const reserved = on('makeup') ? db.credits.filter((c) => c.memberId === m.id && ['reserved', 'pending'].includes(c.status) && !isPast(sessionById(c.reservedSessionId))) : [];
  return shell(`
    <h1 class="p-title">${on('makeup') ? '欠席・振替' : '欠席連絡'}（${esc(m.given)}）</h1>
    <section class="p-card">
      <h2>欠席の連絡</h2>
      <p class="small">締切は、レッスンが始まる${db.rules.deadlineHours}時間前です。締切を過ぎたら、クラブに直接ご連絡ください。</p>
      <ul class="p-list">${upcoming.map(({ s }) => {
        const ab = absenceOf(s.id, m.id);
        const late = pastDeadline(s);
        return `<li class="p-lesson">
          <span class="p-date"><b>${md(s.date)}</b><small>${wdLabel(s.date)}</small></span>
          <span class="p-lesson-main">${esc(timeOf(s))}<span class="sub">${esc(s.venue)}</span>${ab ? `<span class="sub">理由：${esc(ab.reason)}</span>` : ''}</span>
          <span>${ab ? (late ? '<span class="tag muted">連絡済み</span>' : `<button type="button" class="btn sub sm" data-cancel-absence="${ab.id}">取り消す</button>`)
            : late ? '<span class="tag muted">締切を過ぎました</span>' : `<a class="btn sub sm" href="#/absence/new/${s.id}">欠席する</a>`}</span>
        </li>`;
      }).join('') || '<li class="small">これからのレッスンはありません</li>'}</ul>
    </section>
    ${on('makeup') ? `
    <section class="p-card">
      <h2>振替できる回（${credits.length}回分）</h2>
      ${credits.length ? credits.map((c) => {
        const from = sessionById(c.originSessionId);
        return `<div class="p-credit">
          <p><b>${esc(mdw(from.date))}の${c.origin === 'absence' ? '欠席' : '中止'}の分</b></p>
          <p class="small">${esc(jmdw(c.expires))}まで使えます</p>
          <a class="btn wide" href="#/makeup/${c.id}">振替先を選ぶ</a>
        </div>`;
      }).join('') : '<p class="small">いま使える振替はありません。締切までに欠席の連絡をした回や、クラブの都合で中止になった回の分がここに出ます。</p>'}
      ${reserved.length ? `<h2 style="margin-top:14px">振替で参加する回</h2><ul class="p-list">${reserved.map((c) => {
        const s = sessionById(c.reservedSessionId);
        return `<li class="p-lesson"><span class="p-date"><b>${md(s.date)}</b><small>${wdLabel(s.date)}</small></span>
          <span class="p-lesson-main">${esc(timeOf(s))}<span class="sub">${esc(classById(s.classId).name)}・${esc(s.venue)}</span></span>
          <span>${c.status === 'pending' ? '<span class="tag warn">承認待ち</span>' : '<span class="tag fill">確定</span>'}</span></li>`;
      }).join('')}</ul>` : ''}
    </section>` : ''}`, 'menu');
}

function absenceForm(sid) {
  const m = kid();
  const s = sessionById(sid);
  if (!s) return absenceView();
  const late = pastDeadline(s);
  return shell(`
    <a class="link" href="#/absence">‹ 欠席・振替</a>
    <section class="p-card">
      <h2>欠席の連絡（${esc(m.given)}）</h2>
      <p style="font-size:18px;font-weight:bold;margin:0">${esc(jmdw(s.date))} ${esc(timeOf(s))}</p>
      <p class="small">${esc(s.venue)}・${esc(classById(s.classId).name)}</p>
      ${late ? '<p class="note-box">締切（開始の2時間前）を過ぎています。クラブに直接ご連絡ください。</p>' : `
      <form id="absence-form" novalidate>
        <fieldset class="field" style="border:0;padding:0;margin:14px 0">
          <legend class="label">理由</legend>
          <div class="choices">${REASONS.map((r) => `<label class="choice"><input type="radio" name="reason" value="${r}" ${form.reason === r ? 'checked' : ''}>${r}</label>`).join('')}</div>
          ${errors.reason ? `<p class="err" role="alert">${esc(errors.reason)}</p>` : ''}
        </fieldset>
        <div class="field">
          <label for="ab-note">クラブへのひとこと（なくてもかまいません）</label>
          <textarea id="ab-note" maxlength="100" placeholder="例：熱が下がらないため">${esc(form.note ?? '')}</textarea>
        </div>
        <button type="submit" class="btn wide">欠席の連絡を送る</button>
      </form>`}
    </section>`, 'menu');
}

function absenceDone(id) {
  const a = db.absences.find((x) => x.id === id);
  if (!a) return absenceView();
  const s = sessionById(a.sessionId);
  const c = db.credits.find((x) => x.absenceId === id && x.status === 'available');
  return shell(`
    <section class="p-card" style="text-align:center">
      <p class="ok-text" style="font-size:19px;margin:6px 0">欠席の連絡を受け付けました</p>
      <p>${esc(jmdw(s.date))}（${esc(memberById(a.memberId).given)}）</p>
      ${c ? `<div class="info-box" style="text-align:left;margin:12px 0"><b>振替できる回が1回分つきました。</b><br>${esc(jmdw(c.expires))}まで使えます。</div>
        <a class="btn wide" href="#/makeup/${c.id}">振替先を選ぶ</a><div style="height:8px"></div>` : a.inDeadline ? '' : '<p class="small">締切を過ぎた欠席には、振替はつきません。</p>'}
      <a class="btn sub wide" href="#/home">ホームに戻る</a>
    </section>`, 'menu');
}

function makeupView(cid) {
  const c = db.credits.find((x) => x.id === cid);
  if (!c || c.status !== 'available') return absenceView();
  const m = memberById(c.memberId);
  const cands = makeupCandidates(m, c);
  return shell(`
    <a class="link" href="#/absence">‹ 欠席・振替</a>
    <section class="p-card">
      <h2>振替先を選ぶ（${esc(m.given)}）</h2>
      <p class="small">空きのある日だけを出しています。${esc(jmdw(c.expires))}まで。1か月に${db.rules.monthlyLimit}回まで。まだ確定していない月の日は選べません。</p>
      ${cands.length ? `<ul class="p-pick">${cands.map((s) => `<li><button type="button" data-pick="${s.id}">
        <span><b>${esc(mdw(s.date))}</b> ${esc(timeOf(s))}<br><span class="small">${esc(classById(s.classId).name)}・${esc(s.venue)}</span></span>
        <span class="small">あと${classById(s.classId).cap - rosterCount(s)}人</span></button></li>`).join('')}</ul>`
        : '<p class="note-box">いま選べる日がありません。翌月の予定が確定すると、選べる日が増えます。</p>'}
    </section>`, 'menu');
}
const rosterCount = (s) => db.members.filter((m) => m.status === 'active' && m.classId === s.classId).length
  + db.credits.filter((c) => c.reservedSessionId === s.id && ['reserved', 'pending'].includes(c.status)).length;

// --- 月謝 -------------------------------------------------------------------------------------
function feesView() {
  if (!on('fees')) return homeView();
  const m = kid();
  const recs = db.fees.filter((r) => r.memberId === m.id).sort((a, b) => b.month.localeCompare(a.month));
  const cur = recs[0];
  const basis = (r) => r.kind === 'per_session' ? `${yen(r.unit)} × ${r.count}回` : '月額';
  return shell(`
    <h1 class="p-title">月謝（${esc(m.given)}）</h1>
    ${cur ? `<section class="p-card">
      <h2>${ymLabel(cur.month)}分</h2>
      <p class="p-amount">${yen(feeTotal(cur))}</p>
      <p>${cur.paid ? '<span class="tag ok">入金を確認しました</span>' : '<span class="tag warn">まだ入金の確認ができていません</span>'}</p>
      <ul class="p-breakdown">
        <li><span>${esc(cur.plan)}（${basis(cur)}）</span><span>${yen(cur.base)}</span></li>
        ${cur.radj ? `<li><span>${esc(cur.radjNote)}（毎月）</span><span>${signedYen(cur.radj)}</span></li>` : ''}
        ${cur.oadj ? `<li><span>${esc(cur.oadjNote)}（今月だけ）</span><span>${signedYen(cur.oadj)}</span></li>` : ''}
      </ul>
      <p class="small" style="margin-top:8px">お支払いの方法は、これまでどおりクラブの案内に沿ってお願いします。</p>
    </section>` : '<section class="p-card"><p>まだ請求はありません。</p></section>'}
    <section class="p-card"><h2>これまで</h2><ul class="p-breakdown">${recs.slice(1).map((r) => `<li><span>${ymLabel(r.month)}</span><span>${yen(feeTotal(r))} ${r.paid ? '<span class="tag ok">入金済み</span>' : '<span class="tag warn">未入金</span>'}</span></li>`).join('') || '<li>ありません</li>'}</ul></section>`, 'menu');
}

// --- 成長の記録 -------------------------------------------------------------------------------
function growthView() {
  const m = kid();
  const shown = db.tagGroups.filter((g) => g.show);
  const hist = db.tagHistory.filter((h) => h.memberId === m.id && shown.some((g) => g.id === h.groupId)).sort((a, b) => b.at.localeCompare(a.at));
  const fbs = db.feedbacks.filter((f) => f.memberId === m.id && f.published).sort((a, b) => b.month.localeCompare(a.month));
  return shell(`
    <h1 class="p-title">成長の記録（${esc(m.given)}）</h1>
    ${on('tags') ? shown.map((g) => {
      const t = m.tags.map(tagById).find((x) => x?.group.id === g.id);
      const hs = hist.filter((h) => h.groupId === g.id);
      return `<section class="p-card"><h2>いまの${esc(g.name)}</h2><p class="p-kyu">${esc(t?.name ?? '—')}</p>
        ${hs.length ? `<h2 style="margin-top:12px">これまで</h2><ul class="p-history">${hs.map((h) => `<li><b>${Number(h.at.slice(0, 4))}年${Number(h.at.slice(5, 7))}月</b><br>${esc(tagById(h.from)?.name ?? '')} → ${esc(tagById(h.to)?.name ?? '')}</li>`).join('')}</ul>` : ''}</section>`;
    }).join('') : ''}
    ${on('feedback') ? `<section class="p-card"><h2>コーチから</h2>${fbs.length ? fbs.map((f) => `
      <div style="padding:8px 0;border-top:1px solid var(--line)">
        <p class="small">${ymLabel(f.month)}・${esc(f.by)}コーチ</p>
        <dl class="p-dl">${Object.entries(f.items).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}${f.skill ? `<dt>できた技</dt><dd>${esc(f.skill)}</dd>` : ''}</dl>
        <p style="margin-top:6px">${esc(f.text)}</p></div>`).join('') : '<p class="small">まだありません。</p>'}</section>` : ''}`, 'menu');
}

// --- 登録情報 ---------------------------------------------------------------------------------
function profileView(editing) {
  const m = kid();
  const consent = m.consent;
  if (editing) {
    const ec = form.ec ?? m.ec.map((e) => ({ ...e }));
    form.ec = ec;
    const row = (i) => `
      <fieldset style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px">
        <legend class="small">${i + 1}件目${i === 1 ? '（なくてもかまいません）' : ''}</legend>
        <div class="field"><label for="ec${i}-name">お名前</label><input type="text" id="ec${i}-name" value="${esc(ec[i]?.name ?? '')}" ${errors[`ec${i}`] ? 'aria-invalid="true"' : ''}></div>
        <div class="field"><label for="ec${i}-rel">続柄</label><input type="text" id="ec${i}-rel" value="${esc(ec[i]?.rel ?? '')}" placeholder="例：母"></div>
        <div class="field"><label for="ec${i}-phone">電話番号</label><input type="tel" id="ec${i}-phone" value="${esc(ec[i]?.phone ?? '')}" placeholder="例：090-0000-5678"></div>
        ${errors[`ec${i}`] ? `<p class="err" role="alert">${esc(errors[`ec${i}`])}</p>` : ''}
      </fieldset>`;
    return shell(`
      <a class="link" href="#/profile">‹ 登録情報</a>
      <section class="p-card"><h2>緊急連絡先を変える（${esc(m.given)}）</h2>
        <form id="ec-form" novalidate>${row(0)}${row(1)}<button type="submit" class="btn wide">保存する</button></form>
        <p class="small" style="margin-top:8px">住所・学校名などは、アプリには入れません（紙でクラブが保管します）。</p></section>`, 'menu');
  }
  return shell(`
    <h1 class="p-title">登録情報（${esc(m.given)}）</h1>
    <section class="p-card">
      <dl class="p-dl">
        <dt>会員番号</dt><dd>${memberNo(m)}</dd>
        <dt>名前</dt><dd>${esc(nameOf(m))}（${esc(m.fk)} ${esc(m.gk)}）</dd>
        <dt>生年月日</dt><dd>${esc(m.birth.replace(/-/g, '/'))}</dd>
        <dt>学年・年齢</dt><dd>${esc(gradeOf(m))}・${ageOf(m.birth)}歳</dd>
        <dt>クラス</dt><dd>${esc(classById(m.classId)?.name ?? '—')}</dd>
      </dl>
      <p class="small" style="margin-top:8px">名前・生年月日を直すときは、クラブにご連絡ください。学年は生年月日から自動で計算しています。</p>
    </section>
    <section class="p-card">
      <h2>緊急連絡先</h2>
      ${m.ec.map((e, i) => `<p>${i + 1}. ${esc(e.name)}（${esc(e.rel)}）<br><span class="small">${esc(e.phone)}</span></p>`).join('')}
      <a class="btn sub" href="#/profile/edit">変える</a>
    </section>
    <section class="p-card">
      <h2>会員規約</h2>
      <p>第${consent.v}版に同意しています（${esc(consent.how)}）</p>
      <a class="link" href="#/terms">規約を読む</a>
    </section>`, 'menu');
}

function termsView() {
  const t = termsLatest();
  return shell(`
    <a class="link" href="#/menu">‹ メニュー</a>
    <section class="p-card"><h2>会員規約（第${t.v}版）</h2><div class="p-terms">${esc(t.body)}</div></section>`, 'menu');
}

// 規約が改定されたら、開いたときに同意し直す画面を出す
function reconsentView() {
  const t = termsLatest();
  const need = kids().filter((k) => k.consent.v < t.v);
  return `
    <header class="p-head"><p class="p-club">${esc(db.club.name)}</p></header>
    <div class="phone-scroll"><main class="p-main">
      <section class="p-card">
        <h2 style="font-size:18px">会員規約が新しくなりました（第${t.v}版）</h2>
        <p>引き続きご利用いただくには、新しい規約への同意が必要です。</p>
        <div class="p-terms">${esc(t.body)}</div>
        <p class="small" style="margin-top:8px">対象：${need.map((k) => esc(k.given)).join('・')}</p>
        <label class="check"><input type="checkbox" id="re-agree"> 会員規約（第${t.v}版）に同意します</label>
        <button type="button" class="btn wide" id="re-submit" disabled>同意して進む</button>
      </section>
    </main></div>`;
}

// --- 入会の申込（見本）------------------------------------------------------------------------
function applyView(done) {
  if (done) {
    return shell(`<section class="p-card" style="text-align:center">
      <p class="ok-text" style="font-size:19px">申込を受け付けました</p>
      <p>クラブが内容を確かめて承認すると、会員番号が決まり、この画面に予定が出ます。</p>
      <p class="small">（デモ：事務担当の画面の「入会承認」に出ています）</p>
      <a class="btn sub wide" href="#/home">ホームに戻る</a></section>`, 'menu');
  }
  const t = termsLatest();
  const f = form;
  const birthOk = /^\d{4}-\d{2}-\d{2}$/.test(f.birth ?? '');
  const e = (k) => (errors[k] ? `<p class="err" role="alert">${esc(errors[k])}</p>` : '');
  return shell(`
    <a class="link" href="#/menu">‹ メニュー</a>
    <section class="p-card">
      <h2>入会を申し込む</h2>
      <p class="small">入れるのは、この5つだけです。住所などは、紙の入会書類でクラブにお渡しください。</p>
      <form id="apply-form" novalidate>
        <div class="field"><label for="ap-fam">お子さまの姓</label><input type="text" id="ap-fam" value="${esc(f.fam ?? '上野')}" ${errors.fam ? 'aria-invalid="true"' : ''}>${e('fam')}</div>
        <div class="field"><label for="ap-given">お子さまの名</label><input type="text" id="ap-given" value="${esc(f.given ?? '')}" ${errors.given ? 'aria-invalid="true"' : ''}>${e('given')}</div>
        <div class="field"><label for="ap-fk">せい（ひらがな）</label><input type="text" id="ap-fk" value="${esc(f.fk ?? 'うえの')}" ${errors.fk ? 'aria-invalid="true"' : ''}>${e('fk')}</div>
        <div class="field"><label for="ap-gk">めい（ひらがな）</label><input type="text" id="ap-gk" value="${esc(f.gk ?? '')}" ${errors.gk ? 'aria-invalid="true"' : ''}>${e('gk')}</div>
        <div class="field"><label for="ap-birth">生年月日</label><input type="date" id="ap-birth" value="${esc(f.birth ?? '')}" min="2008-01-01" max="${TODAY}" ${errors.birth ? 'aria-invalid="true"' : ''}>
          <p class="small" id="ap-grade">${birthOk ? `いまの学年：<b>${esc(gradeLabel(gradeNumber(f.birth)))}</b>（${ageOf(f.birth)}歳）` : '入れると、学年と年齢がここに出ます'}</p>${e('birth')}</div>
        <div class="field"><label for="ap-ec">緊急連絡先（お名前・続柄・電話番号）</label><input type="text" id="ap-ec" value="${esc(f.ec ?? '上野 美咲・母・090-0000-0111')}" ${errors.ec ? 'aria-invalid="true"' : ''}>${e('ec')}</div>
        <h3 style="font-size:15px;margin:6px 0">会員規約（第${t.v}版）</h3>
        <div class="p-terms" style="max-height:140px">${esc(t.body)}</div>
        <label class="check"><input type="checkbox" id="ap-agree" ${f.agree ? 'checked' : ''}> 会員規約に同意します</label>${e('agree')}
        <button type="submit" class="btn wide">申し込む</button>
      </form>
    </section>`, 'menu');
}

// =============================================================================
// 描く・操作
// =============================================================================
const root = document.getElementById('phone');
function render() {
  const [r, a] = route();
  const t = termsLatest();
  let html;
  if (kids().some((k) => k.consent.v < t.v)) html = reconsentView();
  else if (r === 'schedule' && on('schedule')) html = scheduleView();
  else if (r === 'notices') html = noticesView();
  else if (r === 'notice') html = noticeView(a);
  else if (r === 'menu') html = menuView();
  else if (r === 'absence' && a === 'new') html = absenceForm(route()[2]);
  else if (r === 'absence' && a === 'done') html = absenceDone(route()[2]);
  else if (r === 'absence') html = absenceView();
  else if (r === 'makeup' && on('makeup')) html = makeupView(a);
  else if (r === 'fees') html = feesView();
  else if (r === 'growth' && (on('tags') || on('feedback'))) html = growthView();
  else if (r === 'profile') html = profileView(a === 'edit');
  else if (r === 'terms') html = termsView();
  else if (r === 'apply') html = applyView(a === 'done');
  else html = homeView();
  const y = document.getElementById('scroll')?.scrollTop ?? 0;
  root.innerHTML = html + (modal ? modalHtml() : '');
  if (keepScroll) document.getElementById('scroll')?.scrollTo(0, y);
  keepScroll = false;
}
let keepScroll = false;

function modalHtml() {
  return `<div class="modal-back" id="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-h">${modal.html}</div></div>`;
}

// --- イベント ----------------------------------------------------------------------------------
root.addEventListener('click', (e) => {
  const el = e.target.closest('button, [data-kid]');
  if (!el) return;
  if (el.dataset.kid) { kidId = el.dataset.kid; sessionStorage.setItem('demo-kid', kidId); keepScroll = true; render(); return; }
  if (el.dataset.month !== undefined && el.dataset.month) { schedMonth = el.dataset.month; render(); return; }
  if (el.dataset.cancelAbsence) {
    const ab = db.absences.find((x) => x.id === el.dataset.cancelAbsence);
    ab.cancelled = true;
    // 使っていない振替権は消す
    db.credits = db.credits.filter((c) => !(c.absenceId === ab.id && c.status === 'available'));
    keepScroll = true;
    commit('欠席の連絡を取り消しました');
    return;
  }
  if (el.dataset.pick) {
    const s = sessionById(el.dataset.pick);
    const c = db.credits.find((x) => x.id === route()[1]);
    modal = { html: `<h2 id="modal-h">この日に振替で参加しますか？</h2>
      <p><b>${esc(jmdw(s.date))} ${esc(timeOf(s))}</b><br>${esc(classById(s.classId).name)}・${esc(s.venue)}</p>
      ${db.rules.approval === 'manual' ? '<p class="small">クラブが承認すると確定します。</p>' : ''}
      <div class="actions"><button type="button" class="btn" id="pick-ok" data-session="${s.id}" data-credit="${c.id}">参加する</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>` };
    render();
    document.getElementById('pick-ok')?.focus();
    return;
  }
  if (el.id === 'modal-close') { modal = null; render(); return; }
  if (el.id === 'pick-ok') {
    const c = db.credits.find((x) => x.id === el.dataset.credit);
    c.status = db.rules.approval === 'manual' ? 'pending' : 'reserved';
    c.reservedSessionId = el.dataset.session;
    modal = null;
    location.hash = '#/absence';
    commit(c.status === 'pending' ? '振替を申し込みました。クラブの承認を待っています' : '振替の参加が確定しました。予定にも出ます');
    return;
  }
  if (el.id === 're-submit') {
    const t = termsLatest();
    for (const k of kids()) if (k.consent.v < t.v) k.consent = { v: t.v, how: 'アプリ' };
    commit('新しい会員規約に同意しました');
  }
});
root.addEventListener('change', (e) => {
  if (e.target.id === 're-agree') document.getElementById('re-submit').disabled = !e.target.checked;
  if (e.target.name === 'reason') { form.reason = e.target.value; }
  if (e.target.id === 'ap-birth') {
    form.birth = e.target.value;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(form.birth);
    document.getElementById('ap-grade').innerHTML = ok ? `いまの学年：<b>${esc(gradeLabel(gradeNumber(form.birth)))}</b>（${ageOf(form.birth)}歳）` : '入れると、学年と年齢がここに出ます';
  }
});
root.addEventListener('click', (e) => { if (e.target.id === 'modal-back') { modal = null; render(); } });
root.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'absence-form') {
    form.note = document.getElementById('ab-note').value.trim();
    if (!form.reason) { errors = { reason: '理由を選んでください' }; render(); return; }
    const sid = route()[2];
    const s = sessionById(sid);
    const m = kid();
    const id = newId('a');
    const inDeadline = !pastDeadline(s);
    db.absences.push({ id, sessionId: sid, memberId: m.id, reason: form.reason, note: form.note, inDeadline, at: TODAY });
    if (on('makeup') && inDeadline) {
      db.credits.push({ id: newId('cr'), memberId: m.id, origin: 'absence', originSessionId: sid, absenceId: id, expires: creditExpiry(s.date), status: 'available', reservedSessionId: null });
    }
    form = {}; errors = {};
    location.hash = `#/absence/done/${id}`;
    commit();
    return;
  }
  if (f.id === 'ec-form') {
    const ec = [0, 1].map((i) => ({ name: document.getElementById(`ec${i}-name`).value.trim(), rel: document.getElementById(`ec${i}-rel`).value.trim(), phone: document.getElementById(`ec${i}-phone`).value.trim() }));
    errors = {};
    ec.forEach((x, i) => {
      const any = x.name || x.rel || x.phone;
      if ((i === 0 || any) && !(x.name && x.rel && /^0[0-9-]{9,12}$/.test(x.phone))) errors[`ec${i}`] = 'お名前・続柄・電話番号（0から始まる数字）をそろえて入れてください';
    });
    form.ec = ec;
    if (Object.keys(errors).length) { render(); return; }
    kid().ec = ec.filter((x) => x.name);
    form = {};
    location.hash = '#/profile';
    commit('緊急連絡先を保存しました');
    return;
  }
  if (f.id === 'apply-form') {
    const v = (id) => document.getElementById(id).value.trim();
    form = { fam: v('ap-fam'), given: v('ap-given'), fk: v('ap-fk'), gk: v('ap-gk'), birth: v('ap-birth'), ec: v('ap-ec'), agree: document.getElementById('ap-agree').checked };
    errors = {};
    if (!form.fam) errors.fam = '姓を入れてください';
    if (!form.given) errors.given = '名を入れてください';
    if (!/^[ぁ-ゖー]+$/.test(form.fk)) errors.fk = 'ひらがなで入れてください';
    if (!/^[ぁ-ゖー]+$/.test(form.gk)) errors.gk = 'ひらがなで入れてください';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birth)) errors.birth = '生年月日を入れてください';
    const ecParts = form.ec.split(/[・,、\s]+/).filter(Boolean);
    if (ecParts.length < 3 || !/^0[0-9-]{9,12}$/.test(ecParts[2])) errors.ec = '「お名前・続柄・電話番号」の形で入れてください';
    if (!form.agree) errors.agree = '会員規約への同意が必要です';
    if (Object.keys(errors).length) { render(); document.querySelector('[aria-invalid="true"]')?.focus(); return; }
    db.members.push({ id: newId('m'), no: null, status: 'pending', fam: form.fam, given: form.given, fk: form.fk, gk: form.gk, birth: form.birth,
      classId: null, planId: null, adj: 0, adjNote: '', family: FAMILY, tags: [], care: false, line: true,
      consent: { v: termsLatest().v, how: 'アプリ' }, applied: TODAY, approved: null,
      ec: [{ name: ecParts[0], rel: ecParts[1], phone: ecParts[2] }] });
    form = {};
    location.hash = '#/apply/done';
    commit();
  }
});
addEventListener('hashchange', () => { modal = null; errors = {}; if (!location.hash.startsWith('#/absence/new') && !location.hash.startsWith('#/profile/edit') && !location.hash.startsWith('#/apply')) form = {}; render(); document.getElementById('scroll')?.scrollTo(0, 0); });
onChange(render);

document.getElementById('bar').innerHTML = demoBar('parent');
bindDemoBar();
render();
