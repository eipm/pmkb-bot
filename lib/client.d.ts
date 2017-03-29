/// <reference types="node" />
import { VoiceRecognitionResponse, VoiceSynthesisResponse } from './models';
export declare class BingSpeechClient {
    private BING_SPEECH_TOKEN_ENDPOINT;
    private BING_SPEECH_ENDPOINT_STT;
    private BING_SPEECH_ENDPOINT_TTS;
    private subscriptionKey;
    private token;
    private tokenExpirationDate;
    private AUDIO_OUTPUT_FORMAT;
    constructor(subscriptionKey: string);
    recognize(wave: Buffer, locale?: string): Promise<VoiceRecognitionResponse>;
    recognizeStream(input: NodeJS.ReadWriteStream, locale?: string): Promise<VoiceRecognitionResponse>;
    synthesize(text: string, locale?: string, gender?: string): Promise<VoiceSynthesisResponse>;
    synthesizeStream(text: string, locale?: string, gender?: string): Promise<NodeJS.ReadWriteStream>;
    private issueToken();
    private convertToUnicode(message);
}
