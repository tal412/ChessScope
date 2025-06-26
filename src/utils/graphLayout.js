import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

// Chess-specific force-directed layout with performance optimizations
export class ChessGraphLayout {
  constructor(width = 1000, height = 800) {
    this.width = width;
    this.height = height;
    this.simulation = null;
  }

  // Create optimized layout for chess opening graph
  calculateLayout(nodes, edges, options = {}) {
    const {
      centerForce = 0.3,
      linkStrength = 0.1,
      chargeStrength = -300,
      collisionRadius = 60,
      maxIterations = 300,
      alphaDecay = 0.02,
      velocityDecay = 0.4
    } = options;

    // Create copies to avoid mutating original data
    const nodesCopy = nodes.map(node => ({
      ...node,
      x: node.position?.x || Math.random() * this.width,
      y: node.position?.y || Math.random() * this.height,
      vx: 0,
      vy: 0,
      fx: node.data?.isRoot ? this.width / 2 : null, // Fix root node at center
      fy: node.data?.isRoot ? this.height / 2 : null
    }));

    const edgesCopy = edges.map(edge => ({
      ...edge,
      source: edge.source,
      target: edge.target
    }));

    // Create simulation with chess-specific forces
    this.simulation = forceSimulation(nodesCopy)
      .force('link', forceLink(edgesCopy)
        .id(d => d.id)
        .strength(linkStrength)
        .distance(d => {
          // Vary distance based on game count and performance
          const gameCount = d.data?.gameCount || 1;
          const winRate = d.data?.winRate || 50;
          const baseDistance = 100;
          const gameMultiplier = Math.log(gameCount + 1) * 10;
          const performanceMultiplier = (winRate > 60) ? 0.8 : (winRate < 40) ? 1.2 : 1;
          return baseDistance + gameMultiplier * performanceMultiplier;
        })
      )
      .force('charge', forceManyBody()
        .strength(d => {
          // Stronger repulsion for nodes with more games
          const gameCount = d.data?.gameCount || 1;
          const depth = d.data?.depth || 0;
          return chargeStrength * (1 + Math.log(gameCount + 1) * 0.1) * (1 + depth * 0.1);
        })
      )
      .force('center', forceCenter(this.width / 2, this.height / 2).strength(centerForce))
      .force('collision', forceCollide(collisionRadius)
        .strength(0.8)
        .radius(d => {
          // Larger collision radius for important nodes
          const gameCount = d.data?.gameCount || 1;
          const isRoot = d.data?.isRoot;
          return isRoot ? 80 : 40 + Math.log(gameCount + 1) * 5;
        })
      )
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay)
      .stop();

    // Run simulation for specified iterations
    for (let i = 0; i < maxIterations; i++) {
      this.simulation.tick();
    }

