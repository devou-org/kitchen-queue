import { IAIModule, AIModuleName, AIExecutionContext } from '../ai-module.interface';
import { EXTERNAL_TOOLS_DECLARATIONS } from './external.declarations';
import { getHolidays, getWeatherTool } from '../../ai-analyst.tools';

export class ExternalAIModule implements IAIModule {
  readonly name: AIModuleName = 'external';
  readonly description = 'External context, including public holidays and local weather forecasts (Open-Meteo).';

  getFunctionDeclarations(): any[] {
    return EXTERNAL_TOOLS_DECLARATIONS;
  }

  async execute(functionName: string, args: any, context: AIExecutionContext): Promise<any> {
    const { restaurantId } = context;

    switch (functionName) {
      case 'getHolidays':
        return await getHolidays(restaurantId, args);
      case 'getWeather':
        return await getWeatherTool(restaurantId, args);
      default:
        throw new Error(`Tool function "${functionName}" is not handled by ExternalAIModule.`);
    }
  }
}

