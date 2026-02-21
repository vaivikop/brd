/**
 * AgentMemory - Persistent Context & Learning System
 * 
 * Provides:
 * - Short-term working memory for current session
 * - Long-term persistent memory across sessions
 * - Semantic similarity search for relevant context
 * - Learning from user feedback and corrections
 * - Pattern recognition for improved suggestions
 */

import { ProjectState, Insight, Source, Task } from '../../utils/db';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];  // For semantic search
  metadata: MemoryMetadata;
  importance: number;    // 0-1, affects retention
  accessCount: number;
  lastAccessed: string;
  createdAt: string;
  expiresAt?: string;
}

export type MemoryType = 
  | 'fact'           // Verified information
  | 'decision'       // User decisions
  | 'preference'     // User preferences
  | 'correction'     // Corrections to agent behavior
  | 'context'        // Contextual information
  | 'pattern'        // Detected patterns
  | 'outcome'        // Action outcomes
  | 'feedback';      // User feedback

export interface MemoryMetadata {
  projectId?: string;
  sourceId?: string;
  insightId?: string;
  taskId?: string;
  tags: string[];
  confidence: number;
  validatedBy?: string;
}

export interface WorkingMemory {
  sessionId: string;
  startedAt: string;
  currentGoal?: string;
  recentActions: string[];
  recentDecisions: string[];
  contextStack: ContextFrame[];
  scratchpad: Record<string, unknown>;
}

export interface ContextFrame {
  id: string;
  topic: string;
  relevantEntities: string[];
  timestamp: string;
  depth: number;
}

export interface LearningFeedback {
  id: string;
  actionId: string;
  feedbackType: 'positive' | 'negative' | 'correction';
  originalAction: string;
  userFeedback: string;
  correction?: string;
  timestamp: string;
  applied: boolean;
}

export interface PatternMatch {
  patternId: string;
  confidence: number;
  description: string;
  suggestedAction: string;
  evidence: string[];
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevanceScore: number;
  matchType: 'exact' | 'semantic' | 'tag' | 'temporal';
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  LONG_TERM_MEMORY: 'clarity_agent_ltm',
  LEARNING_DATA: 'clarity_agent_learning',
  PATTERNS: 'clarity_agent_patterns',
  USER_PREFERENCES: 'clarity_agent_preferences',
};

// ============================================================================
// AGENT MEMORY CLASS
// ============================================================================

export class AgentMemory {
  private workingMemory: WorkingMemory | null = null;
  private longTermMemory: Map<string, MemoryEntry> = new Map();
  private learningData: LearningFeedback[] = [];
  private patterns: PatternMatch[] = [];
  private initialized: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private loadFromStorage(): void {
    try {
      // Load long-term memory
      const ltmData = localStorage.getItem(STORAGE_KEYS.LONG_TERM_MEMORY);
      if (ltmData) {
        const entries: MemoryEntry[] = JSON.parse(ltmData);
        entries.forEach(entry => {
          // Check if not expired
          if (!entry.expiresAt || new Date(entry.expiresAt) > new Date()) {
            this.longTermMemory.set(entry.id, entry);
          }
        });
      }

      // Load learning data
      const learningData = localStorage.getItem(STORAGE_KEYS.LEARNING_DATA);
      if (learningData) {
        this.learningData = JSON.parse(learningData);
      }

      // Load patterns
      const patternsData = localStorage.getItem(STORAGE_KEYS.PATTERNS);
      if (patternsData) {
        this.patterns = JSON.parse(patternsData);
      }

      this.initialized = true;
      console.log('[AgentMemory] Loaded from storage:', {
        memories: this.longTermMemory.size,
        learnings: this.learningData.length,
        patterns: this.patterns.length,
      });
    } catch (error) {
      console.error('[AgentMemory] Failed to load from storage:', error);
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    try {
      // Save long-term memory
      const ltmArray = Array.from(this.longTermMemory.values());
      localStorage.setItem(STORAGE_KEYS.LONG_TERM_MEMORY, JSON.stringify(ltmArray));

      // Save learning data (limit to recent 500)
      const recentLearning = this.learningData.slice(-500);
      localStorage.setItem(STORAGE_KEYS.LEARNING_DATA, JSON.stringify(recentLearning));

      // Save patterns
      localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(this.patterns));
    } catch (error) {
      console.error('[AgentMemory] Failed to save to storage:', error);
    }
  }

