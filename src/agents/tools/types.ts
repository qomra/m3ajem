/**
 * Tool Calling Types
 * Universal types for tool/function calling across providers
 */

import type { Source } from '@/types/sources';

// Tool Definition (sent to LLM)
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  items?: ToolParameter; // For arrays
  enum?: string[]; // For restricted values
}

// Tool Call (from LLM response)
export interface ToolCall {
  id: string; // Unique ID for this call
  name: string; // Tool name
  arguments: Record<string, any>; // Parsed arguments
}

// Tool Result (to send back to LLM)
export interface ToolResult {
  tool_call_id: string; // Matches ToolCall.id
  name: string; // Tool name
  result: any; // Tool execution result
  sources?: Source[]; // Sources used by this tool
}

// Tool Execution Result (internal)
export interface ToolExecutionResult {
  text: string; // Result text for LLM
  sources?: Source[]; // Sources to attach to message
  rootId?: number; // ID of the entry (for tracking read vs discovered)
}

// Tool Executor Interface
export interface ToolExecutor {
  execute(args: Record<string, any>): Promise<ToolExecutionResult>;
}
