const path = '/tmp/';
var ZShepherd = require('zigbee-shepherd');
var zserver = new ZShepherd('/dev/ttyACM0',
        {   net: {panId: 0x1a62, channelList: [11]},
            sp: {baudRate: 115200, debug: true}, 
        dbPath: path+'shepherd.db'});
//        dbPath: '../../../iobroker-data/zigbee_0/shepherd.db'});
// https://github.com/zigbeer/zcl-id/wiki
var zclId = require('zcl-id');
var util = require('util');

// hue sniffing
// https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/Philips-Hue-sniffing

const readline = require('readline');
const rl = readline.createInterface({
	  input: process.stdin,
	  output: process.stdout
	});

const logset =  {
        depth: 99,
        colors: true,
        breakLength: 300,
      };
var filterActive = false;
var filterCid = 'msOccupancySensing';

var activeIeee = null;
var activeEp = null;
var activeCfg = {};

var exit_on_sigint = true;
process.on('SIGINT', function() {
    console.log("Caught interrupt signal");

    if (exit_on_sigint) {
        stop();
        process.exit();
    }
    exit_on_sigint = true;
    ask();
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
        console.log('acceptDevIncoming' +JSON.stringify(devInfo));
		//if (devInfo.ieeeAddr === '0x00124b0001ce4beb')
		//    callback(null, false);
		//else
		    callback(null, true);
    };
    
    ask();
});

zserver.on('error', function(err) {
    log(null, 'error',err);
});

