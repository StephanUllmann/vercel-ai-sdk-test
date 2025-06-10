import { useState } from 'react';
import './App.css';
import Markdown from 'marked-react';
import Lowlight from 'react-lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';
import 'highlight.js/styles/night-owl.css';

Lowlight.registerLanguage('js', javascript);
Lowlight.registerLanguage('javascript', javascript);
Lowlight.registerLanguage('ts', typescript);
Lowlight.registerLanguage('typescript', typescript);
Lowlight.registerLanguage('bash', bash);
Lowlight.registerLanguage('rust', rust);

const renderer = {
  code(snippet, lang) {
    const usedLang = Lowlight.hasLanguage() ? lang : 'bash';
    return <Lowlight key={this.elementId} language={usedLang} value={snippet} />;
  },
};

function App() {
  const [prompt, setPrompt] = useState('');

  const [aiResponse, setAiResponse] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setAiResponse('');
      const response = await fetch('http://localhost:8080/messages/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // This is the key part: we read the stream chunk by chunk
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break; // The stream has finished
        }

        // The 'value' is a Uint8Array, so we decode it to a string
        const chunk = decoder.decode(value);

        // SSE messages can be split across chunks. We need to buffer and process them.
        // An SSE message ends with \n\n
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.substring(5); // Remove 'data:' prefix
            try {
              // As per our previous discussion, parse the JSON
              const parsedText = JSON.parse(data).replaceAll('\n', '  \n');

              // Append the content to your display
              console.log(parsedText);
              setAiResponse((p) => p + parsedText);
            } catch (e) {
              // Handle potential JSON parsing errors if a chunk is incomplete
              console.error('Error parsing SSE data chunk:', data, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error starting stream:', error);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}></textarea>
        <button>Ask</button>
      </form>
      <div style={{ textAlign: 'start' }}>
        <Markdown value={aiResponse} renderer={renderer} />
      </div>
    </>
  );
}

export default App;
