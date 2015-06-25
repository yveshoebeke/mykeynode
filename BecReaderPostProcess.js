/*****************************************************************************************************
	@name 	   BecReaderPostProcessd.js - note, the trailing 'd' indicating a Daemon process.
 
	@internal  [1] Sets up all the required auxiallaries.
               [2] Initialize key variables.
               [3] Print operational announcement.
               [4] Evoke daemonization process.
               [5] Set up RabbitMQ PUBlisher and SUBscriber (consumer).
               [6] Wait for message from the pipe.
               [7] Send message to PHP PDM2 DB update utility (postgresql with common abstraction).
               [8] Call Step2 Post Process (Bob's code, wrapped in 'do' lambda).

	@copyright 	 Benchmark Education Company

	@author      yhoebeke@benchmarkeducation.com [yeh]
	@Version 	   1.0 2015-03-10
	@internal	   Initial code.

  @todo        [1] Reinvent the pid accounting. [done]
               [2] Revisit the validation process (throw err or ?) [done]
               [3] Transform some of the functionality into objects.
               [4] Replace the argument scheme below with reading a json obj from disk like:
                      var obj = JSON.parse(fs.readFileSync('subpubkeys.json', 'utf8'));
                      -- to get to the defaults .... yuk [ask Al]
               [5] Put process in try-catch, throw exceptions for issues with the flow. [done]

******************************************************************************************************/

/******************************************
  Required helper modules (Globals first)
*******************************************/
GLOBAL.logger = require('./logger');
GLOBAL.xml2js = require('xml2js');
GLOBAL.execSync = require("exec-sync");
GLOBAL.fp = require('path');
GLOBAL._ = require('underscore');
GLOBAL.fs = require('fs');

/******************************************************
  Define CLI arguments.
  ---------------------
  You can:  -h, --help to see a short list of options.
            --sub to set a SUBscription binding key. 
            --pub to set a PUBlication binding key. 
            --util to set a UTILity binding key. 

  All key options are optional and will default to
  their respective default values.
******************************************************/
var argv = require("yargs").default('sub','package.publish.postProcess')
                           .default('pub','content.becreader.upload')
                           .default('util','utility.pdm2db.postprocess')
                           .default('exchng','ex_node_pp')
                           .alias('h','help')
                           .argv;

var iniparser = require('iniparser');
var step2PostProcNode = require(__dirname + '/ingestStep2PostProcess.js');
var os = require('os');

GLOBAL.errDescription = "";
GLOBAL.disposition = {};

/******************************
  Check if help was requested
******************************/
if(argv.h){
  assist();
  process.exit(0);  
}

/************************************ 
  Let user know we are casting off. 
*************************************/
var thisModule = __filename.split("/").pop();
console.log("Starting %s: ", thisModule);

/******************************** 
  Get access to config ini data 
*********************************/
var missingMessage = "Incompatible AMQP message, elements missing: ";
var pathToIni = "./config.ini";
var config = iniparser.parseSync(pathToIni);
console.log("Reading configuration data from: %s",pathToIni);

/**********************
  Daemonize here
        ^ ^
       (o O)   
_____oO0(.)0Oo_____
___________________
**********************/

/*****************************
  Set up log and pid files. 
*****************************/
var pidfilePath = setupAdminFiles('pid',true);
GLOBAL.logfilePath = setupAdminFiles('log',true);

/*********************************************
  Everything after this will run as a Daemon 
**********************************************/
require('daemon')();

/*********************************************************
  Make a note of this Daemon's PID in pid and log files 
*********************************************************/
fs.writeFile(pidfilePath, process.pid, function(err){});
logger.logit(logfilePath, thisModule, "Daemon started (pid:" + process.pid + ").");

/*******************************
    Prepare the Rabbit hole.
*******************************/
re = /"|'/g;
var amqpAppProtocol = "amqp://";
var encoding = "utf8";
var queueSocket = amqpAppProtocol + config.rabbitmq.amqp_host.replace(re,'');
//var exchangeName = config.rabbitmq.amqp_exchange.replace(re,'');
var exchangeName = argv.exchng;
var packagesLocationWork = config.packages.packages_loc_work.replace(re,'');
var packageLocation = config.packages.packages_loc_pkgs.replace(re,'');

/**********************************************
    Define SUBscription and PUBlisher keys.
**********************************************/
var subRoutingKey = argv.sub;
var pubRoutingKey = argv.pub;
var pubPDM2DBRoutingKey = argv.util;

