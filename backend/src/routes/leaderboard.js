const express = require("express");
const supabase = require("../services/supabase");

const router = express.Router();

// Get leaderboard (top 50 users by completed tasks)
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("username, unique_id, completed_tasks")
      .gt("completed_tasks", 0)
      .order("completed_tasks", { ascending: false })
      .limit(50);

    if (error) throw error;

    const leaderboard = (data || []).map((user, index) => ({
      rank: index + 1,
      username: user.username,
      uniqueId: user.unique_id,
      completedTasks: user.completed_tasks,
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

module.exports = router;
