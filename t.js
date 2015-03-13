var data = {"base":"First base","action":"ingest_batch","body":["/var/int_ingest_dev_assets/BEC/Navigators/english/Great_Inventions__9027/Beta_4/Great_Inventions__9027"],"operation":"IngestAsset","batch_id":"ingest_batch_id_20150313_091139_54330700","batch_action":"ingest_batch","batch_total":1,"batch_item":1};

console.log("======================================");

console.log("action:");
console.log(data.action);
console.log("operation:");
console.log(data.operation);
console.log("body:");
console.log(data.body);

if (typeof(data.base) != "undefined"){
	var baseUrl = data.base;
} else {
	var baseUrl = null;
}

console.log("base:");
console.log(baseUrl);

//console.log(require.paths);
