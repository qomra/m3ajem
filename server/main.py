from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
import httpx

from database import engine, SessionLocal
from models import Base, Conversation, Message, ToolCall, User
from schemas import ChatRequest, ChatResponse, ToolCallData
from auth_routes import router as auth_router
from auth import get_current_user, check_rate_limit

# Initialize database
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    pass

app = FastAPI(
    title="M3ajem Chat Gateway",
    description="Gateway server for M3ajem chat with conversation logging",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth routes
app.include_router(auth_router)

# Provider configurations
PROVIDER_CONFIGS = {
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "base_url": "https://api.openai.com/v1",
        "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
    },
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY"),
        "base_url": "https://api.anthropic.com/v1",
        "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
    },
    "groq": {
        "api_key": os.getenv("GROQ_API_KEY"),
        "base_url": "https://api.groq.com/openai/v1",
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    },
    "google": {
        "api_key": os.getenv("GOOGLE_API_KEY"),
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "model": os.getenv("GOOGLE_MODEL", "gemini-2.0-flash-exp"),
    },
}

DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "openai")


@app.get("/")
async def root():
    return {
        "service": "M3ajem Chat Gateway",
        "status": "running",
        "default_provider": DEFAULT_PROVIDER,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to check environment variables (hide actual keys)"""
    return {
        "default_provider": DEFAULT_PROVIDER,
        "providers": {
            provider: {
                "api_key_set": bool(config["api_key"]),
                "api_key_length": len(config["api_key"]) if config["api_key"] else 0,
                "model": config["model"],
            }
            for provider, config in PROVIDER_CONFIGS.items()
        }
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Gateway endpoint for chat requests.
    Requires authentication via JWT token in Authorization header.
    Logs all communication and forwards to the configured LLM provider.
    """
    db = SessionLocal()

    try:
        # Check authentication
        user = get_current_user(authorization, db)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required. Please sign in with Google or Apple."
            )

        # Check rate limit (30 requests/day)
        if not check_rate_limit(user, db):
            raise HTTPException(
                status_code=429,
                detail=f"Daily rate limit exceeded (30 requests/day). Try again tomorrow."
            )
        provider = request.provider or DEFAULT_PROVIDER

        if provider not in PROVIDER_CONFIGS:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

        config = PROVIDER_CONFIGS[provider]

        if not config["api_key"]:
            raise HTTPException(
                status_code=500,
                detail=f"API key not configured for provider: {provider}"
            )

        # Log conversation if new
        conversation = None
        if request.conversation_id:
            conversation = db.query(Conversation).filter(
                Conversation.id == request.conversation_id
            ).first()

        if not conversation:
            conversation = Conversation(
                id=request.conversation_id,
                provider=provider,
                created_at=datetime.utcnow(),
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # Log user message
        user_message = Message(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
            timestamp=datetime.utcnow(),
        )
        db.add(user_message)
        db.commit()

        # Forward request to LLM provider
        response_data = await forward_to_provider(
            provider=provider,
            config=config,
            messages=request.messages,
            tools=request.tools,
            system_prompt=request.system_prompt,
        )

        # Log assistant message
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=response_data.get("content", ""),
            timestamp=datetime.utcnow(),
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)

        # Log tool calls if any
        if response_data.get("tool_calls"):
            for tool_call in response_data["tool_calls"]:
                tool_call_record = ToolCall(
                    message_id=assistant_message.id,
                    tool_name=tool_call.get("name"),
                    arguments=json.dumps(tool_call.get("arguments", {})),
                    result=json.dumps(tool_call.get("result")),
                    timestamp=datetime.utcnow(),
                )
                db.add(tool_call_record)
            db.commit()

        return ChatResponse(
            message_id=str(assistant_message.id),
            content=response_data.get("content", ""),
            tool_calls=response_data.get("tool_calls", []),
            thoughts=response_data.get("thoughts", []),
            sources=response_data.get("sources", []),
        )

    except Exception as e:
        db.rollback()
        # Log the full error for debugging
        import traceback
        error_details = {
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }
        print(f"ERROR in /chat endpoint: {error_details}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


async def forward_to_provider(
    provider: str,
    config: Dict[str, Any],
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Forward the chat request to the appropriate LLM provider.
    This function translates the request format and handles provider-specific logic.
    """

    async with httpx.AsyncClient(timeout=120.0) as client:
        if provider == "openai" or provider == "groq":
            # OpenAI-compatible API
            headers = {
                "Authorization": f"Bearer {config['api_key']}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": config["model"],
                "messages": messages,
            }

            if system_prompt:
                payload["messages"] = [
                    {"role": "system", "content": system_prompt},
                    *messages
                ]

            if tools:
                payload["tools"] = tools

            # Log the request for debugging
            print(f"Sending request to OpenAI:")
            print(f"  Model: {config['model']}")
            print(f"  Messages: {payload['messages']}")
            print(f"  Tools: {payload.get('tools', 'None')}")

            response = await client.post(
                f"{config['base_url']}/chat/completions",
                headers=headers,
                json=payload,
            )

            if not response.is_success:
                error_body = response.text
                print(f"OpenAI API Error: {response.status_code}")
                print(f"Error body: {error_body}")
                response.raise_for_status()

            data = response.json()

            choice = data["choices"][0]
            message = choice["message"]

            result = {
                "content": message.get("content", ""),
                "tool_calls": [],
            }

            if message.get("tool_calls"):
                result["tool_calls"] = [
                    {
                        "name": tc["function"]["name"],
                        "arguments": json.loads(tc["function"]["arguments"]),
                    }
                    for tc in message["tool_calls"]
                ]

            return result

        elif provider == "anthropic":
            # Anthropic API
            headers = {
                "x-api-key": config["api_key"],
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
            }

            payload = {
                "model": config["model"],
                "messages": messages,
                "max_tokens": 4096,
            }

            if system_prompt:
                payload["system"] = system_prompt

            if tools:
                payload["tools"] = tools

            response = await client.post(
                f"{config['base_url']}/messages",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            result = {
                "content": "",
                "tool_calls": [],
            }

            for block in data.get("content", []):
                if block["type"] == "text":
                    result["content"] += block["text"]
                elif block["type"] == "tool_use":
                    result["tool_calls"].append({
                        "name": block["name"],
                        "arguments": block["input"],
                    })

            return result

        elif provider == "google":
            # Google Gemini API
            headers = {
                "Content-Type": "application/json",
            }

            # Convert messages to Gemini format
            gemini_messages = []
            for msg in messages:
                gemini_messages.append({
                    "role": "user" if msg["role"] == "user" else "model",
                    "parts": [{"text": msg["content"]}],
                })

            payload = {
                "contents": gemini_messages,
            }

            if system_prompt:
                payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

            response = await client.post(
                f"{config['base_url']}/models/{config['model']}:generateContent?key={config['api_key']}",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            content = ""
            if data.get("candidates"):
                candidate = data["candidates"][0]
                for part in candidate.get("content", {}).get("parts", []):
                    if "text" in part:
                        content += part["text"]

            return {
                "content": content,
                "tool_calls": [],
            }

        else:
            raise ValueError(f"Unknown provider: {provider}")


@app.get("/conversations")
async def get_conversations(limit: int = 50):
    """Get recent conversations for monitoring."""
    db = SessionLocal()
    try:
        conversations = db.query(Conversation).order_by(
            Conversation.created_at.desc()
        ).limit(limit).all()

        return {
            "conversations": [
                {
                    "id": conv.id,
                    "provider": conv.provider,
                    "created_at": conv.created_at.isoformat(),
                    "message_count": len(conv.messages),
                }
                for conv in conversations
            ]
        }
    finally:
        db.close()


@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation details."""
    db = SessionLocal()
    try:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        return {
            "id": conversation.id,
            "provider": conversation.provider,
            "created_at": conversation.created_at.isoformat(),
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "tool_calls": [
                        {
                            "tool_name": tc.tool_name,
                            "arguments": json.loads(tc.arguments) if tc.arguments else {},
                            "result": json.loads(tc.result) if tc.result else None,
                        }
                        for tc in msg.tool_calls
                    ],
                }
                for msg in conversation.messages
            ],
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
