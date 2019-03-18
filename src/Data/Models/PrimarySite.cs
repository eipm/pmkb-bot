using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public partial class PrimarySite
    {
        [JsonProperty("id")]
        public int Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }
    }
}
