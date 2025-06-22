import os
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session
from models import db, User, ContactMessage, Car, Rental
import random

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
        email = request.form['email']
        password = request.form['password']
        # Exemplo simples: trocar credenciais em produção
        if email == 'admin@gmail.com' and password == 'secret':
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
import os
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = os.path.join('App', 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/admin/cars', methods=['GET', 'POST'])
@admin_required
def admin_cars():
    if request.method == 'POST':
        print("Form data received:", request.form)  # Debug print
        car_id = request.form.get('car_id')
        update_flag = request.form.get('update')
        print(f"car_id: {car_id}, update: {update_flag}")  # Debug print
        if car_id:
            car = Car.query.get(car_id)
            if car and update_flag == 'true':
                # Update existing car
                car.title = request.form['title']
                car.description = request.form['description']
                car.price_per_day = float(request.form['price_per_day'])
                car.color = request.form.get('color')
                car.year = int(request.form.get('year')) if request.form.get('year') else None
                car.mileage = int(request.form.get('mileage')) if request.form.get('mileage') else None
                car.seats = int(request.form.get('seats')) if request.form.get('seats') else None
                car.is_premium = 'is_premium' in request.form
                image_url = request.form.get('image_url')
                if image_url:
                    car.image_url = image_url
                db.session.commit()
                flash('Carro atualizado com sucesso', 'success')
            elif car and car_id and update_flag != 'true':
                # Delete car
                db.session.delete(car)
                db.session.commit()
                flash('Carro eliminado com sucesso', 'success')
            else:
                flash('Carro não encontrado', 'danger')
            return redirect(url_for('admin_cars'))
        else:
            title = request.form['title']
            description = request.form['description']
            price_per_day = float(request.form['price_per_day'])
            color = request.form.get('color')
            year = request.form.get('year')
            mileage = request.form.get('mileage')
            seats = request.form.get('seats')
            is_premium = 'is_premium' in request.form

            # Sanitize numeric inputs by removing dots and commas
            def sanitize_int(value):
                if value:
                    return int(value.replace('.', '').replace(',', ''))
                return None

            # Handle image URL input instead of file upload
            image_url = request.form.get('image_url')
            if not image_url:
                flash('Por favor, forneça o link da imagem do carro.', 'danger')
                return redirect(url_for('admin_cars'))

            car = Car(title=title, description=description,
                      price_per_day=price_per_day,
                      color=color,
                      year=sanitize_int(year),
                      mileage=sanitize_int(mileage),
                      seats=sanitize_int(seats),
                      image_url=image_url, is_premium=is_premium)
            db.session.add(car)
            db.session.commit()
            flash('Carro adicionado com sucesso', 'success')
            return redirect(url_for('admin_cars'))
    cars = Car.query.all()
    # Convert cars to list of dicts for JSON serialization in template
    cars_serializable = []
    for car in cars:
        cars_serializable.append({
            'id': car.id,
            'title': car.title,
            'description': car.description,
            'price_per_day': car.price_per_day,
            'color': car.color,
            'year': car.year,
            'mileage': car.mileage,
            'seats': car.seats,
            'image_url': car.image_url,
            'is_premium': car.is_premium
        })
    return render_template('admin/cars.html', cars=cars_serializable)

# Gestão de utilizadores
@app.route('/admin/users', methods=['GET', 'POST'])
@admin_required
def admin_users():
    if request.method == 'POST':
        user_id = request.form.get('user_id')
        user = User.query.get(user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            flash('Utilizador eliminado com sucesso', 'success')
        else:
            flash('Utilizador não encontrado', 'danger')
        return redirect(url_for('admin_users'))
    users = User.query.all()
    return render_template('admin/users.html', users=users)

# Gestão de reservas
@app.route('/admin/reservations', methods=['GET', 'POST'])
@admin_required
def admin_reservations():
    if request.method == 'POST':
        rental_id = request.form.get('rental_id')
        rental = Rental.query.get(rental_id)
        if rental:
            db.session.delete(rental)
            db.session.commit()
            flash('Reserva eliminada com sucesso', 'success')
        else:
            flash('Reserva não encontrada', 'danger')
        return redirect(url_for('admin_reservations'))
    rentals = Rental.query.all()
    return render_template('admin/reservations.html', rentals=rentals)

@app.route('/')
def home():
    cars = Car.query.all()
    return render_template('index.html', cars=cars)

@app.route('/collection')
def collection():
    # Disable automatic addition of sample cars to allow only admin additions
    cars = Car.query.all()
    return render_template('collection.html', cars=cars)

@app.route('/car_details/<int:car_id>')
def car_details(car_id):
    car = Car.query.get_or_404(car_id)
    # Ensure car.photo_urls includes the main image_url as first photo
    if hasattr(car, 'photo_urls') and car.photo_urls:
        if car.image_url not in car.photo_urls:
            car.photo_urls.insert(0, car.image_url)
    else:
        car.photo_urls = [car.image_url] if car.image_url else []
    return render_template('car_details.html', car=car)

@app.route('/reserve/<int:car_id>', methods=['GET', 'POST'])
def reserve_car(car_id):
    if 'user_id' not in session:
        flash('Precisa de fazer login para reservar um carro.', 'warning')
        return redirect(url_for('login'))
    car = Car.query.get_or_404(car_id)
    if request.method == 'POST':
        start_date_str = request.form.get('start_date')
        end_date_str = request.form.get('end_date')
        payment_method = request.form.get('payment_method')

        # Collect payment details based on method
        payment_details = {}
        if payment_method == 'credit_card':
            payment_details['cc_number'] = request.form.get('cc_number')
            payment_details['cc_expiry'] = request.form.get('cc_expiry')
            payment_details['cc_cvv'] = request.form.get('cc_cvv')
        elif payment_method == 'paypal':
            payment_details['paypal_email'] = request.form.get('paypal_email')
        elif payment_method == 'bank_transfer':
            payment_details['bank_account'] = request.form.get('bank_account')
            payment_details['iban'] = request.form.get('iban')

        from datetime import datetime
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            if end_date < start_date:
                flash('A data de fim deve ser posterior à data de início.', 'danger')
                return render_template('reserve.html', car=car)
        except Exception as e:
            flash('Datas inválidas.', 'danger')
            return render_template('reserve.html', car=car)

        # TODO: Store payment_details as needed (e.g., in Rental model or external system)

        rental = Rental(user_id=session['user_id'], car_id=car.id, start_date=start_date, end_date=end_date)
        db.session.add(rental)
        db.session.commit()
        flash(f'Reserva confirmada para {car.title} com pagamento via {payment_method}.', 'success')
        return redirect(url_for('meus_carros'))
    return render_template('reserve.html', car=car)

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
        email = request.form.get('email')
        senha = request.form.get('password')
        if not email or not senha:
            flash('Por favor, preencha todos os campos.', 'warning')
            return render_template('login.html')
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
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Email já está em uso. Por favor, use outro email.', 'danger')
            return redirect(url_for('signup'))
        user = User(name=nome, email=email, password=senha)
        db.session.add(user)
        db.session.commit()
        flash(f'Conta criada para {nome}', 'success')
        return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/meus_carros')
def meus_carros():
    from datetime import datetime, timedelta
    user_id = session.get('user_id')
    if not user_id:
        flash('Precisa de fazer login para ver os seus carros.', 'warning')
        return redirect(url_for('login'))
    now = datetime.utcnow()
    current_rentals = Rental.query.filter(Rental.user_id == user_id, (Rental.end_date == None) | (Rental.end_date > now)).all()
    past_rentals = Rental.query.filter(Rental.user_id == user_id, Rental.end_date != None, Rental.end_date <= now).all()
    return render_template('carros.alugados.html', current_rentals=current_rentals, past_rentals=past_rentals, now=now, timedelta=timedelta)

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('Logout efetuado', 'info')
    return redirect(url_for('login'))

from flask import abort

@app.route('/cancel_reservation/<int:rental_id>', methods=['POST'])
def cancel_reservation(rental_id):
    user_id = session.get('user_id')
    if not user_id:
        flash('Precisa de fazer login para cancelar uma reserva.', 'warning')
        return redirect(url_for('login'))
    rental = Rental.query.get_or_404(rental_id)
    if rental.user_id != user_id:
        abort(403)
    from datetime import datetime
    rental.end_date = datetime.utcnow()
    db.session.commit()
    flash(f'Reserva do carro {rental.car.title} cancelada com sucesso.', 'success')
    return redirect(url_for('meus_carros'))


if __name__ == '__main__':
    app.run(debug=True)
