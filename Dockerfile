FROM microsoft/dotnet:2.1-sdk-stretch as builder

LABEL Description='.net Core SDK security hardened Image' \
    Vendor='Englander Institute for Precision Medicine' \
    maintainer='paz2010@med.cornell.edu' \
    base_image='dotnetcore' \
    base_image_version='2.1-sdk-stretch' \
    base_image_SHA256='sha256:050b4b156899888af5e50a32b347c2383485ab8dc5e8f6db09999b1625a39e5f'

WORKDIR /app

# Copy everything and build
COPY /src .
RUN dotnet restore Pmkb.Bot.csproj
RUN dotnet publish Pmkb.Bot.csproj -c Release -o out

#FROM microsoft/dotnet:2.1.1-aspnetcore-runtime

#LABEL Description='.net Core SDK security hardened Image' \
#    Vendor='Englander Institute for Precision Medicine' \
#    maintainer='paz2010@med.cornell.edu' \
#    base_image='dotnetcore' \
#    base_image_version='2.1-aspnetcore-runtime' \
#    base_image_SHA256='sha256:656bb7c1edf2d4c776f90818011eea29a5baf2b2ff0891d44c889b6591ebc7da'
    
#COPY --from=builder /app/out /app/out
#COPY --from=builder /app/pmkb.bot /app/out/pmkb.bot

EXPOSE 3978
#WORKDIR /app/out
#CMD ["dotnet", "Pmkb.Bot.dll"]