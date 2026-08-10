import { AIRepository } from './ai.repository';

export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContent {
  role?: string;
  parts: GeminiContentPart[];
}

export interface ExecuteGeminiParams {
  restaurantId?: string | null;
  requestType: string;
  contents: GeminiContent[];
  overrideModel?: string;
}

export interface GeminiSuccessResponse {
  success: true;
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  model: string;
}

export interface GeminiErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: any;
}

export type GeminiResult = GeminiSuccessResponse | GeminiErrorResponse;

export class AIService {
  private static getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    return apiKey;
  }

  private static formatModelName(model: string): string {
    return model.startsWith('models/') ? model : `models/${model}`;
  }

  /**
   * Calls official Gemini countTokens() API to calculate input tokens before calling generation.
   */
  static async countTokens(model: string, contents: GeminiContent[]): Promise<number> {
    const apiKey = this.getApiKey();
    const formattedModel = this.formatModelName(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/${formattedModel}:countTokens?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Gemini countTokens non-OK response:', response.status, errorText);
        return this.estimateTokens(contents);
      }

      const data = await response.json();
      if (typeof data.totalTokens === 'number') {
        return data.totalTokens;
      }
      return this.estimateTokens(contents);
    } catch (err) {
      console.warn('Gemini countTokens fetch error:', err);
      return this.estimateTokens(contents);
    }
  }

  /**
   * Fallback rough estimation of input tokens if countTokens API fails.
   */
  private static estimateTokens(contents: GeminiContent[]): number {
    let charCount = 0;
    for (const content of contents) {
      for (const part of content.parts) {
        if (part.text) charCount += part.text.length;
        if (part.inlineData) charCount += Math.ceil(part.inlineData.data.length * 0.75); // Image base64 approximation
      }
    }
    return Math.max(1, Math.ceil(charCount / 4));
  }

  /**
   * Safely parses JSON array from AI output, handling markdown wrappers and repairing truncated JSON.
   */
  private static repairAndParseJsonArray(rawText: string): any[] {
    let text = rawText.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Attempt 1: Direct JSON parse
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignored - attempt repair below
    }

    // Attempt 2: Truncated JSON repair
    // Find the last complete object ending with '}'
    const lastObjectEnd = text.lastIndexOf('}');
    if (lastObjectEnd !== -1) {
      const repairedText = text.substring(0, lastObjectEnd + 1).trim() + ']';
      try {
        const repairedParsed = JSON.parse(repairedText);
        if (Array.isArray(repairedParsed) && repairedParsed.length > 0) {
          console.log(`Successfully repaired truncated JSON array (${repairedParsed.length} items recovered).`);
          return repairedParsed;
        }
      } catch (err) {
        console.warn('Repaired JSON parse failed:', err);
      }
    }

    throw new Error('Could not parse or repair valid JSON array from AI output.');
  }

  /**
   * Main Gemini request handler with atomic quota check, token counting, and post-request accounting.
   */
  static async executeGeminiRequest(params: ExecuteGeminiParams): Promise<GeminiResult> {
    const { restaurantId, requestType, contents, overrideModel } = params;

    const startTime = Date.now();
    let model = overrideModel;

    // 1. Fetch global configuration & request max output tokens
    const globalConfig = await AIRepository.getGlobalConfig();
    if (!model) {
      model = globalConfig.model || 'gemini-flash-latest';
    }

    const formattedModel = this.formatModelName(model);

    // Fallback default for MENU_EXTRACTION is 4000 tokens
    const defaultMaxTokens = requestType === 'MENU_EXTRACTION' ? 4000 : (globalConfig.max_output_tokens || 1000);
    const maxOutputTokens = await AIRepository.getMaxOutputTokens(requestType, defaultMaxTokens);

    // 2. Count Input Tokens using official Gemini countTokens() API
    const inputTokens = await this.countTokens(model, contents);

    // 3. Pre-Request Limit Check & Reservation (Atomic PostgreSQL Transaction)
    let reservation;
    try {
      reservation = await AIRepository.atomicCheckAndReserveQuota(inputTokens);
    } catch (err: any) {
      console.error('Failed to reserve Gemini quota:', err);
      return {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Unable to process AI request quota.'
      };
    }

    if (!reservation.allowed) {
      // Limit reached or Gemini disabled. Reject request immediately without calling Gemini API!
      await AIRepository.logRequestUsage({
        restaurantId,
        requestType,
        model,
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        status: 'REJECTED',
        errorCode: reservation.code || 'GEMINI_DAILY_LIMIT_REACHED',
        errorMessage: `Request rejected: ${reservation.reason}`
      });

      return {
        success: false,
        code: 'GEMINI_DAILY_LIMIT_REACHED',
        message: 'AI processing is temporarily unavailable. Please try again later.'
      };
    }

    // 4. Call Gemini API for generation
    const apiKey = this.getApiKey();
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${formattedModel}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens,
            temperature: 0.2
          }
        })
      });

      const responseTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;

        const errorCode = status === 429 ? 'GEMINI_429_RATE_LIMIT' : `GEMINI_HTTP_${status}`;
        const errorMessage = errorData.error?.message || `Gemini API returned status ${status}`;

        await AIRepository.logRequestUsage({
          restaurantId,
          requestType,
          model,
          inputTokens,
          outputTokens: 0,
          totalTokens: inputTokens,
          status: 'ERROR',
          errorCode,
          errorMessage,
          responseTimeMs
        });

        return {
          success: false,
          code: errorCode,
          message: status === 429
            ? 'AI service capacity reached. Please try again in a few moments.'
            : 'Failed to generate response from AI service.'
        };
      }

      const resJson = await response.json();

      // Extract generated text
      const candidates = resJson.candidates || [];
      const generatedText = candidates[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';

      // Extract usageMetadata from Gemini response
      const usageMetadata = resJson.usageMetadata || {};
      const actualInputTokens = usageMetadata.promptTokenCount || inputTokens;
      const actualOutputTokens = usageMetadata.candidatesTokenCount || 0;
      const actualTotalTokens = usageMetadata.totalTokenCount || (actualInputTokens + actualOutputTokens);

      // 5. Post-Request Usage Recording
      await AIRepository.logRequestUsage({
        restaurantId,
        requestType,
        model,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        totalTokens: actualTotalTokens,
        status: 'SUCCESS',
        responseTimeMs
      });

      return {
        success: true,
        text: generatedText,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        totalTokens: actualTotalTokens,
        responseTimeMs,
        model
      };

    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      console.error('Gemini API call failed with exception:', error);

      await AIRepository.logRequestUsage({
        restaurantId,
        requestType,
        model,
        inputTokens,
        outputTokens: 0,
        totalTokens: inputTokens,
        status: 'ERROR',
        errorCode: 'GEMINI_FETCH_EXCEPTION',
        errorMessage: error.message || 'Network exception calling Gemini',
        responseTimeMs
      });

      return {
        success: false,
        code: 'GEMINI_FETCH_EXCEPTION',
        message: 'An unexpected error occurred while communicating with the AI service.'
      };
    }
  }

  /**
   * Helper to extract menu items from an image using Gemini vision capability.
   */
  static async extractMenuFromImage(
    restaurantId: string | undefined,
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ) {
    const prompt = `You are an expert culinary menu extraction assistant.
Analyze this menu image carefully and extract EVERY SINGLE food and beverage product across all sections, columns, and headers without omitting any item.

Exhaustive Extraction Rules:
1. Scan every column (left, right, top, bottom) and every category header (e.g. "Pizza", "Snakes", "Sandwich", "Shakes", "Burger", "Mocktails", "Pasta"). Do NOT skip any section.
2. "category": Use the exact section heading where the item appears.
3. "name": The exact item name printed.
4. "price": A clean numeric price (e.g. 180 or 100). Do NOT include currency symbols or slashes like "/-".
5. "dietary_preference": Must be exactly "VEG" or "NON_VEG". Set to "NON_VEG" if the item contains meat, chicken, fish, seafood, or egg. Otherwise set to "VEG".
6. "description": Extract printed description if visible. If no description is printed on the menu image, provide a concise 3-6 word appetizing description. Keep it short so all menu items fit in the response.

Respond ONLY with a valid JSON array of objects without markdown formatting or code fences:
[
  {
    "name": "Spiced Paneer",
    "category": "Pizza",
    "price": 180,
    "dietary_preference": "VEG",
    "description": "Spicy marinated paneer with herbs and cheese"
  }
]`;

    // Strip base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const contents: GeminiContent[] = [
      {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: prompt }
        ]
      }
    ];

    const result = await this.executeGeminiRequest({
      restaurantId,
      requestType: 'MENU_EXTRACTION',
      contents
    });

    if (!result.success) {
      return result;
    }

    try {
      const products = this.repairAndParseJsonArray(result.text);
      return {
        success: true,
        products,
        tokens: {
          input: result.inputTokens,
          output: result.outputTokens,
          total: result.totalTokens
        }
      };
    } catch (parseErr) {
      console.error('Failed to parse or repair JSON menu extraction output:', result.text);
      return {
        success: false,
        code: 'JSON_PARSE_ERROR',
        message: 'Failed to structure menu items from AI output.'
      };
    }
  }
}