  // ============================================================================
  // WORKING MEMORY
  // ============================================================================

  startSession(sessionId: string): WorkingMemory {
    this.workingMemory = {
      sessionId,
      startedAt: new Date().toISOString(),
      recentActions: [],
      recentDecisions: [],
      contextStack: [],
      scratchpad: {},
    };
    return this.workingMemory;
  }

  getWorkingMemory(): WorkingMemory | null {
    return this.workingMemory;
  }

  setCurrentGoal(goal: string): void {
    if (this.workingMemory) {
      this.workingMemory.currentGoal = goal;
    }
  }

  recordAction(action: string): void {
    if (this.workingMemory) {
      this.workingMemory.recentActions.push(action);
      // Keep only last 50 actions
      if (this.workingMemory.recentActions.length > 50) {
        this.workingMemory.recentActions.shift();
      }
    }
  }

  recordDecision(decision: string): void {
    if (this.workingMemory) {
      this.workingMemory.recentDecisions.push(decision);
      // Keep only last 20 decisions
      if (this.workingMemory.recentDecisions.length > 20) {
        this.workingMemory.recentDecisions.shift();
      }
    }
  }

  pushContext(topic: string, relevantEntities: string[] = []): void {
    if (this.workingMemory) {
      const frame: ContextFrame = {
        id: `ctx_${Date.now()}`,
        topic,
        relevantEntities,
        timestamp: new Date().toISOString(),
        depth: this.workingMemory.contextStack.length,
      };
      this.workingMemory.contextStack.push(frame);

      // Max depth of 10
      if (this.workingMemory.contextStack.length > 10) {
        this.workingMemory.contextStack.shift();
      }
    }
  }

  popContext(): ContextFrame | undefined {
    return this.workingMemory?.contextStack.pop();
  }

  getCurrentContext(): ContextFrame | undefined {
    if (!this.workingMemory) return undefined;
    return this.workingMemory.contextStack[this.workingMemory.contextStack.length - 1];
  }

  setScratchpad(key: string, value: unknown): void {
    if (this.workingMemory) {
      this.workingMemory.scratchpad[key] = value;
    }
  }

  getScratchpad<T>(key: string): T | undefined {
    return this.workingMemory?.scratchpad[key] as T | undefined;
  }

  endSession(): void {
    // Consolidate important working memory to long-term
    if (this.workingMemory) {
      // Store significant decisions as long-term memories
      this.workingMemory.recentDecisions.forEach(decision => {
        this.remember({
          type: 'decision',
          content: decision,
          metadata: {
            tags: ['session-decision'],
            confidence: 80,
          },
          importance: 0.6,
        });
      });
    }

    this.workingMemory = null;
    this.saveToStorage();
  }

  // ============================================================================
  // LONG-TERM MEMORY
  // ============================================================================

  remember(params: {
    type: MemoryType;
    content: string;
    metadata?: Partial<MemoryMetadata>;
    importance?: number;
    ttlHours?: number;
  }): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: params.type,
      content: params.content,
      metadata: {
        tags: [],
        confidence: 70,
        ...params.metadata,
      },
      importance: params.importance ?? 0.5,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: params.ttlHours 
        ? new Date(Date.now() + params.ttlHours * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    this.longTermMemory.set(entry.id, entry);
    
    // Prune if over limit
    this.pruneMemory();
    this.saveToStorage();

    return entry;
  }

