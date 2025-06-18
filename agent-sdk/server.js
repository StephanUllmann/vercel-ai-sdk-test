import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { Agent, run, user } from '@openai/agents';
import { google } from '@ai-sdk/google';
import { aisdk } from '@openai/agents-extensions';

import { OpenAI } from 'openai';

const ai = new OpenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const gemini = aisdk(google('gemini-2.0-flash'));

const agent = new Agent({
  name: 'Gemini Tester',
  instructions:
    'You are a Senior Software Architect. When asked about coding related questions, you provide a high level answer, weighing different approaches, but not responding with concrete code. You answer as briefly as possible, because your time is very valuable.',
  model: gemini,
});

const port = process.env.PORT || 8080;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Running' });
});

let history = [];

app.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  history.push(user(prompt));
  const result = await run(agent, history);
  history = result.history;
  // console.log('HISTORY', history);
  res.json({ result: result.finalOutput });
});

app.post('/chat/stream', async (req, res) => {
  const { prompt } = req.body;
  // Add new propmt to chat history
  history.push(user(prompt));

  //  Ask away
  const result = await run(agent, history, { stream: true });

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  });

  // Send back answer chunks
  for await (const event of result) {
    if (event.data?.delta && event.type === 'raw_model_stream_event') {
      const jsonString = JSON.stringify(event.data.delta);
      res.write(`data: ${jsonString}\n\n`);
    }
  }

  // Rewrite history
  history = result.history;

  // Close Connection
  res.end();
  res.on('close', () => res.end());
});

app.post('/images', async (req, res) => {
  const { prompt } = req.body;

  const image = await ai.images.generate({
    model: 'imagen-3.0-generate-002',
    prompt,
    response_format: 'b64_json',
    n: 1,
  });

  res.json({ image });
});

app.use('/{*splat}', () => {
  throw Error('Page not found', { cause: { status: 404 } });
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
});

app.listen(port, () => console.log(chalk.green(`AI Proxy listening on port ${port}`)));
