from flask import Flask, render_template, session, redirect, url_for, request, flash
from models import db, Categoria, Veiculo

app = Flask(__name__)
app.secret_key = "segredo"

# ROTAS ADMIN 
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "1234":
            session["admin"] = True
            flash("Login efetuado com sucesso!", "success")
            return redirect(url_for("admin_panel"))
        else:
            flash("Credenciais inválidas", "danger")

    return render_template("admin_login.html")

@app.route("/logout")
def logout():
    session.pop("admin", None)
    flash("Sessão terminada com sucesso", "success")
    return redirect(url_for("login"))

@app.route("/admin")
def admin_panel():
    if "admin" not in session:
        return redirect(url_for("login"))
    return render_template("admin_panel.html")

# LANDING PAGE 
@app.route("/")
def index():
    veiculos = Veiculo.select().where(Veiculo.status == True)
    veiculos_carros = [v for v in veiculos if v.type == "CARRO"]
    veiculos_motas = [v for v in veiculos if v.type == "MOTA"]
    return render_template("index.html", veiculos_carros=veiculos_carros, veiculos_motas=veiculos_motas)

# PROTEGER ROTAS 
@app.before_request
def check_admin_session():
    admin_routes = ["/admin"]
    if any(request.path.startswith(route) for route in admin_routes):
        if "admin" not in session and request.endpoint != "login":
            return redirect(url_for("login"))

#  CRIAR TABELAS E DADOS
with app.app_context():
    if db.is_closed():
        db.connect()
    db.create_tables([Categoria, Veiculo], safe=True)

    categorias = ["Económico", "Silver", "Gold"]
    for nome in categorias:
        if not Categoria.select().where(Categoria.nome == nome).exists():
            Categoria.create(nome=nome)

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

if __name__ == "__main__":
    app.run(debug=True)
