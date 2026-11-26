const serverless = require('serverless-http');
const { app, db } = require('../../server/src/app');

const handler = serverless(app, {
    binary: ['image/*', 'multipart/form-data', 'application/octet-stream']
});

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await db.init();
    return handler(event, context);
};
