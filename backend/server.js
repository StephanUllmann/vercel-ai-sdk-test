import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { vertex } from '@ai-sdk/google-vertex';
// import { createVertex } from '@ai-sdk/google-vertex';
import { generateText, streamText, experimental_generateImage as generateImage } from 'ai';

const port = process.env.PORT || 8080;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Running' });
});

app.post('/messages', async (req, res) => {
  const { prompt } = req.body;

  const result = await generateText({
    model: google('gemini-2.0-flash-lite'),
    prompt,
  });

  res.json({ result });
});

app.post('/messages/openai', async (req, res) => {
  const { prompt } = req.body;

  const result = await generateText({
    model: openai('gpt-3.5-turbo'),
    prompt,
  });

  res.json({ result });
});

app.post('/messages/stream', async (req, res) => {
  const { prompt } = req.body;

  const aiResponse = streamText({
    model: google('gemini-2.0-flash-lite'),
    // prompt,
    messages: [
      {
        role: 'system',
        content:
          'You are a poetic senior software architect. You only answer in sonnets in pseudo-old English with a pinch of Spanish idioms, but you have a great disdain for dynamically typed languages and would favour functional programming languages and clean code.',
      },
      { role: 'user', content: prompt },
    ],
  });

  // aiResponse.pipeTextStreamToResponse(res);

  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  });

  for await (const chunk of aiResponse.textStream) {
    // JSON.stringify the chunk to escape newlines and other special characters.
    // This ensures the entire chunk is treated as a single data string.
    // const jsonString = JSON.stringify({ token: chunk });
    const jsonString = JSON.stringify(chunk);

    // Send the JSON string as the data payload.
    res.write(`data: ${jsonString}\n\n`);
  }

  res.end();
  res.on('close', () => res.end());
});

app.post('/images', async (req, res) => {
  const { prompt } = req.body;

  const { image } = await generateImage({
    model: vertex.image('imagen-3.0-generate-002'),
    prompt,
    aspectRatio: '16:9',
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
