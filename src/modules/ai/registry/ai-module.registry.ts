import { IAIModule, AIModuleName, AIExecutionContext } from '../modules/ai-module.interface';
import { SalesAIModule } from '../modules/sales/sales.module';
import { TablesAIModule } from '../modules/tables/tables.module';
import { InventoryAIModule } from '../modules/inventory/inventory.module';
import { KnowledgeAIModule } from '../modules/knowledge/knowledge.module';
import { ExternalAIModule } from '../modules/external/external.module';

export class AIModuleRegistry {
  private modules = new Map<AIModuleName, IAIModule>();

  /**
   * Register an AI module into the DI container
   */
  register(module: IAIModule): this {
    this.modules.set(module.name, module);
    return this;
  }

  /**
   * Get a registered module by name
   */
  getModule(name: AIModuleName): IAIModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all registered module names
   */
  getAllModuleNames(): AIModuleName[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Combine Gemini Function Declarations for the specified list of active modules
   */
  getDeclarationsForModules(moduleNames: AIModuleName[]): Array<{ functionDeclarations: any[] }> {
    const combinedDeclarations: any[] = [];
    const seenFunctionNames = new Set<string>();

    for (const name of moduleNames) {
      const module = this.modules.get(name);
      if (!module) continue;

      const declarations = module.getFunctionDeclarations();
      for (const decl of declarations) {
        if (!seenFunctionNames.has(decl.name)) {
          seenFunctionNames.add(decl.name);
          combinedDeclarations.push(decl);
        }
      }
    }

    if (combinedDeclarations.length === 0) {
      return [];
    }

    return [{ functionDeclarations: combinedDeclarations }];
  }

  /**
   * Dispatch a tool function execution to the owning module
   */
  async executeTool(functionName: string, args: any, context: AIExecutionContext): Promise<any> {
    for (const module of this.modules.values()) {
      const hasTool = module.getFunctionDeclarations().some(d => d.name === functionName);
      if (hasTool) {
        return await module.execute(functionName, args, context);
      }
    }

    throw new Error(`Tool function "${functionName}" is not registered in any active AI module.`);
  }
}

/**
 * Factory helper to construct the default DI registry populated with all core modules
 */
export function createDefaultAIModuleRegistry(): AIModuleRegistry {
  const registry = new AIModuleRegistry();
  registry
    .register(new SalesAIModule())
    .register(new TablesAIModule())
    .register(new InventoryAIModule())
    .register(new KnowledgeAIModule())
    .register(new ExternalAIModule());

  return registry;
}

