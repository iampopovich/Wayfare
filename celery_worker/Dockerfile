FROM python:3.11-alpine
WORKDIR /home/app
COPY . .
RUN pip install -r celery_worker/requirements.txt
CMD ["celery", "-A", "celery_worker.celery_app", "worker", "--loglevel=info"]