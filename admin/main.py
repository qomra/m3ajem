"""
M3ajem Admin Dashboard
======================
A simple admin tool to inspect database and API status.
Protected by basic authentication.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import HTMLResponse
import secrets
import os
import httpx
from datetime import datetime, timedelta
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection (standalone - no server dependencies)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL not set!")

engine = create_engine(DATABASE_URL) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine) if engine else None

# Auth credentials from environment
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    logger.warning("ADMIN_PASSWORD not set! Using insecure default.")
    ADMIN_PASSWORD = "changeme"

# API Keys for checking credits
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI(title="M3ajem Admin", docs_url=None, redoc_url=None)
security = HTTPBasic()


def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    """Verify admin credentials"""
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)

    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def get_db():
    if not SessionLocal:
        raise HTTPException(status_code=500, detail="Database not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/", response_class=HTMLResponse)
async def dashboard(username: str = Depends(verify_credentials)):
    """Main dashboard - HTML view"""

    # Get stats
    stats = await get_stats_data()
    api_status = await check_api_credits()

    html = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>M3ajem Admin</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: #f5f5f5;
            }}
            h1 {{ color: #0C2B19; }}
            .card {{
                background: white;
                border-radius: 8px;
                padding: 20px;
                margin: 10px 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            .stat {{
                display: inline-block;
                margin: 10px 20px;
                text-align: center;
            }}
            .stat-value {{
                font-size: 2em;
                font-weight: bold;
                color: #0C2B19;
            }}
            .stat-label {{
                color: #666;
            }}
            .status-ok {{ color: green; }}
            .status-warn {{ color: orange; }}
            .status-error {{ color: red; }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            th, td {{
                padding: 10px;
                text-align: right;
                border-bottom: 1px solid #eee;
            }}
            th {{ background: #f9f9f9; }}
            .refresh-btn {{
                background: #0C2B19;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
            }}
        </style>
    </head>
    <body>
        <h1>لوحة تحكم المعجم</h1>
        <button class="refresh-btn" onclick="location.reload()">تحديث</button>

        <div class="card">
            <h2>إحصائيات عامة</h2>
            <div class="stat">
                <div class="stat-value">{stats['total_users']}</div>
                <div class="stat-label">المستخدمين</div>
            </div>
            <div class="stat">
                <div class="stat-value">{stats['active_today']}</div>
                <div class="stat-label">نشطين اليوم</div>
            </div>
            <div class="stat">
                <div class="stat-value">{stats['total_conversations']}</div>
                <div class="stat-label">المحادثات</div>
            </div>
            <div class="stat">
                <div class="stat-value">{stats['total_messages']}</div>
                <div class="stat-label">الرسائل</div>
            </div>
        </div>

        <div class="card">
            <h2>حالة API</h2>
            <table>
                <tr>
                    <th>المزود</th>
                    <th>الحالة</th>
                    <th>التفاصيل</th>
                </tr>
                {api_status_rows(api_status)}
            </table>
        </div>

        <div class="card">
            <h2>المستخدمين الأكثر نشاطاً اليوم</h2>
            <table>
                <tr>
                    <th>البريد</th>
                    <th>المزود</th>
                    <th>الطلبات اليوم</th>
                    <th>آخر استخدام</th>
                </tr>
                {top_users_rows(stats['top_users'])}
            </table>
        </div>

        <div class="card">
            <h2>آخر المحادثات</h2>
            <table>
                <tr>
                    <th>المعرف</th>
                    <th>المزود</th>
                    <th>عدد الرسائل</th>
                    <th>التاريخ</th>
                </tr>
                {recent_conversations_rows(stats['recent_conversations'])}
            </table>
        </div>

        <p style="color: #999; text-align: center; margin-top: 40px;">
            آخر تحديث: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
        </p>
    </body>
    </html>
    """
    return html


def api_status_rows(api_status: dict) -> str:
    rows = ""
    for provider, status in api_status.items():
        status_class = "status-ok" if status['ok'] else "status-error"
        status_text = "✓ يعمل" if status['ok'] else "✗ خطأ"
        rows += f"""
        <tr>
            <td>{provider}</td>
            <td class="{status_class}">{status_text}</td>
            <td>{status.get('detail', '-')}</td>
        </tr>
        """
    return rows


def top_users_rows(users: list) -> str:
    if not users:
        return "<tr><td colspan='4'>لا يوجد مستخدمين</td></tr>"

    rows = ""
    for user in users:
        rows += f"""
        <tr>
            <td>{user['email'][:30]}...</td>
            <td>{user['provider']}</td>
            <td>{user['daily_requests']}</td>
            <td>{user['last_used']}</td>
        </tr>
        """
    return rows


