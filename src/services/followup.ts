import { Client, Message, TemplateMessage } from "@line/bot-sdk";
import cron from "node-cron";
import { env } from "../utils/env";
import { Reflection } from "../models/reflection";
import { getOpenNextReflections, updateReflectionFollowUpStatus } from "./sheets";

const lineClient = new Client({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });

const MAX_ITEMS_PER_USER = 4;

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function buildItemMessage(reflection: Reflection): TemplateMessage {
  const text = truncate(reflection.cleanedText || reflection.rawText, 120);
  return {
    type: "template",
    altText: `次やりたいことチェック：${truncate(text, 60)}`,
    template: {
      type: "buttons",
      text: `「${text}」\nこれ、どうなった？`,
      actions: [
        {
          type: "postback",
          label: "やった！",
          data: `action=followup&status=done&id=${reflection.id}`,
          displayText: "やった！",
        },
        {
          type: "postback",
          label: "まだこれから",
          data: `action=followup&status=later&id=${reflection.id}`,
          displayText: "まだこれから",
        },
        {
          type: "postback",
          label: "もうやらない",
          data: `action=followup&status=dismissed&id=${reflection.id}`,
          displayText: "もうやらない",
        },
      ],
    },
  };
}

export async function runNextFollowup(): Promise<{ users: number; items: number }> {
  const openItems = await getOpenNextReflections(env.FOLLOWUP_LOOKBACK_DAYS);

  const byUser = new Map<string, Reflection[]>();
  openItems.forEach((item) => {
    if (!item.lineUserId) {
      return;
    }
    const list = byUser.get(item.lineUserId) || [];
    list.push(item);
    byUser.set(item.lineUserId, list);
  });

  let users = 0;
  let items = 0;

  for (const [userId, reflections] of byUser) {
    const sorted = [...reflections].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const asked = sorted.slice(0, MAX_ITEMS_PER_USER);
    const remainder = sorted.length - asked.length;

    const introLines = ["【次やりたいことチェック】", "前に記録した「次やりたいこと」、その後どうなった？"];
    if (remainder > 0) {
      introLines.push(`（ほかにも${remainder}件あるよ。次回また聞くね）`);
    }

    const messages: Message[] = [
      { type: "text", text: introLines.join("\n") },
      ...asked.map(buildItemMessage),
    ];

    try {
      await lineClient.pushMessage(userId, messages);
      users += 1;
      items += asked.length;
    } catch (error) {
      console.error(`Failed to push follow-up to ${userId}`, error);
    }
  }

  return { users, items };
}

export async function handleFollowupPostback(data: string): Promise<string | null> {
  const params = new URLSearchParams(data);
  if (params.get("action") !== "followup") {
    return null;
  }

  const id = params.get("id");
  const status = params.get("status");
  if (!id || !status) {
    return null;
  }

  if (status === "done") {
    const updated = await updateReflectionFollowUpStatus(id, "done");
    return updated
      ? "ナイス！完了にしたよ。やってみて学んだことがあれば、そのまま送ってね"
      : "この項目が見つからなかった…すでに整理済みかも。";
  }

  if (status === "dismissed") {
    const updated = await updateReflectionFollowUpStatus(id, "dismissed");
    return updated ? "了解、この項目はクローズしたよ。" : "この項目が見つからなかった…すでに整理済みかも。";
  }

  if (status === "later") {
    return "OK！また今度聞くね";
  }

  return null;
}

export function startFollowupScheduler() {
  if (!env.FOLLOWUP_CRON || env.FOLLOWUP_CRON === "off") {
    console.log("Follow-up scheduler is disabled (FOLLOWUP_CRON=off)");
    return;
  }

  if (!cron.validate(env.FOLLOWUP_CRON)) {
    console.error(`Invalid FOLLOWUP_CRON expression: ${env.FOLLOWUP_CRON}`);
    return;
  }

  cron.schedule(
    env.FOLLOWUP_CRON,
    async () => {
      try {
        const result = await runNextFollowup();
        console.log(`Follow-up sent: ${result.items} items to ${result.users} users`);
      } catch (error) {
        console.error("Follow-up run failed", error);
      }
    },
    { timezone: env.FOLLOWUP_TIMEZONE }
  );
  console.log(`Follow-up scheduler started (${env.FOLLOWUP_CRON} ${env.FOLLOWUP_TIMEZONE})`);
}
