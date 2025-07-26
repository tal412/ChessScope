// Clustering Analysis for Chess Performance Graph
// Both position-based and opening-based clustering

// Color constants for cluster visualization
const SINGLE_PURPLE_COLOR = { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' };
const OPENING_CLUSTER_COLORS = [
  { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }, // Purple
  { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }, // Blue
  { bg: '#10b981', border: '#059669', text: '#ffffff' }, // Green
  { bg: '#f59e0b', border: '#d97706', text: '#ffffff' }, // Orange
  { bg: '#ef4444', border: '#dc2626', text: '#ffffff' }, // Red
  { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' }, // Purple (repeat)
  { bg: '#06b6d4', border: '#0891b2', text: '#ffffff' }, // Cyan
  { bg: '#84cc16', border: '#65a30d', text: '#ffffff' }, // Lime
  { bg: '#f97316', border: '#ea580c', text: '#ffffff' }, // Orange-alt
  { bg: '#ec4899', border: '#db2777', text: '#ffffff' }, // Pink
  { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' }, // Indigo
  { bg: '#14b8a6', border: '#0d9488', text: '#ffffff' }, // Teal
  { bg: '#a855f7', border: '#9333ea', text: '#ffffff' }, // Violet
  { bg: '#eab308', border: '#ca8a04', text: '#ffffff' }, // Yellow
  { bg: '#22d3ee', border: '#06b6d4', text: '#ffffff' }  // Sky
];

// Fallback color for unclustered nodes
const UNCLUSTERED_OPENING_COLOR = { bg: '#64748b', border: '#475569', text: '#ffffff' };

// Function to create opening-based clusters using DFS for connected openings
export const createOpeningClusters = (nodes) => {
  if (!nodes || nodes.length === 0) return [];

  const clusters = [];
  
  // Group nodes by opening name (excluding root nodes which don't have meaningful opening info)
  const openingGroups = new Map();
  
  nodes.forEach(node => {
    // Skip root nodes and nodes without opening information
    if (node.data.isRoot || !node.data.openingName || node.data.openingName === 'Unknown Opening') {
      return;
    }
    
    const openingKey = node.data.openingName;
    if (!openingGroups.has(openingKey)) {
      openingGroups.set(openingKey, []);
    }
    openingGroups.get(openingKey).push(node);
  });

  let clusterIndex = 0;
  
  // Create one cluster per opening containing ALL nodes with that opening name
  openingGroups.forEach((nodesInOpening, openingName) => {
    if (nodesInOpening.length === 0) return;
    
    // Create cluster name based on number of positions
    const clusterName = nodesInOpening.length === 1 
      ? `${openingName} (1 position)`
      : `${openingName} (${nodesInOpening.length} positions)`;
        
    clusters.push({
      id: `opening-cluster-${clusterIndex}`,
      name: clusterName,
      openingName: openingName,
      nodes: nodesInOpening,
      nodeCount: nodesInOpening.length,
      type: 'opening',
      colorIndex: clusterIndex % OPENING_CLUSTER_COLORS.length
    });
    
    clusterIndex++;
  });

  return clusters;
};

// Function to create position-based clusters for current position and ALL its descendants
export const createPositionClusters = (nodes, currentFen) => {
  if (!nodes || nodes.length === 0 || !currentFen) return [];

  const clusters = [];
  
  // Find all nodes with the current FEN (transpositions) - EXCLUDE ROOT NODES
  const currentPositionNodes = nodes.filter(node => 
    node.data.fen === currentFen && !node.data.isRoot
  );
  
  if (currentPositionNodes.length === 0) return [];

  // For each instance of the current position, create a cluster with ALL its descendants
  currentPositionNodes.forEach((parentNode, clusterIndex) => {
    
    // Recursively find ALL descendants of this parent node
    const findAllDescendants = (ancestorNode, allNodes) => {
      const descendants = [];
      const ancestorMoves = ancestorNode.data.moveSequence || [];
      
      // Find all nodes that are descendants of this ancestor
      allNodes.forEach(candidateNode => {
        const candidateMoves = candidateNode.data.moveSequence || [];
        
        // Check if candidate is a descendant (longer sequence that starts with ancestor's moves)
        if (candidateMoves.length > ancestorMoves.length &&
            ancestorMoves.every((move, index) => move === candidateMoves[index])) {
          descendants.push(candidateNode);
        }
      });
      
      return descendants;
    };

    const descendantNodes = findAllDescendants(parentNode, nodes);

    // Create cluster whether there are descendants or not (for single leaf nodes too)
    const clusterNodes = [parentNode, ...descendantNodes];
    
    // Count immediate children for display
    const immediateChildren = descendantNodes.filter(childNode => {
      const parentMoves = parentNode.data.moveSequence || [];
      const childMoves = childNode.data.moveSequence || [];
      return childMoves.length === parentMoves.length + 1;
    });
    
    // Create appropriate cluster name based on whether it has descendants
    let clusterName;
    if (descendantNodes.length > 0) {
      clusterName = `Position ${clusterIndex + 1} (${immediateChildren.length} moves, ${descendantNodes.length} total nodes)`;
    } else {
      // Single leaf node - create cluster around just this position
      clusterName = `Leaf Position ${clusterIndex + 1} (single position)`;
    }
    
    clusters.push({
      id: `position-cluster-${clusterIndex}`,
      name: clusterName,
      parentNode: parentNode,
      childNodes: immediateChildren, // Immediate children for reference (empty for leaf nodes)
      descendantNodes: descendantNodes, // ALL descendants (empty for leaf nodes)
      allNodes: clusterNodes, // Just the parent node for leaf positions
      nodeCount: clusterNodes.length,
      type: 'position',
      isLeafCluster: descendantNodes.length === 0, // Flag to identify leaf clusters
      colorIndex: clusterIndex % 3 // Cycle through 3 colors for different transpositions
    });
  });

  return clusters;
};

// Export cluster colors for use in components
export { OPENING_CLUSTER_COLORS, UNCLUSTERED_OPENING_COLOR }; 