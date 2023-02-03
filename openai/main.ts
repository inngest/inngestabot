import { load as loadEnv } from "https://deno.land/std@0.176.0/dotenv/mod.ts";
import { serve } from "https://deno.land/std@0.176.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { Inngest } from "https://esm.sh/inngest@0.10.0-next.7";
import type { Events, ReplyPayload } from "../inngest/main.ts";

/**
 * Load environment variables from .env file in development.
 */
if (!Deno.env.get("DENO_DEPLOYMENT_ID")) {
  await loadEnv({ export: true });
}

const inngest = new Inngest<Events>({ name: "Inngestabot OpenAI" });

const payloadSchema = z.object({
  message: z.string().min(1).max(1024),
});

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") as string;

const headers = new Headers();
headers.set("Access-Control-Allow-Origin", "*");
headers.set("Access-Control-Allow-Headers", "Content-Type");
headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
headers.set("Content-Type", "text/plain");

serve(async (req) => {
  if (!["POST", "OPTIONS"].includes(req.method)) {
    return new Response("Invalid request", {
      status: 405,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers,
    });
  }

  let payload: z.output<typeof payloadSchema>;

  try {
    payload = payloadSchema.parse(await req.json());
  } catch (err) {
    console.warn("Bad input:", err);

    return new Response("Invalid request", {
      status: 400,
      headers,
    });
  }

  const reply = await generateReply(payload.message);

  await inngest.send("inngestabot/reply.generated", {
    data: { prompt: payload.message, reply },
    user: { authorId: "" },
  });

  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify({ reply } as ReplyPayload), {
    headers,
  });
});

const generateReply = async (message: string): Promise<string> => {
  const prompt = codePrompt(message);

  const body = {
    model: "code-davinci-002",
    temperature: 0,
    max_tokens: 1024,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stop: ["User prompt:"],
    prompt,
  };

  const res = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  const choice = json.choices?.[0]?.text?.trim();

  if (!choice) {
    throw new Error("No completion choice returned from OpenAI");
  }

  return `\`\`\`ts
inngest.createFunction(
  { name: "${choice}`;
};

export const codePrompt = (
  message: string
): string => `I am a bot that generates code snippets for Inngest functions. I show users how to write Inngest functions, use \`step\` tools, and send events to Inngest.

User prompt: ${message}

Bot: `;
