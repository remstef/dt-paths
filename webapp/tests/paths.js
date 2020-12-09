
var Exception = require('../model/Exception').model;
var logger = require('../controller/log')(module);
var dt_db = require('../controller/dt_db');
var paths = require('../controller/paths');

async function neigh(node){
  let result = await dt_db.get_neighbors_sync(node)
  return result;
} 

async function test() {
  await dt_db.init();
  logger.info('Ready to test');

  await dt_db.get_dt_statuses().then(
    res => logger.info(res),
    err => logger.error(err)
  );

  console.log('test paths')
  await dt_db.get_dt(null)
    .then(dt => {
      console.time('path')
      return paths.dijkstra('Jaguar#NN', 'bank#NN', node => dt_db.get_neighbors_sync(node, 1, 200, dt))
    })
    .then(
      r => {
        console.log(r.path);
        console.log(r.path.map(u => r.costs[u]))
      },
      err => console.error(err)
    )
    .then(_ => console.timeEnd('path'))
    
  dt_db.close();
}

test();




