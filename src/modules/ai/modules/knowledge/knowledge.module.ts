import { IAIModule, AIModuleName, AIExecutionContext } from '../ai-module.interface';
import { KNOWLEDGE_TOOLS_DECLARATIONS } from './knowledge.declarations';
import { searchRestaurantKnowledge } from '../../ai-analyst.tools';

export class KnowledgeAIModule implements IAIModule {
  readonly name: AIModuleName = 'knowledge';
  readonly description = 'Restaurant profile configuration, operating hours, active staff count, and category setups.';

  getFunctionDeclarations(): any[] {
    return KNOWLEDGE_TOOLS_DECLARATIONS;
  }

  async execute(functionName: string, args: any, context: AIExecutionContext): Promise<any> {
    const { restaurantId } = context;

    switch (functionName) {
      case 'searchRestaurantKnowledge':
        return await searchRestaurantKnowledge(restaurantId, args);
      default:
        throw new Error(`Tool function "${functionName}" is not handled by KnowledgeAIModule.`);
    }
  }
}

