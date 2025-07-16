from flask import Flask, render_template, session, redirect, url_for, request, flash, make_response
from models import db, Categoria, Veiculo, Cliente, Reserva
import os
from werkzeug.utils import secure_filename
from datetime import datetime
import csv
import io
import pandas as pd

app = Flask(__name__)
app.secret_key = "segredo"

UPLOAD_FOLDER = "static/images"

@app.route("/sobre")
def sobre():
    return render_template("sobre.html")

@app.route("/contacto")
def contacto():
    return render_template("contacto.html")

@app.route("/colecao")
def colecao():
    tipo = request.args.get("tipo")  # Ex: "CARRO"
    categoria_id = request.args.get("categoria")  # Ex: "1"

    query = Veiculo.select().where(Veiculo.status == True)

    if tipo:
        query = query.where(Veiculo.type == tipo)
    if categoria_id:
        query = query.where(Veiculo.categoria == int(categoria_id))

    categorias = Categoria.select()
    return render_template("colecao.html", veiculos=query, categorias=categorias, tipo_selecionado=tipo, categoria_selecionada=categoria_id)


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
        return redirect(url_for("login"))
    return render_template("admin_panel.html")

@app.route("/add_vehicle", methods=["GET", "POST"])
def add_vehicle():
    if "admin" not in session:
        return redirect(url_for("admin"))

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
            return redirect(url_for("login"))

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
        return redirect(url_for("login"))
    
    veiculos = Veiculo.select().order_by(Veiculo.id.desc())
    return render_template("admin_veiculos_gestao.html", veiculos=veiculos)

@app.route("/admin/reservas")
def admin_reservas():
    if "admin" not in session:
        return redirect(url_for("login"))

    estado = request.args.get("estado")
    if estado and estado != "todas":
        reservas = Reserva.select().where(Reserva.estado == estado).order_by(Reserva.data_inicio.desc())
    else:
        reservas = Reserva.select().order_by(Reserva.data_inicio.desc())

    return render_template("admin_reservas.html", reservas=reservas, filtro_estado=estado)


@app.route("/admin/cancelar_reserva/<int:id>")
def admin_cancelar_reserva(id):
    if "admin" not in session:
        return redirect(url_for("login"))

    reserva = Reserva.get_or_none(Reserva.id == id)
    if not reserva:
        flash("Reserva não encontrada.", "danger")
        return redirect(url_for("admin_reservas"))

    if reserva.estado != "cancelada":
        reserva.estado = "cancelada"
        reserva.save()
        flash("Reserva cancelada pelo administrador.", "success")
    else:
        flash("Reserva já estava cancelada.", "info")

    return redirect(url_for("admin_reservas"))

@app.route("/admin/atualizar_reserva/<int:id>", methods=["POST"])
def admin_atualizar_reserva(id):
    if "admin" not in session:
        return redirect(url_for("login"))

    reserva = Reserva.get_or_none(Reserva.id == id)
    if not reserva:
        flash("Reserva não encontrada.", "danger")
        return redirect(url_for("admin_reservas"))

    novo_estado = request.form.get("estado")
    if novo_estado:
        reserva.estado = novo_estado
        reserva.save()
        flash(f"Estado atualizado para '{novo_estado}'.", "success")

    return redirect(url_for("admin_reservas"))

# Exportar Reservas
@app.route("/admin/exportar_reservas/csv")
def exportar_reservas_csv():
    if "admin" not in session:
        return redirect(url_for("login"))

    reservas = Reserva.select()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Cliente", "Veículo", "Tipo", "Data Início", "Data Fim", "Estado"])

    for r in reservas:
        writer.writerow([
            r.id,
            r.cliente.nome,
            f"{r.veiculo.brand} {r.veiculo.model}",
            r.veiculo.type,
            r.data_inicio,
            r.data_fim,
            r.estado
        ])

    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=reservas.csv"
    response.headers["Content-type"] = "text/csv"
    return response


