using System;
using System.IO;
using System.Linq;
using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Builder.Integration;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Configuration;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pmkb.Bot.Data;

namespace Pmkb.Bot
{
    /// <summary>
    /// The Startup class configures services and the app's request pipeline.
    /// </summary>
    public class Startup
    {
        private ILoggerFactory _loggerFactory;
        private readonly bool _isProduction = false;

        public Startup(IHostingEnvironment env)
        {
            _isProduction = true; //env.IsProduction();

            var builder = new ConfigurationBuilder()
                .SetBasePath(env.ContentRootPath)
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true)
                .AddEnvironmentVariables();

            this.Configuration = builder.Build();
        }

        private IHostingEnvironment CurrentEnvironment { get; set; }

        /// <summary>
        /// Gets the configuration that represents a set of key/value application configuration properties.
        /// </summary>
        /// <value>
        /// The <see cref="IConfiguration"/> that represents a set of key/value application configuration properties.
        /// </value>
        public IConfiguration Configuration { get; }

        /// <summary>
        /// This method gets called by the runtime. Use this method to add services to the container.
        /// </summary>
        /// <param name="services">Specifies the contract for a <see cref="IServiceCollection"/> of service descriptors.</param>
        /// <seealso cref="IStatePropertyAccessor{T}"/>
        /// <seealso cref="https://docs.microsoft.com/en-us/aspnet/web-api/overview/advanced/dependency-injection"/>
        /// <seealso cref="https://docs.microsoft.com/en-us/azure/bot-service/bot-service-manage-channels?view=azure-bot-service-4.0"/>
        public void ConfigureServices(IServiceCollection services)
        {
            var settings = new Settings(Configuration);
            TelemetryConfiguration.Active.InstrumentationKey = settings.AppInsightsInstrumentationKey;
            var telemetryClient = new TelemetryClient();
            services.AddSingleton(settings);
            services.AddSingleton(telemetryClient);
            services.AddSingleton(cards => new Cards(CurrentEnvironment, settings));

            services.AddScoped(typeof(PmkbApi), (arg) => new PmkbApi(settings.PmkbApiBaseUri, settings.PmkbApiUsername, settings.PmkbApiPassword));

            var secretKey = Configuration.GetSection("botFileSecret")?.Value;
            var botFilePath = Configuration.GetSection("botFilePath")?.Value;

            if (!File.Exists(botFilePath))
            {
                throw new FileNotFoundException($"The .bot configuration file was not found. botFilePath: {botFilePath}");
            }

            // Loads .bot configuration file and adds a singleton that your Bot can access through dependency injection.
            var botConfig = BotConfiguration.Load(botFilePath ?? @".\pmkb.bot", secretKey);
            services.AddSingleton(sp => botConfig ?? throw new InvalidOperationException($"The .bot configuration file could not be loaded. botFilePath: {botFilePath}"));

            // Initialize Bot Connected Services clients.
            var connectedServices = new BotServices(botConfig);
            services.AddSingleton(sp => connectedServices);

            services.AddSingleton(sp => botConfig);
            services.AddBot<PmkbBot>(options =>
            {
                // Retrieve current endpoint.
                var environment = _isProduction ? "production" : "development";
                var service = botConfig.Services.FirstOrDefault(s => s.Type == "endpoint" && s.Name == environment);
                if (!(service is EndpointService endpointService))
                {
                    throw new InvalidOperationException($"The .bot file does not contain an endpoint with name '{environment}'.");
                }

                options.CredentialProvider = new SimpleCredentialProvider(endpointService.AppId, endpointService.AppPassword);

                // Creates a logger for the application to use.
                ILogger logger = _loggerFactory.CreateLogger<PmkbBot>();

                // Catches any errors that occur during a conversation turn and logs them.
                options.OnTurnError = async (context, exception) =>
                {
                    logger.LogError($"Exception caught : {exception}");
                    telemetryClient.TrackException(exception);
                    await context.SendActivityAsync("Sorry, it looks like something went wrong.");
                };

                IStorage dataStore = new MemoryStorage();
                var conversationState = new ConversationState(dataStore);

                options.State.Add(conversationState);
            });

            // Create and register state accessors.
            // Accessors created here are passed into the IBot-derived class on every turn.
            services.AddSingleton<BotAccessors>(sp =>
            {
                var options = sp.GetRequiredService<IOptions<BotFrameworkOptions>>().Value;
                if (options == null)
                {
                    throw new InvalidOperationException(
                        "BotFrameworkOptions must be configured prior to setting up the State Accessors");
                }

                var conversationState = options.State.OfType<ConversationState>().FirstOrDefault();
                if (conversationState == null)
                {
                    throw new InvalidOperationException(
                        "ConversationState must be defined and added before adding conversation-scoped state accessors.");
                }

                var accessors = new BotAccessors(conversationState)
                {
                    ConversationDialogState = conversationState.CreateProperty<DialogState>(BotAccessors.DialogStateName),
                };

                return accessors;
            });

            services.AddMvc();
        }

        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            _loggerFactory = loggerFactory;
            CurrentEnvironment = env;
            app.UseDefaultFiles()
                .UseStaticFiles()
                .UseBotFramework()
                .UseMvc(routes =>
                {
                    routes.MapRoute(
                        name: "default",
                        template: "{controller=Home}/{action=Index}/{id?}");
                });
        }
    }
}
