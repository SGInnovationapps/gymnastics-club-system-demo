# Clubena デモ（社内共有用モックアップ）

体操クラブ向け会員管理アプリ **Clubena** の、操作できるモックアップです。
仕様書 v2.0（2026-10-14）にそって、保護者・コーチ・事務担当の3つの立場の画面を、架空のデータで動かせます。

- 入口：`index.html`（概要・おすすめの流れ・機能の一覧）
- 保護者の画面：`parent.html`（スマホ・LINEミニアプリ）
- コーチの画面：`coach.html`（スマホ・体育館で使う）
- 事務担当の画面：`admin.html`（パソコン）

## このデモについて

- 名前・電話番号などは、すべて架空です。本物のデータベース・LINEにはつながっていません
- 操作した内容は、開いたブラウザの中（localStorage）にだけ保存されます。ほかの人には見えません
- いちばん上の帯の「データを最初に戻す」で、最初の状態に戻せます
- デモの「今日」は 2026年11月5日（木）12:00 に決めてあります（いつ開いても同じ動きをするように）
- 3つの画面は同じデータを見ています。たとえば事務担当が「12月分を確定する」を押すと、保護者の予定とホームに出ます
- 実際のアプリ（`SGInnovationapps/spiralworks-clubena`）とは別のものです。見た目（色・文字）は実際のアプリにそろえています

## ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | 入口のページ |
| `parent.html` ・ `coach.html` ・ `admin.html` | 3つの立場の画面 |
| `assets/core.js` | 架空のデータ・保存・学年の計算など、共通の部品 |
| `assets/parent.js` ・ `assets/coach.js` ・ `assets/admin.js` | それぞれの画面 |
| `assets/demo.css` | 見た目 |
| `.nojekyll` | GitHub Pages でそのまま配信するための空ファイル |

ビルドは要りません。HTML・CSS・JavaScript をそのまま置くだけで動きます。
手元で見るときは、このフォルダで `python -m http.server 8000` などを動かし、`http://localhost:8000/` を開いてください
（ファイルをダブルクリックで開くと、ブラウザの決まりで JavaScript が動きません）。

## GitHub Pages での公開

1. このフォルダの中身を、リポジトリのいちばん上（`main` ブランチ）に置く
2. リポジトリの **Settings → Pages** で、Source を「Deploy from a branch」、Branch を `main` ・ `/ (root)` にして Save
3. 1〜2分で `https://（組織名かユーザー名）.github.io/（リポジトリ名）/` に出る

GitHub Pages のページは、URL を知っている人ならだれでも開けます（検索には出にくいよう `noindex` を付けています）。
