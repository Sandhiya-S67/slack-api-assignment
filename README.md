# Slack API Messaging Bot

A Node.js application that interacts with Slack's API to send, schedule, retrieve, edit, and delete messages in a developer sandbox environment.

## Assignment Overview
**Objective**: Build a Slack bot that performs messaging operations using Slack's API in a sandbox environment.

### Core Tasks Implemented
 **Authentication**  
- OAuth token-based authentication with Slack API (`xoxb-` bot token).  

 **Messaging Operations**  
- **Send messages** to channels (`chat.postMessage`).  
- **Schedule messages** for future delivery (`chat.scheduleMessage`).  
- **Retrieve messages** by timestamp (`conversations.history`).  
- **Edit messages** (`chat.update`).  
- **Delete messages** (`chat.delete`).  

**Developer Sandbox**  
- Tested in an isolated Slack sandbox workspace to avoid impacting production data.  

##  Technologies Used
- **Node.js** (v18+)  
- **Express.js** (REST API server)  
- **Axios** (HTTP requests to Slack API)  
- **dotenv** (environment variables)  

##  Setup Instructions

### Prerequisites
1. **Slack Workspace**: Access to a Slack workspace (or sandbox).  
2. **Slack App**: Create an app at [api.slack.com/apps](https://api.slack.com/apps) with:  
   - Bot token scopes: `chat:write`, `chat:write.public`, `chat:write.customize`.  
   - Install the app to your workspace/sandbox.  

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/slack-messaging-bot.git
   cd slack-messaging-bot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (use `.env.example` template):
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   PORT=5000  # Optional
   ```

### Running the Server
```bash
node server.js
```
Server starts at `http://localhost:5000`.

---

##  API Endpoints
| Endpoint       | Method | Description                          | Request Body Example                          |
|----------------|--------|--------------------------------------|-----------------------------------------------|
| `/send`        | POST   | Send a message                       | `{ "text": "Hello!", "channel": "C12345678" }` |
| `/schedule`    | POST   | Schedule a message                   | `{ "text": "Reminder!", "date": "31/12/2023", "time": "14:30", "channel": "C12345678" }` |
| `/messages`    | GET    | Retrieve messages (default: 10 latest) | `?channel=C12345678`                         |
| `/edit`        | POST   | Edit a message by timestamp          | `{ "date": "31/12/2023", "time": "14:30", "newText": "Updated!", "channel": "C12345678" }` |
| `/delete`      | DELETE | Delete a message by timestamp        | `{ "date": "31/12/2023", "time": "14:30", "channel": "C12345678" }` |

---

##  Testing
1. **Using Postman/Thunder Client**:  
   - Import the included `Slack_Bot_API_Collection.json` (if available).  
   - Example request to send a message:  
     ```json
     {
       "text": "Test message",
       "channel": "C12345678"
     }
     ```
2. **Sandbox Testing**:  
   - All operations are confined to the Slack sandbox workspace.  

---
