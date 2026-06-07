import { AzureOpenAI } from "openai";
import { env } from "../utils/env";
import { ReflectionCategory } from "../models/reflection";

const client = new AzureOpenAI({
  apiKey: env.AZURE_OPENAI_API_KEY,
  endpoint: env.AZURE_OPENAI_ENDPOINT,
  apiVersion: env.AZURE_OPENAI_API_VERSION,
});

const categoryLabels: Record<ReflectionCategory, string> = {
  learned: "学んだこと",
  could_not: "できなかったこと",
  next: "次やりたいこと",
  moyamoya: "モヤモヤしたこと",
  other: "その他",
};

const categoryPrompt = `あなたは日本語の振り返り投稿を分類する役割を持っています。
以下のカテゴリに従って、1件の投稿から最低1つ以上のカテゴリを選び、整形されたテキストを返してください。

カテゴリ:
- 学んだこと → learned
- できなかったこと → could_not
- 次やりたいこと → next
- モヤモヤしたこと、違和感、納得できないこと、言語化しきれない引っかかり → moyamoya
- 分類できない場合はその他 → other

出力は必ず JSON 形式で、キーは "categories" と "cleaned_text" としてください。
"categories" は上記のカテゴリ列挙子の配列。
"cleaned_text" は音声認識のフィラー除去や簡易整形をした後の日本語テキストです。

例:
{"categories":["could_not","next"],"cleaned_text":"Aラインが取れなかった。次は超音波下でやる。"}
{"categories":["moyamoya"],"cleaned_text":"カンファレンスで自分の疑問をうまく出せず、少しモヤモヤした。"}

JSON以外の説明文は出力しないでください。`;

export async function classifyReflection(rawText: string): Promise<{ categories: ReflectionCategory[]; cleanedText: string }> {
  const response = await client.chat.completions.create({
    model: env.AZURE_OPENAI_DEPLOYMENT_NAME,
    messages: [
      { role: "system", content: categoryPrompt },
      { role: "user", content: `投稿本文:\n${rawText}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 256,
  });

  const outputText = response.choices[0]?.message?.content || "";

  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      categories: ["other"],
      cleanedText: rawText.trim(),
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((value: unknown) => ["learned", "could_not", "next", "moyamoya", "other"].includes(value as string))
      : [];
    return {
      categories: categories.length > 0 ? categories as ReflectionCategory[] : ["other"],
      cleanedText: typeof parsed.cleaned_text === "string" ? parsed.cleaned_text.trim() : rawText.trim(),
    };
  } catch (error) {
    return {
      categories: ["other"],
      cleanedText: rawText.trim(),
    };
  }
}

export function categoryNames(categories: ReflectionCategory[]): string[] {
  return categories.map((category) => categoryLabels[category]);
}
