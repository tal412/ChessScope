// Clustering Analysis for Chess Performance Graph
// Supports both DBSCAN (density-based) and K-means (centroid-based) clustering

// K-means clustering for win/loss/draw pattern analysis
class KMeansCluster {
  constructor(k = 3, maxIterations = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
  }

  fit(nodes, featureWeights = {}) {
    const data = this.extractFeatures(nodes, featureWeights);
    
    if (data.length < this.k) {
      return [];
    }

    // Initialize centroids randomly
    let centroids = this.initializeCentroids(data);
    let clusters = [];
    let converged = false;
    let iteration = 0;

    while (!converged && iteration < this.maxIterations) {
      // Assign points to nearest centroid
      clusters = this.assignPointsToCentroids(data, centroids);
      
      // Update centroids
      const newCentroids = this.updateCentroids(clusters);
      
      // Check for convergence
      converged = this.hasConverged(centroids, newCentroids);
      centroids = newCentroids;
      iteration++;
    }

    return this.formatClusters(clusters);
  }

  extractFeatures(nodes, featureWeights = {}) {
    // For K-means, we focus on win/loss/draw patterns
    const weights = {
      winRate: featureWeights.winRate || 3.0,
      gameCount: featureWeights.gameCount || 3.0,
      depth: featureWeights.depth || 0.1,
      position: 0.6
    };

    return nodes.map(node => {
      const winRate = node.data.winRate || 50;
      const gameCount = node.data.gameCount || 0;
      
      // Calculate win/loss/draw probabilities
      const winProb = winRate / 100;
      const lossProb = (100 - winRate) / 100;
      const drawProb = 0.3; // Approximate draw rate in chess
      
      return {
        nodeId: node.id,
        features: [
          winProb * weights.winRate,                                    // Win probability
          lossProb * weights.winRate,                                   // Loss probability  
          drawProb * weights.winRate,                                   // Draw probability
          Math.log(gameCount + 1) / 10 * weights.gameCount,           // Game count reliability
          (node.data.depth || 0) / 20 * weights.depth,                // Depth
          node.position.x / 2000 * weights.position,                  // Position X
          node.position.y / 2000 * weights.position,                  // Position Y
        ],
        node: node
      };
    });
  }

  initializeCentroids(data) {
    const centroids = [];
    const featureCount = data[0].features.length;
    
    // Use DETERMINISTIC initialization for consistent results
    // Method: K-means++ style initialization but deterministic
    for (let i = 0; i < this.k; i++) {
      const centroid = [];
      for (let j = 0; j < featureCount; j++) {
        const values = data.map(d => d.features[j]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Deterministic initialization: evenly distribute initial centroids
        const ratio = i / Math.max(1, this.k - 1);
        centroid.push(min + ratio * (max - min));
      }
      centroids.push(centroid);
    }
    
    return centroids;
  }

  assignPointsToCentroids(data, centroids) {
    const clusters = Array(this.k).fill().map(() => []);
    
    data.forEach(point => {
      let minDistance = Infinity;
      let assignedCluster = 0;
      
      centroids.forEach((centroid, i) => {
        const distance = this.euclideanDistance(point.features, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          assignedCluster = i;
        }
      });
      
      clusters[assignedCluster].push(point);
    });
    
    return clusters;
  }

  updateCentroids(clusters) {
    return clusters.map(cluster => {
      if (cluster.length === 0) return Array(cluster[0]?.features.length || 7).fill(0);
      
      const featureCount = cluster[0].features.length;
      const centroid = Array(featureCount).fill(0);
      
      cluster.forEach(point => {
        point.features.forEach((feature, i) => {
          centroid[i] += feature;
        });
      });
      
      return centroid.map(sum => sum / cluster.length);
    });
  }

  hasConverged(oldCentroids, newCentroids, threshold = 0.001) {
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.euclideanDistance(oldCentroids[i], newCentroids[i]);
      if (distance > threshold) return false;
    }
    return true;
  }

  euclideanDistance(a, b) {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
  }

  formatClusters(clusters) {
    // Dynamic labels based on k value
    const getClusterLabel = (index, k, avgWinRate) => {
      if (k === 3) {
        return ['Win-Focused', 'Loss-Prone', 'Draw-Heavy'][index] || `Cluster ${index + 1}`;
      } else if (k === 2) {
        return ['Strong', 'Weak'][index] || `Cluster ${index + 1}`;
      } else {
        // For k > 3, use performance-based naming
        if (avgWinRate >= 70) return `Excellence ${index + 1}`;
        if (avgWinRate >= 55) return `Strong ${index + 1}`;
        if (avgWinRate >= 45) return `Average ${index + 1}`;
        return `Weak ${index + 1}`;
      }
    };
    
    return clusters
      .map((cluster, i) => {
        if (cluster.length === 0) return null;
        
        const nodes = cluster.map(c => c.node);
        const stats = this.calculateClusterStats(nodes);
        const label = getClusterLabel(i, this.k, stats.avgWinRate);
        const insights = this.generateInsights(stats, i, label);
        
        const centroidX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length;
        const centroidY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
        
        return {
          id: i,
          type: 'kmeans',
          label: label,
          nodes: nodes,
          centroid: { x: centroidX, y: centroidY },
          stats: stats,
          insights: insights
        };
      })
      .filter(cluster => cluster !== null);
  }

