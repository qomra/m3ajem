import { DEFAULT_SYSTEM_PROMPT } from './system/default';
import { WITH_CONTEXT_SYSTEM_PROMPT } from './system/withContext';
import { formatContexts } from './templates/contextFormat';
import type { ChatContext } from '@/types/chat';

/**
 * Prompt Manager
 * Handles loading and managing system prompts and templates
 */
export class PromptManager {
  /**
   * Get the default system prompt
   */
  static getDefaultSystemPrompt(): string {
    return DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Get the system prompt for when context is provided
   */
  static getContextSystemPrompt(): string {
    return WITH_CONTEXT_SYSTEM_PROMPT;
  }

  /**
   * Get the appropriate system prompt based on whether contexts are present
   */
  static getSystemPrompt(hasContext: boolean): string {
    return hasContext ? this.getContextSystemPrompt() : this.getDefaultSystemPrompt();
  }

  /**
   * Format contexts for inclusion in a message
   */
  static formatContexts(contexts: ChatContext[]): string {
    return formatContexts(contexts);
  }

  /**
   * Prepare a user message with contexts
   * Combines the user's message with formatted context information
   */
  static prepareUserMessageWithContext(
    userMessage: string,
    contexts: ChatContext[]
  ): string {
    if (contexts.length === 0) {
      return userMessage;
    }

    const formattedContexts = this.formatContexts(contexts);
    return `${formattedContexts}\n${userMessage}`;
  }
}
