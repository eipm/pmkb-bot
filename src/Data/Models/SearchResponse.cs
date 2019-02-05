using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public class SearchResponse
    {
        [JsonProperty("meta")]
        public Meta Meta { get; set; }

        [JsonProperty("results")]
        public Results Results { get; set; }
    }
}
