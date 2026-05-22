"""
wsgi.py — PythonAnywhere WSGI entry point

In the PythonAnywhere Web tab, set:
    Source code:      /home/<username>/cbse_web
    Working directory:/home/<username>/cbse_web
    WSGI config file: /home/<username>/cbse_web/wsgi.py

Then in this file, update the path below to match your username.
"""

import sys
import os

# ── Update this path to match your PythonAnywhere username ────
project_home = '/home/YOUR_USERNAME/cbse_web'

if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Point to the data directory so SQLite finds the right place
os.chdir(project_home)

from app import app as application  # noqa: F401
