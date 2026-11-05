// =============================================================================
// Clubena デモ：共通の部品（架空のデータ・保存・日付と学年・小さな画面部品）
//
// このデモは、本物のデータベースやLINEにはつながない。
// データはこのファイルの seed() で作り、ブラウザの中（localStorage）にだけ保存する。
// 保護者・コーチ・事務担当の3つの画面は同じデータを読むので、
// 事務担当が「12月分を確定する」を押すと、保護者の予定にも12月が出る。
// 「データを最初に戻す」で、いつでも最初の状態に戻せる。
//
// デモの「今日」は 2026年11月5日（木）12:00 に決めてある（いつ開いても同じ動きをするように）。
// =============================================================================

export const TODAY = '2026-11-05';
export const NOW_TIME = '12:00';
const KEY = 'clubena-demo-v2';   // データの形を変えたら番号を上げる（前のデータは読まない）

// --- 日付の道具（'YYYY-MM-DD' の文字列で扱う）-------------------------------------
const WD = '日月火水木金土';
const pad = (n) => String(n).padStart(2, '0');
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
export const wdOf = (d) => utc(d).getUTCDay();
export const wdLabel = (d) => WD[wdOf(d)];
export const addDays = (d, n) => { const t = utc(d); t.setUTCDate(t.getUTCDate() + n); return iso(t); };
export const monthOf = (d) => d.slice(0, 7);
export const addMonths = (ym, n) => { const t = utc(`${ym}-01`); t.setUTCMonth(t.getUTCMonth() + n); return iso(t).slice(0, 7); };
export const monthEnd = (ym) => addDays(`${addMonths(ym, 1)}-01`, -1);
export const daysOf = (ym) => { const out = []; for (let d = `${ym}-01`; monthOf(d) === ym; d = addDays(d, 1)) out.push(d); return out; };
export const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const mdw = (d) => `${md(d)}(${wdLabel(d)})`;
export const jmd = (d) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
export const jmdw = (d) => `${jmd(d)}（${wdLabel(d)}）`;
export const ymLabel = (ym) => `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月`;
export const mLabel = (ym) => `${Number(ym.slice(5, 7))}月`;
export const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;
export const signedYen = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`;

// 学年（4月2日〜翌年4月1日生まれが同じ学年。保存せず毎回計算する）
export function gradeNumber(birth, on = TODAY) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [oy, om] = on.split('-').map(Number);
  const enroll = (bm < 4 || (bm === 4 && bd === 1)) ? by + 6 : by + 7;
  const fy = om >= 4 ? oy : oy - 1;
  return fy - enroll + 1;
}
export function gradeLabel(n) {
  if (n >= 13) return '一般';
  if (n >= 10) return `高${n - 9}`;
  if (n >= 7) return `中${n - 6}`;
  if (n >= 1) return `小${n}`;
  return { 0: '年長', [-1]: '年中', [-2]: '年少' }[n] ?? '未就学';
}
export const gradeOf = (m) => gradeLabel(gradeNumber(m.birth));
export function ageOf(birth, on = TODAY) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [oy, om, od] = on.split('-').map(Number);
  return oy - by - ((om < bm || (om === bm && od < bd)) ? 1 : 0);
}

// 文字を HTML に入れるとき
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- 機能の段階----------------------------------------------------------
export const STAGES = {
  1: ['schedule', 'absence', 'attendance', 'notices'],
  2: ['schedule', 'absence', 'attendance', 'notices', 'fees', 'makeup', 'tags'],
  3: ['schedule', 'absence', 'attendance', 'notices', 'fees', 'makeup', 'tags', 'shifts', 'feedback'],
};
export const on = (feature) => STAGES[db.stage].includes(feature);

// =============================================================================
// 架空のデータ
// =============================================================================
const CLASSES = [
  { id: 'c1', name: '幼児クラス（火）', gmin: -2, gmax: 0, wd: 2, start: '15:30', end: '16:15', venue: '中央体育館 小体育室', cap: 10, need: 1 },
  { id: 'c4', name: '幼児クラス（金）', gmin: -2, gmax: 0, wd: 5, start: '15:30', end: '16:15', venue: '中央体育館 小体育室', cap: 10, need: 1 },
  { id: 'c2', name: '小学生クラスA', gmin: 1, gmax: 3, wd: 4, start: '17:00', end: '18:00', venue: '西体育館 サブアリーナ', cap: 12, need: 2 },
  { id: 'c3', name: '小学生クラスB', gmin: 4, gmax: 6, wd: 6, start: '10:00', end: '11:30', venue: '西体育館 メインアリーナ', cap: 7, need: 2 },
];
// 振替先にできるクラス（クラブが決める「振替先にできるクラス」）
export const MAKEUP_TO = { c1: ['c4'], c4: ['c1'], c2: ['c3'], c3: ['c2'] };

const PLANS = [
  { id: 'p1', name: '月4回コース', kind: 'fixed', amount: 8000 },
  { id: 'p2', name: '幼児コース', kind: 'fixed', amount: 6000 },
  { id: 'p3', name: '回数制', kind: 'per_session', amount: 1500 },
];

const KYU = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級'];
const TAG_GROUPS = [
  { id: 'g1', name: '級', mode: 'single', show: true, tags: KYU.map((n, i) => ({ id: `k${10 - i}`, name: n })) },
  { id: 'g2', name: 'コース', mode: 'multi', show: false, tags: [{ id: 'x1', name: '選手コース' }, { id: 'x2', name: '大会に出る' }] },
];

// 子（家庭 f…）。電話番号はすべて架空
const KIDS = [
  // 上野家（デモの保護者）
  ['m1', 1, '上野', 'はると', 'うえの', 'はると', '2017-06-12', 'c2', 'p1', 'k7', 'f1', -500, '兄弟割'],
  ['m2', 2, '上野', 'ゆい', 'うえの', 'ゆい', '2020-09-01', 'c1', 'p2', 'k10', 'f1', 0, ''],
  ['m3', 3, '青木', 'そうた', 'あおき', 'そうた', '2018-05-20', 'c2', 'p1', 'k8', 'f2'],
  ['m4', 4, '伊藤', 'みお', 'いとう', 'みお', '2019-01-15', 'c2', 'p1', 'k9', 'f3'],
  ['m5', 5, '加藤', 'れん', 'かとう', 'れん', '2017-11-03', 'c2', 'p1', 'k7', 'f4'],
  ['m6', 6, '佐々木', 'ひなた', 'ささき', 'ひなた', '2019-07-22', 'c2', 'p3', 'k10', 'f5'],
  ['m7', 7, '中村', 'こはる', 'なかむら', 'こはる', '2018-10-10', 'c2', 'p1', 'k8', 'f6'],
  ['m8', 8, '松本', 'ゆうと', 'まつもと', 'ゆうと', '2017-04-30', 'c2', 'p1', 'k6', 'f7'],
  ['m9', 9, '山口', 'あかり', 'やまぐち', 'あかり', '2018-12-01', 'c2', 'p3', 'k9', 'f8'],
  ['m10', 10, '林', 'だいち', 'はやし', 'だいち', '2015-08-08', 'c3', 'p1', 'k4', 'f9'],
  ['m11', 11, '清水', 'さくら', 'しみず', 'さくら', '2016-02-14', 'c3', 'p1', 'k3', 'f10'],
  ['m12', 12, '森', 'りく', 'もり', 'りく', '2014-06-01', 'c3', 'p1', 'k2', 'f11'],
  ['m13', 13, '池田', 'ほのか', 'いけだ', 'ほのか', '2016-09-09', 'c3', 'p3', 'k5', 'f12'],
  ['m14', 14, '橋本', 'けいた', 'はしもと', 'けいた', '2015-12-24', 'c3', 'p1', 'k4', 'f13'],
  ['m15', 15, '石井', 'まな', 'いしい', 'まな', '2014-11-11', 'c3', 'p1', 'k3', 'f14'],
  ['m16', 16, '小林', 'あおい', 'こばやし', 'あおい', '2021-05-05', 'c1', 'p2', 'k10', 'f15'],
  ['m17', 17, '斎藤', 'ゆな', 'さいとう', 'ゆな', '2020-07-07', 'c1', 'p2', 'k10', 'f16'],
  ['m18', 18, '吉田', 'そら', 'よしだ', 'そら', '2022-01-20', 'c4', 'p2', 'k10', 'f17'],
  ['m19', 19, '山本', 'こうき', 'やまもと', 'こうき', '2021-10-10', 'c4', 'p2', 'k10', 'f18'],
  ['m20', 20, '藤田', 'めい', 'ふじた', 'めい', '2020-12-03', 'c4', 'p3', 'k10', 'f19'],
];
const PARENT_NAMES = { f1: '上野 美咲', f2: '青木 由紀', f3: '伊藤 恵', f4: '加藤 真理', f5: '佐々木 綾', f6: '中村 沙織', f7: '松本 友美', f8: '山口 智子', f9: '林 大輔', f10: '清水 舞', f11: '森 健一', f12: '池田 麻衣', f13: '橋本 直子', f14: '石井 香', f15: '小林 愛', f16: '斎藤 陽子', f17: '吉田 千尋', f18: '山本 聡', f19: '藤田 美穂' };

function sessionsFor(ym, cls) {
  return daysOf(ym).filter((d) => wdOf(d) === cls.wd)
    .map((d) => ({ id: `s-${cls.id}-${d}`, classId: cls.id, date: d, start: cls.start, end: cls.end, venue: cls.venue, status: 'confirmed', lottery: 'won', note: '' }));
}

export function seed() {
  const members = KIDS.map(([id, no, fam, given, fk, gk, birth, classId, planId, kyu, family, adj = 0, adjNote = '']) => ({
    id, no, status: 'active', fam, given, fk, gk, birth, classId, planId, adj, adjNote, family,
    tags: [kyu, ...(id === 'm10' || id === 'm12' ? ['x1'] : []), ...(id === 'm12' ? ['x2'] : [])],
    care: id === 'm10',
    line: !['m13', 'm20'].includes(id),
    consent: { v: id === 'm13' || id === 'm20' ? 2 : 2, how: id === 'm13' || id === 'm20' ? '紙' : 'アプリ' },
    applied: '2025-04-01', approved: '2025-04-03',
    ec: [{ name: PARENT_NAMES[family], rel: family === 'f9' || family === 'f11' || family === 'f18' ? '父' : '母', phone: `090-0000-${pad(no)}${pad(no + 10)}` },
      ...(id === 'm1' ? [{ name: '上野 健太', rel: '父', phone: '080-0000-0101' }] : [])],
  }));
  // 入会の申込（承認待ち）
  members.push(
    { id: 'm21', no: null, status: 'pending', fam: '加藤', given: 'ひな', fk: 'かとう', gk: 'ひな', birth: '2020-06-01', classId: null, planId: null, adj: 0, adjNote: '', family: 'f20', tags: [], care: false, line: true, consent: { v: 2, how: 'アプリ' }, applied: '2026-11-03', approved: null, ec: [{ name: '加藤 さやか', rel: '母', phone: '090-0000-0021' }] },
    { id: 'm22', no: null, status: 'pending', fam: '森', given: 'たける', fk: 'もり', gk: 'たける', birth: '2019-08-19', classId: null, planId: null, adj: 0, adjNote: '', family: 'f21', tags: [], care: true, line: true, consent: { v: 2, how: 'アプリ' }, applied: '2026-11-04', approved: null, ec: [{ name: '森 由美', rel: '母', phone: '090-0000-0022' }, { name: '森 隆', rel: '父', phone: '080-0000-0022' }] },
  );

  // 開講日：10月・11月は確定済み、12月は抽選の結果を入れているところ
  const sessions = [];
  for (const c of CLASSES) {
    sessions.push(...sessionsFor('2026-10', c), ...sessionsFor('2026-11', c));
    sessions.push(...sessionsFor('2026-12', c).filter((s) => s.date <= '2026-12-26')
      .map((s) => ({ ...s, status: 'applying', lottery: 'won' })));
  }
  const S = (cid, d) => sessions.find((s) => s.classId === cid && s.date === d);
  Object.assign(S('c2', '2026-11-19'), { status: 'cancelled', note: '体育館の設備点検のため中止です' });
  Object.assign(S('c3', '2026-11-21'), { status: 'venue_changed', venue: '東体育館 第1競技場', note: '東体育館 第1競技場に変わりました' });
  S('c3', '2026-12-26').lottery = 'lost';
  S('c1', '2026-12-22').lottery = 'pending';
  S('c2', '2026-12-24').lottery = 'pending';

  // 出欠：終わった回はほぼ記録済み。11/3（幼児・火）と 10/29（小学生A）は記録が抜けている
  const attendance = {};
  const absentSeed = new Set(['s-c2-2026-10-15|m3', 's-c3-2026-10-24|m14', 's-c2-2026-10-22|m1', 's-c1-2026-10-27|m16', 's-c3-2026-10-31|m12']);
  for (const s of sessions) {
    if (s.date >= TODAY || s.status === 'cancelled' || s.status === 'applying') continue;
    if (['s-c1-2026-11-03', 's-c2-2026-10-29'].includes(s.id)) continue;
    for (const m of members.filter((x) => x.classId === s.classId && x.status === 'active')) {
      const k = `${s.id}|${m.id}`;
      attendance[k] = absentSeed.has(k) ? 'absent' : 'present';
    }
  }

  // 欠席の連絡・振替
  const absences = [
    { id: 'a1', sessionId: 's-c2-2026-10-22', memberId: 'm1', reason: '学校行事', note: '運動会の振替休日の行事', inDeadline: true, at: '2026-10-20' },
    { id: 'a2', sessionId: 's-c2-2026-11-12', memberId: 'm4', reason: '家庭の都合', note: '', inDeadline: true, at: '2026-11-04' },
    { id: 'a3', sessionId: 's-c3-2026-11-07', memberId: 'm11', reason: '体調', note: '', inDeadline: true, at: '2026-11-06' },
  ];
  const credits = [
    // はると：10/22 の欠席（締切内）→ 振替権。もう1つは 11/19 の中止（固定制）→ 振替権
    { id: 'cr1', memberId: 'm1', origin: 'absence', originSessionId: 's-c2-2026-10-22', expires: '2026-11-30', status: 'available', reservedSessionId: null },
    { id: 'cr2', memberId: 'm1', origin: 'cancellation', originSessionId: 's-c2-2026-11-19', expires: '2026-12-31', status: 'available', reservedSessionId: null },
    // 清水さくら（小学生B）は、今日の小学生Aに振替で来る
    { id: 'cr3', memberId: 'm11', origin: 'absence', originSessionId: 's-c3-2026-11-07', expires: '2026-12-31', status: 'reserved', reservedSessionId: 's-c2-2026-11-05' },
    // 松本ゆうと（小学生A）は 11/14 の小学生Bに振替で行く → 11/14 は定員いっぱい
    { id: 'cr4', memberId: 'm8', origin: 'cancellation', originSessionId: 's-c2-2026-11-19', expires: '2026-12-31', status: 'reserved', reservedSessionId: 's-c3-2026-11-14' },
  ];
  // 11/19 の中止で、ほかの固定制の子にも振替権
  for (const m of members.filter((x) => x.classId === 'c2' && x.status === 'active' && x.planId !== 'p3' && !['m1', 'm8'].includes(x.id))) {
    credits.push({ id: `cr-${m.id}`, memberId: m.id, origin: 'cancellation', originSessionId: 's-c2-2026-11-19', expires: '2026-12-31', status: 'available', reservedSessionId: null });
  }

  const db0 = {
    v: 2, stage: 3,
    club: { name: 'サンプル体操クラブ', slug: 'sample' },
    rules: { expiry: 'next_month_end', approval: 'auto', monthlyLimit: 2, deadlineHours: 2, perSessionCancel: 'reduce' },
    terms: [
      { v: 1, on: '2025-04-01', body: '第1条（目的）\nこの規約は、サンプル体操クラブ（以下「クラブ」）の会員が守ることを定めます。\n\n第2条（月謝）\n月謝は毎月末日までにお支払いください。' },
      { v: 2, on: '2026-10-01', body: '第1条（目的）\nこの規約は、サンプル体操クラブ（以下「クラブ」）の会員が守ることを定めます。\n\n第2条（月謝）\n月謝は毎月末日までにお支払いください。\n\n第3条（振替）\n締切までに欠席の連絡をした回は、翌月末までに振替ができます。' },
    ],
    classes: CLASSES.map((c) => ({ ...c })),
    plans: PLANS.map((p) => ({ ...p })),
    tagGroups: JSON.parse(JSON.stringify(TAG_GROUPS)),
    members, sessions, attendance, absences, credits,
    months: {
      '2026-10': { confirmedAt: '2026-09-24', expected: null },
      '2026-11': { confirmedAt: '2026-10-22', expected: null },
      '2026-12': { confirmedAt: null, expected: '2026-11-20' },
    },
    fees: [],
    notices: [
      { id: 'n1', kind: 'notice', title: '年末年始の練習について', body: '12月27日（日）から1月5日（火）まで、練習はお休みです。1月は6日（水）から始まります。', target: { type: 'all' }, sentAt: '2026-11-02' },
      { id: 'n2', kind: 'change', title: '11月19日（木）小学生クラスAは中止です', body: '体育館の設備点検のため、11月19日（木）の小学生クラスAは中止です。月4回コースの方には振替ができる権利がつきます。回数制の方は、11月の請求回数から1回減ります。', target: { type: 'class', id: 'c2' }, sentAt: '2026-11-01' },
      { id: 'n3', kind: 'notice', title: '12月の予定は11月20日ごろ確定します', body: '体育館の抽選の結果が出しだい、12月の練習日をお知らせします。', target: { type: 'all' }, sentAt: '2026-10-30' },
    ],
    reads: { n3: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f9', 'f10', 'f11', 'f14', 'f15', 'f16', 'f17'], n2: ['f2', 'f3', 'f5', 'f6', 'f7'], n1: ['f2', 'f9', 'f11', 'f16'] },
    feedbacks: [
      { id: 'fb1', memberId: 'm1', month: '2026-10', items: { 意欲: 'とてもよい', 基本の姿勢: 'よい', 前回からの伸び: 'とてもよい' }, skill: '後方倒立回転', text: '後方倒立回転が補助なしでできるようになりました。次は着地をそろえることを目標にします。', published: true, by: '佐藤 ゆか' },
      { id: 'fb2', memberId: 'm3', month: '2026-10', items: { 意欲: 'よい', 基本の姿勢: 'よい', 前回からの伸び: 'よい' }, skill: '側方倒立回転', text: '腕の支えが安定してきました。', published: false, by: '佐藤 ゆか' },
    ],
    handovers: [
      { id: 'h1', classId: 'c2', memberId: null, text: '跳び箱は4段から。踏切板の位置は手前の線に合わせてください。', by: '佐藤 ゆか', at: '2026-10-29' },
      { id: 'h2', classId: 'c2', memberId: 'm5', text: '鉄棒の逆上がりを練習中。補助ベルトを使うと本人がやる気になります。', by: '高橋 けんじ', at: '2026-10-15' },
    ],
    tagHistory: [
      { memberId: 'm1', groupId: 'g1', from: 'k9', to: 'k8', at: '2026-06-20', by: '佐藤 ゆか' },
      { memberId: 'm1', groupId: 'g1', from: 'k8', to: 'k7', at: '2026-10-17', by: '佐藤 ゆか' },
      { memberId: 'm5', groupId: 'g1', from: 'k8', to: 'k7', at: '2026-10-17', by: '佐藤 ゆか' },
    ],
    coaches: [
      { id: 'u1', name: '佐藤 ゆか', assign: { c1: 'edit', c4: 'edit', c2: 'edit' } },
      { id: 'u2', name: '高橋 けんじ', assign: { c3: 'edit', c2: 'view' } },
      { id: 'u3', name: '田中 みずき', assign: { c3: 'edit', c2: 'edit' } },
    ],
    shifts: { wishes: {}, assign: {}, confirmed: { '2026-10': true, '2026-11': true } },
    ecLog: [{ at: '2026-10-29 17:40', by: '佐藤 ゆか', memberId: 'm5' }],
    lastNo: 20,
    toast: null,
  };
  // 11月のシフト（確定済み）
  for (const s of sessions.filter((x) => x.date.startsWith('2026-11') && x.status !== 'cancelled')) {
    db0.shifts.assign[s.id] = s.classId === 'c3' ? ['u2', 'u3'] : s.classId === 'c2' ? ['u1', 'u3'] : ['u1'];
  }
  // 月謝：10月はすべて入金済み、11月は一部が未入金
  const unpaid = new Set(['m2', 'm5', 'm9', 'm13', 'm19']);
  for (const ym of ['2026-10', '2026-11']) {
    for (const m of members.filter((x) => x.status === 'active')) db0.fees.push(feeRecord(db0, m, ym, ym === '2026-10' || !unpaid.has(m.id)));
  }
  // 佐々木ひなた（回数制）は 11/19 の中止の前に4回分を入金していた → 金額は変えず、差額を出す
  const r6 = db0.fees.find((r) => r.memberId === 'm6' && r.month === '2026-11');
  r6.paid = true; r6.count += 1; r6.base += 1500; r6.diff = -1500; r6.diffNote = '11/19 中止の分';
  return db0;
}

// その月の請求の1行（算出した時点の金額・プラン名を保存する）
export function feeRecord(d, m, ym, paid = false) {
  const plan = d.plans.find((p) => p.id === m.planId);
  const count = plan.kind === 'per_session'
    ? d.sessions.filter((s) => s.classId === m.classId && monthOf(s.date) === ym && ['confirmed', 'venue_changed'].includes(s.status)).length
    : null;
  const base = plan.kind === 'per_session' ? plan.amount * count : plan.amount;
  return { id: `fee-${m.id}-${ym}`, memberId: m.id, month: ym, plan: plan.name, kind: plan.kind, unit: plan.amount, count, base,
    radj: m.adj, radjNote: m.adjNote, oadj: 0, oadjNote: '', paid, diff: 0, diffNote: '' };
}
export const feeTotal = (r) => r.base + r.radj + r.oadj;

// =============================================================================
// 保存と読み込み（localStorage が使えないときは、このページの中だけで動く）
// =============================================================================
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d?.v === 2) return d; }
  } catch { /* 使えなければ最初のデータ */ }
  return seed();
}
export let db = read();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

// データを変えたら呼ぶ。保存して、画面を描き直す
export function commit(toast) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 保存できなくても続ける */ }
  if (toast) showToast(toast);
  for (const fn of listeners) fn();
}
export function resetDemo() {
  db = seed();
  commit('デモのデータを最初の状態に戻しました');
}
// ほかのタブ（保護者・コーチ・事務担当）で変えたら、こちらも読み直す
addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  db = read();
  for (const fn of listeners) fn();
});

let uid = Date.now() % 100000;
export const newId = (p) => `${p}${++uid}`;

// =============================================================================
// データから読むための道具
// =============================================================================
export const classById = (id) => db.classes.find((c) => c.id === id);
export const memberById = (id) => db.members.find((m) => m.id === id);
export const sessionById = (id) => db.sessions.find((s) => s.id === id);
export const planById = (id) => db.plans.find((p) => p.id === id);
export const nameOf = (m) => `${m.fam} ${m.given}`;
export const memberNo = (m) => (m.no ? String(m.no).padStart(4, '0') : '—');
export const activeMembers = () => db.members.filter((m) => m.status === 'active');
export const isHeld = (s) => ['confirmed', 'venue_changed'].includes(s.status);
export const isPublic = (s) => s.status !== 'applying';          // 保護者に見える回
export const tagById = (id) => { for (const g of db.tagGroups) { const t = g.tags.find((x) => x.id === id); if (t) return { ...t, group: g }; } return null; };
export const kyuOf = (m) => m.tags.map(tagById).find((t) => t?.group.id === 'g1')?.name ?? '—';
export const termsLatest = () => db.terms[db.terms.length - 1];
export const familyKids = (fid) => db.members.filter((m) => m.family === fid && m.status === 'active');

// その回に来る子：クラスの子（その日に在籍）＋振替で来る子
export function rosterOf(s) {
  const kids = activeMembers().filter((m) => m.classId === s.classId).map((m) => ({ m, makeup: false }));
  const visitors = db.credits.filter((c) => c.reservedSessionId === s.id && c.status === 'reserved')
    .map((c) => ({ m: memberById(c.memberId), makeup: true }));
  return [...kids, ...visitors];
}
export const absenceOf = (sid, mid) => db.absences.find((a) => a.sessionId === sid && a.memberId === mid && !a.cancelled);

// その回の欠席の締切を過ぎたか（開始の○時間前。デモの「今」は TODAY の 12:00）
const toMin = (date, time) => { const [h, m] = time.split(':').map(Number); return utc(date).getTime() / 60000 + h * 60 + m; };
export function pastDeadline(s) {
  return toMin(TODAY, NOW_TIME) >= toMin(s.date, s.start) - db.rules.deadlineHours * 60;
}
export const isPast = (s) => s.date < TODAY || (s.date === TODAY && `${s.end}` <= NOW_TIME);

// 振替権の期限（発生した回の月から数える）
export function creditExpiry(fromDate) {
  const r = db.rules.expiry;
  if (r === 'same_month') return monthEnd(monthOf(fromDate));
  if (r === 'days_60') return addDays(fromDate, 60);
  return monthEnd(addMonths(monthOf(fromDate), 1));
}

// 振替先の候補（空きのある日・期限内・確定した月・月の上限）。選べない日は出さない
export function makeupCandidates(m, credit) {
  const allowed = MAKEUP_TO[m.classId] ?? [];
  return db.sessions.filter((s) => {
    if (!allowed.includes(s.classId) || !isHeld(s) || s.date <= TODAY || s.date > credit.expires) return false;
    if (!db.months[monthOf(s.date)]?.confirmedAt) return false;
    const cls = classById(s.classId);
    if (rosterOf(s).length >= cls.cap) return false;
    const used = db.credits.filter((c) => c.memberId === m.id && c.status === 'reserved' && monthOf(sessionById(c.reservedSessionId).date) === monthOf(s.date)).length;
    if (used >= db.rules.monthlyLimit) return false;
    return !db.credits.some((c) => c.memberId === m.id && c.reservedSessionId === s.id && c.status === 'reserved');
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// その家庭が見られるお知らせ（宛先に自分の子が入っているもの）
export function noticesFor(fid) {
  const kids = familyKids(fid);
  return db.notices.filter((n) => {
    const t = n.target;
    if (t.type === 'all') return true;
    if (t.type === 'class') return kids.some((k) => k.classId === t.id);
    if (t.type === 'tag') return kids.some((k) => k.tags.includes(t.id));
    if (t.type === 'member') return kids.some((k) => (t.ids ?? [t.id]).includes(k.id));
    return false;
  }).sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id));
}
export const isRead = (n, fid) => (db.reads[n.id] ?? []).includes(fid);
export function markRead(n, fid) {
  if (isRead(n, fid)) return;
  (db.reads[n.id] ??= []).push(fid);
  commit();
}
// お知らせの宛先になる家庭の数
export function noticeFamilies(n) {
  const fam = new Set();
  for (const m of activeMembers()) {
    if (!m.line) continue;
    const t = n.target;
    const hit = t.type === 'all' || (t.type === 'class' && m.classId === t.id) || (t.type === 'tag' && m.tags.includes(t.id))
      || (t.type === 'member' && (t.ids ?? [t.id]).includes(m.id));
    if (hit) fam.add(m.family);
  }
  return fam;
}
export const targetLabel = (t) => t.type === 'all' ? '全員' : t.type === 'class' ? classById(t.id)?.name
  : t.type === 'tag' ? `タグ：${tagById(t.id)?.name}` : `個人（${(t.ids ?? [t.id]).length}人）`;

// =============================================================================
// 画面の小さな部品
// =============================================================================
let toastTimer = null;
export function showToast(text) {
  let el = document.getElementById('demo-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'demo-toast';
    el.className = 'demo-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// いちばん上の帯（デモであること・立場の切り替え・最初に戻す）
//   current … 'parent' / 'coach' / 'admin'
export function demoBar(current) {
  if (new URLSearchParams(location.search).has('embed')) { document.body.classList.add('is-embed'); return ''; }
  const roles = [['parent', '保護者', 'parent.html'], ['coach', 'コーチ', 'coach.html'], ['admin', '事務担当', 'admin.html']];
  return `
    <div class="demo-bar" role="region" aria-label="デモの操作">
      <a class="demo-brand" href="index.html">Clubena デモ</a>
      <span class="demo-note">架空のデータです。デモの今日は ${jmdw(TODAY)}</span>
      <nav class="demo-roles" aria-label="立場を切り替える">
        ${roles.map(([k, l, href]) => `<a href="${href}" ${k === current ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
      </nav>
      <button type="button" class="demo-reset" id="demo-reset">データを最初に戻す</button>
    </div>`;
}
export function bindDemoBar() {
  document.getElementById('demo-reset')?.addEventListener('click', () => {
    if (confirm('デモのデータを最初の状態に戻します。よろしいですか？')) resetDemo();
  });
}

// クリップボードに写す（「LINEで流す一言」）
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast('コピーしました。クラブのLINEに貼り付けて送ってください'); }
  catch { showToast('コピーできませんでした。文を選んでコピーしてください'); }
}
export const appUrl = () => '（ここに、クラブ専用のアプリのリンクが入ります）';
