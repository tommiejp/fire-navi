# FIREナビ v0.2 アーキテクチャ設計

## 範囲と位置づけ

本書は今後の実装方針であり、認証・クラウド保存が実装済みであることを示すものではない。今回の成果物は本書と初期SQLのみ。既存アプリ、依存関係、localStorageデータを変更しない。毎月積立や課金などは本設計の対象外。

FIRE計算は匿名で利用でき、クラウドへの保存・履歴・プロフィールだけを認証対象とする。既存のブラウザ内保存はクラウド保存と区別し、ログイン時に自動アップロード・上書きしない。将来移行する場合は、検証済みデータをユーザーの明示操作で保存する。

## ルートとユーザーフロー

| 区分 | ルート | 用途 |
| --- | --- | --- |
| Public | `/` | ログイン不要のFIRE計算 |
| Public | `/login` | Google / Email・Passwordログイン |
| Public | `/register` | 新規登録 |
| Protected | `/my-plan` | 自分の設定の読込・保存 |
| Protected | `/history` | 自分の資産履歴 |
| Protected | `/account` | プロフィール・ログアウト |
| 認証プロトコル用 | `/auth/callback` | OAuthコード交換。事前ログインは要求しない |

ProtectedページはServer側で認証を検証する。画面のガードだけに依存せず、各Read・Writeでも認証・所有者を確認する。他人のデータを共有キャッシュに載せない。

## 認証・OAuth callback

Supabase AuthのGoogle OAuthとEmail / Passwordを利用する。PasswordはAuthに委ね、アプリDBには保存しない。`auth.users.id`を全テーブルの`user_id`とする。

Server側ではSupabase Authの`getUser()`などで検証済みの現在の`user.id`を取得する。Cookieに入っているセッション情報を読むだけで認証済みと判定しない。clientから渡された`user_id`を信用せず、Writeの所有者にはServerで取得したIDを設定する。通常のDB操作は当該ユーザーのセッションで行い、RLSを適用する。service_roleで日常のユーザー操作を実行しない。

Google → Supabase Auth → `/auth/callback` → PKCEのcode exchange → session確立 → アプリ内部へredirect。

戻り先は`/my-plan`を既定とし、`/`・`/my-plan`・`/history`・`/account`との完全一致allowlistだけを許可する。外部URL、`//`、バックスラッシュ、任意のquery/fragment付きURLは採用しない。redirectのoriginは信頼する設定値を使い、未検証のHostヘッダーから構築しない。Supabase側のRedirect URLsも本番・必要な開発URLに限定する。code交換失敗時は一般化したエラーで`/login`へ戻す。認証コードやトークンをログに記録しない。

## データモデル・単位

| テーブル | カラム | 関係 |
| --- | --- | --- |
| `profiles` | `user_id UUID PK/FK auth.users(id)`, `display_name TEXT`, `created_at TIMESTAMPTZ` | 1 user : 1 row |
| `user_financial_settings` | `user_id UUID PK/FK auth.users(id)`, `total_assets BIGINT`, `annual_expenses BIGINT`, `expected_return NUMERIC(5,2)`, `updated_at TIMESTAMPTZ` | 1 user : 最大1 row（初回保存前は0） |
| `asset_history` | `id UUID PK`, `user_id UUID FK auth.users(id)`, `total_assets BIGINT`, `recorded_at TIMESTAMPTZ` | 1 user : N rows |

金額は整数の円。`expected_return`はパーセント値で、`5.00`が5%を意味する。計算時は100で割る。既存の小数割合との混同を避け、将来の変換処理で明示的に単位を変換する。

FIRE目標額はDB保存せず、`annual_expenses / 0.04`で算出する。資産推移は`資産(n+1) = 資産(n) × (1 + expected_return / 100)`、追加積立なし、最大60年。現在すでに目標以上なら0年、初めて到達した年を採用し、未到達は「60年以内では未到達」とする。利回り0%も有効で、初期未到達なら未到達となる。

全カラムはNOT NULL。プロフィール名は未設定を空文字で表し最大50文字。日時はDBの`now()`、履歴IDは`gen_random_uuid()`を既定値とする。日時はTIMESTAMPTZで保持し表示時にタイムゾーンを適用する。Authユーザー削除時はFKのON DELETE CASCADEで関連データも削除される（退会UIは今回対象外）。履歴には`(user_id, recorded_at DESC)`インデックスを設ける。

## 入力検証

ClientとServerで同じルールを適用し、DBでもCHECKを適用する。

