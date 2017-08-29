import util from 'aws-sdk/lib/util';

const isBrowser=new Function("try {return this===window;}catch(e){ return false;}");

if (isBrowser()) {
    util.crypto.lib = require('crypto');
    util.Buffer = require('buffer').Buffer;
    util.domain = require('domain');
    util.stream = require('stream');
    util.url = require('url');
    util.querystring = require('querystring');
    util.environment = 'nodejs';
}

export class SigV4Utils {
    getSignatureKey(key, date, region, service) {
        const kDate = util.crypto.hmac('AWS4' + key, date, 'buffer');
        const kRegion = util.crypto.hmac(kDate, region, 'buffer');
        const kService = util.crypto.hmac(kRegion, service, 'buffer');
        const kCredentials = util.crypto.hmac(kService, 'aws4_request', 'buffer');
        return kCredentials;
    }

    getSignedUrl(host, region, credentials) {
        const datetime = util.date.iso8601(new Date()).replace(/[:\-]|\.\d{3}/g, '');
        const date = datetime.substr(0, 8);

        const method = 'GET';
        const protocol = 'wss';
        const uri = '/mqtt';
        const service = 'iotdevicegateway';
        const algorithm = 'AWS4-HMAC-SHA256';

        const credentialScope = date + '/' + region + '/' + service + '/' + 'aws4_request';
        let canonicalQuerystring = 'X-Amz-Algorithm=' + algorithm;
        canonicalQuerystring += '&X-Amz-Credential=' + encodeURIComponent(credentials.accessKeyId + '/' + credentialScope);
        canonicalQuerystring += '&X-Amz-Date=' + datetime;
        canonicalQuerystring += '&X-Amz-SignedHeaders=host';

        const canonicalHeaders = 'host:' + host + '\n';
        const payloadHash = util.crypto.sha256('', 'hex');
        const canonicalRequest = method + '\n' + uri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\nhost\n' + payloadHash;
        const stringToSign = algorithm + '\n' + datetime + '\n' + credentialScope + '\n' + util.crypto.sha256(canonicalRequest, 'hex');
        const signingKey = this.getSignatureKey(credentials.secretAccessKey, date, region, service);
        const signature = util.crypto.hmac(signingKey, stringToSign, 'hex');

        canonicalQuerystring += '&X-Amz-Signature=' + signature;
        if (credentials.sessionToken) {
            canonicalQuerystring += '&X-Amz-Security-Token=' + encodeURIComponent(credentials.sessionToken);
        }
        const requestUrl = protocol + '://' + host + uri + '?' + canonicalQuerystring;
        return requestUrl;
    }
}
