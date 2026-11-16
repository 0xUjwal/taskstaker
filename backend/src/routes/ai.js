const express = require("express");
const multer = require("multer");
const { ethers } = require("ethers");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const { analyzeProof, chatAnalysis } = require("../services/ai");
const supabase = require("../services/supabase");

const { requireTaskAccess } = require('../services/taskAccess');
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}); // 10MB max

async function resolveProofUrl(taskId, explicitProofUrl) {
  if (explicitProofUrl) return explicitProofUrl;
  if (taskId === undefined || taskId === null || taskId === "") return null;

  try {
    const abi = require("../../abi/TaskStakerV2.json").abi;
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL,
    );
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      provider,
    );
    const task = await contract.getTask(Number(taskId));
    return task?.proofUrl || null;
  } catch {
    return null;
  }
}

async function fetchProofFileFromUrl(url) {
  if (!url) return { fileBase64: null, fileMimeType: null };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { fileBase64: null, fileMimeType: null };
    }

    const mime =
      response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      fileBase64: buffer.toString("base64"),
      fileMimeType: mime,
    };
  } catch {
    return { fileBase64: null, fileMimeType: null };
  }
}

// Analyze proof for a task
router.post(
  "/analyze",
  requireAuthentication,
  upload.single("file"),
  async (req, res) => {
    try {
      const { taskDescription, proofText, taskId, proofUrl } = req.body;

      if (!taskDescription) {
        return res.status(400).json({ error: "Task description is required" });
      }

      if (taskId !== undefined && taskId !== null && taskId !== '') {
        await requireTaskAccess(getUserId(req), taskId);
      }

      let fileBase64 = null;
      let fileMimeType = null;

      if (req.file) {
        fileBase64 = req.file.buffer.toString("base64");
        fileMimeType = req.file.mimetype;
      } else {
        const resolvedUrl = await resolveProofUrl(taskId, proofUrl);
        const fetched = await fetchProofFileFromUrl(resolvedUrl);
        fileBase64 = fetched.fileBase64;
        fileMimeType = fetched.fileMimeType;
      }

      const analysis = await analyzeProof({
        taskDescription,
        proofText: proofText || "",
        fileBase64,
        fileMimeType,
      });

      // Store analysis in database — non-fatal if table missing or insert fails
      if (taskId !== undefined && taskId !== null && taskId !== '') {
        supabase
          .from("ai_analyses")
          .insert({ task_id: parseInt(taskId), analysis })
          .then(({ error }) => {
            if (error) console.warn("ai_analyses insert failed:", error.message);
          })
          .catch((e) => console.warn("ai_analyses insert error:", e.message));
      }

      res.json({ analysis });
    } catch (err) {
      console.error("AI analyze error:", err);
      if (err.status) return res.status(err.status).json({ error: err.message });
      // Never return 500 — return a usable default so the chatbot stays functional
      res.json({
        analysis: {
          passed: false,
          confidence: 0,
          analysis: "Could not complete analysis. You can still chat about this task.",
          suggestions: [],
        },
      });
    }
  },
);

// Chat endpoint for the AI chatbot
router.post(
  "/chat",
  requireAuthentication,
  upload.single("file"),
  async (req, res) => {
    try {
      const { messages, taskDescription } = req.body;

      if (!taskDescription || !messages) {
        return res
          .status(400)
          .json({ error: "Task description and messages are required" });
      }

      const parsedMessages =
        typeof messages === "string" ? JSON.parse(messages) : messages;

      let fileBase64 = null;
      let fileMimeType = null;

      if (req.file) {
        fileBase64 = req.file.buffer.toString("base64");
        fileMimeType = req.file.mimetype;
      }

      const reply = await chatAnalysis({
        messages: parsedMessages,
        taskDescription,
        fileBase64,
        fileMimeType,
      });

      res.json({ reply });
    } catch (err) {
      console.error("AI chat error:", err);
      res.json({ reply: "Sorry, I could not process that. Please try again." });
    }
  },
);

// Get AI analysis for a task
router.get("/analysis/:taskId", requireAuthentication, async (req, res) => {
  try {
    const { taskId } = req.params;
    await requireTaskAccess(getUserId(req), taskId);
    res.set('Cache-Control', 'private, no-store');

    const { data, error } = await supabase
      .from("ai_analyses")
      .select("*")
      .eq("task_id", parseInt(taskId))
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "No analysis found" });
    }

    res.json({ analysis: data.analysis });
  } catch (err) {
    console.error("Get analysis error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to get analysis" });
  }
});

module.exports = router;
