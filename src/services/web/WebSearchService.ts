/**
 * Web Search Result
 */
export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

/**
 * Web Search Response
 */
export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults: number;
}

/**
 * Web Search Service
 * Uses SerpAPI for web searches
 */
export class WebSearchService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search the web using SerpAPI
   */
  async search(query: string, numResults: number = 5): Promise<WebSearchResponse> {
    try {
      // SerpAPI Google Search endpoint
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('engine', 'google');
      url.searchParams.append('q', query);
      url.searchParams.append('api_key', this.apiKey);
      url.searchParams.append('num', numResults.toString());
      url.searchParams.append('hl', 'ar'); // Arabic language
      url.searchParams.append('gl', 'sa'); // Saudi Arabia region (can be configured)

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      // Parse organic results
      const results: WebSearchResult[] = [];

      if (data.organic_results) {
        for (const result of data.organic_results.slice(0, numResults)) {
          results.push({
            title: result.title || '',
            link: result.link || '',
            snippet: result.snippet || '',
            source: this.extractDomain(result.link || ''),
          });
        }
      }

      return {
        query,
        results,
        totalResults: data.search_information?.total_results || 0,
      };
    } catch (error) {
      console.error('Web search error:', error);
      throw error;
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Format search results for LLM
   */
  formatResults(response: WebSearchResponse): string {
    if (response.results.length === 0) {
      return `لم يتم العثور على نتائج للبحث: "${response.query}"`;
    }

    let formatted = `## نتائج البحث: "${response.query}"\n\n`;
    formatted += `وُجد ${response.totalResults.toLocaleString('ar')} نتيجة. عرض أفضل ${response.results.length}:\n\n`;

    response.results.forEach((result, idx) => {
      formatted += `### ${idx + 1}. ${result.title}\n`;
      formatted += `**المصدر**: ${result.source}\n\n`;
      formatted += `${result.snippet}\n\n`;
      formatted += `---\n\n`;
    });

    formatted += '\n**تعليمات مهمة**:\n';
    formatted += '- استخدم هذه المعلومات للإجابة على سؤال المستخدم\n';
    formatted += '- اذكر اسم المصدر فقط بدون رابط (مثلاً: "حسب موقع ويكيبيديا..." أو "وفقاً لـ example.com...")\n';
    formatted += '- **لا تضع الروابط في إجابتك** - المصادر ستظهر تلقائياً في قائمة المصادر القابلة للنقر\n';
    formatted += '- تأكد من دقة المعلومات من مصادر موثوقة\n';

    return formatted;
  }
}
