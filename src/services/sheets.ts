import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { env } from "../utils/env";
import { Reflection, ReflectionCategory } from "../models/reflection";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getSheetName() {
  return env.GOOGLE_SHEETS_RANGE.split("!")[0] || "reflections";
}

function getFixedRange() {
  return `${getSheetName()}!A:I`;
}

function getAuthClient() {
  const credentials = getGoogleCredentials();
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

function getGoogleCredentials() {
  if (env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
    return JSON.parse(env.GOOGLE_SHEETS_CREDENTIALS_JSON);
  }

  if (env.GOOGLE_SHEETS_CREDENTIALS_BASE64) {
    return JSON.parse(Buffer.from(env.GOOGLE_SHEETS_CREDENTIALS_BASE64, "base64").toString("utf-8"));
  }

  const absolutePath = path.isAbsolute(env.GOOGLE_SHEETS_CREDENTIALS_PATH)
    ? env.GOOGLE_SHEETS_CREDENTIALS_PATH
    : path.join(process.cwd(), env.GOOGLE_SHEETS_CREDENTIALS_PATH);
  const content = fs.readFileSync(absolutePath, "utf-8");
  return JSON.parse(content);
}

export async function appendReflection(reflection: Reflection): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const existingRows = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: getFixedRange(),
  });
  const nextRow = (existingRows.data.values || []).length + 1;

  const values = [
    reflection.id,
    reflection.lineUserId,
    reflection.displayName || "",
    reflection.createdAt,
    reflection.source,
    reflection.rawText,
    reflection.cleanedText || "",
    reflection.categories.join(","),
    reflection.isShared ? "TRUE" : "FALSE",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${getSheetName()}!A${nextRow}:I${nextRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
}

function parseReflectionRow(row: unknown[]): Reflection | null {
  const id = String(row[0] || "");
  if (!id || id === "id") {
    return null;
  }

  const categories = String(row[7] || "")
    .split(",")
    .filter((value): value is ReflectionCategory => ["learned", "could_not", "next", "moyamoya", "other"].includes(value));

  return {
    id,
    lineUserId: String(row[1] || ""),
    displayName: String(row[2] || ""),
    createdAt: String(row[3] || ""),
    source: String(row[4]) === "voice" ? "voice" : "text",
    rawText: String(row[5] || ""),
    cleanedText: String(row[6] || ""),
    categories,
    isShared: String(row[8]).toLowerCase() === "true",
  };
}

async function getAllReflections(): Promise<Reflection[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: getFixedRange(),
  });

  const rows = response.data.values || [];
  return rows.map(parseReflectionRow).filter((item): item is Reflection => item !== null);
}

export async function hasReflection(id: string): Promise<boolean> {
  const rows = await getAllReflections();
  return rows.some((item) => item.id === id);
}

export async function appendReflectionIfNew(reflection: Reflection): Promise<boolean> {
  if (await hasReflection(reflection.id)) {
    return false;
  }
  await appendReflection(reflection);
  return true;
}

export async function getRecentReflections(lineUserId: string, days: number) {
  const rows = await getAllReflections();
  const now = new Date();
  const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return rows
    .filter((item) => item.lineUserId === lineUserId)
    .filter((item) => {
      const postedAt = new Date(item.createdAt);
      return !Number.isNaN(postedAt.getTime()) && postedAt >= threshold;
    });
}
