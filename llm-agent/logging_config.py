import logging
import os
from autogen_agentchat import EVENT_LOGGER_NAME, TRACE_LOGGER_NAME

def configure_autogen_logging():
    """
    Configure AutoGen AgentChat logging according to environment variables
    and Microsoft AutoGen best practices.
    """
    
    # Get log level from environment or default to INFO
    log_level = os.getenv("AUTOGEN_LOG_LEVEL", "INFO").upper()
    log_level_value = getattr(logging, log_level, logging.INFO)
    
    # Configure basic logging
    logging.basicConfig(
        level=logging.WARNING,  # Keep basic level at WARNING to reduce noise
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Configure AutoGen trace logging if enabled
    if os.getenv("AUTOGEN_ENABLE_TRACE_LOGGING", "true").lower() == "true":
        trace_logger = logging.getLogger(TRACE_LOGGER_NAME)
        trace_logger.addHandler(logging.StreamHandler())
        trace_logger.setLevel(logging.DEBUG)
        trace_logger.propagate = False  # Prevent duplicate logs
        
        print("✓ AutoGen trace logging enabled")
    
    # Configure AutoGen event logging if enabled  
    if os.getenv("AUTOGEN_ENABLE_EVENT_LOGGING", "true").lower() == "true":
        event_logger = logging.getLogger(EVENT_LOGGER_NAME)
        event_logger.addHandler(logging.StreamHandler())
        event_logger.setLevel(log_level_value)
        event_logger.propagate = False  # Prevent duplicate logs
        
        print("✓ AutoGen event logging enabled")
    
    # Configure application logger
    app_logger = logging.getLogger("smart_mock_ai")
    app_logger.setLevel(log_level_value)
    
    print(f"✓ AutoGen logging configured with level: {log_level}")

def get_logger(name: str = "smart_mock_ai"):
    """
    Get a configured logger instance for the application.
    
    Args:
        name: Logger name (defaults to application name)
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)

# Configure logging when module is imported
configure_autogen_logging()
