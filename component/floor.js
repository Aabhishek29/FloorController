var dgram = require('dgram');

let subTypeMap = new Map()
subTypeMap.set("Floor Request",'00000');
subTypeMap.set("Floor Granted",'x0001');
subTypeMap.set("Floor Deny",'x0011');
subTypeMap.set("Floor Release",'x0100');
subTypeMap.set("Floor Idle",'x0101');
subTypeMap.set("Floor Taken",'x0010');
subTypeMap.set("Floor Revoke",'00110');
subTypeMap.set("Floor Queue Position Request",'01000');
subTypeMap.set("Floor Queue Position Info",'x1001');
subTypeMap.set("Floor Ack",'01010');
subTypeMap.set("Floor Release Multi Talker",'01111');


//24380 8.2.3.10 Field Control Specific Fields
let fieldIdMap = new Map()
fieldIdMap.set("Floor Priority",'00000000');
fieldIdMap.set("Duration",'00000001');
fieldIdMap.set("Reject Cause",'00000010');
fieldIdMap.set("Queue Info",'00000011');
fieldIdMap.set("Granted Party's Identity",'00000100');
fieldIdMap.set("Permission to Request the Floor",'00000101');
fieldIdMap.set("User ID",'00000110');
fieldIdMap.set("Queue Size",'00000111');
fieldIdMap.set("Message Sequence Number",'00001000');
fieldIdMap.set("Queued User ID",'00001001');
fieldIdMap.set("Source",'00001010');
fieldIdMap.set("Message Type",'00001100');
fieldIdMap.set("Floor Indicator",'00001101');
fieldIdMap.set("SSRC",'00001110');
fieldIdMap.set("List of Granted Users",'00001111');
fieldIdMap.set("List of SSRCs",'00010000');
fieldIdMap.set("Functional Alias",'00010001');
fieldIdMap.set("List of Functional Aliases",'00010010');
fieldIdMap.set("Location",'00010011');
fieldIdMap.set("List of Locations",'00010100');

// 24380 8.2.3.15
let floorIndicatorMap = new Map()
floorIndicatorMap.set("Normal call",'1000000000000000');
floorIndicatorMap.set("Broadcast group call",'0100000000000000');
floorIndicatorMap.set("System call",'0010000000000000');
floorIndicatorMap.set("Emergency call",'0001000000000000');
floorIndicatorMap.set("Imminent peril call",'0000100000000000');
floorIndicatorMap.set("Queueing supported",'0000010000000000');
floorIndicatorMap.set("Dual floor",'0000001000000000');
floorIndicatorMap.set("Temporary group call",'0000000100000000');
floorIndicatorMap.set("Multi-talker",'0000000010000000');

// 24380 8.2.3.21
let locationMap=new Map();
locationMap.set('0',''); //Not provided
locationMap.set('1','1234567');  //ECGI = 56 bits = MCC + MNC + ECI
locationMap.set('2','12345'); // Tracking Area = 40 bits = MCC + MNC + 16 bits
locationMap.set('3','123'); // PLMN ID = 24 bits = MCC+MNC
locationMap.set('4','12'); // MBMS Service Area = 16 bits = [0-65535]
locationMap.set('5','1'); // MBSFN Area ID = 8 bits = [0-255]
locationMap.set('6','123456'); // Geographic coordinates = 48 bits = latitude in first 24 bits + longitude in last 24 bits coded as in subclause 6.1 in 3GPP TS 23.032

// Common floor control fields
var version = '10';
var padding = '0';
var packetType = '11001100';   // 204
var nameField ='01001101 01000011 01010000 01010100';   //nameField=MCPT
var msgSeqValue = (function () {
    var i = 0;
    return function () {
        return ((i++) % 65536);
    }
})();


