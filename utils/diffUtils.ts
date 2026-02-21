/**
 * Diff utilities for comparing BRD versions
 * Provides GitHub-style visual diff highlighting
 */

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

/**
 * Compute the longest common subsequence table for two arrays
 */
function computeLCS(
  oldLines: string[],
  newLines: string[]
): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack through LCS table to produce diff
 */
function backtrackDiff(
  oldLines: string[],
  newLines: string[],
  dp: number[][]
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  const tempResult: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.push({ type: 'unchanged', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.push({ type: 'added', content: newLines[j - 1] });
      j--;
    } else if (i > 0) {
      tempResult.push({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }

  // Reverse since we built it backwards
  return tempResult.reverse();
}

/**
 * Compute a line-by-line diff between two text strings
 * Returns an array of diff lines with type indicators
 */
export function computeLineDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp = computeLCS(oldLines, newLines);
  const lines = backtrackDiff(oldLines, newLines, dp);

  return {
    lines,
    addedCount: lines.filter((l) => l.type === 'added').length,
    removedCount: lines.filter((l) => l.type === 'removed').length,
    unchangedCount: lines.filter((l) => l.type === 'unchanged').length,
  };
}

/**
 * Compute word-level diff within a single line for more granular highlighting
 */
export interface WordDiff {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

export function computeWordDiff(oldLine: string, newLine: string): WordDiff[] {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  
  const dp = computeLCS(oldWords, newWords);
  
  const result: WordDiff[] = [];
  let i = oldWords.length;
  let j = newWords.length;
  const tempResult: WordDiff[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      tempResult.push({ type: 'unchanged', text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.push({ type: 'added', text: newWords[j - 1] });
      j--;
    } else if (i > 0) {
      tempResult.push({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  return tempResult.reverse();
}

/**
 * Format diff for display - returns React-friendly structure
 */
export function formatDiffForDisplay(diff: DiffResult): {
  summary: string;
  hasChanges: boolean;
} {
  const hasChanges = diff.addedCount > 0 || diff.removedCount > 0;
  const summary = hasChanges
    ? `+${diff.addedCount} added, -${diff.removedCount} removed`
    : 'No changes';
  
  return { summary, hasChanges };
}
