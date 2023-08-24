var dgram = require('dgram');
import { Buffer } from "buffer";

let denyCauseMap = new Map();
denyCauseMap.set(1, 'Another MCPTT client has permission');
denyCauseMap.set(2, 'Internal floor control server error');
denyCauseMap.set(3, 'Only one participant');
denyCauseMap.set(4, 'Retry-after timer has not expired');
denyCauseMap.set(5, 'Receive only');
denyCauseMap.set(6, 'No resources available');
denyCauseMap.set(7, 'Queue full');
denyCauseMap.set(255, 'Other reason');

let revokeCauseMap = new Map();
revokeCauseMap.set(1, 'Only one MCPTT client');
revokeCauseMap.set(2, 'Media burst too long');
revokeCauseMap.set(3, 'No permission to send a Media Burst');
revokeCauseMap.set(4, 'Media Burst pre-empted');
revokeCauseMap.set(6, 'No resources available');
revokeCauseMap.set(255, 'Other reason');

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

// 8.2.3.2 Floor Priority
function getFloorPriority(priority){
    console.log('debug', `inside getFloorPriority in floor.js`);
    var fieldId = fieldIdMap.get("Floor Priority");
    var length = '00000010';
    if(priority == undefined || priority == null){
        priority = '00000000';
    } else {
        priority = dec2bin(priority).toString().padStart(8,'0');
    }

    var spare='00000000';
    var floorPriority = fieldId + ' ' + length + ' ' + priority + ' ' + spare;
    return (floorPriority)
}

// 8.2.3.3 Duration
function getFloorDuration(duration){
    console.log('debug', `inside getFloorDuration in floor.js`);
    var floorField = fieldIdMap.get("Duration")
    var floorLength = '00000010'
    duration = dec2bin(duration).toString().padStart(16,'0');
    return floorField + ' ' + floorLength + ' ' + addStr(duration,8,' ') ;
}

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
    console.log('debug', `inside getGrantedPartyID in floor.js`);
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
    console.log('debug','inside getPermissionToRequestFloor in floor.js')
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
    console.log('debug','inside getFloorUserId in floor.js')
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
    console.log('debug', `inside getMessageType in floor.js`);
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

function getRejectCause(rejectCause, messageType){
    console.log('debug','inside getRejectCause in floor.js');
    //console.log(rejectCause);
    //console.log(messageType);
    var floorField = fieldIdMap.get("Reject Cause")
    var rejectPhrase = '';
    if(messageType == "Floor Deny"){
        rejectPhrase = denyCauseMap.get(rejectCause);
    } else if(messageType == "Floor Revoke"){
        rejectPhrase = revokeCauseMap.get(rejectCause);
    }
    //console.log('rejectPhrase = '+rejectPhrase)
    var cause = dec2bin(rejectCause).toString().padStart(16, '0');
    var floorLength = dec2bin(rejectPhrase.length+2).toString().padStart(8,'0');
    // console.log('floorLength = '+floorLength)
    var padding = '';
    var padLen = (4-(rejectPhrase.length)%4)%4;

    for(var i = 0; i < padLen; i++){
        padding = padding + '00000000' + ' ';
    }
    padding.slice(0, -1);;

    rejectPhrase = ascii2bin(rejectPhrase).toString();
    // console.log('rejectPhrase = '+rejectPhrase)
    // console.log('padding = '+padding)

    return floorField + ' ' + floorLength + ' ' + addStr(cause, 8, ' ') +
        ' ' + rejectPhrase + ' ' + padding ;
}

// 8.2.3.17 List of Granted Users
function getGrantedUsersList(mcpttidArray){
    console.log('inside getGrantedUsersList in floor.js')
    var floorField=fieldIdMap.get("List of Granted Users").padStart(8,'0');
    var noUsers = dec2bin(mcpttidArray.length).toString().padStart(8,'0');
    var grantedUsers=''
    for(var k=0;k<mcpttidArray.length;k++){
        let userIdLength=dec2bin(mcpttidArray[k].length).toString().padStart(8,'0')
        let userId=ascii2bin(mcpttidArray[k]).toString()
        padLen=(4-(mcpttidArray[k].length+1)%4)%4;

        grantedUsers = grantedUsers+' '+userIdLength+' '+userId;
    }

    let data=grantedUsers
    data = data.replace(/ /g, "");
    var floorLength=dec2bin((data.length)/8).toString().padStart(8,'0')
    //console.log(data.length)
    var padLen=(4-((data.length/8)-1)%4)%4;
    padding=' ';
    for(var i=0;i<padLen;i++){
        padding=padding+'00000000'+' '
    }
    padding.slice(0, -1);

    return (floorField+' '+floorLength+' '+noUsers+' '+grantedUsers+' '+padding).replace(/\s+/g, ' ').trim();
}

