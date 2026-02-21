import { generateInitialProjectAnalysis, analyzeSource } from './services/ai';

const DB_NAME = 'ClarityAI_DB';
const STORE_NAME = 'onboarding_store';
const PROJECT_STORE = 'project_store';
const DB_VERSION = 3; // Incremented for schema change

export interface OnboardingState {
  step: number;
  role?: string;
  sources?: string[];
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  type: 'ambiguity' | 'approval' | 'conflict' | 'missing';
  urgency: 'high' | 'medium' | 'low';
  source: string;
  confidence: number;
  status: 'pending' | 'in-progress' | 'completed' | 'snoozed';
  assignee?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  description?: string;
  relatedInsightIds?: string[];
}

export interface Source {
  id: string;
  type: 'meeting' | 'email' | 'slack' | 'jira' | 'upload' | 'chat';
  name: string;
  status: 'active' | 'syncing' | 'idle';
  timestamp: string;
  content?: string; // File content for uploads
  fileType?: string; // MIME type
  fileSize?: number; // Bytes
}

// MoSCoW prioritization levels
export type MoSCoWPriority = 'must' | 'should' | 'could' | 'wont' | 'unset';

// Comment on an insight
export interface InsightComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

// Source reference with snippet for preview
export interface SourceReference {
  sourceId: string;
  sourceName: string;
  sourceType: 'meeting' | 'email' | 'slack' | 'jira' | 'upload' | 'chat';
  snippet: string;        // Relevant excerpt from source
  highlightStart?: number; // Character position where insight was extracted
  highlightEnd?: number;
  timestamp: string;
}

export interface Insight {
  id: string;
  category: 'requirement' | 'decision' | 'stakeholder' | 'timeline' | 'question';
  summary: string;
  detail: string;
  source: string;
  sourceType: 'meeting' | 'email' | 'slack' | 'jira' | 'upload' | 'chat';
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  timestamp: string;
  includedInBRD?: boolean;
  brdSections?: string[];
  
  // === NEW: Multi-source Evidence ===
  supportingSources?: SourceReference[];  // All sources that mention this insight
  evidenceCount?: number;                 // Number of sources confirming this
  confidenceScore?: number;               // 0-100 numeric confidence
  
  // === NEW: Conflict Detection ===
  conflictingInsightIds?: string[];       // IDs of insights that contradict this
  hasConflicts?: boolean;
  
  // === NEW: Deduplication ===
  semanticHash?: string;                  // Hash for similarity detection
  mergedFromIds?: string[];               // IDs of insights merged into this one
  isMerged?: boolean;                     // This insight was merged into another
  
  // === NEW: Editing ===
  originalSummary?: string;               // Original AI-generated summary
  originalDetail?: string;                // Original AI-generated detail
  isEdited?: boolean;
  editHistory?: { summary: string; detail: string; timestamp: string; }[];
  
  // === NEW: MoSCoW Prioritization ===
  priority?: MoSCoWPriority;
  priorityOrder?: number;                 // For drag-and-drop ordering
  stakeholderMentions?: string[];         // Which stakeholders mentioned this
  
  // === NEW: Collaboration ===
  comments?: InsightComment[];
  assignedTo?: string;                    // User ID assigned to review
  assignedToName?: string;
  discussionRequired?: boolean;
  discussionNotes?: string;
  
  // === TRUST SCORE ENGINE v2.0 ===
  trustScore?: {
    finalScore: number;                   // 0-100 comprehensive score
    confidenceLevel: 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
    factorBreakdown?: {
      evidenceQuantity: number;
      sourceReliability: number;
      linguisticConfidence: number;
      temporalFreshness: number;
      stakeholderConsensus: number;
      crossValidation: number;
      conflictImpact: number;
    };
    warnings?: string[];
    recommendations?: string[];
    lastCalculated?: string;
    volatility?: number;                  // How likely score is to change
  };
}

export interface BRDSection {
  id: string;
  title: string;
  content: string;
  sources: string[];
  confidence: number;
  contentHash?: string;  // Hash to detect content changes
  approval?: {
    status: 'pending' | 'approved' | 'needs-revision';
    approvedBy?: string;
    approvedAt?: string;
    notes?: string;
  };
  comments?: {
    id: string;
    author: string;
    text: string;
    timestamp: string;
    resolved: boolean;
  }[];
}

