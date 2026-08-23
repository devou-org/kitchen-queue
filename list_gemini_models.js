const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found');
    return;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("AVAILABLE GEMINI MODELS:");
    if (data.models) {
      data.models.forEach(m => {
        if (m.name.includes('flash') || m.name.includes('pro') || m.name.includes('gemini')) {
          console.log(`- ${m.name} (${m.displayName}) - Supported: ${m.supportedGenerationMethods.join(', ')}`);
        }
      });
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
