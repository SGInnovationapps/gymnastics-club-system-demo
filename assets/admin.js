// =============================================================================
// Clubena デモ：事務担当の画面（パソコン）
//   デモの事務担当は「中川さん」
//   ホーム（やること）／入会承認／開講情報／シフト確定／会員名簿／月謝チェックリスト／お知らせ／
//   Excel取り込み・書き出し／設定
// =============================================================================
import {
  db, commit, onChange, esc, on, STAGES, TODAY, NOW_TIME, demoBar, bindDemoBar, newId, showToast, copyText, appUrl,
  classById, memberById, sessionById, planById, nameOf, memberNo, gradeOf, ageOf, gradeNumber, kyuOf, tagById, activeMembers,
  monthOf, addMonths, ymLabel, mLabel, mdw, jmdw, md, wdLabel, wdOf, daysOf, yen, signedYen, feeTotal, feeRecord,
  isHeld, isPast, rosterOf, absenceOf, noticeFamilies, targetLabel, termsLatest, creditExpiry,
} from './core.js';

const ADMIN = '中川';
const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
let modal = null;
let state = {
  sessMonth: addMonths(monthOf(TODAY), 1),
  shiftMonth: addMonths(monthOf(TODAY), 1),
  feeMonth: monthOf(TODAY),
  feeUnpaidOnly: false,
  rosterClass: '', rosterQ: '', rosterStatus: 'active',
  picked: new Set(),
  notice: { type: 'all', id: '', title: '', body: '', ids: null },
  noticeSent: null,
  confirmResult: null,
  excel: null,
  approved: null,
  settingsTab: 'stages',
};
const timeOf = (s) => `${s.start}〜${s.end}`;
const lineText = (body) => `【${db.club.name}】${body}\n${appUrl()}`;
const lineBlock = (text) => `
  <div class="info-box" style="margin-top:12px"><b>クラブのLINEで流す一言</b>
    <p class="line-text">${esc(text)}</p>
    <div class="actions"><button type="button" class="btn sm" data-copy="${esc(text)}">文をコピーする</button></div>
    <p class="small" style="margin:6px 0 0">アプリからLINEには送りません。いつものLINEグループや公式アカウントに貼り付けて流してください。</p></div>`;

// --- 数える ---------------------------------------------------------------------------------
const pending = () => db.members.filter((m) => m.status === 'pending');
const missingAttendance = () => db.sessions.filter((s) => isHeld(s) && isPast(s) && s.date >= '2026-10-05'
  && !rosterOf(s).some(({ m }) => db.attendance[`${s.id}|${m.id}`])).sort((a, b) => b.date.localeCompare(a.date));
const unpaid = (ym) => db.fees.filter((r) => r.month === ym && !r.paid);
const diffs = () => db.fees.filter((r) => r.diff && !r.diffDone);
const expiring = () => db.credits.filter((c) => c.status === 'available' && c.expires >= TODAY && c.expires <= '2026-11-30');
const pendingMakeups = () => db.credits.filter((c) => c.status === 'pending');
const coachName = (id) => db.coaches.find((c) => c.id === id)?.name ?? '';

// --- 枠 -------------------------------------------------------------------------------------
function shell(body, key) {
  const menu = [
    ['home', 'ホーム', true, 0],
    ['approvals', '入会承認', true, pending().length],
    ['sessions', '開講情報', on('schedule'), 0],
    ['shifts', 'シフト確定', on('shifts'), 0],
    ['members', '会員名簿', true, 0],
    ['fees', '月謝チェックリスト', on('fees'), unpaid(monthOf(TODAY)).length],
    ['notices', 'お知らせ', on('notices'), 0],
    ['excel', 'Excel取り込み・書き出し', true, 0],
    ['settings', '設定', true, 0],
  ].filter((x) => x[2]);
  return `
    <div class="a-shell">
      <nav class="a-side" aria-label="メニュー">
        <p class="a-club">${esc(db.club.name)}</p>
        <p class="a-who">事務担当：${ADMIN}さん</p>
        <ul class="a-menu">${menu.map(([k, l, , n]) => `<li><a href="#/${k}" ${key === k ? 'aria-current="page"' : ''}><span>${l}</span>${n ? `<span class="a-badge" aria-label="${n}件">${n}</span>` : ''}</a></li>`).join('')}</ul>
      </nav>
      <main class="a-main" id="main" tabindex="-1">${body}</main>
    </div>`;
}

// =============================================================================
// ホーム（やること）
// =============================================================================
function homeView() {
  const next = addMonths(monthOf(TODAY), 1);
  const nextInfo = db.months[next];
  const nextSess = db.sessions.filter((s) => monthOf(s.date) === next && s.status === 'applying');
  const todo = [];
  if (pending().length) todo.push(['急ぎ', `入会の申込が${pending().length}件届いています`, '内容を確かめて承認すると、会員番号が決まります', '#/approvals', '確かめる', true]);
  if (on('schedule') && !nextInfo?.confirmedAt) {
    const decided = nextSess.filter((s) => s.lottery !== 'pending').length;
    todo.push(['急ぎ', `${mLabel(next)}の開講日がまだ確定していません`, `抽選の結果 ${nextSess.length}回のうち${decided}回を入力済み。全部入れたら「${mLabel(next)}分を確定する」を押します`, '#/sessions', '開講情報へ', true]);
  }
  if (on('shifts') && nextInfo?.confirmedAt && !db.shifts.confirmed[next]) todo.push(['確認', `${mLabel(next)}のシフトが確定していません`, 'コーチの希望を見ながら担当を決め、「シフトを確定する」を押します', '#/shifts', 'シフト確定へ', false]);
  const miss = missingAttendance();
  if (on('attendance') && miss.length) todo.push(['確認', `出席の記録が残っていない回が${miss.length}回あります`, miss.slice(0, 2).map((s) => `${jmdw(s.date)} ${classById(s.classId).name}`).join('、') + '（担当のコーチに記録を頼んでください）', 'coach.html#/today', 'コーチの画面', false]);
  if (on('makeup') && pendingMakeups().length) todo.push(['確認', `振替の承認待ちが${pendingMakeups().length}件あります`, '承認すると、保護者のホームに確定が出ます', '#/home', '', false, 'makeup']);
  if (on('fees') && unpaid(monthOf(TODAY)).length) todo.push(['確認', `${mLabel(monthOf(TODAY))}分の月謝が未入金の方が${unpaid(monthOf(TODAY)).length}人います`, 'チェックリストから、未入金の方だけにお知らせを送れます', '#/fees', 'チェックリストへ', false]);
  if (on('fees') && diffs().length) {
    const d = diffs()[0];
    todo.push(['確認', `中止による差額が${diffs().length}件あります`, `${nameOf(memberById(d.memberId))}さん ${signedYen(d.diff)}（${d.diffNote}）。次の月で調整するか、返金するかを決めてください`, '#/fees', '決める', false]);
  }
  if (on('makeup') && expiring().length) todo.push(['お知らせ', `振替の期限が近い方が${expiring().length}人います`, '11月30日で期限が切れます（保護者の画面にも出ています）', '#/members', '名簿を見る', false]);

  const today = db.sessions.filter((s) => s.date === TODAY && isHeld(s)).sort((a, b) => a.start.localeCompare(b.start));
  const latest = [...db.notices].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  const fams = latest ? noticeFamilies(latest) : new Set();
  const read = latest ? (db.reads[latest.id] ?? []).filter((f) => fams.has(f)).length : 0;
  const pm = makeupApprovals();
  return shell(`
    <p class="a-date">${esc(jmdw(TODAY))}</p>
    <h1 class="a-h1">今日のやること</h1>
    <p class="a-lead">上から順に片づければ大丈夫です。終わったものは自動で消えます。</p>
    <div class="a-grid">
      <section class="a-card" aria-label="やること">
        ${todo.length ? `<ul class="a-todo">${todo.map(([kind, title, sub, href, btn, urgent, special]) => `<li>
          <span class="a-kind ${urgent ? 'is-urgent' : ''}">${kind}</span>
          <div><p class="a-todo-title">${esc(title)}</p><p class="a-todo-sub">${esc(sub)}</p>${special === 'makeup' ? pm : ''}</div>
          ${btn ? `<a class="btn ${urgent ? '' : 'sub'}" href="${href}">${btn}</a>` : '<span></span>'}</li>`).join('')}</ul>`
          : '<p class="ok-box">今日のやることは、すべて終わっています。</p>'}
      </section>
      <div>
        <section class="a-card"><h2>今日のクラス</h2>
          ${today.length ? `<ul class="a-todo a-today">${today.map((s) => {
            const r = rosterOf(s);
            const ab = r.filter(({ m }) => absenceOf(s.id, m.id)).length;
            const mk = r.filter((x) => x.makeup).length;
            return `<li><b>${esc(timeOf(s))}</b><span><b>${esc(classById(s.classId).name)}</b><br><span class="small">${esc(s.venue)}・${(db.shifts.assign[s.id] ?? []).map(coachName).map((n) => n.split(' ')[0]).join('／') || '担当未定'}<br>来る予定 ${r.length - ab}人${mk ? `（振替${mk}）` : ''}</span></span></li>`;
          }).join('')}</ul>` : '<p class="small">今日はレッスンがありません。</p>'}
        </section>
        <section class="a-card"><h2>今月の数字</h2>
          <div class="a-stat"><span>在籍</span><b>${activeMembers().length}人</b></div>
          ${latest ? `<div class="a-stat"><span>最新のお知らせの既読</span><b>${read} / ${fams.size}家庭</b></div>
          <div class="a-bar"><span style="width:${fams.size ? Math.round(read / fams.size * 100) : 0}%"></span></div>
          <p class="small">「${esc(latest.title)}」</p>` : ''}
        </section>
      </div>
    </div>`, 'home');
}
function makeupApprovals() {
  return pendingMakeups().map((c) => {
    const s = sessionById(c.reservedSessionId);
    return `<div class="a-row" style="margin-top:6px"><span>${esc(nameOf(memberById(c.memberId)))} → ${esc(mdw(s.date))} ${esc(classById(s.classId).name)}</span>
      <button type="button" class="btn sm" data-approve-makeup="${c.id}">承認する</button></div>`;
  }).join('');
}

