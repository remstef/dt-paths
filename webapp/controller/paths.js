'use strict';

// requires
require('google-closure-library')
goog.require('goog.structs.PriorityQueue')

const
  nodeCleanup = require('node-cleanup'),
  Exception = require('../model/Exception').model,
  logger = require('./log')(module);

function lowestCostNode(costs, processed) {
  return Object.keys(costs)
    .filter(node => !processed.has(node))
    .sort(() => Math.random() - .5) // shuffle
    .reduce((lowest, node) => {
      if (lowest === null || costs[node] < costs[lowest]) {
        lowest = node;
      }
      return lowest;
    }, null);
}

module.exports.dijkstra = async function(start, dest, neighbors, callback) {
  const costs = { };
  const weights = { };
  const minhops = { };
  const pq = new goog.structs.PriorityQueue();

  pq.enqueue(1e-22, start);

  costs[start] = 1e-22;
  // costs[dest] = Infinity;

  minhops[start] = .0;
  // minhops[dest] = Infinity;
  
  const parents = { };
  parents[start] = null;
  parents[dest] = null;
  
  const processed = new Set()
  
  // let node = lowestCostNode(costs, processed);
  let node = pq.dequeue();

  let i = 1;

  while (node) {
    // this is only for the queue since in this stupid datastructure can be enqued with different priorities :/
    if(processed.has(node)){
      node = pq.dequeue();
      continue;
    }
    const cost = costs[node];
    
    callback(node, cost)
    
    const hops = minhops[node];
    const newhops = hops+1;
    // update costs
    var stop = false;

    await neighbors(node)
      .then(_ => _.forEach(neigh => {
        if ( !costs[neigh.name] )
          i++;
        weights[ [node, neigh.name] ] = [neigh.rank, neigh.weight];
        const newcost = i; // i cost + 1; neigh.weight; neigh.rank;
        if ( !costs[neigh.name] || costs[neigh.name] > newcost) {  
          pq.enqueue(newcost, neigh.name);
          costs[neigh.name] = newcost;
          minhops[neigh.name] = newhops;
          parents[neigh.name] = node;
        }
        // stop early; 
        // in case of incremental weighting scheme, there can't be any other path which costs less, for any other scheme, there might be better paths. It might make sense to explore those, i.e. don't add new nodes but explore neihbors of unexplored nodes if a path to dest can be found and costs less (this too is just a heuristic)
        if (neigh.name === dest) {
          stop = true;
        }
      }));
      
    processed.add(node)

    if(stop){
      logger.debug(`found '${dest}'.`);
      break;
    }

    // node = lowestCostNode(costs, processed);
    node = pq.dequeue();
  }

  // finalize
  const path = [ dest ];
  let parent = parents[dest];
  while (parent) {
    path.push(parent);
    parent = parents[parent];
  }
  path.reverse();  // reverse array to get correct order

  logger.debug(`processed ${processed.size} nodes.`);
  logger.debug(`subgraph size ${ Object.keys(parents).length} nodes.`);
  
  if(costs[dest])
    return {
      distance: costs[dest],
      path: path,
      costs: costs,
      weights: weights,
      processed: processed,
      parents: parents
    };
  else
    return {
      distance: costs[dest],
      path: [ ],
      costs: costs,
      weights: weights,
      processed: processed,
      parents: parents
    };
}

