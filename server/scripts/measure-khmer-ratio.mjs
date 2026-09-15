/**
 * Measures the Khmer tokenizer penalty against English.
 *
 *   npm run measure:khmer-ratio
 *
 * CLAUDE.md asks for this number before the cost of running on real traffic
 * can be estimated. Re-run it after any change of model or endpoint: the
 * answer is a property of the tokenizer, not of the product.
 *
 * Two methods, because they answer different questions:
 *
 *   A. Embeddings send ONLY the text — no system prompt, no instructions — so
 *      the reported prompt_tokens are exactly the text's cost. Cleanest signal.
 *
 *   B. Difference method on chat: send an identical request with and without
 *      the source text and subtract. Confirms A holds on the chat model too,
 *      whose tokenizer may differ from the embedding model's.
 *
 * Both are run on the SAME CONTENT in both languages — the Khmer is a
 * translation of the English, not unrelated text — so the comparison is
 * "what does this paragraph cost", which is the question that decides pricing.
 */
import OpenAI from 'openai';
import { env } from '../src/config/env.js';

const client = new OpenAI({
  apiKey: env.openaiApiKey,
  maxRetries: 0,
  ...(env.openaiBaseUrl && { baseURL: env.openaiBaseUrl }),
});

const EN = `A relational database stores data in tables. Each row is a record and each column is a field. A primary key uniquely identifies a row. A foreign key points at another table's primary key, which is how tables relate. Indexes make lookups faster.`;

const KM = `មូលដ្ឋានទិន្នន័យទំនាក់ទំនងរក្សាទុកទិន្នន័យជាតារាង។ ជួរដេកនីមួយៗគឺជាកំណត់ត្រា ហើយជួរឈរនីមួយៗគឺជាវាល។ គន្លឹះចម្បងកំណត់អត្តសញ្ញាណជួរដេកដោយឯកឯង។ គន្លឹះបរទេសចង្អុលទៅគន្លឹះចម្បងនៃតារាងមួយទៀត។ សន្ទស្សន៍ធ្វើឱ្យការស្វែងរកលឿនជាងមុន។`;

const embedTokens = async (text) => {
  const r = await client.embeddings.create({
    model: env.openaiEmbeddingModel,
    input: [text],
    dimensions: 1536,
  });
  return r.usage.prompt_tokens;
};

/**
 * Only prompt_tokens matter here, so the output cap wants to be as small as
 * possible — but a reasoning model spends that same budget on reasoning before
 * it writes anything and returns a 400 when the cap is too low to finish. The
 * retry ladder keeps the cheap path for ordinary models and still completes on
 * a reasoning one.
 */
const OUTPUT_CAPS = [1, 256, 2048];

const chatPromptTokens = async (text) => {
  let lastErr;
  for (const cap of OUTPUT_CAPS) {
    try {
      const r = await client.chat.completions.create({
        model: env.openaiModel,
        max_completion_tokens: cap,
        messages: [
          { role: 'system', content: 'You are a study tutor.' },
          { role: 'user', content: `Summarise this.\n\n${text}` },
        ],
      });
      return r.usage.prompt_tokens;
    } catch (err) {
      lastErr = err;
      if (err?.status !== 400) throw err;
    }
  }
  throw lastErr;
};

console.log('\nMethod A — embeddings (text only, no instructions)\n');
const enEmbed = await embedTokens(EN);
const kmEmbed = await embedTokens(KM);

console.log('Method B — chat, differenced against an empty source\n');
const baseline = await chatPromptTokens('');
const enChat = (await chatPromptTokens(EN)) - baseline;
const kmChat = (await chatPromptTokens(KM)) - baseline;

const table = [
  {
    language: 'English',
    chars: EN.length,
    'embed tokens': enEmbed,
    'chat tokens': enChat,
    'tokens/char': (enEmbed / EN.length).toFixed(3),
  },
  {
    language: 'Khmer',
    chars: KM.length,
    'embed tokens': kmEmbed,
    'chat tokens': kmChat,
    'tokens/char': (kmEmbed / KM.length).toFixed(3),
  },
];
console.table(table);

const perChar = kmEmbed / KM.length / (enEmbed / EN.length);
const perMeaning = kmEmbed / enEmbed;
const perMeaningChat = kmChat / enChat;

console.log(`embedding model : ${env.openaiEmbeddingModel}`);
console.log(`chat model      : ${env.openaiModel}\n`);
console.log(`Khmer vs English, the same paragraph:`);
console.log(`  embeddings   ${perMeaning.toFixed(2)}x   (${env.openaiEmbeddingModel})`);
console.log(`  chat         ${perMeaningChat.toFixed(2)}x   (${env.openaiModel})`);
console.log(`  per Khmer character, embeddings: ${perChar.toFixed(2)}x a Latin one`);
console.log('');
console.log('There is no single Khmer multiplier: the two models do not share a');
console.log('tokenizer, so each carries its own penalty. Ingest is the bulk-volume');
console.log('operation, so the embedding figure drives total spend, while the chat');
console.log('figure is the one users feel per tutor reply.');
