# Technical Design Document: Qdine AI Dynamic Module Routing & Modular Tool Injection

**Author:** Navaneeth & Engineering Team  
**Date:** November 2026  
**Status:** Proposal / Ready for Review  
**Target:** Engineering Team & Architecture Review (Discord / DC)  

---

## 1. Executive Summary

As Qdine expands its feature set across Sales Analytics, Table Turnover & Occupancy, Real-Time Inventory, Restaurant Knowledge, and External Context (Weather & Holidays), our AI Analyst feature has outgrown its original monolithic function-calling design.

Currently, **all 22+ tool definitions are loaded into the Gemini API prompt on every single user interaction**, regardless of whether the user is asking about today's gross revenue or table turnaround time. This design leads to **high latency (6s–11s)**, **unnecessary token burn (~4,500 tokens of static schema per turn)**, and **heightened hallucination risk**.

This document proposes transitioning to an **Intent-Based Dynamic Module Router** built on **Dependency Injection (DI)** principles. The AI identifies the relevant domain module(s), loads only the required function declarations into the LLM context, executes queries concurrently, and logs execution telemetry to strictly adhere to a **< 5s response time SLA**.

---

## 2. Deep Dive: Pain Points in the Legacy Prompting & Tooling Model

### 2.1 The Legacy Flow
```
User Message ("What was my sales today?")
       │
       ▼
[AIAnalystService.processChat]
       │
       ├── Statically imports ANALYST_TOOLS_DECLARATIONS (22+ tools, 1,100 lines)
       ├── Injects ALL 22 schemas into Gemini request payload
       │
       ▼
Gemini LLM (Evaluates 4,500+ tokens of schemas across 5 distinct domains)
       │
       ├── LLM parses 22 function schemas
       ├── LLM chooses `getSalesSummary`
       │
       ▼
executeAnalystToolCall() in ai-analyst.tools.ts (Monolithic 1,100-line switch/case)
       │
       ▼
Response Generation (Total Turnaround: 6.8s - 10.5s)
```

### 2.2 Core Problems Identified

| Problem Area | Legacy Method (Monolithic Prompting) | Impact on System & User |
| :--- | :--- | :--- |
| **Token Bloat** | Every prompt payload includes **22 full JSON schemas** (~4,500 tokens) even for trivial questions like *"Hi"* or *"What's today's revenue?"*. | Inflates cost per query by 400% and burns restaurant AI credits prematurely. |
| **Response Latency** | Gemini's Time-To-First-Token (TTFT) scales with input context length. Evaluating 22 function declarations forces the model to attend over massive parameter trees before emitting a function call. | Observed latency regularly hits **7s–11s**, violating the **< 5s** target. |
| **Hallucination & Cross-Domain Confusion** | The model is exposed to tools it should not touch (e.g. `getTableTurnover` or `getWeather` when answering a sales cancellation question). | The model occasionally attempts multi-step hops or invokes unrelated tools in attempt to be "helpful". |
| **Code Coupling & Zero DI** | `ai-analyst.tools.ts` is an **1,100-line file** containing raw SQL (`pool.query`), business logic, and API calls. None of the tools can be unit-tested without a live PostgreSQL instance. | Zero modularity, fragile refactoring, and merge conflicts across developer teams. |
| **Lack of Module Isolation** | There is no boundary between table analytics, financial metrics, and inventory data. | Adding a new module (e.g., Marketing, Loyalty) requires modifying global declarations and massive switch-case blocks. |

---

## 3. The New Architecture: Dynamic Intent Routing & Dependency Injected Modules

```
                    ┌──────────────────────────────┐
                    │      Admin User Prompt       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Auth & Credit Validation   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     AI Module Router         │
                    │   (Fast Intent Classifier)   │
                    └──────────────┬───────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │ Detects: ['sales', 'external']      │
                ▼                                     ▼
   ┌─────────────────────────┐           ┌─────────────────────────┐
   │       SalesModule       │           │     ExternalModule      │
   │  (getSalesSummary, ...) │           │  (getWeather, ...)      │
   └────────────┬────────────┘           └────────────┬────────────┘
                │                                     │
                └──────────────────┬──────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Gemini Function Calling API  │
                    │ (Only 4 tools injected!)     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Parallel Tool Dispatcher   │
                    │  (Concurrent Promise.all)    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Gemini Synthesizes Answer  │
                    │  (Response generated < 5s)   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Performance Logging & Audit  │
                    └──────────────────────────────┘
```

### 3.1 Key Architectural Decisions

