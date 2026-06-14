async function chat(messages, env) {
  const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.HCAI}`
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${JSON.stringify(data)}`);
  }
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`AI response missing choices: ${JSON.stringify(data)}`);
  }
  const message = data.choices[0].message;
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => (typeof part === "string" ? part : part.text))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  if (typeof message.refusal === "string" && message.refusal.trim()) {
    return message.refusal;
  }
  throw new Error(`AI response had no text content: ${JSON.stringify(data)}`);
}

module.exports = { chat };
