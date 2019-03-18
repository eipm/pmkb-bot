using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace Pmkb.Bot.Data
{
    public class Repository<T>
    {
        protected HttpClient _client;

        public Repository(HttpClient client)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
        }

        protected static async Task<T1> ReadResponseAsync<T1>(HttpResponseMessage response)
        {
            if (response.StatusCode == HttpStatusCode.OK)
            {
                return await response.Content.ReadAsAsync<T1>();
            }
            else
            {
                var content = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException(content);
            }
        }
    }
}
