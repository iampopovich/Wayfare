import logging
from fastapi.logger import logger as fastapi_logger

def setup_logging():
    # Configure logging format
    logging_format = "%(asctime)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format=logging_format,
        datefmt=date_format
    )
    
    # Configure FastAPI logger
    fastapi_logger.handlers = logging.getLogger("uvicorn").handlers
    fastapi_logger.setLevel(logging.INFO)
