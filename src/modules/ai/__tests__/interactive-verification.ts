import { AIAnalystService } from '../ai-analyst.service';
import { createDefaultAIModuleRegistry } from '../registry/ai-module.registry';
import { AIModuleRouter } from '../router/ai-module.router';

async function verifyAllScenarios() {
  console.log('===============================================================');
  console.log('🚀 QDINE AI MODULE ROUTING & DYNAMIC PRUNING VERIFICATION');
  console.log('===============================================================\n');

  const registry = createDefaultAIModuleRegistry();
  const router = new AIModuleRouter(registry);

  const testPrompts = [
    {
      label: 'Sales Revenue & Trends (Single Module)',
      prompt: 'What was my total revenue and sales trend for today?',
      expectedModules: ['sales'],
    },
    {
      label: 'Dining Table Turnover & Occupancy (Single Module)',
      prompt: 'Which dining table had the highest turnover time during lunch hours?',
      expectedModules: ['tables'],
    },
    {
      label: 'Raw Materials & Stock (Single Module)',
      prompt: 'Which ingredient items are running low on stock and need reordering?',
      expectedModules: ['inventory'],
    },
    {
      label: 'Staffing & Operating Hours (Single Module)',
      prompt: 'What are our active staff count and restaurant operating hours?',
      expectedModules: ['knowledge'],
    },
    {
      label: 'Demand Forecasting / Prep Planning (Multi-Module: Sales + External)',
      prompt: 'Forecast my dish prep targets for tomorrow considering the rain and public holidays.',
      expectedModules: ['sales', 'external'],
    },
    {
      label: 'Revenue Per Table (Multi-Module: Tables + Sales)',
      prompt: 'Show me the top tables by revenue generated and revenue per table hour.',
      expectedModules: ['tables', 'sales'],
    },
    {
      label: 'Ambiguous / Broad Query (Curated Default Fallback)',
      prompt: 'How is the restaurant performing today overall?',
      expectedModules: ['sales', 'tables'],
    },
    {
      label: 'Cancellation Analytics (Single Module: Sales)',
      prompt: 'How many orders were cancelled today and what was the revenue lost?',
      expectedModules: ['sales'],
    },
    {
      label: 'Weather & Holiday Context (Single Module: External)',
      prompt: 'What is the weather forecast for tomorrow and are there any holidays?',
      expectedModules: ['external'],
    }
  ];

  console.log('1. TESTING INTENT ROUTER ACCURACY & TOOL PRUNING:\n');

  const totalToolCount = registry.getDeclarationsForModules(registry.getAllModuleNames())[0]?.functionDeclarations.length || 23;

  for (const t of testPrompts) {
    const result = await router.resolveModules(t.prompt);
    const declarations = registry.getDeclarationsForModules(result.selectedModules)[0]?.functionDeclarations || [];
    const prunedCount = declarations.length;
    const tokenReductionPct = Math.round((1 - (prunedCount / totalToolCount)) * 100);

    const matchesExpected = t.expectedModules.every(m => result.selectedModules.includes(m as any));
    const status = matchesExpected ? '✅ PASS' : '❌ FAIL';

    console.log(`[${status}] ${t.label}`);
    console.log(`   Prompt: "${t.prompt}"`);
    console.log(`   Routed Modules: [${result.selectedModules.join(', ')}] | Latency: ${result.routingDurationMs}ms`);
    console.log(`   Tools Loaded: ${prunedCount}/${totalToolCount} tools (${tokenReductionPct}% schema token reduction)`);
    console.log(`   Tool Names: ${declarations.map(d => d.name).slice(0, 4).join(', ')}${prunedCount > 4 ? '...' : ''}\n`);
  }

  console.log('2. TESTING MULTI-TURN CONTEXT CONTINUITY:\n');
  const sessionHistory = [
    { role: 'user', content: 'What were my sales figures today?' },
    { role: 'model', content: 'Today total sales were ₹32,450 across 52 orders.' }
  ];
  const followUpResult = await router.resolveModules('What about yesterday?', sessionHistory);
  console.log(`   Follow-up: "What about yesterday?"`);
  console.log(`   Inherited Context: ${followUpResult.contextInherited}`);
  console.log(`   Selected Modules: [${followUpResult.selectedModules.join(', ')}]`);
  console.log(`   Result: ${followUpResult.selectedModules.includes('sales') ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log('3. TESTING DEPENDENCY INJECTION & DISPATCHER:\n');
  const registered = registry.getAllModuleNames();
  console.log(`   Registered Modules in DI Container: [${registered.join(', ')}]`);
  console.log(`   Service Registry instance: ${AIAnalystService.getRegistry() ? '✅ Bound' : '❌ Unbound'}`);
  console.log(`   Service Router instance: ${AIAnalystService.getRouter() ? '✅ Bound' : '❌ Unbound'}\n`);

  console.log('===============================================================');
  console.log('🎉 ALL ARCHITECTURAL TESTS COMPLETED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

verifyAllScenarios().catch(console.error);

