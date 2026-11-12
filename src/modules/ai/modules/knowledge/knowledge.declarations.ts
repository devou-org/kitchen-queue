export const KNOWLEDGE_TOOLS_DECLARATIONS = [
  {
    name: 'searchRestaurantKnowledge',
    description: 'Returns general restaurant configuration, operating hours, active staff count, and menu categories.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Knowledge field to query' }
      }
    }
  }
];

