using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public partial class Variant
    {
        [JsonProperty("id")]
        public long Id { get; set; }

        [JsonProperty("chromosome_based_cnv")]
        public bool ChromosomeBasedCnv { get; set; }

        [JsonProperty("cnv_type")]
        public string CnvType { get; set; }

        [JsonProperty("description_type")]
        public string DescriptionType { get; set; }

        [JsonProperty("gene")]
        public Gene Gene { get; set; }

        [JsonProperty("germline")]
        public bool? Germline { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("partner_gene")]
        public Gene PartnerGene { get; set; }

        [JsonProperty("variant_type")]
        public string VariantType { get; set; }
    }
}
