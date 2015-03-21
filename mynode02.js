var mynode02Something = "express train to Timboktu";

/*
String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}
*/

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

exports.sayHello = function(name){
	if (typeof name === 'undefined') { name = "bob" }

	var mystring = "Hello " + capitalizeFirstLetter(name) + ", are you taking the " + mynode02Something + "?";
	console.log(mystring);
}