//console.log(getGrantedUsersList(new Array('mcx.test-1111.mcla','mcx.test-333.mcla','mcx.test-22.mcla')))

// 8.2.3.18 List of SSRCs
function getSSRCList(ssrcArray){
    console.log('inside getSSRCList in floor.js')
    var floorField=fieldIdMap.get("List of SSRCs").padStart(8,'0');
    var noOfSSRCs = dec2bin(ssrcArray.length).toString().padStart(8,'0');
    var SSRCs=''
    for(var k=0;k<ssrcArray.length;k++){
        let temp=hexDumptoBinaryDump(ssrcArray[k])

        SSRCs = SSRCs+' '+temp;
    }
    var spare='00000000 00000000'

    return (floorField+' '+noOfSSRCs+' '+spare+' '+SSRCs).replace(/\s+/g, ' ').trim();
}

//console.log(getSSRCList(new Array('11 22 33 44','00 11 00 11')))

// 8.2.3.19 Functional Alias
function getFloorFAId(faid){
    console.log('debug', `inside getFloorFAId in floor.js`);
    var fieldId = fieldIdMap.get("Functional Alias");
    var padLen = (4 - (faid.length + 2) % 4) % 4;
    var fieldLength = dec2bin(faid.length).toString().padStart(8, '0');
    var padding='';
    for(var i = 0 ;i < padLen; i++){
        padding = padding + '00000000' + ' ';
    }
    padding.slice(0, -1);
    faid = ascii2bin(faid);
    return (fieldId + ' ' + fieldLength + ' ' + faid + ' ' + padding);
}

// 8.2.3.20 List of Functional Aliases
function getFAList(faidArray){
    console.log('inside getFAList in floor.js')
    var floorField=fieldIdMap.get("List of Functional Aliases").padStart(8,'0');
    var noOfFAs = dec2bin(faidArray.length).toString().padStart(8,'0');
    var functionalAliases=''
    for(var k=0;k<faidArray.length;k++){
        let faIdLength=dec2bin(faidArray[k].length).toString().padStart(8,'0')
        let faId=ascii2bin(faidArray[k]).toString()
        padLen=(4-(faidArray[k].length+1)%4)%4;

        functionalAliases = functionalAliases+' '+faIdLength+' '+faId;
    }

    let data=functionalAliases
    data = data.replace(/ /g, "");
    var floorLength=dec2bin((data.length)/8).toString().padStart(8,'0')
    // console.log(data.length)
    var padLen=(4-((data.length/8)-1)%4)%4;
    padding=' ';
    for(var i=0;i<padLen;i++){
        padding=padding+'00000000'+' '
    }
    padding.slice(0, -1);

    return (floorField+' '+floorLength+' '+noOfFAs+' '+functionalAliases+' '+padding).replace(/\s+/g, ' ').trim();
}
// console.log(getFAList(new Array('fa1@abc.in','fa22@abc.in','fa33@abc.in')))

// 8.2.3.21 Location
function getLocation(locationInfo){
    console.log('inside getLocation in floor.js')
    var fieldId=fieldIdMap.get("Location")
    //console.log('field = '+fieldId)
    var locType=6;
    var temp;
    temp=locationInfo.split(' ');
    let lat='';
    let long='';
    for(i=0;i<3;i++){
        lat=lat+temp[i]+' ';
    }
    lat=lat.slice(0, -1);
    for(i=3;i<6;i++){
        long=long+temp[i]+' ';
    }
    long=long.slice(0, -1);

    var locValue =  hexDumptoBinaryDump(lat).toString()+' '+ hexDumptoBinaryDump(long).toString();
    //console.log('loc val = '+locValue)
    var padLen=3;
    var fieldLength=dec2bin(7).toString().padStart(8,'0');
    // console.log('f len = '+fieldLength)
    locType= dec2bin(locType).toString().padStart(8,'0')

    var padding='';
    for(var i=0;i<padLen;i++){
        padding=padding+'00000000'+' '
    }
    padding.slice(0, -1);
    return (fieldId+' '+fieldLength+' '+locType+' '+locValue+' '+padding)
}