  recall(id: string): MemoryEntry | undefined {
    const entry = this.longTermMemory.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = new Date().toISOString();
      // Boost importance based on access
      entry.importance = Math.min(1, entry.importance + 0.01);
    }
    return entry;
  }

  forget(id: string): boolean {
    return this.longTermMemory.delete(id);
  }

  search(query: string, options: {
    types?: MemoryType[];
    tags?: string[];
    projectId?: string;
    limit?: number;
    minImportance?: number;
  } = {}): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 10;

    for (const entry of this.longTermMemory.values()) {
      // Filter by type
      if (options.types && !options.types.includes(entry.type)) continue;

      // Filter by importance
      if (options.minImportance && entry.importance < options.minImportance) continue;

      // Filter by project
      if (options.projectId && entry.metadata.projectId !== options.projectId) continue;

      // Filter by tags
      if (options.tags && !options.tags.some(t => entry.metadata.tags.includes(t))) continue;

      // Check expiration
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) continue;

      // Calculate relevance
      let relevance = 0;
      let matchType: MemorySearchResult['matchType'] = 'semantic';

      // Exact content match
      if (entry.content.toLowerCase().includes(queryLower)) {
        relevance += 0.8;
        matchType = 'exact';
      }

      // Tag match
      if (entry.metadata.tags.some(t => t.toLowerCase().includes(queryLower))) {
        relevance += 0.5;
        matchType = matchType === 'exact' ? 'exact' : 'tag';
      }

      // Boost by importance
      relevance *= entry.importance;

      // Boost by recency
      const ageHours = (Date.now() - new Date(entry.lastAccessed).getTime()) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 1 - ageHours / (24 * 7)); // Decay over a week
      relevance *= (1 + recencyBoost * 0.3);

      if (relevance > 0.1) {
        results.push({ entry, relevanceScore: relevance, matchType });
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  getByType(type: MemoryType, limit?: number): MemoryEntry[] {
    const entries = Array.from(this.longTermMemory.values())
      .filter(e => e.type === type)
      .sort((a, b) => b.importance - a.importance);

    return limit ? entries.slice(0, limit) : entries;
  }

  getRecent(count: number = 10): MemoryEntry[] {
    return Array.from(this.longTermMemory.values())
      .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
      .slice(0, count);
  }

  private pruneMemory(): void {
    const MAX_ENTRIES = 1000;
    
    if (this.longTermMemory.size <= MAX_ENTRIES) return;

    // Score entries for pruning
    const scored: { id: string; score: number }[] = [];
    const now = Date.now();

    for (const [id, entry] of this.longTermMemory) {
      // Don't prune high-importance items
      if (entry.importance > 0.9) continue;

      // Calculate retention score
      const ageMs = now - new Date(entry.createdAt).getTime();
      const accessRecency = now - new Date(entry.lastAccessed).getTime();
      
      const score = 
        entry.importance * 0.4 +
        (entry.accessCount / 100) * 0.3 +
        (1 - ageMs / (30 * 24 * 60 * 60 * 1000)) * 0.2 +  // 30 day decay
        (1 - accessRecency / (7 * 24 * 60 * 60 * 1000)) * 0.1;  // 7 day access decay

      scored.push({ id, score });
    }

    // Sort by score (ascending) and remove lowest
    scored.sort((a, b) => a.score - b.score);
    const toRemove = scored.slice(0, this.longTermMemory.size - MAX_ENTRIES);
    
    toRemove.forEach(({ id }) => this.longTermMemory.delete(id));
    
    console.log(`[AgentMemory] Pruned ${toRemove.length} entries`);
  }

  // ============================================================================
  // LEARNING SYSTEM
  // ============================================================================

  recordFeedback(params: {
    actionId: string;
    feedbackType: 'positive' | 'negative' | 'correction';
    originalAction: string;
    userFeedback: string;
    correction?: string;
  }): LearningFeedback {
    const feedback: LearningFeedback = {
      id: `feedback_${Date.now()}`,
      ...params,
      timestamp: new Date().toISOString(),
      applied: false,
    };

    this.learningData.push(feedback);

    // If it's a correction, store it as a memory
    if (params.feedbackType === 'correction' && params.correction) {
      this.remember({
        type: 'correction',
        content: `When user says "${params.originalAction}", they actually mean: ${params.correction}`,
        metadata: {
          tags: ['learning', 'correction'],
          confidence: 95,
        },
        importance: 0.9,
      });
    }

    // If positive feedback, boost related memories
    if (params.feedbackType === 'positive') {
      this.remember({
        type: 'feedback',
        content: `Action "${params.originalAction}" received positive feedback: ${params.userFeedback}`,
        metadata: {
          tags: ['learning', 'positive'],
          confidence: 90,
        },
        importance: 0.7,
      });
    }

    this.saveToStorage();
    return feedback;
  }

  getCorrections(query: string): LearningFeedback[] {
    return this.learningData.filter(f => 
      f.feedbackType === 'correction' &&
      f.originalAction.toLowerCase().includes(query.toLowerCase())
    );
  }

  getPositiveFeedback(limit: number = 10): LearningFeedback[] {
    return this.learningData
      .filter(f => f.feedbackType === 'positive')
      .slice(-limit);
  }

  // ============================================================================
  // PATTERN RECOGNITION
  // ============================================================================

  recordPattern(params: {
    description: string;
    suggestedAction: string;
    evidence: string[];
    confidence: number;
  }): PatternMatch {
    const pattern: PatternMatch = {
      patternId: `pattern_${Date.now()}`,
      ...params,
    };

    // Check if similar pattern exists
    const existing = this.patterns.find(p => 
      p.description.toLowerCase() === params.description.toLowerCase()
    );

    if (existing) {
      // Strengthen existing pattern
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.evidence = [...new Set([...existing.evidence, ...params.evidence])].slice(-10);
    } else {
      this.patterns.push(pattern);
    }

    // Prune weak patterns
    this.patterns = this.patterns.filter(p => p.confidence > 0.3);

    this.saveToStorage();
    return pattern;
  }

  matchPatterns(context: string): PatternMatch[] {
    const contextLower = context.toLowerCase();
    
    return this.patterns
      .filter(p => {
        const descLower = p.description.toLowerCase();
        return contextLower.includes(descLower) || descLower.includes(contextLower);
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ============================================================================
  // PROJECT-SPECIFIC MEMORY
  // ============================================================================

  rememberProjectFact(projectId: string, fact: string, tags: string[] = []): MemoryEntry {
    return this.remember({
      type: 'fact',
      content: fact,
      metadata: {
        projectId,
        tags: ['project-fact', ...tags],
        confidence: 85,
      },
      importance: 0.7,
    });
  }

  rememberUserPreference(preference: string, value: string): MemoryEntry {
    return this.remember({
      type: 'preference',
      content: `User preference: ${preference} = ${value}`,
      metadata: {
        tags: ['user-preference'],
        confidence: 95,
      },
      importance: 0.8,
    });
  }

  getProjectMemories(projectId: string, limit: number = 20): MemoryEntry[] {
    return Array.from(this.longTermMemory.values())
      .filter(e => e.metadata.projectId === projectId)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  // ============================================================================
  // CONTEXT BUILDING FOR AI
  // ============================================================================

  buildContextPrompt(options: {
    query?: string;
    projectId?: string;
    includePreferences?: boolean;
    includeCorrections?: boolean;
    includePatterns?: boolean;
    maxLength?: number;
  } = {}): string {
    const parts: string[] = [];
    const maxLength = options.maxLength ?? 2000;

    // Include working memory context
    if (this.workingMemory) {
      parts.push('CURRENT SESSION:');
      if (this.workingMemory.currentGoal) {
        parts.push(`- Goal: ${this.workingMemory.currentGoal}`);
      }
      parts.push(`- Recent actions: ${this.workingMemory.recentActions.slice(-5).join(', ')}`);
      parts.push(`- Recent decisions: ${this.workingMemory.recentDecisions.slice(-3).join(', ')}`);
      parts.push('');
    }

    // Include relevant memories
    if (options.query) {
      const relevant = this.search(options.query, {
        projectId: options.projectId,
        limit: 5,
        minImportance: 0.4,
      });

      if (relevant.length > 0) {
        parts.push('RELEVANT MEMORIES:');
        relevant.forEach(r => {
          parts.push(`- [${r.entry.type}] ${r.entry.content}`);
        });
        parts.push('');
      }
    }

    // Include corrections
    if (options.includeCorrections) {
      const corrections = this.getByType('correction', 3);
      if (corrections.length > 0) {
        parts.push('LEARNED CORRECTIONS:');
        corrections.forEach(c => {
          parts.push(`- ${c.content}`);
        });
        parts.push('');
      }
    }

    // Include user preferences
    if (options.includePreferences) {
      const prefs = this.getByType('preference', 5);
      if (prefs.length > 0) {
        parts.push('USER PREFERENCES:');
        prefs.forEach(p => {
          parts.push(`- ${p.content}`);
        });
        parts.push('');
      }
    }

    // Include matched patterns
    if (options.includePatterns && options.query) {
      const patterns = this.matchPatterns(options.query);
      if (patterns.length > 0) {
        parts.push('RECOGNIZED PATTERNS:');
        patterns.slice(0, 3).forEach(p => {
          parts.push(`- ${p.description} → Suggested: ${p.suggestedAction}`);
        });
        parts.push('');
      }
    }

    // Truncate if too long
    let result = parts.join('\n');
    if (result.length > maxLength) {
      result = result.slice(0, maxLength - 3) + '...';
    }

    return result;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  getStats(): {
    totalMemories: number;
    byType: Record<MemoryType, number>;
    totalLearnings: number;
    totalPatterns: number;
    averageImportance: number;
  } {
    const byType: Record<MemoryType, number> = {
      fact: 0,
      decision: 0,
      preference: 0,
      correction: 0,
      context: 0,
      pattern: 0,
      outcome: 0,
      feedback: 0,
    };

    let totalImportance = 0;

    for (const entry of this.longTermMemory.values()) {
      byType[entry.type]++;
      totalImportance += entry.importance;
    }

    return {
      totalMemories: this.longTermMemory.size,
      byType,
      totalLearnings: this.learningData.length,
      totalPatterns: this.patterns.length,
      averageImportance: this.longTermMemory.size > 0 
        ? totalImportance / this.longTermMemory.size 
        : 0,
    };
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================

  exportMemory(): string {
    return JSON.stringify({
      longTermMemory: Array.from(this.longTermMemory.values()),
      learningData: this.learningData,
      patterns: this.patterns,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  importMemory(data: string): { imported: number; errors: number } {
    let imported = 0;
    let errors = 0;

    try {
      const parsed = JSON.parse(data);

      if (parsed.longTermMemory) {
        parsed.longTermMemory.forEach((entry: MemoryEntry) => {
          try {
            this.longTermMemory.set(entry.id, entry);
            imported++;
          } catch {
            errors++;
          }
        });
      }

      if (parsed.learningData) {
        this.learningData = [...this.learningData, ...parsed.learningData];
      }

      if (parsed.patterns) {
        this.patterns = [...this.patterns, ...parsed.patterns];
      }

      this.saveToStorage();
    } catch {
      errors++;
    }

    return { imported, errors };
  }

  clearAll(): void {
    this.longTermMemory.clear();
    this.learningData = [];
    this.patterns = [];
    this.workingMemory = null;
    this.saveToStorage();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryInstance: AgentMemory | null = null;

export const getAgentMemory = (): AgentMemory => {
  if (!memoryInstance) {
    memoryInstance = new AgentMemory();
  }
  return memoryInstance;
};

export const resetAgentMemory = (): void => {
  memoryInstance = null;
};
