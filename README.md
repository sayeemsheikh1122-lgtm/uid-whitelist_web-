# Discord License Login System

This project is a static frontend combined with a Node.js backend that stores a Discord bot token server-side and verifies one-time license codes.

## What it does

- Discord message `/genlicense` or `!genlicense` creates a new one-time license.
- Bot posts the code in the configured Discord channel.
- Website login page accepts that code in a text box.
- Backend verifies the code and marks it used.

## Required files

1. Copy `.env.example` to `.env`
2. Add your bot token and channel ID in `.env`

## Install

```bash
npm install
```

## Local setup

1. Copy `.env.example` to `.env`.
2. Open `.env` and set your Discord token:
   - `DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE`
   - `DISCORD_CHANNEL_ID=1514217948712140900`
   - `PORT=3000`
3. Run locally:

```bash
npm start
```

4. Open browser at `http://localhost:3000/login.html`

## Deploy on Render

1. Push your repo to GitHub.
2. Go to https://render.com and sign in.
3. Click `New` → `Web Service`.
4. Connect your GitHub account and choose this repo.
5. Set the following:
   - **Name**: anything like `uid-license-bot`
   - **Region**: choose the closest region
   - **Branch**: usually `main` or `master`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. In Render, go to the `Environment` tab and add these environment variables:
   - `DISCORD_TOKEN` = your bot token
   - `DISCORD_CHANNEL_ID` = `1514217948712140900`
   - `PORT` = `3000`
7. Deploy the service.
8. When deploy finishes, open the Render URL.

### How to use after deploy
- Open `https://<your-render-service>.onrender.com/login.html`
- In Discord, run `/genlicense` or `!genlicense`
- Copy the generated code
- Paste into the login box and click `LOGIN`

### Important notes
- Do not put `DISCORD_TOKEN` in frontend code.
- Render will run the Node.js backend and keep the bot online.
- If you want 24/7 uptime, use Render paid service or keep the service active.

## Discord usage

In your Discord channel, type one of these commands:

- `/genlicense`
- `!genlicense`

The bot will reply with a new code, for example `ONETIME-ABC123`.

## Website usage

- Open `index.html` or `login.html`
- Paste the code into the login box
- Click `LOGIN`
- If valid, the site redirects to `dashboard.html`
