"""The MongoDB database shared with the backend ("dentalChart")."""
from pymongo import MongoClient

from app.config import MONGODB_URI

db = MongoClient(MONGODB_URI)["dentalChart"]
