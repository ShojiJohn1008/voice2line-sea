# トークン・環境変数の取得手順

このプロジェクトで使う値は `.env` に保存します。`.env.example` をコピーして `.env` を作り、取得した値を入れてください。

```bash
cp .env.example .env
```

実トークン、APIキー、GoogleのJSON鍵はGitにコミットしないでください。`.gitignore` で `.env` は除外済みです。

## 一覧

| 環境変数 | 取得元 | 用途 |
|---|---|---|
| `PORT` | 任意 | Expressサーバーの起動ポート |
| `LINE_CHANNEL_SECRET` | LINE Developers Console | Webhook署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | Botから返信・Push送信 |
| `GOOGLE_SHEETS_CREDENTIALS_PATH` | Google Cloud | Sheets API用サービスアカウントJSONのパス |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | GoogleスプレッドシートURL | 保存先スプレッドシートID |
| `GOOGLE_SHEETS_RANGE` | 任意 | 保存先シート・範囲 |
| `AZURE_OPENAI_ENDPOINT` | Azure Portal | LLM分類用Azure OpenAIエンドポイント |
| `AZURE_OPENAI_API_KEY` | Azure Portal | LLM分類用Azure OpenAIキー |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure AI Foundry / Azure Portal | 呼び出すモデルのデプロイ名 |
| `AZURE_OPENAI_API_VERSION` | 固定値で可 | Azure OpenAI APIバージョン |
| `LIFF_ID` | LINE Developers Console | LIFF画面の初期化 |
| `AZURE_SPEECH_KEY` | Azure Portal | 音声認識用Speechキー |
| `AZURE_SPEECH_REGION` | Azure Portal | 音声認識用Speechリージョン |
| `AZURE_SPEECH_ENDPOINT` | Azure Portal | 音声認識用Speechエンドポイント。未設定ならリージョンから自動生成 |

## LINE Messaging API

対象のLINE公式アカウントに紐づく **Messaging API channel** を使います。

### `LINE_CHANNEL_SECRET`

