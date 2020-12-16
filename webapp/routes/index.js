'use strict';

const
  express = require('express'),
  dt_db = require('../controller/dt_db'),
  paths = require('../controller/paths'),
  Exception = require('../model/Exception').model,
  logger = require('../controller/log')(module);

dt_db.init()

const router = express.Router();

/* set up routes */

// show available DTs
router.get('/dt', (req, res, next) => {
  dt_db.get_dt_statuses()
    .then(
      _ => res.json(_),
      _ => Exception.handleErrorResponse(_, res).end(next)
      );
});

// get similar items
router.get('/sim', (req, res, next) => {
  
  const query = 'q' in req.query ? req.query.q : 'unknown#NN';
  const limit = 'limit' in req.query ? parseInt(req.query.limit) : undefined;
  const offset = 'offset' in req.query ? parseInt(req.query.offset) : undefined;
  const dtname = 'dt' in req.query ? req.query.dt : 'unspecified';

  let startedwriting = false;
  Promise.resolve(true)
    .then(_ => {
      res.header('Content-Type', 'application/json; charset=utf-8');
      res.write('[');
    })
    .then(_ => dt_db.get_neighbors_async (
      query,
      item => {
        if (startedwriting)
          res.write(',');
        res.write(JSON.stringify(item));
        startedwriting = true;
      },
      offset,
      limit
    ))
    .then(() => {
      res.end(']', next);
    })
    .catch(err => {
      if (startedwriting)
        res.write(',');
      logger.error(err);
      res.write(JSON.stringify(`Could not retrieve result: '${err.message}'`));
      res.end(']', next);
    });

});

// get path between start and dest
router.get('/path', (req, res, next) => {
  
  const start = 'start' in req.query ? req.query.start : 'unknown#NN';
  const dest = 'dest' in req.query ? req.query.dest : 'unknown#NN';
  const topk = ('topk' in req.query ? parseInt(req.query.topk) : 200) + 1;
  const dtname = 'dt' in req.query ? req.query.dt : 'unspecified';
  
  dt_db.get_dt(dtname)
    .then(dt => paths.dijkstra(
      start, 
      dest, 
      node => dt_db.get_neighbors_sync(node, 1, topk, dt), 
      (node, cost) => {
        logger.debug(`processing '${node}' (${cost}).`)
      })
    )
    .then(_ => res.json({
      path: _.path,
      distance: _.path.map(u => _.costs[u]),
      subgraph: Object.keys(_.parents).length
    }))
    .catch(_ => Exception.handleErrorResponse(_, res).end(next))
});

// get path between start and dest with process information
router.get('/pathp', (req, res, next) => {
  
  const start = 'start' in req.query ? req.query.start : 'unknown#NN';
  const dest = 'dest' in req.query ? req.query.dest : 'unknown#NN';
  const topk = ('topk' in req.query ? parseInt(req.query.topk) : 200) + 1;
  const dtname = 'dt' in req.query ? req.query.dt : 'unspecified';

  let startedwriting = false;
  Promise.resolve(true)
    .then(_ => {
      res.header('Content-Type', 'application/json; charset=utf-8');
      res.write('[\n');
    })
    .then(_ => logger.info(`computing path: ${start}-->${dest} (${dtname}, ${topk-1})`))
    .then(_ => console.time(`path::${start}--${dest}`))
    .then(_ => dt_db.get_dt(dtname))
    .then(dt => paths.dijkstra(
      start, 
      dest, 
      node => dt_db.get_neighbors_sync(node, 1, topk, dt), 
      (node, cost) => {
        // logger.debug(`processing '${node}' (${cost}).`)
        if (startedwriting)
          res.write(',\n');
        res.write(JSON.stringify({node: node, cost: cost}));
        startedwriting = true;
      })
    )
    .then(r => {
      if (startedwriting)
          res.write(',\n');
      res.write(JSON.stringify({
        path: r.path,
        distances: r.path.map((u, i) => i > 0 ? r.costs[u] : 0),
        weights: r.path.map((v,i) => i > 0 ? r.weights[ [r.path[i-1], v] ] : [ 0, 0]),
        subgraph: Object.keys(r.parents).length
      }));
      res.end('\n]\n', next);
    })
    .catch(err => {
      logger.error(err);
      if (startedwriting)
        res.write(',\n');
      res.write(JSON.stringify(`Could not retrieve result: '${err.message}'`));
      res.end(']\n', next);
    })
    .then(_ => console.timeEnd(`path::${start}--${dest}`));
});

module.exports = router;
