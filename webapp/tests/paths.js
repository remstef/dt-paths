
var Exception = require('../model/Exception').model;
var logger = require('../controller/log')(module);
var db = require('../controller/db');
var paths = require('../controller/paths');

async function neigh(node){
  let result = await db.get_neighbors_sync(node)
  return result;
} 

Promise.resolve(true)
  .then(_ => console.log('test paths'))
  .then(_ => paths.dijkstra('Jaguar#NN', 'tiger#NN', db.get_neighbors_sync) )
  .then(_ => {
    console.log(_.path);
    console.log(_.path.map(u => _.costs[u]))
  })
  .catch(_ => logger.error(_))
  .then(_ => db.close(() => {}))

