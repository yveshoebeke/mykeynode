/*****************************************************************************
	@name 		BecReaderPostProcess.js
 
	@internal	

	@copyright 	Benchmark Education Company

	@author		yhoebeke@benchmarkeducation.com [yeh]
	@Version 	1.0 2015-03-10
	@internal	Initial code.

	$todo		Implement child-process or exec-sync to leverage external
				functionality in a cleaner, more dynamic manner.
******************************************************************************/

/************************************
	Initialize libs and get options
*************************************/
GLOBAL.fs = require('fs');
GLOBAL.xml2js = require('xml2js');

/********************************
     Required helper scripts 
*********************************/
var _ = require('underscore');
var htmlparser = require('htmlparser2');
var execSync = require('exec-sync');
var utils = require(__dirname + '/ingest_step2_utils.js');
var processEbookPage = require(__dirname + '/ingest_step2_processHtml.js');
var step2PostProcNode = require(__dirname + '/ingest_step2_post_proc_node.js');

/************************************* 
    Prepare the Rabbit hole and ...
**************************************/
var encoding = "utf8";
var queueSocket = "amqp://localhost";
var exchangeName = "ex_yhoebeke";
var subRoutingKey = "content.becreader.postprocess";
var pubRoutingKey = "utility.pdm2db.postprocess";

/**************************** 
    ... kick the Rabbit !! 
*****************************/
var context = require("rabbit.js").createContext(queueSocket);
context.on("ready", function () {
  var sub = context.socket("SUB",{routing:'topic'});
  var pub = context.socket("PUB",{routing:'topic'});
  pub.connect(exchangeName);

  sub.connect(exchangeName,subRoutingKey,function () {
  	process.stdout.write(__filename.split("/").pop() + " - Waiting for data... ");
    sub.on("data", function (data) {
    	var message = JSON.parse(data);

    	var dir = null;
    	var pkg_hash = null;
    	var pkg_sku = null;
    	var action = null;
    	var operation = null;
    	var ingest_root = null;

		if(message.hasOwnProperty('body') == true) { var dir = message.body[0]; }
		console.log('Some extracted carrots:');
    	console.log("dir: %s",dir);

		var dest_suf = createDestSuf();
		var user = process.env.USER;
		var dest_main = "/home/" + user + "/AssetsProcessed/";
		var ddir_insert = "post_proc_ok";
		var target_dir = user+"/"+ddir_insert+"."+dest_suf;

		var root = dest_main + target_dir;



    	msg = {pkg_hash:pkg_hash,completed_status:completed_status}

		var data = JSON.stringify({message: msg});

		/*******************************************
		  Give the PDM2 DB updater something to do
		********************************************/
		console.log('PDM2 update for: %s', pkg_hash);
		pub.publish(pubRoutingKey, data, encoding);

		var path = dir;
		var root = dir;
		var baseUrl = null;


    	if (typeof(data.base) != "undefined"){
    		var baseUrl = base;
    	} else {
    		var baseUrl = null;
    	}

		step2PostProcNode.main(path, root, baseUrl);

    }); 
  }); 
});

function createDestSuf(){
    var d = new Date();
    // get rid of microseconds
    sd = d.toISOString().split('.').slice(0,1).toString();
    // remoce - and : and replace T with _
    sd = sd.replace(/-|:/g,"");
    sd = sd.replace("T","_");
    return sd; 
}

/* EOF @name BecReaderPostProcess.js [yeh]*/
