from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os
from dotenv import load_dotenv
import logging
import time
from core.logging import setup_logging
import uvicorn
from fastapi.exceptions import HTTPException

# Load environment variables from .env file
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

from api.dependencies import get_maps_service, get_travel_service
from api.v1 import maps, travel

app = FastAPI(title="Wayfare API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS, # Use settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests_middleware(request: Request, call_next): # Renamed for clarity
    """Log incoming requests, their processing time, and handle basic errors."""
    start_time = time.time()
    method = request.method
    path = request.url.path

    log_message = f"Request: {method} {path}"

    # Optionally log request body for specific methods or paths
    # For simplicity, logging only path and method for now.
    # Detailed body logging can be verbose and might expose sensitive data if not careful.
    # Consider adding specific decorators or dependencies for endpoints needing detailed body logging.
    # if method in ["POST", "PUT"] and "/api/v1/travel/route" in path: # Example: more specific path
    #     try:
    #         body = await request.json()
    #         log_message += f" - Body: {body}"
    #     except Exception:
    #         pass # Ignore if body is not valid JSON or not present

    logger.info(log_message)

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(
            f"Response: {method} {path} - Status: {response.status_code} - Duration: {process_time:.4f}s"
        )
        return response
    except Exception as e: # This is a very broad catch-all.
                           # Specific exception handlers registered with @app.exception_handler are generally preferred.
        process_time = time.time() - start_time
        logger.error(
            f"Error: {method} {path} - Exception: {str(e)} - Duration: {process_time:.4f}s",
            exc_info=True, # Log traceback
        )
        # It's generally better to let FastAPI's default 500 handler or custom registered handlers deal with this.
        # Re-raising allows other handlers to pick it up. If this is the *only* error handler, then return JSONResponse.
        # For now, assuming other handlers might exist or FastAPI default is fine.
        # However, the original code returned a JSONResponse, so we'll keep that behavior.
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error. Please check logs for more details."},
        )

# Mount static files
# Ensure the directory path is correct relative to where main.py is run.
# If main.py is in wayfare/, and static is in wayfare/static/, then "./static" is correct.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    # This case might occur if the script is run from a different working directory.
    # A more robust solution might involve settings or absolute paths.
    logger.warning(f"Static directory '{STATIC_DIR}' not found. Static files may not serve correctly.")
    # Attempt a relative path from project root if wayfare/main.py
    alt_static_dir = os.path.join(os.path.dirname(__file__), "..", "static") # if wayfare is a subdir of project root
    if os.path.exists(alt_static_dir):
        STATIC_DIR = alt_static_dir
    else: # Fallback to original behavior if complex resolution fails
        STATIC_DIR = "./static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Include routers
app.include_router(maps.router, prefix="/api/v1/maps", tags=["maps"])
app.include_router(travel.router, prefix="/api/v1/travel", tags=["travel"])


@app.get("/", include_in_schema=False) # Typically, root path serving HTML is not in API schema
async def root_page(): # Renamed for clarity
    """Serve the main application HTML page."""
    # Ensure the path to index.html is correct
    index_html_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_html_path):
        logger.error(f"index.html not found at {index_html_path}")
        return JSONResponse(status_code=404, content={"detail": "Main application page not found."})
    return FileResponse(index_html_path)


@app.get("/api/v1", summary="API Welcome", tags=["General"])
async def api_welcome_message(): # Renamed for clarity
    """Provides a welcome message and basic API information."""
    # This endpoint is useful for a quick check that the API is up.
    # The list of endpoints can become outdated; consider generating it dynamically if needed,
    # or relying solely on OpenAPI docs.
    return { # FastAPI automatically converts dict to JSONResponse
        "message": "Welcome to Wayfare API v1.0",
        "version": app.version, # Use app.version
        "documentation_url": app.docs_url, # Use FastAPI's configured docs_url
        "openapi_url": app.openapi_url, # Use FastAPI's configured openapi_url
        # "available_routes": { # Example of how to list some key routes, but /docs is better
        #     "maps_search": "/api/v1/maps/search",
        #     "travel_route_planning": "/api/v1/travel/route",
        # }
    }

# Custom HTTPException handler is good for consistent error format.
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException): # Renamed for clarity
    # Log the error or add any other custom logic here if needed
    # logger.error(f"HTTPException caught: Status {exc.status_code}, Detail: {exc.detail}", exc_info=True) # Example logging
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}, # FastAPI's default behavior, but good to have explicit
    )

# The default /openapi.json is already provided by FastAPI.
# This custom endpoint for /openapi.json might be redundant unless it's modifying the schema
# or serving a different purpose. If it's just to point to /docs, it's not needed.
# Removing it to rely on FastAPI's default.
# @app.get("/openapi.json", include_in_schema=False)
# async def get_openapi_json():
#     return JSONResponse({"documentation": "/docs", "openapi": "/openapi.json"})


if __name__ == "__main__":
    app_settings = get_settings() # Use the get_settings function

    port = app_settings.PORT # Use port from settings
    host = app_settings.HOST # Use host from settings

    # The Render-specific port check might be better suited for a startup script or check outside the main app logic
    # if this app is intended for multiple deployment environments.
    # For now, keeping it as it was, but flagging for potential future refactor.
    if os.getenv("RENDER"): # Check if running on Render explicitly
        reserved_ports = {18012, 18013, 19099}
        if port in reserved_ports:
            logger.critical(f"Port {port} is reserved by Render and cannot be used. Please configure a different port.")
            # Instead of raising ValueError which might not be caught well by uvicorn, exit or log critical.
            exit(1) # Exit if reserved port is used on Render.

    logger.info(f"Starting server on {host}:{port}, environment: {app_settings.ENVIRONMENT}")

    # Standard uvicorn run. Reload should ideally be False for production.
    # Reload is often controlled by how uvicorn is invoked (e.g. uvicorn main:app --reload)
    # rather than hardcoded in the run() call for production.
    # For development, `reload=True` is fine.
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        log_level=logging.getLevelName(logger.getEffectiveLevel()).lower(), # Sync uvicorn log level
        reload=True if app_settings.ENVIRONMENT == "development" else False # Enable reload only in dev
    )
