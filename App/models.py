"""
Models file

"""

from peewee import *

db = SqliteDatabase('database.db')
db.connect(reuse_if_open=True)


def clear_database():
    """Clears the database."""
    db.drop_tables(models, safe=True)

def create_tables():
    """Recreates the database."""
    db.create_tables(models, safe=True)


class User(db.Model):
    name = CharField()
    username = CharField()
    password = CharField()

    def __str__(self):
        return f'User ({self.name})'


models = [User, ]


if __name__ == '__main__':
    # Recreate DB
    clear_database()
    create_tables()

    # Create users
    bart = User(name='Bart Simpson', username='bart', password='1234')
    bart.save()

    homer = User(name='Homer Simpson', username='homer', password='1234')
    homer.save()