// =============================================================================
// 入会承認
// =============================================================================
function approvalsView() {
  const list = pending();
  const suggest = (m) => db.classes.find((c) => { const g = gradeNumber(m.birth); return g >= c.gmin && g <= c.gmax; })?.id ?? '';
  return shell(`
    <h1 class="a-h1">入会承認</h1>
    <p class="a-lead">LINEから届いた入会の申込です。クラスを選んで承認すると、会員番号が決まります。</p>
    ${state.approved ? `<section class="a-card" style="text-align:center" aria-live="polite">
      <h2>${esc(nameOf(memberById(state.approved)))}さんを承認しました</h2>
      <p>会員番号</p><p class="a-member-no">${memberNo(memberById(state.approved))}</p>
      <p>この番号を、紙の入会書類に書き写して保管してください。</p>
      <button type="button" class="btn sub" data-dismiss-approved>閉じる</button></section>` : ''}
    <section class="a-card">
      <h2>承認待ち（${list.length}人）</h2>
      ${list.length ? list.map((m) => `<div class="a-apply">
        <p style="margin:0;font-size:18px"><b>${esc(nameOf(m))}</b> <span class="small">${esc(m.fk)} ${esc(m.gk)}</span></p>
        <p class="small" style="margin:2px 0 8px">生年月日 ${esc(m.birth.replace(/-/g, '/'))}（${esc(gradeOf(m))}・${ageOf(m.birth)}歳）・申込 ${esc(md(m.applied))}・緊急連絡先 ${m.ec.length}件・会員規約 第${m.consent.v}版に同意${m.care ? '・<b>配慮あり</b>' : ''}</p>
        <div class="a-row">
          <label>クラス <select data-class-for="${m.id}">${db.classes.map((c) => `<option value="${c.id}" ${c.id === suggest(m) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          ${on('fees') ? `<label>料金プラン <select data-plan-for="${m.id}">${db.plans.map((p) => `<option value="${p.id}" ${p.id === (gradeNumber(m.birth) <= 0 ? 'p2' : 'p1') ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
          <button type="button" class="btn" data-approve="${m.id}">承認して会員番号を出す</button>
        </div></div>`).join('') : '<p class="small">承認待ちの申込はありません。保護者の画面の「メニュー」→「入会を申し込む」から送ると、ここに出ます。</p>'}
    </section>
    <section class="a-card"><h2>LINEを使わない家庭</h2>
      <p>紙の申込書から登録できます（「紙で同意済み」として記録）。<span class="small">（デモでは省略しています）</span></p></section>`, 'approvals');
}

// =============================================================================
// 開講情報
// =============================================================================
function sessionsView() {
  const months = [monthOf(TODAY), addMonths(monthOf(TODAY), 1), addMonths(monthOf(TODAY), 2)];
  const ym = state.sessMonth;
  const info = db.months[ym];
  const list = db.sessions.filter((s) => monthOf(s.date) === ym).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const tabs = `<nav class="a-tabs" aria-label="月">${months.map((m) => `<a href="#/sessions" data-sess-month="${m}" ${m === ym ? 'aria-current="page"' : ''}>${ymLabel(m)}${db.months[m]?.confirmedAt ? '（確定）' : ''}</a>`).join('')}</nav>`;
  let body;
  if (info?.confirmedAt) {
    body = `
      <section class="a-card">
        <p class="ok-box">${ymLabel(ym)}分は ${esc(jmdw(info.confirmedAt))} に確定しました。保護者の予定に出ています。</p>
        <p class="small" style="margin-top:8px">確定のあとで変えられるのは、その日を「中止」にするか「会場を変える」だけです。変えると、そのクラスの保護者のホームに知らせが出ます。</p>
        <div class="a-table-wrap"><table class="a-table"><thead><tr><th>日付</th><th>クラス</th><th>時間</th><th>会場</th><th>状態</th><th></th></tr></thead><tbody>
        ${list.filter((s) => s.status !== 'applying').map((s) => `<tr class="${s.status === 'cancelled' ? 'is-cancelled' : ''}">
          <td>${esc(mdw(s.date))}</td><td>${esc(classById(s.classId).name)}</td><td>${esc(timeOf(s))}</td><td>${esc(s.venue)}</td>
          <td>${s.status === 'cancelled' ? `<span class="tag warn">中止</span> <span class="small">${esc(s.note)}</span>` : s.status === 'venue_changed' ? `<span class="tag warn">会場変更</span>` : '<span class="tag ok">確定</span>'}</td>
          <td>${isHeld(s) && s.date > TODAY ? `<button type="button" class="link" data-cancel-session="${s.id}">中止にする</button><button type="button" class="link" data-venue-session="${s.id}">会場を変える</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
      </section>`;
  } else {
    const app = list.filter((s) => s.status === 'applying');
    const n = { pending: 0, won: 0, lost: 0 };
    for (const s of app) n[s.lottery]++;
    body = `
      <section class="a-card">
        <h2>${ymLabel(ym)}分は、まだ確定していません</h2>
        <p class="small">申込中の回は、確定するまで保護者には見えません。抽選の結果が出たら「取れた」「取れなかった」を押していきます。</p>
        ${app.length ? `<p>候補 <b>${app.length}</b>回：取れた <b>${n.won}</b>・取れなかった <b>${n.lost}</b>・結果待ち <b>${n.pending}</b></p>` : ''}
        <div class="a-row" style="margin:8px 0 4px">
          <label>確定の予定日（保護者に「○日ごろ確定します」と出ます） <input type="date" id="expected" value="${esc(info?.expected ?? '')}" style="min-height:40px;padding:0 8px;border:1px solid var(--line);border-radius:8px"></label>
          <button type="button" class="btn sub sm" data-save-expected>保存</button>
        </div>
        ${app.length ? `<div class="actions" style="margin-top:14px">
          <button type="button" class="btn" data-confirm-month ${n.pending ? 'disabled' : ''}>${mLabel(ym)}分を確定する</button>
          ${n.pending ? `<span class="small">結果待ちが${n.pending}回あります。すべて入れると押せます。</span>` : ''}</div>` : ''}
      </section>
      <section class="a-card"><h2>候補日と抽選の結果（${app.length}回）</h2>
        ${app.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th>日付</th><th>クラス</th><th>時間</th><th>会場</th><th>抽選の結果</th></tr></thead><tbody>
        ${app.map((s) => `<tr class="${s.lottery === 'lost' ? 'is-lost' : ''}"><td>${esc(mdw(s.date))}</td><td>${esc(classById(s.classId).name)}</td><td>${esc(timeOf(s))}</td><td>${esc(s.venue)}</td>
          <td><span class="a-lot" role="group" aria-label="${esc(mdw(s.date))} ${esc(classById(s.classId).name)} の抽選の結果">${[['pending', '結果待ち'], ['won', '取れた'], ['lost', '取れなかった']].map(([v, l]) => `<button type="button" class="is-${v}" data-lottery="${s.id}" data-v="${v}" aria-pressed="${s.lottery === v}">${l}</button>`).join('')}</span></td></tr>`).join('')}
        </tbody></table></div>`
          : `<p>まだ候補日がありません。</p><button type="button" class="btn" data-copy-pattern>先月と同じ曜日・時間で並べる</button>`}
      </section>`;
  }
  return shell(`
    <h1 class="a-h1">開講情報</h1>
    <p class="a-lead">翌月の候補日を並べ、抽選の結果を入れて、最後に「○月分を確定する」を1回押します。</p>
    ${tabs}
    ${state.confirmResult && state.confirmResult.ym === ym ? confirmResultCard() : ''}
    ${body}`, 'sessions');
}
function confirmResultCard() {
  const r = state.confirmResult;
  return `<section class="a-card" aria-live="polite">
    <h2>${ymLabel(r.ym)}分を確定しました</h2>
    <ul class="a-steps">
      <li>開講日 ${r.won}回を保護者に公開しました（取れなかった ${r.lost}回は出していません）</li>
      <li>保護者のホームに「${mLabel(r.ym)}の予定が確定しました」を出しました</li>
      ${on('shifts') ? '<li>コーチのシフト希望の受付を始めました</li>' : ''}
      ${on('fees') ? `<li>回数制の会員 ${r.perSession}人の${mLabel(r.ym)}分の請求額を計算しました（固定制は${mLabel(r.ym)}1日に自動で作られます）</li>` : ''}
    </ul>
    ${lineBlock(lineText(`${mLabel(r.ym)}の練習日が決まりました。アプリの「予定」でご確認ください。`))}
    <div class="actions"><a class="btn sub" href="parent.html#/schedule">保護者の予定で見る</a>${on('shifts') ? '<a class="btn sub" href="coach.html#/wishes">コーチのシフト希望で見る</a>' : ''}</div>
  </section>`;
}

function confirmMonth(ym) {
  const app = db.sessions.filter((s) => monthOf(s.date) === ym && s.status === 'applying');
  const won = app.filter((s) => s.lottery === 'won');
  const lost = app.filter((s) => s.lottery === 'lost');
  for (const s of won) s.status = 'confirmed';
  db.sessions = db.sessions.filter((s) => !lost.includes(s));
  (db.months[ym] ??= { expected: null }).confirmedAt = TODAY;
  db.notices.push({ id: newId('n'), kind: 'confirm', title: `${mLabel(ym)}の予定が確定しました`, body: `${mLabel(ym)}の練習日が決まりました。「予定」でお子さまのクラスの日をご確認ください。`, target: { type: 'all' }, sentAt: TODAY });
  // 回数制の請求（確定した回数で計算）
  let perSession = 0;
  if (on('fees')) {
    for (const m of activeMembers().filter((x) => planById(x.planId)?.kind === 'per_session')) {
      db.fees = db.fees.filter((r) => !(r.memberId === m.id && r.month === ym));
      db.fees.push(feeRecord(db, m, ym));
      perSession++;
    }
  }
  // ほかのコーチのシフト希望（デモ用に、先に出してあることにする）
  for (const s of won) {
    for (const c of db.coaches.filter((x) => x.id !== 'u1' && x.assign[s.classId])) {
      db.shifts.wishes[`${c.id}|${s.id}`] = (wdOf(s.date) === 6 && c.id === 'u2' && s.date.endsWith('19')) ? '×' : (s.date.endsWith('12') ? '△' : '○');
    }
  }
  state.confirmResult = { ym, won: won.length, lost: lost.length, perSession };
  commit(`${mLabel(ym)}分を確定しました`);
}

// 確定のあとの中止・会場変更
function cancelSession(s, note) {
  s.status = 'cancelled';
  s.note = note;
  const cls = classById(s.classId);
  // その日の欠席連絡・振替の予約は消える（振替の予約は、使っていない状態に戻す）
  db.absences = db.absences.filter((a) => a.sessionId !== s.id);
  for (const c of db.credits.filter((x) => x.reservedSessionId === s.id)) { c.status = 'available'; c.reservedSessionId = null; }
  // 固定制は振替権、回数制は請求回数を1回減らす（入金済みなら金額は変えずに差額を出す）
  for (const m of activeMembers().filter((x) => x.classId === s.classId)) {
    const plan = planById(m.planId);
    if (plan.kind === 'per_session' && db.rules.perSessionCancel === 'reduce') {
      const r = db.fees.find((x) => x.memberId === m.id && x.month === monthOf(s.date));
      if (!r) continue;
      if (r.paid) { r.diff -= plan.amount; r.diffNote = `${md(s.date)} 中止の分`; r.diffDone = false; }
      else { r.count -= 1; r.base -= plan.amount; }
    } else if (on('makeup')) {
      db.credits.push({ id: newId('cr'), memberId: m.id, origin: 'cancellation', originSessionId: s.id, expires: creditExpiry(s.date), status: 'available', reservedSessionId: null });
    }
  }
  db.notices.push({ id: newId('n'), kind: 'change', title: `${jmdw(s.date)} ${cls.name}は中止です`, body: `${note}\n\n${on('makeup') ? '月4回コースなどの方には、振替できる回が1回分つきます。' : ''}${on('fees') ? '回数制の方は、請求回数から1回減ります。' : ''}`, target: { type: 'class', id: s.classId }, sentAt: TODAY });
  return lineText(`${jmdw(s.date)}の${cls.name}は中止になりました。くわしくはアプリのお知らせをご確認ください。`);
}

// =============================================================================
// シフト確定
// =============================================================================
function shiftsView() {
  const months = [monthOf(TODAY), addMonths(monthOf(TODAY), 1)];
  const ym = state.shiftMonth;
  const tabs = `<nav class="a-tabs" aria-label="月">${months.map((m) => `<a href="#/shifts" data-shift-month="${m}" ${m === ym ? 'aria-current="page"' : ''}>${ymLabel(m)}${db.shifts.confirmed[m] ? '（確定）' : ''}</a>`).join('')}</nav>`;
  if (!db.months[ym]?.confirmedAt) {
    return shell(`<h1 class="a-h1">シフト確定</h1>${tabs}<section class="a-card"><p>${mLabel(ym)}分の開講日が確定すると、コーチのシフト希望の受付が始まり、ここで担当を決められます。</p><a class="btn sub" href="#/sessions">開講情報へ</a></section>`, 'shifts');
  }
  const list = db.sessions.filter((s) => monthOf(s.date) === ym && isHeld(s)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const done = db.shifts.confirmed[ym];
  const short = list.filter((s) => (db.shifts.assign[s.id] ?? []).length < classById(s.classId).need);
  return shell(`
    <h1 class="a-h1">シフト確定</h1>
    <p class="a-lead">コーチの希望（○ 入れる・△ 相談・× 入れない・未 まだ出していない）を見ながら、欄を押して担当を決めます（青が担当）。必要な人数に足りない日は色がつきます。</p>
    ${tabs}
    <section class="a-card">
      ${done ? `<p class="ok-box">${mLabel(ym)}のシフトは確定しています。コーチのホームに出ています。</p>` : `<p>${short.length ? `<span class="warn-text">人数が足りない日が${short.length}回あります。</span>` : '<span class="ok-text">すべての回の人数が足りています。</span>'}</p>`}
      <div class="a-table-wrap"><table class="a-table a-shift"><thead><tr><th>日付・クラス</th>${db.coaches.map((c) => `<th>${esc(c.name)}</th>`).join('')}<th>必要</th></tr></thead><tbody>
      ${list.map((s) => {
        const as = db.shifts.assign[s.id] ?? [];
        const need = classById(s.classId).need;
        return `<tr class="${as.length < need ? 'is-short' : ''}"><td><b>${esc(mdw(s.date))}</b> ${esc(s.start)}<br><span class="small">${esc(classById(s.classId).name)}</span></td>
          ${db.coaches.map((c) => {
            const w = db.shifts.wishes[`${c.id}|${s.id}`] ?? '未';
            if (!c.assign[s.classId]) return '<td class="small">担当外</td>';
            return `<td><button type="button" class="a-cell" data-assign="${s.id}" data-coach="${c.id}" aria-pressed="${as.includes(c.id)}" ${done ? 'disabled' : ''} aria-label="${esc(c.name)}（希望 ${w}）">${w}</button></td>`;
          }).join('')}
          <td>${as.length} / ${need}</td></tr>`;
      }).join('')}
      </tbody></table></div>
      ${done ? '' : `<div class="actions"><button type="button" class="btn" data-confirm-shift="${ym}">シフトを確定する</button><span class="small">確定すると、コーチのホームに担当の日が出ます。</span></div>`}
    </section>`, 'shifts');
}

// =============================================================================
// 会員名簿
// =============================================================================
function membersView() {
  const st = state;
  let list = db.members.filter((m) => m.status === st.rosterStatus);
  if (st.rosterClass) list = list.filter((m) => m.classId === st.rosterClass);
  if (st.rosterQ) { const q = st.rosterQ; list = list.filter((m) => `${m.fam}${m.given}${m.fk}${m.gk}${memberNo(m)}`.includes(q)); }
  list.sort((a, b) => (a.no ?? 9999) - (b.no ?? 9999));
  const pickedHere = list.filter((m) => st.picked.has(m.id));
  return shell(`
    <h1 class="a-h1">会員名簿</h1>
    <p class="a-lead">学年と年齢は生年月日から毎回計算しています（4月2日〜翌年4月1日生まれが同じ学年）。名前を押すと、くわしい情報と緊急連絡先を見られます。</p>
    <section class="a-card">
      <div class="a-toolbar">
        <select id="r-status" aria-label="状態"><option value="active" ${st.rosterStatus === 'active' ? 'selected' : ''}>在籍中</option><option value="pending" ${st.rosterStatus === 'pending' ? 'selected' : ''}>申込中</option></select>
        <select id="r-class" aria-label="クラス"><option value="">すべてのクラス</option>${db.classes.map((c) => `<option value="${c.id}" ${st.rosterClass === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <input type="search" id="r-q" placeholder="名前・ふりがな・番号で探す" value="${esc(st.rosterQ)}" aria-label="探す">
        <span class="small">${list.length}人</span>
        <span style="flex:1"></span>
        ${on('tags') ? `<button type="button" class="btn sub sm" data-bulk-kyu ${pickedHere.length ? '' : 'disabled'}>選んだ${pickedHere.length}人の級を変える</button>` : ''}
        ${on('notices') ? `<button type="button" class="btn sub sm" data-bulk-notice ${pickedHere.length ? '' : 'disabled'}>選んだ人にお知らせ</button>` : ''}
      </div>
      <div class="a-table-wrap"><table class="a-table"><thead><tr>
        <th><input type="checkbox" id="r-all" aria-label="すべて選ぶ" ${list.length && pickedHere.length === list.length ? 'checked' : ''}></th>
        <th>番号</th><th>名前</th><th>生年月日</th><th>学年</th><th class="num">年齢</th><th>クラス</th>${on('tags') ? '<th>級</th>' : ''}<th>保護者のLINE</th><th>会員規約</th><th>配慮</th></tr></thead><tbody>
      ${list.map((m) => `<tr class="${st.picked.has(m.id) ? 'is-selected' : ''}">
        <td><input type="checkbox" data-pick="${m.id}" ${st.picked.has(m.id) ? 'checked' : ''} aria-label="${esc(nameOf(m))}を選ぶ"></td>
        <td>${memberNo(m)}</td>
        <td><button type="button" class="link" style="min-height:0;padding:0;text-align:left" data-detail="${m.id}">${esc(nameOf(m))}</button><span class="kana">${esc(m.fk)} ${esc(m.gk)}</span></td>
        <td>${esc(m.birth.replace(/-/g, '/'))}</td><td>${esc(gradeOf(m))}</td><td class="num">${ageOf(m.birth)}</td>
        <td>${esc(classById(m.classId)?.name ?? '—')}</td>${on('tags') ? `<td>${esc(kyuOf(m))}</td>` : ''}
        <td>${m.line ? 'つながっている' : '<span class="tag muted">LINEなし</span>'}</td>
        <td>第${m.consent.v}版（${esc(m.consent.how)}）${m.consent.v < termsLatest().v ? ' <span class="tag warn">同意待ち</span>' : ''}</td>
        <td>${m.care ? '<span class="tag">あり</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`, 'members');
}
function memberDetail(id, showEc) {
  const m = memberById(id);
  const plan = planById(m.planId);
  const hist = db.tagHistory.filter((h) => h.memberId === m.id).sort((a, b) => b.at.localeCompare(a.at));
  const logs = db.ecLog.filter((l) => l.memberId === m.id).slice(-4).reverse();
  return `<h2 id="modal-h">${esc(nameOf(m))}（${memberNo(m)}）</h2>
    <dl class="p-dl">
      <dt>ふりがな</dt><dd>${esc(m.fk)} ${esc(m.gk)}</dd>
      <dt>生年月日</dt><dd>${esc(m.birth.replace(/-/g, '/'))}（${esc(gradeOf(m))}・${ageOf(m.birth)}歳）</dd>
      <dt>クラス</dt><dd>${esc(classById(m.classId)?.name ?? '—')}</dd>
      ${on('fees') && plan ? `<dt>料金プラン</dt><dd>${esc(plan.name)}（${plan.kind === 'fixed' ? `月額 ${yen(plan.amount)}` : `1回 ${yen(plan.amount)}`}）${m.adj ? `<br>毎月の調整：${esc(m.adjNote)} ${signedYen(m.adj)}` : ''}</dd>` : ''}
      ${on('tags') ? `<dt>タグ</dt><dd>${m.tags.map(tagById).filter(Boolean).map((t) => `${esc(t.group.name)}：${esc(t.name)}`).join('、') || 'なし'}</dd>` : ''}
      ${on('tags') && hist.length ? `<dt>級の記録</dt><dd>${hist.map((h) => `${esc(h.at.replace(/-/g, '/'))} ${esc(tagById(h.from)?.name)} → ${esc(tagById(h.to)?.name)}（${esc(h.by)}）`).join('<br>')}</dd>` : ''}
    </dl>
    <h3 style="font-size:15px;margin:14px 0 6px">緊急連絡先</h3>
    ${showEc ? `${m.ec.map((x, i) => `<p style="margin:0 0 4px">${i + 1}. ${esc(x.name)}（${esc(x.rel)}） ${esc(x.phone)}</p>`).join('')}<p class="small">見た記録を残しました（${ADMIN}・${md(TODAY)} ${NOW_TIME}）。</p>`
      : `<button type="button" class="btn sub sm" data-show-ec="${m.id}">緊急連絡先を見る（見た記録が残ります）</button>`}
    ${logs.length ? `<p class="small" style="margin-top:8px">これまでに見た人：${logs.map((l) => `${esc(l.by)}（${esc(l.at.slice(5).replace('-', '/'))}）`).join('、')}</p>` : ''}
    <p class="small" style="margin-top:10px">住所・学校名などはシステムに持ちません。紙の入会書類を、会員番号で探してください。</p>
    <div class="actions"><button type="button" class="btn" id="modal-close">閉じる</button></div>`;
}

// =============================================================================
// 月謝チェックリスト
// =============================================================================
function feesView() {
  const months = [...new Set(db.fees.map((r) => r.month))].sort();
  if (!months.includes(state.feeMonth)) state.feeMonth = months[months.length - 1];
  const ym = state.feeMonth;
  let rows = db.fees.filter((r) => r.month === ym).map((r) => ({ r, m: memberById(r.memberId) })).filter((x) => x.m);
  const total = rows.reduce((n, x) => n + feeTotal(x.r), 0);
  const un = rows.filter((x) => !x.r.paid);
  if (state.feeUnpaidOnly) rows = un;
  rows.sort((a, b) => (a.m.no ?? 9999) - (b.m.no ?? 9999));
  return shell(`
    <h1 class="a-h1">月謝チェックリスト</h1>
    <p class="a-lead">請求額 ＝ 基本額 ＋ 毎月の調整 ＋ 今月だけの調整。入金を確かめたら「入金」にチェックを入れます（集金はこれまでどおりの方法で行います）。</p>
    <nav class="a-tabs" aria-label="月">${months.map((m) => `<a href="#/fees" data-fee-month="${m}" ${m === ym ? 'aria-current="page"' : ''}>${ymLabel(m)}</a>`).join('')}</nav>
    <section class="a-card">
      <div class="a-toolbar">
        <span>請求 <b>${rows.length + (state.feeUnpaidOnly ? db.fees.filter((r) => r.month === ym && r.paid).length : 0)}</b>人・合計 <b>${yen(total)}</b>・未入金 <b class="${un.length ? 'warn-text' : ''}">${un.length}人（${yen(un.reduce((n, x) => n + feeTotal(x.r), 0))}）</b></span>
        <label class="check" style="min-height:36px"><input type="checkbox" id="unpaid-only" ${state.feeUnpaidOnly ? 'checked' : ''}> 未入金だけ</label>
        <span style="flex:1"></span>
        ${on('notices') && un.length ? `<button type="button" class="btn sm" data-remind="${ym}">未入金の${un.length}人にお知らせを送る</button>` : ''}
        <button type="button" class="btn sub sm" data-export="fees">Excelに書き出す</button>
      </div>
      <div class="a-table-wrap"><table class="a-table"><thead><tr><th>番号</th><th>名前</th><th>料金プラン</th><th class="num">基本額</th><th>毎月の調整</th><th>今月だけの調整</th><th class="num">請求額</th><th>入金</th><th>差額</th></tr></thead><tbody>
      ${rows.map(({ r, m }) => `<tr class="${r.paid ? '' : 'is-unpaid'}">
        <td>${memberNo(m)}</td><td>${esc(nameOf(m))}<span class="kana">${esc(classById(m.classId)?.name ?? '')}</span></td>
        <td>${esc(r.plan)}</td>
        <td class="num">${yen(r.base)}<span class="kana">${r.kind === 'per_session' ? `${yen(r.unit)}×${r.count}回` : '月額'}</span></td>
        <td>${r.radj ? `${signedYen(r.radj)}<span class="kana">${esc(r.radjNote)}</span>` : ''}</td>
        <td>${r.oadj ? `${signedYen(r.oadj)}<span class="kana">${esc(r.oadjNote)}</span>` : ''}<button type="button" class="link" style="min-height:0" data-oadj="${r.id}">${r.oadj ? '直す' : '足す'}</button></td>
        <td class="num"><b>${yen(feeTotal(r))}</b></td>
        <td><label class="check" style="min-height:36px"><input type="checkbox" data-paid="${r.id}" ${r.paid ? 'checked' : ''} aria-label="${esc(nameOf(m))}の入金"> ${r.paid ? '済' : '未'}</label></td>
        <td>${r.diff && !r.diffDone ? `<span class="warn-text">${signedYen(r.diff)}</span><span class="kana">${esc(r.diffNote)}</span><button type="button" class="link" style="min-height:0" data-diff="${r.id}">決める</button>` : r.diffDone ? `<span class="small">${esc(r.diffDone)}</span>` : ''}</td>
      </tr>`).join('')}
      </tbody></table></div>
      <p class="small" style="margin-top:8px">過去の月の金額は書き換わりません（請求したときの金額・プラン名をそのまま残しています）。</p>
    </section>
    ${state.noticeSent?.from === 'fees' ? `<section class="a-card">${lineBlock(state.noticeSent.line)}</section>` : ''}`, 'fees');
}

// =============================================================================
// お知らせ
// =============================================================================
function noticesView() {
  const n = state.notice;
  const list = [...db.notices].sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id));
  const tagOpts = db.tagGroups.flatMap((g) => g.tags.map((t) => ({ id: t.id, label: `${g.name}：${t.name}` })));
  return shell(`
    <h1 class="a-h1">お知らせ</h1>
    <p class="a-lead">アプリの中のお知らせです。保護者のホームに未読の印つきで出ます。送ったあと、クラブのLINEで流す一言をコピーできます。</p>
    <div class="a-grid">
      <section class="a-card">
        <h2>お知らせを書く</h2>
        ${state.noticeSent?.from === 'notices' ? `<p class="ok-box">送りました（${state.noticeSent.families}家庭）</p>${lineBlock(state.noticeSent.line)}<div class="actions"><button type="button" class="btn sub" data-new-notice>もう1つ書く</button></div>` : `
        <form id="notice-form" novalidate>
          <fieldset class="field" style="border:0;padding:0"><legend class="label">宛先</legend>
            <div class="choices">${[['all', '全員'], ['class', 'クラス'], ...(on('tags') ? [['tag', 'タグ']] : []), ['member', '個人']].map(([v, l]) => `<label class="choice"><input type="radio" name="n-type" value="${v}" ${n.type === v ? 'checked' : ''}>${l}</label>`).join('')}</div>
          </fieldset>
          ${n.type === 'class' ? `<div class="field"><label for="n-id">クラス</label><select id="n-id">${db.classes.map((c) => `<option value="${c.id}" ${n.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
          ${n.type === 'tag' ? `<div class="field"><label for="n-id">タグ</label><select id="n-id">${tagOpts.map((t) => `<option value="${t.id}" ${n.id === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>` : ''}
          ${n.type === 'member' ? `<div class="field"><label for="n-id">会員</label>${n.ids ? `<p>${n.ids.map((id) => esc(nameOf(memberById(id)))).join('、')}</p>` : `<select id="n-id">${activeMembers().map((m) => `<option value="${m.id}" ${n.id === m.id ? 'selected' : ''}>${memberNo(m)} ${esc(nameOf(m))}</option>`).join('')}</select>`}</div>` : ''}
          <div class="field"><label for="n-title">題名</label><input type="text" id="n-title" maxlength="60" value="${esc(n.title)}" ${n.err?.title ? 'aria-invalid="true"' : ''}>${n.err?.title ? `<p class="err">${n.err.title}</p>` : ''}</div>
          <div class="field"><label for="n-body">本文</label><textarea id="n-body" maxlength="2000" ${n.err?.body ? 'aria-invalid="true"' : ''}>${esc(n.body)}</textarea>${n.err?.body ? `<p class="err">${n.err.body}</p>` : ''}</div>
          <button type="submit" class="btn">送る</button>
        </form>`}
      </section>
      <section class="a-card">
        <h2>送ったお知らせ</h2>
        ${list.map((x) => {
          const fams = noticeFamilies(x);
          const read = (db.reads[x.id] ?? []).filter((f) => fams.has(f)).length;
          return `<div style="padding:10px 0;border-top:1px solid var(--line)"><p style="margin:0"><b>${esc(x.title)}</b></p>
            <p class="small" style="margin:0">${esc(md(x.sentAt))}・${esc(targetLabel(x.target))}・既読 ${read} / ${fams.size}家庭</p>
            <div class="a-bar"><span style="width:${fams.size ? Math.round(read / fams.size * 100) : 0}%"></span></div></div>`;
        }).join('')}
      </section>
    </div>`, 'notices');
}

// =============================================================================
// Excel取り込み・書き出し
// =============================================================================
const SAMPLE_BAD = [
  { row: 4, name: '岡田 りん', kana: 'おかだ りん', birth: '2018-07-07', cls: '小学生クラスA', issues: [] },
  { row: 5, name: '西村 そう', kana: 'ニシムラ そう', birth: '2019-03-03', cls: '小学生クラスA', issues: [['warn', 'カタカナをひらがなに直しました（ニシムラ → にしむら）']] },
  { row: 6, name: '岡田 りん', kana: 'おかだ りん', birth: '2018-07-07', cls: '小学生クラスA', issues: [['error', '同じ人が2回出てきます（4行目と同じ）']] },
  { row: 7, name: '野口 はな', kana: 'のぐち はな', birth: '2016-13-01', cls: '中学生クラス', issues: [['error', '生年月日が正しくありません'], ['error', 'クラス「中学生クラス」がありません']] },
];
const SAMPLE_OK = [
  { row: 4, name: '岡田 りん', kana: 'おかだ りん', birth: '2018-07-07', cls: 'c2' },
  { row: 5, name: '西村 そう', kana: 'にしむら そう', birth: '2019-03-03', cls: 'c2' },
  { row: 6, name: '野口 はな', kana: 'のぐち はな', birth: '2016-11-01', cls: 'c3' },
];
function excelView() {
  const x = state.excel;
  let res = '';
  if (x === 'bad') {
    const errs = SAMPLE_BAD.flatMap((r) => r.issues.filter((i) => i[0] === 'error').map((i) => ({ row: r.row, msg: i[1] })));
    res = `<p class="err" role="alert">間違いが${errs.length}件あります。Excelを直して、もう一度選んでください。何も取り込んでいません。</p>
      ${SAMPLE_BAD.flatMap((r) => r.issues.map(([lv, msg]) => `<div class="a-issue is-${lv}"><b>${lv === 'error' ? '間違い' : '自動で直した'}</b>　名簿・${r.row}行目（${esc(r.name)}）：${esc(msg)}</div>`)).join('')}
      <div class="actions"><button type="button" class="btn" data-excel="ok">直した見本のファイルで試す</button></div>`;
  } else if (x === 'ok') {
    res = `<p class="ok-box">間違いはありません。下の内容を確かめて、取り込んでください。</p>
      <div class="a-table-wrap" style="margin-top:8px"><table class="a-table"><thead><tr><th>行</th><th>番号（決まるもの）</th><th>名前</th><th>生年月日</th><th>学年</th><th>クラス</th></tr></thead><tbody>
      ${SAMPLE_OK.map((r, i) => `<tr><td>${r.row}</td><td>${String(db.lastNo + i + 1).padStart(4, '0')}</td><td>${esc(r.name)}<span class="kana">${esc(r.kana)}</span></td><td>${r.birth.replace(/-/g, '/')}</td><td>${esc(gradeOf({ birth: r.birth }))}</td><td>${esc(classById(r.cls).name)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="actions"><button type="button" class="btn" data-excel="import">${SAMPLE_OK.length}人を取り込む</button><button type="button" class="btn sub" data-excel="">やめる</button></div>`;
  } else if (x === 'done') {
    res = `<p class="ok-box">${SAMPLE_OK.length}人を取り込みました。会員名簿で確かめてください。</p><a class="btn sub" href="#/members">会員名簿へ</a>`;
  }
  return shell(`
    <h1 class="a-h1">Excel取り込み・書き出し</h1>
    <p class="a-lead">導入のときや、まとめて入会があったときに使います。取り込みは「並べて確かめる → 間違いを赤で示す → 取り込む」の2段階で、いきなりは入れません。</p>
    <div class="a-grid">
      <section class="a-card">
        <h2>Excelから取り込む</h2>
        <p class="small">Clubena がお渡しするひな形（クラス・料金プラン・タグ・名簿）に書いたファイルを選びます。ファイルはこの端末の中で読みます。</p>
        ${x ? res : `<div class="actions"><button type="button" class="btn" data-excel="bad">見本のファイルで試す</button></div><p class="small">（デモ：実際はここでファイルを選びます）</p>`}
      </section>
      <section class="a-card">
        <h2>Excelに書き出す</h2>
        <p class="small">クラブの中での共有・保管・会計に使います。緊急連絡先は入れません。</p>
        <div class="actions" style="flex-direction:column;align-items:stretch">
          <button type="button" class="btn sub" data-export="roster">名簿を書き出す</button>
          ${on('attendance') ? '<button type="button" class="btn sub" data-export="attendance">11月の出欠を書き出す</button>' : ''}
          ${on('fees') ? '<button type="button" class="btn sub" data-export="fees">11月の月謝チェックリストを書き出す</button>' : ''}
        </div>
        <p class="small">（デモでは、Excelで開ける CSV で書き出します）</p>
      </section>
    </div>`, 'excel');
}
function download(name, rows) {
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  showToast(`${name} を書き出しました`);
}
function exportCsv(kind) {
  const ym = '2026-11';
  if (kind === 'roster') {
    download(`${db.club.name}_名簿_${TODAY}.csv`, [['会員番号', '姓', '名', 'せい', 'めい', '生年月日', '学年', '年齢', 'クラス', '級', '配慮'],
      ...activeMembers().map((m) => [memberNo(m), m.fam, m.given, m.fk, m.gk, m.birth, gradeOf(m), ageOf(m.birth), classById(m.classId)?.name, kyuOf(m), m.care ? 'あり' : ''])]);
  } else if (kind === 'attendance') {
    const rows = [['クラス', '日付', '会員番号', '名前', '出欠']];
    for (const s of db.sessions.filter((x) => monthOf(x.date) === ym && isHeld(x) && x.date <= TODAY)) {
      for (const { m, makeup } of rosterOf(s)) {
        const v = db.attendance[`${s.id}|${m.id}`];
        rows.push([classById(s.classId).name, s.date, memberNo(m), `${makeup ? '（振替）' : ''}${nameOf(m)}`, v === 'present' ? '○' : v === 'absent' ? '×' : absenceOf(s.id, m.id) ? '連' : '未']);
      }
    }
    download(`${db.club.name}_出欠_${ymLabel(ym)}.csv`, rows);
  } else {
    download(`${db.club.name}_月謝_${ymLabel(state.feeMonth)}.csv`, [['会員番号', '名前', '料金プラン', '基本額', '毎月の調整', '今月だけの調整', '請求額', '入金', '差額'],
      ...db.fees.filter((r) => r.month === state.feeMonth).map((r) => { const m = memberById(r.memberId); return [memberNo(m), nameOf(m), r.plan, r.base, r.radj, r.oadj, feeTotal(r), r.paid ? '済' : '未', r.diff || '']; })]);
  }
}

// =============================================================================
// 設定
// =============================================================================
function settingsView() {
  const t = state.settingsTab;
  const tabs = [['stages', '機能の段階'], ['classes', 'クラス'], ...(on('fees') ? [['plans', '料金プラン']] : []), ...(on('tags') ? [['tags', 'タグ']] : []),
    ...(on('makeup') ? [['makeup', '振替のルール']] : []), ['terms', '会員規約'], ['staff', '職員と担当']];
  let body = '';
  if (t === 'stages') {
    body = `<h2>機能の段階</h2>
      <p class="small">最初は使う画面を少なくして、慣れてから順に開きます（切り替えは Clubena がお手伝いします）。閉じている機能は、メニュー・ボタン・タブのどこにも出ません。保護者・コーチの画面でも確かめてください。</p>
      <div class="a-stages" role="radiogroup" aria-label="機能の段階">${[
        [1, '第1段階（運用開始〜2週間）', '予定・欠席連絡・出席記録・お知らせ'],
        [2, '第2段階（担当者が慣れてから）', '＋ 月謝・振替・級（タグ）'],
        [3, '第3段階', '＋ シフト・フィードバック・引き継ぎメモ'],
      ].map(([v, l, d]) => `<label class="a-stage"><input type="radio" name="stage" value="${v}" ${db.stage === v ? 'checked' : ''}><b>${l}</b><p>${d}</p></label>`).join('')}</div>`;
  } else if (t === 'classes') {
    body = `<h2>クラス</h2><div class="a-table-wrap"><table class="a-table"><thead><tr><th>クラス</th><th>対象学年</th><th>曜日・時間</th><th>ふだんの会場</th><th class="num">定員</th><th class="num">必要なコーチ</th><th class="num">在籍</th></tr></thead><tbody>
      ${db.classes.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(gradeOfN(c.gmin))}〜${esc(gradeOfN(c.gmax))}</td><td>${wdLabel(`2026-11-0${[1, 2, 3, 4, 5, 6, 7].find((d) => wdOf(`2026-11-0${d}`) === c.wd)}`)}曜 ${esc(c.start)}〜${esc(c.end)}</td><td>${esc(c.venue)}</td>
        <td class="num"><input type="number" min="1" max="99" value="${c.cap}" data-cap="${c.id}" aria-label="${esc(c.name)}の定員" style="width:64px;min-height:36px"></td><td class="num">${c.need}人</td><td class="num">${activeMembers().filter((m) => m.classId === c.id).length}人</td></tr>`).join('')}
      </tbody></table></div><p class="small">定員は振替の受け入れに使います（定員に達した日は、保護者の振替先に出ません）。</p>`;
  } else if (t === 'plans') {
    body = `<h2>料金プラン</h2><div class="a-table-wrap"><table class="a-table"><thead><tr><th>プラン</th><th>決め方</th><th class="num">金額</th><th class="num">使っている会員</th></tr></thead><tbody>
      ${db.plans.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${p.kind === 'fixed' ? '固定制（月額。毎月1日に自動で作る）' : '回数制（確定した回数 × 単価。「○月分を確定する」で計算）'}</td><td class="num">${yen(p.amount)}${p.kind === 'per_session' ? '／回' : '／月'}</td><td class="num">${activeMembers().filter((m) => m.planId === p.id).length}人</td></tr>`).join('')}
      </tbody></table></div><p class="small">兄弟割など毎月同じ調整は、会員ごとに一度だけ決めれば毎月自動で入ります。</p>`;
  } else if (t === 'tags') {
    body = `<h2>タグ（級・コースなど）</h2>
      <p class="note-box">タグの名前に、健康・医療に関する言葉は使わないでください。</p>
      ${db.tagGroups.map((g) => `<h3>${esc(g.name)}</h3><p class="small" style="margin:0 0 6px">${g.mode === 'single' ? '1つだけ選ぶ（付け替えると記録が残る）' : 'いくつでも選べる'}</p>
        <label class="check"><input type="checkbox" data-show-group="${g.id}" ${g.show ? 'checked' : ''}> 保護者に見せる</label>
        <p>${g.tags.map((x) => `<span class="tag" style="margin:0 4px 4px 0">${esc(x.name)}</span>`).join('')}</p>`).join('')}`;
  } else if (t === 'makeup') {
    const r = db.rules;
    const sel = (key, opts) => `<select data-rule="${key}" style="min-height:40px;padding:0 8px;border:1px solid var(--line);border-radius:8px">${opts.map(([v, l]) => `<option value="${v}" ${String(r[key]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    body = `<h2>振替のルール</h2><p class="small">変えると、保護者の振替先の選び方がすぐに変わります。</p>
      <table class="a-table"><tbody>
        <tr><th>有効期限</th><td>${sel('expiry', [['same_month', 'その月の中'], ['next_month_end', '翌月末まで'], ['days_60', '発生から60日']])}</td></tr>
        <tr><th>承認</th><td>${sel('approval', [['auto', '自動で確定'], ['manual', '事務担当が承認する']])}</td></tr>
        <tr><th>1か月に使える回数</th><td>${sel('monthlyLimit', [[1, '1回'], [2, '2回'], [3, '3回']])}</td></tr>
        <tr><th>欠席の締切</th><td>${sel('deadlineHours', [[1, '開始の1時間前'], [2, '開始の2時間前'], [24, '前の日の同じ時刻']])}</td></tr>
        <tr><th>回数制で中止が出たとき</th><td>${sel('perSessionCancel', [['reduce', '請求回数から1回減らす'], ['credit', '振替権にする']])}</td></tr>
      </tbody></table>`;
  } else if (t === 'terms') {
    const latest = termsLatest();
    body = `<h2>会員規約（いまは第${latest.v}版・${esc(latest.on.replace(/-/g, '/'))}）</h2>
      <div class="p-terms">${esc(latest.body)}</div>
      <div class="field" style="margin-top:12px"><label for="terms-new">改定する（直した本文）</label><textarea id="terms-new" style="min-height:140px">${esc(latest.body)}</textarea></div>
      <div class="actions"><button type="button" class="btn" data-publish-terms>第${latest.v + 1}版として公開する</button></div>
      <p class="small">公開すると、保護者は次に開いたとき、新しい規約に同意し直す画面が出ます。前の版と同意の記録は残ります。</p>`;
  } else if (t === 'staff') {
    body = `<h2>職員と担当クラス</h2><div class="a-table-wrap"><table class="a-table"><thead><tr><th>名前</th>${db.classes.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
      ${db.coaches.map((c) => `<tr><td><b>${esc(c.name)}</b>（コーチ）</td>${db.classes.map((k) => `<td>${c.assign[k.id] === 'edit' ? '編集' : c.assign[k.id] === 'view' ? '閲覧' : '—'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <p class="small">担当外のクラスの名簿・緊急連絡先は見えません。「閲覧」は名簿を見られますが、出欠は記録できません。</p>
      <div class="actions"><button type="button" class="btn sub" data-invite>コーチを招待する</button></div>
      ${state.invite ? `<div class="info-box" style="margin-top:10px">招待コード <b style="font-size:22px;letter-spacing:.1em">${state.invite}</b><br><span class="small">7日間有効・1回だけ使えます。コーチがLINEでアプリを開き、このコードを入れるとつながります。</span></div>` : ''}`;
  }
  return shell(`
    <h1 class="a-h1">設定</h1>
    <nav class="a-tabs" aria-label="設定の項目">${tabs.map(([k, l]) => `<a href="#/settings" data-settings-tab="${k}" ${t === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <section class="a-card">${body}</section>`, 'settings');
}
const gradeOfN = (n) => ({ [-2]: '年少', [-1]: '年中', 0: '年長' }[n] ?? (n <= 6 ? `小${n}` : `中${n - 6}`));

// =============================================================================
// 描く・操作
// =============================================================================
const root = document.getElementById('app');
function render() {
  const [r] = route();
  const views = { approvals: approvalsView, sessions: on('schedule') && sessionsView, shifts: on('shifts') && shiftsView, members: membersView,
    fees: on('fees') && feesView, notices: on('notices') && noticesView, excel: excelView, settings: settingsView };
  const html = (views[r] || homeView)();
  root.innerHTML = html + (modal ? `<div class="modal-back" id="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-h">${modal}</div></div>` : '');
}
function openModal(html, focusSel) { modal = html; render(); (document.querySelector(focusSel || '.modal input, .modal textarea, .modal select, .modal button'))?.focus(); }
function closeModal() { modal = null; render(); }

root.addEventListener('click', (e) => {
  if (e.target.id === 'modal-back') { closeModal(); return; }
  const el = e.target.closest('button, a[data-sess-month], a[data-shift-month], a[data-fee-month], a[data-settings-tab]');
  if (!el) return;
  const d = el.dataset;
  if (d.sessMonth) { e.preventDefault(); state.sessMonth = d.sessMonth; render(); return; }
  if (d.shiftMonth) { e.preventDefault(); state.shiftMonth = d.shiftMonth; render(); return; }
  if (d.feeMonth) { e.preventDefault(); state.feeMonth = d.feeMonth; state.noticeSent = null; render(); return; }
  if (d.settingsTab) { e.preventDefault(); state.settingsTab = d.settingsTab; render(); return; }
  if (el.id === 'modal-close') { closeModal(); return; }
  if (d.copy) { copyText(d.copy); return; }

  // 入会承認
  if (d.approve) {
    const m = memberById(d.approve);
    m.classId = document.querySelector(`[data-class-for="${m.id}"]`).value;
    m.planId = document.querySelector(`[data-plan-for="${m.id}"]`)?.value ?? (gradeNumber(m.birth) <= 0 ? 'p2' : 'p1');
    m.no = ++db.lastNo; m.status = 'active'; m.approved = TODAY;
    m.tags = ['k10'];
    state.approved = m.id;
    if (on('fees')) db.fees.push(feeRecord(db, m, monthOf(TODAY)));
    commit(`${nameOf(m)}さんを承認しました（会員番号 ${memberNo(m)}）`);
    document.getElementById('main')?.scrollTo?.(0, 0); scrollTo(0, 0);
    return;
  }
  if ('dismissApproved' in d) { state.approved = null; render(); return; }
  if (d.approveMakeup) { db.credits.find((c) => c.id === d.approveMakeup).status = 'reserved'; commit('振替を承認しました'); return; }

  // 開講情報
  if (d.lottery) { sessionById(d.lottery).lottery = d.v; commit(); return; }
  if ('saveExpected' in d) {
    const v = document.getElementById('expected').value || null;
    (db.months[state.sessMonth] ??= { confirmedAt: null }).expected = v;
    commit(v ? `確定の予定日を${md(v)}にしました。保護者の予定に「${md(v)}ごろ確定します」と出ます` : '確定の予定日を消しました');
    return;
  }
  if ('copyPattern' in d) {
    const ym = state.sessMonth;
    const prev = db.sessions.filter((s) => monthOf(s.date) === addMonths(ym, -1));
    const pats = new Map(prev.map((s) => [`${s.classId}|${wdOf(s.date)}`, s]));
    let n = 0;
    for (const [, s] of pats) {
      const c = classById(s.classId);
      for (const day of daysOf(ym).filter((x) => wdOf(x) === wdOf(s.date) && x > TODAY && !['2027-01-01', '2027-01-02', '2027-01-03'].includes(x))) {
        db.sessions.push({ id: `s-${c.id}-${day}`, classId: c.id, date: day, start: c.start, end: c.end, venue: c.venue, status: 'applying', lottery: 'pending', note: '' });
        n++;
      }
    }
    commit(`${n}回を仮登録しました（1/1〜1/3 は除いています）。抽選の結果が出たら「取れた」「取れなかった」を押してください`);
    return;
  }
  if ('confirmMonth' in d) {
    const ym = state.sessMonth;
    const app = db.sessions.filter((s) => monthOf(s.date) === ym && s.status === 'applying');
    const won = app.filter((s) => s.lottery === 'won').length;
    const lost = app.filter((s) => s.lottery === 'lost').length;
    openModal(`<h2 id="modal-h">${mLabel(ym)}分を確定しますか？</h2>
      <p>この1回の操作で、次のことがまとめて起きます。</p>
      <ul class="a-steps">
        <li>取れた ${won}回を、保護者の予定に公開する（取れなかった ${lost}回は出さない）</li>
        <li>保護者のホームに「${mLabel(ym)}の予定が確定しました」を出す</li>
        ${on('shifts') ? '<li>コーチのシフト希望の受付を始める</li>' : ''}
        ${on('fees') ? '<li>回数制の会員の請求額を計算する</li>' : ''}
        <li>クラブのLINEで流す一言の文例を出す</li>
      </ul>
      <p class="small">確定したあとは、その日を中止にするか会場を変えることだけができます。2回押しても、2回確定されることはありません。</p>
      <div class="actions"><button type="button" class="btn" id="do-confirm">${mLabel(ym)}分を確定する</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>`, '#do-confirm');
    return;
  }
  if (el.id === 'do-confirm') { modal = null; if (!db.months[state.sessMonth]?.confirmedAt) confirmMonth(state.sessMonth); return; }
  if (d.cancelSession || d.venueSession) {
    const s = sessionById(d.cancelSession || d.venueSession);
    const cancel = Boolean(d.cancelSession);
    openModal(`<h2 id="modal-h">${esc(jmdw(s.date))} ${esc(classById(s.classId).name)}を${cancel ? '中止にする' : '別の会場にする'}</h2>
      ${cancel ? '' : `<div class="field"><label for="ch-venue">新しい会場</label><input type="text" id="ch-venue" maxlength="40" value=""></div>`}
      <div class="field"><label for="ch-note">${cancel ? '中止の理由（保護者に出ます）' : '保護者へのひとこと'}</label><input type="text" id="ch-note" maxlength="100" value="${cancel ? '体育館の都合により中止です' : ''}"></div>
      <p class="small">${cancel ? `そのクラスの保護者のホームに知らせが出ます。${on('makeup') ? '固定制の子には振替できる回がつき、' : ''}${on('fees') ? '回数制の子は請求回数が1回減ります（入金済みなら差額を出します）。' : ''}その日の欠席連絡・振替の予約は消えます。` : 'そのクラスの保護者のホームに知らせが出ます。'}</p>
      <p class="err" id="ch-err" hidden></p>
      <div class="actions"><button type="button" class="btn ${cancel ? 'danger' : ''}" id="do-change" data-sid="${s.id}" data-cancel="${cancel ? 1 : 0}">${cancel ? '中止にする' : '会場を変える'}</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>`);
    return;
  }
  if (el.id === 'do-change') {
    const s = sessionById(d.sid);
    const note = document.getElementById('ch-note').value.trim();
    const venue = document.getElementById('ch-venue')?.value.trim();
    const err = document.getElementById('ch-err');
    if (!note || (d.cancel === '0' && !venue)) { err.hidden = false; err.textContent = d.cancel === '1' ? '理由を入れてください' : '新しい会場と、ひとことを入れてください'; return; }
    let line;
    if (d.cancel === '1') line = cancelSession(s, note);
    else {
      s.status = 'venue_changed'; s.venue = venue; s.note = note;
      db.notices.push({ id: newId('n'), kind: 'change', title: `${jmdw(s.date)} ${classById(s.classId).name}の会場が変わります`, body: `会場：${venue}\n${note}`, target: { type: 'class', id: s.classId }, sentAt: TODAY });
      line = lineText(`${jmdw(s.date)}の${classById(s.classId).name}は、会場が「${venue}」に変わります。アプリのお知らせをご確認ください。`);
    }
    modal = `<h2 id="modal-h">${d.cancel === '1' ? '中止にしました' : '会場を変えました'}</h2><p>そのクラスの保護者のホームに知らせを出しました。</p>${lineBlock(line)}<div class="actions"><button type="button" class="btn" id="modal-close">閉じる</button></div>`;
    commit();
    return;
  }

  // シフト
  if (d.assign) {
    const a = db.shifts.assign[d.assign] ??= [];
    const i = a.indexOf(d.coach);
    if (i >= 0) a.splice(i, 1); else a.push(d.coach);
    commit();
    return;
  }
  if (d.confirmShift) { db.shifts.confirmed[d.confirmShift] = true; commit(`${mLabel(d.confirmShift)}のシフトを確定しました。コーチのホームに出ます`); return; }

  // 名簿
  if (d.detail) { openModal(memberDetail(d.detail, false), '#modal-close'); return; }
  if (d.showEc) {
    db.ecLog.push({ at: `${TODAY} ${NOW_TIME}`, by: `${ADMIN}（事務）`, memberId: d.showEc });
    modal = memberDetail(d.showEc, true);
    commit();
    return;
  }
  if ('bulkKyu' in d) {
    const g = db.tagGroups.find((x) => x.id === 'g1');
    openModal(`<h2 id="modal-h">選んだ${state.picked.size}人の級を変える</h2>
      <div class="field"><label for="kyu-to">新しい級</label><select id="kyu-to">${g.tags.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn" id="kyu-save">変える</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>`);
    return;
  }
  if (el.id === 'kyu-save') {
    const to = document.getElementById('kyu-to').value;
    for (const id of state.picked) {
      const m = memberById(id);
      const from = m.tags.find((t) => tagById(t)?.group.id === 'g1');
      if (from === to) continue;
      m.tags = [...m.tags.filter((t) => t !== from), to];
      db.tagHistory.push({ memberId: id, groupId: 'g1', from, to, at: TODAY, by: `${ADMIN}（事務）` });
    }
    const n = state.picked.size;
    state.picked = new Set(); modal = null;
    commit(`${n}人の級を「${tagById(to).name}」にしました。記録が残り、保護者の「成長の記録」に出ます`);
    return;
  }
  if ('bulkNotice' in d) {
    state.notice = { type: 'member', ids: [...state.picked], title: '', body: '' };
    state.noticeSent = null;
    location.hash = '#/notices';
    return;
  }

  // 月謝
  if (d.oadj) {
    const r = db.fees.find((x) => x.id === d.oadj);
    openModal(`<h2 id="modal-h">今月だけの調整（${esc(nameOf(memberById(r.memberId)))}・${mLabel(r.month)}）</h2>
      <div class="field"><label for="oadj-amt">金額（引くときはマイナス。例：-1000）</label><input type="number" id="oadj-amt" step="100" value="${r.oadj || ''}"></div>
      <div class="field"><label for="oadj-note">理由（必ず入れます）</label><input type="text" id="oadj-note" maxlength="30" value="${esc(r.oadjNote)}" placeholder="例：入会金・日割・合宿費"></div>
      <p class="err" id="oadj-err" hidden></p>
      <div class="actions"><button type="button" class="btn" id="oadj-save" data-fee="${r.id}">保存する</button><button type="button" class="btn sub" id="modal-close">やめる</button></div>`);
    return;
  }
  if (el.id === 'oadj-save') {
    const r = db.fees.find((x) => x.id === d.fee);
    const amt = Number(document.getElementById('oadj-amt').value || 0);
    const note = document.getElementById('oadj-note').value.trim();
    const err = document.getElementById('oadj-err');
    if (amt && !note) { err.hidden = false; err.textContent = '理由を入れてください（理由がないと保存できません）'; document.getElementById('oadj-note').setAttribute('aria-invalid', 'true'); return; }
    if (r.base + r.radj + amt < 0) { err.hidden = false; err.textContent = '請求額がマイナスになります'; return; }
    r.oadj = amt; r.oadjNote = amt ? note : '';
    modal = null;
    commit('今月だけの調整を保存しました');
    return;
  }
  if (d.diff) {
    const r = db.fees.find((x) => x.id === d.diff);
    openModal(`<h2 id="modal-h">差額 ${signedYen(r.diff)}（${esc(nameOf(memberById(r.memberId)))}）</h2><p>${esc(r.diffNote)}。入金済みのあとで中止になったため、金額は変えずに差額を出しています。</p>
      <div class="actions"><button type="button" class="btn" id="diff-next" data-fee="${r.id}">次の月で調整する</button><button type="button" class="btn sub" id="diff-refund" data-fee="${r.id}">返金した</button><button type="button" class="btn sub" id="modal-close">あとで</button></div>`);
    return;
  }
  if (el.id === 'diff-next' || el.id === 'diff-refund') {
    const r = db.fees.find((x) => x.id === d.fee);
    r.diffDone = el.id === 'diff-next' ? `次の月で調整（${signedYen(r.diff)}）` : `返金済み（${signedYen(r.diff)}）`;
    modal = null;
    commit('差額の扱いを記録しました');
    return;
  }
  if (d.remind) {
    const ids = unpaid(d.remind).map((r) => r.memberId);
    const title = `${mLabel(d.remind)}分の月謝のご確認のお願い`;
    db.notices.push({ id: newId('n'), kind: 'notice', title, body: `${mLabel(d.remind)}分の月謝の入金が、まだ確認できていません。アプリの「月謝」で金額をご確認のうえ、お手続きをお願いします。行き違いの場合はご容赦ください。`, target: { type: 'member', ids }, sentAt: TODAY });
    state.noticeSent = { from: 'fees', line: lineText(`アプリに「${title}」のお知らせを載せました。該当の方はご確認ください。`) };
    commit(`未入金の${ids.length}人の保護者にだけ、お知らせを送りました`);
    return;
  }
  if (d.export) { exportCsv(d.export); return; }

  // お知らせ
  if ('newNotice' in d) { state.noticeSent = null; state.notice = { type: 'all', id: '', title: '', body: '' }; render(); return; }

  // Excel
  if (d.excel !== undefined) {
    if (d.excel === 'import') {
      SAMPLE_OK.forEach((r) => {
        const [fam, given] = r.name.split(' ');
        const [fk, gk] = r.kana.split(' ');
        db.members.push({ id: newId('m'), no: ++db.lastNo, status: 'active', fam, given, fk, gk, birth: r.birth, classId: r.cls, planId: 'p1', adj: 0, adjNote: '', family: newId('f'), tags: ['k10'], care: false, line: false,
          consent: { v: termsLatest().v, how: '紙' }, applied: TODAY, approved: TODAY, ec: [{ name: `${fam} 太郎`, rel: '父', phone: '090-0000-0000' }] });
      });
      state.excel = 'done';
      commit(`${SAMPLE_OK.length}人を取り込みました`);
      return;
    }
    state.excel = d.excel || null;
    render();
    return;
  }

  // 設定
  if ('publishTerms' in d) {
    const body = document.getElementById('terms-new').value.trim();
    if (!body || body === termsLatest().body) { showToast('本文が前の版と同じです。直してから公開してください'); return; }
    db.terms.push({ v: termsLatest().v + 1, on: TODAY, body });
    commit(`会員規約を第${termsLatest().v}版にしました。保護者は次に開いたとき、同意し直す画面が出ます`);
    return;
  }
  if ('invite' in d) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    state.invite = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    render();
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.pick) { if (t.checked) state.picked.add(t.dataset.pick); else state.picked.delete(t.dataset.pick); render(); return; }
  if (t.id === 'r-all') {
    const rows = [...root.querySelectorAll('[data-pick]')].map((x) => x.dataset.pick);
    rows.forEach((id) => (t.checked ? state.picked.add(id) : state.picked.delete(id)));
    render(); return;
  }
  if (t.id === 'r-class') { state.rosterClass = t.value; render(); return; }
  if (t.id === 'r-status') { state.rosterStatus = t.value; render(); return; }
  if (t.dataset.paid) { const r = db.fees.find((x) => x.id === t.dataset.paid); r.paid = t.checked; commit(); return; }
  if (t.id === 'unpaid-only') { state.feeUnpaidOnly = t.checked; render(); return; }
  if (t.name === 'n-type') { state.notice = { ...state.notice, type: t.value, id: '', ids: null }; render(); return; }
  if (t.name === 'stage') { db.stage = Number(t.value); commit(`第${db.stage}段階にしました。メニューの項目が変わります`); return; }
  if (t.dataset.rule) { db.rules[t.dataset.rule] = /^\d+$/.test(t.value) ? Number(t.value) : t.value; commit('振替のルールを変えました'); return; }
  if (t.dataset.showGroup) { db.tagGroups.find((g) => g.id === t.dataset.showGroup).show = t.checked; commit(); return; }
  if (t.dataset.cap) { const n = Number(t.value); if (n >= 1 && n <= 99) { classById(t.dataset.cap).cap = n; commit('定員を変えました'); } }
});
root.addEventListener('input', (e) => {
  if (e.target.id === 'r-q') {
    state.rosterQ = e.target.value.trim();
    const pos = e.target.selectionStart;
    render();
    const q = document.getElementById('r-q'); q.focus(); q.setSelectionRange(pos, pos);
  }
});
root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id !== 'notice-form') return;
  const n = state.notice;
  n.title = document.getElementById('n-title').value.trim();
  n.body = document.getElementById('n-body').value.trim();
  if (n.type !== 'all' && !n.ids) n.id = document.getElementById('n-id')?.value ?? '';
  n.err = {};
  if (!n.title) n.err.title = '題名を入れてください';
  if (!n.body) n.err.body = '本文を入れてください';
  if (Object.keys(n.err).length) { render(); return; }
  const target = n.type === 'all' ? { type: 'all' } : n.type === 'member' ? { type: 'member', ids: n.ids ?? [n.id] } : { type: n.type, id: n.id };
  const rec = { id: newId('n'), kind: 'notice', title: n.title, body: n.body, target, sentAt: TODAY };
  db.notices.push(rec);
  state.noticeSent = { from: 'notices', families: noticeFamilies(rec).size, line: lineText(`アプリに「${n.title}」のお知らせを載せました。ご確認ください。`) };
  state.notice = { type: 'all', id: '', title: '', body: '' };
  state.picked = new Set();
  commit('お知らせを送りました');
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal) closeModal(); });
addEventListener('hashchange', () => { modal = null; state.approved = null; state.excel = state.excel === 'done' ? null : state.excel; if (route()[0] !== 'notices') state.noticeSent = state.noticeSent?.from === 'fees' && route()[0] === 'fees' ? state.noticeSent : null; render(); scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); });
onChange(render);

document.getElementById('bar').innerHTML = demoBar('admin');
bindDemoBar();
render();
