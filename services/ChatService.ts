// ============================================================================
// ENTERPRISE-GRADE CLARITY AI CHAT SERVICE
// Advanced conversational AI with intent classification, entity extraction,
// context management, and robust action execution
// ============================================================================

import { GoogleGenAI, Type } from '@google/genai';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: Intent;
    entities?: Entity[];
    confidence?: number;
    processingTime?: number;
    actionsTaken?: string[];
  };
}

export interface Intent {
  primary: IntentType;
  secondary?: IntentType;
  confidence: number;
  raw?: string;
}

export type IntentType =
  | 'query_information'      // User asking questions about project data
  | 'request_action'         // User wants to perform an action
  | 'request_navigation'     // User wants to go somewhere
  | 'request_explanation'    // User wants something explained
  | 'request_summary'        // User wants a summary of something
  | 'provide_feedback'       // User giving feedback/confirmation
  | 'clarification'          // User asking for clarification
  | 'greeting'               // Social/greeting
  | 'unknown';               // Cannot determine intent

export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
  normalized?: string;
  id?: string;
}

export type EntityType =
  | 'task'
  | 'insight'
  | 'brd_section'
  | 'source'
  | 'goal'
  | 'date'
  | 'priority'
  | 'status'
  | 'category'
  | 'person'
  | 'action_verb'
  | 'navigation_target';

export interface ProjectContext {
  name: string;
  goals?: string;
  sources: Array<{ id: string; name: string; type: string; content?: string }>;
  insights: Array<{ 
    id: string; 
    category: string; 
    summary: string; 
    detail: string; 
    status: string;
    source?: string;
  }>;
  tasks: Array<{ 
    id: string; 
    title: string; 
    type: string; 
    urgency: string; 
    status?: string;
    description?: string;
  }>;
  brd?: { 
    sections: Array<{ 
      id: string; 
      title: string; 
      content: string;
      status?: string;
      confidence?: number;
    }>;
    status?: string;
    lastGenerated?: string;
  };
  activityLog?: Array<{ action: string; timestamp: string; actor: string }>;
}

export interface ConversationState {
  sessionId: string;
  turnCount: number;
  lastIntent?: Intent;
  pendingAction?: AIAction;
  awaitingConfirmation: boolean;
  contextStack: Array<{ topic: string; timestamp: string }>;
  userPreferences: {
    verbosity: 'concise' | 'detailed';
    formality: 'casual' | 'formal';
  };
}

export type AIActionType =
  | 'none'
  | 'add_task'
  | 'complete_task'
  | 'delete_task'
  | 'update_task'
  | 'add_insight'
  | 'approve_insight'
  | 'reject_insight'
  | 'approve_all_insights'
  | 'update_brd_section'
  | 'add_brd_section'
  | 'regenerate_brd_section'
  | 'update_project_goals'
  | 'update_project_name'
  | 'navigate'
  | 'search'
  | 'export'
  | 'bulk_operation';

export interface AIAction {
  type: AIActionType;
  data: Record<string, unknown>;
  description: string;
  confidence: number;
  requiresConfirmation: boolean;
  rollbackData?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  actions: AIAction[];
  intent: Intent;
  entities: Entity[];
  suggestions?: string[];
  requiresConfirmation: boolean;
  confidence: number;
  processingMetadata: {
    totalTime: number;
    intentClassificationTime: number;
    responseGenerationTime: number;
    cached: boolean;
  };
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const MODEL_ID = 'gemini-2.0-flash';

const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  query_information: [
    /^(what|where|which|who|how many|how much|tell me about|show me|list|find|search|get|retrieve)/i,
    /\?$/,
    /(status|state|progress|details|information|info) (of|about|on|for)/i,
  ],
  request_action: [
    /^(add|create|make|update|edit|change|modify|delete|remove|complete|finish|mark|set|approve|reject)/i,
    /(please|can you|could you|would you|i want to|i need to|let's)/i,
  ],
  request_navigation: [
    /^(go to|navigate|take me|show me|open|view|see)/i,
    /(page|section|view|screen|tab|dashboard)/i,
  ],
  request_explanation: [
    /^(explain|why|how does|what does|help me understand|clarify)/i,
    /(mean|means|meaning|purpose|reason)/i,
  ],
  request_summary: [
    /^(summarize|summary|overview|brief|tldr|recap)/i,
    /(executive summary|quick summary|main points|key points)/i,
  ],
  provide_feedback: [
    /^(yes|no|okay|ok|sure|thanks|thank you|great|good|perfect|confirmed|cancel|nevermind)/i,
    /(looks good|that's right|correct|wrong|not what i wanted)/i,
  ],
  clarification: [
    /^(what do you mean|i don't understand|can you clarify|which one|be more specific)/i,
    /\?\s*$/,
  ],
  greeting: [
    /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|greetings)/i,
    /^(how are you|what's up|sup)/i,
  ],
  unknown: [],
};

const ENTITY_PATTERNS: Record<EntityType, RegExp[]> = {
  task: [/task\s*["']?([^"'\n]+)["']?/i, /["']([^"']+)["']\s*task/i],
  insight: [/insight\s*["']?([^"'\n]+)["']?/i, /["']([^"']+)["']\s*insight/i],
  brd_section: [
    /(executive summary|scope|requirements|stakeholders|timeline|budget|risks|assumptions|constraints|dependencies|glossary|appendix)/i,
  ],
  source: [/source\s*["']?([^"'\n]+)["']?/i, /from\s*["']?([^"'\n]+)["']?/i],
  goal: [/goal\s*["']?([^"'\n]+)["']?/i, /objective\s*["']?([^"'\n]+)["']?/i],
  date: [/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /(today|tomorrow|yesterday|next week|this week)/i],
  priority: [/(high|medium|low|urgent|critical)\s*(priority)?/i],
  status: [/(pending|approved|rejected|completed|done|in progress|draft)/i],
  category: [/(functional|non-functional|technical|business|user|system)/i],
  person: [/@(\w+)/i, /(assigned to|owner|stakeholder)\s+(\w+)/i],
  action_verb: [/^(add|create|update|delete|remove|complete|approve|reject|edit|change)/i],
  navigation_target: [/(sources?|insights?|brd|generate|graph|dashboard|home|settings)/i],
};

const RESPONSE_TEMPLATES = {
  greeting: [
    "Hey there! 👋 How can I help you with your BRD today?",
    "Hi! Ready to help with your project. What do you need?",
    "Hello! What can I do for you?",
  ],
  confirmation_request: [
    "Just to confirm - you want me to {action}. Is that right?",
    "Before I proceed: {action}. Should I go ahead?",
    "I'll {action}. Does that sound correct?",
  ],
  action_success: [
    "Done! ✅ {action}",
    "Got it! {action}",
    "All set! {action}",
  ],
  action_error: [
    "Hmm, I ran into an issue: {error}. Want to try again?",
    "Something went wrong: {error}. Let me know if you need help.",
  ],
  no_results: [
    "I couldn't find anything matching that. Could you be more specific?",
    "No results found. Try rephrasing your request?",
  ],
  clarification_needed: [
    "I want to make sure I help correctly. Did you mean {options}?",
    "Could you clarify? I'm not sure if you want {options}.",
  ],
  not_understood: [
    "I'm not quite sure what you're looking for. Could you rephrase that?",
    "I didn't catch that. Can you tell me more about what you need?",
  ],
};

// ============================================================================
// CACHE & RATE LIMITING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 100;

  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  generateKey(...parts: unknown[]): string {
    return parts.map(p => JSON.stringify(p)).join('::');
  }
}

class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter(t => t > cutoff);
  }

