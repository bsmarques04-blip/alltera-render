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

@app.route('/')
def home():
    cars = Car.query.all()
    return render_template('index.html', cars=cars)

@app.route('/collection')
def collection():
    # Verifica se já existem carros na base de dados
    existing_titles = {car.title for car in Car.query.all()}
    sample_cars = [
        Car(title='Ford Fiesta', description='Compact and efficient', price_per_day=30, image_url='ford_fiesta.jpg', is_premium=False),
        Car(title='BMW X7', description='Luxury SUV', price_per_day=80, image_url='bmw_x7.jpg', is_premium=False),
        Car(title='Audi A5', description='Comfort and style', price_per_day=50, image_url='audi_a5.jpg', is_premium=False),
        Car(title='Tesla Model 3', description='Electric and innovative', price_per_day=70, image_url='images(1).jpeg', is_premium=False),
        Car(title='Honda Civic', description='Reliable and efficient', price_per_day=40, image_url='images.jpeg', is_premium=False),
        Car(title='Mercedes-Benz C-Class', description='Luxury and performance', price_per_day=90, image_url='images(1)', is_premium=True),
        Car(title='Volkswagen Golf', description='Compact and sporty', price_per_day=35, image_url='volkswagen-GOLF-GTE-MY24.webp', is_premium=False),
        Car(title='Mazda CX-5', description='Stylish and practical SUV', price_per_day=60, image_url='images(2)', is_premium=False),
        Car(title='Lexus RX 350', description='Luxury crossover SUV', price_per_day=95, image_url='large-17.avif', is_premium=True)
    ]
    new_cars = [car for car in sample_cars if car.title not in existing_titles]
    if new_cars:
        db.session.bulk_save_objects(new_cars)
        db.session.commit()
    cars = Car.query.all()
    return render_template('collection.html', cars=cars)

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
        rental = Rental(user_id=session['user_id'], car_id=car.id, start_date=start_date, end_date=end_date)
        db.session.add(rental)
        db.session.commit()
        flash(f'Reserva confirmada para {car.title} com pagamento via {payment_method}.', 'success')
        return redirect(url_for('meus_carros'))
    return render_template('reserve.html', car=car)