export interface ProjectState {
  id: string;
  name: string;
  description?: string;
  timeline?: string;
  goals?: string;
  goalTags?: string[];
  dateRange?: { start: string; end: string };
  focusSignals?: {
    prioritize: string[];
    ignore: string[];
  };
  status: 'Draft' | 'Under Review' | 'Final';
  lastUpdated: string;
  completeness: number;
  stakeholderCoverage: number;
  overallConfidence: number;
  tasks: Task[];
  recentActivity: { id: string; user: string; action: string; time: string }[];
  sources: Source[];
  insights: Insight[];
  brd?: {
    sections: BRDSection[];
    generatedAt: string;
    version: number;
  };
  brdHistory?: {
    sections: BRDSection[];
    generatedAt: string;
    version: number;
  }[];
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
    };
  });
};

export const saveOnboardingState = async (state: Partial<OnboardingState>) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: 'current_user', ...state });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getOnboardingState = async (): Promise<OnboardingState | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current_user');

    request.onsuccess = () => resolve(request.result ? request.result : null);
    request.onerror = () => reject(request.error);
  });
};

export const clearOnboardingState = async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete('current_user');
  
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
};

export const getProjectData = async (): Promise<ProjectState | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readonly');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.get('proj_1');
        
        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
    });
};

export const createProject = async (data: { name: string; timeline: string; goals?: string }): Promise<ProjectState> => {
    const db = await initDB();
    
    const newProject: ProjectState = {
        id: 'proj_1',
        name: data.name,
        timeline: data.timeline,
        goals: data.goals,
        status: 'Draft',
        lastUpdated: new Date().toISOString(),
        completeness: 0,
        stakeholderCoverage: 0,
        overallConfidence: 0,
        tasks: [],
        recentActivity: [{
            id: `act_${Date.now()}`,
            user: 'System',
            action: 'Project workspace initialized',
            time: new Date().toISOString()
        }],
        sources: [],
        insights: []
    };
    
    // Save initial project immediately
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(newProject);
        request.onsuccess = () => resolve(newProject);
        request.onerror = () => reject(request.error);
    });

    // Trigger AI analysis in background
    generateInitialProjectAnalysis(data.name, data.goals || '', data.timeline).then(async (aiAnalysis) => {
         const db = await initDB();
         const project = await getProjectData();
         if (!project) return;

         const updatedProject = {
             ...project,
             completeness: aiAnalysis.completeness,
             stakeholderCoverage: aiAnalysis.stakeholderCoverage,
             overallConfidence: aiAnalysis.overallConfidence,
             tasks: aiAnalysis.tasks.map((t: any, i: number) => ({ ...t, id: `t_${Date.now()}_${i}`, source: 'Initial Analysis' })),
             recentActivity: [
                { id: `act_${Date.now()}_ai`, user: 'AI Agent', action: 'Initial analysis complete', time: new Date().toISOString() },
                ...project.recentActivity
             ]
         };

         const transaction = db.transaction(PROJECT_STORE, 'readwrite');
         const store = transaction.objectStore(PROJECT_STORE);
         store.put(updatedProject);
    }).catch(async (e) => {
        console.error("Background AI Analysis failed", e);
        // Fallback update
        const db = await initDB();
        const project = await getProjectData();
        if (!project) return;
        
        const updatedProject = {
            ...project,
             completeness: 10,
             stakeholderCoverage: 5,
             overallConfidence: 20,
             tasks: [],
             recentActivity: [
                { id: `act_${Date.now()}_err`, user: 'System', action: 'Analysis unavailable - using defaults', time: new Date().toISOString() },
                ...project.recentActivity
             ]
        };
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        store.put(updatedProject);
    });

    return newProject;
};

