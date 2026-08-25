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
        description: 'Returns gross & paid revenue, order counts, subtotal, GST (collected for REGULAR or payable for COMPOSITION depending on restaurant setup), AOV, cancellation rate, and payment method breakdown (CASH, UPI, CARD, etc.).',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start date' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end date' }
          }
        }
      },
      {
        name: 'getSalesTrend',
        description: 'Returns daily/weekly/monthly sales trend, order counts, and revenue breakdown.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: { type: 'STRING', enum: ['daily', 'weekly', 'monthly'], description: 'Trend granularity' },
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getHourlySales',
        description: 'Returns hourly sales and order counts (0-23) for peak rush analysis.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTopProducts',
        description: 'Returns highest performing products by quantity sold and revenue.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
            limit: { type: 'INTEGER', description: 'Max items to return (default 10)' }
          }
        }
      },
      {
        name: 'getBottomProducts',
        description: 'Returns lowest performing menu items or zero sales items.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
            limit: { type: 'INTEGER', description: 'Max items to return (default 10)' }
          }
        }
      },
      {
        name: 'getCategoryPerformance',
        description: 'Returns sales breakdown by menu section/category.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getAverageOrderValue',
        description: 'Returns Average Order Value (AOV) and revenue over a date range.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },

      {
        name: 'getCancellationRate',
        description: 'Returns cancellation stats, cancelled order count, % and revenue lost. Defaults to today date if date_from and date_to are omitted.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start date (optional, defaults to today)' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end date (optional, defaults to today)' }
          }
        }
      },
      {
        name: 'comparePeriods',
        description: 'Compares revenue, order volume, AOV between two date ranges with variance %.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period1_from: { type: 'STRING', description: 'Period 1 YYYY-MM-DD start' },
            period1_to: { type: 'STRING', description: 'Period 1 YYYY-MM-DD end' },
            period2_from: { type: 'STRING', description: 'Period 2 YYYY-MM-DD start' },
            period2_to: { type: 'STRING', description: 'Period 2 YYYY-MM-DD end' }
          },
          required: ['period1_from', 'period1_to', 'period2_from', 'period2_to']
        }
      },
      {
        name: 'getInventorySummary',
        description: 'Returns current inventory status, low stock count, and out-of-stock items.',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'searchRestaurantKnowledge',
        description: 'Returns general restaurant configuration, operating hours, active staff count, and menu categories.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Knowledge field to query' }
          }
        }
      },
      {
        name: 'getHolidays',
        description: 'Returns public, national, and state holidays within date range.',
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: { type: 'STRING', description: 'YYYY-MM-DD start' },
            endDate: { type: 'STRING', description: 'YYYY-MM-DD end' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getWeather',
        description: 'Returns weather metrics (temperature, rainfall, conditions) using Open-Meteo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: { type: 'STRING', description: 'YYYY-MM-DD start' },
            endDate: { type: 'STRING', description: 'YYYY-MM-DD end' },
            includeHourly: { type: 'BOOLEAN', description: 'True for hourly weather breakdown.' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'getTableOccupancy',
        description: 'Returns table occupancy rate, total tables, occupied tables, and available tables for a date range.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTableTurnover',
        description: 'Returns table turnover rate, total completed table sessions, and average turn time in minutes.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getAverageTableTurnTime',
        description: 'Returns average, fastest, and slowest table turn times in minutes for closed table sessions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTableUtilization',
        description: 'Returns total available table hours, occupied table hours, and utilization percentage.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTableUsageByHour',
        description: 'Returns hourly breakdown (0-23) of table sessions and occupancy percentage.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTablePerformance',
        description: 'Returns table-by-table performance stats including sessions, revenue, party size, and turn time.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getTopTablesByRevenue',
        description: 'Returns top tables ranked by revenue generated.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
            limit: { type: 'NUMBER', description: 'Number of top tables to return' }
          }
        }
      },
      {
        name: 'getBottomTablesByRevenue',
        description: 'Returns lowest revenue-generating tables for optimization analysis.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' },
            limit: { type: 'NUMBER', description: 'Number of bottom tables to return' }
          }
        }
      },
      {
        name: 'getTableCapacityPerformance',
        description: 'Returns seat utilization efficiency by comparing average party size to table capacity.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      },
      {
        name: 'getRevenuePerTableHour',
        description: 'Returns total table revenue, total occupied table hours, and revenue per table hour.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date_from: { type: 'STRING', description: 'YYYY-MM-DD start' },
            date_to: { type: 'STRING', description: 'YYYY-MM-DD end' }
          }
        }
      }
    ]
  }
];

