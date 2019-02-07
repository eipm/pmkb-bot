using System;
using System.Net.Http;

namespace Pmkb.Bot
{
    public class BotHelper
    {
        private Settings _settings;

        public string SpeechKey => _settings.MicrosoftSpeechApiKey;

        public BotHelper(Settings settings)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        }

        public string GetBotToken()
        {
            using (var client = new HttpClient())
            {
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("BotConnector", _settings.MicrosoftWebChatSecretKey);
                var response = client.GetAsync(_settings.BotFrameworkApiTokensUrl).Result;
                response.EnsureSuccessStatusCode();
                return response.Content.ReadAsStringAsync().Result;
            }
        }
    }
}