1. **Lightweight Intent Classifier (Phase 1 Routing)**:
   - Evaluates the user's prompt against semantic trigger dictionaries and lightweight keyword patterns.
   - Maps input into one or more module tags: `'sales'`, `'tables'`, `'inventory'`, `'knowledge'`, `'external'`.
   - Executes in **< 10ms**, adding virtually zero latency overhead.
   - Ambiguous queries fall back to a curated composite set (`['sales', 'tables']`), rather than dumping all 22 tools.

2. **Dependency-Injected Module Subsystems (`IAIModule`)**:
   - Each domain is an isolated class implementing `IAIModule`.
   - Dependencies (e.g., PostgreSQL client/pool, repository interfaces, external API fetchers) are injected through the constructor.
   - Modules can be unit-tested using mocked database repositories.

3. **Multi-Module Query Support**:
   - Complex questions like *"Forecast my prep list for tomorrow based on sales and rain forecast"* are routed to **both** `sales` and `external` modules.
   - The tool aggregator merges the schemas and routes outgoing tool calls to their respective module handlers.

4. **Parallel Scatter-Gather Tool Execution**:
   - When Gemini requests multiple tool calls in a single turn, they execute concurrently via `Promise.all` with a strict per-tool timeout guard (e.g., 3.5s).

5. **Performance Telemetry & Resilience**:
   - Tracks routing duration, tool execution duration, and LLM inference time.
   - Retries failed requests up to **3 times** with exponential backoff for transient 503/429 errors.

---

## 4. Proposed File Structure

```text
src/modules/ai/
├── ai-analyst.service.ts              # Streamlined orchestrator (session, auth, LLM loop)
├── ai.repository.ts                   # Quota, credits, session DB persistence
├── ai.service.ts                      # Gemini API client & token utilities
│
├── router/
│   ├── ai-module.router.ts            # Fast Intent Classifier & module route resolver
│   ├── ai-module.types.ts             # Domain enum, context interfaces, routing types
│   └── intent-dictionary.ts           # Keyword/semantic matching heuristics
│
├── registry/
│   └── ai-module.registry.ts          # DI Container registering active IAIModules
│
└── modules/
    ├── ai-module.interface.ts         # IAIModule contract (declarations + execute)
    │
    ├── sales/
    │   ├── sales.module.ts            # SalesAIModule (implements IAIModule)
    │   ├── sales.declarations.ts      # Gemini Function Declarations for sales
    │   └── sales.service.ts           # Sales DB queries (isolated)
    │
    ├── tables/
    │   ├── tables.module.ts           # TablesAIModule (implements IAIModule)
    │   ├── tables.declarations.ts     # Gemini Function Declarations for tables
    │   └── tables.service.ts          # Table occupancy & turnover queries
    │
    ├── inventory/
    │   ├── inventory.module.ts        # InventoryAIModule (implements IAIModule)
    │   ├── inventory.declarations.ts  # Inventory schemas
    │   └── inventory.service.ts       # Stock summary & alerts
    │
    ├── knowledge/
    │   ├── knowledge.module.ts        # KnowledgeAIModule (implements IAIModule)
    │   ├── knowledge.declarations.ts  # Knowledge schemas
    │   └── knowledge.service.ts       # Operating hours, staff count, store settings
    │
    └── external/
        ├── external.module.ts         # ExternalAIModule (implements IAIModule)
        ├── external.declarations.ts   # Weather & holiday schemas
        └── services/
            ├── weather.service.ts     # Weather API integration
            └── holiday.service.ts     # Public holidays calendar
```

---

## 5. Implementation Blueprint

### 5.1 The `IAIModule` Interface
```typescript
// src/modules/ai/modules/ai-module.interface.ts
export type AIModuleName = 'sales' | 'tables' | 'inventory' | 'knowledge' | 'external';

export interface AIExecutionContext {
  restaurantId: string;
  businessDate: string;
  timezone?: string;
}

export interface IAIModule {
  readonly name: AIModuleName;
  readonly description: string;

  /**
   * Returns only this module's Gemini Function Declaration schemas
   */
  getFunctionDeclarations(): any[];

  /**
   * Executes a tool belonging to this module
   */
  execute(
    functionName: string, 
    args: any, 
    context: AIExecutionContext
  ): Promise<any>;
}
```

