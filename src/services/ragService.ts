import { getRagCacheFromDB, isIndexedDBSupported, saveRagCacheToDB } from './indexedDb';
import { db, auth } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

const serverRagCache = new Map<string, { results: VectorDocument[]; expiresAt: number }>();
const SERVER_RAG_CACHE_TTL_MS = 10 * 60 * 1000;
const SERVER_RAG_CACHE_MAX = 200;

interface VectorDocument {
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

const vectorIndex: VectorDocument[] = [];
let isIndexLoaded = false;

// Server-side lazy initialization of Gemini AI instance
let serverAiInstance: any = null;
let serverAiKey = '';
async function getServerAi() {
  if (typeof window !== 'undefined') return null;
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return null;
  if (serverAiInstance && serverAiKey === apiKey) return serverAiInstance;
  const { GoogleGenAI } = await import('@google/genai');
  serverAiInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  serverAiKey = apiKey;
  return serverAiInstance;
}

// Load index from Firestore on demand
async function ensureIndexLoaded() {
  if (isIndexLoaded) return;
  isIndexLoaded = true;
  try {
    const snapshot = await getDocs(collection(db, 'vector_chunks'));
    snapshot.forEach(doc => {
      const data = doc.data();
      vectorIndex.push({
        text: data.text,
        embedding: data.embedding,
        metadata: data.metadata
      });
    });
  } catch (error: any) {
    const code = String(error?.code || '');
    if (code.includes('permission-denied')) {
      console.info('[RAG Service] Firestore vector_chunks skipped on unauthenticated server context.');
    } else {
      console.warn('[RAG Service] Vector index load notice:', error?.message || error);
    }
  }
}

/**
 * Generates an embedding for the given text using Gemini's embedding model (server-side only).
 */
async function getEmbedding(text: string): Promise<number[]> {
  const ai = await getServerAi();
  if (!ai) {
    throw new Error('Embeddings cannot be computed in the browser directly; proxy via backend endpoint.');
  }
  const result = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: text,
  });
  if (!result.embeddings || result.embeddings.length === 0) {
    throw new Error("No embedding returned");
  }
  return result.embeddings[0].values!;
}

/**
 * Chunks and indexes a legal document for RAG.
 */
export async function indexLegalDocument(text: string, metadata: Record<string, any>) {
  // Simple chunking - in a real app, this would be more sophisticated
  const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk.trim());
    vectorIndex.push({
      text: chunk.trim(),
      embedding,
      metadata
    });
  }
}

/**
 * Performs a cosine similarity search against the local vector index.
 */
export async function searchLegalDocuments(query: string, topK: number = 3, institutionId?: string): Promise<VectorDocument[]> {
  const scopePrefix = institutionId ? `inst:${institutionId}` : 'public';
  const cacheKey = `${scopePrefix}::${query}`;

  // If running in browser, proxy through backend API to preserve server-side API key isolation
  if (typeof window !== 'undefined') {
    if (isIndexedDBSupported()) {
      try {
        const cachedResults = await getRagCacheFromDB(cacheKey);
        if (cachedResults && cachedResults.length > 0) return cachedResults;
      } catch {
        // cache miss
      }
    }

    try {
      let authHeader = '';
      if (auth?.currentUser) {
        authHeader = await auth.currentUser.getIdToken().catch(() => '');
      }
      const res = await fetch('/api/rag-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: `Bearer ${authHeader}` } : {}),
        },
        body: JSON.stringify({ query, topK }),
      });

      if (!res.ok) {
        console.warn('Backend RAG search endpoint returned status:', res.status);
        return [];
      }

      const results = await res.json();
      if (Array.isArray(results)) {
        if (isIndexedDBSupported()) {
          await saveRagCacheToDB(cacheKey, results).catch(() => {});
        }
        return results;
      }
      return [];
    } catch (err) {
      console.warn('Browser RAG search failed:', err);
      return [];
    }
  }

  // Server-side execution: use bounded in-memory cache (IndexedDB is browser-only)
  const serverCached = serverRagCache.get(cacheKey);
  if (serverCached && Date.now() < serverCached.expiresAt) {
    return serverCached.results;
  }

  await ensureIndexLoaded();

  // Strict tenant isolation: if institutionId is provided, include only that institution or explicit public docs;
  // if absent, exclude all tenant-scoped documents.
  const filteredDocs = institutionId 
    ? vectorIndex.filter(doc =>
        doc.metadata?.institutionId === institutionId ||
        doc.metadata?.courtId === institutionId ||
        (!doc.metadata?.institutionId && !doc.metadata?.courtId)
      )
    : vectorIndex.filter(doc => !doc.metadata?.institutionId && !doc.metadata?.courtId);

  if (filteredDocs.length === 0) {
    return [];
  }

  try {
    const queryEmbedding = await getEmbedding(query);
    
    const similarities = filteredDocs.map(doc => ({
      doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding)
    }));
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    const results = similarities.slice(0, topK).map(s => s.doc);
    
    if (serverRagCache.size >= SERVER_RAG_CACHE_MAX) {
      const oldestKey = serverRagCache.keys().next().value;
      if (oldestKey !== undefined) serverRagCache.delete(oldestKey);
    }
    serverRagCache.set(cacheKey, {
      results,
      expiresAt: Date.now() + SERVER_RAG_CACHE_TTL_MS,
    });
    
    return results;
  } catch (err) {
    console.warn('Server RAG vector search error:', err);
    return [];
  }
}
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

import { cleanLegalArtifacts, cleanRagChunk, formatRagResultsToEssay } from '../utils/legalProseFormatter';

export { cleanLegalArtifacts, cleanRagChunk, formatRagResultsToEssay };

/**
 * Formats a list of vector search documents into clean, elegant narrative legal prose.
 */
export function formatRagDocumentCollection(
  docs: VectorDocument[],
  options: { title?: string; language?: 'om' | 'am' | 'en' } = {}
): string {
  return formatRagResultsToEssay(docs, options);
}

/**
 * Sanitizes an individual vector document by stripping asterisks and internal labels.
 */
export function cleanVectorDocument(doc: VectorDocument): VectorDocument {
  return {
    ...doc,
    text: cleanRagChunk(doc.text),
  };
}