@app.route('/car_details/<int:car_id>')
def car_details(car_id):
    car = Car.query.get_or_404(car_id)

    if car.title == 'BMW X7':
        car.km = 120000
        car.year = 2022
        car.color = 'White'
        car.model = 'Economico'
        car.transmission = 'Automatica'
    elif car.title == 'Ford Fiesta':
        car.km = 50000
        car.year = 2021
        car.color = 'Black'
        car.model = 'Luxury'
        car.transmission = 'Automatic'
    elif car.title == 'Audi A5':
        car.km = 70000
        car.year = 2020
        car.color = 'Silver'
        car.model = 'Standard'
        car.transmission = 'Manual'
    elif car.title == 'Tesla Model 3':
        car.km = 30000
        car.year = 2023
        car.color = 'Red'
        car.model = 'Electric'
        car.transmission = 'Automatic'
        car.photo_urls = [
            'https://cdn.easysite.pt/noticias/publicados/24629897-0.jpeg',
            'https://live.staticflickr.com/65535/53382776892_bab9abe448_k.jpg',
            'https://www.ayvens.com/-/media/leaseplan-digital/pt/business-lease-and-private-lease/spotlight-pages/135_tesla-model-3/tesla-model_3-2018-1280-12.jpg?rev=-1&mw=480&io=transform%3Afill%2Cwidth%3A480'
        ]
    elif car.title == 'Honda Civic':
        car.km = 90000
        car.year = 2019
        car.color = 'Blue'
        car.model = 'Sport'
        car.transmission = 'Manual'
        car.photo_urls = [
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3mMqcRYCJDeEBVysy-BNQ07cXezqh7bf-LQ&s',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwMOHcTM6N_Oowe5-GGNaVhsxsfrouDZF_6w&s',
            'https://di-uploads-pod11.dealerinspire.com/hondaofkirkland/uploads/2019/12/2020-Civic-Sedan-dashboard.png'
        ]
    elif car.title == 'Mercedes-Benz C-Class':
        car.km = 40000
        car.year = 2022
        car.color = 'White'
        car.model = 'Luxury'
        car.transmission = 'Automatic'
        car.photo_urls = [
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-FByddYneZoh5lSWTNI3dti6g26pL59MyJg&s',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTWZFRm7n1OrhVE683Ee3okZyGPF2rqRc25SQ&s',
            'https://www.topgear.com/sites/default/files/2021/11/Mercedes_C300D_0000.jpg'
        ]
    elif car.title == 'Volkswagen Golf':
        car.km = 85000
        car.year = 2018
        car.color = 'Green'
        car.model = 'Sporty'
        car.transmission = 'Manual'
        car.photo_urls = [
            'https://www.razaoautomovel.com/wp-content/uploads/2024/06/Volkswagen-Golf-GTE-MY24.webp',
            'https://cdn.aquelamaquina.pt/images/2024-01/img_944x629$2024_01_24_14_12_20_232123.jpg',
            'https://www.volkswagen.pt/dam/images/1a452ba4346eac23c79a5c456888c8c3a0fc4ab8/e84b3407e6aea041462a298907c0f39c/de059491-ad7a-46d4-9008-4e1b957d0815/crop:100:100:CENTER:0:0/resize:3840:2160/gl6291v1'
        ]
    elif car.title == 'Mazda CX-5':
        car.km = 60000
        car.year = 2021
        car.color = 'Blue'
        car.model = 'Practical SUV'
        car.transmission = 'Automatic'
        car.photo_urls = [
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKnrtBexNOAVSiLSXDsDIw06rOdbhNqyyrdQ&s',
            'https://media-assets.mazda.eu/image/upload/q_auto,f_auto/mazdapt/contentassets/f0430635034c48f4961352f64d8a490a/03_mx-5-rf-gallery-navigation_mobile_720x406-1.jpg?rnd=496d5b',
            'https://hips.hearstapps.com/hmg-prod/images/2025-mazda-mx-5-miata-35th-anniversary-pr-110-6792ba6956958.jpg?crop=1xw:0.84375xh;center,top&resize=1200:*'
        ]
    elif car.title == 'Lexus RX 350':
        car.km = 35000
        car.year = 2023
        car.color = 'Black'
        car.model = 'Luxury Crossover'
        car.transmission = 'Automatic'
        car.photo_urls = [
            'https://tmna.aemassets.toyota.com/is/image/toyota/lexus/images/models/rx/2025/visualizer/350-premium/exterior/19-inch-five-spoke-alloy-wheels-with-dark-gray-metallic-and-machined-finish/eminent-white-pearl/large-17.jpg?extend=-378,-507,-378,-507&hei=600&wid=750&qlt=100',
            'https://tmna.aemassets.toyota.com/is/image/toyota/lexus/images/models/rx/2025/visualizer/350-premium/exterior/19-inch-five-spoke-alloy-wheels-with-dark-gray-metallic-and-machined-finish/eminent-white-pearl/large-5.jpg?extend=-378,-507,-378,-507&hei=600&wid=750&qlt=100',
            'https://tmna.aemassets.toyota.com/is/image/toyota/lexus/images/models/rx/2025/visualizer/350-premium/exterior/19-inch-five-spoke-alloy-wheels-with-dark-gray-metallic-and-machined-finish/eminent-white-pearl/large-8.jpg?extend=-378,-507,-378,-507&hei=600&wid=750&qlt=100',
            'https://di-uploads-pod25.dealerinspire.com/lexusoftampabay/uploads/2020/11/2021-Lexus-RX-Front-Interior-1.jpg'
        ]
    else:
        car.km = 100000
        car.year = 2015
        car.color = 'White'
        car.model = 'Standard'
        car.transmission = 'Manual'

    if car.title == 'Ford Fiesta':
        car.photo_urls = [
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkMzr06lQM8GWDD4f0zz4nWUq3qE2oA0g8qw&s',
            'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiAHIoKo6AQnA7vlMUFgg3-Dly7JSnv0wLVQenQhYZTCjU6OGg2s21Vra77vqFfGtCpYwYD4sDHX-jh1X7aGkblXJCDHdeYkuf1329iCrFnE449ATpoc3PkRLihDtI-DFBUTD3pqGJFTWzl/s2048/Novo-Ford-Fiesta-2022+%252814%2529.jpg',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2HCkfkvPtYs2m-1C9TM8ga9oIiFCMUHe3gA&s'
        ]
    elif car.title == 'BMW X7':
        car.photo_urls = [
            'https://hips.hearstapps.com/hmg-prod/images/2025-bmw-x5-xdrive40i-108-6824bd45baa30.jpg?crop=0.641xw:0.540xh;0.131xw,0.315xh&resize=1200:*',
            'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwL0uO3w2fC6VD3FFWjLkilioJpDZgOBMw8w&s'
        ]
    elif car.title == 'Audi A5':
        car.photo_urls = [
            'https://cdn.jornaldenegocios.pt/images/2015-11/img_900x561uu2015-11-06-15-09-00-267483.jpg',
            'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjE143dsh3p1KaqQWkJZ1kFc358hSXZytS5lN4SqZ1hIe2fL4IG9MXyEOfvSXr2A_Jg_I59A0SPwEfmPLCHwXOD6h6Xp0AWh6Ba24AxRQcGaPOZBfhZ8Ueo5VCxtdbrSMyJOD7l20lpIfU/s1600/novo-Audi-A4-2017+%25283%2529.jpg'
        ]

    return render_template('car_details.html', car=car)

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
