import { useState, useEffect, useCallback } from 'react';

interface CacheMetadata {
  processedAt: number;
  processingTime?: number;
  version: string;
}

interface CachedResumeData {
  data: any;
  metadata: CacheMetadata;
}

const CACHE_VERSION = '1.0.0';
const CACHE_KEY = 'updatedResumeResult';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function useResumeCache() {
  const [cachedData, setCachedData] = useState<any>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Check if cached data is fresh
  const isCacheFresh = useCallback((metadata: CacheMetadata) => {
    if (metadata.version !== CACHE_VERSION) return false;
    return (Date.now() - metadata.processedAt) < CACHE_DURATION;
  }, []);

  // Load data from cache
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsedData = JSON.parse(cached);
      
      // Handle legacy format (direct data without metadata)
      if (!parsedData.metadata) {
        const legacyMetadata: CacheMetadata = {
          processedAt: parsedData.processedAt || Date.now(),
          processingTime: parsedData.processingTime,
          version: '0.9.0', // Mark as legacy
        };

        const wrappedData: CachedResumeData = {
          data: parsedData,
          metadata: legacyMetadata
        };

        if (isCacheFresh(legacyMetadata)) {
          setCachedData(parsedData);
          setIsStale(false);
          setLastUpdated(new Date(legacyMetadata.processedAt));
          return parsedData;
        } else {
          setIsStale(true);
          return null;
        }
      }

      // Handle new format with metadata
      const { data, metadata } = parsedData as CachedResumeData;
      
      if (isCacheFresh(metadata)) {
        setCachedData(data);
        setIsStale(false);
        setLastUpdated(new Date(metadata.processedAt));
        return data;
      } else {
        setIsStale(true);
        clearCache();
        return null;
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
      clearCache();
      return null;
    }
  }, [isCacheFresh]);

  // Save data to cache
  const saveToCache = useCallback((data: any, processingTime?: number) => {
    try {
      const metadata: CacheMetadata = {
        processedAt: Date.now(),
        processingTime,
        version: CACHE_VERSION
      };

      const cacheData: CachedResumeData = {
        data,
        metadata
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setCachedData(data);
      setIsStale(false);
      setLastUpdated(new Date(metadata.processedAt));
      
      console.log(`Resume data cached successfully (${processingTime ? `${processingTime}ms processing time` : 'no timing data'})`);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setCachedData(null);
    setIsStale(false);
    setLastUpdated(null);
    console.log('Resume cache cleared');
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    try {
      const size = new Blob([cached]).size;
      return {
        size,
        sizeFormatted: formatBytes(size),
        lastUpdated,
        isStale,
        version: CACHE_VERSION
      };
    } catch {
      return null;
    }
  }, [lastUpdated, isStale]);

  // Initialize cache on mount
  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  return {
    cachedData,
    isStale,
    lastUpdated,
    loadFromCache,
    saveToCache,
    clearCache,
    getCacheStats,
    isCacheAvailable: !!cachedData
  };
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