    return {
      nodes: nodesCopy.map(node => ({
        ...nodes.find(n => n.id === node.id),
        position: { x: node.x, y: node.y }
      })),
      edges: edgesCopy
    };
  }

  // Hierarchical layout for chess tree structure
  calculateHierarchicalLayout(nodes, edges, options = {}) {
    const {
      levelHeight = 200,
      nodeSpacing = 150,
      rootX = this.width / 2,
      rootY = 100
    } = options;

    // Group nodes by depth
    const nodesByDepth = new Map();
    nodes.forEach(node => {
      const depth = node.data?.depth || 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(node);
    });

    // Position nodes level by level
    const positionedNodes = [];
    for (const [depth, depthNodes] of nodesByDepth.entries()) {
      const y = rootY + depth * levelHeight;
      const totalWidth = (depthNodes.length - 1) * nodeSpacing;
      const startX = rootX - totalWidth / 2;

      depthNodes.forEach((node, index) => {
        const x = depthNodes.length === 1 ? rootX : startX + index * nodeSpacing;
        
        // Add some variation based on performance
        const winRate = node.data?.winRate || 50;
        const xVariation = (winRate - 50) * 2; // Spread good/bad moves
        const yVariation = Math.random() * 40 - 20; // Add some randomness
        
        positionedNodes.push({
          ...node,
          position: { 
            x: x + xVariation, 
            y: y + yVariation 
          }
        });
      });
    }

    return {
      nodes: positionedNodes,
      edges
    };
  }

  // Circular layout for balanced view
  calculateCircularLayout(nodes, edges, options = {}) {
    const {
      centerX = this.width / 2,
      centerY = this.height / 2,
      baseRadius = 200,
      radiusIncrement = 150
    } = options;

    // Group nodes by depth
    const nodesByDepth = new Map();
    nodes.forEach(node => {
      const depth = node.data?.depth || 0;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth).push(node);
    });

    const positionedNodes = [];
    for (const [depth, depthNodes] of nodesByDepth.entries()) {
      if (depth === 0) {
        // Root node at center
        positionedNodes.push({
          ...depthNodes[0],
          position: { x: centerX, y: centerY }
        });
        continue;
      }

      const radius = baseRadius + (depth - 1) * radiusIncrement;
      const angleStep = (2 * Math.PI) / depthNodes.length;
      
      depthNodes.forEach((node, index) => {
        const angle = index * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        positionedNodes.push({
          ...node,
          position: { x, y }
        });
      });
    }

    return {
      nodes: positionedNodes,
      edges
    };
  }

  // Performance-based clustering layout
  calculateClusterLayout(nodes, edges, options = {}) {
    const {
      clusterRadius = 300,
      clusterSpacing = 600
    } = options;

    // Group nodes by performance ranges
    const clusters = {
      excellent: [], // 70%+
      good: [],      // 60-70%
      solid: [],     // 50-60%
      challenging: [], // 40-50%
      difficult: []  // <40%
    };

    nodes.forEach(node => {
      const winRate = node.data?.winRate || 50;
      if (winRate >= 70) clusters.excellent.push(node);
      else if (winRate >= 60) clusters.good.push(node);
      else if (winRate >= 50) clusters.solid.push(node);
      else if (winRate >= 40) clusters.challenging.push(node);
      else clusters.difficult.push(node);
    });

    // Position clusters in a circle
    const clusterCenters = [
      { x: this.width / 2, y: this.height / 2 - clusterSpacing }, // excellent - top
      { x: this.width / 2 + clusterSpacing * 0.7, y: this.height / 2 - clusterSpacing * 0.3 }, // good - top right
      { x: this.width / 2 + clusterSpacing * 0.7, y: this.height / 2 + clusterSpacing * 0.3 }, // solid - bottom right
      { x: this.width / 2 - clusterSpacing * 0.7, y: this.height / 2 + clusterSpacing * 0.3 }, // challenging - bottom left
      { x: this.width / 2 - clusterSpacing * 0.7, y: this.height / 2 - clusterSpacing * 0.3 }, // difficult - top left
    ];

    const positionedNodes = [];
    Object.entries(clusters).forEach(([clusterName, clusterNodes], clusterIndex) => {
      if (clusterNodes.length === 0) return;
      
      const center = clusterCenters[clusterIndex];
      const angleStep = (2 * Math.PI) / clusterNodes.length;
      
      clusterNodes.forEach((node, index) => {
        const angle = index * angleStep;
        const r = clusterRadius * (0.3 + Math.random() * 0.7); // Vary radius
        const x = center.x + r * Math.cos(angle);
        const y = center.y + r * Math.sin(angle);
        
        positionedNodes.push({
          ...node,
          position: { x, y }
        });
      });
    });

    return {
      nodes: positionedNodes,
      edges
    };
  }

  // Stop simulation
  stop() {
    if (this.simulation) {
      this.simulation.stop();
    }
  }
}

// Utility functions for graph analysis
export const GraphAnalysis = {
  // Find critical paths in the graph
  findCriticalPaths(nodes, edges, options = {}) {
    const { minGameCount = 10, minWinRate = 60 } = options;
    
    const criticalNodes = nodes.filter(node => 
      node.data?.gameCount >= minGameCount && 
      node.data?.winRate >= minWinRate
    );
    
    const criticalEdges = edges.filter(edge => 
      criticalNodes.some(n => n.id === edge.source) && 
      criticalNodes.some(n => n.id === edge.target)
    );
    
    return { nodes: criticalNodes, edges: criticalEdges };
  },

  // Calculate node importance scores
  calculateNodeImportance(nodes, edges) {
    const nodeImportance = new Map();
    
    nodes.forEach(node => {
      const gameCount = node.data?.gameCount || 0;
      const winRate = node.data?.winRate || 50;
      const depth = node.data?.depth || 0;
      
      // Importance based on games played, win rate, and position in tree
      const importance = (gameCount * 0.4) + (winRate * 0.4) + ((10 - depth) * 0.2);
      nodeImportance.set(node.id, importance);
    });
    
    return nodeImportance;
  },

  // Find performance zones
  identifyPerformanceZones(nodes, options = {}) {
    const { radiusThreshold = 200 } = options;
    
    const zones = [];
    const processed = new Set();
    
    nodes.forEach(node => {
      if (processed.has(node.id)) return;
      
      const zone = {
        center: node,
        nodes: [node],
        avgWinRate: node.data?.winRate || 50,
        totalGames: node.data?.gameCount || 0
      };
      
      // Find nearby nodes with similar performance
      nodes.forEach(otherNode => {
        if (otherNode.id === node.id || processed.has(otherNode.id)) return;
        
        const distance = Math.sqrt(
          Math.pow(node.position.x - otherNode.position.x, 2) +
          Math.pow(node.position.y - otherNode.position.y, 2)
        );
        
        const winRateDiff = Math.abs((node.data?.winRate || 50) - (otherNode.data?.winRate || 50));
        
        if (distance < radiusThreshold && winRateDiff < 20) {
          zone.nodes.push(otherNode);
          zone.totalGames += otherNode.data?.gameCount || 0;
          processed.add(otherNode.id);
        }
      });
      
      // Recalculate average win rate
      zone.avgWinRate = zone.nodes.reduce((sum, n) => sum + (n.data?.winRate || 50), 0) / zone.nodes.length;
      
      zones.push(zone);
      processed.add(node.id);
    });
    
    return zones;
  }
};

export default ChessGraphLayout; 