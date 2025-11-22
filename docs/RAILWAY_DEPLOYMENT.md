# Railway Deployment Guide

## 🚂 Railway Setup - Step by Step

### 1. Create Railway Account (1 minute)

1. Go to **https://railway.app**
2. Click **"Login"** or **"Start a New Project"**
3. Sign in with **GitHub** (easiest - auto-connects your repos)
   - Railway will ask for GitHub permissions
   - Allow access to your repositories

### 2. Get $5 Free Credit

Railway gives you **$5 in free credits** to start. After that:
- **Developer Plan**: $5/month (what you'll need)
- Includes: 512MB RAM, shared CPU, 1GB storage
- PostgreSQL included

### 3. Deploy Your Server (5 minutes)

**Before deploying, prepare your code:**

```bash
# First, commit your server code
git add server/
git commit -m "Add gateway server"
git push origin main
```

**Now deploy:**

1. **Go to Railway Dashboard**: https://railway.app/dashboard

2. **Click "New Project"**

3. **Choose "Deploy from GitHub repo"**
   - Select your `m3ajem` repository
   - Railway will detect it automatically

4. **Configure the Service (IMPORTANT!):**
   - ⚠️ **CRITICAL**: Set **Root Directory** to `server` (in Settings → Service Settings)
   - Without this, Railway will try to build the React Native app instead of Python server!
   - Railway should auto-detect the Dockerfile
   - If asked about build method, choose **"Dockerfile"**

5. **Add PostgreSQL Database:**
   - In your project, click **"+ New"**
   - Select **"Database"** → **"Add PostgreSQL"**
   - Railway automatically creates it and sets `DATABASE_URL`

6. **Add Environment Variables:**
   - Go to your app service (the one with your code)
   - Click on **"Variables"** tab
   - Add your API keys one by one:

   ```
   DEFAULT_PROVIDER = openai
   OPENAI_API_KEY = sk-your-actual-key-here
   OPENAI_MODEL = gpt-4o
   ```

   Optional (if you have them):
   ```
   ANTHROPIC_API_KEY = sk-ant-...
   GROQ_API_KEY = gsk_...
   GOOGLE_API_KEY = ...
   ```

   **Note**: Railway automatically sets `DATABASE_URL` for you!

7. **Deploy:**
   - Railway auto-deploys when you push to GitHub
   - Or click **"Deploy"** manually
   - Wait 2-3 minutes for build

8. **Get Your Public URL:**
   - Go to **"Settings"** tab
   - Click **"Generate Domain"**
   - You'll get a URL like: `https://m3ajem-gateway-production.up.railway.app`

### 4. Test It

```bash
# Replace with your Railway URL
curl https://your-app.up.railway.app/health
```

You should see: `{"status":"healthy"}`

## 📸 Visual Guide

Here's what you'll see:

1. **Railway Dashboard** → Click "New Project"
2. **Deploy from GitHub** → Select `m3ajem` repo
3. **Root Directory** → Type `server`
4. **Add PostgreSQL** → Click "+ New" → "Database" → "PostgreSQL"
5. **Variables** → Add `OPENAI_API_KEY`, etc.
6. **Settings** → "Generate Domain" → Get public URL

## 💰 Billing

**Free Trial:**
- $5 in credits (lasts ~1 month with light usage)

**After Trial:**
- $5/month Developer Plan
- Billed based on usage (RAM, CPU, storage)
- PostgreSQL included
- No hidden fees

**To add payment:**
- Go to Account → Billing
- Add credit card (they'll charge $5/month)

## 🔄 Auto-Deployment

Once set up, **Railway auto-deploys** whenever you push to GitHub:

```bash
# Make changes to server
vim server/main.py

# Commit and push
git add server/
git commit -m "Update server"
git push

# Railway automatically rebuilds and deploys!
```

## 🐛 Troubleshooting

### "npm error" or "node_modules" errors
**This means Railway is building from the wrong directory!**
- Go to **Settings** → **Service Settings**
- Set **Root Directory** to `server`
- Redeploy
- Railway was trying to build the React Native app instead of the Python server

### "Build Failed"
- Check Railway logs (click on deployment)
- Make sure `Dockerfile` is in `server/` folder
- Verify Root Directory is set to `server` (most common issue!)

### "Database connection error"
- Railway sets `DATABASE_URL` automatically
- Make sure PostgreSQL service is running
- Check Variables tab - `DATABASE_URL` should be there

### "Can't access logs"
- Go to your deployment
- Click on **"Deployments"** tab
- Click latest deployment → View logs

## 📊 Monitor Your Server

Railway dashboard shows:
- **Metrics**: CPU, RAM, Network usage
- **Logs**: Real-time server logs
- **Deployments**: History of all deploys
- **Database**: PostgreSQL metrics

## 🎯 Next Steps After Deployment

Once deployed, update your React Native app to use the Railway URL:

```typescript
// In your app's API config
const GATEWAY_URL = 'https://your-app.up.railway.app';

// Use it instead of direct LLM calls
fetch(`${GATEWAY_URL}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: conversationId,
    message: userMessage,
    messages: messageHistory,
    tools: tools,
    system_prompt: systemPrompt,
  }),
});
```

---

## Quick Checklist

- [ ] Sign up at railway.app with GitHub
- [ ] Push server code to GitHub
- [ ] Create new Railway project from GitHub repo
- [ ] Set root directory to `server`
- [ ] Add PostgreSQL database
- [ ] Add `OPENAI_API_KEY` in Variables
- [ ] Generate domain
- [ ] Test with curl
- [ ] Add credit card for $5/month plan

## Why Railway Over Serverless?

**Railway (Container-based):**
- ✅ **Always-on** - No cold starts
- ✅ **Persistent connections** - Keep database connections open
- ✅ **Fixed monthly cost** - Predictable billing (~$5/month)
- ✅ **No timeout limits** - LLM calls can take 30+ seconds
- ❌ Doesn't scale to zero

**Perfect for chat apps like M3ajem!**

## Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Status Page: https://status.railway.app
