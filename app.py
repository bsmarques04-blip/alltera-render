from flask import Flask, render_template
from models import db, Categoria, Veiculo
from admin_views import login, logout, admin_panel

app = Flask(__name__)

with app.app_context():
    db.connect()
    db.create_tables([Categoria, Veiculo], safe=True)

# Inserir veículos exemplo
if not Veiculo.select().exists():
    cat_eco = Categoria.get(Categoria.nome == "Económico")
    Veiculo.create(
        type="CARRO",
        brand="BMW",
        model="Série 5",
        year=2022,
        price_per_day=120,
        imagens="carro1.jpg",
        categoria=cat_eco,
    )
    Veiculo.create(
        type="MOTA",
        brand="Yamaha",
        model="MT-07",
        year=2023,
        price_per_day=80,
        imagens="mota1.jpg",
        categoria=cat_eco,
    )
    
      # Categorias padrão
    categorias = ["Económico", "Silver", "Gold"]
    for nome in categorias:
        if not Categoria.select().where(Categoria.nome == nome).exists():
            Categoria.create(nome=nome)

@app.route("/")
def index():
    veiculos = Veiculo.select().where(Veiculo.status == True)
    veiculos_carros = [v for v in veiculos if v.type == "CARRO"]
    veiculos_motas = [v for v in veiculos if v.type == "MOTA"]
    return render_template("index.html", veiculos_carros=veiculos_carros, veiculos_motas=veiculos_motas)

@app.before_request
def check_admin_session():
    admin_routes = ["/admin", "/add_vehicle", "/edit_vehicle", "/delete_vehicle"]
    if any(request.path.startswith(route) for route in admin_routes):
        if "admin" not in session:
            return redirect(url_for("login"))

if __name__ == "__main__":
    app.run(debug=True)
