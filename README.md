# Voice2LINE SEA

LINEで送った文字・音声の振り返りを、自動で文字起こし・分類してGoogleスプレッドシートへ保存するBotです。

## できること

- LINEの通常テキストを振り返りとして保存
- LINEのボイスメッセージをAzure Speechで文字起こしして保存
- Azure OpenAIで投稿を分類
- Google Sheetsに1投稿1行で保存
- `一覧` コマンドで直近7日分を返信
- リッチメニューから `文字で記録` / `音声で記録` / `一覧` / `ヘルプ` に誘導
- 週1回、未完了の「次やりたいこと」をLINEで追い掛け（やった！/まだこれから/もうやらない）

分類カテゴリ:

| 保存値 | 表示名 |
|---|---|
| `learned` | 学んだこと |
| `could_not` | できなかったこと |
| `next` | 次やりたいこと |
| `moyamoya` | モヤモヤしたこと |
| `other` | その他 |

## 構成

```text
LINE Messaging API
  ├─ テキストメッセージ
  └─ 音声メッセージ → Azure Speech
        ↓
Azure OpenAIで整形・分類
        ↓
Google Sheetsへ保存
```

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に必要な値を設定します。取得方法は [docs/token-setup.md](docs/token-setup.md) を参照してください。

```env
PORT=3000
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
GOOGLE_SHEETS_CREDENTIALS_PATH=./google-service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_RANGE=reflections!A:I
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_NAME=
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=japaneast
AZURE_SPEECH_ENDPOINT=
FOLLOWUP_CRON=0 7 * * 1
FOLLOWUP_TIMEZONE=Asia/Tokyo
FOLLOWUP_LOOKBACK_DAYS=14
FOLLOWUP_SECRET=
```

Googleサービスアカウントの `client_email` を、保存先スプレッドシートに編集者として共有してください。

## ローカル起動

```bash
npm run dev
```

ヘルスチェック:

```text
http://localhost:3000/health
```

LINE Webhookのローカル確認にはngrokなどで公開URLを作ります。

```bash
ngrok http 3000
```

LINE Developers ConsoleのWebhook URL:

```text
https://ngrokのURL/webhook
```

## コマンド

| LINE入力 | 動作 |
|---|---|
| `文字で記録` | 文章送信を案内 |
| `音声で記録` | LINEボイスメッセージ送信を案内 |
| 通常テキスト | 分類してSheets保存 |
| LINE音声メッセージ | 文字起こし、分類、Sheets保存 |
| `一覧` / `いちらん` | 直近7日分を返信 |
| `ヘルプ` / `使い方` | 使い方を返信 |

## リッチメニュー

おすすめ構成は以下です。

| ボタン | アクション | テキスト |
|---|---|---|
| 文字で記録 | Text | `文字で記録` |
| 音声で記録 | Text | `音声で記録` |
| 一覧を見る | Text | `一覧` |
| 使い方 | Text | `ヘルプ` |

詳細は [docs/rich-menu.md](docs/rich-menu.md) を参照してください。

## 「次やりたいこと」追い掛けBot

`next` カテゴリで記録された振り返りのうち、未完了のものを週1回LINEでプッシュして「どうなった？」と聞き返します。

- デフォルトは毎週月曜7:00（JST）。`FOLLOWUP_CRON` / `FOLLOWUP_TIMEZONE` で変更、`FOLLOWUP_CRON=off` で無効化できます。
- 対象は直近 `FOLLOWUP_LOOKBACK_DAYS`（デフォルト14日）以内の未完了 `next`。1回の追い掛けは最大4件で、古いものから聞きます。
- 各項目のボタンをタップすると、スプレッドシートのJ列（`followUpStatus`）が更新されます。

| ボタン | 動作 |
|---|---|
| やった！ | J列を `done` にして完了扱い |
| まだこれから | 未完了のまま。次回また聞く（期間を過ぎると自然に対象外） |
| もうやらない | J列を `dismissed` にしてクローズ |

手動実行用のエンドポイントもあります（`FOLLOWUP_SECRET` の設定が必要）。

```bash
curl -X POST https://<ホスト>/api/followup/run -H "x-followup-secret: <FOLLOWUP_SECRET>"
```

既存のスプレッドシートを使っている場合は、J列のヘッダーに `followUpStatus` を追記しておくと見やすくなります（追記しなくても動作します）。

注意: スケジューラはアプリのプロセス内（node-cron）で動くため、Azure App Serviceでは「Always On」を有効にしてください。Always Onにできない場合は、外部スケジューラ（GitHub Actionsのcronなど）から上記エンドポイントを叩く構成にしてください。

## 本番デプロイ

本番ビルド:

```bash
npm run build
npm start
```

Azure App Serviceなどにデプロイする場合は、`.env` ファイルをアップロードせず、環境変数として登録してください。

Google認証JSONは本番では `GOOGLE_SHEETS_CREDENTIALS_BASE64` を推奨します。

```bash
base64 -i google-service-account.json | tr -d '\n'
```

詳細は [docs/production-deploy.md](docs/production-deploy.md) を参照してください。

## 開発用コマンド

```bash
npm run typecheck
npm run build
```

## セキュリティ

- `.env`、GoogleサービスアカウントJSON、APIキーはGitHubへpushしないでください。
- 患者個人情報を投稿しない運用にしてください。
- サービスアカウントキーをチャットや公開場所に貼った場合は、Google Cloud Consoleで削除して再発行してください。