- `total_assets >= 0`、`annual_expenses > 0`。整数の円のみ。
- `0 <= expected_return <= 20`。小数点以下2桁まで。DBのNUMERIC丸めに検証を任せない。
- `display_name`はUnicodeコードポイントで最大50文字（PostgreSQLのchar_lengthに合わせる）。空文字は許可する。
- 空欄、NaN、Infinity、指数表記、不正文字列、桁あふれを拒否する。空欄を0や1円へ変換しない。
- BIGINTの全範囲はJavaScript Numberで正確に表せない。初期アプリは金額をNumber.MAX_SAFE_INTEGER以下に制限し、読込時にも検査する。DBのBIGINT範囲とアプリの上限は異なる。DBから大きすぎる値が来た場合は計算しない。
- 復元値・API値も再検証し、無効入力では結果を計算せず入力エラーを返す。

## DB権限・RLS・trigger

全ユーザーデータテーブルでRLSを有効化し、authenticatedロールに限定する。共通の所有条件は`auth.uid() is not null and auth.uid() = user_id`。

| テーブル | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | own | clientには許可しない | own | clientには許可しない |
| user_financial_settings | own | own | own | own |
| asset_history | own | own | own | own |

SELECT・DELETEはUSING、INSERTはWITH CHECK、UPDATEは両方で所有者を検証する。SQL権限も必要な操作だけを付与し、profilesのUPDATE権限はdisplay_name列だけに限定する。anonにはテーブル権限を付与しない。

`auth.users`へのINSERT後にsignup triggerがprofilesを作成する。SECURITY DEFINER関数は`search_path = ''`と完全修飾テーブル名を使用し、一般ロールへの直接実行権限を取り消す。表示名は空文字で初期化し、信頼できないOAuth metadataをコピーしない。trigger失敗はsignupも失敗させるため、実環境適用前に登録テストが必要。

`user_financial_settings`のBEFORE UPDATE triggerはupdated_atをDB時刻へ更新する。クライアント指定値よりtriggerを優先する。

初期SQLはSupabaseのauthスキーマ・標準ロールと、管理権限を持つmigration実行者を前提とする。既存の同名テーブルがあれば失敗させ、IF NOT EXISTSで構造差分を隠さない。既存Authユーザーのプロフィールも初期SQL内で補完する。既存アプリのlocalStorageデータは移行しない。

## Server側の責務

ReadはServer Component中心、WriteはServer Action中心とする。

| Action | 処理 |
| --- | --- |
| saveFinancialSettings | 認証済みIDをキーに検証済み設定をupsert。履歴を自動追加しない |
| recordCurrentAssets | 検証した現在資産を、認証済みID・DB既定の日時で履歴へINSERT |
| updateProfile | 自分のdisplay_nameのみUPDATE |
| logout | POST / Server ActionでSupabaseのサインアウトとCookie更新 |

履歴ID等を受け取る将来の更新・削除でも所有条件を必ず適用する。設定未保存・履歴0件は通常の空状態として扱う。通常の状態変更はGETで行わない。OAuth callbackのGETは認証プロトコル上の例外としてcode交換とsession確立だけを行い、設定保存や履歴作成を行わない。

## 多層防御・Rate Limit

Client Validation → Server Authentication → Rate Limit → Server Validation → PostgreSQL CHECK → Supabase RLS。

| Action | 初期限度 |
| --- | --- |
| saveFinancialSettings | 20回 / 分 / user |
| recordCurrentAssets | 10回 / 分 / user |
| updateProfile | 10回 / 分 / user |

FIRE計算自体には適用しない。keyはServerで確定した`user_id + action`。Rate Limitは専用の境界（adapter）へ分離し、Redis系の共有ストアへ接続できる設計とする。データをFIREナビ本体のPostgreSQLには保存しない。複数インスタンスで整合する原子的カウント・TTLが必要で、プロセス内メモリだけを本番保証としない。Rate Limit境界は`lib/rate-limit`で実装する。認証後、入力検証より前にカウントし、不正入力やDBエラーも回数に含む。各ユーザー・Actionの初回要求から60秒の固定窓とし、TTL期限後にカウントを再開する（厳密な移動窓ではない）。上限超過の要求も加算するがTTLは延長しない。

共有ストアは`RateLimitStore.incrementWithTtl`を実装し、増分と初回TTL設定を原子的に行う。Redis系adapterへの差替え箇所は`lib/rate-limit/index.ts`の構成部分。今回、共有ストアの接続は未実装で、既定ストアは必ず利用不能を返す。開発・本番ともmemory fallbackを持たず、接続実装まで3つの書込みActionはSERVER_ERRORとなる。単体テストのみ注入したfakeを使用する。