/*****************************
    ... kick the Rabbit !! 

             \\_   wtf?
          .---(')   
        o( )_-\_
*****************************/
try{
  var context = require("rabbit.js").createContext(queueSocket);
  context.on("ready", function () {
    logger.logit(logfilePath, thisModule, "AMQP started on host:<" + queueSocket + ">.");
    var sub = context.socket("SUB",{routing:'topic'});
    var pub = context.socket("PUB",{routing:'topic'});

    pub.connect(exchangeName);
    logger.logit(logfilePath, thisModule, "AMQP Publisher connected to exchange:<" + exchangeName + ">.");
    logger.logit(logfilePath, thisModule, "AMQP to publish on:<" + pubRoutingKey + ">.");

    sub.connect(exchangeName,subRoutingKey,function () {
      logger.logit(logfilePath, thisModule, "AMQP Subscriber connected to exchange:<" + exchangeName + ">.");
      logger.logit(logfilePath, thisModule, "AMQP listening for:<" + subRoutingKey + ">.");
      logger.logit(logfilePath, thisModule, "Ready... ");
      sub.on("data", function (data) {
        logger.logit(logfilePath, thisModule, "AMQP message received.");
          logger.logit(logfilePath, thisModule, "Data: "+data);

        /* See comment at bottom of this file to see what is expected in the message */
      	try{
          var savedData = data;
          var message = JSON.parse(data);
          logger.logit(logfilePath, thisModule, "[X]"+savedData);

          errDescription = "";

          /********************************
            Manipulate the data elements.
          ********************************/
          var packageSKU = workingDirectory = workDirectory = workingDirectorySuffix = postprocessDirectory = baseUrl = folder = null;
          
          var missingMessageElements = [];

          if(message.hasOwnProperty("action") === true) { 
            var messageAction = message.action;
          } else {
            missingMessageElements.push(" [action]");
          }
          if(message.hasOwnProperty("action_id") === true) { 
            var messageActionId = message.action_id;
          } else {
            missingMessageElements.push(" [action_id]");
          }
          if(message.hasOwnProperty("operation") === true) { 
            var messageOperation = message.operation;
          } else {
            missingMessageElements.push(" [operation]");
          }
          if(message.hasOwnProperty("package_sku") === true) { 
            var messageSKU = message.package_sku;
          } else {
            missingMessageElements.push(" [package_sku]");
          }
          if(message.hasOwnProperty("package_ext_location") === true) { 
            var messageExtractionLocation = message.package_ext_location;
          } else {
            missingMessageElements.push(" [package_ext_location]");
          }
          if(message.hasOwnProperty("package_hash") === true) { 
            var messageHash = message.package_hash;
          } else {
            missingMessageElements.push(" [package_hash]");
          }

          if(missingMessageElements.length > 0){
            var missingMessage = "Incompatible AMQP message, elements missing:";
            missingMessageElements.forEach(function(missingElement){
                                                      missingMessage = missingMessage.concat(missingElement);
                                                    });

            logger.logit(logfilePath, thisModule, missingMessage);
            throw new Error(missingMessage);
          }

          var workingDirectory = messageExtractionLocation;
          var packageSKU = messageSKU;

          logger.logit(logfilePath, thisModule, "Received - working directory:" + workingDirectory + " - SKU:" + packageSKU);

          workingDirectory = validateClean(workingDirectory);
          if(workingDirectory == "OPF ERR"){
            throw new Error("Operation halted: content.opf is missing.");
          } else {
            createPostProcDirResult = createPostprocessDir();
            postprocessDirectory = createPostProcDirResult.directoryResult;
            logger.logit(logfilePath, thisModule, "working dir: " + workingDirectory + " - post process dir: " + postprocessDirectory);

            /*****************************************************************************
              Move files from 'working directory' to 'postprocess directory', using rsync
              ---------------------------------------------------------------------------
              @todo replace flags method parameters as so:  
                                                   " .flags('a','remove-source-files') "
                    (omitted to speed-up repeated testing of this)
            ******************************************************************************/
            logger.logit(logfilePath, thisModule, 'Moving files from ' + workingDirectory+"/*" + ' to ' + postprocessDirectory);
            execSync("rsync -a " + workingDirectory + " " + postprocessDirectory);

            /*****************************************************************************
              Move files from 'working directory' to 'work directory', using rsync
            ******************************************************************************/
            workDirectory = '/home/' + process.env.USER + '/working_dir/';
            logger.logit(logfilePath, thisModule, 'Moving source files from ' + workingDirectory+"/*" + ' to ' + workDirectory);
            execSync("rsync -aPS " + workingDirectory + " " + workDirectory);
            
            workDirectory = getWorkDirectory(workingDirectory);

            /*****************************************************************************************
              Copy the cover thumbnail to workdirectory as 'th_X00000.jpg' from thumbnails/cover.jpg
              --------------------------------------------------------------------------------------
              @todo: this process will be removed and/or undergo a major rewrite.
            ******************************************************************************************/
            var fromCoverThumbnail = workingDirectory + "/thumbnails/cover.jpg";
            var toCoverThumbnail = workDirectory + "/th_" + packageSKU + ".jpg";

            fs.createReadStream(fromCoverThumbnail).pipe(fs.createWriteStream(toCoverThumbnail));

            logger.logit(logfilePath, thisModule, 'Copied cover thumbnail from ' + fromCoverThumbnail + ' to ' + toCoverThumbnail);

            /***********************************************************************************************
              This is the post process step 2 routine ("from Bob"), wrapped inside a "baseProcess" lambda.
              --------------------------------------------------------------------------------------------
              Sample argument values: 
                                      path: /home/yhoebeke/working_dir/X05319-1432822904
                                      root: /home/yhoebeke/working_dir
                                      base: null (some artifact, no longfer used, according to Bob)
                                      folder: null (revist/remove this)
            ************************************************************************************************/
            var path = workDirectory;
            var root = '/home/' + process.env.USER + '/working_dir';
            var baseUrl = null;
            var folder = null;

            logger.logit(logfilePath, thisModule, "To step2PostProcess with path: " + path + ", root: " + root + ", baseUrl: " + baseUrl +  ", folder: " + folder + ".");
            
            returnCode = step2PostProcNode.baseProcess(path, root, baseUrl, folder);

            logger.logit(logfilePath, thisModule,"Done with Bob!                            (-_-;)");

            if(returnCode.result == false){
              logger.logit(logfilePath, thisModule, "Errors: " + returnCode.errors);
              throw new Error(returnCode.errors);
            } else {
              logger.logit(logfilePath, thisModule, "Errors: None, process succesfull.");
            }

            /*******************************************
              Give the PDM2 DB updater something to do
            ********************************************/
            pub.publish(pubPDM2DBRoutingKey, data, encoding);
            logger.logit(logfilePath, thisModule, "PDM2 DB Utility message sent with key:<" + pubPDM2DBRoutingKey + ">.");

            /**************************************
              Handoff result to Jose
            ***************************************/
            message.postprocessDirectory = postprocessDirectory;
            data = JSON.stringify(message);
            pub.publish(pubRoutingKey, data, encoding);
            logger.logit(logfilePath, thisModule, "Process finished and handed off with:<" + postprocessDirectory + ">");
          }

        }catch(e){
          /***********************************************************
            An exception was thrown somewhere during the process.
            It will be caught here and assembled into an exception 
            object that will, in turn be send over to the Exception
            handeling worker.
          ************************************************************/
          logger.logit(logfilePath, thisModule, "[caught exception] " + e);
          var exceptionRoutingKey = subRoutingKey + '.except';
          logger.logit(logfilePath, thisModule, "ExceptionRoutingKey used: " + exceptionRoutingKey);

          var errData = {};

          errData.exception = {};
          errData.workstream = {};
          errData.amqp = {};
          errData.system = {};

          errData.exception.exCode = '';
          errData.exception.exMessage = e.message;
          errData.exception.exPrevious = '';
          errData.exception.exFile = thisModule;
          errData.exception.exLine = extractLineno(e.stack);
          errData.exception.exTraceArray = [];
          errData.exception.exTraceString = e.stack;

          errData.workstream.code_string = e.message;
          errData.workstream.action_source = 'BEC Reader post process';
	     	  errData.workstream.action_id = messageActionID;
          errData.workstream.package_dir = messageExtractionLocation;
          errData.workstream.action_retcode = messageAction;
          errData.workstream.operation_retcode = messageOperation;
		      errData.workstream.sku = messageSKU;

          errData.amqp.exchange = exchangeName;
          errData.amqp.binding_key = subRoutingKey;
          errData.amqp.message = " "+savedData;

          errData.system.host = os.hostname();
          errData.system.pid = process.pid;
          errData.system.uid = process.getuid();
          errData.system.gid = process.getgid();
          errData.system.current_user = process.env.USER;
          errData.system.last_modified = '';

          var errMessage = JSON.stringify(errData);
          logger.logit(logfilePath, thisModule, errMessage);

          try{
            pub.publish(exceptionRoutingKey, errMessage, encoding);
          }catch(e){
            logger.logit(logfilePath, thisModule, e);
          }
        }
      }); 
    }); 
  });
} catch(e) {
  console.log(e);
} 