### 5.2 Dependency Injection Container (`AIModuleRegistry`)
```typescript
// src/modules/ai/registry/ai-module.registry.ts
export class AIModuleRegistry {
  private modules = new Map<AIModuleName, IAIModule>();

  register(module: IAIModule): void {
    this.modules.set(module.name, module);
  }

  getModule(name: AIModuleName): IAIModule | undefined {
    return this.modules.get(name);
  }

  getDeclarationsForModules(names: AIModuleName[]): any[] {
    const declarations: any[] = [];
    for (const name of names) {
      const mod = this.modules.get(name);
      if (mod) {
        declarations.push(...mod.getFunctionDeclarations());
      }
    }
    return [{ functionDeclarations: declarations }];
  }

  async executeTool(
    functionName: string, 
    args: any, 
    context: AIExecutionContext
  ): Promise<any> {
    for (const module of this.modules.values()) {
      const hasTool = module.getFunctionDeclarations().some(d => d.name === functionName);
      if (hasTool) {
        return await module.execute(functionName, args, context);
      }
    }
    throw new Error(`Tool "${functionName}" is not registered in any active module.`);
  }
}
```

---

## 6. Comprehensive Test Scenarios Matrix

| Scenario ID | Test Case Category | User Input Prompt | Expected Module(s) Routed | Expected Tool(s) Loaded | Negative Check (Must NOT Load) | Target SLA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Single Domain: Sales** | *"What was my total revenue and order count for today?"* | `['sales']` | `getSalesSummary`, `getSalesTrend` | `getTableOccupancy`, `getWeather`, `getInventorySummary` | < 3.5s |
| **TC-02** | **Single Domain: Tables** | *"Which table had the highest turnover time during lunch?"* | `['tables']` | `getTableTurnover`, `getAverageTableTurnTime` | `getSalesSummary`, `getHolidays`, `searchRestaurantKnowledge` | < 3.5s |
| **TC-03** | **Single Domain: Inventory** | *"Show me items that are running critically low on stock."* | `['inventory']` | `getInventorySummary` | `getTablePerformance`, `getSalesTrend` | < 3.0s |
| **TC-04** | **Multi-Domain: Sales + External** | *"Forecast prep targets for tomorrow considering weather and festivals."* | `['sales', 'external']` | `getTopProducts`, `getWeather`, `getHolidays` | `getTableUtilization`, `searchRestaurantKnowledge` | < 4.8s |
| **TC-05** | **Multi-Domain: Tables + Sales** | *"Which dining tables generate the highest revenue per hour?"* | `['tables', 'sales']` | `getRevenuePerTableHour`, `getTopTablesByRevenue` | `getWeather`, `getInventorySummary` | < 4.5s |
| **TC-06** | **General / Ambiguous Query** | *"How did the restaurant perform overall today?"* | `['sales', 'tables']` (Curated Default) | `getSalesSummary`, `getTableOccupancy` | `getWeather`, `getHolidays` | < 4.0s |
| **TC-07** | **Multi-Turn Contextual Follow-up** | **Turn 1**: *"What were my sales today?"*<br>**Turn 2**: *"What about yesterday?"* | `['sales']` (Inherited from Session Context) | `getSalesSummary` | Unrelated tools | < 3.0s |
| **TC-08** | **Parallel Execution Benchmark** | *"Compare today's hourly peak orders against yesterday."* | `['sales']` | Concurrent calls to `getHourlySales(today)` & `getHourlySales(yesterday)` via `Promise.all` | Sequential tool execution | < 4.2s |
| **TC-09** | **Fault Tolerance & Retry** | Upstream Gemini API responds with 503 Service Unavailable | `['sales']` | Automatically retry up to 3 times with exponential backoff | Premature failure without retry | Max 3 retries |
| **TC-10** | **Execution Timeout Protection** | Tool execution DB query hangs past 3.5s | Target module | Aborts hanging tool with timeout error; Gemini generates fallback explanation | Unhandled gateway 504 timeout | < 5.0s |

---

## 7. Performance Benchmarks: Before vs. After (Expected)

```text
Metric                          Legacy Monolithic Model      Proposed Modular DI Router     Improvement
─────────────────────────────────────────────────────────────────────────────────────────────────────────
Schema Input Tokens             ~4,500 tokens (All 22 tools) ~600 - 1,200 tokens (3-5 tools) 73% Reduction
Router Execution Overhead       0 ms (Static)                4 - 12 ms (Heuristic classifier) Negligible
Time-To-First-Token (TTFT)      3.8s - 5.5s                  1.4s - 2.1s                    ~60% Faster
Total End-to-End Latency        6.8s - 10.5s                 2.8s - 4.6s                    Meets < 5s SLA
Cross-Tool Hallucination Rate   ~8.4%                        < 0.5%                         Eliminated
Testability / Decoupling        0% (1,100 line monolith)     100% (Isolated DI modules)     Full Coverage
```

---