ストア未設定・障害・不正応答の場合はSERVER_ERRORを返し、DB書込みへ進まない。RATE_LIMITEDとは区別し、無制限通過やraw store errorの表示・ログ出力はしない。呼称としての「fail closed」ではなく、本書では「バックエンド障害による書込み停止」と明記する。

このSQLのauthenticated権限とRLSは、Supabase Data APIへの直接アクセスでも本人の操作を許可する。したがってServer ActionのRate Limitは直接DB API操作まで保証しない。RLSは所有者分離の仕組みでありRate Limitではない。v0.2公開前に、Data API側を含む制限が必要か、直接アクセスの制約方法を決定する。service_roleでRLSを迂回する解決は採用しない。

## CSRF・XSS・Security Headers

状態変更はServer Action / POSTとし、SameSite Cookie（OAuth復帰を考慮してLaxを基本）とHTTPSを前提にする。Next.jsのOrigin/Host検証を維持し、allowedOriginsを広く許可しない。プロキシの転送Hostを検証する。Origin欠落をフレームワークが常に拒否するとは仮定せず、採用バージョンの挙動を確認する。将来独自Route Handlerを増やす場合はCSRFトークン・Origin検証等の設計を再評価する。認証済みであることだけではCSRF対策にならない。

XSS対策は通常のReact文字列描画を用いる。dangerouslySetInnerHTML、innerHTML、document.write、eval、user inputをscriptへ直接埋め込むことを原則禁止する。

Security Headersの設計対象:

- Content-Security-Policy: Next.jsのscript実行、Supabase接続、OAuthを実機検証して許可元を絞る。必要に応じてContent-Security-Policy-Report-Onlyで先行検証し、問題解消後に強制する。未検証のポリシーをいきなり本番適用しない。
- X-Content-Type-Options: nosniff。
- Referrer-Policy: strict-origin-when-cross-originを基本とし、認証callbackにはno-referrerを検討する。
- Permissions-Policy: camera=(), microphone=(), geolocation=()など未使用機能を無効化する。

ヘッダーは設計対象のみで今回は設定しない。

## エラー・ログ・Secrets

ユーザーに内部エラー、SQL詳細、stack traceをそのまま返さない。アプリ側分類はVALIDATION_ERROR、UNAUTHORIZED、RATE_LIMITED、NOT_FOUND、SERVER_ERROR。RLSで不可視の行は他人の存在を漏らさずNOT_FOUND等へまとめる。

構造化ログにはtimestamp、user_id（未認証時null）、action、error_type、request_idのみを基本として残す。資産額、Password、Access Token、Refresh Token、service_role keyは残さない。リクエスト本文・Cookie・Authorization・認証code・生のDBエラーを丸ごと記録しない。DB制約エラーに行の値が含まれる場合もあるため、ログを安全な分類へ変換する。

Supabase publishable / anon keyはbrowserで利用可能だが、テーブルのRLSと適切な権限が前提。service_role keyはbrowser禁止、NEXT_PUBLIC_*への設定禁止。通常のServer Actionにも不要とし、必要な管理用途が生じた場合だけServerの秘密情報として分離する。

## 適用前の検証と未決事項

SQLは未適用。全体テストやアプリ実装は今回の範囲外。適用前に隔離したSupabase環境で以下を検証する。

1. migration成功、既存Authユーザー補完、新規signup時のプロフィール1件作成。
2. 未認証・ユーザーA・ユーザーBで全操作を検証し、他人の行の読取・変更・所有者変更が拒否されること。
3. profilesのclient INSERT/DELETEとuser_id/created_at変更が拒否されること。
4. 0円・負数・支出0・利回り0/20・範囲外・表示名50/51文字・NULL・NaNの境界。
5. updated_atの自動更新、Authユーザー削除時のCASCADE、履歴の並び順。

OAuthプロバイダー、メール確認・送信、Cookie更新、Rate Limitストア、Data API直接アクセスへの対処、CSP具体値は後続実装で確定する。本書やSQLの作成だけでv0.2が公開可能になるわけではない。

## 参照

- [Supabase: User Management](https://supabase.com/docs/guides/auth/managing-user-data) — Authユーザー参照・signup trigger。
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — 所有者ポリシー。
- 当プロジェクト同梱の`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` — Origin検証の挙動。
