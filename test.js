const cloudWatch = require('./lib/cloudwatch');

const accessKeyId = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const region = process.env.region;
const appName = process.env.APP_NAME;

cloudWatch.init({
    region,
    accessKeyId,
    secretAccessKey,
    appName, 
    includeLocalDateTime: true
})
.then(() => {
    setInterval( () => {
        cloudWatch.putLog({
            logMessage: 'test message'
        });
    }, 1000);    
});