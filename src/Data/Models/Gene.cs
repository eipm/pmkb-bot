using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public class Gene
    {
        [JsonProperty("id")]
        public int Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("description")]
        public string Description { get; set; }
    }
}
