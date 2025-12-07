"""
M3ajem Admin Dashboard
======================
A modern admin tool to inspect database and API status.
Protected by basic authentication.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import HTMLResponse, JSONResponse
import secrets
import os
import httpx
from datetime import datetime, timedelta
from typing import Optional
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection (standalone - no server dependencies)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

DATABASE_URL = os.getenv("DATABASE_URL")
db_error = None
engine = None
SessionLocal = None

if not DATABASE_URL:
    db_error = "DATABASE_URL not set!"
    logger.error(db_error)
else:
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        db_error = f"Database connection failed: {str(e)}"
        logger.error(db_error)

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


async def get_stats_data() -> dict:
    """Get database statistics"""
    if db_error or not SessionLocal:
        return {
            'error': db_error or "Database not configured",
            'total_users': 0,
            'active_today': 0,
            'active_week': 0,
            'total_conversations': 0,
            'total_messages': 0,
            'conversations_today': 0,
            'top_users': [],
            'recent_conversations': [],
            'provider_stats': [],
            'daily_stats': []
        }

    db = SessionLocal()
    try:
        # Total users
        total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0

        # Active today
        today = datetime.utcnow().date()
        active_today = db.execute(
            text("SELECT COUNT(*) FROM users WHERE DATE(last_used) = :today"),
            {"today": today}
        ).scalar() or 0

        # Active this week
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_week = db.execute(
            text("SELECT COUNT(*) FROM users WHERE last_used >= :week_ago"),
            {"week_ago": week_ago}
        ).scalar() or 0

        # Total conversations
        total_conversations = db.execute(text("SELECT COUNT(*) FROM conversations")).scalar() or 0

        # Conversations today
        conversations_today = db.execute(
            text("SELECT COUNT(*) FROM conversations WHERE DATE(created_at) = :today"),
            {"today": today}
        ).scalar() or 0

        # Total messages
        total_messages = db.execute(text("SELECT COUNT(*) FROM messages")).scalar() or 0

        # Provider stats
        provider_stats_result = db.execute(text("""
            SELECT provider, COUNT(*) as count
            FROM conversations
            GROUP BY provider
            ORDER BY count DESC
        """)).fetchall()

        provider_stats = [
            {'provider': row[0], 'count': row[1]}
            for row in provider_stats_result
        ]

        # Top users today
        top_users_result = db.execute(text("""
            SELECT email, auth_provider, daily_requests, last_used
            FROM users
            WHERE daily_requests > 0
            ORDER BY daily_requests DESC
            LIMIT 10
        """)).fetchall()

        top_users = [
            {
                'email': row[0],
                'provider': row[1],
                'daily_requests': row[2],
                'last_used': row[3].strftime('%Y-%m-%d %H:%M') if row[3] else '-'
            }
            for row in top_users_result
        ]

        # Recent conversations with message count
        recent_conv_result = db.execute(text("""
            SELECT c.id, c.provider, c.created_at, COUNT(m.id) as msg_count
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, c.provider, c.created_at
            ORDER BY c.created_at DESC
            LIMIT 15
        """)).fetchall()

        recent_conversations = [
            {
                'id': str(row[0])[:12],
                'provider': row[1],
                'created_at': row[2].strftime('%Y-%m-%d %H:%M') if row[2] else '-',
                'message_count': row[3]
            }
            for row in recent_conv_result
        ]

        # Daily stats for chart (last 7 days)
        daily_stats_result = db.execute(text("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM conversations
            WHERE created_at >= :week_ago
            GROUP BY DATE(created_at)
            ORDER BY date
        """), {"week_ago": week_ago}).fetchall()

        daily_stats = [
            {'date': str(row[0]), 'count': row[1]}
            for row in daily_stats_result
        ]

        return {
            'error': None,
            'total_users': total_users,
            'active_today': active_today,
            'active_week': active_week,
            'total_conversations': total_conversations,
            'conversations_today': conversations_today,
            'total_messages': total_messages,
            'top_users': top_users,
            'recent_conversations': recent_conversations,
            'provider_stats': provider_stats,
            'daily_stats': daily_stats
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}\n{traceback.format_exc()}")
        return {
            'error': str(e),
            'total_users': 0,
            'active_today': 0,
            'active_week': 0,
            'total_conversations': 0,
            'conversations_today': 0,
            'total_messages': 0,
            'top_users': [],
            'recent_conversations': [],
            'provider_stats': [],
            'daily_stats': []
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
        if ANTHROPIC_API_KEY.startswith('sk-ant-'):
            results['Anthropic'] = {'ok': True, 'detail': 'Key configured'}
        else:
            results['Anthropic'] = {'ok': False, 'detail': 'Invalid key format'}
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


def generate_dashboard_html(stats: dict, api_status: dict) -> str:
    """Generate modern dashboard HTML"""

    error_banner = ""
    if stats.get('error'):
        error_banner = f"""
        <div class="error-banner">
            <strong>Database Error:</strong> {stats['error']}
        </div>
        """

    # Provider stats for pie chart
    provider_data = stats.get('provider_stats', [])
    provider_labels = [p['provider'] for p in provider_data]
    provider_values = [p['count'] for p in provider_data]

    # Daily stats for line chart
    daily_data = stats.get('daily_stats', [])
    daily_labels = [d['date'] for d in daily_data]
    daily_values = [d['count'] for d in daily_data]

    # API status rows
    api_rows = ""
    for provider, status in api_status.items():
        status_class = "status-ok" if status['ok'] else "status-error"
        status_icon = "✓" if status['ok'] else "✗"
        api_rows += f"""
        <tr>
            <td><strong>{provider}</strong></td>
            <td class="{status_class}">{status_icon} {'يعمل' if status['ok'] else 'خطأ'}</td>
            <td>{status.get('detail', '-')}</td>
        </tr>
        """

    # Top users rows
    users_rows = ""
    if stats['top_users']:
        for user in stats['top_users']:
            users_rows += f"""
            <tr>
                <td>{user['email'][:35]}{'...' if len(user['email']) > 35 else ''}</td>
                <td><span class="badge badge-{user['provider']}">{user['provider']}</span></td>
                <td><strong>{user['daily_requests']}</strong></td>
                <td>{user['last_used']}</td>
            </tr>
            """
    else:
        users_rows = "<tr><td colspan='4' class='empty-state'>لا يوجد مستخدمين نشطين</td></tr>"

    # Recent conversations rows
    conv_rows = ""
    if stats['recent_conversations']:
        for conv in stats['recent_conversations']:
            conv_rows += f"""
            <tr>
                <td><code>{conv['id']}...</code></td>
                <td><span class="badge badge-{conv['provider']}">{conv['provider']}</span></td>
                <td><strong>{conv['message_count']}</strong></td>
                <td>{conv['created_at']}</td>
            </tr>
            """
    else:
        conv_rows = "<tr><td colspan='4' class='empty-state'>لا يوجد محادثات</td></tr>"

    html = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>M3ajem Admin Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                color: #e0e0e0;
            }}
            .container {{
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }}
            header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                margin-bottom: 30px;
            }}
            h1 {{
                color: #fff;
                font-size: 1.8em;
                display: flex;
                align-items: center;
                gap: 10px;
            }}
            h1::before {{
                content: '📚';
            }}
            .refresh-btn {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: transform 0.2s, box-shadow 0.2s;
            }}
            .refresh-btn:hover {{
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }}
            .error-banner {{
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                margin-bottom: 20px;
                font-size: 14px;
            }}
            .stats-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }}
            .stat-card {{
                background: rgba(255,255,255,0.05);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 24px;
                border: 1px solid rgba(255,255,255,0.1);
                transition: transform 0.2s;
            }}
            .stat-card:hover {{
                transform: translateY(-4px);
            }}
            .stat-value {{
                font-size: 2.5em;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }}
            .stat-label {{
                color: #888;
                font-size: 0.9em;
                margin-top: 8px;
            }}
            .grid-2 {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }}
            .card {{
                background: rgba(255,255,255,0.05);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 24px;
                border: 1px solid rgba(255,255,255,0.1);
            }}
            .card h2 {{
                color: #fff;
                font-size: 1.2em;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            th, td {{
                padding: 12px;
                text-align: right;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }}
            th {{
                color: #888;
                font-weight: 600;
                font-size: 0.85em;
                text-transform: uppercase;
            }}
            .status-ok {{ color: #4ade80; }}
            .status-error {{ color: #f87171; }}
            .badge {{
                display: inline-block;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.8em;
                font-weight: 600;
            }}
            .badge-google {{ background: rgba(66, 133, 244, 0.2); color: #4285f4; }}
            .badge-apple {{ background: rgba(255,255,255,0.1); color: #fff; }}
            .badge-openai {{ background: rgba(16, 163, 127, 0.2); color: #10a37f; }}
            .badge-anthropic {{ background: rgba(204, 147, 102, 0.2); color: #cc9366; }}
            .badge-groq {{ background: rgba(244, 114, 182, 0.2); color: #f472b6; }}
            code {{
                background: rgba(255,255,255,0.1);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.85em;
            }}
            .empty-state {{
                text-align: center;
                color: #666;
                padding: 30px !important;
            }}
            .chart-container {{
                position: relative;
                height: 200px;
            }}
            footer {{
                text-align: center;
                padding: 30px 0;
                color: #666;
                font-size: 0.85em;
            }}
            @media (max-width: 768px) {{
                .grid-2 {{
                    grid-template-columns: 1fr;
                }}
                .stats-grid {{
                    grid-template-columns: repeat(2, 1fr);
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>لوحة تحكم المعجم</h1>
                <button class="refresh-btn" onclick="location.reload()">🔄 تحديث</button>
            </header>

            {error_banner}

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">{stats['total_users']}</div>
                    <div class="stat-label">👥 إجمالي المستخدمين</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['active_today']}</div>
                    <div class="stat-label">🟢 نشطين اليوم</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['active_week']}</div>
                    <div class="stat-label">📅 نشطين هذا الأسبوع</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['total_conversations']}</div>
                    <div class="stat-label">💬 إجمالي المحادثات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['conversations_today']}</div>
                    <div class="stat-label">📝 محادثات اليوم</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['total_messages']}</div>
                    <div class="stat-label">✉️ إجمالي الرسائل</div>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <h2>📊 المحادثات (آخر 7 أيام)</h2>
                    <div class="chart-container">
                        <canvas id="dailyChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <h2>🔌 حالة API</h2>
                    <table>
                        <tr>
                            <th>المزود</th>
                            <th>الحالة</th>
                            <th>التفاصيل</th>
                        </tr>
                        {api_rows}
                    </table>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <h2>👥 أكثر المستخدمين نشاطاً</h2>
                    <table>
                        <tr>
                            <th>البريد</th>
                            <th>المزود</th>
                            <th>الطلبات</th>
                            <th>آخر استخدام</th>
                        </tr>
                        {users_rows}
                    </table>
                </div>
                <div class="card">
                    <h2>🕐 آخر المحادثات</h2>
                    <table>
                        <tr>
                            <th>المعرف</th>
                            <th>المزود</th>
                            <th>الرسائل</th>
                            <th>التاريخ</th>
                        </tr>
                        {conv_rows}
                    </table>
                </div>
            </div>

            <div class="card" style="margin-top: 20px;">
                <h2>📈 توزيع المحادثات حسب المزود</h2>
                <div class="chart-container">
                    <canvas id="providerChart"></canvas>
                </div>
            </div>

            <footer>
                آخر تحديث: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
                <br>
                <span style="color: {'#4ade80' if not stats.get('error') else '#f87171'}">
                    {'🟢 متصل بقاعدة البيانات' if not stats.get('error') else '🔴 غير متصل بقاعدة البيانات'}
                </span>
            </footer>
        </div>

        <script>
            // Daily conversations chart
            const dailyCtx = document.getElementById('dailyChart').getContext('2d');
            new Chart(dailyCtx, {{
                type: 'line',
                data: {{
                    labels: {daily_labels},
                    datasets: [{{
                        label: 'المحادثات',
                        data: {daily_values},
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true,
                        tension: 0.4
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{ display: false }}
                    }},
                    scales: {{
                        y: {{
                            beginAtZero: true,
                            grid: {{ color: 'rgba(255,255,255,0.05)' }},
                            ticks: {{ color: '#888' }}
                        }},
                        x: {{
                            grid: {{ display: false }},
                            ticks: {{ color: '#888' }}
                        }}
                    }}
                }}
            }});

            // Provider distribution chart
            const providerCtx = document.getElementById('providerChart').getContext('2d');
            new Chart(providerCtx, {{
                type: 'doughnut',
                data: {{
                    labels: {provider_labels},
                    datasets: [{{
                        data: {provider_values},
                        backgroundColor: [
                            '#667eea',
                            '#10a37f',
                            '#cc9366',
                            '#f472b6',
                            '#4ade80'
                        ],
                        borderWidth: 0
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{
                            position: 'right',
                            labels: {{ color: '#888' }}
                        }}
                    }}
                }}
            }});

            // Auto-refresh every 60 seconds
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
    """
    return html


@app.get("/", response_class=HTMLResponse)
async def dashboard(username: str = Depends(verify_credentials)):
    """Main dashboard - HTML view"""
    stats = await get_stats_data()
    api_status = await check_api_credits()
    return generate_dashboard_html(stats, api_status)


@app.get("/api/stats")
async def api_stats(username: str = Depends(verify_credentials)):
    """JSON API for stats"""
    return await get_stats_data()


@app.get("/api/health")
async def api_health(username: str = Depends(verify_credentials)):
    """JSON API for API health"""
    return await check_api_credits()


@app.get("/api/db-test")
async def db_test(username: str = Depends(verify_credentials)):
    """Test database connection and return debug info"""
    result = {
        "database_url_set": bool(DATABASE_URL),
        "database_url_preview": DATABASE_URL[:30] + "..." if DATABASE_URL else None,
        "engine_created": engine is not None,
        "session_created": SessionLocal is not None,
        "startup_error": db_error,
        "test_query": None
    }

    if SessionLocal:
        try:
            db = SessionLocal()
            # Test basic query
            test = db.execute(text("SELECT 1")).scalar()
            result["test_query"] = "OK" if test == 1 else f"Unexpected: {test}"

            # Get table info
            tables = db.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
            """)).fetchall()
            result["tables"] = [t[0] for t in tables]

            # Count each table
            counts = {}
            for table in result["tables"]:
                try:
                    count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                    counts[table] = count
                except:
                    counts[table] = "error"
            result["table_counts"] = counts

            db.close()
        except Exception as e:
            result["test_query"] = f"Error: {str(e)}"

    return result


@app.get("/health")
async def health():
    """Public health check (no auth)"""
    return {
        "status": "healthy",
        "service": "admin",
        "database": "connected" if (engine and not db_error) else "disconnected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
