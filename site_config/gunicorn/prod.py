"""Gunicorn *production* config file"""

# Django WSGI application path in pattern MODULE_NAME:VARIABLE_NAME
wsgi_app = "kershner.wsgi:application"

# The number of worker processes for handling requests
workers = 2

# The socket to bind
bind = "0.0.0.0:8000"

# Write access and error info to /var/log
accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"

# Redirect stdout/stderr to log file
capture_output = True

# Don't daemonize, as we are monitoring Gunicorn with supervisor
daemon = False