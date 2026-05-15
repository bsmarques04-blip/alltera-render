from flask import Flask


app = Flask(__name__)

from PlataformaApoioDecisaoComercial.app import app as app


if __name__ == "__main__":
    app.run(debug=True)
