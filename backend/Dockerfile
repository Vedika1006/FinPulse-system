# NOTE: requirements.txt includes prophet + cmdstanpy (kept for the Railway
# production deployment, which builds via NIXPACKS, not this Dockerfile —
# see railway.toml). Installing them here will make `docker-compose build`
# noticeably slow (~5-10 minutes) since cmdstanpy compiles CmdStan from
# source. This is a one-time cost per image build, not per `docker-compose up`.
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed by the ML stack
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    zlib1g \
    libgomp1 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port
EXPOSE 8000

# Start the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