zserver.on('permitJoining', function(time) {
    log(null, 'Time left: '+time, 'permitJoining');
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


const cidFilter = function(data) {
	if (!filterActive) {
		return false;
	}
	var cid;
	if (typeof data !== 'undefined') {
		if (typeof data === 'object' && typeof data.cid !== 'undefined') {
			cid = data.cid;
		}
		else if ((typeof data === 'string' && data.length > 10) || typeof data === 'number') {
			cid = data;
		}
	}

	if (typeof cid !== 'undefined' 
			&& cid != zclId.cluster(filterCid).value && cid !== zclId.cluster(filterCid).key) {
		if (cid !== 'undefined') {
//			console.log('filtered '+cid);
		}
		else {
			console.log('filtered '+util.inspect(data));
		}
		return true;
	}
//	console.log('UNfiltered '+util.inspect(cid, logset) + ' isString '+(typeof data));
	return false;
}

function stop() {
    console.log('Stop server.');
    zserver.stop();
}

function listen() {
    zserver.on('ind:incoming', function (dev, data) {
        var cid = dev.endpoints[2].clusters.msOccupancySensing.dir.cid;
        if (cidFilter(data)) {		return;		}
        log(dev, dev.endpoints[2].clusters.msOccupancySensing, 'ind:incoming');
    });
    zserver.on('ind:changed', function (dev, data) {
        if (cidFilter(data)) {		return;		}
        log(dev, data, 'ind:changed');
    });
    zserver.on('ind:status', function (dev, data) {
        if (cidFilter(data)) {		return;		}
        log(dev, data, 'ind:status');
    });
    zserver.on('ind:statusChange', function (dev, data) {
        if (cidFilter(data)) {		return;		}
        log(dev, data, 'ind:statusChange');
    });
    zserver.on('ind:attReport', function (dev, data) {
        if (cidFilter(data)) {		return;		}
        log(dev, data, 'ind:attReport');
    });
    zserver.on('ind:reported', function (dev, cid, data2) {
        if (cidFilter(cid)) {		return;		}
        log(dev, data2, 'ind:reported ', zclId.cluster(cid).key);
    });

    zserver.on('ind:cmd', function (dev, data) {
        if (cidFilter(cid)) {		return;		}
        log(dev, data, 'ind:cmd', zclId.cluster(cid).key);
    });
    zserver.on('ind:interview', function (dev, data) {
        if (cidFilter(data)) {		return;		}
        log(dev, data, 'ind:interview');
    });

}

function getEp() {
    if (activeIeee == null) {
        activeIeee = zserver.list().length > 1 ?  zserver.list()[1].ieeeAddr : null;
        if (activeIeee != null && activeEp == null) {
            activeEp = zserver.list()[1].epList[0];
        }
    }
    if (activeEp === null) {
        return null;
    }
    var ep = zserver.find(activeIeee, activeEp);    // returns undefined if not found
    return ep;
}

function log(dev, data, tag, cid) {
    var time = new Date();
    var devString;
    if (dev && typeof dev === 'object' && dev.hasOwnProperty('device')) {
        devString = '...'+dev.device.ieeeAddr.substring(14,18);
    }
    else {
        devString = ''.padEnd(7);
    }
    if (typeof tag !== 'string') {
        tag = '';
    }
    if (typeof cid !== 'undefined') {
        cid = cid.padEnd(30, ' ');
        tag = tag.padEnd(15, ' ') + cid;	
    }
    else {		
        tag = tag.padEnd(45, ' ');
    }
    process.stdout.write("\n"+time.toISOString()+'   '+devString+'   '+tag);
    process.stdout.write(util.inspect(data, logset));
}

defResultCallback = function (err, data, returnMenu = true) {
    if (err) {
        console.log(err);
        ask();
        return;
    }

    console.log('\nResult: ');
    console.log(data);
    var statusCode = -1;
    var dataType;
    if (Array.isArray(data)) {
        statusCode = data[0].status;
        dataType = data[0].dataType;
    }
    else if (data) {
        statusCode = data.statusCode;
    }

    if (typeof statusCode == 'number' && statusCode !== -1) {
        var statusInfo = zclId.status(statusCode);
        var statusString = statusInfo ? statusInfo.key : '?';
        console.log("Statuscode "+statusCode+": "+statusString);
    }
    else {
        console.log("Empty callback!");
    }
    if (returnMenu) {
        ask();
    }
};


function ask() {
    getEp();
    console.log(
            '\n###########################################\n'+
            '## Active: '+activeIeee+' ep '+activeEp+'\n'+
            '## Cfg: '+JSON.stringify(activeCfg)+'\n'+
            '#############################################\n'+
            '0: Choose device\n'+
            '1: read                        51: changeEndpoint         100: printCidList\n'+
            '2: send foundation                                     101: printAttrList\n'+
            '3: send functional\n'+
            '4: continous poll\n'+
            '5: configReporting\n'+
            '6: send raw\n'+
            '7: testAttrList\n'+
            '8: bindDevice                  58: toggleFilter\n'+
            '9: start listening\n'+
            '10: discover\n'+
            '20: startPair\n'+
            '30: Custom cfg\n'+
            '35: Save settings\n'+
            '36: Load settings           q: quit');
    rl.question('Choice? ', (answer) => {
        exit_on_sigint = false;
        if (answer === '0') {
            const devList = zserver.list();
            for (var i=0; i<devList.length; i++) {
                var dev = devList[i];
                console.log(i+': '+dev.manufName+' '+dev.modelId+' '+dev.ieeeAddr+' epList '+dev.epList);
            }
            rl.question('Select device? ', (answer) => {
                activeIeee = devList[answer].ieeeAddr;
                ask();
            });
        }
        else if (answer == 1) {
            cmd = zclId.foundation('read').value;

            askCid('msOccupancySensing', (cid) => {//0x0406
                askAttr(cid, 'pirOToUDelay', (attrId) => {
                    send(cid, cmd, attrId);
                });
            });	
        }
        else if (answer == 2) {
            console.log("run");
//          var defaultCid = 'msTemperatureMeasurement';//0x0402
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
            askCid('genGroups', (cid) => {
                askFunctionalCmd(0, cid, (cmd) => {
                    var data = {
                            cid: cid,
                            cmd: cmd,
                            zclData: { }
                    };
                    sendData(data, defResultCallback);
                });
            });
            
        }
        else if (answer == 4) {
            askCid('msOccupancySensing', (cid) => {//0x0406
                askAttr(cid, 'pirOToUDelay', (attrId) => { //'pirOToUDelay'
                    const poll = function() {
                        send(cid, 'read', attrId);
                        setTimeout(poll, 1000);
                    }
                    poll();
                });
            }); 
        }
        else if (answer == 5) {
            askCid('msOccupancySensing', (cid) => {//0x0406
                askAttr(cid, 'pirOToUDelay', (attrId) => {
                    askRaw('MinInverval (s)? ', (minVal) => {
                        askRaw('MaxIntervall (s)? ', (maxVal) => {
                            askRaw('Min value change to be reported? ', (chgBal) => {
                                var ep = getEp();
                                var result = ep.report(cid, attrId, minVal, maxVal, chgBal, defResultCallback);
//                              if (result) {
                                console.log(result);
//                              }
                            });
                        });

                    });


                });
            });	
        }
        else if (answer == 6) {
            askCid('hvacThermostat', (cid) => {
                askCmd('read', (cmd) => {
                    var zclData = {};
                    const askZcl = function() {
                        askRaw('PropertyName?', (propName) => {
                            if (propName === null) {
                                var ep = getEp();
                                try {
                                    console.log('Send foundation (cid '+cid+' cmd '+cmd+ ' zcl '+JSON.stringify(zclData)+' cfg '+JSON.stringify(activeCfg)+')');
                                    var maxLoop = -1;
                                    if (zclData.hasOwnProperty('attrId')) {
                                        var dashIdx = (''+zclData.attrId).indexOf('-');
                                        if (dashIdx > 0) {
                                            maxLoop = parseInt(zclData.attrId.substring(dashIdx+1));
                                            zclData.attrId = parseInt(zclData.attrId.substring(0, dashIdx));
                                        }
                                    }
                                    const run = function() {
                                        ep.foundation(cid, cmd, [zclData], activeCfg, function(err, data) {
                                            if (err) {
                                                console.log(err);
                                                askZcl();
                                            }
                                            else {
                                                defResultCallback(err, data, false);
                                            }
                                            if (maxLoop !== -1 && maxLoop > zclData.attrId) {
                                                zclData.attrId++;
                                                console.log('\nPoll next: '+zclData.attrId+'/'+maxLoop);
                                                run();
                                            }
                                            else {
                                                ask();
                                            }
                                        });
                                    };
                                    run();
                                } catch (exception) {
                                    console.log(exception.message);
                                    console.log(exception.trace);
                                    askZcl();
                                }
                            }
                            else {
                                askRaw('PropertyValue?', (propVal) => {
                                    zclData[propName] = propVal;
                                    askZcl();
                                });
                            }
                        })
                    };
                    askZcl();
                });
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
        else if (answer == 8) {
            askCid('msOccupancySensing', (cid) => {
                var coordinator = zserver.find(zserver.list()[0].ieeeAddr, 1);
                getEp().bind(cid, coordinator, defResultCallback);
            });
        }
        else if (answer == 9) {
            listen();
            ask();
        }
        else if (answer == 10) {
            askCid('msOccupancySensing', (cid) => {
                var zclData = {
                        startAttrId: 0, 
                        maxAttrIds: 100, 
//                      statusId: 0,
                };
                try {
                    var ep = getEp();
                    ep.foundation(cid, 'discover', zclData, defResultCallback);
                } catch (exception) {
                    console.log(exception);
                }
            });
        }
        else if (answer == 20) {
            zserver.permitJoin(60, function (err) {
                if (err)
                    console.log(err);
            }); 
            ask();
        }
        else if (answer == 30) {
            console.log('Set shepherd cfg settings like manufCode or manufSpec')
            rl.question('Cfg property? ', (prop) => {
                rl.question('Cfg '+prop+' value? ', (value) => {
                    activeCfg[prop] = parseInt(value);
                    ask();
                });
            });
        }
        else if (answer == 35) {
            var fs = require('fs');
            const json = JSON.stringify({
                actIeee: activeIeee,
                actEp: activeEp,
                cfg: activeCfg
            });
            const file = path+'setting_1.json';
            fs.writeFile(file, json, 'utf8', function(err) {
                if (!err) {
                    console.log('Saved to '+file);
                }
                else {
                    console.log('Save result '+err);
                }
                ask();
            });
        }
        else if (answer == 36) {
            var fs = require('fs');
            fs.readFile(path+'setting_1.json', 'utf8', function (err, data){
                if (err){
                    console.log('Load error: '+err);
                } 
                else {
                    data = JSON.parse(data); //now it an object
                    console.log('Load '+JSON.stringify(data));
                    activeCfg = data.cfg;
                    activeIeee = data.hasOwnProperty('actIeee') ? data.actIeee : activeIeee;
                    activeEp = data.hasOwnProperty('actEp') ? parseInt(data.actEp) : activeEp;
                }
                ask();
            });
        }
        else if (answer == 51) {
            askRaw('Endpoint? ', (ep) => {
                if (ep) {
                    activeEp = ep;
                    console.log('ActiveEp set to '+activeEp);
                    ask();
                }
            });
        }
        else if (answer == 58) {
            filterActive = !filterActive;
            if (filterActive) {
                console.log('Filter on ('+zclId.cluster(filterCid).value + ', '+zclId.cluster(filterCid).key +')');
            }
            else {
                console.log('Filter off');
            }
            ask();
        }
        else if (answer == 100) {
            printCidList();	
            ask();
        }
        else if(answer == 101) {
            askCid('msOccupancySensing', (cid) => {
                console.log('');
                printAttrList(cid);
                ask();
            });
        }
        else if(answer === 'q') {
            console.log('Exiting...');
            stop();
            process.exit();
        }
        else {
            console.log("undefined");
            ask();
        }
//      rl.close();

    });
}

function askCmd(defCmd, callBack) {
    askTypeCmd(defCmd, 'foundation', null, callBack);
}

function askFunctionalCmd(defCmd, cid, callBack) {
    askTypeCmd(defCmd, 'functional', cid, callBack);
}

function askTypeCmd(defCmd, type, cid, callBack) {
    console.log('\n');
    var defaultCmd, defaultCmdKey;
    if (type === 'foundation') {
        printCmdList();
        var pair = zclId.foundation(defCmd);
        defaultCmd = pair ? pair.value : -1;
        defaultCmdKey = pair ? pair.key : "-1";
    }
    else if (type === 'functional') {
        printFunctionalCmdList(cid);
        defaultCmd = zclId.functional(cid, defCmd).value;
        defaultCmdKey = zclId.functional(cid, defCmd).key;
    }
    rl.question('cmd? ['+defaultCmdKey+'] ', (cmd) => {
        if (!cmd) {
            if (type === 'foundation') {
                cmd = zclId.foundation(defCmd).value;
            }
            else if (type === 'functional') {
                printFunctionalCmdList(cid);
                cmd = zclId.functional(cid, defCmd).value;
            }
        }
        else {
            cmd = parseInt(cmd);
        }
        callBack(cmd);
    });
}

function askCid(defCid, callBack) {
    console.log('\n');
    var defaultCid = zclId.cluster(defCid).value;
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
    console.log('\n');
    printAttrList(cid);
    var attrDef = zclId.attr(cid, defaultAttrId);
    var defaultName = 'not found';
    if (typeof attrDef !== 'undefined') {
        defaultName = attrDef.key;
    }
    rl.question('attr ['+defaultName+']? ', (attrId) => {
        if (!attrId) {	  
            if (typeof attrDef !== 'undefined') {
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

function askRaw(question, callBack) {
    console.log('\n');
    rl.question(question+' ', (value) => {
        var result;
        if (!value) {	  
            result = null;
        }
        else {
            result = Number(value);
            if (isNaN(result)) {
                result = value;
            }
        }
        callBack(result);		  
    });
}

function printCidList() {
    printList(zclId._common.clusterId);
}

function printList(list) {
    var keys = Object.keys(list);
    for (var i=0; i< keys.length; i++) {
        var key = keys[i];      
        var item = list[key];
        if (item) {
            console.log(key+ ': '+ item  );
        }
    }
}

function printCmdList() {	
	  for (var i=0; i< 23; i++) {
		  var cmdDef = zclId.foundation(i);
		  if (cmdDef) {
			  console.log(cmdDef.value+ ': '+ cmdDef.key  );
		  }
	  }
}
function printFunctionalCmdList(cid) {
    var cid = zclId.cluster(cid).key;
    var cluster = zclId._getCluster(cid);
    if (typeof cluster != 'undefined') {
        return cluster.cmd !== null ? cluster.cmd._enumMap : null;
    }
    return null;
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

function send(cid, cmd, attrId, type, value, callback, log = true) {
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
	if (log) {
	    console.log('Send to '+activeIeee+' cid 0x' + cid.toString(16)+' ('+cid+') cmd 0x' + cmd.toString(16)+ ' ('+cmd 
	            + ') attr 0x' + attrId.toString(16)+ ' ('+attrId+ ')' + typeValueString);
	}
	//zclId.attr(cid, attrId).value
	var zclData;
	if (type && value) {
		zclData = [{attrId: attrId, dataType: type, attrData: value}];
	}
	else {
		zclData = [{attrId: attrId}];
	}
	try {
	    ep.foundation(cid, cmd, zclData, activeCfg, callback);
	} catch (exception) {
	    callback(exception);
	}
}

function sendData(data, callback) {
    var ep = getEp();
    console.log('Send to '+activeIeee+' cid 0x' + data.cid.toString(16)+' ('+data.cid+') '
            +'cmd 0x' + data.cmd.toString(16)+ ' ('+data.cmd 
            + ') '+JSON.stringify(data.zclData));
    ep.functional(''+data.cid, data.cmd, data.zclData, activeCfg, callback);
}

function testAttr(cid, cmd, startId, maxId) {
    var attrId = parseInt(startId);
    const maxAttrId = parseInt(maxId);
    var errCount = 0;

    callBack = function (err, data) {
        if (err && errCount < 1) {
            errCount++;
            console.log('Request failed ('+err.message+'), one more try...)');
            testAttrRun();
        }
        errCount = 0;
        var statusCode = -1;
        if (Array.isArray(data)) {
            statusCode = data[0].status;
            dataType = data[0].dataType;
        }
        else if (typeof data !== 'undefined'){
            statusCode = data.statusCode;
        }

        var statusString = 'unknown';
        if (statusCode !== -1) {
            statusString = zclId.status(statusCode).key;
            if (statusCode == 0) {
                var attrDef = zclId.attr(cid, attrId);
                if (attrDef) {
                    statusString = statusString + ' ('+attrDef.key+')';
                }
                statusString = '\x1b[33m'+statusString+'\x1b[0m';
            }
            else {
                statusString = '\x1b[31m'+statusString+'\x1b[0m';
            }
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
        send(cid, cmd, attrId, null, null, callBack, false);	
    }
    testAttrRun();
}


/*
 * Original values:
 * pirOToUDelay =  attrId: 0, dataType: 41, attrData: 2126
	18: pirUToOThreshold = unsupAttribute

 * 
 *	cid 0x406 (1030) cmd 0x0 (0) attr 0x10 (16)
 	[ { attrId: 16, status: 0, dataType: 33, attrData: 0 } ]
 	
 	
 	genBasic manufCode
 	attrId:33    powerOnSeconds
 	attrId: 50    usertest?   values: 0 - default, 1: green led on ANY move detection
 	attrId: 51    led indication?     values: 0 - default,    1: no change!?
 	
msIlluminanceMeasurement
0 of 2 Status 0: success (measuredValue) result: [{"attrId":0,"status":0,"dataType":33,"attrData":17172}]
1 of 2 Status 0: success (minMeasuredValue) result: [{"attrId":1,"status":0,"dataType":33,"attrData":1}]
2 of 2 Status 0: success (maxMeasuredValue) result: [{"attrId":2,"status":0,"dataType":33,"attrData":65534}]

msTemperatureMeasurement
0 of 50 Status 0: success (measuredValue) result: [{"attrId":0,"status":0,"dataType":41,"attrData":1999}]
1 of 50 Status 0: success (minMeasuredValue) result: [{"attrId":1,"status":0,"dataType":41,"attrData":-27315}]
2 of 50 Status 0: success (maxMeasuredValue) result: [{"attrId":2,"status":0,"dataType":41,"attrData":32767}]

genBasic
0 of 50 Status 0: success (zclVersion) result: [{"attrId":0,"status":0,"dataType":32,"attrData":1}]
1 of 50 Status 0: success (appVersion) result: [{"attrId":1,"status":0,"dataType":32,"attrData":2}]
2 of 50 Status 0: success (stackVersion) result: [{"attrId":2,"status":0,"dataType":32,"attrData":1}]
3 of 50 Status 0: success (hwVersion) result: [{"attrId":3,"status":0,"dataType":32,"attrData":1}]
4 of 50 Status 0: success (manufacturerName) result: [{"attrId":4,"status":0,"dataType":66,"attrData":"Philips"}]
5 of 50 Status 0: success (modelId) result: [{"attrId":5,"status":0,"dataType":66,"attrData":"SML001"}]
6 of 50 Status 0: success (dateCode) result: [{"attrId":6,"status":0,"dataType":66,"2018-12-30T12:30:21.563Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]

genBasic manufCode
30 of 60 Status 134: unsupAttribute result: [{"attrId":30,"status":134}]
31 of 60 Status 134: unsupAttribute result: [{"attrId":31,"status":134}]
32 of 60 Status 0: success result: [{"attrId":32,"status":0,"dataType":66,"attrData":"0:PWRON@0"}]
33 of 60 Status 0: success result: [{"attrId":33,"status":0,"dataType":35,"attrData":5018}]
34 of 60 Status 134: unsupAttribute result: [{"attrId":34,"status":134}]
35 of 60 Status 134: unsupAttribute result: [{"attrId":35,"status":134}]
36 of 60 Status 134: unsupAttribute result: [{"attrId":36,"status":134}]
37 of 60 Status 134: unsupAttribute result: [{"attrId":37,"status":134}]
38 of 60 Status 134: unsupAttribute result: [{"attrId":38,"status":134}]
39 of 60 Status 134: unsupAttribute result: [{"attrId":39,"status":134}]
40 of 60 Status 134: unsupAttribute result: [{"attrId":40,"status":134}]
41 of 60 Status 134: unsupAttribute result: [{"attrId":41,"status":134}]
42 of 60 Status 134: unsupAttribute result: [{"attrId":42,"status":134}]
43 of 60 Status 134: unsupAttribute result: [{"attrId":43,"status":134}]
44 of 60 Status 134: unsupAttribute result: [{"attrId":44,"status":134}]
45 of 60 Status 134: unsupAttribute result: [{"attrId":45,"status":134}]
46 of 60 Status 134: unsupAttribute result: [{"attrId":46,"status":134}]
47 of 60 Status 134: unsupAttribute result: [{"attrId":47,"status":134}]
48 of 60 Status 0: success result: [{"attrId":48,"status":0,"dataType":48,"attrData":0}]
49 of 60 Status 0: success result: [{"attrId":49,"status":0,"dataType":25,"attrData":0}]
50 of 60 Status 0: success result: [{"attrId":50,"status":0,"dataType":16,"attrData":0}]
51 of 60 Status 0: success result: [{"attrId":51,"status":0,"dataType":16,"attrData":0}]
52 of 60 Status 134: unsupAttribute result: [{"attrId":52,"status":134}]
53 of 60 Status 134: unsupAttribute result: [{"attrId":53,"status":134}]


2018-12-30T12:30:21.564Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:30:21.564Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:30:21.566Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:30:23.174Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:30:23.174Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:32:51.125Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:32:51.126Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:32:51.126Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:32:51.126Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:32:52.721Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:32:52.721Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:33:11.314Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:33:11.315Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:33:11.315Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:33:11.315Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:33:12.934Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:33:12.934Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:35:44.781Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:35:44.783Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:35:44.784Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:35:44.784Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:35:46.379Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:35:46.380Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:45:45.478Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:45:45.478Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:45:47.073Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:45:47.075Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:48:50.164Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:48:50.165Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:48:50.165Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:48:50.165Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 1 } }
2018-12-30T12:48:51.777Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:48:51.778Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 1 } ]
2018-12-30T12:51:19.792Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:51:19.792Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:51:19.792Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:51:19.792Z   ind:changed                                  { cid: 'msOccupancySensing', data: { occupancy: 0 } }
2018-12-30T12:51:21.421Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T12:51:21.422Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:01:20.480Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:01:20.481Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:01:22.081Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:01:22.082Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:11:21.265Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:11:21.265Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:11:22.865Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
2018-12-30T13:11:22.865Z   ind:reported   msOccupancySensing            [ { attrId: 0, dataType: 24, attrData: 0 } ]
attrData":"20160630"}]
7 of 50 Status 0: success (powerSource) result: [{"attrId":7,"status":0,"dataType":48,"attrData":3}]

msIlluminanceLevelSensing 
not supported


hue illumination issue
https://community.smartthings.com/t/beta-hue-motion-sensor-beta-no-hue-bridge/62286/81
 * 
 */
 

