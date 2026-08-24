/**
 * Test to verify concurrent execution of independent tool calls using Promise.all()
 */

async function mockExecuteTool(name: string, delayMs: number) {
  const start = Date.now();
  await new Promise(resolve => setTimeout(resolve, delayMs));
  const end = Date.now();
  return { name, duration: end - start };
}

async function testConcurrentExecution() {
  console.log('🧪 Starting Concurrent Tool Execution Test...');

  const requestedTools = [
    { name: 'getSalesSummary', delay: 100 },
    { name: 'getHourlySales', delay: 100 },
    { name: 'getCancellationRate', delay: 100 },
    { name: 'getInventorySummary', delay: 100 },
    { name: 'getHolidays', delay: 100 },
    { name: 'getWeather', delay: 100 }
  ];

  const overallStart = Date.now();

  // Test Concurrent Execution via Promise.all
  const results = await Promise.all(
    requestedTools.map(t => mockExecuteTool(t.name, t.delay))
  );

  const overallDuration = Date.now() - overallStart;

  console.log(`✅ All ${results.length} tools completed.`);
  console.log(`⏱️ Overall Duration: ${overallDuration}ms`);

  // Sequential execution of 6 x 100ms tools would take ~600ms.
  // Concurrent execution should take ~100-150ms.
  if (overallDuration < 300) {
    console.log('🎉 SUCCESS: Tools executed concurrently in parallel!');
  } else {
    console.error('❌ FAILURE: Execution was sequential!');
    process.exit(1);
  }
}

testConcurrentExecution();
