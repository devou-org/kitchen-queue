import readline from 'readline';
import { createDefaultAIModuleRegistry } from '../registry/ai-module.registry';
import { AIModuleRouter } from '../router/ai-module.router';

const registry = createDefaultAIModuleRegistry();
const router = new AIModuleRouter(registry);
const totalTools = registry.getDeclarationsForModules(registry.getAllModuleNames())[0]?.functionDeclarations.length || 23;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n===============================================================');
console.log('🤖 QDINE AI MODULE ROUTER - INTERACTIVE TESTING CONSOLE');
console.log('===============================================================');
console.log('Type any question to see how the Router classifies it and prunes tools.');
console.log('Type "exit" or press Ctrl+C to quit.\n');

function promptUser() {
  rl.question('💬 Ask Qdine AI > ', async (input) => {
    const question = input.trim();
    if (!question) {
      promptUser();
      return;
    }
    if (question.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    const result = await router.resolveModules(question);
    const declarations = registry.getDeclarationsForModules(result.selectedModules)[0]?.functionDeclarations || [];
    const loadedCount = declarations.length;
    const tokenReduction = Math.round((1 - (loadedCount / totalTools)) * 100);

    console.log('\n----------------- ROUTING DECISION -----------------');
    console.log(`📌 Identified Modules : [ ${result.selectedModules.join(', ')} ]`);
    console.log(`⭐ Primary Module     : ${result.primaryModule}`);
    console.log(`⚡ Routing Latency    : ${result.routingDurationMs} ms`);
    console.log(`🎯 Confidence Score   : ${Math.round(result.confidence * 100)}% (Fallback: ${result.isFallback})`);
    console.log(`📦 Loaded Tool Count  : ${loadedCount} of ${totalTools} tools`);
    console.log(`📉 Schema Token Save  : ${tokenReduction}% reduction`);
    console.log(`🔧 Injected Schemas   : ${declarations.map(d => d.name).join(', ')}`);
    console.log('----------------------------------------------------\n');

    promptUser();
  });
}

promptUser();