function zeroFill(number, width )
{
    width -= number.toString().length;
    if ( width > 0 )
    {
        return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ""; // return a string
}

function addStr(str, index, stringToAdd){
    return str.substring(0, index) + stringToAdd + str.substring(index, str.length);
}

function dec2bin(dec){
    let bin = 0;
    let rem, i = 1, step = 1;
    while (dec != 0) {
        rem = dec % 2;
        dec = parseInt(dec / 2);
        bin = bin + rem * i;
        i = i * 10;
    }
    //console.log(`Binary: ${bin}`);
    return bin;
}

// console.log(dec2bin(6))
// console.log(zeroFill(dec2bin(6),8))

function bin2dec(binary){
    var decimal = parseInt(binary, 2);
    return decimal;
}

// console.log(bin2dec(101))

function hex2bin(hex){
    switch(hex){
        case '0': return '0000';
        case '1': return '0001';
        case '2': return '0010';
        case '3': return '0011';
        case '4': return '0100';
        case '5': return '0101';
        case '6': return '0110';
        case '7': return '0111';
        case '8': return '1000';
        case '9': return '1001';
        case 'A': return '1010';
        case 'B': return '1011';
        case 'C': return '1100';
        case 'D': return '1101';
        case 'E': return '1110';
        case 'F': return '1111';
        case 'a': return '1010';
        case 'b': return '1011';
        case 'c': return '1100';
        case 'd': return '1101';
        case 'e': return '1110';
        case 'f': return '1111';

    }
}

function hexDumptoBinaryDump(hexdump){
    var hexArray=hexdump.split(' ')
    var binDump='';
    hexArray.forEach(element => {
        binDump=binDump + hex2bin(element[0])+hex2bin(element[1])+' '
    });
    return (binDump.slice(0, -1))
}

function toHexDump(hex){

    let hexDump=hex.match(/.{1,2}/g);
    hexDump=hexDump.join(' ');
    return hexDump;
}

// console.log(hexDumptoBinaryDump(toHexDump('cc0012')))

function ascii2bin(ascii){
    var binary = ascii.split('').map(c => c.charCodeAt().toString(2).padStart(8, '0')).join(' ');
    return binary;
}

function binDump2hexDump(bindata){
    var binArray=bindata.split(' ');
    var hexDump='';
    binArray.forEach(element => {
        hexDump = hexDump + parseInt(element, 2).toString(16)+ ' ';
    });
    return (hexDump.slice(0, -1))
}

// console.log(binDump2hexDump('10000101 10101011'))


function binDump2ascii(binDump) {
    var result = "";
    // var arr = input.match(/.{1,8}/g);
    var arr= binDump.split(' ');

//    var arr=['1000100']
    //  console.log(arr)
    for (var i = 0; i < arr.length; i++) {
        // console.log(arr[i])
        arr[i]=arr[i].slice(1)
        result += String.fromCharCode(parseInt(arr[i], 2).toString(10));
        //    console.log(result)
    }
    return result;
}

//console.log(binDump2ascii('00111001 11010100 01110000'))

function binaryAgent(str) {
    return str.split(" ").map(input => String.fromCharCode(parseInt(input,2).toString(10))).join("");
}


function text2Binary(string) {
    console.log('in text2Binary');
    console.log(string)
    return string.split('').map(function (char) {
        return char.charCodeAt(0).toString(2).padStart(8,'0');
    }).join(' ');
}

// console.log(text2Binary('��ga]�MCPT'))

//console.log(getRejectCause(2,"Floor Deny"))

// 8.2.3.5 Queue Info
function getQueueInfo(position,priority){
    console.log('inside getQueueInfo in floor.js')
    var length;
    var transField=fieldIdMap.get("Queue Info");
    position = dec2bin(position).toString().padStart(8,'0')
    priority = dec2bin(priority).toString().padStart(8,'0')
    length='00000010'

    var queueInfo=transField+' ' +length+' '+position+' '+priority;
    return queueInfo;
}

// 8.2.3.6 Granted Party's Identity
function getGrantedPartyID(mcpttid){
    logger.log('debug', `inside getGrantedPartyID in floor.js`);
    var fieldId = fieldIdMap.get("Granted Party's Identity")
    var padLen = (4 - ( mcpttid.length + 2) % 4) % 4;
    var fieldLength = dec2bin(mcpttid.length).toString().padStart(8, '0');
    var padding = '';
    for(var i = 0; i < padLen; i++){
        padding = padding + '00000000' + ' ';
    }
    padding.slice(0, -1);
    mcpttid = ascii2bin(mcpttid);
    return (fieldId + ' ' + fieldLength + ' ' + mcpttid + ' ' + padding);
}

// 8.2.3.7 Permission to Request the Floor
function getPermissionToRequestFloor(value){
    logger.log('debug','inside getPermissionToRequestFloor in floor.js')
    var floorField=fieldIdMap.get("Permission to Request the Floor")
    var floorLength='00000010'
    var permission;
    if(value=='0'){
        permission='00000000 00000000'
    } else if(value=='1'){
        permission='00000000 00000001'
    }
    return floorField+' '+floorLength+' '+ permission;
}
//console.log(getPermissionToRequestFloor('1'))

// 8.2.3.8 User ID
function getFloorUserId(mcpttid){
    logger.log('debug','inside getFloorUserId in floor.js')
    var fieldId=fieldIdMap.get("User ID")
    var padLen=(4-(mcpttid.length+2)%4)%4;
    var fieldLength=dec2bin(mcpttid.length).toString().padStart(8,'0');
    var padding='';
    for(var i=0;i<padLen;i++){
        padding=padding+'00000000'+' '
    }
    padding.slice(0, -1);
    mcpttid=ascii2bin(mcpttid);
    return (fieldId+' '+fieldLength+' '+mcpttid+' '+padding)
}

// 8.2.3.9 Queue Size
function getQueueSize(queuedUserMap){
    console.log('inside getQueueSize in floor.js')
    var floorField=fieldIdMap.get("Queue Size")
    var floorLength='00000010'
    var queueSize=dec2bin(queuedUserMap.size).toString().padStart(16,'0');
    return floorField+' '+floorLength+' '+queueSize ;
}

// 8.2.3.10 Message Sequence Number
function getMsgSeqNo(){
    console.log('debug', `inside getMsgSeqNo in floor.js`);
    var msgSeqFieldId = fieldIdMap.get("Message Sequence Number");
    var msgSeqLength = '00000010';
    var str = dec2bin(msgSeqValue()).toString();
    var msgSeqVal = addStr(str.padStart(16,'0'),8,' ');

    var msgSeqNo = msgSeqFieldId + ' ' + msgSeqLength + ' ' + msgSeqVal;
    return msgSeqNo;
}

// 8.2.3.11 Queued User ID
// 8.2.3.12 Source
function getSource(sourceValue){
    console.log('inside getSource in floor.js')
    var floorField=fieldIdMap.get("Queue Size")
    var floorLength='00000010'
    var sourceValue=dec2bin(sourceValue).toString().padStart(16,'0');
    sourceValue=addStr(sourceValue,8,' ')
    return floorField+' '+floorLength+' '+sourceValue ;
}

// 8.2.3.13 Track Info
// 8.2.3.14 Message Type
function getMessageType(subType){
    logger.log('debug', `inside getMessageType in floor.js`);
    var fieldId = fieldIdMap.get("Message Type");
    var length = '00000010';
    var spare = '00000000';
    subType = subType.padStart(8,'0');
    var messageType = fieldId + ' ' + length + ' ' + subType + ' ' + spare;
    return (messageType)
}

// 8.2.3.15 Floor Indicator
function getFloorIndicator(callType){
    console.log('debug', `inside getFloorIndicator in floor.js`);
    var floorIndicator = floorIndicatorMap.get(callType);
    var floorField = fieldIdMap.get("Floor Indicator");
    var floorLength = '00000010';
    // floorIndicatorArray.forEach(element => {
    //     floorIndicator = convert.dec2bin(parseInt(floorIndicator,2) | parseInt(floorIndicatorMap.get(element),2));
    // });
    return floorField + ' ' + floorLength + ' ' + addStr(floorIndicator.toString(), 8, ' ');
}

// console.log(getFloorIndicator(new Array('Normal call')))

// 8.2.3.16 SSRC
function getSSRC(ssrc){
    console.log('debug', `inside getSSRC in floor.js`);
    var fieldId = fieldIdMap.get("SSRC");
    var length = '00000110';
    ssrc = hexDumptoBinaryDump(ssrc)
    var spare = '00000000 00000000';
    var floorSSRC = fieldId + ' ' + length + ' ' + ssrc + ' ' + spare;
    return (floorSSRC)
}


function getFloorIdle(data){
    //  data.ack -> ack bit
    //  data.ssrc -> server ssrc
    //  data.floorIndicator -> Floor Indicator
    console.log('debug', `In getFloorIdle Function`);
    if(data.ssrc == undefined){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    var length;
    var subType = subTypeMap.get("Floor Idle");
    if(data.ack){
        subType = subType.replace('x', data.ack);
    } else {
        //  Assume no ACK is required ... Default State
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);
    var msgSeqNo = getMsgSeqNo();

    var floorIndicator;
    if(data.floorIndicator != undefined){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }

    var msg = servSSRC + nameField + msgSeqNo + floorIndicator;
    msg = msg.replace(/ /g, "");

    length = dec2bin(msg.length/32).toString().padStart(16, '0');
    var convLength = addStr(length,8,' ');

    var payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        convLength + ' ' +
        servSSRC + ' ' +
        nameField + ' ' +
        msgSeqNo + ' ' +
        floorIndicator;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}

var server = dgram.createSocket("udp4");
server.bind({
    address: '192.168.0.109',
    port: 10000
});

server.on("listening", function () {
    var address = server.address();
    console.log(`Server is listening on ${address.address} : ${address.port}`);

    var ssrc = 0x12345678;
    var message = getFloorIdle({
        ack : '0',
        ssrc : toHexDump(ssrc.toString(16))
    })

    console.log(message);
    var msg = binaryAgent(message);
    var buf = Buffer.from(msg, 'binary');
    server.send(buf, '6765', '192.168.0.152', (err) => {
        if(err){
            console.log('error', err);
        } else {
            console.log('debug', `event sent`);
        }
    });
});