const ANALYST_SYSTEM_INSTRUCTION = `You are Qdine AI Business Analyst, an AI-powered restaurant business analyst.

Your responsibility is to analyze restaurant performance using verified data from sales, orders, table sessions & occupancy, inventory, restaurant knowledge, weather & holidays.

Core Rules:
1. Never invent business data:
   Never make up Revenue, Order count, Table turnover/occupancy, Product sales, Inventory quantities, Cancellation rates, Weather data, Holidays, Percentages, Trends, or Business dates.
   If required information is unavailable, clearly state that the data is unavailable.

2. Never directly access the database or write SQL:
   Strictly use provided tool functions to query restaurant data.

3. Table Analytics & Session Rules:
   - Use table analytics tools (getTableOccupancy, getTableTurnover, getAverageTableTurnTime, getTableUtilization, getTableUsageByHour, getTablePerformance, getTopTablesByRevenue, getBottomTablesByRevenue, getTableCapacityPerformance, getRevenuePerTableHour) for queries regarding table performance, turnover, occupancy, seat utilization, and revenue per table hour.
   - Respect restaurant_id and date range filters (date_from, date_to).

4. Tool Selection & Efficiency Rules:
   - Execute all needed tools in 1 turn concurrently whenever multiple tools are required.
   - For comparisons between multiple date ranges (e.g. today vs yesterday), request all date-specific tool calls together in 1 single turn concurrently (e.g. call getHourlySales for date 1 AND getHourlySales for date 2 in the same turn).
   - For demand forecasting, dish prep planning, or targets for tomorrow/future dates, you MUST ALWAYS call 'getTopProducts' (or 'getSalesSummary'), 'getHolidays', and 'getWeather' CONCURRENTLY in 1 single turn.
   - All tool date parameters default automatically to today's business date. Never call searchRestaurantKnowledge just to look up today's date.
   - Never call searchRestaurantKnowledge unless specifically asked about staff, operating hours, or restaurant settings.
   - Never re-call the same tool function with identical arguments if you have already received its data in Turn 1.

5. Demand Forecasting, Weather & Holiday Analysis Rules:
   - When estimating prep targets for tomorrow/future dates, calculate baseline sales from past days, then adjust using:
     • Holiday impact (e.g., public holidays/festivals increase order volume).
     • Weather impact (e.g., heavy rain increases hot item/biryani/tea delivery demand, mild rain affects dine-in).
   - Explicitly mention the holiday status and weather forecast for tomorrow in your response when giving prep advice.

6. Concise Answer Formatting (Token Efficient):
   - Direct, brief, and concise.
   - No unnecessary recommendations or filler text unless explicitly requested.
   - Format currency in INR (₹). Short 2-4 bullet points max.`;

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

    // 4. Fetch global config & max output tokens for BUSINESS_ANALYST_CHAT
    const historyRes = await pool.query(
      `SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [sessionId]
    );

    let rawMsgs = historyRes.rows.reverse();
    // Gemini API requirement: first message in contents MUST have role 'user'
    while (rawMsgs.length > 0 && rawMsgs[0].role !== 'user') {
      rawMsgs.shift();
    }

    const contents: GeminiContent[] = rawMsgs.map(msg => ({
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
    let totalInputTokens = 0;
    let iterations = 0;
    const maxIterations = 5;

    try {
      while (iterations < maxIterations) {
        iterations++;

        const todayDate = new Date().toISOString().split('T')[0];
        const dynamicSystemInstruction = `${ANALYST_SYSTEM_INSTRUCTION}\n\nCurrent Business Date / Today: ${todayDate}`;

        const requestBody: any = {
          contents: currentContents,
          systemInstruction: {
            parts: [{ text: dynamicSystemInstruction }]
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
          throw new Error(`Gemini API returned status ${response?.status}: ${errText}`);
        }

        const resJson = await response.json();
        const usage = resJson.usageMetadata || {};
        console.log('📊 Gemini API usageMetadata:', JSON.stringify(usage, null, 2));
        if (usage.promptTokenCount) totalInputTokens += usage.promptTokenCount;
        if (usage.candidatesTokenCount) totalOutputTokens += usage.candidatesTokenCount;

        const candidate = resJson.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        const functionCallParts = parts.filter((p: any) => p.functionCall);

        if (functionCallParts.length > 0) {
          const batchStartTime = Date.now();
          console.log(
            `⚡ [Qdine Orchestrator] Gemini requested ${functionCallParts.length} concurrent tool call(s):`,
            functionCallParts.map((p: any) => p.functionCall.name)
          );

          // Execute all independent tool calls concurrently via Promise.all with 10s timeout protection
          const toolResults = await Promise.all(
            functionCallParts.map(async (part: any) => {
              const { name, args } = part.functionCall;
              const toolStartTime = Date.now();
              try {
               const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error(`Tool ${name} execution timed out`)), 10000)
                );

                const rawResult = await Promise.race([
                  executeAnalystToolCall(restaurantId, name, args || {}),
                  timeoutPromise
                ]); 

                const duration = Date.now() - toolStartTime;
                console.log(`✅ Tool ${name} completed successfully in ${duration}ms`);

                const formattedResult = typeof rawResult === 'object' && rawResult !== null ? rawResult : { result: rawResult };
                return { name, args, success: true, result: formattedResult, durationMs: duration };
              } catch (toolErr: any) {
                const duration = Date.now() - toolStartTime;
                console.error(`❌ Tool ${name} failed in ${duration}ms:`, toolErr.message);

                return {
                  name,
                  args,
                  success: false,
                  result: { success: false, error: toolErr.message || 'Tool execution failed' },
                  error: toolErr.message,
                  durationMs: duration
                };
              }
            })
          );

          const batchDuration = Date.now() - batchStartTime;
          console.log(`🚀 [Qdine Orchestrator] Concurrently completed ${toolResults.length} tool(s) in ${batchDuration}ms`);

          // Record executed tool calls for chat history & DB persistence
          toolResults.forEach(tr => {
            executedToolCalls.push({ name: tr.name, args: tr.args, result: tr.result });
          });

          // Append Gemini's function call turn to conversation
          currentContents.push(candidate.content);

          // Build single turn containing ALL function response parts for Gemini
          const functionResponseParts = toolResults.map(tr => ({
            functionResponse: {
              name: tr.name,
              response: tr.result
            }
          }));

          // Append tool response turn to conversation
          currentContents.push({
            role: 'user',
            parts: functionResponseParts
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
      const finalInputTokens = totalInputTokens || estimatedInputTokens;
      const totalTokens = finalInputTokens + totalOutputTokens;

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
        inputTokens: finalInputTokens,
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
          input: finalInputTokens,
          output: totalOutputTokens,
          total: totalTokens
        }
      };

    } catch (err: any) {
      const responseTimeMs = Date.now() - startTime;
      console.error('AI Analyst processChat error:', err);
      const finalInputTokens = totalInputTokens || estimatedInputTokens;

      await AIRepository.logRequestUsage({
        restaurantId,
        requestType: ANALYST_REQUEST_TYPE,
        model,
        inputTokens: finalInputTokens,
        outputTokens: 0,
        totalTokens: finalInputTokens,
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