export const updateProjectContext = async (updates: Partial<ProjectState>): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedProject: ProjectState = {
        ...project,
        ...updates,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

export const updateBRD = async (brd: ProjectState['brd'], markInsightsAsUsed: boolean = true): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const history = project.brdHistory || [];
    if (project.brd) {
        history.push(project.brd);
    }

    // Extract all source names from BRD sections
    const brdSourceNames = new Set<string>();
    const sectionTitlesBySource = new Map<string, string[]>();
    
    if (brd?.sections && markInsightsAsUsed) {
        brd.sections.forEach(section => {
            (section.sources || []).forEach(source => {
                brdSourceNames.add(source.toLowerCase().trim());
                if (!sectionTitlesBySource.has(source.toLowerCase().trim())) {
                    sectionTitlesBySource.set(source.toLowerCase().trim(), []);
                }
                sectionTitlesBySource.get(source.toLowerCase().trim())!.push(section.title);
            });
        });
    }

    // Update insights to mark which ones were included in BRD
    const updatedInsights = project.insights.map(insight => {
        // Check if this insight's source or summary matches any BRD source
        const insightKey = insight.source.toLowerCase().trim();
        const isIncluded = brdSourceNames.has(insightKey) || 
                           insight.status === 'approved' && brd?.sections?.some(s => 
                               s.content.toLowerCase().includes(insight.summary.toLowerCase().slice(0, 30))
                           );
        
        const matchedSections = sectionTitlesBySource.get(insightKey) || [];
        
        return {
            ...insight,
            includedInBRD: isIncluded || (insight.status === 'approved' && brd?.sections?.length > 0),
            brdSections: matchedSections.length > 0 ? matchedSections : (isIncluded ? ['Referenced'] : undefined)
        };
    });

    const updatedProject: ProjectState = {
        ...project,
        brd,
        brdHistory: history,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

export const updateProjectStatus = async (status: ProjectState['status']): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedProject: ProjectState = {
        ...project,
        status,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

export const updateInsightStatus = async (insightId: string, status: Insight['status']): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedInsights = project.insights.map(insight => 
        insight.id === insightId ? { ...insight, status } : insight
    );

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// Bulk update insights in a single transaction - much faster than individual updates
export const bulkUpdateInsightStatus = async (updates: { insightId: string; status: Insight['status'] }[]): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updateMap = new Map(updates.map(u => [u.insightId, u.status]));
    const updatedInsights = project.insights.map(insight => {
        const newStatus = updateMap.get(insight.id);
        return newStatus ? { ...insight, status: newStatus } : insight;
    });

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// ============================================================================
// INSIGHT MANAGEMENT - Enterprise Features
// ============================================================================

// Update a single insight with any fields
export const updateInsight = async (insightId: string, updates: Partial<Insight>): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedInsights = project.insights.map(insight => 
        insight.id === insightId ? { ...insight, ...updates } : insight
    );

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// Bulk update multiple insights at once
export const bulkUpdateInsights = async (updates: { insightId: string; updates: Partial<Insight> }[]): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updateMap = new Map(updates.map(u => [u.insightId, u.updates]));
    const updatedInsights = project.insights.map(insight => {
        const insightUpdates = updateMap.get(insight.id);
        return insightUpdates ? { ...insight, ...insightUpdates } : insight;
    });

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// Add a comment to an insight
export const addInsightComment = async (insightId: string, comment: InsightComment): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedInsights = project.insights.map(insight => {
        if (insight.id === insightId) {
            return {
                ...insight,
                comments: [...(insight.comments || []), comment]
            };
        }
        return insight;
    });

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// Merge duplicate insights
export const mergeInsights = async (primaryId: string, duplicateIds: string[]): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const primary = project.insights.find(i => i.id === primaryId);
    const duplicates = project.insights.filter(i => duplicateIds.includes(i.id));
    
    if (!primary) throw new Error("Primary insight not found");

    // Merge supporting sources from duplicates
    const allSources: SourceReference[] = [...(primary.supportingSources || [])];
    for (const dup of duplicates) {
        if (dup.supportingSources) {
            allSources.push(...dup.supportingSources);
        }
        // Also add the duplicate's main source as a supporting source
        allSources.push({
            sourceId: dup.id,
            sourceName: dup.source,
            sourceType: dup.sourceType,
            snippet: dup.detail,
            timestamp: dup.timestamp
        });
    }

    // Merge stakeholder mentions
    const allStakeholders = new Set([
        ...(primary.stakeholderMentions || []),
        ...duplicates.flatMap(d => d.stakeholderMentions || [])
    ]);

    const updatedInsights = project.insights.map(insight => {
        if (insight.id === primaryId) {
            return {
                ...insight,
                supportingSources: allSources,
                evidenceCount: allSources.length + 1,
                mergedFromIds: [...(insight.mergedFromIds || []), ...duplicateIds],
                stakeholderMentions: Array.from(allStakeholders),
                // Boost confidence based on evidence
                confidenceScore: Math.min(100, (insight.confidenceScore || 50) + duplicates.length * 15),
                confidence: allSources.length >= 3 ? 'high' : allSources.length >= 1 ? 'medium' : 'low'
            };
        }
        if (duplicateIds.includes(insight.id)) {
            return { ...insight, isMerged: true, status: 'rejected' as const };
        }
        return insight;
    });

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// Reorder insights by priority
export const reorderInsightPriorities = async (insightIds: string[]): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const orderMap = new Map(insightIds.map((id, idx) => [id, idx]));
    const updatedInsights = project.insights.map(insight => {
        const order = orderMap.get(insight.id);
        return order !== undefined ? { ...insight, priorityOrder: order } : insight;
    });

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

export const addSourceToProject = async (source: Source): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");
    
    // Add source immediately to state
    const intermediateProject: ProjectState = {
        ...project,
        sources: [...(project.sources || []), source],
        lastUpdated: new Date().toISOString(),
        recentActivity: [
            { id: `act_${Date.now()}`, user: 'System', action: `Added ${source.name}`, time: 'Just now' },
            ...project.recentActivity
        ]
    };

    await new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(intermediateProject);
        request.onsuccess = () => resolve(intermediateProject);
        request.onerror = () => reject(request.error);
    });

    // Run AI analysis in background
    analyzeSource(
        source.name, 
        source.type, 
        { name: project.name, goals: project.goals },
        source.content // Pass file content if available
    ).then(async (analysisResult) => {
        const db = await initDB();
        const currentProject = await getProjectData();
        if (!currentProject) return;

        const newTasks: Task[] = analysisResult.tasks.map((t: any, i: number) => ({
            ...t,
            id: `t_${Date.now()}_${i}`,
            source: source.name
        }));

        const newInsights: Insight[] = analysisResult.insights.map((ins: any, i: number) => ({
            ...ins,
            id: `ins_${Date.now()}_${i}`,
            timestamp: new Date().toISOString()
        }));

        const updatedProject: ProjectState = {
            ...currentProject,
            completeness: Math.min(currentProject.completeness + (analysisResult.confidenceBoost || 5), 100),
            stakeholderCoverage: Math.min(currentProject.stakeholderCoverage + (analysisResult.confidenceBoost || 5), 100),
            overallConfidence: Math.min(currentProject.overallConfidence + (analysisResult.confidenceBoost || 5), 98),
            recentActivity: [
                { id: `act_${Date.now()}_ai`, user: 'AI Agent', action: `Analyzed ${source.name}`, time: 'Just now' },
                ...currentProject.recentActivity
            ],
            tasks: [...currentProject.tasks, ...newTasks],
            insights: [...(currentProject.insights || []), ...newInsights]
        };

        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        store.put(updatedProject);
    }).catch(e => {
        console.error("Background Source Analysis failed", e);
    });

    return intermediateProject;
};

