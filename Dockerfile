FROM node:7.7.4
MAINTAINER Alexandros Sigaras <als2076@med.cornell.edu>
#===============================#
# Docker Image Configuration	#
#===============================#
LABEL Description="PMKB Bot" \
		Vendor="Englander Institute for Precision Medicine"
WORKDIR /usr/src/app
#===================================#
# Install PMKB Bot Dependencies     #
#===================================#
COPY package.json /usr/src/app/
RUN npm install
# Bundle app source
COPY . /usr/src/app
#===================================#
# Startup							#
#===================================#
EXPOSE 3978
CMD [ “npm”, “start” ]