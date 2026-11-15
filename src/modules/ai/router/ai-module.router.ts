import { AIModuleName } from '../modules/ai-module.interface';
import { AIModuleRegistry } from '../registry/ai-module.registry';
import { ModuleRoutingResult } from './ai-module.types';
import {
  MODULE_INTENT_RULES,
  CROSS_MODULE_COMPOUND_TRIGGERS,
  FOLLOW_UP_PATTERNS
} from './intent-dictionary';

export class AIModuleRouter {
  constructor(private registry: AIModuleRegistry) {}

  /**
   * Identifies and routes a user prompt to the relevant module(s).
   * Runs in sub-10ms using deterministic semantic heuristics, regex tokenization,
   * cross-module compound detection, and conversation history context inheritance.
   */
  async resolveModules(
    message: string,
    history?: Array<{ role: string; content: string }>
  ): Promise<ModuleRoutingResult> {
    const startTime = Date.now();
    const cleanMessage = (message || '').trim();
    const matchedModules = new Set<AIModuleName>();
    const matchedKeywords: string[] = [];

    // 1. Check for Cross-Module Compound Triggers
    for (const compound of CROSS_MODULE_COMPOUND_TRIGGERS) {
      if (compound.pattern.test(cleanMessage)) {
        compound.modules.forEach(m => matchedModules.add(m));
        matchedKeywords.push(`compound:${compound.pattern.source}`);
      }
    }

    // 2. Score individual module rules
    const moduleScores = new Map<AIModuleName, number>();

    for (const rule of MODULE_INTENT_RULES) {
      let score = 0;

      // Pattern matching
      for (const pattern of rule.patterns) {
        if (pattern.test(cleanMessage)) {
          score += 3;
          matchedKeywords.push(pattern.source);
        }
      }

      // Keyword substring matching (case-insensitive)
      const lower = cleanMessage.toLowerCase();
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) {
          score += 1;
          matchedKeywords.push(kw);
        }
      }

      if (score > 0) {
        moduleScores.set(rule.module, (moduleScores.get(rule.module) || 0) + score);
        matchedModules.add(rule.module);
      }
    }

    // 3. Multi-turn context inheritance for follow-up questions (e.g., "What about yesterday?")
    let contextInherited = false;
    const isFollowUp = FOLLOW_UP_PATTERNS.some(p => p.test(cleanMessage));

    if ((matchedModules.size === 0 || isFollowUp) && Array.isArray(history) && history.length > 0) {
      // Find the last user message in conversation history
      const previousUserMsgs = history.filter(m => m.role === 'user');
      const lastUserMsg = previousUserMsgs[previousUserMsgs.length - 1]?.content;

      if (lastUserMsg) {
        for (const rule of MODULE_INTENT_RULES) {
          if (rule.patterns.some(p => p.test(lastUserMsg))) {
            matchedModules.add(rule.module);
            contextInherited = true;
          }
        }
      }
    }

    // 4. Fallback Handling
    // If no specific intent was detected (e.g. "How is everything today?"),
    // default to core operational modules ('sales' and 'tables') rather than dumping all modules.
    let isFallback = false;
    let selectedModules = Array.from(matchedModules);

    if (selectedModules.length === 0) {
      isFallback = true;
      selectedModules = ['sales', 'tables'];
    }

    // Verify all selected modules exist in the registry
    const availableModules = this.registry.getAllModuleNames();
    selectedModules = selectedModules.filter(m => availableModules.includes(m));

    if (selectedModules.length === 0) {
      selectedModules = ['sales'];
    }

    // Determine primary module (highest score or first)
    let primaryModule = selectedModules[0];
    let highestScore = -1;
    for (const m of selectedModules) {
      const score = moduleScores.get(m) || 0;
      if (score > highestScore) {
        highestScore = score;
        primaryModule = m;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `🧭 [AI Module Router] Routed question in ${duration}ms -> Modules: [${selectedModules.join(', ')}] (Primary: ${primaryModule}, Fallback: ${isFallback}, Inherited: ${contextInherited})`
    );

    return {
      selectedModules,
      primaryModule,
      confidence: isFallback ? 0.5 : (selectedModules.length > 1 ? 0.9 : 0.95),
      matchedKeywords,
      routingDurationMs: duration,
      isFallback,
      contextInherited
    };
  }
}

