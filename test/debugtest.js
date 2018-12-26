
var ZShepherd = require('zigbee-shepherd');
var zserver = new ZShepherd('/dev/ttyACM0', { sp: {baudRate: 115200, debug: true}, dbPath: '../../../iobroker-data/zigbee_0/shepherd.db'});
// https://github.com/zigbeer/zcl-id/wiki
var zclId = require('zcl-id');

// hue sniffing
// https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/Philips-Hue-sniffing

const readline = require('readline');
const rl = readline.createInterface({
	  input: process.stdin,
	  output: process.stdout
	});

zserver.on('ready', function () {
    console.log('Server is ready.');
    console.log(zserver.info());
    console.log(zserver.list());

//var result = zserver.lqi('0x00178801032a6277', function (err, data) {
//    console.log("Lqi: "+ err);
//    console.log(data);
//});
//    console.log(result);
    
    zserver.acceptDevIncoming = function (devInfo, callback) {
		//if (devInfo.ieeeAddr === '0x00124b0001ce4beb')
		//    callback(null, false);
		//else
		    callback(null, true);
    };
    
    ask();
});

zserver.on('error', function(err) {
    console.log('error',err);
});

zserver.start(function (err) {
    if (err)
        console.log(err);
});


function loop() {
	    var ep = getEp();
	    ep.read('genBasic', 'manufacturerName', function (err, data) {
        console.log("read "+err+",  data " + data);   // 'TexasInstruments'
   });
   ep.foundation('genBasic', 'read',  [{attrId:3}, {attrId:16384}], function (err, data) {
          console.log("read "+err+",  data" + data);   // 'TexasInstruments'
          console.log(data);
    });
//   setTimeout(loop, 1000);
}


function listen() {
	zserver.on('ind:incoming', function (dev, data) {
	    log('inc');
	    console.log(data);
	});
	zserver.on('ind:changed', function (dev, data) {
		log('chg');
//	    console.log('chg '+data);
	    console.log(data);
	});
	zserver.on('ind:status', function (dev, data) {
	    log('status ');
	    console.log(data);
	});
	zserver.on('ind:attReport', function (dev, data) {
	    log('attRep ');
	    console.log(data);
	});

	zserver.on('ind:reported', function (dev, data, data2) {
	    log('ind:reported ');
//	    console.log(dev);
	    var cid = data;
	    console.log(zclId.cluster(cid).key);
	    console.log(data2);
	});
}

function log(text) {
	var time = new Date();
	console.log((new Date()).toISOString() + ': '+ text);
}


function ask() {
	console.log('\n####################\n'+
			'1: read                     100: printAttrList\n'+
			'2: send foundation\n3: testRead\n4: attrList\n'+
			'7: testAttrList\n'+
			'9: start listening');
	rl.question('Choice? ', (answer) => {
		  if (answer == 1) {
			  cmd = zclId.foundation('read').value;
			  
			  askCid('msOccupancySensing', (cid) => {//0x0406
				  askAttr(cid, 'pirOToUDelay', (attrId) => {
					  send(cid, cmd, attrId);
				  });
			  });	
		  }
		  else if (answer == 2) {
			  console.log("run");
//			  var defaultCid = 'msTemperatureMeasurement';//0x0402
			  askType = function (cid, cmd, attrId) {
				  console.log(' ');
				  printTypeList(cid);
				  rl.question('Type? ', (type) => {
					  if (type) {
						  type = parseInt(type);
					  }
					  askValue(cid, cmd, attrId, type);
				  });
			  };
			  
			  askValue = function (cid, cmd, attrId, type) {
				  console.log(' ');
				
				  rl.question('Value? ', (value) => {
					  send(cid, cmd, attrId, type, value);
				  });
			  };
			  
			  askCmd('read', (cmd) => {
				  askCid('msOccupancySensing', (cid) => {//0x0406
					  askAttr(cid, 'pirOToUDelay', (attrId) => { //'pirOToUDelay'
						  askType(cid, cmd, attrId);
					  });
				  });	
				  
			  });			
		  }
		  else if (answer == 3) {
			  send('msTemperatureMeasurement', 'read', 0);
		  }
		  else if (answer == 4) {
			  rl.question('eg. genDeviceTempCfg\ncid? ', (cid) => {
				  printAttrList(cid); 				
			  });			  
		  }
		  else if (answer == 7) {
			  askCid('msOccupancySensing', (cid) => {
				  rl.question('startId [0]? ', (startAttrId) => {
					  if (!startAttrId) {
						  startAttrId = 0;
					  }
					  rl.question('maxId [50]? ', (maxAttrId) => {
						  if (!maxAttrId) {
							  maxAttrId = 50;
						  }
						  testAttr(cid, 'read', startAttrId, maxAttrId);
					  });
				  });				  
			  });
			  
		  }
		  else if (answer == 9) {
			  listen();
			  ask();
		  }
		  else if (answer == 100) {
			  askCid('msOccupancySensing', (cid) => {
				  console.log('');
				  printAttrList(cid);
				  ask();
			  });
		  }
		  else {
			  console.log("undefined");
			  ask();
		  }
//		  rl.close();

		});
}

function askCmd(defCmd, callBack) {
	console.log(' ');
	printCmdList();
	var defaultCmd = zclId.foundation(defCmd).value; ;
	rl.question('cmd? ['+zclId.foundation(defaultCmd).key+'] ', (cmd) => {
		  if (!cmd) {
			  cmd = zclId.foundation(defCmd).value;
		  }
		  else {
			  cmd = parseInt(cmd);
		  }
		  callBack(cmd);
	});
}

