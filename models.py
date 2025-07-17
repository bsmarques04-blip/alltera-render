from peewee import *
from enum import Enum
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

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
    descricao_longa = TextField(null=True)

class Cliente(BaseModel):
    nome = CharField()
    email = CharField(unique=True)
    password_hash = CharField()
    telefone = CharField(null=True)
    nif = CharField(null=True)
    morada = TextField(null=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Reserva(BaseModel):
    cliente = ForeignKeyField(Cliente, backref='reservas')
    veiculo = ForeignKeyField(Veiculo, backref='reservas')
    data_inicio = DateField()
    data_fim = DateField()
    estado = CharField(default="pendente")