  getWaitTime(): number {
    if (this.canMakeRequest()) return 0;
    return this.requests[0] + this.windowMs - Date.now();
  }
}

// ============================================================================
// MAIN CHAT SERVICE CLASS
// ============================================================================

export class ClarityChatService {
  private ai: GoogleGenAI;
  private cache: ResponseCache;
  private rateLimiter: RateLimiter;
  private conversationState: ConversationState;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
    this.cache = new ResponseCache();
    this.rateLimiter = new RateLimiter(60000, 30);
    this.conversationState = this.initConversationState();
  }

  private initConversationState(): ConversationState {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      turnCount: 0,
      awaitingConfirmation: false,
      contextStack: [],
      userPreferences: {
        verbosity: 'concise',
        formality: 'casual',
      },
    };
  }

  // ==========================================================================
  // INTENT CLASSIFICATION
  // ==========================================================================

  classifyIntent(message: string): Intent {
    const normalizedMessage = message.toLowerCase().trim();
    const scores: Record<IntentType, number> = {
      query_information: 0,
      request_action: 0,
      request_navigation: 0,
      request_explanation: 0,
      request_summary: 0,
      provide_feedback: 0,
      clarification: 0,
      greeting: 0,
      unknown: 0,
    };

    // Pattern matching scoring
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          scores[intent as IntentType] += 25;
        }
      }
    }

    // Keyword boosting
    const actionKeywords = ['add', 'create', 'update', 'delete', 'remove', 'complete', 'approve', 'reject', 'edit', 'change', 'modify', 'set'];
    const queryKeywords = ['what', 'where', 'which', 'who', 'how', 'show', 'list', 'find', 'tell', 'give'];
    const navKeywords = ['go', 'navigate', 'take', 'open', 'view'];
    const summaryKeywords = ['summary', 'summarize', 'overview', 'brief', 'recap', 'executive'];

    const words = normalizedMessage.split(/\s+/);
    const firstWord = words[0];

    if (actionKeywords.includes(firstWord)) scores.request_action += 40;
    if (queryKeywords.includes(firstWord)) scores.query_information += 40;
    if (navKeywords.includes(firstWord)) scores.request_navigation += 40;
    if (summaryKeywords.some(k => normalizedMessage.includes(k))) scores.request_summary += 35;

    // Check for confirmation context
    if (this.conversationState.awaitingConfirmation) {
      if (/^(yes|yeah|yep|sure|ok|okay|confirm|proceed|go ahead|do it)$/i.test(normalizedMessage)) {
        scores.provide_feedback += 50;
      }
      if (/^(no|nope|cancel|stop|nevermind|don't|dont)$/i.test(normalizedMessage)) {
        scores.provide_feedback += 50;
      }
    }

    // Find highest scoring intent
    let maxScore = 0;
    let primaryIntent: IntentType = 'unknown';
    let secondaryIntent: IntentType | undefined;

    const sortedIntents = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0);

    if (sortedIntents.length > 0) {
      [primaryIntent, maxScore] = sortedIntents[0] as [IntentType, number];
      if (sortedIntents.length > 1 && sortedIntents[1][1] > 15) {
        secondaryIntent = sortedIntents[1][0] as IntentType;
      }
    }

    return {
      primary: primaryIntent,
      secondary: secondaryIntent,
      confidence: Math.min(100, maxScore),
      raw: message,
    };
  }

  // ==========================================================================
  // ENTITY EXTRACTION
  // ==========================================================================

  extractEntities(message: string, context: ProjectContext): Entity[] {
    const entities: Entity[] = [];
    const normalizedMessage = message.toLowerCase();

    // Extract from patterns
    for (const [entityType, patterns] of Object.entries(ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = message.match(pattern);
        if (matches) {
          entities.push({
            type: entityType as EntityType,
            value: matches[1] || matches[0],
            confidence: 80,
          });
        }
      }
    }

    // Match against known entities in context
    // Tasks
    for (const task of context.tasks) {
      if (normalizedMessage.includes(task.title.toLowerCase())) {
        entities.push({
          type: 'task',
          value: task.title,
          confidence: 95,
          id: task.id,
          normalized: task.title,
        });
      }
    }

    // Insights
    for (const insight of context.insights) {
      if (normalizedMessage.includes(insight.summary.toLowerCase().slice(0, 30))) {
        entities.push({
          type: 'insight',
          value: insight.summary,
          confidence: 90,
          id: insight.id,
        });
      }
    }

    // BRD Sections
    if (context.brd) {
      for (const section of context.brd.sections) {
        const sectionTitle = section.title.toLowerCase();
        if (normalizedMessage.includes(sectionTitle)) {
          entities.push({
            type: 'brd_section',
            value: section.title,
            confidence: 95,
            id: section.id,
          });
        }
      }
    }

    // Sources
    for (const source of context.sources) {
      if (normalizedMessage.includes(source.name.toLowerCase())) {
        entities.push({
          type: 'source',
          value: source.name,
          confidence: 90,
          id: source.id,
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return entities.filter(e => {
      const key = `${e.type}:${e.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ==========================================================================
  // ACTION DETERMINATION
  // ==========================================================================

  determineActions(
    intent: Intent,
    entities: Entity[],
    message: string,
    context: ProjectContext
  ): AIAction[] {
    const actions: AIAction[] = [];
    const normalizedMessage = message.toLowerCase();

    // Handle confirmation responses
    if (this.conversationState.awaitingConfirmation && this.conversationState.pendingAction) {
      if (/^(yes|yeah|yep|sure|ok|okay|confirm|proceed|go ahead|do it)$/i.test(normalizedMessage)) {
        actions.push(this.conversationState.pendingAction);
        this.conversationState.awaitingConfirmation = false;
        this.conversationState.pendingAction = undefined;
        return actions;
      }
      if (/^(no|nope|cancel|stop|nevermind|don't|dont)$/i.test(normalizedMessage)) {
        this.conversationState.awaitingConfirmation = false;
        this.conversationState.pendingAction = undefined;
        return [];
      }
    }

    // Action verb extraction
    const actionVerbs = entities.filter(e => e.type === 'action_verb');
    const verb = actionVerbs[0]?.value?.toLowerCase() || '';

    // Task actions
    if (intent.primary === 'request_action') {
      const taskEntities = entities.filter(e => e.type === 'task');
      const priorityEntity = entities.find(e => e.type === 'priority');
      const statusEntity = entities.find(e => e.type === 'status');

      // Add task
      if (['add', 'create', 'make'].includes(verb) || /add.*task|create.*task|new task/i.test(message)) {
        const titleMatch = message.match(/(?:task|called|named|titled)\s*["']?([^"'\n]+)["']?/i) ||
                          message.match(/["']([^"']+)["']/);
        const title = titleMatch?.[1] || this.extractTaskTitle(message);
        
        if (title && title.length > 2) {
          actions.push({
            type: 'add_task',
            data: {
              title,
              type: this.inferTaskType(message),
              urgency: priorityEntity?.value || 'medium',
            },
            description: `Add task: "${title}"`,
            confidence: 85,
            requiresConfirmation: false,
          });
        }
      }

      // Complete task
      if (['complete', 'finish', 'done', 'mark'].includes(verb) || /complete|finish|mark.*done|mark.*complete/i.test(message)) {
        const targetTask = taskEntities[0] || this.findBestMatchingTask(message, context.tasks);
        if (targetTask?.id) {
          actions.push({
            type: 'complete_task',
            data: { taskId: targetTask.id, title: targetTask.value },
            description: `Complete task: "${targetTask.value}"`,
            confidence: 90,
            requiresConfirmation: false,
            rollbackData: { taskId: targetTask.id, status: 'pending' },
          });
        }
      }

      // Delete task
      if (['delete', 'remove'].includes(verb)) {
        const targetTask = taskEntities[0] || this.findBestMatchingTask(message, context.tasks);
        if (targetTask?.id) {
          actions.push({
            type: 'delete_task',
            data: { taskId: targetTask.id, title: targetTask.value },
            description: `Delete task: "${targetTask.value}"`,
            confidence: 85,
            requiresConfirmation: true,
            rollbackData: { task: context.tasks.find(t => t.id === targetTask.id) },
          });
        }
      }

      // Approve insight(s)
      if (/approve/i.test(verb) || /approve.*insight/i.test(message)) {
        if (/all|every|pending/i.test(message)) {
          const pendingCount = context.insights.filter(i => i.status === 'pending').length;
          actions.push({
            type: 'approve_all_insights',
            data: { count: pendingCount },
            description: `Approve all ${pendingCount} pending insights`,
            confidence: 80,
            requiresConfirmation: pendingCount > 3,
          });
        } else {
          const targetInsight = entities.find(e => e.type === 'insight');
          if (targetInsight?.id) {
            actions.push({
              type: 'approve_insight',
              data: { insightId: targetInsight.id },
              description: `Approve insight: "${targetInsight.value?.slice(0, 50)}"`,
              confidence: 85,
              requiresConfirmation: false,
            });
          }
        }
      }

      // Update goals
      if (/goal|objective/i.test(message) && /add|update|change|include|modify/i.test(message)) {
        const goalContent = this.extractGoalContent(message, context.goals);
        if (goalContent) {
          actions.push({
            type: 'update_project_goals',
            data: { 
              goals: goalContent,
              append: true,
            },
            description: `Update project goals`,
            confidence: 80,
            requiresConfirmation: false,
            rollbackData: { goals: context.goals },
          });
        }
      }

      // Update BRD section
      const sectionEntity = entities.find(e => e.type === 'brd_section');
      if (sectionEntity && /update|edit|change|modify/i.test(message)) {
        actions.push({
          type: 'update_brd_section',
          data: { 
            sectionId: sectionEntity.id,
            sectionTitle: sectionEntity.value,
          },
          description: `Edit BRD section: "${sectionEntity.value}"`,
          confidence: 75,
          requiresConfirmation: true,
        });
      }
    }

    // Navigation actions
    if (intent.primary === 'request_navigation') {
      const navTarget = entities.find(e => e.type === 'navigation_target');
      const sectionEntity = entities.find(e => e.type === 'brd_section');
      
      if (navTarget || sectionEntity) {
        const destination = this.normalizeNavigationTarget(navTarget?.value || sectionEntity?.value || '');
        if (destination) {
          actions.push({
            type: 'navigate',
            data: { destination },
            description: `Navigate to ${destination}`,
            confidence: 90,
            requiresConfirmation: false,
          });
        }
      }
    }

    return actions;
  }

  // ==========================================================================
  // RESPONSE GENERATION
  // ==========================================================================

  async generateResponse(
    message: string,
    context: ProjectContext,
    history: ChatMessage[]
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      return {
        message: `I'm processing a lot of requests right now. Please try again in ${Math.ceil(waitTime / 1000)} seconds.`,
        actions: [],
        intent: { primary: 'unknown', confidence: 0 },
        entities: [],
        requiresConfirmation: false,
        confidence: 0,
        processingMetadata: {
          totalTime: Date.now() - startTime,
          intentClassificationTime: 0,
          responseGenerationTime: 0,
          cached: false,
        },
      };
    }

    // Update conversation state
    this.conversationState.turnCount++;

    // Classify intent
    const intentStart = Date.now();
    const intent = this.classifyIntent(message);
    const intentTime = Date.now() - intentStart;

    // Extract entities
    const entities = this.extractEntities(message, context);

    // Update context stack
    this.updateContextStack(intent, entities);

    // Determine actions locally first
    const localActions = this.determineActions(intent, entities, message, context);

    // Check cache for similar queries
    const cacheKey = this.cache.generateKey(
      message.toLowerCase().trim(),
      intent.primary,
      context.name,
      context.brd?.sections.length
    );
    const cachedResponse = this.cache.get<string>(cacheKey);

    let responseMessage: string;
    let aiActions = localActions;
    let confidence = intent.confidence;

    const responseStart = Date.now();
    
    // Pre-compute common data
    const normalizedMessage = message.toLowerCase();
    const highPriorityTasks = context.tasks.filter(t => t.urgency === 'high' && t.status !== 'completed');
    const pendingTasks = context.tasks.filter(t => t.status !== 'completed');
    const pendingInsights = context.insights.filter(i => i.status === 'pending');

    // Handle common queries locally for instant responses
    const localResponse = this.handleLocalQuery(normalizedMessage, context, highPriorityTasks, pendingTasks, pendingInsights);
    
    if (localResponse) {
      responseMessage = localResponse;
      confidence = 95;
    } else if (intent.primary === 'greeting') {
      responseMessage = this.getRandomTemplate('greeting');
    } else if (intent.primary === 'provide_feedback' && this.conversationState.pendingAction) {
      // Handle confirmation - already processed in determineActions
      if (localActions.length > 0) {
        responseMessage = `Got it! I'll ${localActions[0].description}.`;
      } else {
        responseMessage = "Okay, I've cancelled that action.";
      }
    } else if (cachedResponse && localActions.length === 0) {
      responseMessage = cachedResponse;
    } else {
      // Generate AI response for complex queries
      try {
        const aiResponse = await this.callAI(message, context, history, intent, entities, localActions);
        responseMessage = aiResponse.message;
        
        // Merge AI actions with local actions, preferring AI actions
        if (aiResponse.actions && aiResponse.actions.length > 0) {
          aiActions = this.mergeActions(localActions, aiResponse.actions);
        }
        
        confidence = aiResponse.confidence || intent.confidence;

        // Cache successful responses for queries
        if (intent.primary === 'query_information' && aiActions.length === 0) {
          this.cache.set(cacheKey, responseMessage, 300000);
        }
      } catch (error) {
        console.error('AI call failed:', error);
        responseMessage = this.generateFallbackResponse(intent, entities, context);
      }
    }

    const responseTime = Date.now() - responseStart;
    this.rateLimiter.recordRequest();

    // Check if confirmation is needed
    const requiresConfirmation = aiActions.some(a => a.requiresConfirmation);
    if (requiresConfirmation && aiActions.length > 0) {
      this.conversationState.awaitingConfirmation = true;
      this.conversationState.pendingAction = aiActions[0];
      aiActions = []; // Don't execute yet
      responseMessage = this.getRandomTemplate('confirmation_request')
        .replace('{action}', this.conversationState.pendingAction.description);
    }

    // Generate suggestions
    const suggestions = this.generateSuggestions(intent, context);

    return {
      message: responseMessage,
      actions: aiActions,
      intent,
      entities,
      suggestions,
      requiresConfirmation,
      confidence,
      processingMetadata: {
        totalTime: Date.now() - startTime,
        intentClassificationTime: intentTime,
        responseGenerationTime: responseTime,
        cached: !!cachedResponse,
      },
    };
  }

  // ==========================================================================
  // AI CALL
  // ==========================================================================

  private async callAI(
    message: string,
    context: ProjectContext,
    history: ChatMessage[],
    intent: Intent,
    entities: Entity[],
    localActions: AIAction[]
  ): Promise<{ message: string; actions?: AIAction[]; confidence?: number }> {
    const historyText = history.slice(-6).map(m =>
      `${m.role === 'user' ? 'User' : 'Clarity'}: ${m.content}`
    ).join('\n');

    const prompt = this.buildPrompt(message, context, historyText, intent, entities, localActions);

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: [
                      'none', 'add_task', 'complete_task', 'delete_task', 'update_task',
                      'add_insight', 'approve_insight', 'reject_insight', 'approve_all_insights',
                      'update_brd_section', 'add_brd_section', 'regenerate_brd_section',
                      'update_project_goals', 'navigate', 'search',
                    ],
                  },
                  data: { type: Type.OBJECT },
                  description: { type: Type.STRING },
                  confidence: { type: Type.INTEGER },
                  requiresConfirmation: { type: Type.BOOLEAN },
                },
                required: ['type', 'description'],
              },
            },
            confidence: { type: Type.INTEGER },
          },
          required: ['message'],
        },
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    const parsed = JSON.parse(text);
    
    // Post-process actions
    if (parsed.actions) {
      parsed.actions = parsed.actions
        .filter((a: AIAction) => a.type !== 'none')
        .map((a: AIAction) => ({
          ...a,
          confidence: a.confidence || 75,
          requiresConfirmation: a.requiresConfirmation || this.shouldRequireConfirmation(a.type),
          data: a.data || {},
        }));
    }

    return parsed;
  }

  private buildPrompt(
    message: string,
    context: ProjectContext,
    historyText: string,
    intent: Intent,
    entities: Entity[],
    localActions: AIAction[]
  ): string {
    // Pre-compute filtered data for specific queries
    const highPriorityTasks = context.tasks.filter(t => t.urgency === 'high' && t.status !== 'completed');
    const pendingTasks = context.tasks.filter(t => t.status !== 'completed');
    const completedTasks = context.tasks.filter(t => t.status === 'completed');
    const pendingInsights = context.insights.filter(i => i.status === 'pending');
    const approvedInsights = context.insights.filter(i => i.status === 'approved');

    return `You are Clarity, an AI assistant for BRD projects. You MUST answer questions DIRECTLY with specific data.

CRITICAL INSTRUCTION: DO NOT give vague responses like "I can help you find information" or "Could you provide more details". 
Instead, DIRECTLY answer with the actual data from the context below.

USER'S QUESTION: "${message}"
DETECTED INTENT: ${intent.primary}

===== ACTUAL PROJECT DATA (USE THIS TO ANSWER) =====

PROJECT: ${context.name}
GOALS: ${context.goals || 'No goals defined yet'}

HIGH PRIORITY TASKS (${highPriorityTasks.length}):
${highPriorityTasks.length > 0 
  ? highPriorityTasks.map(t => `• "${t.title}" - ${t.status || 'pending'}`).join('\n')
  : '• No high priority tasks'}

ALL PENDING TASKS (${pendingTasks.length}):
${pendingTasks.slice(0, 15).map(t => `• "${t.title}" (${t.urgency} priority) - ${t.type}`).join('\n') || '• No pending tasks'}

COMPLETED TASKS (${completedTasks.length}):
${completedTasks.slice(0, 5).map(t => `• "${t.title}"`).join('\n') || '• No completed tasks'}

INSIGHTS - PENDING REVIEW (${pendingInsights.length}):
${pendingInsights.slice(0, 10).map(i => `• [${i.category}] ${i.summary}`).join('\n') || '• No pending insights'}

INSIGHTS - APPROVED (${approvedInsights.length}):
${approvedInsights.slice(0, 10).map(i => `• [${i.category}] ${i.summary}`).join('\n') || '• No approved insights'}

DATA SOURCES (${context.sources.length}):
${context.sources.map(s => `• ${s.name} (${s.type})`).join('\n') || '• No sources added'}

${context.brd ? `BRD DOCUMENT SECTIONS:
${context.brd.sections.map(s => `
### ${s.title}
${s.content}
`).join('\n')}` : 'BRD: Not generated yet'}

===== RESPONSE RULES =====

1. QUERY RESPONSES - When user asks about tasks, insights, BRD sections:
   - List the ACTUAL items from the data above
   - Use bullet points for lists
   - Include counts and specifics
   
   Example for "show high priority tasks":
   BAD: "I can help you find information about your project"
   GOOD: "You have ${highPriorityTasks.length} high priority tasks:\n• Task 1 name\n• Task 2 name"

2. ACTION RESPONSES - When user wants to update/add/change something:
   - Confirm what you will do
   - Include the action in the actions array
   - For goal updates: Extract goal text and create update_project_goals action

3. BRD SECTION QUERIES - When user asks about Executive Summary, Scope, etc:
   - Copy the ACTUAL content from the BRD sections above
   - Don't say "I'll navigate you" - just show the content

===== ID REFERENCE (for action data only) =====
Tasks: ${context.tasks.slice(0, 15).map(t => `"${t.title}"=${t.id}`).join(', ')}
Insights: ${context.insights.slice(0, 10).map(i => `"${i.summary.slice(0, 20)}"=${i.id}`).join(', ')}

===== CONVERSATION HISTORY =====
${historyText || 'First message'}

===== ACTION FORMATS =====
- update_project_goals: { "goals": "COMPLETE goals text (existing + new addition)" }
  Current goals: "${context.goals || ''}"
  If user says "update goal to include X", the goals field should be: "${context.goals || ''} Additionally: X"
  
- add_task: { "title": "task name", "type": "action|clarification|missing|conflict", "urgency": "high|medium|low" }
- complete_task: { "taskId": "id_here", "title": "task name" }
- navigate: { "destination": "sources|insights|generate|graph" }

NOW RESPOND TO: "${message}"

Return JSON: { "message": "your direct answer here", "actions": [], "confidence": 85 }`;
  }

  // ==========================================================================
  // LOCAL QUERY HANDLER - Fast responses without AI call
  // ==========================================================================

  private handleLocalQuery(
    message: string,
    context: ProjectContext,
    highPriorityTasks: ProjectContext['tasks'],
    pendingTasks: ProjectContext['tasks'],
    pendingInsights: ProjectContext['insights']
  ): string | null {
    // High priority tasks query
    if (/high\s*priority\s*(tasks?|items?)?|urgent\s*(tasks?|items?)?/i.test(message) || 
        (message.includes('high') && message.includes('task'))) {
      if (highPriorityTasks.length === 0) {
        return "✅ No high priority tasks at the moment. You're all caught up!";
      }
      return `**High Priority Tasks (${highPriorityTasks.length}):**\n\n${highPriorityTasks.map(t => 
        `• **${t.title}**\n  Type: ${t.type} | Status: ${t.status || 'pending'}`
      ).join('\n\n')}`;
    }

    // Pending tasks query
    if (/pending\s*(tasks?)?|open\s*(tasks?)?|tasks?\s*(to do|todo|remaining)/i.test(message) ||
        (message.includes('pending') && message.includes('task'))) {
      if (pendingTasks.length === 0) {
        return "✅ No pending tasks! Everything is complete.";
      }
      const grouped = {
        high: pendingTasks.filter(t => t.urgency === 'high'),
        medium: pendingTasks.filter(t => t.urgency === 'medium'),
        low: pendingTasks.filter(t => t.urgency === 'low'),
      };
      return `**Pending Tasks (${pendingTasks.length}):**\n\n` +
        (grouped.high.length > 0 ? `🔴 **High Priority:**\n${grouped.high.map(t => `• ${t.title}`).join('\n')}\n\n` : '') +
        (grouped.medium.length > 0 ? `🟡 **Medium Priority:**\n${grouped.medium.map(t => `• ${t.title}`).join('\n')}\n\n` : '') +
        (grouped.low.length > 0 ? `🟢 **Low Priority:**\n${grouped.low.map(t => `• ${t.title}`).join('\n')}` : '');
    }

    // All tasks query
    if (/^(show|list|what are|get)\s*(me\s*)?(all\s*)?(the\s*)?tasks?$/i.test(message) ||
        message === 'tasks') {
      if (context.tasks.length === 0) {
        return "No tasks created yet. Would you like me to add one?";
      }
      const completed = context.tasks.filter(t => t.status === 'completed');
      const pending = context.tasks.filter(t => t.status !== 'completed');
      return `**All Tasks (${context.tasks.length}):**\n\n` +
        `📋 **Pending (${pending.length}):**\n${pending.map(t => `• ${t.title} (${t.urgency})`).join('\n') || 'None'}\n\n` +
        `✅ **Completed (${completed.length}):**\n${completed.slice(0, 5).map(t => `• ${t.title}`).join('\n') || 'None'}`;
    }

    // Insights needing approval
    if (/insights?\s*(need|pending|awaiting|for)\s*(approval|review)?|approve.*insights?|pending\s*insights?/i.test(message)) {
      if (pendingInsights.length === 0) {
        return "✅ All insights have been reviewed!";
      }
      return `**Insights Pending Review (${pendingInsights.length}):**\n\n${pendingInsights.slice(0, 10).map(i => 
        `• **[${i.category}]** ${i.summary}`
      ).join('\n')}\n\n💡 Say "approve all insights" to approve them all at once.`;
    }

    // Project status/summary
    if (/project\s*(status|summary|overview)|status\s*(of\s*)?(the\s*)?project|how('s| is)\s*(the\s*)?project/i.test(message)) {
      const completedTasks = context.tasks.filter(t => t.status === 'completed');
      const approvedInsights = context.insights.filter(i => i.status === 'approved');
      return `**Project "${context.name}" Status:**\n\n` +
        `📊 **Progress:**\n` +
        `• Tasks: ${completedTasks.length}/${context.tasks.length} completed\n` +
        `• Insights: ${approvedInsights.length}/${context.insights.length} approved\n` +
        `• Sources: ${context.sources.length} added\n` +
        `${context.brd ? `• BRD: ${context.brd.sections.length} sections generated` : '• BRD: Not generated yet'}\n\n` +
        `📝 **Goals:**\n${context.goals || 'No goals defined yet'}\n\n` +
        (highPriorityTasks.length > 0 ? `⚠️ **${highPriorityTasks.length} high priority task(s) need attention**` : '✅ No urgent items');
    }

    // BRD section queries
    if (context.brd) {
      // Executive summary
      if (/executive\s*summary/i.test(message)) {
        const section = context.brd.sections.find(s => s.title.toLowerCase().includes('executive'));
        if (section) {
          return `**${section.title}**\n\n${section.content}`;
        }
      }
      
      // Scope
      if (/\bscope\b/i.test(message) && !/microscope|telescope/i.test(message)) {
        const section = context.brd.sections.find(s => s.title.toLowerCase().includes('scope'));
        if (section) {
          return `**${section.title}**\n\n${section.content}`;
        }
      }
      
      // Requirements
      if (/requirements?/i.test(message)) {
        const section = context.brd.sections.find(s => 
          s.title.toLowerCase().includes('requirement') || s.title.toLowerCase().includes('functional')
        );
        if (section) {
          return `**${section.title}**\n\n${section.content}`;
        }
      }
      
      // Stakeholders
      if (/stakeholders?/i.test(message)) {
        const section = context.brd.sections.find(s => s.title.toLowerCase().includes('stakeholder'));
        if (section) {
          return `**${section.title}**\n\n${section.content}`;
        }
      }
    }

    // Goals query
    if (/^(what are|show me|get)\s*(the\s*)?(project\s*)?goals?$/i.test(message) || message === 'goals') {
      return `**Project Goals:**\n\n${context.goals || 'No goals defined yet. Would you like to set some?'}`;
    }

    // Sources query
    if (/^(what|show|list)\s*(are\s*)?(the\s*)?(data\s*)?sources?$/i.test(message) || message === 'sources') {
      if (context.sources.length === 0) {
        return "No data sources added yet. Go to the Sources page to add some!";
      }
      return `**Data Sources (${context.sources.length}):**\n\n${context.sources.map(s => 
        `• **${s.name}** (${s.type})`
      ).join('\n')}`;
    }

    return null; // No local handler matched, proceed to AI
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private extractTaskTitle(message: string): string {
    // Remove common phrases
    const cleaned = message
      .replace(/^(please\s+)?(can you\s+)?(add|create|make)\s+(a\s+)?(new\s+)?task\s*(called|named|titled|for|to|:)?\s*/i, '')
      .replace(/\s+to\s+the\s+(list|project|tasks?)$/i, '')
      .trim();
    
    // Extract quoted content
    const quoted = cleaned.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1];
    
    // Take first meaningful phrase
    const words = cleaned.split(/\s+/).slice(0, 8);
    return words.join(' ').replace(/['"]/g, '');
  }

  private inferTaskType(message: string): string {
    if (/clarif|question|ask|unclear/i.test(message)) return 'clarification';
    if (/missing|need|require|add/i.test(message)) return 'missing';
    if (/conflict|issue|problem|disagree/i.test(message)) return 'conflict';
    return 'action';
  }

  private findBestMatchingTask(
    message: string,
    tasks: ProjectContext['tasks']
  ): Entity | undefined {
    const normalizedMessage = message.toLowerCase();
    
    for (const task of tasks) {
      const titleWords = task.title.toLowerCase().split(/\s+/);
      const matchCount = titleWords.filter(w => normalizedMessage.includes(w)).length;
      if (matchCount >= Math.min(2, titleWords.length * 0.5)) {
        return { type: 'task', value: task.title, id: task.id, confidence: 80 };
      }
    }
    return undefined;
  }

  private extractGoalContent(message: string, existingGoals?: string): string | null {
    const patterns = [
      /(?:add|include|update.*with|set.*to)\s+["']?(.+?)["']?\s*(?:to|in|as)?\s*(?:the\s+)?(?:project\s+)?goals?/i,
      /goals?\s+(?:should\s+)?(?:include|have|be)\s+["']?(.+?)["']?$/i,
      /(?:project\s+)?goals?:\s*["']?(.+?)["']?$/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match?.[1] && match[1].length > 3) {
        const newGoal = match[1].trim();
        if (existingGoals) {
          return `${existingGoals.trim()}\n\nAdditionally: ${newGoal}`;
        }
        return newGoal;
      }
    }

    // Fallback: try to extract any meaningful content after action words
    const fallbackMatch = message.match(/(?:add|include|update)\s+["']?(.{10,})["']?/i);
    if (fallbackMatch?.[1]) {
      const newGoal = fallbackMatch[1].trim();
      if (existingGoals) {
        return `${existingGoals.trim()}\n\nAdditionally: ${newGoal}`;
      }
      return newGoal;
    }

    return null;
  }

  private normalizeNavigationTarget(target: string): string | null {
    const normalized = target.toLowerCase().trim();
    
    const mappings: Record<string, string> = {
      'source': 'sources',
      'sources': 'sources',
      'data': 'sources',
      'data sources': 'sources',
      'insight': 'insights',
      'insights': 'insights',
      'review': 'insights',
      'brd': 'generate',
      'generate': 'generate',
      'document': 'generate',
      'graph': 'graph',
      'knowledge graph': 'graph',
      'visualization': 'graph',
      'dashboard': 'home',
      'home': 'home',
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (normalized.includes(key)) return value;
    }

    return null;
  }

  private shouldRequireConfirmation(actionType: AIActionType): boolean {
    const dangerousActions: AIActionType[] = [
      'delete_task',
      'reject_insight',
      'bulk_operation',
      'update_brd_section',
      'regenerate_brd_section',
    ];
    return dangerousActions.includes(actionType);
  }

  private mergeActions(local: AIAction[], ai: AIAction[]): AIAction[] {
    const merged = new Map<string, AIAction>();
    
    // Add local actions first
    for (const action of local) {
      merged.set(`${action.type}:${JSON.stringify(action.data)}`, action);
    }
    
    // AI actions override local if same type+data
    for (const action of ai) {
      const key = `${action.type}:${JSON.stringify(action.data)}`;
      merged.set(key, { ...merged.get(key), ...action });
    }
    
    return Array.from(merged.values());
  }

  private updateContextStack(intent: Intent, entities: Entity[]): void {
    const topic = entities[0]?.value || intent.primary;
    this.conversationState.contextStack.push({
      topic,
      timestamp: new Date().toISOString(),
    });
    
    // Keep only last 5 context items
    if (this.conversationState.contextStack.length > 5) {
      this.conversationState.contextStack.shift();
    }
  }

  private generateSuggestions(intent: Intent, context: ProjectContext): string[] {
    const suggestions: string[] = [];

    switch (intent.primary) {
      case 'query_information':
        if (context.tasks.length > 0) {
          suggestions.push('Show me high priority tasks');
        }
        if (context.insights.filter(i => i.status === 'pending').length > 0) {
          suggestions.push('What insights need approval?');
        }
        break;
      case 'request_action':
        suggestions.push('What else can I help you with?');
        break;
      case 'greeting':
        suggestions.push("What's the project status?");
        suggestions.push('Show me pending tasks');
        break;
      default:
        if (context.brd) {
          suggestions.push('Show me the Executive Summary');
        }
        suggestions.push('What tasks need attention?');
    }

    return suggestions.slice(0, 3);
  }

  private generateFallbackResponse(
    intent: Intent,
    entities: Entity[],
    context: ProjectContext
  ): string {
    const highPriorityTasks = context.tasks.filter(t => t.urgency === 'high' && t.status !== 'completed');
    const pendingTasks = context.tasks.filter(t => t.status !== 'completed');
    const pendingInsights = context.insights.filter(i => i.status === 'pending');
    
    switch (intent.primary) {
      case 'query_information': {
        // Check for BRD section queries
        if (entities.find(e => e.type === 'brd_section')) {
          const section = entities.find(e => e.type === 'brd_section');
          const found = context.brd?.sections.find(
            s => s.title.toLowerCase().includes(section?.value?.toLowerCase() || '')
          );
          if (found) {
            return `**${found.title}**\n\n${found.content}`;
          }
        }
        
        // Check for task-related queries
        if (entities.find(e => e.type === 'priority' && e.value?.toLowerCase() === 'high')) {
          if (highPriorityTasks.length > 0) {
            return `**High Priority Tasks (${highPriorityTasks.length}):**\n${highPriorityTasks.map(t => `• ${t.title}`).join('\n')}`;
          }
          return "You don't have any high priority tasks at the moment. Great job! 🎉";
        }
        
        // Default: show project summary
        return `**Project "${context.name}" Summary:**
• ${pendingTasks.length} pending tasks (${highPriorityTasks.length} high priority)
• ${pendingInsights.length} insights awaiting review
• ${context.sources.length} data sources
${context.brd ? `• BRD has ${context.brd.sections.length} sections` : '• BRD not generated yet'}

What would you like to know more about?`;
      }
      
      case 'request_action': {
        // Try to infer the action from entities
        const goalEntity = entities.find(e => e.type === 'goal');
        if (goalEntity) {
          return `I'll update the project goals. Current goals: "${context.goals || 'Not set'}"`;
        }
        
        // Show what actions are available
        return `I can help you with:
• Adding/completing/deleting tasks
• Approving insights
• Updating project goals
• Editing BRD sections

What would you like to do?`;
      }
      
      case 'request_navigation':
        return "I can take you to:\n• **Sources** - Your data sources\n• **Insights** - Review extracted insights\n• **BRD** - Generate/edit your document\n• **Graph** - Visual knowledge graph\n\nWhere would you like to go?";
      
      case 'request_summary': {
        if (context.brd) {
          const execSummary = context.brd.sections.find(s => 
            s.title.toLowerCase().includes('executive') || s.title.toLowerCase().includes('summary')
          );
          if (execSummary) {
            return `**${execSummary.title}**\n\n${execSummary.content}`;
          }
        }
        return `**Project Summary:**\n\n${context.goals || 'No goals defined yet.'}\n\nThe project has ${context.sources.length} sources, ${context.insights.length} insights, and ${context.tasks.length} tasks.`;
      }
      
      default:
        return `**${context.name} Quick Status:**
• ${highPriorityTasks.length} high priority tasks need attention
• ${pendingInsights.length} insights pending review
${context.brd ? `• BRD is ${context.brd.status || 'in progress'}` : '• BRD not started'}

How can I help?`;
    }
  }

  private getRandomTemplate(category: keyof typeof RESPONSE_TEMPLATES): string {
    const templates = RESPONSE_TEMPLATES[category];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ==========================================================================
  // PUBLIC UTILITIES
  // ==========================================================================

  resetConversation(): void {
    this.conversationState = this.initConversationState();
    this.cache.clear();
  }

  getSessionInfo(): { sessionId: string; turnCount: number } {
    return {
      sessionId: this.conversationState.sessionId,
      turnCount: this.conversationState.turnCount,
    };
  }

  setUserPreferences(prefs: Partial<ConversationState['userPreferences']>): void {
    this.conversationState.userPreferences = {
      ...this.conversationState.userPreferences,
      ...prefs,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const clarityChatService = new ClarityChatService();

// ============================================================================
// LEGACY COMPATIBILITY WRAPPER
// ============================================================================

export const chatWithClarityEnterprise = async (
  userMessage: string,
  projectContext: ProjectContext,
  chatHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
  return clarityChatService.generateResponse(userMessage, projectContext, chatHistory);
};
