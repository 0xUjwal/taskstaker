const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const SYSTEM_PROMPT = `You are a task validation AI for TaskStaker, a blockchain accountability platform.
Users create tasks, stake ETH, and submit proofs of completion. Your job is to analyze the proof
and determine if the task was genuinely completed.

Analyze the task description and the submitted proof. Return your analysis as JSON with this structure:
{
  "passed": boolean,
  "confidence": number (0-100),
  "analysis": "a clear, plain-text explanation of your assessment — no markdown",
  "suggestions": ["plain text suggestion 1", "plain text suggestion 2"]
}

Be fair but thorough. Look for evidence that the task was actually completed, not just claimed.
If the proof is an image, describe what you see and how it relates to the task.
If the proof is text/document, evaluate its content against the task requirements.
Write all text fields in plain language — no markdown formatting.
IMPORTANT: Your entire response must be valid JSON only. Do not include any text outside the JSON object.`;

const GROQ_TEXT_MODEL =
  process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_FALLBACK_MODEL = "llama-3.1-8b-instant";

// Extract JSON from a model response that may contain markdown code blocks
function extractJSON(text) {
  if (!text) throw new Error("Empty response from model");
  const trimmed = text.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlock ? codeBlock[1].trim() : trimmed;
  return JSON.parse(candidate);
}

async function analyzeWithGroq(
  taskDescription,
  proofText,
  fileBase64,
  fileMimeType,
) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const hasImage =
    fileBase64 && fileMimeType && fileMimeType.startsWith("image/");
  const model = hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  let userContent;
  if (hasImage) {
    userContent = [
      {
        type: "text",
        text: buildUserMessage(
          taskDescription,
          proofText,
          "See the attached image proof:",
        ),
      },
      {
        type: "image_url",
        image_url: { url: `data:${fileMimeType};base64,${fileBase64}` },
      },
    ];
  } else {
    userContent = buildUserMessage(
      taskDescription,
      proofText,
      fileBase64
        ? "(non-image file attached — describe its contents from the text context)"
        : null,
    );
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const params = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  };
  // json_object mode only for text models that reliably support it
  if (!hasImage) {
    params.response_format = { type: "json_object" };
  }

  let completion;
  try {
    completion = await groq.chat.completions.create(params);
  } catch (err) {
    // Primary model failed — retry with a stable fallback model (text only)
    if (!hasImage && model !== GROQ_FALLBACK_MODEL) {
      const fallbackParams = {
        ...params,
        model: GROQ_FALLBACK_MODEL,
        response_format: { type: "json_object" },
      };
      completion = await groq.chat.completions.create(fallbackParams);
    } else {
      throw err;
    }
  }

  return extractJSON(completion.choices[0].message.content);
}

async function analyzeWithGemini(
  taskDescription,
  proofText,
  fileBase64,
  fileMimeType,
) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Use a stable GA model; override via GEMINI_MODEL env if needed
  const modelName =
    process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const parts = [
    {
      text:
        SYSTEM_PROMPT +
        "\n\n" +
        buildUserMessage(
          taskDescription,
          proofText,
          fileBase64 ? "(file attached)" : null,
        ),
    },
  ];

  if (fileBase64 && fileMimeType) {
    parts.push({ inlineData: { mimeType: fileMimeType, data: fileBase64 } });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  return extractJSON(result.response.text());
}

function buildUserMessage(taskDescription, proofText, fileNote) {
  let msg = `Task Description: "${taskDescription}"\n\n`;
  if (proofText) msg += `Proof/Notes: ${proofText}\n\n`;
  if (fileNote) msg += fileNote;
  return msg;
}

async function analyzeProof({
  taskDescription,
  proofText,
  fileBase64,
  fileMimeType,
}) {
  const provider = process.env.AI_PROVIDER || "groq";

  try {
    if (provider === "gemini") {
      return await analyzeWithGemini(
        taskDescription,
        proofText,
        fileBase64,
        fileMimeType,
      );
    }
    return await analyzeWithGroq(
      taskDescription,
      proofText,
      fileBase64,
      fileMimeType,
    );
  } catch (err) {
    console.error(`AI analysis failed with ${provider}:`, err.message);
    try {
      if (provider === "gemini") {
        return await analyzeWithGroq(
          taskDescription,
          proofText,
          fileBase64,
          fileMimeType,
        );
      }
      return await analyzeWithGemini(
        taskDescription,
        proofText,
        fileBase64,
        fileMimeType,
      );
    } catch (fallbackErr) {
      console.error("Fallback AI also failed:", fallbackErr.message);
      return {
        passed: false,
        confidence: 0,
        analysis:
          "AI analysis is currently unavailable. Please try again later.",
        suggestions: ["Ensure your AI API keys are configured correctly."],
      };
    }
  }
}

// Chat-style analysis for the chatbot
async function chatAnalysis({
  messages,
  taskDescription,
  fileBase64,
  fileMimeType,
}) {
  const provider = process.env.AI_PROVIDER || "groq";

  const systemMsg = `You are the TaskStaker AI assistant. You help users analyze their task completion proofs.
The current task is: "${taskDescription}"
Help the user understand if their proof is sufficient, suggest improvements, and answer questions about the task.
Be concise, direct, and helpful.
IMPORTANT: Respond in plain text only. Do not use markdown formatting — no **bold**, no ## headings, no bullet dashes, no backticks. Write in clear paragraphs.`;

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }],
    }));

    if (contents.length > 0 && contents[0].role === "user") {
      contents[0].parts[0].text =
        systemMsg + "\n\n" + contents[0].parts[0].text;
    }

    if (fileBase64 && fileMimeType) {
      for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role === "user") {
          contents[i].parts.push({
            inlineData: { mimeType: fileMimeType, data: fileBase64 },
          });
          break;
        }
      }
    }

    const result = await model.generateContent({ contents });
    return result.response.text();
  }

  // Groq
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const hasImage =
    fileBase64 && fileMimeType && fileMimeType.startsWith("image/");
  const groqModel = hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  const groqMessages = [
    { role: "system", content: systemMsg },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (hasImage) {
    const lastIdx = groqMessages.length - 1;
    const lastMsg = groqMessages[lastIdx];
    groqMessages[lastIdx] = {
      role: "user",
      content: [
        {
          type: "text",
          text: lastMsg.content || "Please analyze the attached image.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${fileMimeType};base64,${fileBase64}` },
        },
      ],
    };
  }

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: groqModel,
      messages: groqMessages,
      temperature: 0.5,
      max_tokens: 1024,
    });
  } catch (err) {
    // Retry with stable fallback model
    if (!hasImage) {
      completion = await groq.chat.completions.create({
        model: GROQ_FALLBACK_MODEL,
        messages: groqMessages,
        temperature: 0.5,
        max_tokens: 1024,
      });
    } else {
      throw err;
    }
  }

  return completion.choices[0].message.content;
}

module.exports = { analyzeProof, chatAnalysis };
