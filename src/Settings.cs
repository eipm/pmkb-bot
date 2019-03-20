using System;
using Microsoft.Extensions.Configuration;

namespace Pmkb.Bot
{
    public class Settings
    {
        public Settings(IConfiguration configuration)
        {
            Host = new Uri(configuration.GetValue<string>("host"));
            PmkbHost = new Uri(configuration.GetValue<string>("pmkb_host"));
            PmkbApiBaseUri = new Uri(configuration.GetValue<string>("pmkb_api_base_uri"));
            PmkbApiUsername = configuration.GetValue<string>("pmkb_api_username");
            PmkbApiPassword = configuration.GetValue<string>("pmkb_api_password");
            MicrosoftSpeechApiKey = configuration.GetValue<string>("MicrosoftSpeechApiKey");
            MicrosoftWebChatSecretKey = configuration.GetValue<string>("MicrosoftWebChatSecretKey");
            CrisEndpointId = configuration.GetValue<string>("CrisEndpointId");
            SpeechSynthesizerSubscriptionKey = configuration.GetValue<string>("SpeechSynthesizerSubscriptionKey");
            AppInsightsInstrumentationKey = configuration.GetValue<string>("AppInsightsInstrumentationKey");

            BotFrameworkApiTokensUrl = new Uri(configuration.GetValue<string>("BotFrameworkApiTokensUrl"));
        }

        public Uri Host { get; private set; }
        public Uri PmkbHost { get; private set; }
        public Uri PmkbApiBaseUri { get; private set; }
        public string PmkbApiUsername { get; internal set; }
        public string PmkbApiPassword { get; internal set; }
        public string MicrosoftSpeechApiKey { get; internal set; }
        public string MicrosoftWebChatSecretKey { get; internal set; }
        public string CrisEndpointId { get; internal set; }
        public string SpeechSynthesizerSubscriptionKey { get; internal set; }
        public string AppInsightsInstrumentationKey { get; internal set; }

        public Uri BotFrameworkApiTokensUrl { get; internal set; }
    }
}
