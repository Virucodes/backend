const express = require("express");
const router = express.Router();
const ChatTest = require("../models/ChatTest");
const User = require("../models/User");
const Annalys = require("../models/Annalys");
const sendRequestToGemini = require("../gemini");
const { messageTest } = require("../constants");

// Create a new chat message
router.post("/", async (req, res) => {
  try {
    const { email, message, response } = req.body;

    const skill = response[0].split(",")[0].trim();

    const textContent = await sendRequestToGemini(messageTest.promptGnerateInitialQuestion + " " + skill);

    message.push(textContent);

    const chatMessage = new ChatTest({
      email,
      message,
      response,
    });

    await chatMessage.save();

    return res.status(201).json({ message: "Chat message created successfully", chatMessage });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create chat message", error: error.message });
  }
});

// Update an existing chat message
router.put("/", async (req, res) => {
  try {
    const { id, email, message, response } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let prompt = "";
    const skill = response[0].split(",")[0].trim();
    const numQuestion = parseInt(response[0].split(",")[1].trim());

    if (numQuestion >= message.length) {
      for (let i = 0; i < Math.max(message.length, response.length); i++) {
        if (message[i]) {
          if (i === 0) {
            continue;
          }
          prompt += `${message[i]}\n`;
        }
      }
      prompt += `${messageTest.promptGnerateNextQuestion} ${skill}`;
    } else {
      for (let i = 0; i < Math.max(message.length, response.length); i++) {
        if (message[i]) {
          if (i === 0) {
            continue;
          }
          prompt += `${message[i]}\n`;
        }

        if (response[i]) {
          prompt += `${response[i]}\n`;
        }
      }
      prompt += `${messageTest.promptAnalysis} ${skill}`;
    }

    const textContent = await sendRequestToGemini(prompt);
    message.push(textContent);

    const updatedChat = await ChatTest.findOneAndUpdate(
      { _id: id },
      { message, response, disable: numQuestion + 2 > message.length ? false : true },
      { new: true }
    );

    if (!(numQuestion + 2 > message.length)) {
      const prompt = textContent + " " + messageTest.summaryAnalysis + " " + skill;

      const textSummary = await sendRequestToGemini(prompt);

      if (textSummary) {
        const existingAnnalys = await Annalys.findOne({ email });

        if (existingAnnalys) {
          updatedAnnalys = await Annalys.findOneAndUpdate(
            { email },
            { $push: { testAnnalys: { summary: textSummary } } },
            { new: true }
          );
        } else {
          const newAnnalys = new Annalys({
            email,
            testAnnalys: [{ summary: textSummary }],
          });
          updatedAnnalys = await newAnnalys.save();
        }
      }
    }

    return res.status(200).json({ message: "Chat message updated successfully", updatedChat });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update chat message", error: error.message });
  }
});

// Get chat messages for a specific user email
router.get("/", async (req, res) => {
  try {
    const email = req.query.email;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const chat = await ChatTest.findOne({ email }).sort({ timestamp: -1 }).limit(1);

    return res.status(200).json(chat);
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve chat messages", error: error.message });
  }
});

// Delete a chat message
router.delete("/", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const deletedChat = await ChatTest.findOneAndDelete({ email });
    if (!deletedChat) {
      return res.status(404).json({ message: "Chat message not found" });
    }

    return res.status(200).json({ message: "Chat message deleted successfully", deletedChat });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete chat message", error: error.message });
  }
});

module.exports = router;
