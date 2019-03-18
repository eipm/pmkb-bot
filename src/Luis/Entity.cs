using Newtonsoft.Json;

namespace Pmkb.Bot.Luis
{
    public class Entity
    {
        [JsonProperty("endIndex")]
        public int EndIndex { get; set; }

        [JsonProperty("startIndex")]
        public int StartIndex { get; set; }

        [JsonProperty("text")]
        public string Text { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }
    }
}
