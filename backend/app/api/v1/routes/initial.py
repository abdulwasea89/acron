""" Main first page route  """

from fastapi import APIRouter

router = APIRouter()

router.get("/", include_in_schema=False)(lambda: {"message": "Welcome to the API!"})