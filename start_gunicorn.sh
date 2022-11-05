#!/bin/bash

NAME="kershner"                                                 # Name of the application
DJANGODIR=/home/portfolio/portfolio                             # Django project directory
SOCKFILE=/home/portfolio/venv/run/gunicorn.sock                 # we will communicate using this unix socket
USER=ubuntu                                                     # the user to run as
GROUP=ubuntu                                                    # the group to run as
NUM_WORKERS=3                                                   # how many worker processes should Gunicorn spawn
DJANGO_SETTINGS_MODULE=site_config.settings.prod                # which settings file should Django use
DJANGO_WSGI_MODULE=portfolio.wsgi                               # WSGI module name
ERROR_LOG=/home/ubuntu/logs/gunicorn_error.log
ACCESS_LOG=/home/ubuntu/logs/gunicorn_access.log
echo "Starting $NAME as `whoami`"

# Activate the virtual environment
cd $DJANGODIR
source /home/portfolio/venv/bin/activate
export DJANGO_SETTINGS_MODULE=$DJANGO_SETTINGS_MODULE
export PYTHONPATH=$DJANGODIR:$PYTHONPATH

# Create the run directory if it doesn't exist
RUNDIR=$(dirname $SOCKFILE)
test -d $RUNDIR || mkdir -p $RUNDIR

# Start your Django Unicorn
# Programs meant to be run under supervisor should not daemonize themselves (do not use --daemon)
exec gunicorn ${DJANGO_WSGI_MODULE}:application \
  --name $NAME \
  --workers $NUM_WORKERS \
  --timeout 30 \
  --user=$USER --group=$GROUP \
  --bind=unix:$SOCKFILE \
  --log-level=debug \
  --error-logfile $ERROR_LOG \
  --access-logfile $ACCESS_LOG \
  --capture-output