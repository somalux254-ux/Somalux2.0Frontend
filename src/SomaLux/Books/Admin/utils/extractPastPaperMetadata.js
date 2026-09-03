import * as pdfjsLib from 'pdfjs-dist';

/**
 * Extract metadata from past paper PDF
 * Reads first page and extracts: university, faculty, unit code, year, exam type
 */
export async function extractPastPaperMetadata(pdfFile) {
  try {
    // Set up PDF.js worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extract text from first 5 pages (more pages for better content extraction)
    let fullText = '';
    const pagesToRead = Math.min(5, pdfDoc.numPages);

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      // AGGRESSIVE: Collect ALL items, not just text items
      let pageText = '';
      
      // Separate by y-coordinate to better detect line breaks
      let currentY = null;
      let currentLine = '';
      
      for (const item of textContent.items) {
        // Item might have y property for vertical position
        if (item.y !== undefined && item.y !== currentY && currentLine.trim()) {
          // Y position changed - likely a new line
          pageText += currentLine.trim() + '\n';
          currentLine = '';
          currentY = item.y;
        }
        
        if (item.str && item.str.trim()) {
          currentLine += item.str + ' ';
          currentY = item.y;
        }
      }
      
      // Add any remaining text
      if (currentLine.trim()) {
        pageText += currentLine.trim() + '\n';
      }
      
      // Add separator between pages
      fullText += pageText + '\n\n';
    }

    // Only return parseMetadataFromText if we got substantial content
    if (fullText && fullText.trim().length >= 50) {
      return parseMetadataFromText(fullText, pdfFile.name);
    } else {
      // If PDF extraction failed to get content, log clearly
      console.warn(`⚠️ PDF content too small (${fullText.trim().length} chars). Extraction may be incomplete.`);
      const result = parseMetadataFromText(fullText, pdfFile.name);
      // DO NOT fallback to filename - leave empty fields if PDF extraction insufficient
      result.source = 'pdf-empty';
      return result;
    }
  } catch (error) {
    console.warn('PDF extraction failed:', error);
    // CRITICAL: DO NOT fallback to filename parsing
    // Return empty metadata instead - filename should NEVER be used for extraction
    console.warn('⚠️ IMPORTANT: Not using filename as fallback. Unit name must be from PDF only.');
    return {
      university: null,
      faculty: null,
      unitCode: null,
      unitName: null,
      year: null,
      semester: null,
      examType: null,
      source: 'failed'
    };
  }
}

/**
 * Parse metadata from extracted text - PDF ONLY, NO FILENAME FALLBACK
 */
