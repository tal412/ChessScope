// Utility to analyze and find redundant opening names
import { searchOpeningsByName } from '../components/chess/OpeningDatabase.jsx';

/**
 * Find potential redundancies in opening names
 * @param {Array} openingNames - Array of opening names from the user's data
 * @returns {Object} Analysis of redundancies and suggestions
 */
export function analyzeOpeningRedundancies(openingNames) {
  const analysis = {
    redundancies: [],
    suggestions: [],
    summary: {}
  };

  // Group similar opening names
  const groups = new Map();
  
  openingNames.forEach(name => {
    if (!name || name === 'Unknown Opening') return;
    
    // Extract base opening name (first part before colon or comma)
    const baseName = name.split(':')[0].split(',')[0].trim();
    
    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName).push(name);
  });

  // Find potential redundancies
  groups.forEach((variations, baseName) => {
    if (variations.length > 1) {
      // Check for obvious redundancies
      const uniqueVariations = [...new Set(variations)];
      
      if (uniqueVariations.length !== variations.length) {
        analysis.redundancies.push({
          baseName,
          duplicates: variations.filter((item, index) => variations.indexOf(item) !== index),
          allVariations: uniqueVariations
        });
      }
      
      // Check for potential normalization issues
      const shortNames = uniqueVariations.filter(name => name === baseName);
      const longNames = uniqueVariations.filter(name => name !== baseName && name.startsWith(baseName));
      
      if (shortNames.length > 0 && longNames.length > 0) {
        analysis.suggestions.push({
          issue: 'Potential normalization conflict',
          baseName,
          shortForm: shortNames,
          longForm: longNames,
          recommendation: `Consider if "${baseName}" and variations should be grouped or kept separate`
        });
      }
    }
  });

  // Look for Vienna-specific issues
  const viennaNames = openingNames.filter(name => 
    name && name.toLowerCase().includes('vienna')
  );
  
  if (viennaNames.length > 0) {
    analysis.vienna = {
      allViennaOpenings: [...new Set(viennaNames)].sort(),
      count: viennaNames.length,
      uniqueCount: new Set(viennaNames).size
    };
  }

  analysis.summary = {
    totalOpenings: openingNames.length,
    uniqueOpenings: new Set(openingNames.filter(n => n && n !== 'Unknown Opening')).size,
    redundanciesFound: analysis.redundancies.length,
    suggestionsCount: analysis.suggestions.length
  };

  return analysis;
}

/**
 * Find all Vienna-related openings in the Lichess database
 * @returns {Array} All Vienna openings from Lichess database
 */
export async function getViennaOpeningsFromLichess() {
  try {
    const viennaResults = await searchOpeningsByName('vienna');
    return viennaResults.map(result => ({
      name: result.name,
      eco: result.eco,
      moves: result.pgn || result.moves
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error searching Vienna openings:', error);
    return [];
  }
}

/**
 * Suggest opening name standardization
 * @param {Array} openingNames - Array of opening names
 * @returns {Object} Standardization suggestions
 */
export function suggestOpeningStandardization(openingNames) {
  const suggestions = {
    standardizations: [],
    conflicts: []
  };

  // Group by base names
  const baseGroups = new Map();
  
  openingNames.forEach(name => {
    if (!name || name === 'Unknown Opening') return;
    
    // Extract potential base names
    const parts = name.split(':');
    const baseName = parts[0].trim();
    
    if (!baseGroups.has(baseName)) {
      baseGroups.set(baseName, new Set());
    }
    baseGroups.get(baseName).add(name);
  });

  // Analyze each group
  baseGroups.forEach((variations, baseName) => {
    const variationsArray = Array.from(variations);
    
    if (variationsArray.length > 1) {
      // Check if we have both short and long forms
      const hasShortForm = variationsArray.includes(baseName);
      const hasLongForms = variationsArray.some(v => v !== baseName);
      
      if (hasShortForm && hasLongForms) {
        suggestions.conflicts.push({
          baseName,
          shortForm: baseName,
          longForms: variationsArray.filter(v => v !== baseName),
          recommendation: `Decide whether to use "${baseName}" or specific variations`
        });
      } else {
        suggestions.standardizations.push({
          baseName,
          variations: variationsArray,
          recommendation: `Consider standardizing to most specific form`
        });
      }
    }
  });

  return suggestions;
}

/**
 * Debug function to log opening analysis
 * @param {Array} openingNames - Array of opening names from user's data
 */
export function debugOpeningNames(openingNames) {
  console.group('🔍 Opening Names Analysis');
  
  const analysis = analyzeOpeningRedundancies(openingNames);
  
  console.log('📊 Summary:', analysis.summary);
  
  if (analysis.vienna) {
    console.log('🏰 Vienna Openings Found:', analysis.vienna);
  }
  
  if (analysis.redundancies.length > 0) {
    console.log('🔄 Redundancies:', analysis.redundancies);
  }
  
  if (analysis.suggestions.length > 0) {
    console.log('💡 Suggestions:', analysis.suggestions);
  }
  
  const standardization = suggestOpeningStandardization(openingNames);
  if (standardization.conflicts.length > 0) {
    console.log('⚠️ Conflicts:', standardization.conflicts);
  }
  
  console.groupEnd();
  
  return analysis;
} 