/*********************************************************************
  Creates working directory
  -------------------------
  Example of desired result:
  /home/{user}/AssetsProcessed/{user}/post_proc_ok.{yyyymmdd_hhmmss}

  [1] Get date string in ISO format (yyyy-mm-ddThh:mm:ss.ms).
  [2] Get user from environment (user).
  [3] Transform it to: yyyymmdd_hhmmss (destSuffix)
  [4] Assemble and return the result (directoryResult).
**********************************************************************/
function createPostprocessDir(){
  var directoryResult = null;
  var destSuffix = null;
  var d = new Date();
  var re = /-|:/g;

  destSuffix = d.toISOString().split('.').slice(0,1).toString();
  destSuffix = destSuffix.replace(re,'');
  destSuffix = destSuffix.replace('T','_');

  directoryResult = '/home/' + process.env.USER + '/Assets_processed/' + process.env.USER + '.post_proc_ok.' + destSuffix;
  ingestFile = "ingest_list_" + destSuffix;

  var returnResult = {"directoryResult":directoryResult,"ingestFile":ingestFile};
  return returnResult;
}

/****************************************
  Gets working directory
  ----------------------
  Example of desired result:
  /home/yhoebeke/working_dir/{book-name}
*****************************************/
function getWorkDirectory(workingDirectory){
  var directoryResult = null;
  directoryResult = '/home/' + process.env.USER + '/working_dir/' + workingDirectory.split("/").pop();
  return directoryResult;
}