function parseMetadataFromText(text, filename) {
  const metadata = {
    university: null,
    faculty: null,
    unitCode: null,
    unitName: null,
    year: null,
    semester: null,
    examType: null,
    source: 'text'
  };

  // Log raw PDF content for debugging
  console.log('📄 RAW PDF TEXT (first 500 chars):', text.substring(0, 500));
  console.log('📄 TOTAL PDF TEXT LENGTH:', text.length, 'chars');

  // Convert to uppercase for pattern matching
  const upperText = text.toUpperCase();

  // Extract University - look for common patterns
  const universityPatterns = [
    /UNIVERSITY\s+OF\s+([A-Z\s]+?)(?:\n|EXAMINATION|EXAM|PAPER|FACULTY|SCHOOL|DEPARTMENT|$)/i,
    /([A-Z\s]+?)\s+UNIVERSITY(?:\n|\s|EXAMINATION|EXAM|FACULTY|SCHOOL|DEPARTMENT|$)/i,
  ];

  for (const pattern of universityPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Clean up extracted text
      if (extracted.length > 3) { // Avoid very short matches
        metadata.university = extracted;
        break;
      }
    }
  }

  // Extract Faculty/School - more flexible patterns - ENHANCED
  const facultyPatterns = [
    /FACULTY\s+OF\s+([A-Z\s&,]+?)(?:\n|EXAMINATION|EXAM|PAPER|COURSE|UNIT|$)/i,
    /SCHOOL\s+OF\s+([A-Z\s&,]+?)(?:\n|EXAMINATION|EXAM|PAPER|COURSE|UNIT|$)/i,
    /DEPARTMENT\s+OF\s+([A-Z\s&,]+?)(?:\n|EXAMINATION|EXAM|PAPER|COURSE|UNIT|$)/i,
    /COLLEGE\s+OF\s+([A-Z\s&,]+?)(?:\n|EXAMINATION|EXAM|PAPER|COURSE|UNIT|$)/i,
    /(?:FACULTY|SCHOOL|DEPARTMENT|COLLEGE):\s*([A-Z\s&,]+?)(?:\n|EXAMINATION|EXAM)/i,
    // Pattern: look for subject/faculty after university name
    /(?:UNIVERSITY.*?\n)((?:[A-Z][A-Z\s&,]+?))\s*(?:EXAMINATION|EXAM|$)/i
  ];

  for (const pattern of facultyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Clean up extracted text - remove common artifacts
      let cleaned = extracted
        .replace(/\d+/g, '') // Remove numbers
        .replace(/\s{2,}/g, ' ') // Normalize whitespace
        .trim();
      
      // Only accept if it looks like a faculty name (not too short, not too long)
      if (cleaned.length > 3 && cleaned.length < 100 && !cleaned.match(/^(AND|OR|THE|A|EXAMINATION|EXAM)$/i)) {
        metadata.faculty = cleaned;
        break;
      }
    }
  }

  // Extract Unit Code (ONLY numeric part: 2-4 digits, NO letters)
  // The full code is usually "PREFIX NUMBER" e.g., "SCE 116" or "BIO 301"
  // Unit Name = PREFIX (SCE, KAS, HSU)
  // Unit Code = NUMBER (116, 101, 301)
  const codePatterns = [
    /\b([A-Z]{2,6})\s*[-]?\s*(\d{2,4})\b/,  // Extract both prefix and digits from "CODE 101" or "CODE-101"
    /\b([A-Z]{2,6})(\d{2,4})\b/,              // Extract both from "CODE101"
    /\bCOURSE[:\s]*([A-Z]{2,6})\s*[-]?\s*(\d{2,4})/i,  // "COURSE: SCE 116"
    /\bCODE[:\s]*([A-Z]{2,6})\s*[-]?\s*(\d{2,4})/i,    // "CODE: SCE 116"
    /\b([A-Za-z]+)\s+(\d{3,4})\b/             // Extract from "BIOLOGY 301" or "Physics 101"
  ];
  
  for (const pattern of codePatterns) {
    const match = text.match(pattern);
    if (match) {
      const prefix = match[1];    // PREFIX is unitName
      const digits = match[2];    // DIGITS is unitCode
      // Validate: digits must be ONLY digits and reasonable length
      if (/^\d{2,4}$/.test(digits)) {
        // Only set if we don't have a unitName yet
        if (!metadata.unitName) {
          metadata.unitName = prefix;  // PREFIX becomes Unit Name
          metadata.unitCode = digits;  // DIGITS becomes Unit Code
          console.log(`✅ Extracted unitName (prefix): "${metadata.unitName}", unitCode (digits): "${metadata.unitCode}"`);
          break;
        }
      } else {
        console.log(`❌ Rejected - code number invalid: "${digits}"`);
      }
    }
  }

  // Note: unitName has already been extracted from the code prefix above
  // No need for additional unit name extraction - it's now part of the code pattern
  if (metadata.unitName) {
    console.log(`\n✅ UNIT NAME ALREADY EXTRACTED FROM CODE PREFIX: "${metadata.unitName}"`);
  }

  // Extract Year (4 digits, prioritize years in reasonable range 1980-2050)
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    // Filter for reasonable exam years and prefer more recent ones
    for (const yearStr of yearMatches.reverse()) {
      const year = parseInt(yearStr);
      if (year >= 1980 && year <= 2050) {
        metadata.year = year;
        break;
      }
    }
  }
  
  // Fallback: if no 4-digit year found, look for 2-digit years preceded by certain contexts
  if (!metadata.year) {
    const twoDigitYearMatch = text.match(/(?:Year|year|YEAR|Date|date|DATE)[:\s]+['\`]?(\d{2})(?:\s|['\`]|$)/);
    if (twoDigitYearMatch) {
      const twoDigit = parseInt(twoDigitYearMatch[1]);
      // Assume 00-30 is 2000s, 31-99 is 1900s
      metadata.year = twoDigit <= 30 ? 2000 + twoDigit : 1900 + twoDigit;
    }
  }

  // Extract Semester - more robust patterns
  const semesterPatterns = [
    { pattern: /SEMESTER\s*:?\s*([1-3])/i, group: 1 },
    { pattern: /SEM\s*:?\s*([1-3])/i, group: 1 },
    { pattern: /(FIRST|SECOND|THIRD)\s+SEMESTER/i, test: (match) => {
        if (match[1].toUpperCase() === 'FIRST') return '1';
        if (match[1].toUpperCase() === 'SECOND') return '2';
        if (match[1].toUpperCase() === 'THIRD') return '3';
        return null;
      }
    }
  ];

  for (const { pattern, group, test } of semesterPatterns) {
    const match = text.match(pattern);
    if (match) {
      metadata.semester = test ? test(match) : match[group];
      if (metadata.semester) break;
    }
  }

  // Extract Exam Type - more comprehensive patterns
  const examTypePatterns = [
    { pattern: /\b(MAIN|MAINEXAMINATION)\b/i, type: 'Main' },
    { pattern: /\b(SUPPLEMENTARY|SUPPLEMENTAL|SUPP)\b/i, type: 'Supplementary' },
    { pattern: /\b(CAT|CONTINUOUS\s*ASSESSMENT|CONTINUOUS\s*ASSESSMENT\s*TEST)\b/i, type: 'CAT' },
    { pattern: /\b(MOCK|MOCKEXAMINATION)\b/i, type: 'Mock' },
    { pattern: /\b(MIDTERM|MID\s*TERM)\b/i, type: 'Midterm' },
    { pattern: /EXAMINATION\s+TYPE[:\s]+([\w\s]+?)(?:\n|$)/i, type: null, group: 1 }
  ];

  for (const { pattern, type, group } of examTypePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (group) {
        // Custom group processing
        const extracted = match[group].trim().replace(/\s+/g, ' ');
        // Capitalize each word
        metadata.examType = extracted.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      } else {
        metadata.examType = type;
      }
      break;
    }
  }

  // ⚠️ IMPORTANT: PDF-ONLY EXTRACTION - NO FILENAME FALLBACK
  // The system should extract EVERYTHING from PDF content only
  // Do NOT use filename for any metadata
  console.log('📊 PDF Extraction Complete. Extracted metadata:', {
    unitCode: metadata.unitCode,
    unitName: metadata.unitName,
    year: metadata.year,
    semester: metadata.semester,
    examType: metadata.examType
  });

  // If unit name is empty or just looks like a code, try harder to extract from PDF
  if (!metadata.unitName) {
    console.log('🔍 Unit name not found with primary patterns, attempting aggressive extraction...');
    
    // Get all substantial lines from the text
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    // AGGRESSIVE STRATEGY 1: Context-based extraction around unit code
    if (metadata.unitCode) {
      let foundCodeIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toUpperCase().includes(metadata.unitCode.toUpperCase())) {
          foundCodeIdx = i;
          break;
        }
      }
      
      if (foundCodeIdx >= 0) {
        // Scan the next 10 lines for the course name
        const searchRange = Math.min(10, lines.length - foundCodeIdx - 1);
        for (let offset = 1; offset <= searchRange; offset++) {
          const line = lines[foundCodeIdx + offset];
          
          // Skip metadata/section headers
          if (/^(EXAMINATION|EXAM|QUESTION|SECTION|INSTRUCTIONS|DATE|TIME|DURATION|MARKS|SEMESTER|ANSWER|ATTEMPT|ANSWER|SECTION|INSTRUCTIONS|FOR OFFICIAL|CONFIDENTIAL|Page)/i.test(line)) continue;
          
          // Skip pure numbers
          if (/^\d+$/.test(line)) continue;
          
          // Skip code-like strings
          if (/^[A-Z0-9]+$/.test(line) && line.length < 10) continue;
          
          // Skip very short lines (likely not course name)
          if (line.length < 4) continue;
          
          // CRITICAL: Unit name MUST NOT contain digits
          if (/\d/.test(line)) {
            console.log(`⏭️ Skipping line with digits: "${line}"`);
            continue;
          }
          
          // This could be the course name
          if (/[A-Za-z]/.test(line)) {
            metadata.unitName = line;
            console.log('✅ Extracted unit name (strategy 1 - code context):', metadata.unitName);
            break;
          }
        }
      }
    }
    
    // AGGRESSIVE STRATEGY 2: Scan for any substantial title-case multi-word phrase
    if (!metadata.unitName) {
      for (const line of lines) {
        // Must have multiple words or be reasonably long
        const words = line.split(/\s+/);
        if (words.length < 2 && line.length < 8) continue;
        
        // Skip metadata lines
        if (/^(EXAMINATION|EXAM|DATE|TIME|DURATION|MARKS|QUESTION|SECTION|PAPER|INSTRUCTIONS|ANSWER|MAIN|SUPPLEMENTARY|FOR|CONFIDENTIAL|Page|\d+|[A-Z0-9]+)$/i.test(line)) continue;
        
        // CRITICAL: Unit name MUST NOT contain digits
        if (/\d/.test(line)) {
          console.log(`⏭️ Skipping line with digits: "${line}"`);
          continue;
        }
        
        // Skip if it's just the unit code
        if (metadata.unitCode && line.toUpperCase().includes(metadata.unitCode.toUpperCase()) && line.length < 20) continue;
        
        // Accept if it looks like a course name (has letters, reasonable length, not all caps code)
        if (/[A-Za-z]/.test(line) && line.length > 3 && line.length < 200 && !(/^[A-Z0-9]+$/.test(line) && line.length < 10)) {
          metadata.unitName = line;
          console.log('✅ Extracted unit name (strategy 2 - scan):', metadata.unitName);
          break;
        }
      }
    }
    
    // AGGRESSIVE STRATEGY 3: Look for any capitalized sequence that's not metadata
    if (!metadata.unitName) {
      const textLines = text.split('\n');
      for (const line of textLines) {
        const trimmed = line.trim();
        
        // Must have content
        if (trimmed.length < 4) continue;
        
        // Skip pure metadata indicators
        if (/(EXAMINATION|EXAM|QUESTIONS|INSTRUCTIONS|TIME|DATE|DURATION|MARKS|Page|For official|Confidential|ANSWER)/i.test(trimmed)) continue;
        
        // CRITICAL: Unit name MUST NOT contain digits
        if (/\d/.test(trimmed)) {
          console.log(`⏭️ Skipping line with digits: "${trimmed}"`);
          continue;
        }
        
        // Prefer lines that start with capital and have multiple words
        if (/^[A-Z]/.test(trimmed) && trimmed.includes(' ') && !(/^[A-Z0-9\-]+$/.test(trimmed))) {
          // Clean up any trailing non-letter characters
          let cleaned = trimmed.replace(/[\d\(\)\[\]]+\s*$/, '').trim();
          
          if (cleaned.length > 3 && /[A-Za-z]/.test(cleaned) && cleaned.length < 200 && !/\d/.test(cleaned)) {
            metadata.unitName = cleaned;
            console.log('✅ Extracted unit name (strategy 3 - capitalized):', metadata.unitName);
            break;
          }
        }
      }
    }
  }

  // If unit name is just a code (numeric only or all caps code), clear it and try again
  if (metadata.unitName && /^[A-Z0-9]+$/.test(metadata.unitName) && metadata.unitName.length < 10) {
    console.warn('⚠️ Unit name looks like a code, clearing and retrying:', metadata.unitName);
    metadata.unitName = null;
    
    // Final desperate attempt: get ANY substantial text from the PDF
    if (!metadata.unitName) {
      const textLines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && l.length < 200 && /[A-Za-z]/.test(l) && !/^(EXAMINATION|EXAM|DATE|TIME|PAGE|FOR|CONFIDENTIAL|ANSWER|QUESTION|SECTION|INSTRUCTIONS|\d+|[A-Z0-9]+)$/i.test(l));
      
      if (textLines.length > 0) {
        // Pick the line that's most likely to be a course name (multi-word, mixed case)
        for (const line of textLines) {
          if (line.includes(' ') && !(/^[A-Z0-9\-]+$/.test(line))) {
            metadata.unitName = line;
            console.log('✅ Extracted unit name (final fallback):', metadata.unitName);
            break;
          }
        }
        
        // If still nothing, just take first substantial line
        if (!metadata.unitName && textLines.length > 0) {
          metadata.unitName = textLines[0];
          console.log('✅ Extracted unit name (last resort):', metadata.unitName);
        }
      }
    }
  }

  // Log final extraction status
  if (!metadata.unitName) {
    console.warn('⚠️ Unable to extract unit name from PDF');
  } else if (metadata.source === 'filename') {
    console.info('ℹ️ Using filename as fallback (PDF extraction may have failed)');
  }

  return metadata;
}

/**
 * Parse metadata from filename
 * IMPORTANT: NEVER extract unitName from filename under ANY circumstance
 * IMPORTANT: unitCode must be ONLY digits, no letters
 * Supports extraction of unitCode (numeric part only), year, semester, examType only
 */
function parseMetadataFromFilename(filename) {
  const metadata = {
    university: null,
    faculty: null,
    unitCode: null,
    unitName: null, // MUST REMAIN NULL - extracted from PDF only
    year: null,
    semester: null,
    examType: null,
    source: 'filename'
  };

  const fileNameWithoutExt = filename.replace('.pdf', '').replace(/\.[a-z]+$/i, '').replace('.PDF', '');
  
  // CRITICAL: NEVER extract or set unitName from filename
  // If this function is called, it means PDF extraction failed
  // We can only safely extract numeric unit code and date information
  
  // Try to extract CODE-like pattern: LETTERS followed by DIGITS
  // Handle multiple formats:
  // 1. "APH1012" -> code "1012" (up to 4 digits, but grab last 2-4 consecutive digits before date)
  // 2. "HPH70020120402" -> code "202" (grab middle digits, not embedded in date)
  // 3. "AEN 202" -> code "202"
  // 4. "AGE 101 2015" -> code "101"
  
  // Strategy: Extract PREFIX, then find the first significant digit group (2-4 digits not part of date)
  const prefixMatch = fileNameWithoutExt.match(/^([A-Z]{2,6})/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    
    // Now find a 2-4 digit sequence that looks like a unit code
    // Exclude sequences that are clearly dates (yyyymmdd format)
    const afterPrefix = fileNameWithoutExt.substring(prefix.length);
    
    // Try different patterns to find unit code
    let unitCode = null;
    
    // Pattern 1: Digits immediately after prefix "APH1012"
    let digitsMatch = afterPrefix.match(/^(\d{2,4})/);
    if (digitsMatch && !/^\d{8}$/.test(digitsMatch[1])) {
      unitCode = digitsMatch[1];
    } else {
      // Pattern 2: Extract 2-4 digits that are NOT part of an 8-digit date (yyyymmdd)
      // Look for digit sequences surrounded by non-digits or separators
      const allDigits = afterPrefix.match(/(\d{1,4})/g);
      if (allDigits && allDigits.length > 0) {
        // Skip 8-digit sequences (these are dates like 20120402)
        // Take the first 2-4 digit sequence that's not 8 digits
        for (const digits of allDigits) {
          if (digits.length >= 2 && digits.length <= 4) {
            unitCode = digits;
            break;
          }
        }
      }
    }
    
    // Validate: unit_code MUST be ONLY digits and correct length
    if (unitCode && /^\d{2,4}$/.test(unitCode)) {
      metadata.unitCode = unitCode;
      console.log(`✅ [FILENAME] Extracted unitCode: ${unitCode} from prefix: ${prefix}`);
    }
    // ⚠️ CRITICAL: NEVER extract the letter part as unitName - it must come from PDF
    // ⚠️ CRITICAL: NEVER set unitName - it must come from PDF content only
    // unitName MUST remain null - will NEVER be used from filename
  }
  
  // Try to extract year (looking for 4-digit year patterns)
  const yearMatch = fileNameWithoutExt.match(/(?:20|19)\d{2}/);
  if (yearMatch) {
    metadata.year = parseInt(yearMatch[0]);
  }
  
  // Try to extract semester (single digit 1-3)
  const semesterMatch = fileNameWithoutExt.match(/[_\-\s](\d)(?:[_\-\s]|$)/);
  if (semesterMatch && /[1-3]/.test(semesterMatch[1])) {
    metadata.semester = semesterMatch[1];
  }
  
  // Try to extract exam type
  if (/supplementary|supp/i.test(fileNameWithoutExt)) metadata.examType = 'Supplementary';
  else if (/\bcat\b/i.test(fileNameWithoutExt)) metadata.examType = 'CAT';
  else if (/mock/i.test(fileNameWithoutExt)) metadata.examType = 'Mock';
  else if (/main/i.test(fileNameWithoutExt)) metadata.examType = 'Main';

  // ⚠️ CRITICAL LOG: Explicitly confirm unitName is NOT extracted from filename
  console.warn(`⚠️ [FILENAME-PARSE] ✅ Confirmed: unitName is NEVER extracted from filename`);
  console.warn(`⚠️ [FILENAME-PARSE] ✅ unitName field remains NULL - must come from PDF content only`);
  console.warn(`⚠️ [FILENAME-PARSE] Extracted from filename - unitCode: ${metadata.unitCode}, year: ${metadata.year}`);

  return metadata;
}

/**
 * Find matching university by name (fuzzy match)
 * @param {string} extractedUniversity - Extracted university name
 * @param {Array} universities - List of available universities [{id, name}, ...]
 * @returns {string|null} - Matched university ID or null
 */
export function findMatchingUniversity(extractedUniversity, universities) {
  if (!extractedUniversity || !universities.length) return null;

  const extracted = extractedUniversity.toUpperCase().trim();
  
  // Exact or substring match
  for (const uni of universities) {
    const uniName = uni.name.toUpperCase();
    if (uniName.includes(extracted) || extracted.includes(uniName)) {
      return uni.id;
    }
  }

  // Fuzzy match - count matching words
  const extractedWords = extracted.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const uni of universities) {
    const uniWords = uni.name.toUpperCase().split(/\s+/);
    let matchCount = 0;
    
    for (const word of extractedWords) {
      if (uniWords.some(w => w.includes(word) || word.includes(w))) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(extractedWords.length, uniWords.length);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = uni.id;
    }
  }

  return bestMatch;
}

/**
 * Find matching faculty by name
 * @param {string} extractedFaculty - Extracted faculty name
 * @param {Array} faculties - List of available faculties [string, ...]
 * @returns {string|null} - Matched faculty or null
 */
export function findMatchingFaculty(extractedFaculty, faculties) {
  if (!extractedFaculty || !faculties.length) return null;

  const extracted = extractedFaculty.toUpperCase().trim();

  // Exact or substring match
  for (const fac of faculties) {
    const facName = fac.toUpperCase();
    if (facName.includes(extracted) || extracted.includes(facName)) {
      return fac;
    }
  }

  // Fuzzy match
  const extractedWords = extracted.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const fac of faculties) {
    const facWords = fac.toUpperCase().split(/\s+/);
    let matchCount = 0;
    
    for (const word of extractedWords) {
      if (facWords.some(w => w.includes(word) || word.includes(w))) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(extractedWords.length, facWords.length);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = fac;
    }
  }

  return bestMatch;
}

/**
 * Intelligently guess faculty/department from unit code
 * Common patterns: CHEM→Chemistry, BIO→Biology, MATH→Mathematics, etc.
 */
export function guessFacultyFromUnitCode(unitCode, unitName) {
  if (!unitCode) return null;
  
  const code = (unitCode || '').toUpperCase();
  const name = (unitName || '').toUpperCase();
  
  // Map common unit code prefixes to faculties
  const codeToFaculty = {
    // Sciences
    'CHEM': 'Chemistry',
    'BIO': 'Biology',
    'PHYS': 'Physics',
    'MATH': 'Mathematics',
    'STAT': 'Statistics',
    'GEO': 'Geology',
    'BOT': 'Botany',
    'ZOO': 'Zoology',
    
    // Engineering
    'ENG': 'Engineering',
    'MECH': 'Mechanical Engineering',
    'ELEC': 'Electrical Engineering',
    'CIVI': 'Civil Engineering',
    'COMP': 'Computer Science/Engineering',
    'ICT': 'Information & Communication Technology',
    'IT': 'Information Technology',
    'CS': 'Computer Science',
    'SE': 'Software Engineering',
    
    // Humanities & Social Sciences
    'ENG': 'English',
    'HIST': 'History',
    'GEOG': 'Geography',
    'SOC': 'Sociology',
    'ECON': 'Economics',
    'POLI': 'Political Science',
    'PSYCH': 'Psychology',
    'PHIL': 'Philosophy',
    'LAW': 'Law',
    
    // Business & Management
    'BUS': 'Business',
    'MGMT': 'Management',
    'ACC': 'Accounting',
    'FIN': 'Finance',
    'MARK': 'Marketing',
    'HR': 'Human Resources',
    
    // Healthcare
    'MED': 'Medicine',
    'NURS': 'Nursing',
    'PHARM': 'Pharmacy',
    'DENT': 'Dentistry',
    
    // Agriculture
    'AGR': 'Agriculture',
    'AGBM': 'Agriculture Business Management',
    
    // Education
    'EDU': 'Education',
    'SOCI': 'Education / Sociology'
  };
  
  // Try exact code prefix match
  for (const [prefix, faculty] of Object.entries(codeToFaculty)) {
    if (code.startsWith(prefix)) {
      return faculty;
    }
  }
  
  // Try matching unit name against faculty keywords
  if (name) {
    for (const [prefix, faculty] of Object.entries(codeToFaculty)) {
      if (name.includes(prefix.toUpperCase())) {
        return faculty;
      }
    }
  }
  
  return null;
}

