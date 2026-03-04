// src/services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";

// Minimal Notice interface for fallback
interface Notice {
  id: number;
  title: string;
  content: string;
  date_posted: string;
  category?: string;
  department?: string;
  branch?: string;
  year?: string;
}

// Context for follow-up questions
interface ConversationContext {
  lastNotice?: Notice;
  lastFaq?: any;
  lastResponse?: string;
  lastTopic?: string;
}

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Gemini client initialized");
  } else {
    console.warn("GEMINI_API_KEY not set – AI features disabled, using fallback.");
  }
} catch (e) {
  console.warn("Failed to initialize Gemini client", e);
}

// ==================== DATE EXTRACTION ====================
function extractDeadlineFallback(noticeText: string): { event: string; date: string; description: string } | null {
  const datePatterns = [
    // Month Day, Year (e.g., "March 25th, 2026")
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i,
    // Day Month Year (e.g., "25th March 2026")
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
    // Relative dates
    /\b(tomorrow|next week|next month|today|tonight)\b/i,
    // Numeric dates
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b|\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/
  ];

  for (let pattern of datePatterns) {
    const match = noticeText.match(pattern);
    if (match) {
      const firstSentence = noticeText.split(/[.!?\n]/)[0].trim();
      const event = firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence;
      const date = match[0];
      const description = noticeText.substring(0, 200) + (noticeText.length > 200 ? '...' : '');
      return { event, date, description };
    }
  }
  return null;
}

export async function extractDeadline(noticeText: string) {
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: `Extract any deadlines or event dates from the following campus notice. Return a JSON object with 'event', 'date' (ISO format if possible), and 'description'. If no date is found, return null.
        
        Notice: ${noticeText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              event: { type: Type.STRING },
              date: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(response.text || "null");
    } catch (error) {
      console.error("AI Deadline Extraction Error, using fallback:", error);
    }
  }
  return extractDeadlineFallback(noticeText);
}

export async function classifyIssuePriority(description: string) {
  if (!ai) return { priority: "Medium" };
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: `Classify the priority of the following campus infrastructure issue as 'High', 'Medium', or 'Low'. 
      High: Safety hazards (fire, sparks, collapse, major leaks).
      Medium: Functional issues (broken fan, projector, furniture).
      Low: Aesthetic or non-urgent (paint, cleaning, minor scratches).
      
      Issue: ${description}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            reason: { type: Type.STRING }
          },
          required: ["priority"]
        }
      }
    });
    return JSON.parse(response.text || '{"priority": "Medium"}');
  } catch (error) {
    console.error("AI Priority Classification Error:", error);
    return { priority: "Medium" };
  }
}

// ==================== SENTIMENT DETECTION ====================
function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const positiveWords = ['happy', 'good', 'great', 'awesome', 'excellent', 'fine', 'well', 'love', 'glad', 'thank'];
  const negativeWords = ['sad', 'depress', 'bad', 'terrible', 'awful', 'stressed', 'anxious', 'upset', 'worried', 'tired', 'down', 'struggling', 'frustrated'];
  
  let score = 0;
  positiveWords.forEach(word => { if (lower.includes(word)) score += 1; });
  negativeWords.forEach(word => { if (lower.includes(word)) score -= 1; });
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

