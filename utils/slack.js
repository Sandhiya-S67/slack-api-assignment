const axios = require("axios");
const { promisify } = require("util");
const sleep = promisify(setTimeout);

const SLACK_API = "https://slack.com/api";
const MESSAGE_SEARCH_TIMEOUT = 5000; // 5 seconds timeout
const MAX_RETRIES = 2;

const headers = {
  Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
  "Content-Type": "application/json",
};

// Simple cache for recent messages
const messageCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Helper: Parse date and time into Unix timestamp
function parseDateTime(dateStr, timeStr) {
  try {
    if (!dateStr || !timeStr) {
      throw new Error("Date and time are required");
    }

    const [day, month, year] = dateStr.split('/').map(Number);
    if (!day || !month || !year) {
      throw new Error("Invalid date format. Use dd/mm/yyyy");
    }

    const timeParts = timeStr.split(':').map(Number);
    if (timeParts.length < 2 || timeParts.some(isNaN)) {
      throw new Error("Invalid time format. Use hh:mm or hh:mm:ss");
    }

    const hours = timeParts[0];
    const minutes = timeParts[1];
    const seconds = timeParts[2] || 0;

    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date or time values");
    }

    return Math.floor(date.getTime() / 1000);
  } catch (error) {
    console.error(`Error parsing date/time: ${error.message}`);
    throw new Error(`Invalid date/time format: ${error.message}`);
  }
}

