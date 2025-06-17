import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { OpenAI } from 'openai';
import { z } from 'zod/v4';
import { zodResponseFormat } from 'openai/helpers/zod';

const ai = new OpenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const port = process.env.PORT || 8080;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Running' });
});

app.post('/messages', async (req, res) => {
  const { prompt } = req.body;

  const result = await ai.chat.completions.create({
    model: 'gemini-2.0-flash-lite',
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 150,
  });

  res.json({ result });
});

app.post('/messages/stream', async (req, res) => {
  const { prompt } = req.body;

  const completion = await ai.chat.completions.create({
    model: 'gemini-2.0-flash',
    messages: [
      {
        role: 'system',
        content:
          'You are a poetic senior software architect. You only answer in sonnets in pseudo-old English with a pinch of Spanish idioms, but you have a great disdain for dynamically typed languages and would favour functional programming languages and clean code.',
      },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 150,
    stream: true,
  });

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  });

  for await (const chunk of completion) {
    // JSON.stringify the chunk to escape newlines and other special characters.
    // This ensures the entire chunk is treated as a single data string.
    // const jsonString = JSON.stringify({ token: chunk });
    const jsonString = JSON.stringify(chunk.choices[0].delta.content);

    // Send the JSON string as the data payload.
    res.write(`data: ${jsonString}\n\n`);
  }

  res.end();
  res.on('close', () => res.end());
});

// Guybrush Threepwood in the pixelated art style of Monkey Island 2, enjoying a good read of The Wheel of Time, while lying in the shade of a palm tree on the beach of Melee Island.
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

app.get('/models', async (req, res) => {
  const list = await ai.models.list();
  const models = [];
  for await (const model of list) {
    console.log(model);
    models.push(model);
  }

  res.json({ models });
});

const Recipe = z.object({
  title: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
    })
  ),
  preparation_description: z.string(),
  time_in_min: z.number(),
});

// Not working
app.post('/recipes', async (req, res) => {
  const { prompt } = req.body;
  const completion = await ai.chat.completions.create({
    model: 'gemini-2.0-flash',
    messages: [
      {
        role: 'system',
        content: "You are an inventive cook. You create a new recipe based on the user's ideas and taste. ",
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({
        title: z.string(),
      }),
      'recipe'
    ),
  });
  console.log({ completion });
  const recipe = completion.choices[0].message;
  res.json({ recipe });
});

app.use('/{*splat}', () => {
  throw Error('Page not found', { cause: { status: 404 } });
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
});

app.listen(port, () => console.log(chalk.green(`AI Proxy listening on port ${port}`)));
