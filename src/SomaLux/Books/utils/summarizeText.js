/**
 * Utility functions for text summarization
 */

/**
 * Generate a summary from text using extractive summarization
 * (sentence extraction based on importance scoring)
 * @param {string} text - The text to summarize
 * @param {number} sentenceCount - Number of sentences to include in summary
 * @returns {string} - The summarized text
 */
export const generateSummary = (text, sentenceCount = 5) => {
  if (!text || text.trim().length === 0) {
    return 'No text available to summarize.';
  }

  // Split text into sentences
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out very short fragments

  if (sentences.length === 0) {
    return 'Text too short to summarize.';
  }

  // If text has fewer sentences than requested, return all
  if (sentences.length <= sentenceCount) {
    return sentences.join(' ');
  }

  // Score each sentence based on word frequency and position
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3); // Words longer than 3 chars

  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Calculate average word frequency
  const avgFreq = Object.values(wordFreq).reduce((a, b) => a + b, 0) / Object.keys(wordFreq).length;

  // Score sentences
  const scoredSentences = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().split(/\W+/);
    let score = 0;

    sentenceWords.forEach(word => {
      if (wordFreq[word] && wordFreq[word] > avgFreq) {
        score += wordFreq[word];
      }
    });

    // Boost score for sentences at the beginning
    if (index < sentences.length * 0.2) {
      score *= 1.2;
    }

    return { sentence, score, index };
  });

  // Select top sentences and sort by original order
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence);

  return topSentences.join(' ');
};

/**
 * Generate a key points summary (bulleted format)
 * @param {string} text - The text to summarize
 * @param {number} pointCount - Number of key points to extract
 * @returns {string[]} - Array of key points
 */
export const generateKeyPoints = (text, pointCount = 5) => {
  if (!text || text.trim().length === 0) {
    return ['No content available'];
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length === 0) {
    return ['Text too short to extract points'];
  }

  // Score sentences similar to generateSummary
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3);

  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const avgFreq = Object.values(wordFreq).reduce((a, b) => a + b, 0) / Object.keys(wordFreq).length;

  const scoredSentences = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().split(/\W+/);
    let score = 0;

    sentenceWords.forEach(word => {
      if (wordFreq[word] && wordFreq[word] > avgFreq) {
        score += wordFreq[word];
      }
    });

    if (index < sentences.length * 0.2) {
      score *= 1.2;
    }

    return { sentence, score };
  });

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(pointCount, sentences.length))
    .map(item => item.sentence);
};

/**
 * Get text statistics
 * @param {string} text - The text to analyze
 * @returns {object} - Statistics about the text
 */
export const getTextStats = (text) => {
  if (!text) {
    return { words: 0, sentences: 0, characters: 0, avgWordLength: 0, avgSentenceLength: 0 };
  }

  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const characters = text.length;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length || 0;
  const avgSentenceLength = words.length / sentences.length || 0;

  return {
    words: words.length,
    sentences: sentences.length,
    characters,
    avgWordLength: avgWordLength.toFixed(1),
    avgSentenceLength: avgSentenceLength.toFixed(1),
  };
};
