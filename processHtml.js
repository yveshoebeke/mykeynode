/******************************************************************************************************************************
  @name     ingestStep2PostProcess.js
 
  @internal Point at a directory of ebooks and this will:
            [1] Concatenate css files into each html file
            [2] Prepend the product code
            [3] Create a toc
            [4] With the -b param it will create substitute absolute 
                URLs for every image in html and css and font
                and will put absolute URLs into SMIL files.
            [5] With the -e param it will write out an processed 
                directory for eBook testing in the Impelsys 
                eReader rig.

  @copyright  Benchmark Education Company

  @author   Keith Laverty & Bob Gulian
  @Version  0.0 2014
  @internal Initial code from file baseProcess.js.

  @author   dswitzer@benchmarkeducation.com [djs]
  @Version  1.1 2014-10-16
  @internal Initial code changed from file baseProcess.js.

  @author   yhoebeke@benchmarkeducation.com [yeh]
  @Version  1.2 2015-03-10
  @internal Code clean up and library update.

------------------------------------------------------------------------------------------------------------------------------

  Derived from baseProcess.js (see: git@git.benchmarkconnect.com:internal-products/XMLtoHTMLeBookConversion.postproc.git)

  These are the legacy comments:

       Note: most, if not all, original in-line comments were preserved. Console.log() chatter was replaced with logging logic.

        baseProcess.js - point at a directory of ebooks and this will:
        1. concatenate css files into each html file
        2. prepend the product code
        3. create a toc

        4. with the -b param it will create substitute absolute URLs for every image in html and css and font
             and will put absolute URLs into SMIL files.  
        5. with the -e param it will write out an processed directory for eBook testing in the Impelsys eReader rig.

  Original creation (approx. 1st quarter, 2015 or late 2014) by:
                                                    Author: Keith Laverty
                                                    Technical Resource: Bob Gulian

******************************************************************************************************************************/

