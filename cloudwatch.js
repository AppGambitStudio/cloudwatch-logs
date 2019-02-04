const AWS = require('aws-sdk');
const interval = require('interval-promise');
const moment = require('moment');

let sequenceToken;
let cloudwatchlogs;
let appName;
let includeLocalDateTime = false;

let initDone = false;
let pendingMessages = [];

const maxMessages = 1000;

const _logStream = (logGroup, logStream) => {
    return new Promise(function(resolve, reject) {
        var params = {
            logGroupName: logGroup,
            limit: 50,
            logStreamNamePrefix: logStream            
        };
        cloudwatchlogs.describeLogStreams(params, function(err, data) {
            if (err) {
                reject(err);
            }else{
                const streams = data.logStreams.filter( (grp) => grp.logStreamName == logStream);
                // console.log(streams);
                if(streams.length > 0){
                    console.log(streams[0].uploadSequenceToken);
                    sequenceToken = streams[0].uploadSequenceToken                    
                    resolve(streams[0]);
                }else{
                    var params = {
                        logGroupName: logGroup,
                        logStreamName: logStream
                    };

                    cloudwatchlogs.createLogStream(params, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                }
            }     
        });        
    });    
}

const _sendLog = (message, cb) => {
    let {logMessage} = message;

    const logStream = moment.utc().format('YYYY/MM/DD');

    if(includeLocalDateTime){
        logMessage = `[SERVER TIME:${moment().format('DD/MM/YYYY HH:mm:ss')}] ${logMessage}`;
    }
    
    return _logStream(appName, logStream)
    .then(() => {
        var params = {
            logEvents: [{
                message: logMessage,
                timestamp: new Date().getTime()
            }],
            logGroupName: appName,
            logStreamName: logStream,
            sequenceToken: sequenceToken
        };
        if(pendingMessages.length > 0){
            interval(async () => {
                await pendingMessages.pop();
                await cloudwatchlogs.putLogEvents(params, function(err, data) {
                    if (err) {
                        if(cb){
                            return cb(err);
                        }else{
                            console.log(err);
                        }
                    }else{
                        sequenceToken = data.nextSequenceToken;                
                    }
                });
            },1500,{iterations: pendingMessages.length});
        }   
    })    
};

module.exports = {
    init: (data, cb) => {
        const {region, accessKeyId, secretAccessKey, tags = {} } = data;
        appName = data.appName;
        includeLocalDateTime = data.includeLocalDateTime;

        cloudwatchlogs = new AWS.CloudWatchLogs({
            region,
            accessKeyId,
            secretAccessKey
        });

        return new Promise((resolve, reject) => {
            var params = {
                limit: 50,
                logGroupNamePrefix: appName,
                nextToken: null
            };

            cloudwatchlogs.describeLogGroups(params, function(err, data) {
                if (err) {
                    reject(err);
                }else{
                    const groups = data.logGroups.filter( (grp) => grp.logGroupName == appName);
                     console.log(groups);
                    if(groups.length > 0){
                        initDone = true;
                        resolve(groups[0]);
                    }else{
                        var params = {
                            logGroupName: appName,    
                        };
                        cloudwatchlogs.createLogGroup(params, function(err, data) {
                            if (err) reject(err);
                            else {
                                initDone = true;
                                resolve(data);
                            }
                        });
                    }                    
                }
            });            
        });                
    },

    putLog: (message, cb) => {
        if(initDone && pendingMessages.length == 0){
            pendingMessages.push(message);
            console.log(pendingMessages);
            return _sendLog(message, cb);
        }
        else return; 
    }
};