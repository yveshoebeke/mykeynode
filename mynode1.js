var argv = require('yargs')
  .usage('Usage: $0 -d [data]')
  .demand(['d'])
  .argv;

var mynode2 = require('./mynode2');

var mydata = argv.d;

mynode2.setData(mydata);

mynode2.getItOut();
