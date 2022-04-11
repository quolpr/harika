FROM nginx:alpine

WORKDIR /home/app

COPY build/proxy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx","-g","daemon off;"]
