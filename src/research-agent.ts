import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sql_lookup",
    description: "Query the internal analytics database",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT statement to execute",
        },
      },
      required: ["query"],
    },
  },
];

async function handleToolCall(
  name: string,
  input: Record<string, string>
): Promise<string> {
  if (name === "web_search") {
    // Replace with your actual search integration
    return `Search results for: ${input.query}`;
  }
  if (name === "sql_lookup") {
    // Replace with your actual database client
    return `Query results for: ${input.query}`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function runResearchAgent(prompt: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      tools,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock && textBlock.type === "text" ? textBlock.text : "";
    }

    if (response.stop_reason === "tool_use") {
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      messages.push(assistantMessage);

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await handleToolCall(
            block.name,
            block.input as Record<string, string>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// Example usage
if (require.main === module) {
  runResearchAgent("What are the latest trends in AI governance?")
    .then(console.log)
    .catch(console.error);
}
