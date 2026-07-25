import express, { Request, Response } from "express";
import { Client } from "@line/bot-sdk";
import { categoryNames } from "../services/llm";
import { recordReflection } from "../services/reflections";
import { runNextFollowup } from "../services/followup";
import { env } from "../utils/env";

const router = express.Router();
const lineClient = new Client({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });

function confirmationText(categories: string[]) {
  const labels = categoryNames(categories as Parameters<typeof categoryNames>[0]);
  return `了解！記録したよ。${labels.join("＆")}で残しておくね`;
}

async function issueAzureSpeechToken() {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    throw new Error("Azure Speech env vars are not configured");
  }

  const response = await fetch(`https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
      "Content-Length": "0",
    },
  });

  if (!response.ok) {
    throw new Error(`Azure Speech token request failed: ${response.status}`);
  }

  return response.text();
}

router.get("/azure-speech-token", async (_req: Request, res: Response) => {
  try {
    const token = await issueAzureSpeechToken();
    res.json({ token, region: env.AZURE_SPEECH_REGION });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "音声認識を利用できません。キーボード入力を使ってください。" });
  }
});

router.get("/config", (_req: Request, res: Response) => {
  res.json({ liffId: env.LIFF_ID || "" });
});

router.post("/reflections", async (req: Request, res: Response) => {
  try {
    const { lineUserId, displayName, text, source } = req.body as {
      lineUserId?: string;
      displayName?: string;
      text?: string;
      source?: "text" | "voice";
    };

    if (!lineUserId || !text?.trim()) {
      res.status(400).json({ error: "lineUserId and text are required" });
      return;
    }

    const { reflection } = await recordReflection({
      lineUserId,
      displayName,
      rawText: text,
      source: source || "voice",
    });

    const message = confirmationText(reflection.categories);
    await lineClient.pushMessage(lineUserId, { type: "text", text: message });
    res.json({ reflection, message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "記録できませんでした。少し時間をおいて再度送ってください。" });
  }
});

router.post("/followup/run", async (req: Request, res: Response) => {
  try {
    if (!env.FOLLOWUP_SECRET) {
      res.status(503).json({ error: "FOLLOWUP_SECRET is not configured" });
      return;
    }
    if (req.header("x-followup-secret") !== env.FOLLOWUP_SECRET) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const result = await runNextFollowup();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "follow-up run failed" });
  }
});

export { router as apiRouter };
