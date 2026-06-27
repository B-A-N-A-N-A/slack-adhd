require('dotenv').config();
const { App } = require('@slack/bolt');

// Initialize the Bolt App

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// [Insert your processAndChunkSlackMessage function here]

function processAndChunkSlackMessage(text) {
  // 1. Tokenize URLs, Emojis, and raw text
  const tokenRegex = /(<http[^>]+>|:[a-zA-Z0-9_+\-]+:|[^:<]+|[:<])/g;
  const tokens = text.match(tokenRegex) || [text];
  
  let allProcessedWords = [];

  // 2. Process text and apply inline Unicode bolding
  tokens.forEach(token => {
    // Skip formatting tokens
    if ((token.startsWith('<http') && token.endsWith('>')) || (token.startsWith(':') && token.endsWith(':'))) {
      allProcessedWords.push(token);
    } else {
      const words = token.split(/(\s+)/);
      words.forEach(word => {
        // Skip pure whitespace
        if (/^\s+$/.test(word) || word.length === 0) {
          allProcessedWords.push(word);
          return;
        }

        // Strip punctuation to calculate true length
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
        if (cleanWord.length === 0) {
          allProcessedWords.push(word);
          return;
        }

        // Calculate bolding weight based on your criteria
        const len = cleanWord.length;
        let boldCount = (len < 5) ? Math.min(2, len) : (len >= 5 && len < 11) ? 3 : Math.ceil(len * 0.4);

        const boldPart = word.slice(0, boldCount);
        const restPart = word.slice(boldCount);
        
        // Inline Unicode Conversion
        const visualBoldPart = boldPart.split('').map(char => {
          const code = char.charCodeAt(0);
          // Uppercase A-Z (ASCII 65-90) -> Mathematical Sans-Serif Bold
          if (code >= 65 && code <= 90) {
            return String.fromCodePoint(0x1D5D4 + (code - 65));
          }
          // Lowercase a-z (ASCII 97-122) -> Mathematical Sans-Serif Bold
          if (code >= 97 && code <= 122) {
            return String.fromCodePoint(0x1D5EE + (code - 97));
          }
          return char; // Return punctuation/numbers as-is
        }).join('');
        
        allProcessedWords.push(`${visualBoldPart}${restPart}`);
      });
    }
  });

  // 3. Chunk the processed words into arrays of max 3000 characters
  const chunks = [];
  let currentChunk = "";
  const LIMIT = 3000;

  allProcessedWords.forEach(word => {
    // Check if adding this word (and its formatting) exceeds the limit
    if ((currentChunk + word).length > LIMIT) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = word; // Put the overflowing word entirely into the next chunk
      } else {
        chunks.push(word);
      }
    } else {
      currentChunk += word;
    }
  });

  // Push the final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Listen for your shortcut

app.shortcut('focus_reading_assistant', async ({ shortcut, ack, client }) => {
  try {
    await ack();
    const originalText = shortcut.message.text;
    const textChunks = processAndChunkSlackMessage(originalText);

    const textBlocks = textChunks.map(chunk => ({
      type: "section",
      text: { type: "mrkdwn", text: chunk }
    }));

    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Focus Reading Assistant" },
        close: { type: "plain_text", text: "Close" },
        blocks: [
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: "💡 *Tip:* Bolding anchors your eyes to glide through text faster." }]
          },
          { type: "divider" },
          ...textBlocks
        ]
      }
    });
  } catch (error) {
    console.error("Error:", error);
  }
});

// Start the app

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Focus Reading Slack App is running!');
})();
