from peewee import *
from enum import Enum
from datetime import date, timedelta

db = SqliteDatabase('database.db')

class BaseModel(Model):
    class Meta:
        database = db

class VehicleType(Enum):
    CARRO = "Carro"
    MOTA = "Mota"

class Categoria(BaseModel):
    nome = CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nome

class Veiculo(BaseModel):
    type = CharField(choices=[(v.name, v.value) for v in VehicleType])
    brand = CharField(max_length=100)
    model = CharField(max_length=100)
    year = IntegerField()
    price_per_day = FloatField()
    status = BooleanField(default=True)
    imagens = TextField(null=True)
    categoria = ForeignKeyField(Categoria, backref='veiculos')
