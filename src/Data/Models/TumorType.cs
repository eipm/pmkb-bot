using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public partial class TumorType
    {
        [JsonProperty("id")]
        public long Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }
    }
}
