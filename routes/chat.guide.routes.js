const express = require("express");
const router = express.Router();
const ChatGuide = require("../models/ChatGuide");
const User = require("../models/User");
const Annalys = require("../models/Annalys");
const sendRequestToGemini = require("../gemini");
const { messageGuide } = require("../constants");

// Create a new chat message
router.post("/", async (req, res) => {
  try {
    const { email, message, response } = req.body;

    if (!email || !message || !response) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const initialPrompt = messageGuide.promptGnerateInitialQuestion;
    const generatedText = await sendRequestToGemini(initialPrompt);

    if (!generatedText) {
      return res.status(500).json({ message: "Failed to generate response from Gemini" });
    }

    message.push(generatedText);

    const chatMessage = new ChatGuide({
      email,
      message,
      response,
    });

    await chatMessage.save();

    return res.status(201).json({
      message: "Chat message created successfully",
      chatMessage,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create chat message",
      error: error.message,
    });
  }
});

// Update an existing chat message
router.put("/", async (req, res) => {
  try {
    const { id, email, message, response } = req.body;

    if (!id || !email || !message || !response) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let prompt = "";
    const numQuestion = parseInt(response[0]?.split(",")[1]?.trim() || 0);

    for (let i = 1; i < Math.max(message.length, response.length); i++) {
      if (message[i]) prompt += `${message[i]}\n`;
      if (response[i]) prompt += `${response[i]}\n`;
    }
    prompt += numQuestion >= message.length 
      ? messageGuide.promptGnerateNextQuestion 
      : messageGuide.promptAnalysis;

    const generatedText = await sendRequestToGemini(prompt);
    if (!generatedText) {
      return res.status(500).json({ message: "Failed to generate response from Gemini" });
    }

    message.push(generatedText);

    const updatedChat = await ChatGuide.findByIdAndUpdate(
      id,
      {
        message,
        response,
        disable: numQuestion + 2 > message.length ? false : true,
      },
      { new: true }
    );

    if (numQuestion + 2 <= message.length) {
      const summaryPrompt = `${generatedText} ${messageGuide.summaryAnalysis}`;
      const textSummary = await sendRequestToGemini(summaryPrompt);

      if (textSummary) {
        const annalys = await Annalys.findOneAndUpdate(
          { email },
          { $push: { careerAnnalys: { summary: textSummary } } },
          { new: true, upsert: true }
        );
      }
    }

    return res.status(200).json({
      message: "Chat message updated successfully",
      updatedChat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update chat message",
      error: error.message,
    });
  }
});

// Get chat messages for a specific user email
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const chat = await ChatGuide.findOne({ email }).sort({ timestamp: -1 }).limit(1);

    return res.status(200).json(chat || { message: "No chat messages found" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve chat messages",
      error: error.message,
    });
  }
});

// Delete a chat message
router.delete("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedChat = await ChatGuide.findOneAndDelete({ email });
    if (!deletedChat) {
      return res.status(404).json({ message: "Chat message not found" });
    }

    return res.status(200).json({
      message: "Chat message deleted successfully",
      deletedChat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete chat message",
      error: error.message,
    });
  }
});

module.exports = router;
