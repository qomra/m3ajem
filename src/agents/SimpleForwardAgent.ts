import { BaseAgent, AgentRequest, AgentResponse } from './BaseAgent';
import { PromptManager } from '@/prompts/PromptManager';
import type { ProviderMessage } from '@services/ai/BaseProvider';

/**
 * Simple Forward Agent
 * Simply forwards messages to the provider with appropriate system prompt
 * This is the default agent for basic chat functionality
 */
export class SimpleForwardAgent extends BaseAgent {
  getName(): string {
    return 'SimpleForward';
  }

  getDescription(): string {
    return 'Basic agent that forwards messages to the AI provider';
  }

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { userMessage, messageHistory, contexts = [] } = request;

      // Determine if we have context
      const hasContext = contexts.length > 0;

      // Get appropriate system prompt
      const systemPrompt = PromptManager.getSystemPrompt(hasContext);

      // Prepare user message with context if present
      const preparedUserMessage = PromptManager.prepareUserMessageWithContext(
        userMessage,
        contexts
      );

      // Build message history for provider
      const providerMessages: ProviderMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Add message history (excluding system messages from history)
      for (const msg of messageHistory) {
        if (msg.role !== 'system') {
          providerMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Add current user message
      providerMessages.push({
        role: 'user',
        content: preparedUserMessage,
      });

      // Send to provider
      const response = await this.provider.sendMessage(providerMessages);

      return {
        content: response.content,
        success: true,
      };
    } catch (error) {
      console.error('SimpleForwardAgent error:', error);

      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
