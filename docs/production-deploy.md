# 本番デプロイ手順

ngrokは開発確認には便利ですが、本番ではURLが変わらないホスティング先にデプロイします。おすすめは、まずはRender / Railway / Azure App Service / Google Cloud Runのどれかです。

このリポジトリは以下で本番起動できます。

```bash
npm ci
npm run build
npm start
```

`npm start` は `node dist/index.js` を起動します。

## 本番URL

デプロイ後、ヘルスチェックURLが通ることを確認します。

```text
https://本番URL/health
```

`OK` が返れば起動しています。

LINE Developers ConsoleのWebhook URLは以下にします。

```text
https://本番URL/webhook
```

ngrokのURLから本番URLへ差し替えたら、`Verify` を押して成功することを確認してください。

## 必須環境変数

本番環境のEnvironment Variables / Secretsに設定します。`.env` ファイルは本番サーバーへアップロードしない運用を推奨します。

```env
PORT=3000
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_RANGE=reflections!A:I
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_NAME=
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=japaneast
AZURE_SPEECH_ENDPOINT=
```

Googleサービスアカウントは、次のどれか1つを設定します。

| 変数 | 用途 |
|---|---|
| `GOOGLE_SHEETS_CREDENTIALS_PATH` | ローカル向け。JSONファイルのパス |
| `GOOGLE_SHEETS_CREDENTIALS_JSON` | 本番向け。JSONの中身をそのまま環境変数に入れる |
| `GOOGLE_SHEETS_CREDENTIALS_BASE64` | 本番向け。JSONをbase64化して入れる |

本番では `GOOGLE_SHEETS_CREDENTIALS_BASE64` が扱いやすいです。

## Google認証JSONをbase64化する

ローカルに `google-service-account.json` がある場合:

```bash
base64 -i google-service-account.json
```

出力された文字列を本番環境の `GOOGLE_SHEETS_CREDENTIALS_BASE64` に設定します。

macOSで改行なしにしたい場合:

```bash
base64 -i google-service-account.json | tr -d '\n'
```

## Renderで動かす場合

1. GitHubにこのリポジトリをpushする。
2. Renderで `New` → `Web Service` を選ぶ。
3. リポジトリを選ぶ。
4. Runtimeは `Node`。
5. Build Command:

```bash
npm ci && npm run build
```

6. Start Command:

```bash
npm start
```

7. Environment Variablesに本番用の値を入れる。
8. デプロイ後、`https://RenderのURL/health` を確認する。
9. LINE Webhook URLを `https://RenderのURL/webhook` に変更する。

## Azure App Serviceで動かす場合

Azure OpenAI / Azure Speechをすでに使っているなら、Azure App Serviceにまとめる構成は自然です。まずはLinuxのNode.js Web Appとして作るのが簡単です。

### 1. App Serviceを作成

Azure Portalで:

1. `App Services` を開く。
2. `Create` を押す。
3. `Web App` を選ぶ。
4. 基本設定を入れる。

| 項目 | 推奨値 |
|---|---|
| Publish | `Code` |
| Runtime stack | `Node 22 LTS` または `Node 20 LTS` |
| Operating System | `Linux` |
| Region | Azure OpenAI/Speechと同じか近いリージョン |
| Pricing plan | まずはBasic以上推奨。本番でFree/Sharedは非推奨 |

作成後、以下のURLが発行されます。

```text
https://アプリ名.azurewebsites.net
```

### 2. 環境変数を設定

App Serviceの左メニューで:

```text
Settings → Environment variables
```

または古いUIなら:

```text
Settings → Configuration → Application settings
```

に進み、必須環境変数を追加します。

Azure App Serviceでは `PORT` はAzure側が扱うため、明示設定しなくても動きます。設定する場合は `3000` で構いません。

Googleサービスアカウントは、ファイルを置くより `GOOGLE_SHEETS_CREDENTIALS_BASE64` を使うのがおすすめです。

```bash
base64 -i google-service-account.json | tr -d '\n'
```

出力を `GOOGLE_SHEETS_CREDENTIALS_BASE64` に入れます。

### 3. デプロイ方法

一番分かりやすいのはGitHub連携です。

1. App Serviceの `Deployment Center` を開く。
2. Sourceに `GitHub` を選ぶ。
3. リポジトリとブランチを選ぶ。
4. GitHub Actionsを作成する。

ビルドで必要なのは以下です。

```bash
npm ci
npm run build
```

起動コマンドは以下です。

```bash
npm start
```

App Serviceの `Configuration` → `General settings` に `Startup Command` がある場合は、以下を入れます。

```bash
npm start
```

### 4. 動作確認

デプロイ後:

```text
https://アプリ名.azurewebsites.net/health
```

で `OK` が返ることを確認します。

次にLINE Developers ConsoleのWebhook URLを以下に変更します。

```text
https://アプリ名.azurewebsites.net/webhook
```

`Verify` が成功したら、LINEから `ヘルプ`、通常テキスト、音声メッセージ、`一覧` を順に確認します。

### Azure App Serviceの注意点

- `.env` ファイルはアップロードせず、App ServiceのEnvironment variablesに入れる。
- `GOOGLE_SHEETS_CREDENTIALS_PATH` は本番では使わず、`GOOGLE_SHEETS_CREDENTIALS_BASE64` を使う。
- Azure OpenAI / SpeechのキーはApp Serviceのアプリ設定に保存する。
- LINE Webhookには `https://...azurewebsites.net/webhook` を設定する。
- App Serviceのログは `Monitoring → Log stream` で確認する。
- 本番運用ではFree/SharedよりBasic以上が無難。

## Dockerで動かす場合

Docker対応も追加済みです。

```bash
docker build -t voice2line-sea .
docker run --env-file .env -p 3000:3000 voice2line-sea
```

本番では `.env` をイメージに含めず、ホスティング側のSecrets機能で渡してください。

## 本番化前チェックリスト

- `/health` が `OK` を返す。
- LINE DevelopersのWebhook `Verify` が成功する。
- `ヘルプ` が返る。
- テキスト投稿がSheetsに保存される。
- 音声投稿がSheetsに保存される。
- `一覧` が直近7日分を返す。
- スプレッドシートがサービスアカウントに共有されている。
- LINE Official Accountの自動応答がBot返信と競合していない。
- ngrok URLではなく本番URLがWebhookに設定されている。
