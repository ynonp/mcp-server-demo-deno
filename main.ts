import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dadJokes from '@mikemcbride/dad-jokes'
import express from 'express';
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "dadjokes",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});


server.registerTool(
  "tell-me-a-joke",
  {
    inputSchema: {
      id: z.number().min(0).max(dadJokes.all.length - 1).describe('joke id')
    },
    title: 'Joke Teller',
    description: `Tells a joke according to its index. Valid ids 0-${dadJokes.all.length - 1}`,    
  },
  async ({id}) => {
    const joke = { joke: dadJokes.all[id] };
    return ({
      content: [
        {
          type: "text",
          text: JSON.stringify(joke),
        }
      ],
      structuredContent: {joke},
    })
  }
)

server.registerTool(
  "tell-me-a-random-joke",  
  {
    title: 'Random Joke Teller',
    description: 'Tells a random joke',    
  },
  async () => {
    const joke = {joke: dadJokes.random()};
    

    return ({
      content: [
        {
          type: "text",
          text: JSON.stringify(joke),
        }
      ],
      structuredContent: joke
    })
  }
);

// Streamable HTTP Server
const app = express();
app.use(express.json());

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

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});

// STDIO Server
// const transport = new StdioServerTransport();
// await server.connect(transport);