  calculateClusterStats(nodes) {
    const winRates = nodes.map(n => n.data.winRate || 50);
    const gameCounts = nodes.map(n => n.data.gameCount || 0);
    const depths = nodes.map(n => n.data.depth || 0);
    const openings = nodes.map(n => n.data.openingName || 'Unknown');
    
    // Opening family analysis
    const openingFamilies = {};
    openings.forEach(opening => {
      const family = this.extractOpeningFamily(opening);
      openingFamilies[family] = (openingFamilies[family] || 0) + 1;
    });
    
    const topFamily = Object.entries(openingFamilies)
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      count: nodes.length,
      avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
      totalGames: gameCounts.reduce((a, b) => a + b, 0),
      avgDepth: depths.reduce((a, b) => a + b, 0) / depths.length,
      topOpeningFamily: topFamily ? topFamily[0] : 'Mixed',
      familyCount: topFamily ? topFamily[1] : 0,
      openingDiversity: Object.keys(openingFamilies).length
    };
  }

  extractOpeningFamily(openingName) {
    const name = openingName.toLowerCase();
    if (name.includes('sicilian')) return 'Sicilian Defense';
    if (name.includes('french')) return 'French Defense';
    if (name.includes('caro')) return 'Caro-Kann Defense';
    if (name.includes('italian')) return 'Italian Game';
    if (name.includes('spanish') || name.includes('ruy')) return 'Spanish Opening';
    if (name.includes('queen')) return 'Queen\'s Gambit';
    if (name.includes('king')) return 'King\'s Pawn';
    if (name.includes('nimzo') || name.includes('indian')) return 'Indian Defenses';
    if (name.includes('english')) return 'English Opening';
    if (name.includes('catalan')) return 'Catalan Opening';
    return 'Other';
  }

  generateInsights(stats, clusterId, clusterLabel) {
    const insights = [];
    
    // Cluster-specific insights
    insights.push(`🎯 ${clusterLabel}: ${stats.count} positions`);
    
    // Performance-based insights
    if (stats.avgWinRate >= 70) {
      insights.push(`⭐ Strong performance: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    } else if (stats.avgWinRate <= 40) {
      insights.push(`🔴 Needs improvement: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    } else {
      insights.push(`📊 Balanced: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    }
    
    // Opening focus
    insights.push(`🎯 Primary focus: ${stats.topOpeningFamily}`);
    
    return insights;
  }
}

// DBSCAN clustering for density-based analysis
class DBSCANCluster {
  constructor(eps = 0.4, minPts = 2) {
    this.eps = eps;
    this.minPts = minPts;
  }

  fit(nodes, featureWeights = {}) {
    const data = this.extractFeatures(nodes, featureWeights);
    const clusters = [];
    const visited = new Set();
    const clustered = new Set();
    
    data.forEach((point, i) => {
      if (visited.has(i)) return;
      
      visited.add(i);
      const neighbors = this.regionQuery(data, i);
      
      if (neighbors.length < this.minPts) {
        // Mark as noise - these are isolated positions
        return;
      }
      
      // Create new cluster
      const cluster = [];
      this.expandCluster(data, i, neighbors, cluster, visited, clustered);
      
      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    });
    
    return this.formatClusters(clusters);
  }

  extractFeatures(nodes, featureWeights = {}) {
    // Use provided weights or defaults - Updated to match user preferences
    const weights = {
      winRate: featureWeights.winRate || 3.0,     // Higher emphasis on performance
      gameCount: featureWeights.gameCount || 3.0, // Higher emphasis on reliability
      depth: featureWeights.depth || 0.1,         // Lower emphasis on tree position
      position: 0.6 // Position weights are fixed (not adjustable via UI)
    };
    
    return nodes.map(node => ({
      nodeId: node.id,
      features: [
        (node.data.winRate || 50) / 100 * weights.winRate,       // CHESS: Win rate (adjustable weight)
        Math.log(node.data.gameCount + 1) / 10 * weights.gameCount, // CHESS: Game count reliability (adjustable weight)
        (node.data.depth || 0) / 20 * weights.depth,             // CHESS: Depth (adjustable weight)
        node.position.x / 2000 * weights.position,               // CHESS: Tree position X (fixed weight)
        node.position.y / 2000 * weights.position,               // CHESS: Tree position Y (fixed weight)
      ],
      node: node
    }));
  }

  euclideanDistance(a, b) {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
  }

  regionQuery(data, pointIndex) {
    const neighbors = [];
    const point = data[pointIndex];
    
    data.forEach((otherPoint, i) => {
      if (i !== pointIndex && 
          this.euclideanDistance(point.features, otherPoint.features) <= this.eps) {
        neighbors.push(i);
      }
    });
    
    return neighbors;
  }

  expandCluster(data, pointIndex, neighbors, cluster, visited, clustered) {
    cluster.push(data[pointIndex]);
    clustered.add(pointIndex);
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighborIndex = neighbors[i];
      
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex);
        const neighborNeighbors = this.regionQuery(data, neighborIndex);
        
        if (neighborNeighbors.length >= this.minPts) {
          neighbors.push(...neighborNeighbors);
        }
      }
      
      if (!clustered.has(neighborIndex)) {
        cluster.push(data[neighborIndex]);
        clustered.add(neighborIndex);
      }
    }
  }

  formatClusters(clusters) {
    return clusters.map((cluster, i) => {
      const nodes = cluster.map(c => c.node);
      const stats = this.calculateClusterStats(nodes);
      const insights = this.generateInsights(stats, i);
      
      const centroidX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length;
      const centroidY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
      
      return {
        id: i,
        type: 'dbscan',
        nodes: nodes,
        centroid: { x: centroidX, y: centroidY },
        stats: stats,
        insights: insights
      };
    });
  }

  calculateClusterStats(nodes) {
    const winRates = nodes.map(n => n.data.winRate || 50);
    const gameCounts = nodes.map(n => n.data.gameCount || 0);
    const depths = nodes.map(n => n.data.depth || 0);
    const openings = nodes.map(n => n.data.openingName || 'Unknown');
    
    // Opening family analysis
    const openingFamilies = {};
    openings.forEach(opening => {
      const family = this.extractOpeningFamily(opening);
      openingFamilies[family] = (openingFamilies[family] || 0) + 1;
    });
    
    const topFamily = Object.entries(openingFamilies)
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      count: nodes.length,
      avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
      totalGames: gameCounts.reduce((a, b) => a + b, 0),
      avgDepth: depths.reduce((a, b) => a + b, 0) / depths.length,
      density: this.calculateDensity(nodes),
      topOpeningFamily: topFamily ? topFamily[0] : 'Mixed',
      familyCount: topFamily ? topFamily[1] : 0,
      openingDiversity: Object.keys(openingFamilies).length
    };
  }

  calculateDensity(nodes) {
    if (nodes.length < 2) return 0;
    
    // Calculate average pairwise distance
    let totalDistance = 0;
    let pairs = 0;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].position.x - nodes[j].position.x, 2) +
          Math.pow(nodes[i].position.y - nodes[j].position.y, 2)
        );
        totalDistance += dist;
        pairs++;
      }
    }
    
    return pairs > 0 ? 1000 / (totalDistance / pairs) : 0; // Inverse of average distance
  }

  extractOpeningFamily(openingName) {
    const name = openingName.toLowerCase();
    if (name.includes('sicilian')) return 'Sicilian Defense';
    if (name.includes('french')) return 'French Defense';
    if (name.includes('caro')) return 'Caro-Kann Defense';
    if (name.includes('italian')) return 'Italian Game';
    if (name.includes('spanish') || name.includes('ruy')) return 'Spanish Opening';
    if (name.includes('queen')) return 'Queen\'s Gambit';
    if (name.includes('king')) return 'King\'s Pawn';
    if (name.includes('nimzo') || name.includes('indian')) return 'Indian Defenses';
    if (name.includes('english')) return 'English Opening';
    if (name.includes('catalan')) return 'Catalan Opening';
    return 'Other';
  }

  generateInsights(stats, clusterId) {
    const insights = [];
    
    // Density-based insights
    if (stats.density > 0.8) {
      insights.push(`🎯 Tight cluster: ${stats.count} closely related positions`);
    } else if (stats.density > 0.4) {
      insights.push(`🌐 Moderate cluster: ${stats.count} related positions`);
    } else {
      insights.push(`🔍 Loose cluster: ${stats.count} scattered positions`);
    }
    
    // Performance-based insights
    if (stats.avgWinRate >= 70) {
      insights.push(`⭐ Excellence zone: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    } else if (stats.avgWinRate <= 40) {
      insights.push(`🔴 Focus area: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    } else if (stats.avgWinRate >= 55) {
      insights.push(`💪 Strong area: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    } else {
      insights.push(`📊 Balanced area: ${stats.avgWinRate.toFixed(1)}% avg win rate`);
    }
    
    // Opening diversity insight
    if (stats.openingDiversity > 3) {
      insights.push(`🎭 Diverse openings: ${stats.openingDiversity} different families`);
    } else {
      insights.push(`🎯 Focused on: ${stats.topOpeningFamily}`);
    }
    
    return insights;
  }
}

// Main clustering analysis function - SUPPORTS BOTH DBSCAN AND K-MEANS
export function performClusterAnalysis(nodes, options = {}) {
  const {
    enabled = true,
    method = 'dbscan',  // 'dbscan' or 'kmeans'
    eps = 0.35,       // CHESS-OPTIMIZED: Tighter clustering for more precise patterns
    minPts = 2,       // CHESS-OPTIMIZED: Even pairs are meaningful (main line + variation)
    minNodesForClustering = 12,  // CHESS-OPTIMIZED: More nodes for better statistical reliability
    k = 3,            // Number of clusters for K-means
    featureWeights = {}  // Feature weights for customization
  } = options;
  
  // If clustering is disabled, return empty result
  if (!enabled) {
    return {
      clusters: [],
      insights: ['Clustering disabled'],
      metadata: {
        totalNodes: nodes.length,
        clusterCount: 0,
        method: 'none',
        enabled: false
      }
    };
  }
  
  // Filter out nodes without sufficient data
  const validNodes = nodes.filter(node => 
    node.data && 
    node.position && 
    !isNaN(node.position.x) && 
    !isNaN(node.position.y) &&
    (node.data.gameCount || 0) > 0
  );
  
  const minNodes = method === 'kmeans' ? k : minNodesForClustering;
  if (validNodes.length < minNodes) {
    return {
      clusters: [],
      insights: [`Need at least ${minNodes} positions for ${method.toUpperCase()} clustering. Currently have ${validNodes.length}.`],
      metadata: {
        totalNodes: validNodes.length,
        clusterCount: 0,
        method: method,
        enabled: true
      }
    };
  }

  let clusters;
  let methodInsights;

  if (method === 'kmeans') {
    // Perform K-means clustering with specified k value
    const kmeans = new KMeansCluster(k);
    clusters = kmeans.fit(validNodes, featureWeights);
    methodInsights = generateKMeansInsights(clusters, validNodes.length, k);
  } else {
  // Perform DBSCAN clustering
  const dbscan = new DBSCANCluster(eps, minPts);
    clusters = dbscan.fit(validNodes, featureWeights);
    methodInsights = generateDBSCANInsights(clusters, validNodes.length);
  }
  
  return {
    clusters,
    insights: methodInsights,
    metadata: {
      totalNodes: validNodes.length,
      clusterCount: clusters.length,
      method: method,
      enabled: true,
      parameters: method === 'dbscan' ? { eps, minPts } : { k: k }
    }
  };
}

function generateDBSCANInsights(clusters, totalNodes) {
  const insights = [];
  
  if (clusters.length === 0) {
    insights.push('🔍 No dense clusters found - positions are well-distributed');
    insights.push('This suggests a balanced repertoire without obvious performance hotspots');
    return insights;
  }
  
  insights.push(`🌐 DBSCAN Analysis: ${clusters.length} density-based patterns discovered`);
  
  const excellentClusters = clusters.filter(c => c.stats.avgWinRate >= 70).length;
  const challengingClusters = clusters.filter(c => c.stats.avgWinRate <= 45).length;
  const clusteredNodes = clusters.reduce((sum, c) => sum + c.stats.count, 0);
  const noiseNodes = totalNodes - clusteredNodes;
  
  if (excellentClusters > 0) {
    insights.push(`⭐ ${excellentClusters} excellence zone${excellentClusters > 1 ? 's' : ''} identified`);
  }
  
  if (challengingClusters > 0) {
    insights.push(`🔴 ${challengingClusters} focus area${challengingClusters > 1 ? 's' : ''} need attention`);
  }
  
  if (noiseNodes > 0) {
    const noisePercent = ((noiseNodes / totalNodes) * 100).toFixed(0);
    insights.push(`🔍 ${noisePercent}% positions are unique/experimental lines`);
  }
  
  // Find the largest cluster
  if (clusters.length > 0) {
    const largestCluster = clusters.reduce((max, cluster) => 
      cluster.stats.count > max.stats.count ? cluster : max
    );
    insights.push(`🎯 Main pattern: ${largestCluster.stats.topOpeningFamily} (${largestCluster.stats.count} positions)`);
  }
  
  return insights;
}

function generateKMeansInsights(clusters, totalNodes, k = 3) {
  const insights = [];
  
  if (clusters.length === 0) {
    insights.push('🔍 K-means clustering failed - insufficient data variation');
    insights.push('Try using DBSCAN for density-based pattern discovery');
    return insights;
  }
  
  insights.push(`🎯 K-means Analysis: ${clusters.length} performance-based groups identified`);
  
  // Analyze each cluster type
  clusters.forEach(cluster => {
    const winRate = cluster.stats.avgWinRate;
    const count = cluster.stats.count;
    const label = cluster.label;
    
    if (label === 'Win-Focused' && winRate >= 60) {
      insights.push(`⭐ ${label}: ${count} strong positions (${winRate.toFixed(1)}% avg)`);
    } else if (label === 'Loss-Prone' && winRate <= 45) {
      insights.push(`🔴 ${label}: ${count} challenging positions (${winRate.toFixed(1)}% avg)`);
    } else if (label === 'Draw-Heavy') {
      insights.push(`⚖️ ${label}: ${count} balanced positions (${winRate.toFixed(1)}% avg)`);
    } else {
      insights.push(`📊 ${label}: ${count} positions (${winRate.toFixed(1)}% avg)`);
    }
  });
  
  // Find dominant pattern
  const sortedClusters = clusters.sort((a, b) => b.stats.count - a.stats.count);
  if (sortedClusters.length > 0) {
    const dominant = sortedClusters[0];
    insights.push(`🎯 Dominant pattern: ${dominant.label} (${dominant.stats.count} positions)`);
  }
  
  // Performance distribution insight
  const winFocused = clusters.find(c => c.label === 'Win-Focused');
  const lossProne = clusters.find(c => c.label === 'Loss-Prone');
  
  if (winFocused && lossProne) {
    const ratio = winFocused.stats.count / lossProne.stats.count;
    if (ratio > 2) {
      insights.push(`💪 Strength-focused repertoire: ${ratio.toFixed(1)}x more strong positions`);
    } else if (ratio < 0.5) {
      insights.push(`⚠️ Challenge-heavy repertoire: needs strategic review`);
    } else {
      insights.push(`⚖️ Balanced repertoire: good mix of strong and challenging areas`);
    }
  }
  
  return insights;
}

// Export the clustering classes for direct use if needed
export { DBSCANCluster, KMeansCluster };

// Entropy-based K optimization - FEATURE-WEIGHTED OPTIMIZATION
export function optimizeKUsingEntropy(nodes, maxK = 15, featureWeights = {}) {
  if (nodes.length < 4) {
    return { optimalK: 2, entropies: [], silhouetteScores: [], message: 'Not enough nodes for optimization' };
  }

  // Normalize feature weights and calculate their total importance
  const weights = {
    winRate: featureWeights.winRate || 3.0,
    gameCount: featureWeights.gameCount || 3.0,
    depth: featureWeights.depth || 0.1
  };
  
  const totalWeight = weights.winRate + weights.gameCount + weights.depth;
  const normalizedWeights = {
    winRate: weights.winRate / totalWeight,
    gameCount: weights.gameCount / totalWeight,
    depth: weights.depth / totalWeight
  };

  console.log('🎯 K-optimization using feature weights:', normalizedWeights);

  const entropies = [];
  const silhouetteScores = [];
  const results = [];

  // Test different k values with DETERMINISTIC results
  for (let k = 2; k <= Math.min(maxK, Math.floor(nodes.length / 2)); k++) {
    try {
      // Run multiple attempts and pick the best one for CONSISTENT results
      let bestAttempt = null;
      let bestScore = -Infinity;
      
      // Run 3 attempts with different deterministic initializations
      for (let attempt = 0; attempt < 3; attempt++) {
        const kmeans = new KMeansCluster(k);
        
        // Override initialization for deterministic seeding
        const originalInit = kmeans.initializeCentroids;
        kmeans.initializeCentroids = function(data) {
          const centroids = [];
          const featureCount = data[0].features.length;
          
          for (let i = 0; i < this.k; i++) {
            const centroid = [];
            for (let j = 0; j < featureCount; j++) {
              const values = data.map(d => d.features[j]);
              const min = Math.min(...values);
              const max = Math.max(...values);
              
              // Different deterministic seeds for each attempt
              const ratio = (i + attempt * 0.33) / Math.max(1, this.k - 1 + attempt * 0.33);
              centroid.push(min + (ratio % 1) * (max - min));
            }
            centroids.push(centroid);
          }
          return centroids;
        };
        
        const clusters = kmeans.fit(nodes, featureWeights);
        if (clusters.length === 0) continue;

        // Calculate metrics for this attempt
        const entropy = calculateWeightedClusteringEntropy(clusters, nodes.length, normalizedWeights);
        const silhouetteScore = calculateWeightedSilhouetteScore(clusters, nodes, featureWeights, normalizedWeights);
        const featureImportanceScore = calculateFeatureImportanceScore(clusters, normalizedWeights);
        const combinedScore = (silhouetteScore * 0.4) + (featureImportanceScore * 0.4) - (entropy * 0.2);
        
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestAttempt = {
            entropy,
            silhouetteScore,
            featureImportanceScore,
            clusters,
            combinedScore
          };
        }
      }
      
      if (!bestAttempt) continue;

      entropies.push({ k, entropy: bestAttempt.entropy });
      silhouetteScores.push({ k, score: bestAttempt.silhouetteScore });
      
      results.push({
        k,
        entropy: bestAttempt.entropy,
        silhouetteScore: bestAttempt.silhouetteScore,
        featureImportanceScore: bestAttempt.featureImportanceScore,
        clusters: bestAttempt.clusters,
        combinedScore: bestAttempt.combinedScore
      });
      
    } catch (error) {
      console.warn(`Error testing k=${k}:`, error);
    }
  }

  if (results.length === 0) {
    return { optimalK: 3, entropies: [], silhouetteScores: [], message: 'No valid clustering found' };
  }

  // Find optimal k based on feature-weighted combined score
  const bestResult = results.reduce((best, current) => 
    current.combinedScore > best.combinedScore ? current : best
  );

  return {
    optimalK: bestResult.k,
    entropies,
    silhouetteScores,
    allResults: results,
    bestResult,
    featureWeights: normalizedWeights,
    message: `Optimal k=${bestResult.k} found with weighted entropy=${bestResult.entropy.toFixed(3)}, silhouette=${bestResult.silhouetteScore.toFixed(3)}, and feature importance=${bestResult.featureImportanceScore.toFixed(3)}`
  };
}

// Calculate entropy of clustering - measures information content/organization
function calculateClusteringEntropy(clusters, totalNodes) {
  if (clusters.length === 0 || totalNodes === 0) return 0;

  let entropy = 0;
  
  clusters.forEach(cluster => {
    if (cluster.nodes && cluster.nodes.length > 0) {
      const probability = cluster.nodes.length / totalNodes;
      
      // Calculate performance distribution entropy within cluster
      const winRates = cluster.nodes.map(n => n.data.winRate || 50);
      const performanceEntropy = calculatePerformanceEntropy(winRates);
      
      // Combine cluster size entropy with performance entropy
      const clusterEntropy = -probability * Math.log2(probability) + performanceEntropy * probability;
      entropy += clusterEntropy;
    }
  });

  return entropy;
}

// Calculate WEIGHTED entropy of clustering - considers feature importance
function calculateWeightedClusteringEntropy(clusters, totalNodes, normalizedWeights) {
  if (clusters.length === 0 || totalNodes === 0) return 0;

  let entropy = 0;
  
  clusters.forEach(cluster => {
    if (cluster.nodes && cluster.nodes.length > 0) {
      const probability = cluster.nodes.length / totalNodes;
      
      // Calculate weighted feature entropies within cluster
      const winRates = cluster.nodes.map(n => n.data.winRate || 50);
      const gameCounts = cluster.nodes.map(n => n.data.gameCount || 0);
      const depths = cluster.nodes.map(n => n.data.depth || 0);
      
      const winRateEntropy = calculatePerformanceEntropy(winRates);
      const gameCountEntropy = calculateGameCountEntropy(gameCounts);
      const depthEntropy = calculateDepthEntropy(depths);
      
      // Weight the entropies by feature importance
      const weightedFeatureEntropy = (
        winRateEntropy * normalizedWeights.winRate +
        gameCountEntropy * normalizedWeights.gameCount +
        depthEntropy * normalizedWeights.depth
      );
      
      // Combine cluster size entropy with weighted feature entropy
      const clusterEntropy = -probability * Math.log2(probability) + weightedFeatureEntropy * probability;
      entropy += clusterEntropy;
    }
  });

  return entropy;
}

// Calculate entropy within performance values
function calculatePerformanceEntropy(winRates) {
  if (winRates.length === 0) return 0;

  // Discretize win rates into bins for entropy calculation
  const bins = { excellent: 0, good: 0, average: 0, poor: 0 };
  
  winRates.forEach(rate => {
    if (rate >= 70) bins.excellent++;
    else if (rate >= 55) bins.good++;
    else if (rate >= 45) bins.average++;
    else bins.poor++;
  });

  const total = winRates.length;
  let entropy = 0;

  Object.values(bins).forEach(count => {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  });

  return entropy;
}

// Calculate entropy within game count values
function calculateGameCountEntropy(gameCounts) {
  if (gameCounts.length === 0) return 0;

  // Discretize game counts into reliability bins
  const bins = { high: 0, medium: 0, low: 0, minimal: 0 };
  
  gameCounts.forEach(count => {
    if (count >= 50) bins.high++;
    else if (count >= 20) bins.medium++;
    else if (count >= 5) bins.low++;
    else bins.minimal++;
  });

  const total = gameCounts.length;
  let entropy = 0;

  Object.values(bins).forEach(count => {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  });

  return entropy;
}

// Calculate entropy within depth values
function calculateDepthEntropy(depths) {
  if (depths.length === 0) return 0;

  // Discretize depths into bins
  const bins = { deep: 0, medium: 0, shallow: 0, opening: 0 };
  
  depths.forEach(depth => {
    if (depth >= 15) bins.deep++;
    else if (depth >= 8) bins.medium++;
    else if (depth >= 4) bins.shallow++;
    else bins.opening++;
  });

  const total = depths.length;
  let entropy = 0;

  Object.values(bins).forEach(count => {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  });

  return entropy;
}

// Calculate silhouette score for clustering quality
function calculateSilhouetteScore(clusters, allNodes, featureWeights = {}) {
  if (clusters.length < 2) return 0;

  // Extract features for all nodes
  const kmeans = new KMeansCluster(clusters.length);
  const nodeFeatures = kmeans.extractFeatures(allNodes, featureWeights);
  
  // Create mapping from node ID to features
  const featureMap = {};
  nodeFeatures.forEach(nf => {
    featureMap[nf.nodeId] = nf.features;
  });

  let totalSilhouette = 0;
  let validNodes = 0;

  clusters.forEach(cluster => {
    if (!cluster.nodes || cluster.nodes.length === 0) return;

    cluster.nodes.forEach(node => {
      const nodeFeatures = featureMap[node.id];
      if (!nodeFeatures) return;

      // Calculate average distance to other nodes in same cluster (a)
      let intraClusterDistance = 0;
      let intraCount = 0;
      
      cluster.nodes.forEach(otherNode => {
        if (otherNode.id !== node.id) {
          const otherFeatures = featureMap[otherNode.id];
          if (otherFeatures) {
            intraClusterDistance += euclideanDistance(nodeFeatures, otherFeatures);
            intraCount++;
          }
        }
      });
      
      const a = intraCount > 0 ? intraClusterDistance / intraCount : 0;

      // Calculate minimum average distance to nodes in other clusters (b)
      let minInterClusterDistance = Infinity;
      
      clusters.forEach(otherCluster => {
        if (otherCluster === cluster || !otherCluster.nodes) return;

        let interClusterDistance = 0;
        let interCount = 0;

        otherCluster.nodes.forEach(otherNode => {
          const otherFeatures = featureMap[otherNode.id];
          if (otherFeatures) {
            interClusterDistance += euclideanDistance(nodeFeatures, otherFeatures);
            interCount++;
          }
        });

        if (interCount > 0) {
          const avgDistance = interClusterDistance / interCount;
          minInterClusterDistance = Math.min(minInterClusterDistance, avgDistance);
        }
      });

      const b = minInterClusterDistance;

      // Calculate silhouette for this node
      if (Math.max(a, b) > 0) {
        const silhouette = (b - a) / Math.max(a, b);
        totalSilhouette += silhouette;
        validNodes++;
      }
    });
  });

  return validNodes > 0 ? totalSilhouette / validNodes : 0;
}

// Calculate WEIGHTED silhouette score for clustering quality
function calculateWeightedSilhouetteScore(clusters, allNodes, featureWeights, normalizedWeights) {
  if (clusters.length < 2) return 0;

  // Extract features for all nodes with proper weighting
  const kmeans = new KMeansCluster(clusters.length);
  const nodeFeatures = kmeans.extractFeatures(allNodes, featureWeights);
  
  // Create mapping from node ID to features
  const featureMap = {};
  nodeFeatures.forEach(nf => {
    featureMap[nf.nodeId] = nf.features;
  });

  let totalWeightedSilhouette = 0;
  let validNodes = 0;

  clusters.forEach(cluster => {
    if (!cluster.nodes || cluster.nodes.length === 0) return;

    cluster.nodes.forEach(node => {
      const nodeFeatures = featureMap[node.id];
      if (!nodeFeatures) return;

      // Calculate weighted average distance to other nodes in same cluster (a)
      let intraClusterDistance = 0;
      let intraCount = 0;
      
      cluster.nodes.forEach(otherNode => {
        if (otherNode.id !== node.id) {
          const otherFeatures = featureMap[otherNode.id];
          if (otherFeatures) {
            intraClusterDistance += weightedEuclideanDistance(nodeFeatures, otherFeatures, normalizedWeights);
            intraCount++;
          }
        }
      });
      
      const a = intraCount > 0 ? intraClusterDistance / intraCount : 0;

      // Calculate minimum weighted average distance to nodes in other clusters (b)
      let minInterClusterDistance = Infinity;
      
      clusters.forEach(otherCluster => {
        if (otherCluster === cluster || !otherCluster.nodes) return;

        let interClusterDistance = 0;
        let interCount = 0;

        otherCluster.nodes.forEach(otherNode => {
          const otherFeatures = featureMap[otherNode.id];
          if (otherFeatures) {
            interClusterDistance += weightedEuclideanDistance(nodeFeatures, otherFeatures, normalizedWeights);
            interCount++;
          }
        });

        if (interCount > 0) {
          const avgDistance = interClusterDistance / interCount;
          minInterClusterDistance = Math.min(minInterClusterDistance, avgDistance);
        }
      });

      const b = minInterClusterDistance;

      // Calculate weighted silhouette for this node
      if (Math.max(a, b) > 0) {
        const silhouette = (b - a) / Math.max(a, b);
        
        // Weight silhouette by node importance (based on game count and win rate)
        const nodeImportance = calculateNodeImportance(node, normalizedWeights);
        totalWeightedSilhouette += silhouette * nodeImportance;
        validNodes++;
      }
    });
  });

  return validNodes > 0 ? totalWeightedSilhouette / validNodes : 0;
}

// Calculate feature importance score for clustering
function calculateFeatureImportanceScore(clusters, normalizedWeights) {
  if (clusters.length === 0) return 0;

  let totalScore = 0;
  let totalNodes = 0;

  clusters.forEach(cluster => {
    if (!cluster.nodes || cluster.nodes.length === 0) return;

    // Calculate feature variance within cluster (lower is better for important features)
    const winRates = cluster.nodes.map(n => n.data.winRate || 50);
    const gameCounts = cluster.nodes.map(n => n.data.gameCount || 0);
    const depths = cluster.nodes.map(n => n.data.depth || 0);

    const winRateVariance = calculateVariance(winRates);
    const gameCountVariance = calculateVariance(gameCounts);
    const depthVariance = calculateVariance(depths);

    // Normalize variances and invert (lower variance = better clustering for important features)
    const maxWinRateVar = 625; // (50% variation)^2
    const maxGameCountVar = 10000; // (100 games variation)^2
    const maxDepthVar = 225; // (15 moves variation)^2

    const normalizedWinRateScore = Math.max(0, 1 - (winRateVariance / maxWinRateVar));
    const normalizedGameCountScore = Math.max(0, 1 - (gameCountVariance / maxGameCountVar));
    const normalizedDepthScore = Math.max(0, 1 - (depthVariance / maxDepthVar));

    // Weight by feature importance
    const clusterScore = (
      normalizedWinRateScore * normalizedWeights.winRate +
      normalizedGameCountScore * normalizedWeights.gameCount +
      normalizedDepthScore * normalizedWeights.depth
    );

    totalScore += clusterScore * cluster.nodes.length;
    totalNodes += cluster.nodes.length;
  });

  return totalNodes > 0 ? totalScore / totalNodes : 0;
}

// Helper functions
function weightedEuclideanDistance(a, b, weights) {
  // Apply weights to the distance calculation
  // Assume first 3 features are winRate, lossRate, drawRate (weighted by winRate weight)
  // Next feature is game count reliability (weighted by gameCount weight)
  // Next feature is depth (weighted by depth weight)
  // Last 2 features are position coordinates (weighted equally)
  
  const weightedDiffs = [
    Math.pow(a[0] - b[0], 2) * weights.winRate,    // win probability
    Math.pow(a[1] - b[1], 2) * weights.winRate,    // loss probability
    Math.pow(a[2] - b[2], 2) * weights.winRate,    // draw probability
    Math.pow(a[3] - b[3], 2) * weights.gameCount,  // game count reliability
    Math.pow(a[4] - b[4], 2) * weights.depth,      // depth
    Math.pow(a[5] - b[5], 2) * 0.3,                // position x
    Math.pow(a[6] - b[6], 2) * 0.3                 // position y
  ];
  
  return Math.sqrt(weightedDiffs.reduce((sum, diff) => sum + diff, 0));
}

function calculateNodeImportance(node, normalizedWeights) {
  const winRate = node.data.winRate || 50;
  const gameCount = node.data.gameCount || 0;
  const depth = node.data.depth || 0;

  // Normalize importance factors
  const winRateImportance = Math.abs(winRate - 50) / 50; // How far from average
  const gameCountImportance = Math.min(gameCount / 100, 1); // Reliability factor
  const depthImportance = Math.min(depth / 20, 1); // Depth factor

  return (
    winRateImportance * normalizedWeights.winRate +
    gameCountImportance * normalizedWeights.gameCount +
    depthImportance * normalizedWeights.depth
  );
}

function calculateVariance(values) {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return variance;
}

// Helper function for euclidean distance
function euclideanDistance(a, b) {
  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
  );
} 