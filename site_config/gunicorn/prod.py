"""Gunicorn *production* config file"""

# Django WSGI application path in pattern MODULE_NAME:VARIABLE_NAME
wsgi_app = "kershner.wsgi:application"

# The number of worker processes for handling requests
workers = 3
max_requests = 1000
max_requests_jitter = 100

# Allow concurrency without extra worker processes
worker_class = "gthread"
threads = 8

keepalive = 2
timeout = 60
graceful_timeout = 30

# The socket to bind
bind = "127.0.0.1:8000"

# Write access and error info to /var/log
accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"

# Redirect stdout/stderr to log file
capture_output = True

# Don't daemonize, as we are monitoring Gunicorn with supervisor
daemon = False