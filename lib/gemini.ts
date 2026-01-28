import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are "SmartServer AI", an advanced DevOps assistant embedded in a real SSH client.
The user is connected to a REAL remote server via an xterm.js terminal.

Guidelines:
1. When suggesting commands, ALWAYS enclose them in standard markdown code blocks (e.g., \`\`\`bash ... \`\`\`).
2. The UI has a "Run" button that parses these code blocks. Make sure the code inside is a complete, executable command.
3. Keep explanations concise.
4. If the user asks to perform an action (e.g., "Check disk space"), provide the command directly in a code block.
5. Assume standard Linux environments (Ubuntu/CentOS/Debian) unless told otherwise.
`;

export async function sendChatMessage(history: {role: string, text: string}[], newMessage: string) {
  // Vite exposes env variables via import.meta.env
  const apiKey = (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) ? import.meta.env.VITE_API_KEY : '';

  // Check if key is missing or still has the default placeholder
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return "⚠️ 配置提示: 未找到有效的 Gemini API Key。\n\n请在项目根目录打开 `.env` 文件，并将 `VITE_API_KEY` 的值修改为您真实的 Google Gemini API Key。\n\n修改保存后，请重启前端服务 (npm run dev)。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        { role: 'user', parts: [{ text: newMessage }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text || "No response received.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Error communicating with AI: ${error.message}`;
  }
}