exports.baseProcess = function(path, root, baseUrl, folder){
  var htmlparser = require("htmlparser2");
  var utils = require("./utils");
  var processEbookPage = require("./processHtml");

  /**********************************************************
    No longer needed, values passed as parameters and since
    this is all now wrapped up in a daemon, parameter passing
    is no longer available.
    
    Left here for reference only (may be removed later)[yeh]
    ---------------------------------------------------------
    var path = argv.d;
    var root = argv.r;
    var baseUrl = argv.b;
  ***********************************************************/

  var pages = {};
  var htmls = [], images=[], smils = [], csses = [];
  var curbook_pass = null;

  var thisModule = __filename.split("/").pop();
  logger.logit(logfilePath, thisModule, " In baseProcess with path:" + path + " root:" + root + " baseUrl:" + baseUrl);

  var findThumb = function(list, comp) {
    var comp2="";
    for (var i=0; i < list.length; i++) {
        var arr2 = list[i].split(".");
        
        comp2 = arr2[0];

        if (comp == comp2) {
          return list[i];
        }
      }
      return null;
  }

  var processThumbnails = function (bookname,localPath,pages) {
    if (!fs.existsSync(localPath + "/" + bookname +  "/thumbnails")) {
      return;
    }
    var list = fs.readdirSync(localPath + "/" + bookname +  "/thumbnails");
    var comp = "";
   
    var pgs = pages[bookname].pages;
   
    _.each(pgs, function(val, key) {
      if (typeof val.gameType == 'undefined') {   // game thumbnails included in game
        var arr = val.html.id.split("_");

        if (arr.length > 2) {
          comp = val.html.id;
        } else  {
          comp = arr[0];
        }

        var thumb = findThumb(list,comp);

        if (thumb) {
          val.thumbnail.id = comp;
          val.thumbnail.cont = "../../thumbnails/" + thumb;  // mutable?
        }
      }
    });
  //  var spreads = pages[s]
  }

  // Makes a bookobj for each book
  var bookObj = function() {
    var htmls = [], images=[], smils = [], csses = [], theRest=[], fonts=[], gamefiles=[]; 
    var name="";
    var curbook_pass= null;
    var const_undefined=-1;
    var const_false = 0;
    var const_true = 1;
    var dualFont=const_undefined;

    var gametypes = ["3d-carousel",
                    "dd-fib",
                    "dnd-fill",
                    "dnd-labels",
                    "dnd-scramble",
                    "dnd-sort",
                    "dynamic-cards",
                    "graphic-organizer",
                    "image-gallery",
                    "match-picture-text",
                    "match-text",
                    "mcq-images",
                    "mcq-listen",
                    "mcq-text",
                    "sentence-scramble",
                    "tab"];
    var gameThumbs = ["3d-carousel.png",
                    "dd-fib.png",
                    "dnd-fill.png",
                    "dnd-labels.png",
                    "dnd-scramble.png",
                    "dnd-sort.png",
                    "dynamic-cards.png",
                    "graphic-organizer.png",
                    "image-gallery.png",
                    "match-picture-text.png",
                    "match-text.png",
                    "mcq-images.png",
                    "mcq-listen.png",
                    "mcq-text.png",
                    "sentence-scramble.png",
                    "tab.png"];

    var getPageIdFromFileName = function(fileName) {
      logger.logit(logfilePath, thisModule, "@getPageIdFromFileName fileName=" + fileName);

      var fNameArr = fileName.split(".");
      var rePage = /(page_|pg|page)(\d+)/;
      var arrRes = fNameArr[0].match(rePage);
      if (!arrRes) {
        return fNameArr[0];  // it's a name, not a number
      }
      pageId = utils.trimNumber(arrRes[2]);

      return pageId;
    }

    var findHtmlPage = function (pageId) {
      var pid = pageId;
      var matchStr = _.find(this['htmls'], function(s){
        var fname = utils.filename(s);
        if (fname.split('.')[0] == pid) {
          return s;
        }
      });

      return matchStr;
    }

    var findGameFiles = function(gameId) {
     var arr =[];
     // thanks SpiralScout for naming the game "3d". What's so 3d about it anyway? (hmm? this came from one of the original authors [yeh])
     var sgameId = (gameId.match(/3d-carousel.*/))?"carousel":gameId;
      var rex = RegExp(sgameId + "\\.*"); 
     _.each(this['gamefiles'],function(val,key) {
        var a = val.split(".");
        if (a[a.length-1] == "ini") {
          if (val.match(rex)) {
            arr.push(val);
          }
        }
      });
      return arr;
    }

    var findGameThumbUrl = function(gameId) {
      var thumbFile = "";
      var sgameId = (gameId.match(/3d-carousel.*/))?"carousel":gameId;
      var rex = RegExp(sgameId + "\\.*");

      _.each(this.gameThumbs,function(val,key) {
        if (val.match(rex)) {
            thumbFile = val;
        }
       });
       return thumbFile;
    }

    var isGameType = function(pageId) {
      var gameFound = null;
      _.each(this.gametypes,function(val,key) {
        var rex = RegExp(val + "\.*");  //like "dnd-fill" or "dnd-fill1"
        if (pageId.match(rex)) {
            gameFound = val;
        }
      });

      return gameFound;
    }

    var findMatchByType = function(orig, sType) {
      var arr=this[sType];
      var filename = utils.filename(orig);
      
      pageId = getPageIdFromFileName(filename);

      var matchStr = _.find(arr, function(s){ 
        var fname = utils.filename(s);
        newPageId = getPageIdFromFileName(fname);
        if (pageId == newPageId) {
          return s;
        }
      });

      return matchStr;
    }

    var produceEReaderReady = function(page, spread, bookO) {
      var efolder = folder + "/" + this.name;
      var exists = fs.existsSync(folder);

      logger.logit(logfilePath, thisModule, "@produceEReaderReady with folder = "+folder+" and efolder = "+efolder);

      if (!exists) {
        fs.mkdirSync(folder);
      }

      exists = fs.existsSync(efolder);

      if (!exists) {
        fs.mkdirSync(efolder);
      }

      var j = "";
      var toc = page.tocpage;
      var err, arr=null;
      var bookTypeArray 

      if (bookO.dualFont == bookO.const_true) {
        arr = utils.splitDualFontPage(page.html,2);
        bookTypeArray =["","_u"];  // process default font book and universal
      } else {
        bookTypeArray =[""];  // process default font book 
        arr = utils.splitDualFontPage(page.html,1);
      }

      _.each(bookTypeArray, function(val,key) {
        var relPOPath = "/pageObjects" + val + ".js";
        exists = fs.existsSync(folder + relPOPath);

        if (!exists) {
          var newSpread = spread.substr(spread.indexOf(":") + 1);
          j = "controller.spread =  " + newSpread ;
          err = fs.writeFileSync(folder + relPOPath, j);
          j = "\ncontroller.pageObjects = [\n";
          err = fs.appendFileSync(efolder + relPOPath,j);
          curbook_pass = null;
        } else {
          err = fs.appendFileSync(efolder + relPOPath,",\n");
        }

        var pageBuf = "";

        if (val == "_u" && arr) {
           pageBuf = arr[1] + arr[2];  /* universal classes + html*/
        } else if (arr) {
           pageBuf = arr[0] + arr[2];  /* default classes + html */
        } else {
           pageBuf = page.html;
        }

        if (toc.html) {
          toc.html.cont = new Buffer(pageBuf).toString('base64');
        }

        if (toc.audio && val == "") {  // only assign new buf first time throught loop
          if (page.smil) {
            toc.audio.cont = new Buffer(page.smil).toString('base64');
          }
        }
        /*
          write out processed page for testing with EReader
          err = fs.writeFileSync(folder + "/" + toc.id + ".page",JSON.stringify(toc));
        */
        err = fs.appendFileSync(folder + relPOPath ,JSON.stringify(toc));
      });

      curbook_pass = efolder + "/pageObjects.js";
      return (efolder + "/" + toc.id + ".page");
    }

    var getSpread = function(localPath) {
     try {
      var s =fs.readFileSync(localPath + "/spread_index/spread-index.json",'utf8');
     } catch (exc) {
      logger.logit(logfilePath, thisModule, "@getSpread with error: " + exc);
     }
     
     return s;
    }

    var findAbsoluteURL = function(sType, relPath) {
      // If not eReady we want an ePresenter books
      if (!folder) {
        return relPath;
      }

      var arr=this[sType],rp = relPath;
     
      var rarr = rp.split("/");
      var rex = "";

      for (var i=0; i < rarr.length; i++) {
        if (rarr[i] != ".." && rarr[i] != "." && rarr[i] != "") {
          rex +=rarr[i]
          if (i != (rarr.length-1)) {
            rex += '\/';
          }
        }
      }
     
      rex = utils.escapeRegExp(rex);  // make sure things like ( ) and & and  . are escaped.

      var matchStr = _.find(arr, function(s){
         var us = unescape(s);        // search string should be unescaped so we're not trying to match %28 and such
         if(us.match(rex)) {
            return s;                 // in the end, return escaped string (URL)
         }
      });

      return matchStr;
    }

    return {
      htmls : htmls,
      images : images,
      smils : smils,
      const_undefined : const_undefined,
      const_false : const_false,
      const_true : const_true,
      csses : csses,
      dualFont : dualFont,
      fonts : fonts,
      gamefiles : gamefiles,
      gametypes : gametypes,
      gameThumbs : gameThumbs,
      isGameType : isGameType,
      name : name,
      theRest : theRest,
      findAbsoluteURL : findAbsoluteURL,
      findGameFiles : findGameFiles,
      findGameThumbUrl : findGameThumbUrl,
      findHtmlPage : findHtmlPage,
      findMatchByType : findMatchByType,
      getSpread : getSpread,
      produceEReaderReady : produceEReaderReady
    }
  };

  /****************************** GLOBAL CODE ******************************
   Walk through the directory structure, bundle up resources for matching
   against internal references later.
  **************************************************************************/
  var books = {};
  var rp = fs.realpathSync(path);

  var curDir = "";
  var walk = function(dir, curBook,done) {
    curDir = dir;
    var results = [];
    var lcb = curBook;

    list = fs.readdirSync(dir);
     
      var pending = list.length;
      if (!pending) return done(null, results);
      list.forEach(function(file) {
        file = dir + '/' + file;
        logger.logit(logfilePath, thisModule, "File being processed " + file);

       //stat = fs.statSync(file);

       // if (stat && stat.isDirectory()) {
       //  walk(file, lcb,function(err, res) {
       //    if (!--pending) {
       //        done(null, res);
       //    }
       //    //curDir = dir;
       //  });
       //  curDir = dir;
       // } else {
        //var arr = file.split(root);
        
        var sFileName = GLOBAL.fp.basename(file); 

        var rfile = baseUrl + escape(sFileName);  /*arr[1]*/
        var reIndex = /\/index\.html/;
        var reHtml = /\/html\//;
        var reSmil = /\.smil/;
        var reImg = /\/images\//;
        var reCss = /\/css\//;
        var reFonts =  /\/fonts\//;

        var shortDir = utils.fileNameFromPath(curDir);  //gets last item not basename

        if (file.match(reHtml) && !file.match(reIndex)) {
          lcb.htmls.push(rfile);
        } else if (file.match(reImg)) {
          lcb.images.push(rfile);
        } else if (file.match(reSmil)) {
          lcb.smils.push(rfile);
        } else if (file.match(reCss)) {
          lcb.csses.push(rfile);
        } else if (file.match(reFonts)) {
          lcb.fonts.push(rfile);
        } else if (shortDir == "games") {
          lcb.gamefiles.push(rfile);
        } else {
          lcb.theRest.push(rfile);
        }

        if (!--pending) done(null, curBook);
      // }
    });
  };

  var deleteProcessedDirs = function() {
    execSync("rm -rf `find " + rp + " -type d -name \"newHtml\"`");
    execSync("rm -rf `find " + rp + " -type d -name \"eReady\"`");
  }

  var doneDirs = false, process = false;

  function go(cb) {
    //BEGIN PROCESSING - read batch
    var done = cb;

    //fs.readdir(rp, function(err, topdirs) { ... can not deal with async processes [yeh].
    //var topdirs = fs.readdirSync(rp);
    

      var lastDir="";

      //_.each(topdirs, function(val,key) {
        var val = "/";

        var reIndex = /index\.html/;
        var rePDM2 = /PDM2/;

        if (!val.match(reIndex) && !val.match(rePDM2)) {
          logger.logit(logfilePath, thisModule, "Processing:" + val);

          books[val] = new bookObj();
          books[val].name = val;
          lastDir = val;
          //var localPath = rp + "/" + val;
          var localPath = rp + val;

          utils.getContentObject(localPath, function(jObj) {

            walk(rp + "/" + val, books[val], function(err,curBook,results) {
              if (err) logger.logit(logfilePath, thisModule, "@walk with error: " + err);
              // Now we can process at book

              if (curBook.name != 'eReady') {
                process = true;
              
                processEbookPage(curBook,localPath,true,jObj, function (page) {fs.readdir
                  process = false;
           
                  var spreadJSON = curBook.getSpread(localPath);
                  
                  var tocpage = JSON.parse(JSON.stringify(page.tocpage));  // clone toc before we mess it up
                  if (typeof pages[curBook.name] == 'undefined'){
                    var spread = spreadJSON.split(/:(.+)?/)[1];
                    //var bookTile = jObj.metadata.
                    var bookTitle = jObj.package.metadata[0]['dc:title'][0];
                    pages[curBook.name] = { "id" : curBook.name, "bookTitle": bookTitle,"spreads": JSON.parse(spread),"pages":[]};
                  }

                  pages[curBook.name].pages.push(tocpage);

                  if (page.smil != "") {
                    //logger.logit(logfilePath, thisModule, "@walk-2: " + page.smil);
                  }

                  if (folder) {
                    curBook.produceEReaderReady(page,spreadJSON,books[val]);
                  }

                  if (doneDirs) {
                    done(pages); 
                  }
                });
              } 
            }); // end of walk
          }); // end of getContentObject
        }
      //});

      doneDirs = true;

      if (process == false) {
        done(pages);
      }
    //}); fs.readdir (async) artifact)[yeh]
  }

  deleteProcessedDirs();
    
  go( function(pgs) {
    _.each(pgs, function(val,key) {
      if (!folder) {
        processThumbnails(key,rp,pgs);
      }

      var s = JSON.stringify(val);
      if (folder) {
        fs.writeFileSync(folder + "/" + val.id + "/toc.json",s);
      }
  
      fs.writeFileSync(rp + "/" + val.id + "/toc.json",s);
  
      logger.logit(logfilePath, thisModule, "Created: " + rp + "/" + val.id + "/toc.json")

      if (folder) {
          var err = fs.appendFileSync(folder + "/" + val.id + "/pageObjects.js","]");
          var err_u = fs.appendFileSync(folder + "/" + val.id + "/pageObjects_u.js","]");  
      }
    });
  });

  if(errDescription != ""){
    var disposition = {result:false, errors:errDescription};
  } else {
    var disposition = {result:"ok"};
  }

  var returnResult = disposition;
  disposition = {};
  errDescription = "";

  return returnResult;

}
