from setuptools import setup, find_packages

setup(
    name="wayfare",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "python-dotenv",
        "pydantic",
        "pydantic-settings",
        "googlemaps",
        "polyline",
        "aiohttp",
        "jinja2",
        "langchain",
    ],
    python_requires=">=3.8",
)