// console.log('loc='+getLocation('12 34 56 65 43 21'))

// 8.2.3.22 List of Locations
function getLocationList(locArray){
    var listFieldId=fieldIdMap.get("List of Locations")
    var listFieldLength;
    var locListCount = dec2bin(locArray.length).toString().padStart(8,'0');
    var locations='';
    var padding='';
    var lat='',long='',locValue='';
    var locField = fieldIdMap.get('Location')
    var locLength;
    var temp;

    for(var k=0;k<locArray.length;k++){
        if(locArray[k]==''){
            let locType='00000000';
            locValue='';
            locLength='00000001';
            locations=locations+' '+locField+' '+locLength+' '+locType;
        } else {
            let locType='00000110';
            locLength='00000111'
            temp=locArray[k].split(' ');
            lat='';
            long='';
            for(i=0;i<3;i++){
                lat=lat+temp[i]+' ';
            }
            lat=lat.slice(0, -1);
            for(i=3;i<6;i++){
                long=long+temp[i]+' ';
            }
            long=long.slice(0, -1);
            locValue =  hexDumptoBinaryDump(lat).toString()+' '+hexDumptoBinaryDump(long).toString();
            locations=locations+' '+locField+' '+locLength+' '+locType+' '+locValue;
        }
    }
    let data=locations
    data = data.replace(/ /g, "");
    var padLen=(4-((data.length/8)-1)%4)%4;
    for(var i=0;i<padLen;i++){
        padding=padding+'00000000'+' '
    }
    padding.slice(0, -1);

    listFieldLength=dec2bin(data.length/8).toString().padStart(8,'0')

    return (listFieldId+' '+listFieldLength+' '+locListCount+' '+locations+' '+padding).replace(/\s+/g, ' ').trim();
}

// console.log(getLocationList(new Array('11 22 33 44 55 66','','AA BB CC 11 22 33')))





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

