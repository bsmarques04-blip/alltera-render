from flask import Flask, render_template
from models import db, Categoria

app = Flask(__name__)

@app.before_first_request
def criar_tabelas():
    db.connect()
    db.create_tables([Categoria], safe=True)
    
      # Categorias padrão
    categorias = ["Económico", "Silver", "Gold"]
    for nome in categorias:
        if not Categoria.select().where(Categoria.nome == nome).exists():
            Categoria.create(nome=nome)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
