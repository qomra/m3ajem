from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ToolCallData(BaseModel):
    name: str
    arguments: Dict[str, Any]
    result: Optional[Any] = None


class ThoughtData(BaseModel):
    iteration: int
    content: str
    tool_calls: List[str]
    timestamp: int


class SourceData(BaseModel):
    type: str
    title: str
    description: Optional[str] = None


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    messages: List[Dict[str, Any]]  # Full message history
    tools: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None  # openai, anthropic, groq, google


class ChatResponse(BaseModel):
    message_id: str
    content: str
    tool_calls: List[ToolCallData] = []
    thoughts: List[ThoughtData] = []
    sources: List[SourceData] = []
