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
  const [pending, setPending] = useState(false);
  const [isImageGen, setIsImageGen] = useState(false);
  const [base64img, setBase64img] = useState(null);

  const handleImageGen = async () => {
    try {
      setAiResponse('');
      setBase64img('');
      const response = await fetch('http://localhost:8080/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const { image } = await response.json();
      const b64 = image.data[0].b64_json;
      setBase64img(b64);
    } catch (error) {
      console.error('Error in image genearation: ', error);
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isImageGen) {
      handleImageGen();
      return;
    }
    try {
      setPending(true);
      setAiResponse('');
      const response = await fetch('http://localhost:8080/chat/stream', {
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
          if (line.startsWith('data: ')) {
            const data = line.substring(6); // Remove 'data: ' prefix
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
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setAiResponse('');
    setPrompt('');
  };

  return (
    <main className='outline outline-red-500 h-screen p-2 mx-auto w-5xl flex flex-col items-center'>
      <form onSubmit={handleSubmit} className='flex w-full gap-2 items-end'>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={isImageGen ? 'Prompt your image...' : 'State your question...'}
          className='textarea textarea-primary flex-10/12 h-40 resize-none'
        ></textarea>
        <div className='flex-2/12 flex flex-col gap-2'>
          <label className='label'>
            <input
              type='checkbox'
              checked={isImageGen}
              onChange={() => setIsImageGen((p) => !p)}
              className='checkbox'
            />
            Image Generation
          </label>
          <button className='btn btn-primary ' disabled={pending}>
            {pending ? <span className='loading loading-spinner'></span> : <span>Send</span>}
          </button>
          <button className='btn btn-secondary' type='reset' onClick={reset}>
            Clear
          </button>
        </div>
      </form>
      <div className='mockup-window border border-base-300 w-full my-4 flex-1 overflow-y-auto text-start px-4 '>
        {isImageGen && !base64img && <div className='skeleton mask mask-squircle w-72 aspect-square'></div>}
        {base64img && (
          <div className='mask mask-squircle w-72'>
            <a href={`data:image/png;base64,${base64img}`} download={Date.now() + '.png'} title='Download'>
              <img
                className='hover:scale-101 transition-transform'
                src={`data:image/png;base64,${base64img}`}
                alt={'AI generated image based on prompt: ' + prompt}
              />
            </a>
          </div>
        )}
        <Markdown value={aiResponse} renderer={renderer} />
      </div>
    </main>
  );
}

export default App;