1. [LINE Developers Console](https://developers.line.biz/console/) を開く。
2. Providerを選択する。
3. 対象の **Messaging API channel** を開く。
4. `Basic settings` タブを開く。
5. `Channel secret` をコピーして `.env` に入れる。

```env
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `LINE_CHANNEL_ACCESS_TOKEN`

1. 対象の **Messaging API channel** を開く。
2. `Messaging API` タブを開く。
3. `Channel access token` で発行する。
4. 発行された値を `.env` に入れる。

```env
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

MVPでは長期チャネルアクセストークンで運用できます。漏えいが疑われる場合はLINE Developers Consoleで再発行してください。

参考:

- [Channel access token | LINE Developers](https://developers.line.biz/en/docs/basics/channel-access-token/)
- [Verify webhook signature | LINE Developers](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

## LIFF

LIFFは **LINE Login channel** 側に追加します。Messaging API channelとは別のchannelになる点に注意してください。

### `LIFF_ID`

1. [LINE Developers Console](https://developers.line.biz/console/) を開く。
2. Providerを選択する。
3. **LINE Login channel** を作成、または既存のものを開く。
4. `LIFF` タブを開く。
5. `Add` でLIFF appを追加する。
6. `Endpoint URL` に公開済みURLを入れる。
   - 例: `https://example.com/liff/`
   - LINE内ブラウザで使うためHTTPS必須。
7. 作成後に表示される `LIFF ID` を `.env` に入れる。

```env
LIFF_ID=2000000000-xxxxxxxx
```

参考:

- [Adding a LIFF app to your channel | LINE Developers](https://developers.line.biz/en/docs/liff/registering-liff-apps/)

## Google Sheets

このアプリはサービスアカウントJSONでGoogle Sheets APIにアクセスします。

### 1. Google Sheets APIを有効化

1. [Google Cloud Console](https://console.cloud.google.com/) を開く。
2. 対象プロジェクトを作成、または選択する。
3. `APIs & Services` → `Library` を開く。
4. `Google Sheets API` を検索して有効化する。

### 2. サービスアカウントを作成

1. `IAM & Admin` → `Service Accounts` を開く。
2. `Create service account` を押す。
3. 名前を付けて作成する。
4. 作成したサービスアカウントのメールアドレスを控える。
   - 例: `reflection-bot@your-project.iam.gserviceaccount.com`

### 3. JSONキーを作成

1. 作成したサービスアカウントを開く。
2. `Keys` タブを開く。
3. `Add key` → `Create new key` を選ぶ。
4. `JSON` を選んで作成する。
5. ダウンロードされたJSONをプロジェクト外、またはコミットしない場所に置く。

`.env` にはJSONファイルへのパスを入れます。

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=./google-service-account.json
```

### 4. 保存先スプレッドシートを共有

1. 保存先のGoogleスプレッドシートを開く。
2. `共有` を押す。
3. サービスアカウントのメールアドレスに編集権限を付ける。

### `GOOGLE_SHEETS_SPREADSHEET_ID`

スプレッドシートURLの `/d/` と `/edit` の間がIDです。

```text
https://docs.google.com/spreadsheets/d/【ここがSPREADSHEET_ID】/edit
```

```env
GOOGLE_SHEETS_SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_SHEETS_RANGE=reflections!A:I
```

`GOOGLE_SHEETS_RANGE` は、保存先シート名が `reflections` なら `reflections!A:I` のままで使えます。

参考:

- [Create and delete service account keys | Google Cloud](https://docs.cloud.google.com/iam/docs/keys-create-delete)
- [Service account credentials | Google Cloud](https://docs.cloud.google.com/iam/docs/service-account-creds)

## Azure OpenAI

投稿テキストの整形・分類に使います。

### `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY`

1. [Azure Portal](https://portal.azure.com/) を開く。
2. 対象のAzure OpenAIリソースを開く。
3. 左メニューの `Resource Management` → `Keys and Endpoint` を開く。
4. `Endpoint` を `AZURE_OPENAI_ENDPOINT` に入れる。
5. `KEY 1` または `KEY 2` を `AZURE_OPENAI_API_KEY` に入れる。

```env
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_API_VERSION=2024-10-21
```

### `AZURE_OPENAI_DEPLOYMENT_NAME`

1. Azure AI Foundry、またはAzure Portalで対象リソースのデプロイ一覧を開く。
2. 使用するモデルの **Deployment name** を確認する。
3. モデル名ではなく、デプロイ時に付けた名前を `.env` に入れる。

```env
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

参考:

- [Azure OpenAI REST API reference | Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference)
- [Create and deploy an Azure OpenAI resource | Microsoft Learn](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource)

## Azure Speech

LINE音声メッセージの文字起こしに使います。LIFF画面を使う場合はリアルタイム音声認識にも使います。

### `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` / `AZURE_SPEECH_ENDPOINT`

1. [Azure Portal](https://portal.azure.com/) を開く。
2. 対象のSpeech resource、またはAzure AI services resourceを開く。
3. 左メニューの `Resource Management` → `Keys and Endpoint` を開く。
4. `KEY 1` または `KEY 2` を `AZURE_SPEECH_KEY` に入れる。
5. `Location/Region` を `AZURE_SPEECH_REGION` に入れる。
6. `Endpoint` を `AZURE_SPEECH_ENDPOINT` に入れる。

```env
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=japaneast
AZURE_SPEECH_ENDPOINT=https://japaneast.api.cognitive.microsoft.com
```

キー、リージョン、エンドポイントは同じリソースのものを使ってください。`AZURE_SPEECH_ENDPOINT` を空にした場合、アプリは `AZURE_SPEECH_REGION` から `https://{region}.api.cognitive.microsoft.com` を組み立てます。

参考:

- [Supported regions for Azure Speech | Microsoft Learn](https://learn.microsoft.com/azure/ai-services/speech-service/regions)
- [Azure Speech key retrieval answer | Microsoft Learn](https://learn.microsoft.com/en-us/answers/questions/1394348/how-do-i-get-a-subscription-key)

## 最低限の `.env` 例

```env
PORT=3000

LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

GOOGLE_SHEETS_CREDENTIALS_PATH=./google-service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_SHEETS_RANGE=reflections!A:I

AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-10-21

LIFF_ID=2000000000-xxxxxxxx

AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=japaneast
AZURE_SPEECH_ENDPOINT=https://japaneast.api.cognitive.microsoft.com
```

## 動作確認前チェック

- `.env` が存在する。
- `GOOGLE_SHEETS_CREDENTIALS_PATH` のJSONファイルが実在する。
- スプレッドシートがサービスアカウントに共有されている。
- LINE Webhook URLが `https://公開URL/webhook` になっている。
- LIFF Endpoint URLが `https://公開URL/liff/` になっている。
- Azure Speechのキーとリージョンが同じリソースのものになっている。