function askCid(defCid, callBack) {
	var defaultCid = zclId.cluster(defCid).value; ;
	rl.question('cid? ['+zclId.cluster(defaultCid).key+'] ', (cid) => {
		  if (!cid) {
			  cid = defaultCid;
		  }
		  else {
			  cid = parseInt(cid);
		  }
		  callBack(cid);
	});
}

function askAttr(cid, defaultAttrId, callBack) {
	console.log(' ');
	printAttrList(cid);
	var attrDef = zclId.attr(cid, defaultAttrId);
	var defaultName = 'not found';
	if (attrDef !== 'undefined') {
		defaultName = attrDef.key;
	}
	rl.question('attr ['+defaultName+']? ', (attrId) => {
		  if (!attrId) {
			  
			  if (attrDef !== 'undefined') {
				  attrId = attrDef.value;
			  }
			  attrId = attrId;
		  }
		  else {
			  attrId = parseInt(attrId);
		  }
		  callBack(attrId);		  
	});
}

function printCmdList() {	
	  for (var i=0; i< 23; i++) {
		  var cmdDef = zclId.foundation(i);
		  if (cmdDef) {
			  console.log(cmdDef.value+ ': '+ cmdDef.key  );
		  }
	  }
}

function printAttrList(cid) {
	var attrList = zclId.attrList(cid);
	  for (var i=0; i< attrList.length; i++) {
		  var id = attrList[i].attrId;
		  console.log('0x'+id.toString(16)+' ' +id+ ': '+ zclId.attr(cid, id).key  );
	  }
}

function printTypeList() {
	for (var i=0; i< 82; i++) {
		  var typeDef = zclId.dataType(i);
		  if (typeDef) {
			  console.log(typeDef.value+ ': '+ typeDef.key  );
		  }
	  }
}

function read() {
	var ep = getEp();
//  console.log(ep);
	ep.read('genBasic', 'manufacturerName', function (err, data) {
		console.log("read "+err+",  data " + data);   // 'TexasInstruments'
	    ask();
	});
}

function send(cid, cmd, attrId, type, value, callback) {
	// endpoint.foundation = function (cId, cmd, zclData[, cfg], callback) {};
	// endpoint.functional = function (cId, cmd, zclData[, cfg], callback) {};
	if (!callback) {
		callback = function (err, data) {
			if (err) {
				console.log(err);
				ask();
				return;
			}
			
			console.log('\nR ');
		    console.log(data);
		    var statusCode;
		    var dataType;
		    if (Array.isArray(data)) {
			    statusCode = data[0].status;
			    dataType = data[0].dataType;
			}
		    else {
		    	statusCode = data.statusCode;
		    }
		    console.log("Statuscode "+statusCode+": "+zclId.status(statusCode).key);
		    ask();
		};
	}
	var ep = getEp();

	var typeValueString = '';
	if (type && value) {
		typeValueString = ' type 0x' + type.toString(16)+ ' ('+value
				+') value 0x' + value.toString(16)+ ' ('+value+')';
	}
	log('Send cid 0x' + cid.toString(16)+' ('+cid+') cmd 0x' + cmd.toString(16)+ ' ('+cmd 
			+ ') attr 0x' + attrId.toString(16)+ ' ('+attrId+ ')' + typeValueString);
	//zclId.attr(cid, attrId).value
	var zclData;
	if (type && value) {
		zclData = [{attrId: attrId, dataType: type, attrData: value}];
	}
	else {
		zclData = [{attrId: attrId}];
	}
	ep.foundation(cid, cmd, zclData, callback);
//	ep.foundation(cid, cmd, [{attrId: zclId.attr(cid, attrId).value}], callback);
	
//	ep.foundation(cid, cmd, [{attrId: 48, dataType: 0x20,
//	    attrData: x}], callback);
	
//	  cid: 'msIlluminanceMeasurement',
//      cmd: 'configReport',
//      cmdType: 'foundation',
//      zclData: [{}],
}

function testAttr(cid, cmd, startId, maxId) {
	var attrId = parseInt(startId);
	const maxAttrId = parseInt(maxId);

	callBack = function (err, data) {
		if (Array.isArray(data)) {
		    statusCode = data[0].status;
		    dataType = data[0].dataType;
		}
	    else {
	    	statusCode = data.statusCode;
	    }
		var statusString = zclId.status(statusCode).key;
		if (statusCode == 0) {
			statusString = '\x1b[33m'+statusString+'\x1b[0m';
		}
		else {
			statusString = '\x1b[31m'+statusString+'\x1b[0m';
		}
	    console.log(attrId+' of '+maxAttrId+' Status '+statusCode+": "+statusString +' result: '+JSON.stringify(data));
	    
	    attrId = attrId+1;
	    if (attrId > maxAttrId) {
	    	ask();
	    	return;
	    }
	    testAttrRun();
	}
	testAttrRun = function() {
		send(cid, cmd, attrId, null, null, callBack);		
	}
	testAttrRun();
}

function getEp() {
   var ep = zserver.find('0x00178801032a6277', 2);    // returns undefined if not found
   return ep;
}

/*
 * Original values:
 * pirOToUDelay =  attrId: 0, dataType: 41, attrData: 2126
	18: pirUToOThreshold = unsupAttribute

 * 
 *	cid 0x406 (1030) cmd 0x0 (0) attr 0x10 (16)
 	[ { attrId: 16, status: 0, dataType: 33, attrData: 0 } ]

 * 
 */
 

