# Headless 24/7 bot host: python + cloudflared (free quick tunnel, URL published to the endpoint gist).
FROM python:3.12-slim
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH:-amd64}" \
 && chmod +x /usr/local/bin/cloudflared \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bot.py .
ENV CLOUDFLARED=/usr/local/bin/cloudflared PYTHONUNBUFFERED=1
CMD ["python", "-u", "bot.py"]
