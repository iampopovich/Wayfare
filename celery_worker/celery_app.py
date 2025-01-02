from celery import Celery
app = Celery('tasks', broker='redis://redis-cache:6379/0')
