from peewee import *

# Ligação à base de dados SQLite
db = SqliteDatabase('database.db')

class BaseModel(Model):
    class Meta:
        database = db

class Categoria(BaseModel):
    nome = CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nome
