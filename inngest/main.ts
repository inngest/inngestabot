import { load as loadEnv } from "https://deno.land/std@0.176.0/dotenv/mod.ts";
import { serve } from "https://deno.land/std@0.176.0/http/server.ts";
import {
  createBot,
  Intents,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import {
  Inngest,
  InngestCommHandler,
  ServeHandler,
} from "https://esm.sh/inngest@0.10.0-next.7";

/**
 * Load environment variables from .env file in development.
 */
if (!Deno.env.get("DENO_DEPLOYMENT_ID")) {
  await loadEnv({ export: true });
}

export type Events = {
  "inngestabot/message.received": {
    name: "inngestabot/message.received";
    data: {
      message: {
        channelId: string;
        id: string;
        content: string;
      };
    };
    user: {
      authorId: string;
    };
  };
  "inngestabot/reply.generated": {
    name: "inngestabot/reply.generated";
    data: {
      prompt: string;
      reply: ReplyPayload["reply"];
    };
    user: {
      authorId: string;
    };
  };
};

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN") as string;
const OPENAI_ENDPOINT = Deno.env.get("OPENAI_ENDPOINT") as string;
const THINKING_REACTION = Deno.env.get("THINKING_REACTION") as string;

const replySchema = z.object({
  reply: z.string(),
});

export type ReplyPayload = z.output<typeof replySchema>;

const bot = createBot({
  token: DISCORD_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages,
});

const inngest = new Inngest<Events>({ name: "Inngestabot" });

const handleMessage = inngest.createFunction(
  { name: "Handle Inngestabot message" },
  { event: "inngestabot/message.received" },
  async ({ event, step }) => {
    const { message } = event.data;

    await step.run("Add thinking reaction", () => {
      return bot.helpers.addReaction(
        message.channelId,
        message.id,
        THINKING_REACTION
      );
    });

    const { reply } = await step.run("Generate reply from OpenAI", async () => {
      const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.content }),
      });

      const json = await res.json();
      const parsed = replySchema.parse(json);

      return parsed;
    });

    await step.run("Send reply to Discord", async () => {
      await bot.helpers.sendMessage(message.channelId, {
        messageReference: {
          messageId: message.id,
          failIfNotExists: true,
        },
        content: reply,
      });
    });

    // Remove the thinking reaction. This is a no-op if the reaction was never
    // added.
    await step.run("Remove thinking reaction", () => {
      return bot.helpers.deleteOwnReaction(
        message.channelId,
        message.id,
        THINKING_REACTION
      );
    });
  }
);

const inngestServe: ServeHandler = (nameOrInngest, fns, opts) => {
  return new InngestCommHandler(
    "deno",
    nameOrInngest,
    fns,
    opts,
    (req: Request) => {
      const url = new URL(req.url, `https://${req.headers.get("host") || ""}`);
      const env = Deno.env.toObject();
      const isProduction = true;

      return {
        register: () => {
          if (req.method === "PUT") {
            return {
              env,
              isProduction,
              url,
              deployId: url.searchParams.get("deployId"),
            };
          }
        },
        run: async () => {
          if (req.method === "POST") {
            return {
              data: (await req.json()) as Record<string, any>,
              env,
              fnId: url.searchParams.get("fnId") as string,
              stepId: url.searchParams.get("stepId") as string,
              url,
              isProduction,
            };
          }
        },
        view: () => {
          if (req.method === "GET") {
            return {
              env,
              isIntrospection: url.searchParams.has("introspect"),
              url,
              isProduction,
            };
          }
        },
      };
    },
    ({ body, status, headers }): Response => {
      return new Response(body, { status, headers });
    }
  ).createHandler();
};

serve(inngestServe(inngest, [handleMessage]));
