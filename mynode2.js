var myMsg = "";

exports.setData = function(msg){
	myMsg = msg;
	console.log(msg);
	console.log(myMsg);
}

exports.getItOut = function(){
	addToIt("added this");
	console.log('mynode2 says: '+myMsg);	
}

function addToIt(addOn){
	myMsg = myMsg + ' ' + addOn;