// ==================== FALLBACK CONVERSATIONAL HANDLER ====================
function handleCasualConversation(question: string, sentiment: 'positive' | 'negative' | 'neutral'): string | null {
  const lowerQ = question.toLowerCase().trim();
  
  // Sentiment-based responses for emotional cues
  if (sentiment === 'negative') {
    const empatheticResponses = [
      "I'm really sorry you're feeling that way. 😔 Want to talk about it or maybe I can help with something campus-related?",
      "That sounds tough. Remember, you're not alone – the campus counseling center is here for you. Can I help you find resources?",
      "I'm here for you. Sometimes taking a break or chatting with a friend helps. Is there anything specific I can assist with?",
      "I'm sorry you're feeling down. Would you like to know about some upcoming events or activities to cheer you up?",
    ];
    return empatheticResponses[Math.floor(Math.random() * empatheticResponses.length)];
  }
  
  if (sentiment === 'positive') {
    const positiveResponses = [
      "That's awesome to hear! 😊 What can I do for you today?",
      "Glad you're doing well! How can I help?",
      "Great! Anything exciting happening on campus you want to know about?",
    ];
    return positiveResponses[Math.floor(Math.random() * positiveResponses.length)];
  }
  
  // Neutral casual conversation
  if (lowerQ.match(/^(hi|hello|hey|howdy|greetings|sup|what'?s up)$/i)) {
    const greetings = [
      "Hey there! 👋 How can I help you today?",
      "Hello! 😊 What's on your mind?",
      "Hi! Ready to tackle some campus questions?",
      "Hey! What can I do for you today?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  if (lowerQ.match(/how (are|'re) you|how(?:')?s it going|what'?s up|how do you do/i)) {
    const responses = [
      "I'm doing great, thanks for asking! 😊 How about you?",
      "Feeling helpful and ready to assist! What do you need?",
      "All good here! Just hanging out in the digital campus. What's up?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  if (lowerQ.match(/thank(s| you)|thx|appreciate it/i)) {
    const thanks = [
      "You're welcome! 😊 Happy to help!",
      "Anytime! That's what I'm here for.",
      "Glad I could assist! Anything else?",
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }
  
  if (lowerQ.match(/bye|goodbye|see ya|cya|farewell/i)) {
    const byes = [
      "Goodbye! 👋 Come back if you need anything!",
      "See you later! Have a great day!",
      "Take care! Don't forget to check your deadlines!",
    ];
    return byes[Math.floor(Math.random() * byes.length)];
  }
  
  if (lowerQ.match(/you'?re (great|awesome|helpful|the best|amazing)/i)) {
    return "Aww, thanks! You're pretty awesome yourself 😊";
  }
  
  if (lowerQ.match(/who are you|what are you|your name/i)) {
    return "I'm CampusBuddy, your friendly campus assistant! I can help with notices, deadlines, FAQs, and just chat 😊";
  }
  
  if (lowerQ.match(/what can you do|help me|capabilities/i)) {
    return "I can answer questions about campus notices, events, deadlines, FAQs, and I'm also here to chat! Ask me about exam schedules, fee deadlines, events, or just say hi 😊";
  }
  
  return null;
}

// Handle follow-up questions like "explain this" using context
function handleFollowUp(question: string, context: ConversationContext): string | null {
  const lowerQ = question.toLowerCase().trim();
  
  if (lowerQ.match(/explain|tell me more|what does this mean|can you elaborate|more details|what is this|what's that/i)) {
    if (context.lastNotice) {
      return `📢 Here's the full notice "${context.lastNotice.title}" (posted on ${new Date(context.lastNotice.date_posted).toLocaleDateString()}):\n\n${context.lastNotice.content}\n\nDoes that help? 😊`;
    }
    if (context.lastFaq) {
      return `🤔 Here's the FAQ I mentioned:\nQ: ${context.lastFaq.question}\nA: ${context.lastFaq.answer}`;
    }
    if (context.lastResponse) {
      return context.lastResponse;
    }
  }
  
  return null;
}

// Enhanced fallback that searches both FAQs and notices with friendly tone
function getFallbackResponse(question: string, faqs: any[], notices: Notice[], context?: ConversationContext): string {
  const sentiment = detectSentiment(question);
  
  // First check for casual conversation + sentiment
  const casual = handleCasualConversation(question, sentiment);
  if (casual) return casual;
  
  // Check for follow-up using context
  if (context) {
    const followUp = handleFollowUp(question, context);
    if (followUp) return followUp;
  }
  
  // Search FAQs
  for (let faq of faqs) {
    if (faq.question.toLowerCase().includes(question.toLowerCase()) || 
        question.toLowerCase().includes(faq.question.toLowerCase())) {
      return `😊 ${faq.answer}`;
    }
  }
  
  // Search notices
  for (let notice of notices) {
    if (notice.title.toLowerCase().includes(question.toLowerCase()) || 
        question.toLowerCase().includes(notice.title.toLowerCase()) ||
        notice.content.toLowerCase().includes(question.toLowerCase()) || 
        question.toLowerCase().includes(notice.content.toLowerCase())) {
      return `📢 According to the notice "${notice.title}" (posted on ${new Date(notice.date_posted).toLocaleDateString()}):\n\n${notice.content.substring(0, 150)}...\n\nHope that helps! 😊`;
    }
  }
  
  // Keyword matching on FAQs (words longer than 3 chars)
  const keywords = question.toLowerCase().split(' ').filter(k => k.length > 3);
  for (let faq of faqs) {
    const faqWords = faq.question.toLowerCase().split(' ');
    for (let kw of keywords) {
      if (faqWords.some((word: string) => word.includes(kw))) {
        return `🤔 I found this related FAQ: ${faq.answer}`;
      }
    }
  }
  
  // Keyword matching on notices
  for (let notice of notices) {
    const noticeWords = (notice.title + ' ' + notice.content).toLowerCase().split(' ');
    for (let kw of keywords) {
      if (noticeWords.some((word: string) => word.includes(kw))) {
        return `📌 I found a notice titled "${notice.title}" that might help:\n${notice.content.substring(0, 150)}...`;
      }
    }
  }
  
  // Friendly "I don't know" responses
  const idkResponses = [
    "Hmm, I'm not sure about that one. 😕 Want to ask me something else?",
    "Good question! I don't have that info right now – maybe check with the admin office?",
    "I wish I could help with that, but I don't know the answer. Anything else I can do for you? 😊",
    "That's a great question, but I'm drawing a blank. Try asking in a different way?",
    "Not sure about that, but I'm here to chat! What else is on your mind?",
  ];
  return idkResponses[Math.floor(Math.random() * idkResponses.length)];
}

export async function getChatbotResponse(
  question: string, 
  faqs: any[], 
  notices?: Notice[], 
  context?: ConversationContext
): Promise<{ text: string; newContext: ConversationContext }> {
  let newContext: ConversationContext = { ...context };
  
  // If Gemini is available, use it with a friendly persona
  if (ai) {
    try {
      const faqContext = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
      const noticeContext = notices ? notices.map(n => `Notice: ${n.title}\nContent: ${n.content}`).join("\n\n") : '';
      const fullContext = `FAQs:\n${faqContext}\n\nRecent Notices:\n${noticeContext}`;
      
      const history = context?.lastResponse ? `Previous assistant message: ${context.lastResponse}\n\n` : '';
      
      const prompt = `You are CampusBuddy, a warm, empathetic, and friendly assistant for students and staff at a college campus. 
      You can engage in casual conversation, provide emotional support, and answer questions based on the provided FAQs and notices. 
      Your tone should be warm, conversational, and supportive. Use emojis occasionally to be friendly. 
      If the user expresses sadness, stress, or depression, respond with empathy and offer support or resources (like the counseling center). 
      If the user asks a follow-up question like "explain more" or "what does that mean", elaborate using the context provided. 
      If you don't know, say something like "I'm not sure, but I can try to help with something else!" and suggest asking the admin office if needed.
      
      ${history}
      ${fullContext}
      
      User: ${question}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt,
      });
      
      const text = response.text || "I'm not sure how to respond to that.";
      newContext.lastResponse = text;
      if (notices && text.includes('notice')) {
        for (let n of notices) {
          if (text.includes(n.title)) {
            newContext.lastNotice = n;
            break;
          }
        }
      }
      return { text, newContext };
    } catch (error) {
      console.error("AI Chatbot Error, falling back to keyword matching:", error);
    }
  }
  
  const fallbackText = getFallbackResponse(question, faqs, notices || [], context);
  
  if (fallbackText.startsWith("📢 According to the notice")) {
    const match = fallbackText.match(/"([^"]+)"/);
    if (match && notices) {
      const title = match[1];
      const foundNotice = notices.find(n => n.title === title);
      if (foundNotice) newContext.lastNotice = foundNotice;
    }
  }
  newContext.lastResponse = fallbackText;
  
  return { text: fallbackText, newContext };
}