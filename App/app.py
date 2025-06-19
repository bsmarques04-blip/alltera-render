import os
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session
from models import db, User, ContactMessage, Car

# Configura paths
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, '..', 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)

def get_db_uri():
    db_path = os.path.join(INSTANCE_DIR, 'ressacar.db')
    return f'sqlite:///{db_path}'

# Inicializa app
app = Flask(__name__, instance_path=INSTANCE_DIR, instance_relative_config=True)
app.config['SECRET_KEY'] = 'mudar_para_chave_secreta'
app.config['SQLALCHEMY_DATABASE_URI'] = get_db_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa DB
db.init_app(app)
with app.app_context():
    db.create_all()

# Decorator para rotas admin
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_logged_in'):
            flash('Acesso admin necessário', 'warning')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated

# Rota de login admin
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        # Exemplo simples: trocar credenciais em produção
        if username == 'admin' and password == 'secret':
            session['admin_logged_in'] = True
            flash('Login admin bem-sucedido', 'success')
            return redirect(url_for('admin_dashboard'))
        flash('Credenciais inválidas', 'danger')
    return render_template('admin/login.html')

# Logout admin
@app.route('/admin/logout')
@admin_required
def admin_logout():
    session.pop('admin_logged_in', None)
    flash('Logout efetuado', 'info')
    return redirect(url_for('admin_login'))

# Dashboard admin
@app.route('/admin')
@admin_required
def admin_dashboard():
    return render_template('admin/dashboard.html')

# Gestão de carros
@app.route('/admin/cars', methods=['GET', 'POST'])
@admin_required
def admin_cars():
    if request.method == 'POST':
        title = request.form['title']
        description = request.form['description']
        price_per_day = float(request.form['price_per_day'])
        image_url = request.form['image_url']
        is_premium = 'is_premium' in request.form
        car = Car(title=title, description=description,
                  price_per_day=price_per_day,
                  image_url=image_url, is_premium=is_premium)
        db.session.add(car)
        db.session.commit()
        flash('Carro adicionado com sucesso', 'success')
        return redirect(url_for('admin_cars'))
    cars = Car.query.all()
    return render_template('admin/cars.html', cars=cars)

# Rotas públicas
def load_public_routes():
    @app.route('/')
    def home():
        cars = Car.query.all()
        return render_template('index.html', cars=cars)

    @app.route('/collection')
    def collection():
        cars = Car.query.all()
        return render_template('collection.html', cars=cars)

    @app.route('/services')
    def services():
        return render_template('services.html')

    @app.route('/contact', methods=['GET', 'POST'])
    def contact():
        if request.method == 'POST':
            nome = request.form['name']
            email = request.form['email']
            mensagem = request.form['message']
            msg = ContactMessage(name=nome, email=email, message=mensagem)
            db.session.add(msg)
            db.session.commit()
            flash(f'Obrigado pelo contacto, {nome}!', 'success')
            return redirect(url_for('contact'))
        return render_template('contact.html')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            email = request.form['email']
            senha = request.form['password']
            user = User.query.filter_by(email=email, password=senha).first()
            if user:
                session['user_id'] = user.id
                flash(f'Login bem-sucedido: {user.name}', 'info')
                return redirect(url_for('home'))
            flash('Credenciais inválidas', 'danger')
        return render_template('login.html')

    @app.route('/signup', methods=['GET', 'POST'])
    def signup():
        if request.method == 'POST':
            nome = request.form['name']
            email = request.form['email']
            senha = request.form['password']
            user = User(name=nome, email=email, password=senha)
            db.session.add(user)
            db.session.commit()
            flash(f'Conta criada para {nome}', 'success')
            return redirect(url_for('login'))
        return render_template('signup.html')

load_public_routes()

@app.route('/alugar_carro/<int:car_id>', methods=['POST'])
def alugar_carro(car_id):
    user_id = session.get('user_id')
    if not user_id:
        flash('Precisa de fazer login para alugar um carro.', 'warning')
        return redirect(url_for('login'))
    novo_aluguer = Rental(user_id=user_id, car_id=car_id, start_date=datetime.utcnow())
    db.session.add(novo_aluguer)
    db.session.commit()
    flash('Carro alugado com sucesso!', 'success')
    return redirect(url_for('meus_carros'))

if __name__ == '__main__':
    app.run(debug=True)