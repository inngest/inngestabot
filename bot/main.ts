import type { Events } from "../inngest/main.ts";
import { createBot, Inngest, Intents, startBot } from "./deps.ts";

const bot = createBot({
  token: Deno.env.get("DISCORD_TOKEN") as string,
  intents: Intents.Guilds | Intents.GuildMessages,
});

const inngest = new Inngest<Events>({ name: "Discord Bot" });

bot.events.ready = (_b, _payload) => {
  console.log("[START] Successfully connected to gateway");
};

bot.events.messageCreate = async (_b, message) => {
  const log = (...args: unknown[]) => console.log(`[${message.id}]`, ...args);

  if (message.isFromBot) {
    log("Message from bot; ignoring");
    return;
  }

  const didMentionBot = message.mentionedUserIds.includes(bot.id);
  if (!didMentionBot) {
    log("Message did not mention bot");
    return;
  }

  log("Message to bot received; sending event to Inngest");
  const payload = { ...message };
  payload.content = message.content.replace(/<@!?\d+>/g, "").trim();

  await inngest.send("inngestabot/message.received", {
    data: {
      message: {
        channelId: message.channelId.toString(),
        content: payload.content,
        id: message.id.toString(),
      },
    },
    user: {
      authorId: message.authorId.toString(),
    },
  });
};

await startBot(bot);
