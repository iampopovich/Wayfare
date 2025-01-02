FROM python:3.11-alpine
WORKDIR /home/app
COPY . .
RUN pip install -r app/requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]