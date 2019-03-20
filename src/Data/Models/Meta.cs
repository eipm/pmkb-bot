using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public class Meta
    {
        [JsonProperty("total")]
        public int Total { get; set; }
    }
}
