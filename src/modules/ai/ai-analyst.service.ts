import { pool } from '@/lib/db';
import { AIRepository } from './ai.repository';
import { AIService, GeminiContent } from './ai.service';
import { executeAnalystToolCall } from './ai-analyst.tools';

export const ANALYST_REQUEST_TYPE = 'BUSINESS_ANALYST_CHAT';

/**
 * Gemini Function Declarations for Qdine AI Business Analyst
 */
const ANALYST_TOOLS_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: 'getSalesSummary',
        description: 'Returns verified numerical sales summary metrics including gross revenue, paid revenue, total orders count, paid orders, net subtotal, GST collected, AOV, and cancellation rate.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' }
          }
        }
      },
      {
        name: 'getSalesTrend',
        description: 'Returns daily or period sales breakdown with date, order counts, total revenue, and average order value.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: { type: 'STRING', enum: ['daily', 'weekly', 'monthly'], description: 'Granularity of trend data' },
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending date' }
          }
        }
      },
      {
        name: 'getHourlySales',
        description: 'Returns sales and order counts grouped by hour of day (0-23) to identify peak rush hours and slow periods.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' }
          }
        }
      },
      {
        name: 'getTopProducts',
        description: 'Returns the highest performing products sorted by total quantity sold and total revenue generated.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' },
            limit: { type: 'INTEGER', description: 'Maximum number of top products to return (default 10)' }
          }
        }
      },
      {
        name: 'getBottomProducts',
        description: 'Returns lowest performing menu items or items with 0 sales to help analyze menu reduction or slow-moving items.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' },
            limit: { type: 'INTEGER', description: 'Maximum number of items to return (default 10)' }
          }
        }
      },
      {
        name: 'getCategoryPerformance',
        description: 'Returns sales performance breakdown categorized by menu sections (e.g. Starter, Main Course, Beverages).',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' }
          }
        }
      },
      {
        name: 'getAverageOrderValue',
        description: 'Returns Average Order Value (AOV) metrics and total revenue over a period.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' }
          }
        }
      },
      {
        name: 'getCancellationRate',
        description: 'Returns order cancellation statistics, total cancelled orders count, cancellation %, and total revenue lost.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD starting business date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD ending business date' }
          }
        }
      },
      {
        name: 'comparePeriods',
        description: 'Compares revenue, order volume, AOV, and cancellations between two distinct date ranges (e.g. this week vs last week, or this Monday vs previous Monday) and returns variance percentage.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period1_from: { type: 'STRING', description: 'Period 1 (Current/Primary) YYYY-MM-DD start' },
            period1_to: { type: 'STRING', description: 'Period 1 (Current/Primary) YYYY-MM-DD end' },
            period2_from: { type: 'STRING', description: 'Period 2 (Comparison/Previous) YYYY-MM-DD start' },
            period2_to: { type: 'STRING', description: 'Period 2 (Comparison/Previous) YYYY-MM-DD end' }
          },
          required: ['period1_from', 'period1_to', 'period2_from', 'period2_to']
        }
      },
      {
        name: 'getInventorySummary',
        description: 'Returns current inventory status including available items count, low stock count, out-of-stock count, and specific low stock items.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'searchRestaurantKnowledge',
        description: 'Returns general restaurant details such as restaurant name, timezone, current business date, operating hours, active staff count, and menu categories.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Specific knowledge or configuration parameter to query' }
          }
        }
      }
    ]
  }
];

const ANALYST_SYSTEM_INSTRUCTION = `You are Qdine AI Business Analyst, an AI-powered restaurant business analyst.

Your responsibility is to analyze restaurant performance using verified data from:
- Sales
- Orders
- Inventory
- Restaurant knowledge

Your goal is to provide accurate, actionable, data-driven business insights that help restaurant owners and managers improve revenue, reduce waste, improve operations, and make better decisions.

Core Rules:
1. Never invent business data:
   Never make up Revenue, Order count, Product sales, Inventory quantities, Cancellation rates, Percentages, Trends, or Business dates.
   If required information is unavailable, clearly state that the data is unavailable.
   Never estimate a number unless the user explicitly asks for an estimate.

2. Never directly access the database or write SQL:
   You must strictly use the provided tool functions to query restaurant data.
   Always analyze using the tools provided.

3. Tool Selection Strategy:
   - First understand the user's intent.
   - Select strictly the MINIMUM number of tools required to answer accurately (usually 1 or 2 tools max).
   - Do NOT execute extra comparative or historical tools unless the user explicitly asks for comparison.
   - Simple factual question ("What were yesterday's sales?"): Call getSalesSummary()
   - Simple cancellation question ("What is our cancellation rate?"): Call getCancellationRate()

4. Concise Answer Formatting (Token Efficient):
   - Be extremely direct, brief, and concise. Do NOT generate unnecessary filler or verbose intro text.
   - Answer directly with the key data metrics requested.
   - Do NOT generate recommendations, advice, or action plans unless the user explicitly asks for recommendations.
   - Format numbers clearly in Indian currency (e.g. ₹1,499.00).
   - Keep answers objective, data-backed, and short (2-4 bullet points maximum).`;