/************************************************
  Administration file creator
  ---------------------------
  Creates filepaths depending on type requested.
  Currently 2 considered: pid and log.
  Will return file without extension 
    if none/other specified.
************************************************/
function setupAdminFiles(type, verbose){
  type = typeof type !== 'undefined' ? type : null;
  verbose = typeof verbose !== 'undefined' ? verbose : false;
  var d = new Date();
  var microLogfileLocation = '/var/log/micro/';
  var microPidFileLocation = __dirname + '/';
  var filename =  __filename.split('/').pop();
  filename = filename.split('.').slice(0,1).toString();
 
  switch(type){
    case 'pid':
      filename = '/tmp/' + filename + '.' + d.getTime() + '.pid';
      break;
    case 'err':
      filename = filename + '.' + process.pid + '.err';
      break;
    case 'log':
      filename = microLogfileLocation + filename + '.' + process.env.USER + '.log';
      break;
    default:
  }
  
  if(verbose){
    console.log("%s file: %s", type, filename);
  }

  return filename;
}

/********************************************
  Validates and Cleans directory path.
  ------------------------------------
  This function basically sequences through
  the helper functions:
    [1] cleanLine
    [2] validate Thumbnail
    [3] validateOPF

  @todo: solidify error reporting/return.
*********************************************/
function validateClean(content){
  //content = cleanLine(content);

  if(validateThumbnail(content) != true){
    logger.logit(logfilePath, thisModule, "Thumbnails did not validate (missing).");
  }

  if(validateOPF(content) != true){
    logger.logit(logfilePath, thisModule, "OPF file did not validate (missing).");
    content = "OPF ERR";
  }

  return content;
}

/******************************************
  Cleans content
  --------------
  Removes ' " ', trailing '/', CRLF and LF 
*******************************************/
function cleanLine(content){
  content = content.replace('"','');

  if(content.substr(-1) == '/'){
    content = content.substr(0,directory.length-1);
  }

  content = content.replace('\r', '');
  content = content.replace('\n','');

  return content;
}