// ============================================================================
// ADDITIONAL HELPERS FOR ROBUST STATE MANAGEMENT
// ============================================================================

/**
 * Clear the BRD inclusion flags from all insights (used when BRD is regenerated)
 */
export const resetInsightsBRDStatus = async (): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedInsights = project.insights.map(insight => ({
        ...insight,
        includedInBRD: false,
        brdSections: undefined
    }));

    const updatedProject: ProjectState = {
        ...project,
        insights: updatedInsights,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get statistics about project state for dashboards
 */
export const getProjectStats = (project: ProjectState | null) => {
    if (!project) {
        return {
            totalInsights: 0,
            approvedInsights: 0,
            pendingInsights: 0,
            flaggedInsights: 0,
            rejectedInsights: 0,
            insightsInBRD: 0,
            hasBRD: false,
            brdVersion: 0,
            brdSectionCount: 0,
            sourcesCount: 0,
            readinessScore: 0
        };
    }

    const insights = project.insights || [];
    const approvedInsights = insights.filter(i => i.status === 'approved').length;
    const insightsInBRD = insights.filter(i => i.includedInBRD).length;

    return {
        totalInsights: insights.length,
        approvedInsights,
        pendingInsights: insights.filter(i => i.status === 'pending').length,
        flaggedInsights: insights.filter(i => i.status === 'flagged').length,
        rejectedInsights: insights.filter(i => i.status === 'rejected').length,
        insightsInBRD,
        hasBRD: !!project.brd,
        brdVersion: project.brd?.version || 0,
        brdSectionCount: project.brd?.sections?.length || 0,
        sourcesCount: project.sources?.length || 0,
        readinessScore: Math.round(
            (project.sources?.length ? 25 : 0) +
            (approvedInsights > 0 ? 25 : 0) +
            (project.brd ? 35 : 0) +
            (project.status === 'Final' ? 15 : 0)
        )
    };
};

/**
 * Add activity log entry
 */
export const addActivityLog = async (action: string, user: string = 'System'): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedProject: ProjectState = {
        ...project,
        recentActivity: [
            { id: `act_${Date.now()}`, user, action, time: new Date().toISOString() },
            ...project.recentActivity.slice(0, 49) // Keep last 50 activities
        ],
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

// ============================================================================
// TASK MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Update a single task
 */
export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updatedTasks = project.tasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
    );

    const updatedProject: ProjectState = {
        ...project,
        tasks: updatedTasks,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Batch update multiple tasks
 */
export const bulkUpdateTasks = async (updates: { id: string; changes: Partial<Task> }[]): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const updateMap = new Map(updates.map(u => [u.id, u.changes]));
    
    const updatedTasks = project.tasks.map(task => {
        const changes = updateMap.get(task.id);
        return changes ? { ...task, ...changes } : task;
    });

    const updatedProject: ProjectState = {
        ...project,
        tasks: updatedTasks,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Add a new task
 */
export const addTask = async (task: Omit<Task, 'id' | 'createdAt'>): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const newTask: Task = {
        ...task,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        status: task.status || 'pending'
    };

    const updatedProject: ProjectState = {
        ...project,
        tasks: [...project.tasks, newTask],
        recentActivity: [
            { id: `act_${Date.now()}`, user: 'PM', action: `Created task: ${task.title}`, time: new Date().toISOString() },
            ...project.recentActivity.slice(0, 49)
        ],
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete a task
 */
export const deleteTask = async (taskId: string): Promise<ProjectState> => {
    const db = await initDB();
    const project = await getProjectData();
    if (!project) throw new Error("No project found");

    const taskToDelete = project.tasks.find(t => t.id === taskId);
    const updatedTasks = project.tasks.filter(task => task.id !== taskId);

    const updatedProject: ProjectState = {
        ...project,
        tasks: updatedTasks,
        recentActivity: taskToDelete ? [
            { id: `act_${Date.now()}`, user: 'PM', action: `Removed task: ${taskToDelete.title}`, time: new Date().toISOString() },
            ...project.recentActivity.slice(0, 49)
        ] : project.recentActivity,
        lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECT_STORE);
        const request = store.put(updatedProject);
        request.onsuccess = () => resolve(updatedProject);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get task statistics
 */
export const getTaskStats = (project: ProjectState | null) => {
    if (!project) {
        return {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            snoozed: 0,
            highUrgency: 0,
            mediumUrgency: 0,
            lowUrgency: 0,
            overdue: 0,
            byType: { ambiguity: 0, approval: 0, conflict: 0, missing: 0 }
        };
    }

    const tasks = project.tasks || [];
    const now = new Date();

    return {
        total: tasks.length,
        pending: tasks.filter(t => (t.status || 'pending') === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        snoozed: tasks.filter(t => t.status === 'snoozed').length,
        highUrgency: tasks.filter(t => t.urgency === 'high' && (t.status || 'pending') !== 'completed').length,
        mediumUrgency: tasks.filter(t => t.urgency === 'medium' && (t.status || 'pending') !== 'completed').length,
        lowUrgency: tasks.filter(t => t.urgency === 'low' && (t.status || 'pending') !== 'completed').length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && (t.status || 'pending') !== 'completed').length,
        byType: {
            ambiguity: tasks.filter(t => t.type === 'ambiguity' && (t.status || 'pending') !== 'completed').length,
            approval: tasks.filter(t => t.type === 'approval' && (t.status || 'pending') !== 'completed').length,
            conflict: tasks.filter(t => t.type === 'conflict' && (t.status || 'pending') !== 'completed').length,
            missing: tasks.filter(t => t.type === 'missing' && (t.status || 'pending') !== 'completed').length
        }
    };
};