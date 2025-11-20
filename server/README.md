# M3ajem Chat Gateway Server

A FastAPI-based gateway server that provides managed LLM access for M3ajem app users without requiring their own API keys. The server intercepts, logs, and forwards all chat communications to various LLM providers.

## Features

- **Multi-Provider Support**: OpenAI, Anthropic, Groq, and Google Gemini
- **Conversation Logging**: PostgreSQL database stores all conversations, messages, and tool calls
- **Gateway Pattern**: Transparent proxy that logs but doesn't interfere with functionality
- **Docker Ready**: Complete containerization with docker-compose
- **Health Monitoring**: Built-in health check and conversation monitoring endpoints

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   M3ajem    │─────▶│  Gateway Server  │─────▶│ LLM Provider│
│     App     │      │  (logs to DB)    │      │ (OpenAI/etc)│
└─────────────┘      └──────────────────┘      └─────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │  PostgreSQL  │
                      │   Database   │
                      └──────────────┘
```

## Quick Start

### 1. Setup Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
DEFAULT_PROVIDER=openai
OPENAI_API_KEY=sk-your-actual-key-here
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
GROQ_API_KEY=gsk_your-actual-key-here
GOOGLE_API_KEY=your-actual-key-here
```

### 2. Run with Docker Compose

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop services
docker-compose down
```

The server will be available at `http://localhost:8000`

### 3. Test the Server

```bash
# Health check
curl http://localhost:8000/health

# Test chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test-123",
    "message": "ما معنى كلمة سلام؟",
    "messages": [{"role": "user", "content": "ما معنى كلمة سلام؟"}],
    "provider": "openai"
  }'
```

## API Endpoints

### POST /chat
Main gateway endpoint for chat requests.

**Request:**
```json
{
  "conversation_id": "optional-uuid",
  "message": "User's message",
  "messages": [
    {"role": "user", "content": "message 1"},
    {"role": "assistant", "content": "response 1"}
  ],
  "tools": [],  // Optional tool definitions
  "system_prompt": "Optional system prompt",
  "provider": "openai"  // Optional, defaults to DEFAULT_PROVIDER
}
```

**Response:**
```json
{
  "message_id": "123",
  "content": "Assistant's response",
  "tool_calls": [],
  "thoughts": [],
  "sources": []
}
```

### GET /health
Health check endpoint.

### GET /conversations
Get recent conversations (monitoring).

**Query Parameters:**
- `limit` (default: 50): Number of conversations to return

### GET /conversations/{conversation_id}
Get full conversation details with all messages and tool calls.

## Database Schema

### Tables

1. **conversations**
   - `id`: Conversation UUID (primary key)
   - `provider`: LLM provider used
   - `created_at`: Timestamp

2. **messages**
   - `id`: Auto-increment ID (primary key)
   - `conversation_id`: Foreign key to conversations
   - `role`: user or assistant
   - `content`: Message text
   - `timestamp`: Timestamp

3. **tool_calls**
   - `id`: Auto-increment ID (primary key)
   - `message_id`: Foreign key to messages
   - `tool_name`: Name of the tool called
   - `arguments`: JSON string of arguments
   - `result`: JSON string of result
   - `timestamp`: Timestamp

## Deployment Options

### Recommended Hosting Providers (Cheap & Lightweight)

#### 1. **Railway** (Recommended)
- **Cost**: ~$5/month for starter plan
- **Pros**:
  - Easy deployment from GitHub
  - Built-in PostgreSQL
  - Free SSL
  - Auto-deploys on push
- **Setup**: Connect GitHub repo, Railway auto-detects Docker
- **Link**: https://railway.app

#### 2. **Fly.io**
- **Cost**: ~$3-5/month (pay-as-you-go)
- **Pros**:
  - Global CDN
  - Free PostgreSQL up to 3GB
  - Excellent documentation
