export type AIModuleName = 'sales' | 'tables' | 'inventory' | 'knowledge' | 'external';

export interface AIExecutionContext {
  restaurantId: string;
  businessDate?: string;
  timezone?: string;
}

export interface IAIModule {
  readonly name: AIModuleName;
  readonly description: string;

  /**
   * Returns Gemini Function Declaration schemas for this module
   */
  getFunctionDeclarations(): any[];

  /**
   * Executes a tool belonging to this module
   */
  execute(
    functionName: string,
    args: any,
    context: AIExecutionContext
  ): Promise<any>;
}

