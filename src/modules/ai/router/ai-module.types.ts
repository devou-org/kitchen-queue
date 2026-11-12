import { AIModuleName } from '../modules/ai-module.interface';

export interface ModuleRoutingResult {
  selectedModules: AIModuleName[];
  primaryModule: AIModuleName;
  confidence: number;
  matchedKeywords: string[];
  routingDurationMs: number;
  isFallback: boolean;
  contextInherited?: boolean;
}

