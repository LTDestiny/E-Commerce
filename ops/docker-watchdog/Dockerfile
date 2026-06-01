FROM alpine:3.20

RUN apk add --no-cache docker-cli

COPY watchdog.sh /usr/local/bin/watchdog.sh
RUN chmod +x /usr/local/bin/watchdog.sh

CMD ["/usr/local/bin/watchdog.sh"]
