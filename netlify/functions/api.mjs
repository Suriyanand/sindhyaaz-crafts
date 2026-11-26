import serverless from 'serverless-http';
import { app, db } from '../../server/src/app.js';

const expressHandler = serverless(app, {
    binary: ['image/*', 'multipart/form-data', 'application/octet-stream']
});

export default async (req, context) => {
    const url = new URL(req.url);

    // Ensure NETLIFY_DB_URL / DATABASE_URL from Netlify runtime env is visible to database.js
    let envConn = '';
    try {
        if (typeof Netlify !== 'undefined' && Netlify.env) {
            envConn = Netlify.env.get('NETLIFY_DB_URL') || Netlify.env.get('DATABASE_URL') || '';
        }
    } catch (e) {}

    if (envConn && !process.env.NETLIFY_DB_URL) {
        process.env.NETLIFY_DB_URL = envConn;
    }

    await db.init(envConn);

    const headers = {};
    req.headers.forEach((value, key) => {
        headers[key] = value;
    });

    const multiValueQueryStringParameters = {};
    const queryStringParameters = {};
    url.searchParams.forEach((value, key) => {
        queryStringParameters[key] = value;
        if (!multiValueQueryStringParameters[key]) multiValueQueryStringParameters[key] = [];
        multiValueQueryStringParameters[key].push(value);
    });

    let body = undefined;
    let isBase64Encoded = false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const arrayBuf = await req.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
            body = Buffer.from(arrayBuf).toString('base64');
            isBase64Encoded = true;
        }
    }

    const event = {
        httpMethod: req.method,
        path: url.pathname,
        rawUrl: req.url,
        rawQuery: url.search ? url.search.slice(1) : '',
        headers,
        queryStringParameters,
        multiValueQueryStringParameters,
        body,
        isBase64Encoded
    };

    const result = await expressHandler(event, {
        callbackWaitsForEmptyEventLoop: false,
        netlifyContext: context
    });

    const resHeaders = new Headers();
    if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
            if (v !== undefined) resHeaders.set(k, String(v));
        }
    }
    if (result.multiValueHeaders) {
        for (const [k, vals] of Object.entries(result.multiValueHeaders)) {
            if (Array.isArray(vals)) {
                vals.forEach(v => resHeaders.append(k, String(v)));
            }
        }
    }

    const responseBody = result.isBase64Encoded && result.body
        ? Buffer.from(result.body, 'base64')
        : (result.body ?? '');

    return new Response(responseBody, {
        status: result.statusCode || 200,
        headers: resHeaders
    });
};