/************************************************************
  Validate thumbnails
  -------------------
  Checks if 'cover.jpg' and frontcover.jpg' exists in path.
*************************************************************/
function validateThumbnail(directory){
  var requiredThumbs = ['cover.jpg','frontcover.jpg'];
  //var requiredThumbs = ['cover.jpg'];
  var thumbnailPath = null;
  var returnResult = false;

  _.each(requiredThumbs, function(val,key){
    thumbnailPath = directory + "/thumbnails/" + val;
    if(fileExists(thumbnailPath) == true){
        logger.logit(logfilePath, thisModule, 'Thumbnail validation OK - ' + thumbnailPath + ' found.');
        returnResult = true;
    }else{
        logger.logit(logfilePath, thisModule, 'Thumbnail validation failed - ' + thumbnailPath + ' not found.');
    }
  });

  return returnResult;
}
      
/******************************************
  Validate OPF file
  -----------------
  Checks if 'content.opf' exists in path.
*******************************************/
function validateOPF(directory){
  var requiredOPFs = ['content.opf'];
  var OPFPath = null;
  var returnResult = false;
  _.each(requiredOPFs, function(val,key){
    OPFPath = directory + "/" + val;
    logger.logit(logfilePath, thisModule,'content.opf path is ' +OPFPath);    
    if(fileExists(OPFPath) == true){
        logger.logit(logfilePath, thisModule, 'OPF validation OK - ' + OPFPath + ' found.');
        returnResult = true;
    }else{
        logger.logit(logfilePath, thisModule, 'OPF validation failed - ' + OPFPath + ' not found.');
    }
  });

  return returnResult;
}

/******************************************
  Checks if path exists
*******************************************/
function pathExists(directory){
  try{
    var stats = fs.lstatSync(directory);
    return stats.isDirectory();
  }
  catch(e) {
  }
}

/******************************************
  Print out help and stop (-h argument)
*******************************************/
function assist(){
  var assistMessage = [
              " ",
              __filename.split("/").pop(),
              " ",
              "This daemon will post process BEC Reader data by scrutinizing and manipulating",
              "data in a given extraction location and deposit the result in a post process",
              "directory. It will then handoff (publish) this information.",
              " ",
              "The following options are available when starting this daemon:",
              " ",
              "-h --help Display (this) help.",
              "\n--sub\tSubscription key, this is the binding key that will trigger this process.",
              "\t(Optional, default: package.publish.postProcess",
              "\n--pub\tPublication key, this is the binding key when returning the process results.",
              "\t(Optional, default: content.package.upload",
              "\n--util\tUtility key, this is the binding key used to invoke a utility worker.",
              "\t(Optional, default: utility.pdm2db.postprocess",
              "\n--exchng\tAMQP exchange to be connected to.",
              "\t(Optional, default: ex_node_pp",
              " "
            ];

  assistMessage.forEach(function(assistLine){console.log(assistLine);});
}

/******************************************
  Checks if file exists
  ---------------------
*******************************************/
function fileExists(filepath){      
  try{
    var stats = fs.lstatSync(filepath);
    return stats.isFile();
  }
  catch(e){
  }
}

/**************************************************************
  Validate AMQP payload
  ---------------------
  Checks if hash and SKU are present and of the correct length
  @todo Needs to take on more sophistication.
***************************************************************/
function validateAMQPMessage(m){
  if(m.hasOwnProperty('body') === true) { 
    if(m.body[0].length > 0 && m.PackageSKU.length === 6){
      return true;
    }
  }
  return false;
}

/******************************************************
  Extract source line number from error trace content.
*******************************************************/
function extractLineno(traceContent){
  var lineNumberIndex = 3;
  var resultLineno = 0;

  try{
    var arrTrace = traceContent.split(':');
    resultLineno = arrTrace[lineNumberIndex];
  } catch(err) {}
  
  return resultLineno;
}

/****************************************************************************************** 
  S C R A T C H P A D
  ===================

  Message content expectation (~minimum needed):
  ---------------------------------------------

  Getting from Jose:
  ------------------
  "action" => "IngestAsset",
  "action_id" => $action_id,
  "operation" => "PostProcessAsset",
  "package_sku" => $package_sku
  "package_ext_location" => $extract_location,


  Return to Jose:
  ---------------
  "body":[
    {
      "directory": "/home/jrodriguez/assets/html/test_html/",
      "package_hash":"63d78ec3d9e0330dc4b407a652ef8f6b",
      "package_sku": "S05216",
      "env" : "demo",
      "tev" : "image"
    }
  ]

*******************************************************************************************/

/* EOF @name BecReaderPostProcessd.js [yeh] */