function getFloorRequest(data){
    //  data.ack : ack bit
    //  data.ssrc : server ssrc
    //  data.holderSSRC : Holder SSRC
    //  data.locList :  Granted User Location List in Array
    //  data.priority : Holder Priority
    //  data.floorIndicator : Floor Indicator
    //  faID : faid,
    //  permission : permission
    console.log('debug', `In getFloorRequest Function`);
    if(data.ssrc == undefined || data.ssrc == null){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    var floorLength;

    var subType = subTypeMap.get("Floor Request");
    if(data.ack != undefined && data.ack != null){
        subType = subType.replace('x', data.ack);
    } else {
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);

    //  Holder Priority
    var floorPriority;
    if(data.priority != undefined){
        floorPriority = getFloorPriority(data.priority);
    } else {
        //  use Default -> 0
        floorPriority = getFloorPriority(0);
    }

    var floorIndicator;
    if(data.floorIndicator != undefined && data.floorIndicator != null){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }

    //  Message Sequence Number
    var msgSeqNo = getMsgSeqNo();

    //  Holder FA-ID
    var faId;
    if(data.faID != undefined && data.faID != null){
        faId = getFloorFAId(data.faID);
    }

    var msg = servSSRC + ' ' + nameField;
    if(floorPriority != undefined && floorPriority != null){
        msg = msg + ' ' + floorPriority;
    }

    if(floorIndicator != undefined && floorIndicator != null){
        msg = msg + ' ' + floorIndicator;
    }
    if(faId != undefined && faId != null){
        msg = msg + ' ' + faId;
    }

    var payload = msg;

    msg = msg.replace(/ /g, "");

    var length = dec2bin(msg.length/32).toString().padStart(16,'0');
    var floorLength = addStr(length, 8, ' ');

    //  Create Payload
    payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        floorLength + ' ' +
        payload;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}

function getFloorDeny(data){
    // ack : ack
    // ssrc : SSRC,
    // rejectCause : Reject cause,
    // floorInd : floorInd
    console.log('debug', 'inside getFloorDeny in floor.js');

    console.log('debug', `In getFloorIdle Function`);
    if(data.ssrc == undefined){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    if(data.rejectCause == undefined){
        console.log('debug', `Reject Cause not found`);
        return;
    }

    var length;
    var subType = subTypeMap.get("Floor Deny");
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
    if(data.floorInd != undefined){
        floorIndicator = getFloorIndicator(data.floorInd);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }
    var cause = getRejectCause(data.rejectCause, "Floor Deny");
    var data = servSSRC + ' ' + nameField + ' ' + cause;
    data = data.replace(/ /g, "");

    var length = dec2bin(data.length/32).toString().padStart(16,'0');
    var dataLength = addStr(length, 8, ' ');

    var payload = version + padding + subType + ' ' +
        packetType + ' ' +
        dataLength + ' ' +
        servSSRC + ' ' +
        nameField + ' ' +
        cause;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}

function getFloorRelease(data){
    //  data.ack : ack bit
    //  data.ssrc : server ssrc
    //  data.floorIndicator : Floor Indicator
    console.log('debug', `In getFloorRequest Function`);
    if(data.ssrc == undefined || data.ssrc == null){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    var floorLength;

    var subType = subTypeMap.get("Floor Release");
    if(data.ack != undefined && data.ack != null){
        subType = subType.replace('x', data.ack);
    } else {
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);

    var floorIndicator;
    if(data.floorIndicator != undefined && data.floorIndicator != null){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }


    var msg = servSSRC + ' ' + nameField;

    if(floorIndicator != undefined && floorIndicator != null){
        msg = msg + ' ' + floorIndicator;
    }

    var payload = msg;

    msg = msg.replace(/ /g, "");

    var length = dec2bin(msg.length/32).toString().padStart(16,'0');
    var floorLength = addStr(length, 8, ' ');

    //  Create Payload
    payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        floorLength + ' ' +
        payload;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}
function getFloorRevoke(data){
    //  data.ack : ack bit
    //  data.ssrc : server ssrc
    //  data.revokeCause : Revoke Cause
    //  data.floorIndicator : Floor Indicator

    console.log('debug', `inside getFloorRevoke in floor.js`);

    if(data.ssrc == undefined || data.ssrc == null){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    var floorLength;

    var subType = subTypeMap.get("Floor Revoke");
    if(data.ack != undefined && data.ack != null){
        subType = subType.replace('x', data.ack);
    } else {
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);

    //  Floor Indicator
    var floorIndicator;
    if(data.floorIndicator != undefined && data.floorIndicator != null){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }

    //  Reject Cause
    if(data.revokeCause == undefined || data.revokeCause == null){
        console.log('warn', `Missing Reject Cause`);
        return;
    }
    var cause = getRejectCause(data.revokeCause, "Floor Revoke");

    var msg = servSSRC + ' ' + nameField + ' ' + cause;
    if(floorIndicator != undefined && floorIndicator != null){
        msg = msg + ' ' + floorIndicator;
    }

    var payload = msg;

    msg = msg.replace(/ /g, "");

    var length = dec2bin(msg.length/32).toString().padStart(16, '0');
    var floorLength = addStr(length, 8, ' ');

    //  Create Payload
    payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        floorLength + ' ' +
        payload;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}

function getFloorGranted(data){
    //  data.ack -> ack bit
    //  data.ssrc -> server ssrc
    //  data.time -> Granted time
    //  data.holderSSRC -> Holder SSRC
    //  data.priority -> Holder Priority
    //  data.floorIndicator -> Floor Indicator
    console.log('debug', `In getFloorGranted Function`);
    if(data.ssrc == undefined){
        console.log('debug', `Server SSRC not found`);
        return;
    }
    var length;
    var subType = subTypeMap.get("Floor Granted");
    if(data.ack){
        subType = subType.replace('x', data.ack);
    } else {
        //  Assume no ACK is required ... Default State
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);

    // //  Floor Granted Time
    var floorDuration;
    if(data.time == undefined){
        //  Use Default time as 30 Sec
        floorDuration = getFloorDuration(30);
    } else {
        floorDuration = getFloorDuration(data.time);
    }

    //  Holder SSRC
    var grantSSRC;
    if(data.holderSSRC != undefined){
        grantSSRC = getSSRC(data.holderSSRC);
    }

    //  Holder Priority
    var floorPriority;
    if(data.priority != undefined){
        floorPriority = getFloorPriority(data.priority);
    } else {
        //  use Default -> 0
        floorPriority = getFloorPriority(0);
    }

    var floorIndicator;
    if(data.floorIndicator != undefined){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }

    var msg = servSSRC + ' ' + nameField;
    if(grantSSRC != undefined){
        msg = msg + ' ' + grantSSRC;
    }
    if(floorDuration != undefined){
        msg = msg + ' ' + floorDuration;
    }
    if(floorPriority != undefined){
        msg = msg + ' ' + floorPriority;
    }
    if(floorIndicator != undefined){
        msg = msg + ' ' + floorIndicator;
    }

    var payload = msg;

    msg = msg.replace(/ /g, "");

    var length = dec2bin(msg.length/32).toString().padStart(16, '0');
    var convLength = addStr(length, 8, ' ');

    //  Create Payload
    payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        convLength + ' ' + payload;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}

function getFloorTaken(data){
    //  data.ack : ack bit
    //  data.ssrc : server ssrc
    //  data.time : Granted time
    //  data.holderSSRC : Holder SSRC
    //  data.grantList : Granted User List in Array
    //  data.grantedSSRCList : Granted User SSRCs List in Array
    //  data.grantedFAIDArray : Granted User FAIDs List in Array
    //  data.grantedLocation : Location of holder
    //  data.locList :  Granted User Location List in Array
    //  data.priority : Holder Priority
    //  data.floorIndicator : Floor Indicator
    //  holderID :  grantedMcpttId,
    //  faID : faid,
    //  permission : permission
    console.log('debug', `In getFloorTaken Function`);
    if(data.ssrc == undefined || data.ssrc == null){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    if(data.holderID == undefined || data.holderID == null){
        console.log('debug', `Server SSRC not found`);
        return;
    }

    var floorLength;

    var subType = subTypeMap.get("Floor Taken");
    if(data.ack != undefined && data.ack != null){
        subType = subType.replace('x', data.ack);
    } else {
        subType = subType.replace('x', '0');
    }

    //  Server SSRC
    var servSSRC = hexDumptoBinaryDump(data.ssrc);
    var grantedPartyID = getGrantedPartyID(data.holderID);

    //  Floor Granted Time
    var floorDuration;
    if(data.time == undefined){
        //  Use Default time as 30 Sec
        floorDuration = getFloorDuration(30);
    } else {
        floorDuration = getFloorDuration(data.time);
    }

    //  Holder SSRC
    var grantSSRC;
    if(data.holderSSRC != undefined){
        grantSSRC = getSSRC(data.holderSSRC);
    }

    //  Holder Priority
    var floorPriority;
    if(data.priority != undefined){
        floorPriority = getFloorPriority(data.priority);
    } else {
        //  use Default -> 0
        floorPriority = getFloorPriority(0);
    }

    var floorIndicator;
    if(data.floorIndicator != undefined && data.floorIndicator != null){
        floorIndicator = getFloorIndicator(data.floorIndicator);
    } else {
        //  Assume Normal Call
        floorIndicator = getFloorIndicator("Normal call");
    }

    //  Floor Permission
    var floorPermission;
    if(data.permission != undefined && data.permission != null){
        floorPermission = getPermissionToRequestFloor(data.permission);
    } else {
        floorPermission = getPermissionToRequestFloor('1');
    }

    //  Message Sequence Number
    var msgSeqNo = getMsgSeqNo();

    //  Holder FA-ID
    var faId;
    if(data.faID != undefined && data.faID != null){
        faId = getFloorFAId(data.faID);
    }

    // var grantedUsersList = getGrantedUsersList(grantedUsersArray)
    // console.log('grantedUsersList = '+grantedUsersList)
    // var grantedSSRCList = getSSRCList(grantedSSRCArray)
    // console.log('grantedSSRCList = '+grantedSSRCList)
    // var FAList = getFAList(faidArray)
    // console.log('FAList = '+FAList)
    // var grantedLocation = getLocation(grantedLocation)
    // console.log('grantedLocation = '+grantedLocation)
    // var locationsList = getLocationList(locArray)
    // console.log('locationsList = '+locationsList)

    var msg = servSSRC + ' ' + nameField + ' ' + msgSeqNo;
    if(grantSSRC != undefined && grantSSRC != null){
        msg = msg + ' ' + grantSSRC;
    }
    if(grantedPartyID != undefined && grantedPartyID != null){
        msg = msg + ' ' + grantedPartyID;
    }
    if(floorPermission != undefined && floorPermission != null){
        msg = msg + ' ' + floorPermission;
    }
    if(floorIndicator != undefined && floorIndicator != null){
        msg = msg + ' ' + floorIndicator;
    }
    if(faId != undefined && faId != null){
        msg = msg + ' ' + faId;
    }

    var payload = msg;

    msg = msg.replace(/ /g, "");

    var length = dec2bin(msg.length/32).toString().padStart(16,'0');
    var floorLength = addStr(length, 8, ' ');

    //  Create Payload
    payload = version + padding +
        subType + ' ' +
        packetType + ' ' +
        floorLength + ' ' +
        payload;

    payload = payload.replace(/\s+/g,' ').trim();
    return payload;
}




//  Message Decode - Start

function decodeSubType(subType){
    console.log('debug', `inside decodeSubType in floor.js`);
    for (let [key, value] of subTypeMap.entries()) {
        if (value.slice(1) === subType){
            return key;
        }
    }
}

function decodePriority(fieldLength,fieldData){
    console.log('debug','inside decodePriority in floor.js')
    fieldData=fieldData.trim();
    fieldData=fieldData.slice(0,8);
    var priority = bin2dec(fieldData);
    return priority;
}

// console.log(decodePriority('00000010','00000100 00000000'))

function decodeSource(fieldLength,fieldData){
    console.log('debug','inside decodeSource in floor.js')
    fieldData=fieldData.trim();
    fieldData=fieldData.replace(/ /g,'');
    var source= bin2dec(fieldData);

    if(source==0){
        return 'Floor participant'
    }
    if(source==1){
        return 'Participating MCPTT function'
    }
    if(source==2){
        return 'Controlling MCPTT function'
    }
    if(source==3){
        return 'Non-controlling MCPTT function'
    }
}

// console.log(decodeSource('00000010','00000000 00000000'))

function decodeMessageType(fieldLength,fieldData){
    console.log('debug','inside decodeMessageType in floor.js')
    fieldData=fieldData.trim();
    fieldData=fieldData.slice(3,8);
    var messageType = fieldData;
    return messageType;
}

// console.log(decodeMessageType('00000010','00000110 00000000'))

function decodeFloorIndicator(fieldLength,fieldData){
    console.log('debug','inside decodeFloorIndicator in floor.js')
    var floorIndicator='';
    fieldData=fieldData.trim();
    console.log('inside decodeFloorIndicator')
    let fielddata=fieldData.replace(/ /g,'');
    if(fieldData[0]=='1'){
        floorIndicator=floorIndicator+"Normal call,"
    }
    if(fieldData[1]=='1'){
        floorIndicator=floorIndicator+"Broadcast group call,"
    }
    if(fieldData[2]=='1'){
        floorIndicator=floorIndicator+"System call,"
    }
    if(fieldData[3]=='1'){
        floorIndicator=floorIndicator+"Emergency call,"
    }
    if(fieldData[4]=='1'){
        floorIndicator=floorIndicator+"Imminent peril call,"
    }
    if(fieldData[5]=='1'){
        floorIndicator=floorIndicator+"Queueing supported,"
    }
    if(fieldData[6]=='1'){
        floorIndicator=floorIndicator+"Dual floor,"
    }
    if(fieldData[7]=='1'){
        floorIndicator=floorIndicator+"Temporary group call,"
    }
    if(fieldData[8]=='1'){
        floorIndicator=floorIndicator+"Multi-talker,"
    }
    floorIndicator=floorIndicator.slice(0,-1)

    console.log(floorIndicator)
    return floorIndicator;
}

// decodeFloorIndicator('00000010','10000100 00000000');

function decodeFA(fieldLength,fieldData){
    console.log('debug','inside decodeFA in floor.js ');
    fieldData=fieldData.trim();
    var fa= binDump2ascii(fieldData)
    return fa.slice(0, -1);
}

// console.log(decodeFA('00001000','00010001 00000110 01100001 01100010 01100011 01000000 01100110 01100001'))

//console.log(getFloorFAId('abc@fa'))

function decodeLocation(fieldLength,fieldData){
    console.log('debug','inside decodeLocation in floor.js')
    // var locationType=fieldData.slice(0,9);
    // console.log('locationType = '+locationType)
    fieldData=fieldData.trim();
    var locValue=fieldData.slice(9,62)
    locValue= binDump2hexDump(locValue)

    let temp=locValue.split(' ');
    let lat='';
    let long='';
    for(let i=0;i<3;i++){
        lat=lat+temp[i]+' ';
    }
    lat = lat.slice(0, -1);
    for(let i=3;i<6;i++){
        long=long+temp[i]+' ';
    }
    long = long.slice(0, -1);

    return lat+','+long;
}

function decodeFloorMessage(message){
    console.log('debug', `inside decodeFloorMessage in floor.js`);
    var octetArray = message.split(' ');

    var version = octetArray[0].slice(0,2);
    var pad = octetArray[0].charAt(2);
    var subType = octetArray[0].slice(4);
    var messageType = decodeSubType(subType);

    //var packetType=octetArray[1];

    var length = octetArray[2]+octetArray[3];
    length = length.replace(/ /g, ""); //no of words
    length = bin2dec(length) * 4;  //no of octets

    var packetType = octetArray[1];
    packetType = bin2dec(packetType);

    var senderSSRC = octetArray[4] + ' ' + octetArray[5] + ' ' + octetArray[6] + ' ' + octetArray[7];
    senderSSRC = binDump2hexDump(senderSSRC);

    var nameField = octetArray[8] + ' ' + octetArray[9] + ' ' + octetArray[10] + ' ' + octetArray[11];
    nameField = binDump2ascii(nameField);

    var fieldData='';
    var fieldId,fieldLength;

    for(var i=12; i < octetArray.length; ) {
        fieldId = octetArray[i];
        fieldLength = octetArray[i+1];
        fieldLength = bin2dec(fieldLength)

        var fieldName = '';
        for (let [key, value] of fieldIdMap.entries()) {
            if (value === fieldId){
                fieldName = key;
            }
        }

        fieldData='';
        for(var j = 0; j < fieldLength; j++) {
            fieldData=fieldData +' '+ octetArray[i+j+2];
        }
        fieldData.toString().slice(0, -1);
        // console.log('fieldData = '+fieldData)
        var padLen = (4 - ((fieldLength + 2) % 4)) % 4;
        // console.log('padLen = '+padLen)
        // console.log('i = '+i)

        var m = i + 2 + fieldLength + padLen;
        // console.log('m = '+m)
        i = m;
        var fieldIdDec= bin2dec(fieldId).toString();
        // console.log('field id dec = '+fieldIdDec);

        var priority,source,fieldMessageType,floorIndicator,FA,lat,long;

        switch(fieldIdDec){
            case '0':   priority = decodePriority(fieldLength, fieldData);
                // console.log('priority = '+priority)
                break;
            case '10':  source = decodeSource(fieldLength, fieldData);
                // console.log('source = '+source)
                break;
            case '12':  fieldMessageType = decodeMessageType(fieldLength, fieldData);
                // console.log('fieldMessageType = '+fieldMessageType)
                break;
            case '13':  floorIndicator = decodeFloorIndicator(fieldLength, fieldData);
                // console.log('floorIndicator = '+floorIndicator)
                break;
            case '17':  FA= decodeFA(fieldLength, fieldData);
                // console.log('FA = '+FA)
                break;
            case '19':  location = decodeLocation(fieldLength, fieldData);
                location = location.split(',')
                //console.log(location)
                lat = location[0];
                long = location[1];
                // console.log('lat = '+lat)
                // console.log('long = '+long)
                break;
            default :   console.log('fieldId not found')
                break;
        }
    }
    return {
        version : version,
        packetType : packetType,
        padding : pad,
        subType : subType,
        length : length,
        messageType : messageType,
        senderSSRC : senderSSRC,
        nameField : nameField,
        fieldName : fieldName,
        fieldIdDec : fieldIdDec,
        priority : priority,
        source : source,
        fieldMessageType : fieldMessageType,
        floorIndicator : floorIndicator,
        FA : FA,
        lat : lat,
        long : long
    };
}
//  Message Decode - end

export function main(msgId, socket, port, ip) {
    var ssrc = 0x12345678;
    var idleMessage = getFloorIdle({
        ack : '0',
        ssrc : toHexDump(ssrc.toString(16))
    })
    console.log(idleMessage);

    var denyMessage = getFloorDeny({
        ack : '0', // ack
        ssrc : toHexDump(ssrc.toString(16)),
        rejectCause : 3,
        floorInd : "Normal call"
    });
    console.log(denyMessage);

    var revokeMessage = getFloorRevoke({
        ack : '0',  //  ack bit
        ssrc : toHexDump(ssrc.toString(16)),   //  server ssrc
        revokeCause : 4,   //  Media Burst pre-empted
        floorIndicator : "Normal call"   // Floor Indicator
    });
    console.log(revokeMessage);

    var grantedMessage = getFloorGranted({
        ack : '0',  //  ack bit
        ssrc : toHexDump(ssrc.toString(16)),   //  server ssrc
        time : 60,   //  Granted time
        //  data.holderSSRC : grantedSSRC,  //  Holder SSRC
        priority : 50,  //  Holder Priority
        floorIndicator : "Normal call"   // Floor Indicator
    });
    console.log(grantedMessage);

    var floorTakenMsg = getFloorTaken({
        ack : '0',  //  ack bit
        ssrc : toHexDump(ssrc.toString(16)),   //  server ssrc
        time : 30,   //  Granted time
        //  data.holderSSRC : grantedSSRC,  //  Holder SSRC
        //  grantList : grantedUsersArray,  //  Granted User List in Array
        //  grantedSSRCList : grantedSSRCArray, //  Granted User SSRCs List in Array
        //  grantedFAIDArray : faIDArray,   //  Granted User FAIDs List in Array
        //  grantedLocation : location,     //  Location of holder
        //  locList :  locArray     //  Granted User Location List in Array
        priority : 50,  //  Holder Priority
        floorIndicator : "Normal call",   // Floor Indicator
        holderID : "sip:abhishek.mclabs.in", // grantedMcpttId,
        faID : "sip:hc@thane.mclabs.in",
        permission : 1 // permission
    });
    var reqMessage = getFloorRequest({
        ack : '0',  //  ack bit
        ssrc : toHexDump(ssrc.toString(16)),   //  server ssrc
        priority : 8,  //  Holder Priority
        floorIndicator : "Normal call",   // Floor Indicator
        faID : "sip:tc@thane.mclabs.in"
    });
    var relMessage = getFloorRelease({
        ack : '0',  //  ack bit
        ssrc : toHexDump(ssrc.toString(16)),   //  server ssrc
        floorIndicator : "Normal call",   // Floor Indicator
    });

    console.log(floorTakenMsg);

    // var server = dgram.createSocket("udp4");
    // server.bind({
    //     address: '192.168.0.109',
    //     port: 10000
    // });
    // var server = null

    if(msgId === 1){
        var msg = binaryAgent(idleMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf,  0,buf.length,parseInt(port), ip,  (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`idle event sent`);
            }
        });

        let hexmsg = toHexDump(buf.toString('hex'));
        let binmsg = hexDumptoBinaryDump(hexmsg);
        var floorData = decodeFloorMessage(binmsg);
        console.log(floorData);
    }

    if(msgId === 2){
        var msg = binaryAgent(denyMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf,  0,buf.length,parseInt(port), ip,  (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`deny event sent`);
            }
        });
    }

    if(msgId === 3){
        var msg = binaryAgent(revokeMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf,  0,buf.length,parseInt(port), ip,  (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`Revoke event sent`);
            }
        });
    }

    if(msgId === 4){
        var msg = binaryAgent(grantedMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf, 0,buf.length,parseInt(port), ip,  (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`Granted event sent`);
            }
        });
    }

    if(msgId === 5){
        var msg = binaryAgent(floorTakenMsg);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf, 0,buf.length,parseInt(port), ip, (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`taken event sent`);
            }
        });

        let hexmsg = toHexDump(buf.toString('hex'));
        let binmsg = hexDumptoBinaryDump(hexmsg);
        var floorData = decodeFloorMessage(binmsg);
        console.log(floorData);
    }

    if(msgId === 6){
        var msg = binaryAgent(reqMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf, 0,buf.length,parseInt(port), ip, (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`taken event sent`);
            }
        });

        let hexmsg = toHexDump(buf.toString('hex'));
        let binmsg = hexDumptoBinaryDump(hexmsg);
        var floorData = decodeFloorMessage(binmsg);
        console.log(floorData);
    }
    if(msgId === 7){
        var msg = binaryAgent(relMessage);
        var buf = Buffer.from(msg, 'binary');
        socket.send(buf, 0,buf.length,parseInt(port), ip, (err) => {
            if(err){
                console.log('error', err);
            } else {
                console.log(`taken event sent`);
            }
        });

        let hexmsg = toHexDump(buf.toString('hex'));
        let binmsg = hexDumptoBinaryDump(hexmsg);
        var floorData = decodeFloorMessage(binmsg);
        console.log(floorData);
    }
}