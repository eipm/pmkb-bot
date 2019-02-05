using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;

namespace Pmkb.Bot.Data
{
    public class PmkbApi : IDisposable
    {
        private readonly Uri _baseApiUri;
        private readonly string _username;
        private readonly string _password;
        private readonly HttpClient _client;

        public PmkbApi(Uri baseApiUri, string username, string password)
        {
            _baseApiUri = baseApiUri ?? throw new ArgumentNullException(nameof(baseApiUri));
            _username = username ?? throw new ArgumentNullException(nameof(username));
            _password = password ?? throw new ArgumentNullException(nameof(password));

            _client = new HttpClient { BaseAddress = baseApiUri };
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($"{username}:{password}")));

            Interpretations = new InterpretationsRepository(_client);
            Genes = new GenesRepository(_client);
        }

        public InterpretationsRepository Interpretations { get; set; }
        public GenesRepository Genes { get; set; }

        public void Dispose()
        {
            _client.Dispose();
        }
    }
}