- **Setup**:
  ```bash
  fly launch
  fly deploy
  ```
- **Link**: https://fly.io

#### 3. **Render**
- **Cost**: Free tier available, paid starts at $7/month
- **Pros**:
  - Free tier for testing
  - Built-in PostgreSQL
  - Auto SSL
- **Link**: https://render.com

#### 4. **DigitalOcean App Platform**
- **Cost**: ~$5/month for basic
- **Pros**:
  - Simple interface
  - Managed PostgreSQL available
  - Scales well
- **Link**: https://www.digitalocean.com/products/app-platform

#### 5. **AWS Lightsail** (If you need more control)
- **Cost**: ~$5/month for 1GB instance
- **Pros**:
  - Fixed pricing
  - Full VM control
  - AWS ecosystem
- **Setup**: Deploy Docker container to Lightsail

### Deployment Steps (Railway Example)

1. **Push to GitHub**
   ```bash
   git add server/
   git commit -m "Add gateway server"
   git push
   ```

2. **Create Railway Project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your m3ajem repository

3. **Configure Service**
   - Railway auto-detects Dockerfile
   - Set root directory to `/server`
   - Add PostgreSQL database from Railway dashboard

4. **Set Environment Variables**
   - In Railway dashboard, go to Variables
   - Add all API keys from `.env.example`
   - Railway will automatically set `DATABASE_URL`

5. **Deploy**
   - Railway automatically deploys
   - Get your public URL (e.g., `https://m3ajem-gateway.up.railway.app`)

6. **Update App Configuration**
   - Update your React Native app to point to this URL instead of direct LLM calls

## Monitoring

### View Logs
```bash
# Docker Compose
docker-compose logs -f app

# Railway
# Use Railway dashboard or CLI: railway logs
```

### Database Access
```bash
# Connect to PostgreSQL locally
docker exec -it m3ajem_gateway_db psql -U postgres -d m3ajem_gateway

# Query conversations
SELECT id, provider, created_at FROM conversations ORDER BY created_at DESC LIMIT 10;

# Query messages for a conversation
SELECT role, content, timestamp FROM messages WHERE conversation_id = 'your-id' ORDER BY timestamp;
```

### API Monitoring
```bash
# Get recent conversations
curl http://localhost:8000/conversations?limit=10

# Get specific conversation
curl http://localhost:8000/conversations/{conversation_id}
```

## Security Considerations

1. **API Keys**: Never commit `.env` file. Keep API keys secure.
2. **CORS**: Update CORS settings in `main.py` for production (line 24)
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **Authentication**: Add API authentication if needed for the app
5. **Database Backups**: Enable automated backups on your hosting provider

## Scaling

For higher traffic:

1. **Horizontal Scaling**: Deploy multiple app containers behind a load balancer
2. **Database**: Use managed PostgreSQL (AWS RDS, Railway PostgreSQL, etc.)
3. **Caching**: Add Redis for frequently accessed data
4. **CDN**: Use CloudFlare in front of your API

## Development

### Local Development (without Docker)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run PostgreSQL (separate terminal)
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/m3ajem_gateway"
export OPENAI_API_KEY="your-key"
# ... other vars

# Run server
uvicorn main:app --reload
```

### Running Tests

```bash
# TODO: Add pytest tests
pytest tests/
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### API Key Issues
```bash
# Verify environment variables are loaded
docker-compose exec app env | grep API_KEY

# Check provider configuration
curl http://localhost:8000/
```

## Cost Estimation

For ~1000 users with moderate usage:

- **Hosting**: $5-10/month (Railway/Fly.io)
- **Database**: Included in hosting or $5/month
- **LLM API Costs**:
  - OpenAI GPT-4o: ~$15-30/month for 10k requests
  - Groq (Llama): ~$0.50/month (much cheaper)
  - Google Gemini: Free tier available

**Total**: $10-40/month depending on usage

## License

Part of the M3ajem project.
