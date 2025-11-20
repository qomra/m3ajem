import type { APIConfig } from '@services/storage/apiKeyStorage';

/**
 * Embedding Service
 * Generates embeddings using AI provider APIs
 */
export class EmbeddingService {
  /**
   * Generate embedding for a text using OpenAI
   */
  private static async generateOpenAIEmbedding(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate embedding for a text using Google
   */
  private static async generateGoogleEmbedding(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.embedding.values;
  }

  /**
   * Generate embedding using the configured provider
   */
  static async generateEmbedding(text: string, apiConfig: APIConfig): Promise<number[]> {
    try {
      switch (apiConfig.provider) {
        case 'openai':
          return await this.generateOpenAIEmbedding(text, apiConfig.apiKey);

        case 'google':
          return await this.generateGoogleEmbedding(text, apiConfig.apiKey);

        case 'anthropic':
        case 'groq':
          // Anthropic and Groq don't have embedding APIs
          // Fall back to OpenAI if possible, or throw error
          throw new Error(
            `${apiConfig.provider} لا يدعم إنشاء التضمينات. يرجى استخدام OpenAI أو Google للبحث الدلالي.`
          );

        default:
          throw new Error(`Unknown provider: ${apiConfig.provider}`);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Pad or truncate embedding to match target dimensions
   * This is needed because different models have different dimensions
   */
  static normalizeEmbedding(embedding: number[], targetDimensions: number): number[] {
    if (embedding.length === targetDimensions) {
      return embedding;
    }

    // If too long, truncate
    if (embedding.length > targetDimensions) {
      return embedding.slice(0, targetDimensions);
    }

    // If too short, pad with zeros
    return [...embedding, ...new Array(targetDimensions - embedding.length).fill(0)];
  }
}
