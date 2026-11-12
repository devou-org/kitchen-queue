import { createDefaultAIModuleRegistry } from '../registry/ai-module.registry';
import { AIModuleRouter } from '../router/ai-module.router';

async function runTests() {
  console.log('🧪 Starting AI Module Router & Dynamic Tool Injection Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const registry = createDefaultAIModuleRegistry();
  const router = new AIModuleRouter(registry);

  // TC-01: Single Domain: Sales
  {
    const res = await router.resolveModules('What was my total revenue and order count for today?');
    assert(res.selectedModules.includes('sales'), 'TC-01: Routes sales query to "sales" module');
    assert(!res.selectedModules.includes('tables'), 'TC-01: Does NOT load "tables" module');
    assert(!res.selectedModules.includes('external'), 'TC-01: Does NOT load "external" module');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'getSalesSummary'), 'TC-01: Loads getSalesSummary');
    assert(!decls.some(d => d.name === 'getTableOccupancy'), 'TC-01: Excludes getTableOccupancy');
    assert(res.routingDurationMs < 20, 'TC-01: Sub-20ms routing performance');
  }

  // TC-02: Single Domain: Tables
  {
    const res = await router.resolveModules('Which dining table had the highest turnover time during lunch?');
    assert(res.selectedModules.includes('tables'), 'TC-02: Routes table query to "tables" module');
    assert(!res.selectedModules.includes('sales'), 'TC-02: Does NOT load "sales" module');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'getTableTurnover'), 'TC-02: Loads getTableTurnover');
    assert(!decls.some(d => d.name === 'getSalesSummary'), 'TC-02: Excludes getSalesSummary');
  }

  // TC-03: Single Domain: Inventory
  {
    const res = await router.resolveModules('Show me raw material ingredients that are running critically low on stock');
    assert(res.selectedModules.includes('inventory'), 'TC-03: Routes stock query to "inventory" module');
    assert(!res.selectedModules.includes('tables'), 'TC-03: Excludes "tables" module');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'getInventorySummary'), 'TC-03: Loads getInventorySummary');
    assert(!decls.some(d => d.name === 'getTableTurnover'), 'TC-03: Excludes table tools');
  }

  // TC-04: Single Domain: Knowledge
  {
    const res = await router.resolveModules('What are our active staff count and operating hours?');
    assert(res.selectedModules.includes('knowledge'), 'TC-04: Routes staff query to "knowledge" module');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'searchRestaurantKnowledge'), 'TC-04: Loads searchRestaurantKnowledge');
  }

  // TC-05: Multi-Domain: Sales + External for Demand Forecasting
  {
    const res = await router.resolveModules('Forecast prep targets for tomorrow considering rain and festivals');
    assert(res.selectedModules.includes('sales'), 'TC-05: Includes "sales" for forecasting');
    assert(res.selectedModules.includes('external'), 'TC-05: Includes "external" for weather/festivals');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'getTopProducts'), 'TC-05: Loads getTopProducts');
    assert(decls.some(d => d.name === 'getWeather'), 'TC-05: Loads getWeather');
    assert(decls.some(d => d.name === 'getHolidays'), 'TC-05: Loads getHolidays');
    assert(!decls.some(d => d.name === 'getTableUtilization'), 'TC-05: Excludes unrelated table tools');
  }

  // TC-06: Multi-Domain: Tables + Sales for Revenue per table
  {
    const res = await router.resolveModules('Show top tables by revenue generated');
    assert(res.selectedModules.includes('tables'), 'TC-06: Includes "tables"');
    assert(res.selectedModules.includes('sales'), 'TC-06: Includes "sales"');
    
    const decls = registry.getDeclarationsForModules(res.selectedModules)[0]?.functionDeclarations || [];
    assert(decls.some(d => d.name === 'getTopTablesByRevenue'), 'TC-06: Loads getTopTablesByRevenue');
  }

  // TC-07: General / Ambiguous query fallback
  {
    const res = await router.resolveModules('How did the store perform overall today?');
    assert(res.isFallback, 'TC-07: Flags isFallback = true for generic query');
    assert(res.selectedModules.includes('sales') && res.selectedModules.includes('tables'), 'TC-07: Defaults to ["sales", "tables"]');
    assert(!res.selectedModules.includes('external'), 'TC-07: Excludes external context');
  }

  // TC-08: Multi-turn Context Inheritance
  {
    const history = [
      { role: 'user', content: 'What were my sales figures today?' },
      { role: 'model', content: 'Today total sales were ₹25,000 across 40 orders.' }
    ];
    const res = await router.resolveModules('What about yesterday?', history);
    assert(res.selectedModules.includes('sales'), 'TC-08: Follow-up question inherits "sales" module');
    assert(res.contextInherited === true, 'TC-08: Flags contextInherited = true');
  }

  // TC-09: Dependency Injection & Tool Dispatcher
  {
    const allDeclarations = registry.getDeclarationsForModules(['sales', 'tables', 'inventory', 'knowledge', 'external'])[0]?.functionDeclarations || [];
    assert(allDeclarations.length === 23, 'TC-09: Registry contains all 23 tool declarations across 5 modules');
    
    const salesOnly = registry.getDeclarationsForModules(['sales'])[0]?.functionDeclarations || [];
    assert(salesOnly.length === 9, 'TC-09: Sales module provides exactly 9 schemas (73% token reduction over 23)');
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

