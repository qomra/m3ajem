# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Configure API Keys

```bash
cd server
cp .env.example .env
```

Edit `.env` and add your OpenAI API key (minimum required):

```env
DEFAULT_PROVIDER=openai
OPENAI_API_KEY=sk-your-actual-openai-key-here
```

### 2. Deploy

```bash
./deploy.sh up
```

That's it! The server is now running at `http://localhost:8000`

### 3. Test It

```bash
curl http://localhost:8000/health
```

You should see: `{"status":"healthy"}`

## 📊 Common Commands

```bash
# View logs
./deploy.sh logs

# Stop server
./deploy.sh down

# Restart server
./deploy.sh restart

# Access database
./deploy.sh db

# Run tests
./deploy.sh test

# Clean everything (removes all data)
./deploy.sh clean
```

## 🌍 Deploy to Production

### Railway (Recommended - 5 minutes)

1. Push to GitHub:
   ```bash
   git add server/
   git commit -m "Add gateway server"
   git push
   ```

2. Go to [Railway](https://railway.app) and click "New Project"

3. Select "Deploy from GitHub repo" → choose your repo

4. Configure:
   - Root directory: `/server`
   - Add PostgreSQL database (from Railway dashboard)
   - Add environment variables (copy from `.env`)

5. Deploy! Railway gives you a URL like:
   `https://m3ajem-gateway.up.railway.app`

### Fly.io (Alternative)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (from server folder)
cd server
fly launch

# Deploy
fly deploy
```

## 🔧 Configuration

### Add More Providers

Edit `.env` to add Anthropic, Groq, or Google:

```env
# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Groq (Cheaper!)
GROQ_API_KEY=gsk_your-key-here
GROQ_MODEL=llama-3.3-70b-versatile

# Google Gemini
GOOGLE_API_KEY=your-key-here
GOOGLE_MODEL=gemini-2.0-flash-exp
```

Change default provider:
```env
DEFAULT_PROVIDER=groq  # or anthropic, google
```

### Connect React Native App

Update your app to use the gateway:

```typescript
// Instead of calling OpenAI directly:
const response = await fetch('https://your-gateway.railway.app/chat', {
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

## 📈 Monitoring

### View Recent Conversations

```bash
curl http://localhost:8000/conversations?limit=10
```

### View Specific Conversation

```bash
curl http://localhost:8000/conversations/{conversation_id}
```

### Database Queries

```bash
./deploy.sh db

# Then inside PostgreSQL:
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM tool_calls;
```

## 💰 Cost Estimates

**Hosting (Railway)**: ~$5/month
**LLM API Costs (for 1000 messages/month)**:
- OpenAI GPT-4o: ~$15-20
- Groq Llama: ~$0.50 (much cheaper!)
- Google Gemini: Free tier available

**Total**: $5-25/month depending on usage

## ❓ Troubleshooting

### Server won't start

```bash
# Check logs
./deploy.sh logs

# Check if PostgreSQL is running
docker ps | grep postgres

# Restart everything
./deploy.sh restart
```

### Database connection error

```bash
# Check DATABASE_URL in .env
# Should be: postgresql://postgres:postgres@db:5432/m3ajem_gateway

# Recreate database
./deploy.sh down
./deploy.sh up
```

### API calls failing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Check API keys are set
docker-compose exec app env | grep API_KEY

# Check provider is correct
curl http://localhost:8000/
```

## 📚 More Info

- Full documentation: see `README.md`
- API reference: visit `http://localhost:8000/docs` (Swagger UI)
- Redoc: visit `http://localhost:8000/redoc`
