import { IAIModule, AIModuleName, AIExecutionContext } from '../ai-module.interface';
import { INVENTORY_TOOLS_DECLARATIONS } from './inventory.declarations';
import { getInventorySummary } from '../../ai-analyst.tools';

export class InventoryAIModule implements IAIModule {
  readonly name: AIModuleName = 'inventory';
  readonly description = 'Inventory tracking, stock quantities, low stock alerts, and out-of-stock ingredients.';

  getFunctionDeclarations(): any[] {
    return INVENTORY_TOOLS_DECLARATIONS;
  }

  async execute(functionName: string, _args: any, context: AIExecutionContext): Promise<any> {
    const { restaurantId } = context;

    switch (functionName) {
      case 'getInventorySummary':
        return await getInventorySummary(restaurantId);
      default:
        throw new Error(`Tool function "${functionName}" is not handled by InventoryAIModule.`);
    }
  }
}