@app.route("/admin/exportar_reservas/excel")
def exportar_reservas_excel():
    if "admin" not in session:
        return redirect(url_for("login"))

    reservas = Reserva.select()
    data = []

    for r in reservas:
        data.append({
            "ID": r.id,
            "Cliente": r.cliente.nome,
            "Veículo": f"{r.veiculo.brand} {r.veiculo.model}",
            "Tipo": r.veiculo.type,
            "Data Início": r.data_inicio,
            "Data Fim": r.data_fim,
            "Estado": r.estado
        })

    df = pd.DataFrame(data)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Reservas')

    output.seek(0)
    response = make_response(output.read())
    response.headers["Content-Disposition"] = "attachment; filename=reservas.xlsx"
    response.headers["Content-type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return response

#Editar Veiuclos
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

# Apagar Veículos
@app.route("/delete_vehicle/<int:id>")
def delete_vehicle(id):
    if "admin" not in session:
        return redirect(url_for("login"))

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
        telefone = request.form.get("telefone")
        nif = request.form.get("nif")
        morada = request.form.get("morada")

        if Cliente.select().where(Cliente.email == email).exists():
            flash("Este email já está registado.", "danger")
            return redirect(url_for("register_client"))

        cliente = Cliente(
            nome=nome,
            email=email,
            telefone=telefone,
            nif=nif,
            morada=morada
        )
        cliente.set_password(password)
        cliente.save()

        flash("Registo efetuado com sucesso! Faça login.", "success")
        return redirect(url_for("login"))

    return render_template("register_client.html")

# Reservas
@app.route("/reserve/<int:veiculo_id>", methods=["GET", "POST"])
def reservar_veiculo(veiculo_id):
    if "cliente_id" not in session:
        flash("Tens de iniciar sessão para reservar.", "warning")
        return redirect(url_for("login"))

    veiculo = Veiculo.get_or_none(Veiculo.id == veiculo_id)
    if not veiculo:
        flash("Veículo não encontrado.", "danger")
        return redirect(url_for("index"))

    if request.method == "POST":
        data_inicio = request.form.get("data_inicio")
        data_fim = request.form.get("data_fim")

        if not data_inicio or not data_fim:
            flash("Preenche ambas as datas.", "warning")
            return redirect(url_for("reservar_veiculo", veiculo_id=veiculo_id))

        # Validar formato e lógica das datas
        try:
            d_inicio = datetime.strptime(data_inicio, "%Y-%m-%d").date()
            d_fim = datetime.strptime(data_fim, "%Y-%m-%d").date()
        except ValueError:
            flash("Formato de data inválido.", "danger")
            return redirect(url_for("reservar_veiculo", veiculo_id=veiculo_id))

        hoje = datetime.today().date()
        if d_inicio < hoje:
            flash("A data de início não pode ser anterior a hoje.", "warning")
            return redirect(url_for("reservar_veiculo", veiculo_id=veiculo_id))

        if d_fim <= d_inicio:
            flash("A data de fim deve ser posterior à data de início.", "warning")
            return redirect(url_for("reservar_veiculo", veiculo_id=veiculo_id))

        # Verificar conflitos de datas
        conflito = Reserva.select().where(
            (Reserva.veiculo == veiculo) &
            (Reserva.estado != "cancelada") &
            (
                (Reserva.data_inicio <= d_fim) &
                (Reserva.data_fim >= d_inicio)
            )
        ).exists()

        if conflito:
            flash("Este veículo já está reservado nessas datas.", "danger")
            return redirect(url_for("reservar_veiculo", veiculo_id=veiculo_id))

        # Criar reserva
        Reserva.create(
            cliente=session["cliente_id"],
            veiculo=veiculo,
            data_inicio=d_inicio,
            data_fim=d_fim
        )
        flash("Reserva efetuada com sucesso!", "success")
        return redirect(url_for("index"))

    return render_template("reserva_form.html", veiculo=veiculo)

# Minhas Reservas
@app.route("/minhas_reservas")
def minhas_reservas():
    if "cliente_id" not in session:
        flash("Tens de iniciar sessão para ver as tuas reservas.", "warning")
        return redirect(url_for("login"))

    reservas = Reserva.select().where(Reserva.cliente == session["cliente_id"]).order_by(Reserva.data_inicio.desc())
    return render_template("minhas_reservas.html", reservas=reservas)

@app.route("/cancelar_reserva/<int:id>")
def cancelar_reserva(id):
    if "cliente_id" not in session:
        flash("Tens de iniciar sessão.", "warning")
        return redirect(url_for("login"))

    reserva = Reserva.get_or_none(Reserva.id == id, Reserva.cliente == session["cliente_id"])
    if not reserva:
        flash("Reserva não encontrada.", "danger")
        return redirect(url_for("minhas_reservas"))

    if reserva.estado != "cancelada":
        reserva.estado = "cancelada"
        reserva.save()
        flash("Reserva cancelada com sucesso.", "success")
    else:
        flash("Esta reserva já foi cancelada.", "info")

    return redirect(url_for("minhas_reservas"))

@app.route('/perfil', methods=['GET', 'POST'])
def perfil():
    if 'cliente_id' not in session:
        return redirect(url_for('login'))

    cliente = Cliente.get_or_none(Cliente.id == session["cliente_id"])

    if not cliente:
        flash("Cliente não encontrado.", "danger")
        return redirect(url_for("index"))

    if request.method == 'POST':
        cliente.nome = request.form['nome']
        cliente.email = request.form['email']
        cliente.telefone = request.form['telefone']
        cliente.save()
        flash('Perfil atualizado com sucesso!', 'success')
        return redirect(url_for('perfil'))

    return render_template('perfil.html', cliente=cliente)


if __name__ == "__main__":
    app.run(debug=True)
