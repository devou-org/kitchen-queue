import { IAIModule, AIModuleName, AIExecutionContext } from '../ai-module.interface';
import { SALES_TOOLS_DECLARATIONS } from './sales.declarations';
import {
  getSalesSummary,
  getSalesTrend,
  getHourlySales,
  getTopProducts,
  getBottomProducts,
  getCategoryPerformance,
  getAverageOrderValue,
  getCancellationRate,
  comparePeriods
} from '../../ai-analyst.tools';

export class SalesAIModule implements IAIModule {
  readonly name: AIModuleName = 'sales';
  readonly description = 'Sales & revenue analytics, order volume trends, peak hours, product performance, categories, AOV, cancellations, and period comparison.';

  getFunctionDeclarations(): any[] {
    return SALES_TOOLS_DECLARATIONS;
  }

  async execute(functionName: string, args: any, context: AIExecutionContext): Promise<any> {
    const { restaurantId } = context;

    switch (functionName) {
      case 'getSalesSummary':
        return await getSalesSummary(restaurantId, args);
      case 'getSalesTrend':
        return await getSalesTrend(restaurantId, args);
      case 'getHourlySales':
        return await getHourlySales(restaurantId, args);
      case 'getTopProducts':
        return await getTopProducts(restaurantId, args);
      case 'getBottomProducts':
        return await getBottomProducts(restaurantId, args);
      case 'getCategoryPerformance':
        return await getCategoryPerformance(restaurantId, args);
      case 'getAverageOrderValue':
        return await getAverageOrderValue(restaurantId, args);
      case 'getCancellationRate':
        return await getCancellationRate(restaurantId, args);
      case 'comparePeriods':
        return await comparePeriods(restaurantId, args);
      default:
        throw new Error(`Tool function "${functionName}" is not handled by SalesAIModule.`);
    }
  }
}

