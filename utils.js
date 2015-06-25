//utils .js - node extensions
var thisModule = __filename.split("/").pop();

exports.print_r = function(obj, displayElement){
	var lobj = obj;
	(function() {
		var tabs = "";
		function __print_r(string, object){
			if (object){
				var obj1 = object;
				tabs += "\t";
			} else {
				var obj1 = lobj;
			}
			var str = string || "";
			var str = typeof obj1 + " (" + "\n";
			for (var i in obj1){
				str += tabs + "[" + i + "]" + " => " + ((typeof obj1[i] == "object")? __print_r(str, obj1[i]): obj1[i])+ "\n";
			}
			str += ")";
			return (str);
		}
		if (displayElement){
			$("#" + displayElement).html(__print_r());
		} else {
			console.log(__print_r());
		}
	})();	
};

exports.readDataFileSync = function(file) {
	var s = fs.readFileSync(PP_SCRIPT_DATA + "/" + file);
	return s;
}

exports.readDataFileASync = function(file, callback) {
	var cb = callback;
	//var s = fs.readFile(PP_SCRIPT_DATA + "/" + file, function(data) {
	var s = fs.readFileSync(PP_SCRIPT_DATA + "/" + file, function(data) {
		return cb(data);
	});

}

exports.filename = function(filePath) {

	var i = filePath.lastIndexOf('/'), fileName=filePath;
//error_log("filename func i,filePath=" + i + "," + fileName);
	if (i != -1) {
		fileName = filePath.substr(i+1);
	} else {
        return null;
    }
    return fileName;
}

exports.trimNumber = function(s) {
  while (s.substr(0,1) == '0' && s.length>1) { s = s.substr(1,9999); }
  return s;
}

exports.fileNameFromPath = function(fullPath) {
	return fullPath.replace(/^.*(\\|\/|\:)/, '');
} 


exports.getContentObject = function (path, callback) {
    logger.logit(logfilePath, thisModule, "Processing:" + path);

	var cb = callback;
	var parser = new xml2js.Parser();
	data = fs.readFileSync(path + "/" + "content.opf","utf8");

	parser.parseString(data, function (err, result) {
		cb(result);
	});
	
}

exports.makeCSSUniversalName = function (filename) {
	var arr = filename.split(".");
	var s = arr[0] + "_u" + "." + arr[1];
	return s;

}

exports.splitDualFontPage = function(buffer,numCSSParts) {
//console.log("WHOLE page = " + buffer);
debugger
	var arr=null,subarr;
	

	if (numCSSParts == 2) {
		arr = buffer.split("/* UNIVERSAL */");
	 	if (arr.length > 1) {
	 		subarr = arr[1].split("/* END */");
	 		arr[1] = subarr[0];
	 		arr[2] = subarr[1];
	 	}
	 	
	} else {


	}
	return arr;
}

exports.escapeRegExp = function(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
