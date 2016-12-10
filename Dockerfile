FROM node:0.12

COPY ./ /var/www/

WORKDIR /var/www
RUN npm install

ENTRYPOINT ["node"]
CMD ["server.js"]
