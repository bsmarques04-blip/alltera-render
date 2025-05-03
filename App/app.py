"""
Flask application file

"""

from flask import Flask, render_template
from models import User

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/app/')
def app_index():
    all_users = User.select()
    return render_template('app.html', users=all_users)


if __name__ == '__main__':
    app.run(port=8000, debug=True)
