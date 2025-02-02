const axios = require("axios");
require("dotenv").config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendRequestToGemini = async (prompt) => {
  console.log(prompt);
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const requestData = {
    contents: [
      {
        parts: [
          {
            text: prompt+"be concise",
          },
        ],
      },
    ],
  };

  let retries = 3; // Number of retry attempts
  while (retries > 0) {
    try {
      console.log("Sending request to API...");
      const response = await axios.post(apiUrl, requestData);
      
      console.log(response);
      // Extract the text content from the response
      const textContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error("No content received from the API response.");
      }

      console.log(textContent);
      return textContent;
    } catch (error) {
      const statusCode = error.response?.status;

      if (statusCode === 429) {
        // Handle quota exceeded error
        console.error("Quota exceeded. Retrying after a delay...");
        await delay(30000); // Wait 30 seconds before retrying
      } else if (statusCode >= 500 && statusCode < 600) {
        // Handle server errors (5xx)
        console.error(`Server error (status: ${statusCode}). Retrying...`);
        await delay(10000); // Wait 10 seconds before retrying
      } else {
        // Handle other errors
        console.error("An error occurred:", error.message);
        throw error; // Re-throw error if it's not a recoverable error
      }

      retries -= 1; // Decrement the retry counter
    }
  }

  throw new Error("Failed to process the request after multiple attempts.");
};

module.exports = sendRequestToGemini;
