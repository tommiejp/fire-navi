# v0.6 リリース候補

確認日: 2026-11-09（日本時間）
アプリ候補: 0d37114e528cc1d3b34c672acdf011cb023448ed
比較基準: f47f2b5（v0.5.1 UX改善）

## 変更
- 02c5936: マイプランのセクション整理、ページ内ナビ、初回設定導線
- 875980c: 個人情報を含まない読み込み表示、読み上げ通知、動きを減らす設定への対応
- 0d37114: 設定フォームの説明、項目別エラー、最初のエラーへのフォーカス

## 検証結果
- npm test: 113件成功、失敗・スキップなし
- TypeScript: npx tsc --noEmit --incremental false 成功
- production build: npm run build 成功
- git diff --check: 成功
- 検証開始時のworking tree: clean
- 自動回帰対象: FIRE計算・進捗・予測・比較・履歴・設定保存・プロフィール・認証・ログアウト・Rate Limit・Security Headers
- Server側検証、所有者ID、エラー一般化、Redis障害時の拒否はモックを含む既存テストで確認。

## デプロイへの影響
- v0.6にmigrationの追加・変更なし。既存001/002のみ。
- v0.6に環境変数追加・変更なし。Productionの値の変更は不要。
- 依存関係、Supabase/RLS、認証、Rate Limit、Security Headers、既存計算、Server側保存処理の変更なし。
- Production環境変数の実設定、実DB migration適用状況、外部サービスの稼働状態は今回未確認。
- package.jsonのversionは既存の0.1.0を維持。候補は上記commitで識別。

## 手動確認と残条件
- ユーザー確認済み: ページ内ナビ、モバイルoverflowなし、設定保存後の進捗・予測・グラフ更新、資産履歴保存・前回比・履歴表示。
- 後から追加した設定フォームの空欄・不正値・エラー表示・フォーカス・値保持・修正後保存とモバイル表示、および読み込み表示は実ブラウザ確認が未完了（前回のブラウザ操作が中断）。
- 自動検証上のリリース阻害問題は検出なし。ただし実ブラウザの残条件を完了するまでは最終リリース承認済みとは扱わない。
- push・Production deployは未実施。リリース指示時にgit状態、Production設定・migration状態、主要機能を再確認する。

## 最終テスト追記（2026-11-09）
- 全113自動テスト、TypeScript、production buildを再実行して成功。
- ローカル開発環境の実ブラウザで /my-plan → /login を確認。
- GoogleボタンからSupabase経由のGoogleログイン画面への遷移を確認。アカウント入力が必要で、認証完了・callback成功・ログイン後E2Eは未確認。
- 別ポート3100でproduction buildを起動し、/ と /login のHTTP 200、/history と /account の未認証307 → /loginを確認。
- /my-planはloadingによるstreamingのためHTTP 200内のredirect指示となる。実ブラウザで /login へ遷移することを確認。HTTP 200だけを保護失敗とは判定しない。
- codeなしcallbackは /login?error=auth へ307。ローカル設定の正規origin（localhost:3000）を使用。
- 上記ルートでCSP（object-src none / base-uri self / frame-ancestors none）、nosniff、Referrer-Policy、Permissions-Policyを実HTTP確認。callbackはno-referrer。
- 詳細CSPは既存どおりReport-Only。全面的なCSP enforcementを検証したという意味ではない。
- ブラウザログAPIで確認したproductionログイン画面のerror/warnは0件。全操作のNetworkトレース検証は未実施。
- UIの空状態・エラー状態・入力検証・項目別エラー・フォーカス・入力保持・二重送信・ナビ・loadingは自動テストで検証。今回の認証済み実ブラウザ操作やモバイル/desktop実寸・overflow確認とは区別する。
- 認証後の設定読込/保存、進捗/予測/グラフ/比較、履歴保存/前回比、history/account/logoutの実E2Eは、ローカルで利用可能な認証セッションがなく未完了。認証を迂回していない。
- Production環境変数・実DB適用状態は未取得。v0.6差分に追加設定・migrationはなく、変更要求なし。
- アプリ修正・push・deploy・実データ書込みなし。認証済みブラウザで残条件を完了するまで、最終リリース可否は条件付き。

## 認証済み実E2E（2026-11-09）
専用 test-a@example.com、localhost:3000の開発サーバーで実施。
- PASS: /my-plan設定読込、進捗6.7%、予測54年4か月、将来グラフ、シナリオ比較。
- PASS: 総資産空欄、支出0、利回り指数表記の項目別エラーと他値保持。Enter送信で最初のエラー欄へフォーカス。マウス操作ではブラウザ自動操作の不安定さがあり、クリック経路は再確認が必要。
- PASS: 総資産510万円を保存、進捗6.8%・予測53年11か月・グラフ更新。元の500万円、年間支出300万円、積立0、利回り5%へ保存復元（updated_atは更新）。
- PASS: シナリオ積立6万円への変更で即時更新。ページ移動で比較入力は初期値へ戻る。
- PASS: 375x812、1280x900のmy-planで横overflowなし。実スクリーンショットで保存ボタン・入力エラー・グラフ確認。グラフ実寸375px時309x256、1280px時590x288/320。
- PASS: ページ内「設定」でhashとフォーカスがfire-settingsへ移動。
- FAIL→修正済み: 履歴記録直後の前回比が古いまま。recordCurrentAssets成功時にmy-plan/historyをrevalidate。再記録で+1円/ほぼ変化なしへの即時反映を実確認。
- PASS: 履歴に新記録・グラフ反映、accountのメール/表示名入力表示、logoutでトップへ、直接my-planでloginへ。
- PASS: 再接続時にloading文言が表示され、その後マイプランへ切替。throttleは未実施。
- Console: 確認時error0。Rechartsの初回寸法-1警告あり。計測前のResponsiveContainerに起因すると推定、計測後の実寸・描画は正常。全操作のCSPログ/Network 4xx・5xxは網羅収集できていない。
- 未確認: 実Network要求数による二重送信確認、全操作Network/CSP、全ページの両viewport、ナビ折り返しの実測。二重送信は既存自動テストでPASSのみ。
- テスト履歴は5000000円（2026/11/09 16:21:52 JST）と5000001円の計2件を追加。削除UIがなく残存。設定は復元済み、他ユーザーは変更なし。
- 修正後の全114テスト、TypeScript、production build成功。
- 必須のNetwork/二重送信E2Eなどが残るため最終判定はNO-GO。push/deploy未実施。
