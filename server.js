require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const slack = require("./utils/slack");

const app = express();
app.use(bodyParser.json());

app.post("/send", async (req, res) => {
  const { text, channel } = req.body;
  try {
    if (!text) {
      return res.status(400).json({ ok: false, error: "Text is required" });
    }
    const result = await slack.sendMessage(channel || "#test", text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/schedule", async (req, res) => {
  const { text, date, time, channel } = req.body;
  try {
    if (!text || !date || !time) {
      return res.status(400).json({ ok: false, error: "Text, date and time are required" });
    }
    const result = await slack.scheduleMessage(channel || "#test", text, date, time);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/messages", async (req, res) => {
  const { channel } = req.query;
  try {
    const result = await slack.getMessages(channel || "#test");
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/edit", async (req, res) => {
  const { date, time, newText, channel } = req.body;
  try {
    if (!date || !time || !newText) {
      return res.status(400).json({ ok: false, error: "Date, time and new text are required" });
    }
    const result = await slack.editMessage(channel || "#test", date, time, newText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/delete", async (req, res) => {
  const { date, time, channel } = req.body;
  try {
    if (!date || !time) {
      return res.status(400).json({ ok: false, error: "Date and time are required" });
    }
    const result = await slack.deleteMessage(channel || "#test", date, time);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});
