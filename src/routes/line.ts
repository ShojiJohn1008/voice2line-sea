import express, { Request, Response } from "express";
import { AudioEventMessage, Client, MessageEvent, middleware as lineMiddleware, PostbackEvent, TextEventMessage, WebhookEvent } from "@line/bot-sdk";
import { categoryNames } from "../services/llm";
import { getRecentReflections } from "../services/sheets";
import { env } from "../utils/env";
import { Reflection } from "../models/reflection";
import { recordReflection } from "../services/reflections";
import { handleFollowupPostback } from "../services/followup";
import { streamToBuffer, transcribeAudio } from "../services/speech";

const router = express.Router();
const lineClient = new Client({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });
type TextMessageEvent = MessageEvent & { message: TextEventMessage };
type AudioMessageEvent = MessageEvent & { message: AudioEventMessage };

const lineMiddlewareConfig = lineMiddleware({ channelSecret: env.LINE_CHANNEL_SECRET });
export { lineMiddlewareConfig as lineMiddleware };

const isListCommand = (text: string) => /^(一覧|いちらん)\s*$/u.test(text.trim());
const isHelpCommand = (text: string) => /^(ヘルプ|使い方|help)\s*$/u.test(text.trim());
const isTextStartCommand = (text: string) => /^(文字で記録|テキストで記録|文字入力)\s*$/u.test(text.trim());
const isVoiceStartCommand = (text: string) => /^(音声で記録|音声入力)\s*$/u.test(text.trim());

function formatSummary(reflections: Reflection[]) {
  const groups: Record<string, string[]> = {
    learned: [],
    could_not: [],
    next: [],
    moyamoya: [],
  };

  reflections.forEach((item) => {
    item.categories.forEach((category: string) => {
      if (groups[category]) {
        groups[category].push(item.cleanedText || item.rawText);
      }
    });
  });

  const lines = ["【今週の振り返り（直近7日）】"];
  const categoryOrder: Array<[string, string]> = [
    ["learned", "学んだこと"],
    ["could_not", "できなかったこと"],
    ["next", "次やりたいこと"],
    ["moyamoya", "モヤモヤしたこと"],
  ];

  categoryOrder.forEach(([key, title]) => {
    if (groups[key].length > 0) {
      lines.push(`■ ${title}`);
      groups[key].forEach((value) => lines.push(`・${value}`));
    }
  });

  if (lines.length === 1) {
    return "【今週の振り返り（直近7日）】\nまだ記録がありません。";
  }

  return lines.join("\n");
}

async function handleTextMessage(event: TextMessageEvent) {
  const text = event.message.text.trim();
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  if (isListCommand(text)) {
    const reflections = await getRecentReflections(userId, 7);
    const summary = formatSummary(reflections);
    await lineClient.replyMessage(event.replyToken, { type: "text", text: summary });
    return;
  }

  if (isHelpCommand(text)) {
    const reply = [
      "使い方：思いついたときにテキストを送るだけでOKです。",
      "音声はLINEのボイスメッセージで送ると、自動で文字起こしして記録します。",
      "「一覧」と送ると直近7日分の振り返りを返信します。",
      "患者個人情報は書かないでください。"
    ].join("\n");
    await lineClient.replyMessage(event.replyToken, { type: "text", text: reply });
    return;
  }

  if (isTextStartCommand(text)) {
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "そのまま文章を送ってください。ザックリでOKです。患者個人情報は書かないでください。",
    });
    return;
  }

  if (isVoiceStartCommand(text)) {
    await lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "LINEのマイクからボイスメッセージを送ってください。送信後に文字起こしして記録します。患者個人情報は話さないでください。",
    });
    return;
  }

  const { reflection, saved } = await recordReflection({
    id: event.message.id,
    lineUserId: userId,
    rawText: text,
    source: "text",
  });

  const labels = categoryNames(reflection.categories);
  const reply = saved
    ? `了解！記録したよ。${labels.join("＆")}で残しておくね`
    : "同じ投稿はすでに記録済みです。";
  await lineClient.replyMessage(event.replyToken, { type: "text", text: reply });
}

async function handleAudioMessage(event: AudioMessageEvent) {
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  await lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: "音声を受け取りました。文字起こしして記録します。",
  });

  try {
    const content = await lineClient.getMessageContent(event.message.id);
    const audioBuffer = await streamToBuffer(content);
    const transcript = await transcribeAudio(audioBuffer);
    const { reflection, saved } = await recordReflection({
      id: event.message.id,
      lineUserId: userId,
      rawText: transcript,
      source: "voice",
    });

    const labels = categoryNames(reflection.categories);
    const reply = saved
      ? `了解！記録したよ。${labels.join("＆")}で残しておくね\n文字起こし：${reflection.cleanedText || reflection.rawText}`
      : "同じ音声はすでに記録済みです。";
    await lineClient.pushMessage(userId, { type: "text", text: reply });
  } catch (error) {
    console.error(error);
    await lineClient.pushMessage(userId, {
      type: "text",
      text: "音声の文字起こしに失敗しました。短めに録り直すか、文字で送ってください。",
    });
  }
}

async function handlePostbackEvent(event: PostbackEvent) {
  const reply = await handleFollowupPostback(event.postback.data);
  if (reply && event.replyToken) {
    await lineClient.replyMessage(event.replyToken, { type: "text", text: reply });
  }
}

async function handleFollowEvent(event: WebhookEvent) {
  if (event.type !== "follow") {
    return;
  }

  const text = [
    "友だち追加ありがとうございます！\n思いついたときに送るだけで振り返りを記録できます。",
    "文字はそのまま送信、音声はLINEのボイスメッセージで送信できます。",
    "「一覧」と送ると直近7日分の振り返りをお届けします。",
    "患者個人情報は書かないでください。"
  ].join("\n");

  if (event.replyToken) {
    await lineClient.replyMessage(event.replyToken, { type: "text", text });
  }
}

router.post("/", async (req: Request, res: Response) => {
  const events = Array.isArray(req.body?.events) ? req.body.events as WebhookEvent[] : [];

  await Promise.all(events.map(async (event) => {
    try {
      if (event.type === "message" && event.message.type === "text") {
        await handleTextMessage(event as TextMessageEvent);
      } else if (event.type === "message" && event.message.type === "audio") {
        await handleAudioMessage(event as AudioMessageEvent);
      } else if (event.type === "postback") {
        await handlePostbackEvent(event as PostbackEvent);
      } else if (event.type === "follow") {
        await handleFollowEvent(event);
      }
    } catch (error) {
      console.error(error);
      if ("replyToken" in event && event.replyToken) {
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: "処理中に失敗しました。少し時間をおいて再度送ってください。",
        }).catch((replyError) => console.error(replyError));
      }
    }
  }));

  res.status(200).send("OK");
});

export { router as lineRouter };
