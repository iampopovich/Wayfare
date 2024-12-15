from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/task/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}


@app.put("/task/create/")
def create_item(q: str = None):
    return {"q": q}


@app.delete("/task/delete/{item_id}")
def delete_item(item_id: int):
    return {"item_id": item_id}


@app.put("/task/update/{item_id}")
def update_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}
