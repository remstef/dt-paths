'use strict';

const
  express = require('express'),
  db = require('../controller/db'),
  paths = require('../controller/paths'),
  Exception = require('../model/Exception').model,
  logger = require('../controller/log')(module);


const router = express.Router();

/* set up routes */

// show available DTs
router.get('/dt', (req, res, next) => {
  db.get_dbs()
    .then(_ => res.json(_))
    .catch(_ => Exception.handleErrorResponse(_, res).end(next))
});

// get similar items
router.get('/sim', (req, res, next) => {
  
  const query = 'q' in req.query ? req.query.q : 'unknown#NN';
  const limit = 'limit' in req.query ? parseInt(req.query.limit) : undefined;
  const offset = 'offset' in req.query ? parseInt(req.query.offset) : undefined;

  let startedwriting = false;
  Promise.resolve(true)
    .then(_ => {
      res.header('Content-Type', 'application/json; charset=utf-8');
      res.write('[');
    })
    .then(_ => db.get_neighbors_async (
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
    .then(ack => {
      res.end(']', next);
      ack();
    })
    .catch(err => {
      logger.error(err);
      res.write(JSON.stringify(`Could not retrieve result: '${err.message}'`));
      res.end(']', next);
    });

});

// get path between start and dest
router.get('/path', (req, res, next) => {
  
  var start = 'start' in req.query ? req.query.start : 'unknown#NN';
  var dest = 'dest' in req.query ? req.query.dest : 'unknown#NN';
  var topk = ('topk' in req.query ? parseInt(req.query.topk) : 200) + 1;
  
  Promise.resolve(true)
    .then(_ => paths.dijkstra(start, dest, node => db.get_neighbors_sync(node, 1, topk) ))
    .then(_ => res.json({
      path: _.path,
      distance: _.path.map(u => _.costs[u]),
      subgraph: Object.keys(_.parents).length
    }))
    .catch(_ => Exception.handleErrorResponse(_, res).end(next))

});

module.exports = router;
