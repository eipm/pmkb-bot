"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const needle = require("needle");
const stream = require("stream");
const querystring = require("querystring");
const debug = require('debug')('bingspeechclient');
const ASIAN_LOCALES = ['zh-cn', 'zh-hk', 'zh-tw', 'ja-jp'];
const VOICES = {
    'ar-eg female': 'Microsoft Server Speech Text to Speech Voice (ar-EG, Hoda)',
    'de-de female': 'Microsoft Server Speech Text to Speech Voice (de-DE, Hedda)',
    'de-de male': 'Microsoft Server Speech Text to Speech Voice (de-DE, Stefan, Apollo)',
    'en-au female': 'Microsoft Server Speech Text to Speech Voice (en-AU, Catherine)',
    'en-ca female': 'Microsoft Server Speech Text to Speech Voice (en-CA, Linda)',
    'en-gb female': 'Microsoft Server Speech Text to Speech Voice (en-GB, Susan, Apollo)',
    'en-gb male': 'Microsoft Server Speech Text to Speech Voice (en-GB, George, Apollo)',
    'en-in male': 'Microsoft Server Speech Text to Speech Voice (en-IN, Ravi, Apollo)',
    'en-us female': 'Microsoft Server Speech Text to Speech Voice (en-US, ZiraRUS)',
    'en-us male': 'Microsoft Server Speech Text to Speech Voice (en-US, BenjaminRUS)',
    'es-es female': 'Microsoft Server Speech Text to Speech Voice (es-ES, Laura, Apollo)',
    'es-es male': 'Microsoft Server Speech Text to Speech Voice (es-ES, Pablo, Apollo)',
    'es-mx male': 'Microsoft Server Speech Text to Speech Voice (es-MX, Raul, Apollo)',
    'fr-ca female': 'Microsoft Server Speech Text to Speech Voice (fr-CA, Caroline)',
    'fr-fr female': 'Microsoft Server Speech Text to Speech Voice (fr-FR, Julie, Apollo)',
    'fr-fr male': 'Microsoft Server Speech Text to Speech Voice (fr-FR, Paul, Apollo)',
    'it-it male': 'Microsoft Server Speech Text to Speech Voice (it-IT, Cosimo, Apollo)',
    'ja-jp female': 'Microsoft Server Speech Text to Speech Voice (ja-JP, Ayumi, Apollo)',
    'ja-jp male': 'Microsoft Server Speech Text to Speech Voice (ja-JP, Ichiro, Apollo)',
    'pt-br male': 'Microsoft Server Speech Text to Speech Voice (pt-BR, Daniel, Apollo)',
    'ru-ru female': 'Microsoft Server Speech Text to Speech Voice (ru-RU, Irina, Apollo)',
    'ru-ru male': 'Microsoft Server Speech Text to Speech Voice (ru-RU, Pavel, Apollo)',
    'zh-cn female': 'Microsoft Server Speech Text to Speech Voice (zh-CN, Yaoyao, Apollo)',
    'zh-cn male': 'Microsoft Server Speech Text to Speech Voice (zh-CN, Kangkang, Apollo)',
    'zh-hk female': 'Microsoft Server Speech Text to Speech Voice (zh-HK, Tracy, Apollo)',
    'zh-hk male': 'Microsoft Server Speech Text to Speech Voice (zh-HK, Danny, Apollo)',
    'zh-tw female': 'Microsoft Server Speech Text to Speech Voice (zh-TW, Yating, Apollo)',
    'zh-tw male': 'Microsoft Server Speech Text to Speech Voice (zh-TW, Zhiwei, Apollo)'
};
class BingSpeechClient {
    constructor(subscriptionKey) {
        this.BING_SPEECH_TOKEN_ENDPOINT = 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken';
        this.BING_SPEECH_ENDPOINT_STT = 'https://speech.platform.bing.com/recognize';
        this.BING_SPEECH_ENDPOINT_TTS = 'https://speech.platform.bing.com/synthesize';
        this.AUDIO_OUTPUT_FORMAT = 'riff-8khz-8bit-mono-mulaw';
        this.subscriptionKey = subscriptionKey;
    }
    recognize(wave, locale = 'en-us') {
        var bufferStream = new stream.PassThrough();
        bufferStream.end(wave);
        return this.recognizeStream(bufferStream, locale);
    }
    recognizeStream(input, locale = 'en-us') {
        return this.issueToken()
            .then((token) => {
            this.token = token;
            this.tokenExpirationDate = Date.now() + 9 * 60 * 1000;
            let params = {
                'scenarios': 'ulm',
                'appid': 'D4D52672-91D7-4C74-8AD8-42B1D98141A5',
                'locale': locale,
                'device.os': '-',
                'version': '3.0',
                'format': 'json',
                'requestid': uuid.v4(),
                'instanceid': uuid.v4()
            };
            let options = {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'audio/wav; codec="audio/pcm"; samplerate=16000'
                },
                open_timeout: 5000,
                read_timeout: 5000
            };
            return new Promise((resolve, reject) => {
                let endpoint = this.BING_SPEECH_ENDPOINT_STT + '?' + querystring.stringify(params);
                needle.post(endpoint, input, options, (err, res, body) => {
                    if (err) {
                        return reject(err);
                    }
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Wrong status code ${res.statusCode} in Bing Speech API / synthesize`));
                    }
                    resolve(body);
                });
            });
        })
            .catch((err) => {
            throw new Error(`Voice recognition failed miserably: ${err.message}`);
        });
    }
    synthesize(text, locale = 'en-us', gender = 'female') {
        return this.synthesizeStream(text, locale, gender)
            .then(waveStream => {
            return new Promise((resolve, reject) => {
                let buffers = [];
                waveStream.on('data', (buffer) => buffers.push(buffer));
                waveStream.on('end', () => {
                    let wave = Buffer.concat(buffers);
                    let response = {
                        wave: wave
                    };
                    resolve(response);
                });
                waveStream.on('error', (err) => reject(err));
            });
        })
            .catch((err) => {
            throw new Error(`Voice synthesis failed miserably: ${err.message}`);
        });
    }
    synthesizeStream(text, locale = 'en-us', gender = 'female') {
        return this.issueToken()
            .then((token) => {
            this.token = token;
            this.tokenExpirationDate = Date.now() + 9 * 60 * 1000;
            if (ASIAN_LOCALES.indexOf(locale.toLowerCase()) > -1) {
                text = this.convertToUnicode(text);
            }
            let font = voiceFont(locale, gender);
            if (!font) {
                throw new Error(`No voice font for lang ${locale} and gender ${gender}`);
            }
            let ssml = `<speak version='1.0' xml:lang='${locale}'>
                            <voice name='${font}' xml:lang='${locale}' xml:gender='${gender}'>${text}</voice>
                            </speak>`;
            let options = {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/ssml+xml',
                    'Content-Length': ssml.length,
                    'X-Microsoft-OutputFormat': this.AUDIO_OUTPUT_FORMAT,
                    'X-Search-AppId': '00000000000000000000000000000000',
                    'X-Search-ClientID': '00000000000000000000000000000000',
                    'User-Agent': 'bingspeech-api-client'
                },
                open_timeout: 5000,
                read_timeout: 5000
            };
            return needle.post(this.BING_SPEECH_ENDPOINT_TTS, ssml, options);
        })
            .catch((err) => {
            throw new Error(`Voice synthesis failed miserably: ${err.message}`);
        });
    }
    issueToken() {
        if (this.token && this.tokenExpirationDate > Date.now()) {
            debug('reusing existing token');
            return Promise.resolve(this.token);
        }
        debug('issue new token for subscription key %s', this.subscriptionKey);
        let options = {
            headers: {
                'Ocp-Apim-Subscription-Key': this.subscriptionKey,
                'Content-Length': 0
            },
            open_timeout: 3000,
            read_timeout: 3000
        };
        return new Promise((resolve, reject) => {
            needle.post(this.BING_SPEECH_TOKEN_ENDPOINT, null, options, (err, res, body) => {
                if (err) {
                    return reject(err);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`Wrong status code ${res.statusCode} in Bing Speech API / token`));
                }
                resolve(body);
            });
        });
    }
    convertToUnicode(message) {
        return message.split('')
            .map((c) => '&#' + c.charCodeAt(0) + ';')
            .join('');
    }
}
exports.BingSpeechClient = BingSpeechClient;
function voiceFont(locale, gender) {
    let voiceKey = (locale + ' ' + gender).toLowerCase();
    return VOICES[voiceKey];
}
//# sourceMappingURL=client.js.map