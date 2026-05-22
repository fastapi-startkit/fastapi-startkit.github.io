from fastapi_startkit.logging import Logger

# Once LoggerProvider is registered in bootstrap/application.py,
# the global Logger is accessible anywhere in your codebase.
# No local instantiation or repetitive configuration is required.

Logger.debug("This is a debug message")
Logger.info("Application is starting...")
Logger.notice("A formal notice")
Logger.warning("Unusual activity detected")
Logger.error("An error occurred during processing")
Logger.critical("System failure!")
Logger.alert("Immediate action required")
Logger.emergency("System is unusable")
