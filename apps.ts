import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dadJokes from '@mikemcbride/dad-jokes'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { WebSocketServer } from 'ws';

const templateURI = 'ui://widget/joke5.html';

const manifest = {
  name: "Demo MCP Server",
  version: "1.0.0",
  mcp: {
    servers: {
      default: {
        transport: "http",
        url: "https://chatgpt-app-demo.ynonp.deno.net/mcp"
      }
    }
  }
};

const mcpManifest = {
  name: "mcp-server-demo",
  version: "1.0.0",
  capabilities: {
    resources: { list: true, read: true }
  }
};

// Create server instance
const server = new McpServer({
  name: "dadjokes",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.registerResource(
  'jokes_count',
  'jokes://count',
  {
    title: 'Jokes Count Resource',
  },
  async (uri) => {
    return ({
      contents: [
        {
          uri: uri.href,
          text: `I know ${dadJokes.all.length} jokes`,
        }
      ]
    })
  }
)

server.registerResource(
  'joke-widget',
  templateURI,
  {},
  async () => ({
    contents: [
      {
        uri: templateURI,
        mimeType: "text/html+skybridge",
        text: `
        <style>
          #dad-joke { height: 300px; }
          p { color: green; font-size: 48px }          
        </style>
        <div id="dad-joke">
          <p>Dad joke will appear here</p>
        </div>
        <script>
          window.addEventListener("openai:set_globals", () => {
            const container = document.querySelector('#dad-joke p');
            if (openai.toolOutput && openai.toolOutput.joke) {
              container.textContent = openai.toolOutput.joke;
            } else {
              container.textContent = "joke not found";
            }          
          });          
        </script>
        `,
        _meta: {
          "openai/widgetPrefersBorder": true,          
        }
      }
    ]
  })
)

server.registerTool(
  "tell-me-a-joke",
  {
    inputSchema: {
      id: z.number().min(0).max(dadJokes.all.length).describe('joke id')
    },
    title: 'Joke Teller',
    description: `Tells a joke according to its index. Valid ids 0-${dadJokes.all.length - 1}`,    
    _meta: {
      "openai/outputTemplate": templateURI,
      "openai/toolInvocation/invoking": "Displaying a joke",
      "openai/toolInvocation/invoked": "Displayed a joke"
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    }
  },
  async ({id}) => {
    return ({
      content: [],
      structuredContent: {joke: dadJokes.all[id] }
    })
  }
)

server.registerTool(
  "tell-me-a-random-joke",  
  {
    title: 'Random Joke Teller',
    description: 'Tells a random joke',    
    _meta: {
      "openai/outputTemplate": templateURI,
      "openai/toolInvocation/invoking": "Displaying a joke",
      "openai/toolInvocation/invoked": "Displayed a joke"
    },    
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    }    
  },
  async () => {
    return ({
      content: [],
      structuredContent: {joke: dadJokes.random() }
    })
  }
);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post('/mcp', async (req: any, res: any) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

app.get('/manifest.json', (req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.send(JSON.stringify(manifest));
});

app.get('/.well-known/mcp/manifest.json', (req, res) => {
  res.set({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.send(JSON.stringify(mcpManifest));
});

// SSE endpoint for streaming jokes
app.get('/sse/jokes', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write('data: {"type": "connected", "message": "Connected to joke stream"}\n\n');
  
  // Stream a joke every 3 seconds
  const intervalId = setInterval(() => {
    const joke = dadJokes.random();
    const data = {
      type: 'joke',
      joke: joke,
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 3000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

// SSE endpoint for custom events
app.get('/sse/events', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write('data: {"type": "connected", "count": ' + dadJokes.all.length + '}\n\n');
  
  // Keep connection alive with periodic heartbeat
  const heartbeatId = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatId);
    res.end();
  });
});

const port = parseInt(process.env.PORT || '3000');
const httpServer = app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
    console.log(`WebSocket endpoint available at ws://localhost:${port}/ws`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});

// WebSocket server for real-time joke streaming
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to WebSocket joke stream',
    totalJokes: dadJokes.all.length
  }));
  
  // Stream jokes every 3 seconds
  const intervalId = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const joke = dadJokes.random();
      ws.send(JSON.stringify({
        type: 'joke',
        joke: joke,
        timestamp: new Date().toISOString()
      }));
    }
  }, 3000);
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received:', message);
      
      // Handle different message types
      if (message.type === 'getJoke' && typeof message.id === 'number') {
        ws.send(JSON.stringify({
          type: 'joke',
          joke: dadJokes.all[message.id] || 'Joke not found',
          timestamp: new Date().toISOString()
        }));
      } else if (message.type === 'getRandomJoke') {
        ws.send(JSON.stringify({
          type: 'joke',
          joke: dadJokes.random(),
          timestamp: new Date().toISOString()
        }));
      } else if (message.type === 'stopStream') {
        clearInterval(intervalId);
        ws.send(JSON.stringify({
          type: 'stream_stopped',
          message: 'Joke stream stopped'
        }));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clearInterval(intervalId);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(intervalId);
  });
});