// Helper: Check if bot is in channel
async function isBotInChannel(channel) {
  try {
    const botRes = await axios.get(`${SLACK_API}/auth.test`, { headers });
    const botId = botRes.data.user_id;
    
    const res = await axios.get(`${SLACK_API}/conversations.members`, {
      params: { channel },
      headers,
    });
    
    return res.data.members.includes(botId);
  } catch (error) {
    console.error(`Error checking channel membership: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Helper: Join channel if not a member
async function joinChannel(channel) {
  try {
    const res = await axios.post(
      `${SLACK_API}/conversations.join`,
      { channel },
      { headers }
    );
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to join channel");
    }
    
    return true;
  } catch (error) {
    console.error(`Error joining channel: ${error.response?.data?.error || error.message}`);
    throw new Error(`Failed to join channel: ${error.response?.data?.error || error.message}`);
  }
}

// Ensure bot is in channel with retry
async function ensureBotInChannel(channel) {
  try {
    if (!channel || !['C', 'G', 'D'].includes(channel[0])) {
      throw new Error('Invalid channel ID format. Must start with C (public), G (private), or D (DM)');
    }

    const isInChannel = await isBotInChannel(channel);
    if (!isInChannel) {
      console.log(`Bot not in channel ${channel}, attempting to join...`);
      await joinChannel(channel);
    }
    return true;
  } catch (error) {
    console.error(`ensureBotInChannel error: ${error.message}`);
    throw error;
  }
}

// Find message by timestamp with timeout and retries
async function findMessageByTimestamp(channel, timestamp) {
  const cacheKey = `${channel}:${timestamp}`;
  
  // Check cache first
  if (messageCache.has(cacheKey)) {
    const cached = messageCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.message;
    }
    messageCache.delete(cacheKey);
  }

  let retries = 0;
  const startTime = Date.now();

  while (retries <= MAX_RETRIES) {
    try {
      // Create a timeout promise
      const timeoutPromise = sleep(MESSAGE_SEARCH_TIMEOUT).then(() => {
        throw new Error("Message search timed out");
      });

      // Create the search promise
      const searchPromise = axios.get(`${SLACK_API}/conversations.history`, {
        params: { 
          channel, 
          oldest: timestamp - 2, // 2 seconds before
          latest: timestamp + 2, // 2 seconds after
          inclusive: true,
          limit: 5
        },
        headers,
      });

      // Race between search and timeout
      const res = await Promise.race([searchPromise, timeoutPromise]);

      if (!res.data.ok || !res.data.messages || res.data.messages.length === 0) {
        throw new Error("Message not found at the specified time");
      }

      // Find the closest message to the requested timestamp
      const closestMessage = res.data.messages.reduce((prev, curr) => {
        const prevDiff = Math.abs(parseFloat(prev.ts) - timestamp);
        const currDiff = Math.abs(parseFloat(curr.ts) - timestamp);
        return currDiff < prevDiff ? curr : prev;
      });

      // Cache the result
      messageCache.set(cacheKey, {
        message: closestMessage,
        timestamp: Date.now()
      });

      return closestMessage;
    } catch (error) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error(`findMessageByTimestamp failed after ${retries} retries: ${error.message}`);
        throw new Error(`Failed to find message: ${error.message}`);
      }
      await sleep(500 * retries); // Exponential backoff
    }
  }

  throw new Error("Max retries reached while searching for message");
}

// Retrieve messages
async function getMessages(channel) {
  try {
    await ensureBotInChannel(channel);
    
    const res = await axios.get(`${SLACK_API}/conversations.history`, {
      params: { 
        channel, 
        limit: 10,
        inclusive: true
      },
      headers,
    });
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to get messages");
    }
    
    // Cache the messages
    if (res.data.messages) {
      res.data.messages.forEach(msg => {
        const cacheKey = `${channel}:${msg.ts}`;
        messageCache.set(cacheKey, {
          message: msg,
          timestamp: Date.now()
        });
      });
    }
    
    return { ok: true, response: res.data };
  } catch (error) {
    console.error(`getMessages error: ${error.message}`);
    throw new Error(`Retrieve messages failed: ${error.response?.data?.error || error.message}`);
  }
}

// Send message
async function sendMessage(channel, text) {
  try {
    await ensureBotInChannel(channel);
    
    const res = await axios.post(
      `${SLACK_API}/chat.postMessage`,
      {
        channel,
        text: text || "Hello from InternshipBot!",
        as_user: true
      },
      { headers }
    );
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to send message");
    }
    
    return { ok: true, response: res.data };
  } catch (error) {
    throw new Error(`Send message failed: ${error.response?.data?.error || error.message}`);
  }
}

// Schedule a message
async function scheduleMessage(channel, text, date, time) {
  try {
    await ensureBotInChannel(channel);
    
    const postAt = parseDateTime(date, time);
    
    const res = await axios.post(
      `${SLACK_API}/chat.scheduleMessage`,
      {
        channel,
        text: text || "Scheduled message from InternshipBot!",
        post_at: postAt,
        as_user: true
      },
      { headers }
    );
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to schedule message");
    }
    
    return { 
      ok: true, 
      response: {
        ...res.data,
        human_readable_schedule: `Scheduled for ${date} at ${time}`
      }
    };
  } catch (error) {
    throw new Error(`Schedule message failed: ${error.message}`);
  }
}

// Edit a message
async function editMessage(channel, date, time, newText) {
  try {
    await ensureBotInChannel(channel);
    
    const timestamp = parseDateTime(date, time);
    const message = await findMessageByTimestamp(channel, timestamp);
    
    const res = await axios.post(
      `${SLACK_API}/chat.update`,
      {
        channel,
        ts: message.ts,
        text: newText || "Updated message from InternshipBot!",
        as_user: true
      },
      { headers }
    );
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to edit message");
    }
    
    // Update cache
    const cacheKey = `${channel}:${message.ts}`;
    messageCache.set(cacheKey, {
      message: { ...message, text: newText },
      timestamp: Date.now()
    });
    
    return { 
      ok: true, 
      response: {
        ...res.data,
        human_readable_time: `Edited message from ${date} at ${time}`
      }
    };
  } catch (error) {
    throw new Error(`Edit message failed: ${error.message}`);
  }
}

// Delete a message
async function deleteMessage(channel, date, time) {
  try {
    await ensureBotInChannel(channel);
    
    const timestamp = parseDateTime(date, time);
    const message = await findMessageByTimestamp(channel, timestamp);
    
    const res = await axios.post(
      `${SLACK_API}/chat.delete`,
      {
        channel,
        ts: message.ts
      },
      { headers }
    );
    
    if (!res.data.ok) {
      throw new Error(res.data.error || "Failed to delete message");
    }
    
    // Clear from cache
    const cacheKey = `${channel}:${message.ts}`;
    messageCache.delete(cacheKey);
    
    return { 
      ok: true, 
      response: {
        ...res.data,
        human_readable_time: `Deleted message from ${date} at ${time}`
      }
    };
  } catch (error) {
    throw new Error(`Delete message failed: ${error.message}`);
  }
}

module.exports = {
  sendMessage,
  scheduleMessage,
  getMessages,
  editMessage,
  deleteMessage,
};
