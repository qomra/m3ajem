# M3ajem Admin Dashboard

Admin dashboard to monitor database and API status.

## Features

- View total users, active users, conversations, messages
- Check API provider status (OpenAI, Anthropic, Groq)
- See top users by daily requests
- View recent conversations
- Protected by HTTP Basic Authentication

## Railway Deployment

1. Create a new service in Railway
2. Connect your GitHub repo
3. Set root directory to `admin`
4. Set the following environment variables:

```env
DATABASE_URL=<same as main server>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
GROQ_API_KEY=<your-key>
```

4. Deploy

## Local Development

```bash
cd admin
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="test123"
python main.py
```

Then open http://localhost:8001

## Endpoints

- `GET /` - HTML Dashboard (requires auth)
- `GET /api/stats` - JSON stats (requires auth)
- `GET /api/health` - JSON API health (requires auth)
- `GET /health` - Public health check
