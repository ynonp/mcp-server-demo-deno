# Add GUI To Your MCP Server => ChatGPT Apps

1. Create the GUI

```
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
```

2. Use the template

```
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
```
    
3. Deploy

4. Read More
    - https://developers.openai.com/apps-sdk/build/mcp-server
    