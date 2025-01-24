import OpenAI from "openai";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import express from "express";
import path from "path";

dotenv.config();
const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 8080;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";//only for testing purposes. remove this line in production

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/authorize", (req, res) => {
    res.redirect('https://zoom.us/launch/chat?jid=robot_' + process.env.ZOOM_BOT_JID);
});

app.post("/generate-image", async (req, res) => {
    const prompt = req.body.prompt;
    try {
        const imageUrl = await generateImageUrl(prompt);
        const imageResponse = await axios.get(imageUrl, { responseType: "stream" });
        res.setHeader("Content-Type", "image/png");
        imageResponse.data.pipe(res);
    } catch (error) {
        console.error("Failed to generate image:", error.message);
        res.status(500).send("Failed to generate image");
    }
});

async function generateImageUrl(prompt) {
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `draw an illustration of ${prompt}`,
            n: 1,
            size: "1024x1024",
        });
        console.log("Response:", response.data);
        const imageUrl = response.data[0].url;
        console.log(`Image URL: ${imageUrl}`);
        return imageUrl;
    } catch (error) {
        console.error("Error:", error.message);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});