export class AIAnalystService {
  /**
   * Creates or fetches an active session for a restaurant
   */
  static async getOrCreateSession(restaurantId: string, sessionId?: string): Promise<string> {
    if (sessionId) {
      const res = await pool.query(
        `SELECT id FROM ai_chat_sessions WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
        [sessionId, restaurantId]
      );
      if (res.rows.length > 0) return res.rows[0].id;
    }

    // Create a new session
    const newSession = await pool.query(
      `INSERT INTO ai_chat_sessions (restaurant_id, title) VALUES ($1, $2) RETURNING id`,
      [restaurantId, 'Business Analysis Chat']
    );
    return newSession.rows[0].id;
  }

  /**
   * Retrieves conversation history for a session
   */
  static async getSessionMessages(sessionId: string, limit = 20) {
    const res = await pool.query(
      `SELECT id, role, content, tool_calls, tool_results, created_at
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, limit]
    );
    return res.rows;
  }

  /**
   * Main entry point to process user chat query with Gemini function calling and tool iteration.
   */
  static async processChat(params: {
    restaurantId: string;
    sessionId?: string;
    message: string;
  }) {
    const { restaurantId, message } = params;
    const startTime = Date.now();

    // 1. Resolve session ID
    const sessionId = await this.getOrCreateSession(restaurantId, params.sessionId);

    // 2. Save user message to database
    await pool.query(
      `INSERT INTO ai_chat_messages (session_id, restaurant_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [sessionId, restaurantId, message]
    );

    // 3. Fetch global config & max output tokens for BUSINESS_ANALYST_CHAT
    const globalConfig = await AIRepository.getGlobalConfig();
    const model = globalConfig.model || 'gemini-flash-latest';
    const formattedModel = model.startsWith('models/') ? model : `models/${model}`;
    const maxOutputTokens = await AIRepository.getMaxOutputTokens(ANALYST_REQUEST_TYPE, 10000);

    // 4. Construct Gemini Contents array from recent conversation history
    const historyMessages = await this.getSessionMessages(sessionId, 12);
    const contents: GeminiContent[] = historyMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // 5. Fast local token estimation & atomic quota check (saves 1 HTTP request per message)
    const historyCharCount = contents.reduce((acc, c) => acc + (c.parts?.[0]?.text?.length || 0), 0);
    const estimatedInputTokens = Math.ceil((historyCharCount + 4000) / 4);
    const reservation = await AIRepository.atomicCheckAndReserveQuota(estimatedInputTokens);

    if (!reservation.allowed) {
      const errorMsg = 'AI Analyst is temporarily unavailable due to daily usage quota limits. Please try again later.';
      await pool.query(
        `INSERT INTO ai_chat_messages (session_id, restaurant_id, role, content) VALUES ($1, $2, 'model', $3)`,
        [sessionId, restaurantId, errorMsg]
      );
      return {
        success: false,
        sessionId,
        message: errorMsg,
        code: 'QUOTA_EXCEEDED'
      };
    }

    // 6. Execute Gemini Request with Function Calling loop (up to 5 turns)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }

    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${formattedModel}:generateContent?key=${apiKey}`;

    let currentContents = [...contents];
    let finalAnswer = '';
    const executedToolCalls: Array<{ name: string; args: any; result: any }> = [];
    let totalOutputTokens = 0;
    let actualInputTokens = estimatedInputTokens;
    let iterations = 0;
    const maxIterations = 5;

    try {
      while (iterations < maxIterations) {
        iterations++;

        const requestBody: any = {
          contents: currentContents,
          systemInstruction: {
            parts: [{ text: ANALYST_SYSTEM_INSTRUCTION }]
          },
          tools: ANALYST_TOOLS_DECLARATIONS,
          generationConfig: {
            maxOutputTokens,
            temperature: 0.2
          }
        };

        let response: Response | null = null;
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
          response = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) break;

          if ((response.status === 503 || response.status === 429) && retries < maxRetries) {
            retries++;
            console.warn(`Gemini API returned ${response.status}. Retrying attempt ${retries}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, 1000 * retries));
          } else {
            break;
          }
        }

        if (!response || !response.ok) {
          const errText = response ? await response.text() : 'No response';
          console.error('Gemini API Analyst request error:', response?.status, errText);
          throw new Error(`Gemini API returned status ${response?.status}`);
        }

        const resJson = await response.json();
        const usage = resJson.usageMetadata || {};
        if (usage.promptTokenCount) actualInputTokens = usage.promptTokenCount;
        if (usage.candidatesTokenCount) totalOutputTokens += usage.candidatesTokenCount;

        const candidate = resJson.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Check if candidate contains function calls
        const functionCallPart = parts.find((p: any) => p.functionCall);

        if (functionCallPart && functionCallPart.functionCall) {
          const { name, args } = functionCallPart.functionCall;
          console.log(`🤖 AI Analyst requested tool: ${name}`, args);

          // Execute tool on PostgreSQL database
          const toolResult = await executeAnalystToolCall(restaurantId, name, args || {});
          executedToolCalls.push({ name, args, result: toolResult });

          // Append model's functionCall turn (preserving all parts and thought signatures returned by Gemini)
          currentContents.push(candidate.content);

          // Append tool response turn to conversation (Gemini REST API expects role: 'user' or 'function' with response being the data object)
          currentContents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name,
                  response: typeof toolResult === 'object' && toolResult !== null ? toolResult : { result: toolResult }
                }
              }
            ]
          });

          // Continue loop for next turn
          continue;
        }

        // If no function call, extract text response
        const textParts = parts.map((p: any) => p.text || '').join('');
        finalAnswer = textParts;
        break;
      }

      if (!finalAnswer && executedToolCalls.length > 0) {
        // If max tool iterations reached without text output, force 1 final synthesis call without tools
        try {
          const synthesisReq = {
            contents: [
              ...currentContents,
              {
                role: 'user',
                parts: [{ text: 'Based on the tool data retrieved above, provide a direct, concise data summary answering the user question directly. Do not include recommendations or filler text.' }]
              }
            ],
            systemInstruction: { parts: [{ text: ANALYST_SYSTEM_INSTRUCTION }] },
            generationConfig: { maxOutputTokens, temperature: 0.2 }
          };
          const synthRes = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(synthesisReq)
          });
          if (synthRes.ok) {
            const synthJson = await synthRes.json();
            const textParts = synthJson.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
            if (textParts) finalAnswer = textParts;
          }
        } catch (e) {
          console.error('Synthesis fallback error:', e);
        }

        if (!finalAnswer) {
          finalAnswer = 'Completed analysis using verified restaurant data.';
        }
      }

      const responseTimeMs = Date.now() - startTime;
      const totalTokens = actualInputTokens + totalOutputTokens;

      // Save assistant response to DB
      await pool.query(
        `INSERT INTO ai_chat_messages (session_id, restaurant_id, role, content, tool_calls, tool_results, tokens_used)
         VALUES ($1, $2, 'model', $3, $4, $5, $6)`,
        [
          sessionId,
          restaurantId,
          finalAnswer,
          JSON.stringify(executedToolCalls.map(t => ({ name: t.name, args: t.args }))),
          JSON.stringify(executedToolCalls.map(t => t.result)),
          totalTokens
        ]
      );

      // Update session timestamp & title if first message
      await pool.query(
        `UPDATE ai_chat_sessions
         SET updated_at = CURRENT_TIMESTAMP,
             title = CASE WHEN title = 'Business Analysis Chat' THEN $1 ELSE title END
         WHERE id = $2`,
        [message.substring(0, 50), sessionId]
      );

      // Log request usage in gemini_usage table
      await AIRepository.logRequestUsage({
        restaurantId,
        requestType: ANALYST_REQUEST_TYPE,
        model,
        inputTokens: actualInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        status: 'SUCCESS',
        responseTimeMs
      });

      return {
        success: true,
        sessionId,
        message: finalAnswer,
        toolCalls: executedToolCalls,
        tokens: {
          input: actualInputTokens,
          output: totalOutputTokens,
          total: totalTokens
        }
      };

    } catch (err: any) {
      const responseTimeMs = Date.now() - startTime;
      console.error('AI Analyst processChat error:', err);

      await AIRepository.logRequestUsage({
        restaurantId,
        requestType: ANALYST_REQUEST_TYPE,
        model,
        inputTokens: actualInputTokens,
        outputTokens: 0,
        totalTokens: actualInputTokens,
        status: 'ERROR',
        errorCode: 'ANALYST_CHAT_EXCEPTION',
        errorMessage: err.message || 'Chat processing error',
        responseTimeMs
      });

      const fallbackMsg = 'Sorry, an error occurred while processing your request. Please try again.';
      await pool.query(
        `INSERT INTO ai_chat_messages (session_id, restaurant_id, role, content) VALUES ($1, $2, 'model', $3)`,
        [sessionId, restaurantId, fallbackMsg]
      );

      return {
        success: false,
        sessionId,
        message: fallbackMsg,
        error: err.message
      };
    }
  }
}
