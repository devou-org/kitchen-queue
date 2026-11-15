import { IAIModule, AIModuleName, AIExecutionContext } from '../ai-module.interface';
import { TABLES_TOOLS_DECLARATIONS } from './tables.declarations';
import {
  getTableOccupancy,
  getTableTurnover,
  getAverageTableTurnTime,
  getTableUtilization,
  getTableUsageByHour,
  getTablePerformance,
  getTopTablesByRevenue,
  getBottomTablesByRevenue,
  getTableCapacityPerformance,
  getRevenuePerTableHour
} from '../../ai-analyst.tools';

export class TablesAIModule implements IAIModule {
  readonly name: AIModuleName = 'tables';
  readonly description = 'Dining table occupancy, turnover rate, turn times, seat capacity utilization, hourly table usage, and revenue per table hour.';

  getFunctionDeclarations(): any[] {
    return TABLES_TOOLS_DECLARATIONS;
  }

  async execute(functionName: string, args: any, context: AIExecutionContext): Promise<any> {
    const { restaurantId } = context;

    switch (functionName) {
      case 'getTableOccupancy':
        return await getTableOccupancy(restaurantId, args);
      case 'getTableTurnover':
        return await getTableTurnover(restaurantId, args);
      case 'getAverageTableTurnTime':
        return await getAverageTableTurnTime(restaurantId, args);
      case 'getTableUtilization':
        return await getTableUtilization(restaurantId, args);
      case 'getTableUsageByHour':
        return await getTableUsageByHour(restaurantId, args);
      case 'getTablePerformance':
        return await getTablePerformance(restaurantId, args);
      case 'getTopTablesByRevenue':
        return await getTopTablesByRevenue(restaurantId, args);
      case 'getBottomTablesByRevenue':
        return await getBottomTablesByRevenue(restaurantId, args);
      case 'getTableCapacityPerformance':
        return await getTableCapacityPerformance(restaurantId, args);
      case 'getRevenuePerTableHour':
        return await getRevenuePerTableHour(restaurantId, args);
      default:
        throw new Error(`Tool function "${functionName}" is not handled by TablesAIModule.`);
    }
  }
}

