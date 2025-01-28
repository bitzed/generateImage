import OpenAI from "openai";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import express from "express";
import crypto from "crypto";

dotenv.config();
const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 8080;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";//only for testing purposes. remove this line in production

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/authorize", (req, res) => {
    res.redirect('https://zoom.us/launch/chat?jid=robot_' + process.env.ZOOM_BOT_JID);
});

app.post("/generate-image", async (req, res) => {
    console.log("Request:", req.body);
    if(verifyWebhook(req)){
        var response = {message: 'Authorized request from Zoom Team Chat.', status: 200};
        console.log(response);
        if(req.body.event === 'endpoint.url_validation'){
            response = {
                message: {
                    plainToken: req.body.payload.plainToken,
                    encryptedToken: validateWebhook(req)
                },
                status: 200
            }
        }else if(req.body.event === 'bot_notification'){
            console.log("Bot Notification:", req.body.payload);
            const prompt = `draw an flat illustration of ${req.body.payload.cmd}`;
            console.log("Cmd:", prompt);
            try {
                const imageUrl = await generateImageUrl(prompt);
                sendChat(req.body.payload.toJid,req.body.payload.accountId,imageUrl,prompt);
            } catch (error) {
                console.error("Failed to generate image:", error.message);
                res.status(500).send("Failed to generate image");
            }
        }else{
            console.log("Other event.");
        }
        console.log(response.message);
        res.status(response.status).json(response);
    }else{
        res.status(401).send("Unauthorized request");
    }
});

async function generateImageUrl(prompt) {
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
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

async function sendChat(rid, aid, imageUrl, prompt) {
    try {
        const authResponse = await axios.post('https://api.zoom.us/oauth/token?grant_type=client_credentials', {}, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`
            }
        });
        
        const messageResponse = await axios.post('https://api.zoom.us/v2/im/chat/messages', {
            "robot_jid": process.env.ZOOM_BOT_JID,
            "to_jid": rid,
            "account_id": aid,
            "content": {
                "head": {
                    "text": "DALL-E Image"
                },
                "body": [{
                    "type": "attachments",
                    "img_url": imageUrl,
                    "resource_url": imageUrl,
                    "information": {
                        "title": {
                            "text": "DALL-E Image"
                        },
                        "description": {
                            "text": prompt
                        }
                    }
                }]
            }
        }, {
            headers: {
                'Authorization': `Bearer ${authResponse.data.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Message sent successfully:', messageResponse.data);
        return messageResponse.data;
        
    } catch (error) {
        console.error('Error in sendChat:', error.response?.data || error.message);
        throw error;
    }
}


function verifyWebhook(req) {
    const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`
    const hashForVerify = crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(message).digest('hex')
    const signature = `v0=${hashForVerify}`
    return req.headers['x-zm-signature'] === signature
}
  
function validateWebhook(req) {
    return crypto.createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN).update(req.body.payload.plainToken).digest('hex')
}  

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});