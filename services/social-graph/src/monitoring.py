"""
Monitoring and Observability Setup
"""

from fastapi import FastAPI, Request
from prometheus_client import Counter, Histogram, Gauge
import time
import logging

logger = logging.getLogger(__name__)

# Metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

active_connections = Gauge(
    'active_connections',
    'Number of active connections'
)


def setup_monitoring(app: FastAPI):
    """Setup monitoring middleware"""

    @app.middleware("http")
    async def monitor_requests(request: Request, call_next):
        """Monitor all HTTP requests"""
        start_time = time.time()

        # Increment active connections
        active_connections.inc()

        try:
            # Process request
            response = await call_next(request)

            # Record metrics
            duration = time.time() - start_time
            http_requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()

            http_request_duration.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(duration)

            # Add response headers
            response.headers["X-Process-Time"] = str(duration)

            return response

        except Exception as e:
            # Record error metrics
            http_requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status=500
            ).inc()
            raise

        finally:
            # Decrement active connections
            active_connections.dec()