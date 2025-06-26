#!/usr/bin/env node

/**
 * Script to download and process the Lichess chess-openings database
 * 
 * This script:
 * 1. Downloads the TSV files from the Lichess chess-openings repository
 * 2. Parses them into a unified JSON format
 * 3. Uses chess.js to generate proper EPD positions from PGN moves
 * 4. Saves the result to public/data/lichess-openings.json
 * 
 * Usage: node scripts/update-openings-db.js
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to import chess.js
let Chess;
try {
  const chessModule = await import('chess.js');
  Chess = chessModule.Chess;
} catch (error) {
  console.error('❌ chess.js not found. Please install it with: npm install chess.js');
  process.exit(1);
}

// Base URL for the Lichess chess-openings repository
const LICHESS_REPO_BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

// TSV files to download
const TSV_FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];

// Output file path
const OUTPUT_FILE = path.join(__dirname, '../public/data/lichess-openings.json');

/**
 * Download a file from a URL
 */
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Generate EPD (FEN without move numbers) from PGN moves using chess.js
 */
function generateEpdFromPgn(pgn) {
  try {
    const chess = new Chess();
    
    // Parse PGN moves - handle different formats
    let moves = [];
    
    // Remove move numbers and extra whitespace
    const cleanPgn = pgn.replace(/\d+\./g, '').trim();
    
    // Split by spaces and filter out empty strings
    const parts = cleanPgn.split(/\s+/).filter(part => part.length > 0);
    
    for (const part of parts) {
      // Skip annotations and comments
      if (part.includes('(') || part.includes('{') || part.includes('$')) {
        continue;
      }
      
      // Clean up move notation
      const cleanMove = part.replace(/[?!+#]+$/, ''); // Remove annotations
      
      if (cleanMove.length > 0) {
        moves.push(cleanMove);
      }
    }
    
    // Play the moves
    for (const move of moves) {
      try {
        const result = chess.move(move);
        if (!result) {
          console.warn(`Invalid move: ${move} in PGN: ${pgn}`);
          break;
        }
      } catch (error) {
        console.warn(`Error playing move ${move} in PGN: ${pgn}`, error.message);
        break;
      }
    }
    
    // Get FEN and convert to EPD (remove halfmove and fullmove counters)
    const fen = chess.fen();
    const fenParts = fen.split(' ');
    
    if (fenParts.length >= 4) {
      return fenParts.slice(0, 4).join(' ');
    }
    
    return fen;
    
  } catch (error) {
    console.warn(`Failed to generate EPD from PGN: ${pgn}`, error.message);
    // Return starting position as fallback
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  }
}

/**
 * Parse TSV content into opening objects
 */
function parseTsv(tsvContent) {
  const lines = tsvContent.trim().split('\n');
  const openings = [];
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.startsWith('#')) continue;
    
    // Split by tabs
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    
    const [eco, name, pgn, uci, epd] = parts;
    
    // Skip if missing essential data
    if (!eco || !name || !pgn) continue;
    
    // Generate EPD from PGN if not provided, otherwise use provided EPD
    let finalEpd = epd && epd.trim() ? epd.trim() : generateEpdFromPgn(pgn.trim());
    
    // Create opening object
    const opening = {
      eco: eco.trim(),
      name: name.trim(),
      pgn: pgn.trim(),
      epd: finalEpd
    };
    
    // Add UCI if available
    if (uci && uci.trim()) {
      opening.uci = uci.trim();
    }
    
    openings.push(opening);
  }
  
  return openings;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Lichess chess-openings database update...');
  
  const allOpenings = [];
  
  // Download and parse each TSV file
  for (const filename of TSV_FILES) {
    const url = LICHESS_REPO_BASE + filename;
    console.log(`📥 Downloading ${filename}...`);
    
    try {
      const tsvContent = await downloadFile(url);
      const openings = parseTsv(tsvContent);
      allOpenings.push(...openings);
      console.log(`✅ Parsed ${openings.length} openings from ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to download ${filename}:`, error.message);
    }
  }
  
  console.log(`📊 Total openings collected: ${allOpenings.length}`);
  
  // Remove duplicates based on EPD
  const uniqueOpenings = [];
  const seenEpds = new Set();
  
  for (const opening of allOpenings) {
    if (!seenEpds.has(opening.epd)) {
      seenEpds.add(opening.epd);
      uniqueOpenings.push(opening);
    }
  }
  
  console.log(`🔄 Removed ${allOpenings.length - uniqueOpenings.length} duplicates`);
  
  // Sort by ECO code for consistency
  uniqueOpenings.sort((a, b) => {
    if (a.eco !== b.eco) return a.eco.localeCompare(b.eco);
    return a.name.localeCompare(b.name);
  });
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Write to JSON file
  console.log(`💾 Writing to ${OUTPUT_FILE}...`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(uniqueOpenings, null, 2));
  
  console.log('✨ Lichess chess-openings database updated successfully!');
  console.log(`📈 Database contains ${uniqueOpenings.length} unique openings`);
  
  // Show some statistics
  const ecoStats = {};
  uniqueOpenings.forEach(opening => {
    const ecoGroup = opening.eco.charAt(0);
    ecoStats[ecoGroup] = (ecoStats[ecoGroup] || 0) + 1;
  });
  
  console.log('📊 ECO distribution:');
  Object.entries(ecoStats).sort().forEach(([group, count]) => {
    console.log(`   ${group}: ${count} openings`);
  });
  
  // Show some sample openings
  console.log('\n📝 Sample openings:');
  uniqueOpenings.slice(0, 5).forEach(opening => {
    console.log(`   ${opening.eco}: ${opening.name} - ${opening.pgn}`);
  });
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
}); 