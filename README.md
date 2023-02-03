# Inngestabot

## Prerequisites

- [Install Fly.io `flyctl`](https://fly.io/docs/hands-on/install-flyctl/)
  > `flyctl auth login`
- [Install Deno Deploy `deployctl`](https://deno.com/deploy/docs/deployctl)
  > Create a new [Deno Deploy Access Token](https://dash.deno.com/account#access-tokens) and set as `DENO_DEPLOY_TOKEN`.

## Deploying

There are three "apps":

- `bot/` - A discord bot
- `openai/` - An OpenAI reply generator
- `inngest/` - An Inngest handler

To deploy, enter a directory and run `deno task deploy`.