def recent_conversations_rows(conversations: list) -> str:
    if not conversations:
        return "<tr><td colspan='4'>لا يوجد محادثات</td></tr>"

    rows = ""
    for conv in conversations:
        rows += f"""
        <tr>
            <td>{str(conv['id'])[:8]}...</td>
            <td>{conv['provider']}</td>
            <td>{conv['message_count']}</td>
            <td>{conv['created_at']}</td>
        </tr>
        """
    return rows


async def get_stats_data() -> dict:
    """Get database statistics"""
    if not SessionLocal:
        return {
            'total_users': 0,
            'active_today': 0,
            'total_conversations': 0,
            'total_messages': 0,
            'top_users': [],
            'recent_conversations': []
        }

    db = SessionLocal()
    try:
        # Total users
        total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar()

        # Active today
        today = datetime.utcnow().date()
        active_today = db.execute(
            text("SELECT COUNT(*) FROM users WHERE DATE(last_used) = :today"),
            {"today": today}
        ).scalar()

        # Total conversations
        total_conversations = db.execute(text("SELECT COUNT(*) FROM conversations")).scalar()

        # Total messages
        total_messages = db.execute(text("SELECT COUNT(*) FROM messages")).scalar()

        # Top users today
        top_users_result = db.execute(text("""
            SELECT email, auth_provider, daily_requests, last_used
            FROM users
            WHERE DATE(daily_reset_date) = :today
            ORDER BY daily_requests DESC
            LIMIT 10
        """), {"today": today}).fetchall()

        top_users = [
            {
                'email': row[0],
                'provider': row[1],
                'daily_requests': row[2],
                'last_used': row[3].strftime('%H:%M') if row[3] else '-'
            }
            for row in top_users_result
        ]

        # Recent conversations
        recent_conv_result = db.execute(text("""
            SELECT c.id, c.provider, c.created_at, COUNT(m.id) as msg_count
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, c.provider, c.created_at
            ORDER BY c.created_at DESC
            LIMIT 10
        """)).fetchall()

        recent_conversations = [
            {
                'id': str(row[0]),
                'provider': row[1],
                'created_at': row[2].strftime('%Y-%m-%d %H:%M') if row[2] else '-',
                'message_count': row[3]
            }
            for row in recent_conv_result
        ]

        return {
            'total_users': total_users or 0,
            'active_today': active_today or 0,
            'total_conversations': total_conversations or 0,
            'total_messages': total_messages or 0,
            'top_users': top_users,
            'recent_conversations': recent_conversations
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            'total_users': 0,
            'active_today': 0,
            'total_conversations': 0,
            'total_messages': 0,
            'top_users': [],
            'recent_conversations': []
        }
    finally:
        db.close()


async def check_api_credits() -> dict:
    """Check API provider status and credits"""
    results = {}

    # OpenAI
    if OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Check if key works with a simple models list call
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}
                )
                if response.status_code == 200:
                    results['OpenAI'] = {'ok': True, 'detail': 'Key valid'}
                else:
                    results['OpenAI'] = {'ok': False, 'detail': f'Status {response.status_code}'}
        except Exception as e:
            results['OpenAI'] = {'ok': False, 'detail': str(e)[:50]}
    else:
        results['OpenAI'] = {'ok': False, 'detail': 'Key not configured'}

    # Anthropic
    if ANTHROPIC_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Anthropic doesn't have a simple check endpoint, just verify key format
                if ANTHROPIC_API_KEY.startswith('sk-ant-'):
                    results['Anthropic'] = {'ok': True, 'detail': 'Key configured'}
                else:
                    results['Anthropic'] = {'ok': False, 'detail': 'Invalid key format'}
        except Exception as e:
            results['Anthropic'] = {'ok': False, 'detail': str(e)[:50]}
    else:
        results['Anthropic'] = {'ok': False, 'detail': 'Key not configured'}

    # Groq
    if GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"}
                )
                if response.status_code == 200:
                    results['Groq'] = {'ok': True, 'detail': 'Key valid'}
                else:
                    results['Groq'] = {'ok': False, 'detail': f'Status {response.status_code}'}
        except Exception as e:
            results['Groq'] = {'ok': False, 'detail': str(e)[:50]}
    else:
        results['Groq'] = {'ok': False, 'detail': 'Key not configured'}

    return results


@app.get("/api/stats")
async def api_stats(username: str = Depends(verify_credentials)):
    """JSON API for stats"""
    return await get_stats_data()


@app.get("/api/health")
async def api_health(username: str = Depends(verify_credentials)):
    """JSON API for API health"""
    return await check_api_credits()


@app.get("/health")
async def health():
    """Public health check (no auth)"""
    return {"status": "healthy", "service": "admin"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
