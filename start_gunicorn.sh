#!/bin/bash

DJANGO_WSGI_MODULE=portfolio.wsgi
DJANGO_SETTINGS_DIR=site_config/gunicorn

# Activate the virtual environment
cd $DJANGODIR
source /home/ubuntu/portfolio/venv/bin/activate
export PYTHONPATH=$DJANGODIR:$PYTHONPATH

# Create the run directory if it doesn't exist
RUNDIR=$(dirname $SOCKFILE)
test -d $RUNDIR || mkdir -p $RUNDIR

# Start Gunicorn using Python config file
exec gunicorn ${DJANGO_WSGI_MODULE}:application -c ${DJANGO_SETTINGS_DIR}/prod.py