from app import app, db
from models import Car, Rental

with app.app_context():
    # Delete all rentals first due to foreign key constraints
    num_rentals = Rental.query.delete()
    # Delete all cars
    num_cars = Car.query.delete()
    db.session.commit()
    print(f"Deleted {num_rentals} rental records and {num_cars} car records from the database.")
