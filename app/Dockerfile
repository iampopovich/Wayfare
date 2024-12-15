FROM alpine:3.7
RUN apk add --no-cache python3 py3-pip
COPY requirements.txt /app/requirements.txt
WORKDIR /app
RUN pip3 install -r requirements.txt