from flask import Flask, render_template, session, redirect, url_for, request, flash
from models import db, Categoria, Veiculo, Cliente, Reserva
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = "segredo"

UPLOAD_FOLDER = "static/images"

# LOGIN 
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        # Se for admin fixo:
        if email == "admin@gmail.com" and password == "1234":
            session["admin"] = True
            flash("Login de administrador efetuado com sucesso!", "success")
            return redirect(url_for("admin_panel"))

        # Senão, tenta como cliente
        cliente = Cliente.get_or_none(Cliente.email == email)
        if cliente and cliente.check_password(password):
            session["cliente_id"] = cliente.id
            session["cliente_nome"] = cliente.nome
            flash(f"Bem-vindo, {cliente.nome}!", "success")
            return redirect(url_for("index"))

        flash("Credenciais inválidas!", "danger")

    return render_template("login_client.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("Sessão terminada com sucesso!", "success")
    return redirect(url_for("index"))

#  PAINEL ADMIN
@app.route("/admin")
def admin_panel():
    if "admin" not in session:
        return redirect(url_for("login_admin"))
    return render_template("admin_panel.html")

@app.route("/add_vehicle", methods=["GET", "POST"])
def add_vehicle():
    if "admin" not in session:
        return redirect(url_for("login_admin"))

    if request.method == "POST":
        tipo = request.form.get("type")
        brand = request.form.get("brand")
        model = request.form.get("model")
        year = int(request.form.get("year"))
        price_per_day = float(request.form.get("price_per_day"))
        categoria_id = int(request.form.get("categoria"))

        categoria = Categoria.get_by_id(categoria_id)

        imagens = []
        files = request.files.getlist("imagens")
        for file in files:
            if file.filename != "":
                filename = secure_filename(file.filename)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                imagens.append(filename)

        imagens_str = ",".join(imagens)

        Veiculo.create(
            type=tipo,
            brand=brand,
            model=model,
            year=year,
            price_per_day=price_per_day,
            imagens=imagens_str,
            categoria=categoria
        )

        flash("Veículo adicionado com sucesso!", "success")
        return redirect(url_for("admin_panel"))

    categorias = Categoria.select()
    return render_template("add_vehicle.html", categorias=categorias)

# LANDING PAGE
@app.route("/")
def index():
    veiculos = Veiculo.select().where(Veiculo.status == True)
    veiculos_carros = [v for v in veiculos if v.type == "CARRO"]
    veiculos_motas = [v for v in veiculos if v.type == "MOTA"]
    return render_template("index.html", veiculos_carros=veiculos_carros, veiculos_motas=veiculos_motas)

#  PROTEGER ROTAS DE ADMIN
@app.before_request
def check_admin_session():
    admin_routes = ["/admin", "/add_vehicle", "/admin/veiculos", "/edit_vehicle", "/delete_vehicle"]
    if any(request.path.startswith(route) for route in admin_routes):
        if "admin" not in session and request.endpoint != "login_admin":
            return redirect(url_for("login_admin"))

# CRIAR TABELAS E DADOS
with app.app_context():
    if db.is_closed():
        db.connect()
    db.create_tables([Categoria, Veiculo, Cliente, Reserva], safe=True)

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

# CRUD ADMIN VEÍCULOS
@app.route("/admin/veiculos")
def admin_veiculos_gestao():
    if "admin" not in session:
        return redirect(url_for("login_admin"))
    
    veiculos = Veiculo.select().order_by(Veiculo.id.desc())
    return render_template("admin_veiculos_gestao.html", veiculos=veiculos)

@app.route("/edit_vehicle/<int:id>", methods=["GET", "POST"])
def edit_vehicle(id):
    if "admin" not in session:
        return redirect(url_for("login_admin"))

    veiculo = Veiculo.get_or_none(Veiculo.id == id)
    if not veiculo:
        flash("Veículo não encontrado.", "danger")
        return redirect(url_for("admin_veiculos_gestao"))

    if request.method == "POST":
        veiculo.type = request.form.get("type")
        veiculo.brand = request.form.get("brand")
        veiculo.model = request.form.get("model")
        veiculo.year = int(request.form.get("year"))
        veiculo.price_per_day = float(request.form.get("price_per_day"))
        veiculo.categoria = Categoria.get_by_id(int(request.form.get("categoria")))
        veiculo.save()

        flash("Veículo atualizado com sucesso!", "success")
        return redirect(url_for("admin_veiculos_gestao"))

    categorias = Categoria.select()
    return render_template("edit_vehicle.html", veiculo=veiculo, categorias=categorias)

@app.route("/delete_vehicle/<int:id>")
def delete_vehicle(id):
    if "admin" not in session:
        return redirect(url_for("login_admin"))

    veiculo = Veiculo.get_or_none(Veiculo.id == id)
    if not veiculo:
        flash("Veículo não encontrado.", "danger")
        return redirect(url_for("admin_veiculos_gestao"))

    veiculo.delete_instance()
    flash("Veículo eliminado com sucesso!", "success")
    return redirect(url_for("admin_veiculos_gestao"))

# REGISTO DE CLIENTE
@app.route("/register", methods=["GET", "POST"])
def register_client():
    if request.method == "POST":
        nome = request.form.get("nome")
        email = request.form.get("email")
        password = request.form.get("password")

        if Cliente.select().where(Cliente.email == email).exists():
            flash("Este email já está registado.", "danger")
            return redirect(url_for("register_client"))

        cliente = Cliente.create(nome=nome, email=email)
        cliente.set_password(password)
        cliente.save()

        flash("Registo efetuado com sucesso! Faça login.", "success")
        return redirect(url_for("login"))

    return render_template("register_client.html")

if __name__ == "__main__":
    app.run(debug=True)
